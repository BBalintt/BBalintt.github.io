import { tiletypes } from "../Controller/tileRegistry.js";
import { drawStoneTexture, drawWoodTexture, drawCobblestoneTexture } from "./textures.js";
import { getLoadedLineOfSight, getLoadedPortals, getCustomPortals } from "../Controller/generator.js";

let isDrawingScheduled = false;
export let backgroundImage = null;
export let currentWallStyle = "rocky";  

export function setWallStyle(style) {
    if (style === "rocky" || style === "smooth") {
        currentWallStyle = style;
        scheduleDraw(lastMatrix);
    }
}

export function getBackgroundImage() {
    return backgroundImage;
}

export function setBackgroundImage(img) {
    backgroundImage = img;
    scheduleDraw(lastMatrix);
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

let lastMatrix = null;

/**
 * @param {number[][] | null} [matrix=null]
 * @param {HTMLImageElement | null} [bgImg=null]
 */
export function scheduleDraw(matrix = null, bgImg = null) {
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

/**
 * @param {number[][] | null} [matrix=null]
 * @param {boolean} [skipTiles=false]
 * @param {boolean} [skipEditorPortals=false]
 */
export function drawDungeon(matrix = null, skipTiles = false, skipEditorPortals = false) {
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

    // CSAK AKKOR RAJZOLJUKA KI, HA A SKIP FLAG NEM TRUE
    if (!skipEditorPortals) {
        const customPortals = getCustomPortals();
        if (customPortals && customPortals.length > 0) {
            drawEditorPortals(ctx, tileSize);
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
        if (!colorBatches.has(color)) colorBatches.set(color, []);
        return colorBatches.get(color);
    }

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const tileId = matrix[y][x];
            if (tileId === 0) continue;
            const tiletype = tileLookup.get(tileId);
            if (!tiletype || typeof tiletype.isIsolatedFrom !== "function") continue;

            const baseX = x * tileSize, baseY = y * tileSize;

            const rightTileId = x + 1 < cols ? matrix[y][x + 1] : 0;
            if (rightTileId !== tileId && tiletype.isIsolatedFrom(rightTileId)) {
                const edgeX = baseX + tileSize;
                const neighborTile = tileLookup.get(rightTileId);
                const fillColor = (tiletype === tiletypes[0]) ? (neighborTile ? neighborTile.color : defaultTileColor) : tiletype.color;
                const pathList = getBatchPath(fillColor);
                for (let i = 0; i < 4; i++) {
                    const startY = baseY + i * quarterSize, endY = startY + quarterSize;
                    pathList.push({ x0: edgeX, y0: startY, cp1x: edgeX - quarterSize + getFastJitter(x, y, i, 1), cp1y: startY, cp2x: edgeX - quarterSize + getFastJitter(x, y, i, 2), cp2y: endY, x1: edgeX, y1: endY });
                }
            }

            const leftTileId = x - 1 >= 0 ? matrix[y][x - 1] : 0;
            if (leftTileId !== tileId && tiletype.isIsolatedFrom(leftTileId)) {
                const edgeX = baseX;
                const neighborTile = tileLookup.get(leftTileId);
                const fillColor = (tiletype === tiletypes[0]) ? (neighborTile ? neighborTile.color : defaultTileColor) : tiletype.color;
                const pathList = getBatchPath(fillColor);
                for (let i = 0; i < 4; i++) {
                    const startY = baseY + i * quarterSize, endY = startY + quarterSize;
                    pathList.push({ x0: edgeX, y0: startY, cp1x: edgeX + quarterSize - getFastJitter(x, y, i, 3), cp1y: startY, cp2x: edgeX + quarterSize - getFastJitter(x, y, i, 4), cp2y: endY, x1: edgeX, y1: endY });
                }
            }

            const topTileId = y - 1 >= 0 ? matrix[y - 1][x] : 0;
            if (topTileId !== tileId && tiletype.isIsolatedFrom(topTileId)) {
                const edgeY = baseY;
                const neighborTile = tileLookup.get(topTileId);
                const fillColor = (tiletype === tiletypes[0]) ? (neighborTile ? neighborTile.color : defaultTileColor) : tiletype.color;
                const pathList = getBatchPath(fillColor);
                for (let i = 0; i < 4; i++) {
                    const startX = baseX + i * quarterSize, endX = startX + quarterSize;
                    pathList.push({ x0: startX, y0: edgeY, cp1x: startX, cp1y: edgeY + quarterSize - getFastJitter(x, y, i, 5), cp2x: endX, cp2y: edgeY + quarterSize - getFastJitter(x, y, i, 6), x1: endX, y1: edgeY });
                }
            }

            const bottomTileId = y + 1 < rows ? matrix[y + 1][x] : 0;
            if (bottomTileId !== tileId && tiletype.isIsolatedFrom(bottomTileId)) {
                const edgeY = baseY + tileSize;
                const neighborTile = tileLookup.get(bottomTileId);
                const fillColor = (tiletype === tiletypes[0]) ? (neighborTile ? neighborTile.color : defaultTileColor) : tiletype.color;
                const pathList = getBatchPath(fillColor);
                for (let i = 0; i < 4; i++) {
                    const startX = baseX + i * quarterSize, endX = startX + quarterSize;
                    pathList.push({ x0: startX, y0: edgeY, cp1x: startX, cp1y: edgeY - quarterSize + getFastJitter(x, y, i, 7), cp2x: endX, cp2y: edgeY - quarterSize + getFastJitter(x, y, i, 8), x1: endX, y1: edgeY });
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

            const baseX = x * tileSize, baseY = y * tileSize;
            const topId = y - 1 >= 0 ? matrix[y - 1][x] : null;
            const bottomId = y + 1 < rows ? matrix[y + 1][x] : null;
            const leftId = x - 1 >= 0 ? matrix[y][x - 1] : null;
            const rightId = x + 1 < cols ? matrix[y][x + 1] : null;

            const hasTop = topId !== null && topId !== tileId && tiletype.isIsolatedFrom(topId);
            const hasBottom = bottomId !== null && bottomId !== tileId && tiletype.isIsolatedFrom(bottomId);
            const hasLeft = leftId !== null && leftId !== tileId && tiletype.isIsolatedFrom(leftId);
            const hasRight = rightId !== null && rightId !== tileId && tiletype.isIsolatedFrom(rightId);

            const outward = 1, inward = tileSize / 2;
            const getNeighborColor = (nId) => (nId === null || nId === 0) ? defaultTileColor : (tileLookup.get(nId)?.color || defaultTileColor);

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

export function drawEditorPortals(ctx, tileSize = 32) {
    const customPortals = getCustomPortals();
    if (!customPortals || customPortals.length === 0) return;

    ctx.save();
    
    customPortals.forEach(portal => {
        if (!portal.bounds || portal.bounds.length < 2) return;

        const p1 = portal.bounds[0];
        const p2 = portal.bounds[1];

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        
        ctx.strokeStyle = "#e67e22"; 
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.closePath();

        if (portal.position) {
            ctx.beginPath();
            ctx.arc(portal.position.x, portal.position.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = "#d35400";
            ctx.fill();
            ctx.closePath();
        }
    });

    ctx.restore();
}