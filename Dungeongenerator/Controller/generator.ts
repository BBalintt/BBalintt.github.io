import { translations, currentLang, setLanguage } from "./lang.js";
import { exportToDd2vtt } from "./exportDd2vtt.js";
import { drawDungeon, scheduleDraw, setWallStyle, setBackgroundImage } from "../View/draw.js";
import { tiletypes, activeTileId, setActiveTileId, createNewTileType, removeTileType, toggleIsolation } from "./tileRegistry.js";


let loadedLineOfSight: any[] | null = null;
let loadedPortals: any[] | null = null;

// Nyelv inicializálása a mentett érték vagy a böngésző nyelve alapján
const savedLang = localStorage.getItem("app_lang");
if (savedLang && ["en", "de", "es", "fr", "hu"].includes(savedLang)) {
    setLanguage(savedLang);
} else {
    const userLang = navigator.language.slice(0, 2);
    if (["en", "de", "es", "fr", "hu"].includes(userLang)) {
        setLanguage(userLang);
    } else {
        setLanguage("en");
    }
}

export function getLoadedLineOfSight() {
    return loadedLineOfSight;
}

export function getLoadedPortals() {
    return loadedPortals;
}

export function loadMapFromFile(data: any): number[][] | null {
    if (!data) return null;

    // Universal VTT formátum (.dd2vtt) feldolgozása
    if (data.resolution && data.map) {
        const lineOfSightData = data.line_of_sight;
        const portalsData = data.portals;

        // Árnyékok mentése
        if (lineOfSightData && Array.isArray(lineOfSightData)) {
            loadedLineOfSight = lineOfSightData;
        } else {
            loadedLineOfSight = null;
        }

        // Portálok mentése
        if (portalsData && Array.isArray(portalsData)) {
            loadedPortals = portalsData;
        } else {
            loadedPortals = null;
        }

        // Visszaadjuk magát a csempe-mátrixot
        if (Array.isArray(data.map)) {
            return data.map;
        }
    }

    // Egyszerű mátrix JSON formátum
    if (Array.isArray(data)) {
        loadedLineOfSight = null;
        loadedPortals = null;
        return data;
    }

    return null;
}

// A dungeongenerator.html-ben lévő #map-file-input elem kezelése[cite: 11]
const mapFileInput = document.getElementById("map-file-input") as HTMLInputElement;

if (mapFileInput) {
    mapFileInput.addEventListener("change", async (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        const fileName = file.name.toLowerCase();

        // 1. Eset: .dd2vtt vagy JSON fájl (falak, árnyékok, portálok, opcionális háttér)
        if (fileName.endsWith(".json") || fileName.endsWith(".dd2vtt")) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    const data = JSON.parse(text);
                    
                    // Betöltjük a térképadatait a generátoron keresztül
                    const matrix = loadMapFromFile(data);

                    // Ha a fájl tartalmaz beágyazott háttérképet is
                    if (data.image) {
                        const img = new Image();
                        img.onload = () => {
                            setBackgroundImage(img);
                            scheduleDraw(matrix, img);
                        };
                        img.src = "data:image/png;base64," + data.image;
                    } else {
                        scheduleDraw(matrix);
                    }
                    console.log(".dd2vtt / JSON térkép sikeresen betöltve!");
                } catch (err) {
                    console.error("Hiba a JSON fájl feldolgozása közben:", err);
                }
            };
            reader.readAsText(file);
        } 
        // 2. Eset: Sima képfájl (PNG/JPG) mint háttér
        else if (fileName.endsWith(".png") || fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    setBackgroundImage(img);
                    scheduleDraw(null, img);
                    console.log("Háttérkép sikeresen betöltve!");
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
        
        // Input mező ürítése, hogy ugyanazt a fájl újra ki lehessen választani ha szükséges
        target.value = "";
    });
}

export type EditorMode = 'draw' | 'door';
let currentEditorMode: EditorMode = 'draw';

export function getEditorMode(): EditorMode { return currentEditorMode; }
export function setEditorMode(mode: EditorMode): void { 
    currentEditorMode = mode; 
    updateUIVisibility();
}

export let backgroundImage: HTMLImageElement | null = null;
export let mapWidth = 60;
export let mapHeight = 40;
export let matrix: number[][] = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(0));

