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

// NYILAKAT RAJZOLÓ STÍLUS (Smooth)
function drawSmoothWalls(ctx, matrix, tileSize, rows, cols, tileLookup) {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ff0055"; // Jól látható pirosas-rózsaszín szín a nyilakhoz
    ctx.fillStyle = "#ff0055";

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const tileId = matrix[y][x];
            if (tileId === 0) continue;

            const tiletype = tileLookup.get(tileId);
            if (!tiletype || typeof tiletype.isIsolatedFrom !== "function") continue;

            const baseX = x * tileSize;
            const baseY = y * tileSize;

            // Megszámoljuk, hány szomszédos irányban van fal/üres határ (vagy aktív irány)
            let neighborCount = 0;
            const directions = [];

            if (x + 1 < cols && matrix[y][x + 1] !== tileId && tiletype.isIsolatedFrom(matrix[y][x + 1])) {
                neighborCount++;
                directions.push({ x0: baseX + tileSize, y0: baseY, x1: baseX + tileSize, y1: baseY + tileSize, angle: Math.PI / 2 });
            }
            if (x - 1 >= 0 && matrix[y][x - 1] !== tileId && tiletype.isIsolatedFrom(matrix[y][x - 1])) {
                neighborCount++;
                directions.push({ x0: baseX, y0: baseY + tileSize, x1: baseX, y1: baseY, angle: -Math.PI / 2 });
            }
            if (y - 1 >= 0 && matrix[y - 1][x] !== tileId && tiletype.isIsolatedFrom(matrix[y - 1][x])) {
                neighborCount++;
                directions.push({ x0: baseX + tileSize, y0: baseY, x1: baseX, y1: baseY, angle: 0 });
            }
            if (y + 1 < rows && matrix[y + 1][x] !== tileId && tiletype.isIsolatedFrom(matrix[y + 1][x])) {
                neighborCount++;
                directions.push({ x0: baseX, y0: baseY + tileSize, x1: baseX + tileSize, y1: baseY + tileSize, angle: Math.PI });
            }

            if (neighborCount === 0) continue;

            // Minden irányra rajzolunk annyi nyilat, ah nhiêu szomszéd van (vagy a szomszédok számának megfelelően)
            directions.forEach(dir => {
                const midX = (dir.x0 + dir.x1) / 2;
                const midY = (dir.y0 + dir.y1) / 2;

                // Annyi nyilat rajzolunk, amennyi a neighborCount
                for (let i = 0; i < neighborCount; i++) {
                    // Eltolás, ha több nyíl van, hogy ne olvadjanak egybe
                    const offset = (i - (neighborCount - 1) / 2) * 8;
                    
                    // Vonal meghúzása
                    ctx.beginPath();
                    ctx.moveTo(dir.x0, dir.y0);
                    ctx.lineTo(dir.x1, dir.y1);
                    ctx.stroke();

                    // Nyílhegy rajzolása a középmezőbe
                    ctx.save();
                    ctx.translate(midX, midY);
                    if (dir.angle !== 0) ctx.rotate(dir.angle);
                    ctx.translate(0, offset);

                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(-5, -8);
                    ctx.lineTo(5, -8);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
            });
        }
    }
    ctx.restore();
}