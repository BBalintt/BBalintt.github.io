import { translations, currentLang, setLanguage } from "./lang.js";
import { exportToDd2vtt } from "./exportDd2vtt.js";
import { drawDungeon, scheduleDraw } from "../View/draw.js";
import { tiletypes, activeTileId, setActiveTileId, createNewTileType, removeTileType, toggleIsolation } from "./tileRegistry.js";

// Globális változó a háttérképnek
export let backgroundImage: HTMLImageElement | null = null;

// --- DUNGEON MÁTRIX ÉS MÉRET ALAPÉRTELMEZÉsei ---
export let size = 50;
export const matrix = Array.from({ length: size }, () => Array(size).fill(0));

// --- DD2VTT-BŐL BETÖLTÖTT FALAK ÉS PORTÁLOK TÁROLÁSA ---
export let loadedLineOfSight: any[] | null = null;
export let loadedPortals: any[] | null = null;

export function getLoadedLineOfSight() {
    return loadedLineOfSight;
}

export function getLoadedPortals() {
    return loadedPortals;
}

// --- UNIVERZÁLIS FÁJLBEOLVASÓ (KÉP ÉS DD2VTT) ---
const mapFileInput = document.getElementById("map-file-input") as HTMLInputElement | null;

if (mapFileInput) {
    mapFileInput.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
            const file = target.files[0];
            const fileName = file.name.toLowerCase();

            if (fileName.endsWith(".dd2vtt")) {
                // --- DD2VTT FÁJL BEOLVASÁSA ---
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const jsonContent = event.target?.result as string;
                        const dd2vttData = JSON.parse(jsonContent);
                        
                        console.log("DD2VTT sikeresen betöltve!", dd2vttData);

                        // 1. Falak és portálok eltárolása a megjelenítéshez és újraexportáláshoz
                        loadedLineOfSight = dd2vttData.line_of_sight || null;
                        loadedPortals = dd2vttData.portals || null;

                        // 2. Mátrix átméretezése és ÜRESRE állítása (0), 
                        // hogy ne generáljon saját szobákat/falakat a kép alá
                        if (dd2vttData.resolution && dd2vttData.resolution.map_size) {
                            const mapSize = dd2vttData.resolution.map_size;
                            size = Math.max(mapSize.x, mapSize.y);
                            
                            matrix.length = 0;
                            for (let r = 0; r < size; r++) {
                                matrix[r] = Array(size).fill(0); // 0 = Üres / Nincs csempe, de a falak látszani fognak!
                            }
                        }

                        // 3. A DD2VTT beágyazott képének betöltése háttérként
                        if (dd2vttData.image) {
                            const img = new Image();
                            backgroundImage = img;
                            img.onload = () => {
                                console.log("DD2VTT beágyazott kép betöltve a háttérbe!");
                                scheduleDraw(matrix, img as any);
                            };
                            img.src = dd2vttData.image.startsWith("data:") 
                                ? dd2vttData.image 
                                : `data:image/png;base64,${dd2vttData.image}`;
                        } else {
                            backgroundImage = null;
                            scheduleDraw(matrix);
                        }

                    } catch (err) {
                        console.error("Hiba a DD2VTT fájl feldolgozása közben:", err);
                        alert("Érvénytelen DD2VTT formátum!");
                    }
                };
                reader.readAsText(file);

            } else {
                // --- HAGYOMÁNYOS KÉPFÁJL BEOLVASÁSA ---
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    backgroundImage = img;
                    loadedLineOfSight = null; // Új képnél töröljük a régi falakat
                    loadedPortals = null;

                    img.onload = () => {
                        console.log("Kép sikeresen betöltve háttérként!", img.width, img.height);
                        scheduleDraw(matrix, img as any);  
                    };
                    img.src = event.target?.result as string;
                };
                reader.readAsDataURL(file);
            }
        }
    });
} else {
    console.error("Nem található a #map-file-input elem az HTML-ben!");
}

// --- NYELVI BEÁLLÍTÁSOK KULCSAI ÉS RENDSZERE ---
function updateUI() {
    const langData = translations[currentLang as keyof typeof translations];
    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.getAttribute("data-i18n") as keyof typeof langData;
        if (langData[key]) {
            element.textContent = langData[key];
        }
    });
    renderTileControls();
}

if (!localStorage.getItem("app_lang")) {
    const userLang = navigator.language.slice(0, 2);
    if (["en", "de", "es", "fr", "hu"].includes(userLang)) {
        setLanguage(userLang);
    } else {
        setLanguage("en");
    }
}