export interface Portal {
    position: { x: number; y: number };
    bounds: { x: number; y: number }[];
}

let customPortals: Portal[] = [];
export function getCustomPortals(): Portal[] { return customPortals; }
export function setCustomPortals(portals: Portal[]): void { customPortals = portals; }

export function getMaxAllowedRooms(w: number, h: number): number {
    const totalArea = w * h;
    const avgRoomArea = 35; 
    const maxDensity = 0.28; 
    return Math.max(5, Math.floor((totalArea * maxDensity) / avgRoomArea));
}

export function calculatePortalsFromMatrix(matrixToAnalyze: number[][], tileSize: number): Portal[] {
    const rows = matrixToAnalyze.length;
    const cols = matrixToAnalyze[0].length;
    const tileLookup = new Map(tiletypes.map(t => [t.id, t]));
    
    const isValid = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;
    const getTile = (r: number, c: number) => {
        if (!isValid(r, c)) return null;
        return tileLookup.get(matrixToAnalyze[r][c]) || null;
    };

    const rawDoorSegments: any[] = [];
    const checkEdge = (r1: number, c1: number, r2: number, c2: number, p1: any, p2: any) => {
        const tileA = getTile(r1, c1);
        const tileB = getTile(r2, c2);
        const isFloorA = tileA ? tileA.isFloor : false;
        const isFloorB = tileB ? tileB.isFloor : false;

        if (isFloorA !== isFloorB || (!isFloorA && !isFloorB)) return;

        const idA = matrixToAnalyze[r1][c1];
        const idB = matrixToAnalyze[r2][c2];
        const isIsolated = (tileA && tileA.isIsolatedFrom && tileA.isIsolatedFrom(idB)) ||
                           (tileB && tileB.isIsolatedFrom && tileB.isIsolatedFrom(idA));

        if (idA !== idB || isIsolated) {
            rawDoorSegments.push({ p1, p2, r1, c1, r2, c2 });
        }
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            checkEdge(r, c, r, c + 1, { x: c + 1, y: r }, { x: c + 1, y: r + 1 });
            checkEdge(r, c, r + 1, c, { x: c, y: r + 1 }, { x: c + 1, y: r + 1 });
        }
    }

    const visited = new Set<number>();
    const groups: any[][] = [];
    const areConnected = (s1: any, s2: any) => 
        (s1.p1.x === s2.p1.x && s1.p1.y === s2.p1.y) || (s1.p1.x === s2.p2.x && s1.p1.y === s2.p2.y) ||
        (s1.p2.x === s2.p1.x && s1.p2.y === s2.p1.y) || (s1.p2.x === s2.p2.x && s1.p2.y === s2.p2.y);

    for (let i = 0; i < rawDoorSegments.length; i++) {
        if (visited.has(i)) continue;
        const group: any[] = [];
        const queue = [rawDoorSegments[i]];
        visited.add(i);

        while (queue.length > 0) {
            const current = queue.shift();
            group.push(current);
            for (let j = 0; j < rawDoorSegments.length; j++) {
                if (!visited.has(j) && areConnected(current, rawDoorSegments[j])) {
                    visited.add(j);
                    queue.push(rawDoorSegments[j]);
                }
            }
        }
        groups.push(group);
    }

    const portals: Portal[] = [];
    groups.forEach(group => {
        if (group.length === 0) return;
        let avgX = 0, avgY = 0;
        group.forEach(s => {
            avgX += (s.p1.x + s.p2.x) / 2;
            avgY += (s.p1.y + s.p2.y) / 2;
        });
        avgX /= group.length;
        avgY /= group.length;

        let bestSegment = group[0];
        let minDistanceSq = Infinity;
        group.forEach(s => {
            const midX = (s.p1.x + s.p2.x) / 2;
            const midY = (s.p1.y + s.p2.y) / 2;
            const distSq = Math.pow(midX - avgX, 2) + Math.pow(midY - avgY, 2);
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                bestSegment = s;
            }
        });

        portals.push({
            position: { x: ((bestSegment.p1.x + bestSegment.p2.x) / 2) * tileSize, y: ((bestSegment.p1.y + bestSegment.p2.y) / 2) * tileSize },
            bounds: [
                { x: bestSegment.p1.x * tileSize, y: bestSegment.p1.y * tileSize },
                { x: bestSegment.p2.x * tileSize, y: bestSegment.p2.y * tileSize }
            ]
        });
    });

    return portals;
}

