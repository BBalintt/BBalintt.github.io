import { tiletypes } from "../Controller/tileRegistry.js";
import { drawStoneTexture, drawWoodTexture, drawCobblestoneTexture } from "./textures.js";
import { getLoadedLineOfSight, getLoadedPortals } from "../Controller/generator.js";

let isDrawingScheduled = false;
export let backgroundImage = null;

export let currentWallStyle = "rocky"; 

export function setWallStyle(style) {
    if (style === "rocky" || style === "smooth") {
        currentWallStyle = style;
        scheduleDraw();
    }
}

export function getBackgroundImage() {
    return backgroundImage;
}

export function setBackgroundImage(img) {
    backgroundImage = img;
}

const roughness = 6;

const JITTER_TABLE_SIZE = 1024;
const JITTER_TABLE = new Float32Array(JITTER_TABLE_SIZE);
for (let i = 0; i < JITTER_TABLE_SIZE; i++) {
    JITTER_TABLE[i] = Math.random() * roughness;
}

function getFastJitter(x, y, i, side) {
    const index = (x * 31 + y * 17 + i * 7 + side * 13) & (JITTER_TABLE_SIZE - 1);
    return JITTER_TABLE[index];
}

export function scheduleDraw(matrix, bgImg = null) {
    if (bgImg !== null) {
        backgroundImage = bgImg;
    }
    if (!isDrawingScheduled) {
        isDrawingScheduled = true;
        requestAnimationFrame(() => {
            drawDungeon(matrix);
            isDrawingScheduled = false;
        });
    }
}

let lastMatrix = null;

export function drawDungeon(matrix, skipTiles = false) {
    if (matrix) {
        lastMatrix = matrix;
    } else {
        matrix = lastMatrix;
    }
    if (!matrix) return;

    const canvas = document.getElementById("dungeon");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const tileSize = 32;

    const rows = matrix.length;
    const cols = matrix[0].length;

    canvas.width = cols * tileSize;
    canvas.height = rows * tileSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }

    const tileLookup = new Map(tiletypes.map(t => [t.id, t]));

    const loadedLoS = getLoadedLineOfSight();
    if (loadedLoS && Array.isArray(loadedLoS)) {
        drawLoadedLineOfSight(ctx, loadedLoS);
    }

    if (!skipTiles) {
        ctx.save();
        if (backgroundImage) {
            ctx.globalAlpha = 0.4;
        }

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const tileId = matrix[y][x];
                const tileObj = tileLookup.get(tileId);

                if (tileObj && tileId !== 0) {
                    renderTileWithTexture(ctx, x, y, tileSize, tileObj);
                }
            }
        }
        ctx.restore();
    }

    if (!loadedLoS) {
        if (currentWallStyle === "smooth") {
            drawSmoothWalls(ctx, matrix, tileSize, rows, cols, tileLookup);
        } else {
            drawBatchedRockyWalls(ctx, matrix, tileSize, rows, cols, tileLookup);
        }
    }

    // 1. Ha betöltött fájlból vannak portálok, azt rajzoljuk
    // 2. Különben számoljuk ki élőben a mátrix alapján, hogy szerkesztés közben is látszódjanak!
    const loadedPortals = getLoadedPortals();
    if (loadedPortals && Array.isArray(loadedPortals) && loadedPortals.length > 0) {
        drawEditorPortals(ctx, loadedPortals, tileSize);
    } else {
        const calculatedPortals = calculatePortalsFromMatrix(matrix, tileSize);
        if (calculatedPortals.length > 0) {
            drawEditorPortals(ctx, calculatedPortals, tileSize);
        }
    }
}