["hu", "en", "de", "es", "fr"].forEach(lang => {
    const btn = document.getElementById(`btn-${lang}`);
    if (btn) {
        btn.addEventListener("click", () => {
            setLanguage(lang);
            updateUI();
        });
    }
});

// --- ALAPÉRTELMEZETT SZOBÁK ÉS FOLYOSÓK GENERÁLÁSA (Csak tiszta indításkor) ---
interface Room {
    id: number;
    height: number;
    width: number;
    centerx: number;
    centery: number;
    max_connections: number;
    connections: number
}

const rooms: Room[] = [];
for (let i = 0; i < 30; i++) {
    const x = Math.round(Math.random() * 5) + 1;
    const y = Math.round(Math.random() * 5) + 1;
    const rand = Math.random();
    let maxConn = 1;
    if (rand < 0.4) {
        maxConn = 1;
    } else if (rand < 0.7) {
        maxConn = 2;
    } else if (rand < 0.9) {
        maxConn = 3;
    } else {
        maxConn = 4;
    }
    rooms.push({
        id: i, 
        height: x, 
        width: y,
        centerx: 0, 
        centery: 0,
        max_connections: maxConn,
        connections: 0
    });
}

// 1. Szobák elhelyezése
rooms.forEach(room => {
    let x = Math.round(Math.random() * (size - room.height));
    let y = Math.round(Math.random() * (size - room.width));
    while (!isAreaEmpty(x, y, room.height, room.width, matrix, size)) {
        x = Math.floor(Math.random() * (size - room.height + 1));
        y = Math.floor(Math.random() * (size - room.width + 1));
    }
    for (let i = x; i < x + room.height; i++) {
        for (let j = y; j < y + room.width; j++) {
            matrix[i][j] = 2; // Szoba (ID: 2)
        }
    }
    room.centerx = x + (room.height / 2);
    room.centery = y + (room.width / 2);
});

// 2. Folyosók összekötése
if (rooms.length > 0) {
    const connectRooms = (r1: Room, r2: Room) => {
        let x = Math.floor(r1.centerx);
        let y = Math.floor(r1.centery);
        let cx = Math.floor(r2.centerx);
        let cy = Math.floor(r2.centery);

        while (x !== cx || y !== cy) {
            if (Math.abs(x - cx) > Math.abs(y - cy)) {
                x < cx ? x++ : x--;
            } else {
                y < cy ? y++ : y--;
            }
            if (matrix[x][y] === 0) {
                matrix[x][y] = 1; // Folyosó (ID: 1)
            }
        }
        r1.connections++;
        r2.connections++;
    };

    const connectedSet = new Set<Room>();
    const unselectedRooms = [...rooms];
    const firstRoom = unselectedRooms.shift()!;
    connectedSet.add(firstRoom);

    while (unselectedRooms.length > 0) {
        let minDist = Infinity;
        let bestPair: { from: Room; to: Room } | null = null;

        connectedSet.forEach(cRoom => {
            unselectedRooms.forEach(uRoom => {
                const dx = cRoom.centerx - uRoom.centerx;
                const dy = cRoom.centery - uRoom.centery;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) {
                    minDist = dist;
                    bestPair = { from: cRoom, to: uRoom };
                }
            });
        });

        if (bestPair) {
            const { from, to } = bestPair as { from: Room; to: Room };
            connectRooms(from, to);
            connectedSet.add(to);
            const index = unselectedRooms.indexOf(to);
            if (index > -1) unselectedRooms.splice(index, 1);
        } else {
            break;
        }
    }

    rooms.forEach(room => {
        while (room.connections < room.max_connections) {
            let otherRooms = rooms.filter(r => r !== room && r.connections < r.max_connections);
            if (otherRooms.length === 0) break;

            let closestRoom = findClosestRoom(room.centerx, room.centery, room.id, otherRooms);
            if (closestRoom != null) {
                connectRooms(room, closestRoom);
            } else {
                break;
            }
        }
    });
}

function isAreaEmpty(startX: number, startY: number, roomHeight: number, roomWidth: number, matrix: number[][], size: number): boolean {
    if (startX + roomHeight > size || startY + roomWidth > size) return false;
    for (let r = startX; r < startX + roomHeight; r++) {
        for (let c = startY; c < startY + roomWidth; c++) {
            if (matrix[r][c] !== 0) return false;
        }
    }
    return true;
}

