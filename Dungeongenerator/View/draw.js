import { tiletypes } from "../Controller/tileRegistry.js";
import { drawStoneTexture, drawWoodTexture, drawCobblestoneTexture } from "./textures.js";
import { getLoadedLineOfSight, getLoadedPortals } from "../Controller/generator.js";

let isDrawingScheduled = false;
export let backgroundImage = null;

export function getBackgroundImage() {
    return backgroundImage;
}

export function setBackgroundImage(img) {
    backgroundImage = img;
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 0. LÉPÉS: Háttérkép kirajzolása
    if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }

    const tileLookup = new Map(tiletypes.map(t => [t.id, t]));

    // Ha vannak betöltött DD2VTT falak, kirajzoljuk őket
    const loadedLoS = getLoadedLineOfSight();
    if (loadedLoS && Array.isArray(loadedLoS)) {
        drawLoadedLineOfSight(ctx, loadedLoS);
    }

    // Ha nincs tiltva a csempék rajzolása
    if (!skipTiles) {
        ctx.save();
        if (backgroundImage) {
            ctx.globalAlpha = 0.4;
        }

        // 1. LÉPÉS: Csempék és textúrák (itt is lágyíthatjuk a kitöltést)
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

    // 2. LÉPÉS: Sima, lekerekített falak Marching Squares algoritmussal
    if (!loadedLoS) {
        drawMarchingSquaresWalls(ctx, matrix, tileSize, rows, cols, tileLookup);
    }
}

// DD2VTT Line of Sight kirajzolása
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

// --- MARCHING SQUARES SIMA FAL ÉS KONTÚR ALGORITMUS ---
function drawMarchingSquaresWalls(ctx, matrix, tileSize, rows, cols, tileLookup) {
    ctx.save();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#333333";

    // Segédfüggvény a cellaérték lekérésére (határokon túl 0)
    const getVal = (r, c) => {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return 0;
        return matrix[r][c] !== 0 ? 1 : 0;
    };

    ctx.beginPath();

    // Végigmegyünk a rács celláin és a sarkaikon (vertexek)
    for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
            // A 2x2-es cellablokk 4 sarkának értéke a rácspontok körül
            const topLeft = getVal(r - 1, c - 1);
            const topRight = getVal(r - 1, c);
            const bottomRight = getVal(r, c);
            const bottomLeft = getVal(r, c - 1);

            // Bináris index kiszámítása a sarkok alapján (Marching Squares index)
            const index = (topLeft << 3) | (topRight << 2) | (bottomRight << 1) | bottomLeft;

            if (index === 0 || index === 15) continue; // Teljesen üres vagy teljesen teli, nincs határvonal

            const x = c * tileSize;
            const y = r * tileSize;
            const half = tileSize / 2;

            // Alap élezési/felezési pontok a cellák élein
            const topMid = { x: x - half, y: y - tileSize };
            const rightMid = { x: x, y: y - half };
            const bottomMid = { x: x - half, y: y };
            const leftMid = { x: x - tileSize, y: y - half };

            // Marching squares esetek alapján sima ívek / vonalak rajzolása
            ctx.moveTo(topMid.x, topMid.y);
            
            switch (index) {
                // Egyszerű sarkok és élek lekerekítése
                case 1: case 14:
                    ctx.quadraticCurveTo(x - tileSize, y, leftMid.x, leftMid.y);
                    break;
                case 2: case 13:
                    ctx.quadraticCurveTo(x, y, bottomMid.x, bottomMid.y);
                    break;
                case 4: case 11:
                    ctx.quadraticCurveTo(x, y - tileSize, rightMid.x, rightMid.y);
                    break;
                case 8: case 7:
                    ctx.quadraticCurveTo(x - tileSize, y - tileSize, topMid.x, topMid.y);
                    break;
                // Nyerges / átló elemek kezelése az L-alakú sima kanyarokhoz
                case 5:
                    ctx.lineTo(rightMid.x, rightMid.y);
                    ctx.moveTo(topMid.x, topMid.y);
                    ctx.lineTo(bottomMid.x, bottomMid.y);
                    break;
                case 10:
                    ctx.lineTo(leftMid.x, leftMid.y);
                    ctx.moveTo(bottomMid.x, bottomMid.y);
                    ctx.lineTo(topMid.x, topMid.y);
                    break;
                default:
                    ctx.lineTo(rightMid.x, rightMid.y);
                    break;
            }
        }
    }

    ctx.stroke();
    ctx.restore();
}