function drawLoadedLineOfSight(ctx, lineOfSight) {
    ctx.save();
    ctx.strokeStyle = "#111111";
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    lineOfSight.forEach(polygon => {
        if (!Array.isArray(polygon) || polygon.length === 0) return;
        ctx.beginPath();
        polygon.forEach((pt, index) => {
            if (index === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
    });
    ctx.restore();
}

function renderTileWithTexture(ctx, x, y, tileSize, tileObj) {
    const px = x * tileSize;
    const py = y * tileSize;

    ctx.fillStyle = tileObj.color;
    ctx.fillRect(px, py, tileSize + 0.5, tileSize + 0.5);

    switch (tileObj.texture) {
        case "stone":
            drawStoneTexture(ctx, x, y, tileSize, tileObj.color);
            break;
        case "wood":
            drawWoodTexture(ctx, x, y, tileSize);
            break;
        case "cobblestone":
            drawCobblestoneTexture(ctx, x, y, tileSize, tileObj.color);
            break;
        default:
            break;
    }
}

function drawBatchedRockyWalls(ctx, matrix, tileSize, rows, cols, tileLookup) {
    const quarterSize = tileSize / 4;
    const defaultTileColor = tiletypes[0] ? tiletypes[0].color : "#000000";
    const colorBatches = new Map();

    function getBatchPath(color) {
        if (!colorBatches.has(color)) {
            colorBatches.set(color, []);
        }
        return colorBatches.get(color);
    }

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const tileId = matrix[y][x];
            if (tileId === 0) continue;

            const tiletype = tileLookup.get(tileId);
            if (!tiletype || typeof tiletype.isIsolatedFrom !== "function") continue;

            const baseX = x * tileSize;
            const baseY = y * tileSize;

            if (x + 1 < cols && matrix[y][x + 1] !== tileId && tiletype.isIsolatedFrom(matrix[y][x + 1])) {
                const edgeX = baseX + tileSize;
                const neighborTile = tileLookup.get(matrix[y][x + 1]);
                const fillColor = (tiletype === tiletypes[0]) ? (neighborTile ? neighborTile.color : defaultTileColor) : tiletype.color;
                const pathList = getBatchPath(fillColor);

                for (let i = 0; i < 4; i++) {
                    const startY = baseY + i * quarterSize;
                    const endY = startY + quarterSize;
                    pathList.push({
                        x0: edgeX, y0: startY,
                        cp1x: edgeX - quarterSize + getFastJitter(x, y, i, 1), cp1y: startY,
                        cp2x: edgeX - quarterSize + getFastJitter(x, y, i, 2), cp2y: endY,
                        x1: edgeX, y1: endY
                    });
                }
            }

            if (x - 1 >= 0 && matrix[y][x - 1] !== tileId && tiletype.isIsolatedFrom(matrix[y][x - 1])) {
                const edgeX = baseX;
                const neighborTile = tileLookup.get(matrix[y][x - 1]);
                const fillColor = (tiletype === tiletypes[0]) ? (neighborTile ? neighborTile.color : defaultTileColor) : tiletype.color;
                const pathList = getBatchPath(fillColor);

                for (let i = 0; i < 4; i++) {
                    const startY = baseY + i * quarterSize;
                    const endY = startY + quarterSize;
                    pathList.push({
                        x0: edgeX, y0: startY,
                        cp1x: edgeX + quarterSize - getFastJitter(x, y, i, 3), cp1y: startY,
                        cp2x: edgeX + quarterSize - getFastJitter(x, y, i, 4), cp2y: endY,
                        x1: edgeX, y1: endY
                    });
                }
            }

            if (y - 1 >= 0 && matrix[y - 1][x] !== tileId && tiletype.isIsolatedFrom(matrix[y - 1][x])) {
                const edgeY = baseY;
                const neighborTile = tileLookup.get(matrix[y - 1][x]);
                const fillColor = (tiletype === tiletypes[0]) ? (neighborTile ? neighborTile.color : defaultTileColor) : tiletype.color;
                const pathList = getBatchPath(fillColor);

                for (let i = 0; i < 4; i++) {
                    const startX = baseX + i * quarterSize;
                    const endX = startX + quarterSize;
                    pathList.push({
                        x0: startX, y0: edgeY,
                        cp1x: startX, cp1y: edgeY + quarterSize - getFastJitter(x, y, i, 5),
                        cp2x: endX, cp2y: edgeY + quarterSize - getFastJitter(x, y, i, 6),
                        x1: endX, y1: edgeY
                    });
                }
            }

            if (y + 1 < rows && matrix[y + 1][x] !== tileId && tiletype.isIsolatedFrom(matrix[y + 1][x])) {
                const edgeY = baseY + tileSize;
                const neighborTile = tileLookup.get(matrix[y + 1][x]);
                const fillColor = (tiletype === tiletypes[0]) ? (neighborTile ? neighborTile.color : defaultTileColor) : tiletype.color;
                const pathList = getBatchPath(fillColor);

                for (let i = 0; i < 4; i++) {
                    const startX = baseX + i * quarterSize;
                    const endX = startX + quarterSize;
                    pathList.push({
                        x0: startX, y0: edgeY,
                        cp1x: startX, cp1y: edgeY - quarterSize + getFastJitter(x, y, i, 7),
                        cp2x: endX, cp2y: edgeY - quarterSize + getFastJitter(x, y, i, 8),
                        x1: endX, y1: edgeY
                    });
                }
            }
        }
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = "black";

    colorBatches.forEach((shapes, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < shapes.length; i++) {
            const s = shapes[i];
            ctx.moveTo(s.x0, s.y0);
            ctx.bezierCurveTo(s.cp1x, s.cp1y, s.cp2x, s.cp2y, s.x1, s.y1);
            ctx.lineTo(s.x0, s.y0);
        }
        ctx.fill();
        ctx.stroke();
    });
}

function drawSmoothWalls(ctx, matrix, tileSize, rows, cols, tileLookup) {
    const defaultTileColor = tiletypes[0] ? tiletypes[0].color : "#000000";

    ctx.save();
    
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const tileId = matrix[y][x];
            if (tileId === 0) continue;

            const tiletype = tileLookup.get(tileId);
            if (!tiletype || typeof tiletype.isIsolatedFrom !== "function") continue;

            const baseX = x * tileSize;
            const baseY = y * tileSize;

            const topId = y - 1 >= 0 ? matrix[y - 1][x] : null;
            const bottomId = y + 1 < rows ? matrix[y + 1][x] : null;
            const leftId = x - 1 >= 0 ? matrix[y][x - 1] : null;
            const rightId = x + 1 < cols ? matrix[y][x + 1] : null;

            const hasTop = topId !== null && topId !== tileId && tiletype.isIsolatedFrom(topId);
            const hasBottom = bottomId !== null && bottomId !== tileId && tiletype.isIsolatedFrom(bottomId);
            const hasLeft = leftId !== null && leftId !== tileId && tiletype.isIsolatedFrom(leftId);
            const hasRight = rightId !== null && rightId !== tileId && tiletype.isIsolatedFrom(rightId);

            const outward = 1;         
            const inward = tileSize / 2; 

            const getNeighborColor = (neighborId) => {
                if (neighborId === null || neighborId === 0) return defaultTileColor;
                const neighborType = tileLookup.get(neighborId);
                return neighborType ? neighborType.color : defaultTileColor;
            };

            if (hasTop && hasRight) {
                ctx.fillStyle = getNeighborColor(rightId);
                ctx.beginPath();
                ctx.moveTo(baseX + tileSize + outward, baseY - outward);
                ctx.lineTo(baseX + tileSize, baseY + inward);
                ctx.quadraticCurveTo(baseX + tileSize, baseY, baseX + tileSize - inward, baseY);
                ctx.closePath();
                ctx.fill();
            }

            if (hasTop && hasLeft) {
                ctx.fillStyle = getNeighborColor(leftId);
                ctx.beginPath();
                ctx.moveTo(baseX - outward, baseY - outward);
                ctx.lineTo(baseX + inward, baseY);
                ctx.quadraticCurveTo(baseX, baseY, baseX, baseY + inward);
                ctx.closePath();
                ctx.fill();
            }

            if (hasBottom && hasRight) {
                ctx.fillStyle = getNeighborColor(rightId);
                ctx.beginPath();
                ctx.moveTo(baseX + tileSize + outward, baseY + tileSize + outward);
                ctx.lineTo(baseX + tileSize - inward, baseY + tileSize);
                ctx.quadraticCurveTo(baseX + tileSize, baseY + tileSize, baseX + tileSize, baseY + tileSize - inward);
                ctx.closePath();
                ctx.fill();
            }

            if (hasBottom && hasLeft) {
                ctx.fillStyle = getNeighborColor(leftId);
                ctx.beginPath();
                ctx.moveTo(baseX - outward, baseY + tileSize + outward);
                ctx.lineTo(baseX, baseY + tileSize - inward);
                ctx.quadraticCurveTo(baseX, baseY + tileSize, baseX + inward, baseY + tileSize);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    ctx.restore();
}

function calculatePortalsFromMatrix(matrix, tileSize) {
    const size = matrix.length;
    const tileLookup = new Map(tiletypes.map(t => [t.id, t]));
    
    const isValid = (r, c) => r >= 0 && r < size && c >= 0 && c < size;
    const getTile = (r, c) => {
        if (!isValid(r, c)) return null;
        const tileId = matrix[r][c];
        return tileLookup.get(tileId) || null;
    };

    const rawDoorSegments = [];

    const checkEdge = (r1, c1, r2, c2, p1, p2) => {
        const tileA = getTile(r1, c1);
        const tileB = getTile(r2, c2);

        const isFloorA = tileA ? tileA.isFloor : false;
        const isFloorB = tileB ? tileB.isFloor : false;

        if (isFloorA !== isFloorB) return;
        if (!isFloorA && !isFloorB) return;

        const idA = matrix[r1][c1];
        const idB = matrix[r2][c2];

        const isIsolated = (tileA && tileA.isIsolatedFrom && tileA.isIsolatedFrom(idB)) ||
                           (tileB && tileB.isIsolatedFrom && tileB.isIsolatedFrom(idA));

        const isDifferentFloorType = idA !== idB;

        if (isDifferentFloorType || isIsolated) {
            rawDoorSegments.push({ p1, p2, r1, c1, r2, c2 });
        }
    };

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            checkEdge(r, c, r, c + 1, { x: c + 1, y: r }, { x: c + 1, y: r + 1 });
            checkEdge(r, c, r + 1, c, { x: c, y: r + 1 }, { x: c + 1, y: r + 1 });
        }
    }

    const visited = new Set();
    const groups = [];

    const areConnected = (s1, s2) => {
        return (s1.p1.x === s2.p1.x && s1.p1.y === s2.p1.y) ||
               (s1.p1.x === s2.p2.x && s1.p1.y === s2.p2.y) ||
               (s1.p2.x === s2.p1.x && s1.p2.y === s2.p1.y) ||
               (s1.p2.x === s2.p2.x && s1.p2.y === s2.p2.y);
    };

    for (let i = 0; i < rawDoorSegments.length; i++) {
        if (visited.has(i)) continue;

        const group = [];
        const queue = [rawDoorSegments[i]];
        visited.add(i);

        while (queue.length > 0) {
            const current = queue.shift();
            group.push(current);

            for (let j = 0; j < rawDoorSegments.length; j++) {
                if (!visited.has(j) && areConnected(current, rawDoorSegments[j])) {
                    visited.add(j);
                    queue.push(rawDoorSegments[j]);
                }
            }
        }
        groups.push(group);
    }

    const portals = [];

    groups.forEach(group => {
        if (group.length === 0) return;

        let avgX = 0, avgY = 0;
        group.forEach(s => {
            avgX += (s.p1.x + s.p2.x) / 2;
            avgY += (s.p1.y + s.p2.y) / 2;
        });
        avgX /= group.length;
        avgY /= group.length;

        let bestSegment = group[0];
        let minDistanceSq = Infinity;

        group.forEach(s => {
            const midX = (s.p1.x + s.p2.x) / 2;
            const midY = (s.p1.y + s.p2.y) / 2;
            const distSq = Math.pow(midX - avgX, 2) + Math.pow(midY - avgY, 2);

            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                bestSegment = s;
            }
        });

        // A pozíciót is a fal szegmens felezőpontjára állítjuk (szintén pixelben skálázva)
        const midX = (bestSegment.p1.x + bestSegment.p2.x) / 2;
        const midY = (bestSegment.p1.y + bestSegment.p2.y) / 2;

        portals.push({
            position: { x: midX * tileSize, y: midY * tileSize },
            bounds: [
                { x: bestSegment.p1.x * tileSize, y: bestSegment.p1.y * tileSize },
                { x: bestSegment.p2.x * tileSize, y: bestSegment.p2.y * tileSize }
            ]
        });
    });

    return portals;
}