export function togglePortalAt(segment: { p1: { x: number; y: number }, p2: { x: number; y: number } }, tileSize: number): void {
    const index = customPortals.findIndex(p => 
        p.bounds && p.bounds.length >= 2 &&
        Math.abs(p.bounds[0].x - segment.p1.x * tileSize) < 8 &&
        Math.abs(p.bounds[0].y - segment.p1.y * tileSize) < 8 &&
        Math.abs(p.bounds[1].x - segment.p1.x * tileSize) < 8 &&
        Math.abs(p.bounds[1].y - segment.p1.y * tileSize) < 8
    );

    if (index >= 0) customPortals.splice(index, 1);
    else {
        customPortals.push({
            position: { x: ((segment.p1.x + segment.p2.x) / 2) * tileSize, y: ((segment.p1.y + segment.p2.y) / 2) * tileSize },
            bounds: [
                { x: segment.p1.x * tileSize, y: segment.p1.y * tileSize },
                { x: segment.p2.x * tileSize, y: segment.p2.y * tileSize }
            ]
        });
    }
}

export function clearCustomPortals(): void { customPortals = []; }

export function resizeDungeonMap(newWidth: number, newHeight: number) {
    const oldHeight = matrix.length;
    const oldWidth = oldHeight > 0 ? matrix[0].length : 0;

    const newMatrix: number[][] = Array.from({ length: newHeight }, (_, r) => 
        Array.from({ length: newWidth }, (_, c) => {
            if (r < oldHeight && c < oldWidth) {
                return matrix[r][c];
            }
            return 0; // Alapértelmezett üres csempe az új területeken
        })
    );

    mapWidth = newWidth;
    mapHeight = newHeight;
    matrix.length = 0;
    matrix.push(...newMatrix);

    customPortals = calculatePortalsFromMatrix(matrix, 32);
    scheduleDraw(matrix);
}

export function generateDungeonMap(width: number, height: number, roomCount: number) {
    mapWidth = width;
    mapHeight = height;
    
    matrix.length = 0;
    for (let r = 0; r < mapHeight; r++) {
        matrix[r] = Array(mapWidth).fill(0);
    }

    backgroundImage = null;
    clearCustomPortals();

    interface Room {
        id: number;
        height: number;
        width: number;
        centerx: number;
        centery: number;
        connections: number;
    }

    const rooms: Room[] = [];
    const maxAllowed = getMaxAllowedRooms(mapWidth, mapHeight);
    const targetRooms = Math.min(roomCount, maxAllowed);

    let totalAttempts = 0;
    while (rooms.length < targetRooms && totalAttempts < targetRooms * 150) {
        totalAttempts++;
        const roomH = Math.round(Math.random() * 5) + 3;
        const roomW = Math.round(Math.random() * 5) + 3;
        
        let x = Math.floor(Math.random() * (mapHeight - roomH + 1));
        let y = Math.floor(Math.random() * (mapWidth - roomW + 1));

        if (isAreaEmpty(x, y, roomH, roomW, matrix, mapHeight, mapWidth)) {
            const roomShape = Math.random() < 0.5 ? 'rect' : 'ellipse';
            if (roomShape === 'rect') {
                for (let i = x; i < x + roomH; i++) {
                    for (let j = y; j < y + roomW; j++) { matrix[i][j] = 2; }
                }
            } else {
                const radiusRow = roomH / 2;
                const radiusCol = roomW / 2;
                const centerRow = x + radiusRow;
                const centerCol = y + radiusCol;
                for (let i = x; i < x + roomH; i++) {
                    for (let j = y; j < y + roomW; j++) {
                        const dr = (i - centerRow) / radiusRow;
                        const dc = (j - centerCol) / radiusCol;
                        if (dr * dr + dc * dc <= 1.0) {
                            if (i >= 0 && i < mapHeight && j >= 0 && j < mapWidth) { matrix[i][j] = 2; }
                        }
                    }
                }
            }
            rooms.push({ id: rooms.length, height: roomH, width: roomW, centerx: x + (roomH / 2), centery: y + (roomW / 2), connections: 0 });
        }
    }

    if (rooms.length > 0) {
        const connectRooms = (r1: Room, r2: Room) => {
            let x = Math.floor(r1.centerx), y = Math.floor(r1.centery);
            let cx = Math.floor(r2.centerx), cy = Math.floor(r2.centery);
            while (x !== cx || y !== cy) {
                if (Math.abs(x - cx) > Math.abs(y - cy)) { x < cx ? x++ : x--; }
                else { y < cy ? y++ : y--; }
                if (matrix[x][y] === 0) { matrix[x][y] = 1; }
            }
            r1.connections++; r2.connections++;
        };

        const connectedSet = new Set<Room>();
        const unselectedRooms = [...rooms];
        const firstRoom = unselectedRooms.shift();
        if (firstRoom) {
            connectedSet.add(firstRoom);
            while (unselectedRooms.length > 0) {
                let minDist = Infinity;
                let bestPair: any = null;
                connectedSet.forEach(cRoom => {
                    unselectedRooms.forEach(uRoom => {
                        const dist = Math.hypot(cRoom.centerx - uRoom.centerx, cRoom.centery - uRoom.centery);
                        if (dist < minDist) { minDist = dist; bestPair = { from: cRoom, to: uRoom }; }
                    });
                });
                if (bestPair) {
                    connectRooms(bestPair.from, bestPair.to);
                    connectedSet.add(bestPair.to);
                    unselectedRooms.splice(unselectedRooms.indexOf(bestPair.to), 1);
                } else { break; }
            }
        }
    }

    customPortals = calculatePortalsFromMatrix(matrix, 32);
    scheduleDraw(matrix);
}