function findClosestRoom(fromX: number, fromY: number, id: number, allRooms: Room[]): Room | null {
    let closestRoom: Room | null = null;
    let minDistance = Infinity;
    
    allRooms.forEach(room => {
        if (room.id === id || room.connections == room.max_connections) return;
        const dx = fromX - room.centerx;
        const dy = fromY - room.centery;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestRoom = room;
        }
    });
    return closestRoom;
}

// --- DINAMIKUS VEZÉRLŐK KIRENDERELÉSE ---
export function renderTileControls() {
    const container = document.getElementById("tile-controls-container");
    if (!container) return;

    const t = translations[currentLang as keyof typeof translations];
    container.innerHTML = "";

    const activeTile = tiletypes.find(tileItem => tileItem.id === activeTileId) || tiletypes[0];

    const selectWrapper = document.createElement("div");
    selectWrapper.style.marginBottom = "10px";

    const selectOptions = tiletypes.map(tileItem => 
        `<option value="${tileItem.id}" ${tileItem.id === activeTileId ? "selected" : ""}>
            ${tileItem.name} 
        </option>`
    ).join("");

    selectWrapper.innerHTML = `
        <label for="tile-selector" style="font-weight: bold; margin-right: 8px;">${t.selectActiveTile}</label>
        <select id="tile-selector" name="tileSelector" style="padding: 4px 8px; font-size: 14px;">
            ${selectOptions}
        </select>
    `;
    container.appendChild(selectWrapper);

    const otherTilesCheckboxes = tiletypes
        .filter(other => other.id !== activeTile.id)
        .map(other => `
            <label for="iso-${activeTile.id}-${other.id}" style="margin-right: 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
                <input type="checkbox" id="iso-${activeTile.id}-${other.id}" class="isolation-check" data-id="${activeTile.id}" data-target="${other.id}" ${activeTile.isIsolatedFrom(other.id) ? "checked" : ""}>
                ${other.name} (${other.id})
            </label>
        `).join("");

    const card = document.createElement("div");
    card.className = "tile-control-item";
    card.style.border = "1px solid #ccc";
    card.style.padding = "10px";
    card.style.borderRadius = "4px";

    card.innerHTML = `
        <div class="control-row" style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
            <label for="tile-name-${activeTile.id}" style="font-size: 12px;">${t.tileNameLabel}</label>
            <input type="text" id="tile-name-${activeTile.id}" name="tileName" class="tile-name-input" data-id="${activeTile.id}" value="${activeTile.name}">
            
            <input type="color" id="tile-color-${activeTile.id}" name="tileColor" class="tile-color-input" data-id="${activeTile.id}" value="${activeTile.color}">
            
            <button type="button" class="btn-delete-tile" data-id="${activeTile.id}" style="margin-left: auto; background: #ff4d4d; color: white; border: none; padding: 4px 8px; cursor: pointer;">${t.deleteTileBtn}</button>
        </div>
        <div class="control-row" style="margin-bottom: 8px; display: flex; align-items: center; gap: 12px;">
            <label for="tile-floor-${activeTile.id}" style="font-size: 13px; display: flex; align-items: center; gap: 4px;">
                <input type="checkbox" id="tile-floor-${activeTile.id}" name="tileFloor" class="tile-floor-check" data-id="${activeTile.id}" ${activeTile.isFloor ? "checked" : ""}>
                ${t.isFloorLabel}
            </label>
            <label for="texture-${activeTile.id}" style="display:none;">Texture</label>
            <select id="texture-${activeTile.id}" name="tileTexture" class="tile-texture-select" data-id="${activeTile.id}">
                <option value="none" ${activeTile.texture === "none" ? "selected" : ""}>${t.texNone}</option>
                <option value="stone" ${activeTile.texture === "stone" ? "selected" : ""}>${t.texStone}</option>
                <option value="wood" ${activeTile.texture === "wood" ? "selected" : ""}>${t.texWood}</option>
                <option value="cobblestone" ${activeTile.texture === "cobblestone" ? "selected" : ""}>${t.texCobble}</option>
            </select>
        </div>
        <div class="control-row" style="margin-top: 6px;">
            <span style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 3px;">${t.wallsTowardsLabel}</span>
            ${otherTilesCheckboxes || `<span style='font-size:11px; color:#888;'>${t.noOtherTiles}</span>`}
        </div>
    `;
    container.appendChild(card);

    const tileSelector = document.getElementById("tile-selector");
    if (tileSelector) {
        tileSelector.addEventListener("change", (e) => {
            const target = e.target as HTMLSelectElement | null;
            if (target) {
                setActiveTileId(parseInt(target.value, 10));
                renderTileControls();
            }
        });
    }

    const nameInput = card.querySelector(".tile-name-input");
    if (nameInput) {
        nameInput.addEventListener("input", (e) => {
            const target = e.target as HTMLInputElement | null;
            if (!target) return;
            const id = parseInt(target.dataset.id || "0", 10);
            const tileObj = tiletypes.find(tileItem => tileItem.id === id);
            if (tileObj) {
                tileObj.name = target.value;
                const opt = document.querySelector(`#tile-selector option[value="${id}"]`);
                if (opt) opt.textContent = `${tileObj.name}`;
            }
        });
    }

    const colorInput = card.querySelector(".tile-color-input");
    if (colorInput) {
        colorInput.addEventListener("input", (e) => {
            const target = e.target as HTMLInputElement | null;
            if (!target) return;
            const id = parseInt(target.dataset.id || "0", 10);
            const tileObj = tiletypes.find(tileItem => tileItem.id === id);
            if (tileObj) {
                tileObj.color = target.value;
                scheduleDraw(matrix);
            }
        });
    }

    const floorCheck = card.querySelector(".tile-floor-check");
    if (floorCheck) {
        floorCheck.addEventListener("change", (e) => {
           const target = e.target as HTMLInputElement | null;
            if (!target) return;
            const id = parseInt(target.dataset.id || "0", 10);
            const tileObj = tiletypes.find(tileItem => tileItem.id === id);
            if (tileObj) tileObj.isFloor = target.checked;
        });
    }

    card.querySelectorAll(".isolation-check").forEach(check => {
        check.addEventListener("change", (e) => {
            const target = e.target as HTMLInputElement | null;
            if (!target) return;
            const tileId = parseInt(target.dataset.id || "0", 10);
            const targetId = parseInt(target.dataset.target || "0", 10);
            toggleIsolation(tileId, targetId);
            scheduleDraw(matrix);
        });
    });

    const textureSelect = card.querySelector(".tile-texture-select");
    if (textureSelect) {
        textureSelect.addEventListener("change", (e) => {
            const target = e.target as HTMLSelectElement | null;
            if (!target) return;
            const id = parseInt(target.dataset.id || "0", 10);
            const tileObj = tiletypes.find(tileItem => tileItem.id === id);
            if (tileObj) {
                tileObj.texture = target.value;
                scheduleDraw(matrix);
            }
        });
    }

    const deleteBtn = card.querySelector(".btn-delete-tile");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", (e) => {
            const target = e.currentTarget as HTMLElement | null;
            if (!target) return;
            const id = parseInt(target.dataset.id || "0", 10);
            removeTileType(id);
            renderTileControls();
            scheduleDraw(matrix);
        });
    }
}