function drawEditorPortals(ctx, portals, tileSize) {
    ctx.save();
    portals.forEach(portal => {
        const b = portal.bounds;
        if (!b || b.length < 2) return;

        const p1 = b[0];
        const p2 = b[1];

        // Eldöntjük, hogy a fal vízszintes vagy függőleges
        const isHorizontal = p1.y === p2.y;
        
        let px, py, pWidth, pHeight;
        const doorThickness = 10; // Az ajtó vastagsága pixelben

        if (isHorizontal) {
            // Vízszintes fal: a rácsvonalra középezzük függőlegesen
            px = Math.min(p1.x, p2.x);
            py = p1.y - (doorThickness / 2);
            pWidth = Math.abs(p2.x - p1.x);
            pHeight = doorThickness;
        } else {
            // Függőleges fal: a rácsvonalra középezzük vízszintesen
            px = p1.x - (doorThickness / 2);
            py = Math.min(p1.y, p2.y);
            pWidth = doorThickness;
            pHeight = Math.abs(p2.y - p1.y);
        }

        // Féláttetsző háttér
        ctx.fillStyle = "rgba(180, 100, 40, 0.6)";
        ctx.fillRect(px, py, pWidth, pHeight);

        // Keret
        ctx.strokeStyle = "#ffcc00";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px, py, pWidth, pHeight);

        // Ajtó ikon középen
        ctx.fillStyle = "#ffffff";
        const fontSize = Math.max(12, Math.min(pWidth, pHeight) * 0.8);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🚪", px + pWidth / 2, py + pHeight / 2);
    });
    ctx.restore();
}