function isAreaEmpty(startX: number, startY: number, h: number, w: number, mat: number[][], maxH: number, maxW: number): boolean {
    if (startX + h > maxH || startY + w > maxW) return false;
    for (let r = startX; r < startX + h; r++) {
        for (let c = startY; c < startY + w; c++) { if (mat[r][c] !== 0) return false; }
    }
    return true;
}

const widthInput = document.getElementById("dungeon-width") as HTMLInputElement;
const heightInput = document.getElementById("dungeon-height") as HTMLInputElement;
const roomInput = document.getElementById("room-count") as HTMLInputElement;

function updateMaxRooms() {
    const w = parseInt(widthInput?.value || "60", 10);
    const h = parseInt(heightInput?.value || "40", 10);
    const maxRooms = getMaxAllowedRooms(w, h);
    if (roomInput) {
        roomInput.max = maxRooms.toString();
        if (parseInt(roomInput.value, 10) > maxRooms) {
            roomInput.value = maxRooms.toString();
        }
    }
}

widthInput?.addEventListener("input", updateMaxRooms);
heightInput?.addEventListener("input", updateMaxRooms);

document.getElementById("generateBtn")?.addEventListener("click", () => {
    const w = parseInt(widthInput?.value || "60", 10);
    const h = parseInt(heightInput?.value || "40", 10);
    const roomCount = parseInt(roomInput?.value || "30", 10);
    generateDungeonMap(w, h, roomCount);
});

document.getElementById("resizeBtn")?.addEventListener("click", () => {
    const w = parseInt(widthInput?.value || "60", 10);
    const h = parseInt(heightInput?.value || "40", 10);
    resizeDungeonMap(w, h);
});

const toggleSettingsBtn = document.getElementById("toggle-settings-btn");
const settingsContainer = document.getElementById("settings-container");
if (toggleSettingsBtn && settingsContainer) {
    toggleSettingsBtn.addEventListener("click", () => {
        settingsContainer.classList.toggle("collapsed");
        const arrow = toggleSettingsBtn.querySelector("span:last-child");
        if (arrow) {
            arrow.textContent = settingsContainer.classList.contains("collapsed") ? "▶" : "▼";
        }
    });
}

