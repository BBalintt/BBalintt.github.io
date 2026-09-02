import { tile } from "./tile.js";
var rows, cols, canvas = document.getElementById("dungeon");
var tileSize = 20; // Egységes csempeméret
var ctx = canvas.getContext("2d");
var matrix;

export function drawDungeon(map) {
    matrix = map;
    rows = map.length;          // Sorok száma (Y)
    cols = map[0].length;       // Oszlopok száma (X)
    
    // Canvas belső felbontása
    canvas.width = cols * tileSize;
    canvas.height = rows * tileSize;

    let tiletypes = [];
    var i = 0;
    document.getElementsByName("color").forEach(element => {
        var wallElements = [];
        document.getElementsByName("walls" + i).forEach(wallElement => {
            if (wallElement.checked) {
                wallElements.push(wallElement.value);
            }
        });
        tiletypes.push(new tile(document.getElementById("color" + i).value, true, wallElements));
        i++;
    });

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            switch (map[y][x]) {
                case 0:
                    drawTile(x, y, tiletypes[0], map[y][x], tiletypes);
                    break;
                case 1:
                    drawTile(x, y, tiletypes[1], map[y][x], tiletypes);
                    break;
                case 2:
                    drawTile(x, y, tiletypes[2], map[y][x], tiletypes);
                    break;
            }
        }
    }
}

function drawTile(x, y, tiletype, type, tiletypes) {
    ctx.fillStyle = tiletype.color;
    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    
    const roughness = 5;

    // 1. JOBB OLDAL (Javított tömb-határ ellenőrzés: < cols)
    if (x + 1 < cols && tiletype.isIsolatedFrom(matrix[y][x + 1])) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            let startY = y * tileSize + i * tileSize / 4;
            let endY = y * tileSize + (i + 1) * tileSize / 4;
            let edgeX = x * tileSize + tileSize;

            ctx.beginPath();
            ctx.moveTo(edgeX, startY);
            ctx.bezierCurveTo(
                edgeX - tileSize / 4 + Math.random() * roughness, startY,
                edgeX - tileSize / 4 + Math.random() * roughness, endY,
                edgeX, endY
            );
            ctx.lineTo(edgeX, startY);
            ctx.closePath();

            ctx.fillStyle = (tiletype == tiletypes[0]) ? tiletypes[matrix[y][x + 1]].color : tiletype.color;
            ctx.fill();
            ctx.strokeStyle = "black";
            ctx.stroke();
        }
    }

    // 2. BAL OLDAL
    if (x - 1 >= 0 && tiletype.isIsolatedFrom(matrix[y][x - 1])) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            let startY = y * tileSize + i * tileSize / 4;
            let endY = y * tileSize + (i + 1) * tileSize / 4;
            let edgeX = x * tileSize;

            ctx.beginPath();
            ctx.moveTo(edgeX, startY);
            ctx.bezierCurveTo(
                edgeX + tileSize / 4 - Math.random() * roughness, startY,
                edgeX + tileSize / 4 - Math.random() * roughness, endY,
                edgeX, endY
            );
            ctx.fillStyle = (tiletype == tiletypes[0]) ? tiletypes[matrix[y][x - 1]].color : tiletype.color;
            ctx.fill();
            ctx.strokeStyle = "black";
            ctx.stroke();
        }
    }

    // 3. FELSŐ OLDAL
    if (y - 1 >= 0 && tiletype.isIsolatedFrom(matrix[y - 1][x])) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            let startX = x * tileSize + i * tileSize / 4;
            let endX = x * tileSize + (i + 1) * tileSize / 4;
            let edgeY = y * tileSize;

            ctx.beginPath();
            ctx.moveTo(startX, edgeY);
            ctx.bezierCurveTo(
                startX, edgeY + tileSize / 4 - Math.random() * roughness,
                endX, edgeY + tileSize / 4 - Math.random() * roughness,
                endX, edgeY
            );
            ctx.fillStyle = (tiletype == tiletypes[0]) ? tiletypes[matrix[y - 1][x]].color : tiletype.color;
            ctx.fill();
            ctx.strokeStyle = "black";
            ctx.stroke();
        }
    }

    // 4. ALSÓ OLDAL
    if (y + 1 < rows && tiletype.isIsolatedFrom(matrix[y + 1][x])) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            let startX = x * tileSize + i * tileSize / 4;
            let endX = x * tileSize + (i + 1) * tileSize / 4;
            let edgeY = y * tileSize + tileSize;

            ctx.beginPath();
            ctx.moveTo(startX, edgeY);
            ctx.bezierCurveTo(
                startX, edgeY - tileSize / 4 + Math.random() * roughness,
                endX, edgeY - tileSize / 4 + Math.random() * roughness,
                endX, edgeY
            );
            ctx.fillStyle = (tiletype == tiletypes[0]) ? tiletypes[matrix[y + 1][x]].color : tiletype.color;
            ctx.fill();
            ctx.strokeStyle = "black";
            ctx.stroke();
        }
    }
}

