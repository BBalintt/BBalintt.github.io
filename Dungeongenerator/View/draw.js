var rows, cols, cellSize, canvas = document.getElementById("dungeon");
var tileSize = 20;
var ctx = canvas.getContext("2d");
var matrix;

export function drawDungeon(map) {
        matrix = map;
        canvas.width = map[0].length * tileSize;
        canvas.height = map.length * tileSize;
        rows = map[0].length;
        cols = rows;
        cellSize = canvas.width / cols; // 100 pixel cellánként

        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {

                switch(map[y][x]) {
                    case 0:
                        drawTile(x, y, "#000000 ", map[y][x]);
                        break;

                    case 1:
                        drawTile(x, y, "grey", map[y][x]);
                        break;

                    case 2:
                        drawTile(x, y, "#994C00", map[y][x]);
                        break;
                }

            }
        }
}

function drawTile(x, y, color, type) {
  ctx.fillStyle = color;
  ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
  if (type != 0) {
    const roughness = 5; 
    // ==========================================
    // 1. JOBB OLDAL
    // ==========================================
    if (!(x + 1 < matrix[0].length && matrix[y][x + 1] == matrix[y][x])) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            let startY = y * tileSize + i * tileSize / 4;
            let endY = y * tileSize + (i + 1) * tileSize / 4;
            let edgeX = x * tileSize + tileSize; // Jobb szél

            ctx.beginPath();
            ctx.moveTo(edgeX, startY);
            ctx.bezierCurveTo(
                edgeX - tileSize / 4 + Math.random() * roughness, startY,
                edgeX - tileSize / 4 + Math.random() * roughness, endY,
                edgeX, endY
            );
            ctx.stroke();
        }
    }

    // ==========================================
    // 2. BAL OLDAL
    // ==========================================
    if (!(x - 1 >= 0 && matrix[y][x - 1] == matrix[y][x])) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            let startY = y * tileSize + i * tileSize / 4;
            let endY = y * tileSize + (i + 1) * tileSize / 4;
            let edgeX = x * tileSize; // Bal szél

            ctx.beginPath();
            ctx.moveTo(edgeX, startY);
            ctx.bezierCurveTo(
                edgeX + tileSize / 4 - Math.random() * roughness, startY,
                edgeX + tileSize / 4 - Math.random() * roughness, endY,
                edgeX, endY
            );
            ctx.stroke();
        }
    }

    // ==========================================
    // 3. FELSŐ OLDAL
    // ==========================================
    if (!(y - 1 >= 0 && matrix[y - 1][x] == matrix[y][x])) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            let startX = x * tileSize + i * tileSize / 4;
            let endX = x * tileSize + (i + 1) * tileSize / 4;
            let edgeY = y * tileSize; // Felső szél

            ctx.beginPath();
            ctx.moveTo(startX, edgeY);
            ctx.bezierCurveTo(
                startX, edgeY + tileSize / 4 - Math.random() * roughness,
                endX, edgeY + tileSize / 4 - Math.random() * roughness,
                endX, edgeY
            );
            ctx.stroke();
        }
    }

    // ==========================================
    // 4. ALSÓ OLDAL
    // ==========================================
    if (!(y + 1 < matrix.length && matrix[y + 1][x] == matrix[y][x])) {
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            let startX = x * tileSize + i * tileSize / 4;
            let endX = x * tileSize + (i + 1) * tileSize / 4;
            let edgeY = y * tileSize + tileSize; // Alsó szél

            ctx.beginPath();
            ctx.moveTo(startX, edgeY);
            ctx.bezierCurveTo(
                startX, edgeY - tileSize / 4 + Math.random() * roughness,
                endX, edgeY - tileSize / 4 + Math.random() * roughness,
                endX, edgeY
            );
            ctx.stroke();
        }
    }
  }
}

let isDrawing = false; // Állapotjelző: le van-e nyomva az egér?

// Segédfüggvény: kiszámolja a cellát és módosítja a mátrixot
function handleTileClick(event) {
  const rect = canvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;

  const col = Math.floor(clickX / cellSize);
  const row = Math.floor(clickY / cellSize);

  // Határok ellenőrzése
  if (row >= 0 && row < rows && col >= 0 && col < cols) {

    const selectedRadio = document.querySelector('input[name="color"]:checked');
    if (!selectedRadio) return null;

    // 1. Meghatározzuk, hogy mi lenne az ÚJ érték a radio gomb alapján
    let newValue;
    switch (selectedRadio.value) {
      case "folyósó": newValue = 1; break;
      case "szoba":   newValue = 2; break;
      case "törlés":  newValue = 0; break;
      default: return; // Ismeretlen érték esetén kilépünk
    }

    // 2. ELLENŐRZÉS: Ha a kiválasztott tile már most is az új értéken van,
    // akkor nem történt változás, így azonnal megállítjuk a függvényt.
    if (matrix[row][col] === newValue) {
      return; 
    }

    // 3. Ha eljutottunk idáig, akkor VALÓDI változás történt!
    matrix[row][col] = newValue;

    // Újrarajzolás csak akkor fut le, ha tényleg változott valami
    drawDungeon(matrix);
  }
}

// 1. Egérgomb LENYOMÁSA (bekapcsoljuk a rajzolást)
canvas.addEventListener('mousedown', (event) => {
  isDrawing = true;
  handleTileClick(event); // Azonnal módosítjuk azt a cellát, ahová kattintottál
});

// 2. Egér MOZGATÁSA (ha le van nyomva a gomb, rajzolunk)
canvas.addEventListener('mousemove', (event) => {
  if (isDrawing) {
    handleTileClick(event);
  }
});

// 3. Egérgomb FELENGEDÉSE (kikapcsoljuk a rajzolást)
window.addEventListener('mouseup', () => {
  isDrawing = false;
});

// 4. Ha az egér ELHAGYJA a vásznat, álljon le a rajzolás
canvas.addEventListener('mouseleave', () => {
  isDrawing = false;
});