const addTileBtn = document.getElementById("addTileBtn");
if (addTileBtn) {
    addTileBtn.addEventListener("click", () => {
        createNewTileType();
        renderTileControls();
    });
}

// --- VÁSZON INITIALIZÁLÁS ÉS EGÉR KEZELÉS ---
const canvas = document.getElementById("dungeon") as HTMLCanvasElement;
const tileSize = 32;

drawDungeon(matrix);
updateUI();

const exportBtn = document.getElementById("exportBtn");
if(exportBtn) {
    exportBtn.addEventListener("click", () => {
        exportToDd2vtt(matrix, canvas, tileSize);
    });
}

let isDrawing = false;

function drawTileAtMouse(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const centerCol = Math.floor(mouseX / tileSize);
    const centerRow = Math.floor(mouseY / tileSize);

    const brushInput = document.getElementById("brush_size") as HTMLInputElement | null;
    const brushRadius = brushInput ? Math.max(0, parseInt(brushInput.value, 10) || 0) : 0;

    let matrixChanged = false;

    for (let r = centerRow - brushRadius; r <= centerRow + brushRadius; r++) {
        for (let c = centerCol - brushRadius; c <= centerCol + brushRadius; c++) {
            if (r >= 0 && r < size && c >= 0 && c < size) {
                if (matrix[r][c] !== activeTileId) {
                    matrix[r][c] = activeTileId;
                    matrixChanged = true;
                }
            }
        }
    }

    if (matrixChanged) {
        scheduleDraw(matrix);
    }
}

canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    drawTileAtMouse(e);
});

canvas.addEventListener("mousemove", (e) => {
    if (isDrawing) {
        drawTileAtMouse(e);
    }
});

window.addEventListener("mouseup", () => {
    isDrawing = false;
});