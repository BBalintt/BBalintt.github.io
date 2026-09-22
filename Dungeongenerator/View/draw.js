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

// 2. Sima stílus: Sarok-háromszögek rajzolása a szomszédos színekhez igazodva
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

            const hasTop = y - 1 >= 0 && matrix[y - 1][x] !== tileId && tiletype.isIsolatedFrom(matrix[y - 1][x]);
            const hasBottom = y + 1 < rows && matrix[y + 1][x] !== tileId && tiletype.isIsolatedFrom(matrix[y + 1][x]);
            const hasLeft = x - 1 >= 0 && matrix[y][x - 1] !== tileId && tiletype.isIsolatedFrom(matrix[y][x - 1]);
            const hasRight = x + 1 < cols && matrix[y][x + 1] !== tileId && tiletype.isIsolatedFrom(matrix[y][x + 1]);

            // Alap szín a csempéhez
            const baseColor = (tiletype === tiletypes[0]) ? defaultTileColor : tiletype.color;
            const cornerSize = tileSize / 3;

            // FELSŐ-JOBB SAROK
            if (hasTop && hasRight) {
                // Megnézzük, hogy a felső vagy jobb oldali szomszéd megegyezik-e színben/típusban
                let cornerColor = baseColor;
                if (y - 1 >= 0 && matrix[y - 1][x] === tileId) {
                    cornerColor = baseColor;
                } else if (x + 1 < cols && matrix[y][x + 1] === tileId) {
                    cornerColor = baseColor;
                } else {
                    // Ha a szomszédos üres terület vagy más típus, ellenőrizzük a diagonális / szomszédos csempét
                    const topTile = y - 1 >= 0 ? tileLookup.get(matrix[y - 1][x]) : null;
                    const rightTile = x + 1 < cols ? tileLookup.get(matrix[y][x + 1]) : null;
                    if (topTile && topTile.color === tiletype.color) cornerColor = topTile.color;
                }

                ctx.fillStyle = cornerColor;
                ctx.beginPath();
                ctx.moveTo(baseX + tileSize, baseY);
                ctx.lineTo(baseX + tileSize, baseY + cornerSize);
                ctx.lineTo(baseX + tileSize - cornerSize, baseY);
                ctx.closePath();
                ctx.fill();
            }

            // FELSŐ-BAL SAROK
            if (hasTop && hasLeft) {
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.lineTo(baseX + cornerSize, baseY);
                ctx.lineTo(baseX, baseY + cornerSize);
                ctx.closePath();
                ctx.fill();
            }

            // ALSÓ-JOBB SAROK
            if (hasBottom && hasRight) {
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.moveTo(baseX + tileSize, baseY + tileSize);
                ctx.lineTo(baseX + tileSize - cornerSize, baseY + tileSize);
                ctx.lineTo(baseX + tileSize, baseY + tileSize - cornerSize);
                ctx.closePath();
                ctx.fill();
            }

            // ALSÓ-BAL SAROK
            if (hasBottom && hasLeft) {
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.moveTo(baseX, baseY + tileSize);
                ctx.lineTo(baseX, baseY + tileSize - cornerSize);
                ctx.lineTo(baseX + cornerSize, baseY + tileSize);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    ctx.restore();
}