import { translations, currentLang, setLanguage } from "./lang.js";
import { exportToDd2vtt } from "./exportDd2vtt.js";
import { drawDungeon } from "../View/draw.js";

// DOM elemek frissítése a kiválasztott nyelvre
function updateUI() {
    const langData = translations[currentLang];
    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.getAttribute("data-i18n");
        if (langData[key]) {
            element.textContent = langData[key];
        }
    });
}

// 1. Automatizált nyelvdetektálás az oldal betöltésekor
const userLang = navigator.language || navigator.userLanguage;
if (userLang.startsWith("en")) {
    setLanguage("en");
} else {
    setLanguage("hu");
}
updateUI();

// 2. Gomb-eseménykezelők bekötése
document.getElementById("btn-hu").addEventListener("click", () => {
    setLanguage("hu");
    updateUI();
});

document.getElementById("btn-en").addEventListener("click", () => {
    setLanguage("en");
    updateUI();
});

// ... (A generáló kódod többi része és az exportBtn eseménykezelője)
var rooms = [];

for (let i = 0; i </*Math.round(Math.random()*700)+*/30; i++) {
    var x = Math.round(Math.random() * 5) + 1;
    var y = Math.round(Math.random() * 5) + 1;
    const room = {
        id: i,
        height: x, // Sorok száma
        width: y,  // Oszlopok száma
        matrix: [],
        centerx: 0,
        centery: 0,
        connected_to: false
    };
    rooms.push(room);
}


let size = 50;
const matrix = Array.from({ length: size }, () => Array(size).fill(0));

rooms.forEach(room => {
    x = Math.round(Math.random() * (size - room.height))
    y = Math.round(Math.random() * (size - room.width))
    while (!isAreaEmpty(x, y, room.height, room.width, matrix, size)) {
        x = Math.floor(Math.random() * (size - room.height + 1));
        y = Math.floor(Math.random() * (size - room.width + 1));
    }
    for (let i = x; i < x + room.height; i++) {
        for (let j = y; j < y + room.width; j++) {
            matrix[i][j] = 2;
        }
    }
    room.centerx = x + (room.height / 2);
    room.centery = y + (room.width / 2);
});

rooms.forEach(room => {
    // 1. Létrehozunk egy listát a TÖBBI szobából (az aktuálisat kiszűrjük)
    // Így nem bántjuk az eredeti 'rooms' tömböt a ciklus futása közben!
    let otherRooms = rooms.filter(r => r !== room);

    // Ha nincs más szoba a listában (pl. csak 1 szoba van összesen), ne csináljon semmit
    if (otherRooms.length === 0) return;

    // 2. Lefuttatjuk a keresést a tiszta listán
    let closestRoom = findClosestRoom(room.centerx, room.centery, room.id, otherRooms);
    if (closestRoom != null) {
        room.connected_to = true;
        // 3. Elindítjuk a fúrást az aktuális szoba közepéből
        let x = Math.floor(room.centerx);
        let y = Math.floor(room.centery);
        let cx = Math.floor(closestRoom.centerx);
        let cy = Math.floor(closestRoom.centery);
        while (x != cx || y != cy) {
            if (Math.abs(x - cx) > Math.abs(y - cy)) {
                if (x < cx) {
                    x++;
                } else {
                    x--;
                }
            }
            else {
                if (y < cy) {
                    y++;
                } else {
                    y--;
                }
            }

            // Folyosó lehelyezése a mátrixba (ha még nincs ott semmi)
            // FIGYELEM: == kell az összehasonlításhoz, a sima = értékadás!
            if (matrix[x][y] == 0) {
                matrix[x][y] = 1;
            }
        }
    }
});

const canvas = document.getElementById("dungeon");
const ctx = canvas.getContext("2d");

const tileSize = 32;

drawDungeon(matrix);

function isAreaEmpty(startX, startY, roomHeight, roomWidth, matrix, size) {
    // 1. Gyors ellenőrzés: egyáltalán befér-e a térképre a szoba ebből a sarokból?
    if (startX + roomHeight > size || startY + roomWidth > size) {
        return false;
    }

    // 2. Végigpásztázzuk a szoba teljes leendő területét
    for (let r = startX; r < startX + roomHeight; r++) {
        for (let c = startY; c < startY + roomWidth; c++) {
            // Ha BÁRMELYIK cella nem üres ("-"), akkor az egész terület hibás
            if (matrix[r][c] !== 0) {
                return false;
            }
        }
    }

    // Ha végigért a ciklus és nem talált hibát, a terület szabad!
    return true;
}

function findClosestRoom(fromX, fromY, id, allRooms) {
    let closestRoom = null;
    let minDistance = Infinity; // Kezdetben végtelen nagy távolság

    allRooms.forEach(room => {
        // Kiszámoljuk a távolságot a szoba középpontja és a megadott pont között
        const dx = fromX - room.centerx;
        const dy = fromY - room.centery;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Ha ez a távolság kisebb, mint az eddigi legkisebb, elmentjük ezt a szobát
        if (distance < minDistance && distance != null && room.connected_to != true) {
            minDistance = distance;
            closestRoom = room;
        }
    });

    return closestRoom; // Visszaadja a legközelebbi szoba objektumát
}
var i = 0;
document.getElementsByName("color").forEach(element => {
    document.getElementById("color" + i).addEventListener("input", function () {
        drawDungeon(matrix);
    });
    i++;
});

document.querySelectorAll('.checkbox-matrix input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener("change", () => {
        drawDungeon(matrix);
    });
});

const textureSelectors = ['room-texture', 'corridor-texture', 'void-texture'];

textureSelectors.forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        drawDungeon(matrix); 
    });
});

document.getElementById("exportBtn").addEventListener("click", () => {
    const canvas = document.getElementById("dungeon");
    exportToDd2vtt(matrix, canvas, tileSize);
});