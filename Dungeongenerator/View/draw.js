import { tiletypes } from "../Controller/tileRegistry.js";
import { drawStoneTexture, drawWoodTexture, drawCobblestoneTexture } from "./textures.js";
import { getLoadedLineOfSight, getLoadedPortals } from "../Controller/generator.js";

let isDrawingScheduled = false;
export let backgroundImage = null;
const roughness = 0;

export function getBackgroundImage() {
    return backgroundImage;
}

export function setBackgroundImage(img) {
    backgroundImage = img;
}

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

export function drawDungeon(matrix, skipTiles = false) {
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

    // 0. LÉPÉS: Háttérkép kirajzolása (ha van betöltve, pl. DD2VTT beágyazott kép)
    if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }

    const tileLookup = new Map(tiletypes.map(t => [t.id, t]));

    // Ha vannak betöltött DD2VTT falak (line_of_sight), akkor rajzoljuk ki őket a háttérre
    const loadedLoS = getLoadedLineOfSight();
    if (loadedLoS && Array.isArray(loadedLoS)) {
        drawLoadedLineOfSight(ctx, loadedLoS);
    }

    // Ha nincs tiltva a csempék rajzolása, akkor kirajzoljuk őket
    if (!skipTiles) {
        ctx.save();
        if (backgroundImage) {
            ctx.globalAlpha = 0.4;
        }

        // 1. LÉPÉS: Csempék és textúrák
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

    // 2. LÉPÉS: Procedurális falak (ha nem külső DD2VTT sablont használunk)
    if (!loadedLoS) {
        drawBatchedRockyWalls(ctx, matrix, tileSize, rows, cols, tileLookup);
    }
}

// DD2VTT Line of Sight (falak) kirajzolása
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
            const px = pt.x;
            const py = pt.y;

            if (index === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
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