let isDrawing = false;

// JAVÍTOTT EGÉRKEZELŐ SKÁLÁZÁSSAL ÉS HELYES INDEXELÉSSEL
function handleTileClick(event) {
    if (!matrix) return;

    const rect = canvas.getBoundingClientRect();
    
    // Canvas skálázási arányok kiszámítása
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Egérpozíció leképezése a belső felbontásra
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;

    // Pontos oszlop (X) és sor (Y)
    const col = Math.floor(clickX / tileSize);
    const row = Math.floor(clickY / tileSize);

    const brush_size = parseInt(document.getElementById('brush_size').value, 10) || 0;

    const selectedRadio = document.querySelector('input[name="color"]:checked');
    if (!selectedRadio) return;

    let newValue;
    switch (selectedRadio.value) {
        case "folyosó": newValue = 1; break;
        case "szoba": newValue = 2; break;
        case "semmi": newValue = 0; break;
        default: return;
    }

    let hasChanged = false;

    // Ecset határai
    const startCol = Math.max(0, col - brush_size);
    const endCol = Math.min(cols - 1, col + brush_size);
    const startRow = Math.max(0, row - brush_size);
    const endRow = Math.min(rows - 1, row + brush_size);

    // HELYES INDEXELÉS: r = Sor (Y), c = Oszlop (X) -> matrix[r][c]
    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            if (matrix[r][c] !== newValue) {
                matrix[r][c] = newValue;
                hasChanged = true;
            }
        }
    }

    if (hasChanged) {
        drawDungeon(matrix);
    }
}

// Általánosító függvény, ami kezeli az egér és az érintés (touch) eseményeket is
function getPointerPosition(event) {
    // Ha touch eseményről van szó, az első ujj pozícióját vesszük
    if (event.touches && event.touches.length > 0) {
        return {
            clientX: event.touches[0].clientX,
            clientY: event.touches[0].clientY
        };
    }
    return {
        clientX: event.clientX,
        clientY: event.clientY
    };
}

// Egységesített kattintás/érintés kezelő
function handleInteraction(event) {
    if (!matrix) return;

    // Egyujjas rajzolás támogatása (vagy egéresemény)
    const pointer = getPointerPosition(event);
    const rect = canvas.getBoundingClientRect();
    
    // Canvas skálázási arányok kiszámítása
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Pozíció leképezése a belső felbontásra
    const clickX = (pointer.clientX - rect.left) * scaleX;
    const clickY = (pointer.clientY - rect.top) * scaleY;

    // Pontos oszlop (X) és sor (Y)
    const col = Math.floor(clickX / tileSize);
    const row = Math.floor(clickY / tileSize);

    const brush_size = parseInt(document.getElementById('brush_size').value, 10) || 0;

    const selectedRadio = document.querySelector('input[name="color"]:checked');
    if (!selectedRadio) return;

    let newValue;
    switch (selectedRadio.value) {
        case "folyosó": newValue = 1; break;
        case "szoba": newValue = 2; break;
        case "semmi": newValue = 0; break;
        default: return;
    }

    let hasChanged = false;

    // Ecset határai
    const startCol = Math.max(0, col - brush_size);
    const endCol = Math.min(cols - 1, col + brush_size);
    const startRow = Math.max(0, row - brush_size);
    const endRow = Math.min(rows - 1, row + brush_size);

    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            if (matrix[r][c] !== newValue) {
                matrix[r][c] = newValue;
                hasChanged = true;
            }
        }
    }

    if (hasChanged) {
        drawDungeon(matrix);
    }
}

// --- EGÉR ESEMÉNYEK ---
canvas.addEventListener('mousedown', (event) => {
    isDrawing = true;
    handleInteraction(event);
});

canvas.addEventListener('mousemove', (event) => {
    if (isDrawing) {
        handleInteraction(event);
    }
});

window.addEventListener('mouseup', () => { isDrawing = false; });
canvas.addEventListener('mouseleave', () => { isDrawing = false; });

// --- TOUCH (MOBIL) ESEMÉNYEK ---
canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) { // Csak 1 ujj esetén rajzoljon
        event.preventDefault(); // Megakadályozza az oldal görgetését
        isDrawing = true;
        handleInteraction(event);
    }
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
    if (isDrawing && event.touches.length === 1) {
        event.preventDefault(); // Megakadályozza az oldal görgetését rajzolás közben
        handleInteraction(event);
    }
}, { passive: false });

window.addEventListener('touchend', () => { isDrawing = false; });
canvas.addEventListener('touchcancel', () => { isDrawing = false; });