export function updateUI() {
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

generateDungeonMap(60, 40, 30);
updateUI();

function updateUIVisibility() {
    const tileControlsContainer = document.getElementById("tile-controls-container");
    const addTileBtn = document.getElementById("addTileBtn");
    const brushSizeGroup = document.getElementById("brush-size-group");

    const isDraw = currentEditorMode === 'draw';
    
    if (tileControlsContainer) tileControlsContainer.style.display = isDraw ? "block" : "none";
    if (addTileBtn) addTileBtn.style.display = isDraw ? "block" : "none";
    if (brushSizeGroup) brushSizeGroup.style.display = isDraw ? "flex" : "none";
}

const btnDraw = document.getElementById("btn-mode-draw");
const btnDoor = document.getElementById("btn-mode-door");
if (btnDraw && btnDoor) {
    btnDraw.addEventListener("click", () => {
        setEditorMode('draw');
        btnDraw.className = "btn-draw-active";
        btnDoor.className = "btn-inactive";
    });
    btnDoor.addEventListener("click", () => {
        setEditorMode('door');
        btnDoor.className = "btn-door-active";
        btnDraw.className = "btn-inactive";
    });
}

const wallStyleSelect = document.getElementById("wall-style-select") as HTMLSelectElement;
if (wallStyleSelect) {
    wallStyleSelect.addEventListener("change", (e) => {
        setWallStyle((e.target as HTMLSelectElement).value);
    });
}

const canvas = document.getElementById("dungeon") as HTMLCanvasElement;

export function renderTileControls() {
    const container = document.getElementById("tile-controls-container");
    if (!container || currentEditorMode !== 'draw') return;

    // Itt adjuk hozzá az 'as Record<string, string>' castolást, ami megoldja a 7053-as hibát
    const t = translations[currentLang as keyof typeof translations] as Record<string, string>;
    container.innerHTML = "";

    const activeTile = tiletypes.find(tileItem => tileItem.id === activeTileId) || tiletypes[0];

    const selectOptions = tiletypes.map(tileItem => 
        `<option value="${tileItem.id}" ${tileItem.id === activeTileId ? "selected" : ""}>
            ${t[tileItem.name] || tileItem.name || 'Csempe'}
        </option>`
    ).join("");

    const selectWrapper = document.createElement("div");
    selectWrapper.style.marginBottom = "10px";
    selectWrapper.innerHTML = `
        <label for="tile-selector" style="font-weight: 600; font-size: 0.95rem; color: #cbd5e1; margin-right: 8px;" data-i18n="selectActiveTile">${t.selectActiveTile || "Aktív csempe kiválasztása:"}</label>
        <select id="tile-selector" name="tileSelector" style="width: 100%; margin-top: 6px; padding: 8px; background: var(--input-bg); border: 1px solid var(--border-color); color: white; border-radius: 6px;">
            ${selectOptions}
        </select>
    `;
    container.appendChild(selectWrapper);

    const otherTilesCheckboxes = tiletypes
        .filter(other => other.id !== activeTile.id)
        .map(other => `
            <label for="iso-${activeTile.id}-${other.id}" style="margin-right: 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; color: #cbd5e1;">
                <input type="checkbox" id="iso-${activeTile.id}-${other.id}" class="isolation-check" data-id="${activeTile.id}" data-target="${other.id}" ${activeTile.isIsolatedFrom && activeTile.isIsolatedFrom(other.id) ? "checked" : ""}>
                ${t[other.name] || other.name} (${other.id})
            </label>
        `).join("");

    const card = document.createElement("div");
    card.className = "tile-control-item";
    card.style.border = "1px solid var(--border-color)";
    card.style.padding = "12px";
    card.style.borderRadius = "8px";
    card.style.background = "rgba(0, 0, 0, 0.2)";

    card.innerHTML = `
        <div class="control-row" style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
            <label for="tile-name-${activeTile.id}" style="font-size: 12px;" data-i18n="tileNameLabel">${t.tileNameLabel || "Név:"}</label>
            <input type="text" id="tile-name-${activeTile.id}" name="tileName" class="tile-name-input" data-id="${activeTile.id}" value="${t[activeTile.name] || activeTile.name}" style="flex: 1; background: var(--input-bg); border: 1px solid var(--border-color); color: white; padding: 6px 10px; border-radius: 6px;">
            
            <input type="color" id="tile-color-${activeTile.id}" name="tileColor" class="tile-color-input" data-id="${activeTile.id}" value="${activeTile.color}">
            
            ${tiletypes.length > 1 ? `<button type="button" class="btn-delete-tile" data-id="${activeTile.id}" style="margin-left: auto; background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;" data-i18n="deleteTileBtn">${t.deleteTileBtn || "Törlés"}</button>` : ''}
        </div>
        <div class="control-row" style="margin-bottom: 8px; display: flex; align-items: center; gap: 12px;">
            <label for="tile-floor-${activeTile.id}" style="font-size: 13px; display: flex; align-items: center; gap: 4px; color: #cbd5e1;">
                <input type="checkbox" id="tile-floor-${activeTile.id}" name="tileFloor" class="tile-floor-check" data-id="${activeTile.id}" ${activeTile.isFloor ? "checked" : ""}>
                <span data-i18n="isFloorLabel">${t.isFloorLabel || "Padló típus"}</span>
            </label>
            <select id="texture-${activeTile.id}" name="tileTexture" class="tile-texture-select" data-id="${activeTile.id}" style="background: var(--input-bg); border: 1px solid var(--border-color); color: white; padding: 4px; border-radius: 6px;">
                <option value="none" ${activeTile.texture === "none" ? "selected" : ""} data-i18n="texNone">${t.texNone || "Nincs"}</option>
                <option value="stone" ${activeTile.texture === "stone" ? "selected" : ""} data-i18n="texStone">${t.texStone || "Kő"}</option>
                <option value="wood" ${activeTile.texture === "wood" ? "selected" : ""} data-i18n="texWood">${t.texWood || "Fa"}</option>
                <option value="cobblestone" ${activeTile.texture === "cobblestone" ? "selected" : ""} data-i18n="texCobble">${t.texCobble || "Macskakő"}</option>
            </select>
        </div>
        <div class="control-row" style="margin-top: 6px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
            <span style="font-size: 11px; font-weight: bold; color: #cbd5e1;" data-i18n="wallsTowardsLabel">${t.wallsTowardsLabel || "Falak feléjük:"}</span>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${otherTilesCheckboxes || `<span style='font-size:11px; color:#888;' data-i18n="noOtherTiles">${t.noOtherTiles || "Nincs másik csempe"}</span>`}
            </div>
        </div>
    `;
    container.appendChild(card);

    // Eseménykezelők
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
renderTileControls();
updateUIVisibility();

document.getElementById("addTileBtn")?.addEventListener("click", () => {
    createNewTileType();
    renderTileControls();
});

document.getElementById("exportBtn")?.addEventListener("click", () => {
    exportToDd2vtt(matrix, canvas, 12);
});

let isDrawing = false;
function drawTileAtMouse(e: MouseEvent) {
    if (currentEditorMode !== 'draw') return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const centerCol = Math.floor(mouseX / 32);
    const centerRow = Math.floor(mouseY / 32);
    const brushRadius = parseInt((document.getElementById("brush_size") as HTMLInputElement)?.value || "0", 10);

    let changed = false;
    for (let r = centerRow - brushRadius; r <= centerRow + brushRadius; r++) {
        for (let c = centerCol - brushRadius; c <= centerCol + brushRadius; c++) {
            if (r >= 0 && r < mapHeight && c >= 0 && c < mapWidth) {
                if (matrix[r][c] !== activeTileId) {
                    matrix[r][c] = activeTileId;
                    changed = true;
                }
            }
        }
    }
    if (changed) scheduleDraw(matrix);
}

canvas.addEventListener("mousedown", (e) => { if (currentEditorMode === 'draw') { isDrawing = true; drawTileAtMouse(e); } });
canvas.addEventListener("mousemove", (e) => { if (isDrawing && currentEditorMode === 'draw') { drawTileAtMouse(e); } });
window.addEventListener("mouseup", () => { isDrawing = false; });

canvas.addEventListener("click", (e) => {
    if (currentEditorMode !== 'door') return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const c = Math.floor(mouseX / 32);
    const r = Math.floor(mouseY / 32);
    const localX = (mouseX / 32) - c;
    const localY = (mouseY / 32) - r;

    let segment: any;
    if (Math.abs(localX - 0.5) > Math.abs(localY - 0.5)) {
        const edgeX = localX > 0.5 ? c + 1 : c;
        segment = { p1: { x: edgeX, y: r }, p2: { x: edgeX, y: r + 1 } };
    } else {
        const edgeY = localY > 0.5 ? r + 1 : r;
        segment = { p1: { x: c, y: edgeY }, p2: { x: c + 1, y: edgeY } };
    }

    togglePortalAt(segment, 32);
    scheduleDraw(matrix);
});