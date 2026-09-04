import { tiletypes } from "../Controller/tileRegistry.js";
import { drawStoneTexture, drawWoodTexture, drawCobblestoneTexture } from "./textures.js";

let isDrawingScheduled = false;
const roughness = 6;

// Fast Jitter Lookup Table
const JITTER_TABLE_SIZE = 1024;
const JITTER_TABLE = new Float32Array(JITTER_TABLE_SIZE);
for (let i = 0; i < JITTER_TABLE_SIZE; i++) {
    JITTER_TABLE[i] = Math.random() * roughness;
}

function getFastJitter(x, y, i, side) {
    const index = (x * 31 + y * 17 + i * 7 + side * 13) & (JITTER_TABLE_SIZE - 1);
    return JITTER_TABLE[index];
}

export function scheduleDraw(matrix) {
    if (!isDrawingScheduled) {
        isDrawingScheduled = true;
        requestAnimationFrame(() => {
            drawDungeon(matrix);
            isDrawingScheduled = false;
        });
    }
}

export function drawDungeon(matrix) {
    const canvas = document.getElementById("dungeon");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const tileSize = 32;

    const rows = matrix.length;
    const cols = matrix[0].length;

    canvas.width = cols * tileSize;
    canvas.height = rows * tileSize;

    // Tiszta háttér biztosítása
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tileLookup = new Map(tiletypes.map(t => [t.id, t]));

    // 1. LÉPÉS: Csempék és textúrák
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const tileId = matrix[y][x];
            const tileObj = tileLookup.get(tileId);

            if (tileObj && tileId !== 0) { // Ne rajzoljunk üres tile-ra (ID: 0)
                renderTileWithTexture(ctx, x, y, tileSize, tileObj);
            }
        }
    }

    // 2. LÉPÉS: Falak (Kizárólag valid szomszédos izoláció esetén)
    drawBatchedRockyWalls(ctx, matrix, tileSize, rows, cols, tileLookup);
}

function renderTileWithTexture(ctx, x, y, tileSize, tileObj) {
    const px = x * tileSize;
    const py = y * tileSize;

    ctx.fillStyle = tileObj.color;
    // 0.5px-es túlfedés a Canvas anti-aliasing fekete résvonalainak elkerülésére
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
            // Üres mezőre vagy érvénytelen tile-ra ne rajzoljunk falat!
            if (tileId === 0) continue;

            const tiletype = tileLookup.get(tileId);
            if (!tiletype || typeof tiletype.isIsolatedFrom !== "function") continue;

            const baseX = x * tileSize;
            const baseY = y * tileSize;

            // JOBB OLDAL
            if (x + 1 < cols) {
                const neighborId = matrix[y][x + 1];
                if (neighborId !== tileId && tiletype.isIsolatedFrom(neighborId)) {
                    const edgeX = baseX + tileSize;
                    const neighborTile = tileLookup.get(neighborId);
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
            }

            // BAL OLDAL
            if (x - 1 >= 0) {
                const neighborId = matrix[y][x - 1];
                if (neighborId !== tileId && tiletype.isIsolatedFrom(neighborId)) {
                    const edgeX = baseX;
                    const neighborTile = tileLookup.get(neighborId);
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
            }

            // FELSŐ OLDAL
            if (y - 1 >= 0) {
                const neighborId = matrix[y - 1][x];
                if (neighborId !== tileId && tiletype.isIsolatedFrom(neighborId)) {
                    const edgeY = baseY;
                    const neighborTile = tileLookup.get(neighborId);
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
            }

            // ALSÓ OLDAL
            if (y + 1 < rows) {
                const neighborId = matrix[y + 1][x];
                if (neighborId !== tileId && tiletype.isIsolatedFrom(neighborId)) {
                    const edgeY = baseY + tileSize;
                    const neighborTile = tileLookup.get(neighborId);
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
    }

    // Kirajzolás
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