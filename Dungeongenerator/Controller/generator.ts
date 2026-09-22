import { translations, currentLang, setLanguage } from "./lang.js";
import { exportToDd2vtt } from "./exportDd2vtt.js";
import { drawDungeon, scheduleDraw, setWallStyle } from "../View/draw.js";
import { tiletypes, activeTileId, setActiveTileId, createNewTileType, removeTileType, toggleIsolation } from "./tileRegistry.js";

// --- SZERKESZTÉSI MÓD KEZELÉSE ---
export type EditorMode = 'draw' | 'door';
let currentEditorMode: EditorMode = 'draw';

export function getEditorMode(): EditorMode {
    return currentEditorMode;
}

export function setEditorMode(mode: EditorMode): void {
    currentEditorMode = mode;
}

export let backgroundImage: HTMLImageElement | null = null;

export let size = 50;
export const matrix = Array.from({ length: size }, () => Array(size).fill(0));

export let loadedLineOfSight: any[] | null = null;
export let loadedPortals: any[] | null = null;

export function getLoadedLineOfSight() {
    return loadedLineOfSight;
}

export function getLoadedPortals() {
    return loadedPortals;
}

export interface Portal {
    position: { x: number; y: number };
    bounds: { x: number; y: number }[];
}

let customPortals: Portal[] = [];

export function getCustomPortals(): Portal[] {
    return customPortals;
}

export function setCustomPortals(portals: Portal[]): void {
    customPortals = portals;
}

// --- PORTÁLOK AUTOMATIKUS KISZÁMÍTÁSA (Mátrix alapján) ---
export function calculatePortalsFromMatrix(matrixToAnalyze: number[][], tileSize: number): Portal[] {
    const matSize = matrixToAnalyze.length;
    const tileLookup = new Map(tiletypes.map(t => [t.id, t]));
    
    const isValid = (r: number, c: number) => r >= 0 && r < matSize && c >= 0 && c < matSize;
    const getTile = (r: number, c: number) => {
        if (!isValid(r, c)) return null;
        const tileId = matrixToAnalyze[r][c];
        return tileLookup.get(tileId) || null;
    };

    const rawDoorSegments: any[] = [];

    const checkEdge = (r1: number, c1: number, r2: number, c2: number, p1: any, p2: any) => {
        const tileA = getTile(r1, c1);
        const tileB = getTile(r2, c2);

        const isFloorA = tileA ? tileA.isFloor : false;
        const isFloorB = tileB ? tileB.isFloor : false;

        if (isFloorA !== isFloorB) return;
        if (!isFloorA && !isFloorB) return;

        const idA = matrixToAnalyze[r1][c1];
        const idB = matrixToAnalyze[r2][c2];

        const isIsolated = (tileA && tileA.isIsolatedFrom && tileA.isIsolatedFrom(idB)) ||
                           (tileB && tileB.isIsolatedFrom && tileB.isIsolatedFrom(idA));

        const isDifferentFloorType = idA !== idB;

        if (isDifferentFloorType || isIsolated) {
            rawDoorSegments.push({ p1, p2, r1, c1, r2, c2 });
        }
    };

    for (let r = 0; r < matSize; r++) {
        for (let c = 0; c < matSize; c++) {
            checkEdge(r, c, r, c + 1, { x: c + 1, y: r }, { x: c + 1, y: r + 1 });
            checkEdge(r, c, r + 1, c, { x: c, y: r + 1 }, { x: c + 1, y: r + 1 });
        }
    }

    const visited = new Set<number>();
    const groups: any[][] = [];

    const areConnected = (s1: any, s2: any) => {
        return (s1.p1.x === s2.p1.x && s1.p1.y === s2.p1.y) ||
               (s1.p1.x === s2.p2.x && s1.p1.y === s2.p2.y) ||
               (s1.p2.x === s2.p1.x && s1.p2.y === s2.p1.y) ||
               (s1.p2.x === s2.p2.x && s1.p2.y === s2.p2.y);
    };

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

        const midX = (bestSegment.p1.x + bestSegment.p2.x) / 2;
        const midY = (bestSegment.p1.y + bestSegment.p2.y) / 2;

        portals.push({
            position: { x: midX * tileSize, y: midY * tileSize },
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
        Math.abs(p.bounds[1].x - segment.p2.x * tileSize) < 8 &&
        Math.abs(p.bounds[1].y - segment.p2.y * tileSize) < 8
    );

    if (index >= 0) {
        customPortals.splice(index, 1);
    } else {
        customPortals.push({
            position: { 
                x: ((segment.p1.x + segment.p2.x) / 2) * tileSize, 
                y: ((segment.p1.y + segment.p2.y) / 2) * tileSize 
            },
            bounds: [
                { x: segment.p1.x * tileSize, y: segment.p1.y * tileSize },
                { x: segment.p2.x * tileSize, y: segment.p2.y * tileSize }
            ]
        });
    }
}

export function clearCustomPortals(): void {
    customPortals = [];
}

// Módváltó gombok kezelése
const btnDraw = document.getElementById("btn-mode-draw");
const btnDoor = document.getElementById("btn-mode-door");

if (btnDraw && btnDoor) {
    btnDraw.addEventListener("click", () => {
        setEditorMode('draw');
        btnDraw.style.background = "#4CAF50";
        btnDraw.style.color = "white";
        btnDoor.style.background = "#ddd";
        btnDoor.style.color = "black";
    });

    btnDoor.addEventListener("click", () => {
        setEditorMode('door');
        btnDoor.style.background = "#ffcc00";
        btnDoor.style.color = "black";
        btnDraw.style.background = "#ddd";
        btnDraw.style.color = "white";
    });
}

const mapFileInput = document.getElementById("map-file-input") as HTMLInputElement | null;
const wallStyleSelect = document.getElementById("wall-style-select") as HTMLSelectElement;

if (wallStyleSelect) {
    wallStyleSelect.addEventListener("change", (e) => {
        const selectedStyle = (e.target as HTMLSelectElement).value;
        setWallStyle(selectedStyle);
    });
}

if (mapFileInput) {
    mapFileInput.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
            const file = target.files[0];
            const fileName = file.name.toLowerCase();

            if (fileName.endsWith(".dd2vtt")) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const jsonContent = event.target?.result as string;
                        const dd2vttData = JSON.parse(jsonContent);
                        
                        loadedLineOfSight = dd2vttData.line_of_sight || null;
                        loadedPortals = dd2vttData.portals || null;
                        
                        // Fájlból jövő portálok betöltése a customPortals-ba is, hogy szerkeszthetőek legyenek
                        if (loadedPortals && Array.isArray(loadedPortals)) {
                            customPortals = JSON.parse(JSON.stringify(loadedPortals));
                        } else {
                            customPortals = [];
                        }

                        if (dd2vttData.resolution && dd2vttData.resolution.map_size) {
                            const mapSize = dd2vttData.resolution.map_size;
                            size = Math.max(mapSize.x, mapSize.y);
                            
                            matrix.length = 0;
                            for (let r = 0; r < size; r++) {
                                matrix[r] = Array(size).fill(0);
                            }
                        }

                        if (dd2vttData.image) {
                            const img = new Image();
                            backgroundImage = img;
                            img.onload = () => {
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
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    backgroundImage = img;
                    loadedLineOfSight = null;
                    loadedPortals = null;
                    customPortals = [];

                    img.onload = () => {
                        scheduleDraw(matrix, img as any);  
                    };
                    img.src = event.target?.result as string;
                };
                reader.readAsDataURL(file);
            }
        }
    });
}

// [Itt történik a szobák és folyosók generálása a korábbi kódod alapján...]
interface Room {
    id: number;
    height: number;
    width: number;
    centerx: number;
    centery: number;
    max_connections: number;
    connections: number;
}

const rooms: Room[] = [];
for (let i = 0; i < 30; i++) {
    const x = Math.round(Math.random() * 5) + 3;
    const y = Math.round(Math.random() * 5) + 3;
    const rand = Math.random();
    let maxConn = rand < 0.4 ? 1 : rand < 0.7 ? 2 : rand < 0.9 ? 3 : 4;

    rooms.push({
        id: i, height: x, width: y, centerx: 0, centery: 0, max_connections: maxConn, connections: 0
    });
}

rooms.forEach(room => {
    const roomShape = Math.random() < 0.5 ? 'rect' : 'ellipse';
    let x = Math.round(Math.random() * (size - room.height));
    let y = Math.round(Math.random() * (size - room.width));
    
    while (!isAreaEmpty(x, y, room.height, room.width, matrix, size)) {
        x = Math.floor(Math.random() * (size - room.height + 1));
        y = Math.floor(Math.random() * (size - room.width + 1));
    }

    if (roomShape === 'rect') {
        for (let i = x; i < x + room.height; i++) {
            for (let j = y; j < y + room.width; j++) { matrix[i][j] = 2; }
        }
    } else {
        const radiusRow = room.height / 2;
        const radiusCol = room.width / 2;
        const centerRow = x + radiusRow;
        const centerCol = y + radiusCol;

        for (let i = x; i < x + room.height; i++) {
            for (let j = y; j < y + room.width; j++) {
                const dr = (i - centerRow) / radiusRow;
                const dc = (j - centerCol) / radiusCol;
                if (dr * dr + dc * dc <= 1.0) {
                    if (i >= 0 && i < size && j >= 0 && j < size) { matrix[i][j] = 2; }
                }
            }
        }
    }
    room.centerx = x + (room.height / 2);
    room.centery = y + (room.width / 2);
});

// Folyosók összekötése...
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
    // Egyszerűsített összekötés a példádból
    const connectedSet = new Set<Room>();
    const unselectedRooms = [...rooms];
    connectedSet.add(unselectedRooms.shift()!);
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

function isAreaEmpty(startX: number, startY: number, h: number, w: number, mat: number[][], s: number): boolean {
    if (startX + h > s || startY + w > s) return false;
    for (let r = startX; r < startX + h; r++) {
        for (let c = startY; c < startY + w; c++) { if (mat[r][c] !== 0) return false; }
    }
    return true;
}

// --- FONTOS: Kezdeti automatikus ajtók kiszámítása és betöltése a customPortals-ba ---
// Így induláskor minden generált ajtó benne lesz a szerkeszthető listában!
const tileSize = 32;
customPortals = calculatePortalsFromMatrix(matrix, tileSize);

// UI és Vezérlők renderelése...
export function renderTileControls() {
    const container = document.getElementById("tile-controls-container");
    if (!container) return;
    const t = translations[currentLang as keyof typeof translations];
    container.innerHTML = "";
    const activeTile = tiletypes.find(tileItem => tileItem.id === activeTileId) || tiletypes[0];

    const selectWrapper = document.createElement("div");
    selectWrapper.style.marginBottom = "10px";
    selectWrapper.innerHTML = `
        <label for="tile-selector" style="font-weight: bold; margin-right: 8px;">${t.selectActiveTile}</label>
        <select id="tile-selector" name="tileSelector" style="padding: 4px 8px; font-size: 14px;">
            ${tiletypes.map(tileItem => `<option value="${tileItem.id}" ${tileItem.id === activeTileId ? "selected" : ""}>${tileItem.name}</option>`).join("")}
        </select>
    `;
    container.appendChild(selectWrapper);

    const card = document.createElement("div");
    card.className = "tile-control-item";
    card.style.border = "1px solid #ccc";
    card.style.padding = "10px";
    card.style.borderRadius = "4px";
    card.innerHTML = `
        <div class="control-row" style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
            <input type="text" class="tile-name-input" data-id="${activeTile.id}" value="${activeTile.name}">
            <input type="color" class="tile-color-input" data-id="${activeTile.id}" value="${activeTile.color}">
            <button type="button" class="btn-delete-tile" data-id="${activeTile.id}" style="margin-left: auto; background: #ff4d4d; color: white; border: none; padding: 4px 8px; cursor: pointer;">${t.deleteTileBtn}</button>
        </div>
    `;
    container.appendChild(card);

    document.getElementById("tile-selector")?.addEventListener("change", (e) => {
        setActiveTileId(parseInt((e.target as HTMLSelectElement).value, 10));
        renderTileControls();
    });
}

document.getElementById("addTileBtn")?.addEventListener("click", () => {
    createNewTileType();
    renderTileControls();
});

const canvas = document.getElementById("dungeon") as HTMLCanvasElement;
drawDungeon(matrix);

document.getElementById("exportBtn")?.addEventListener("click", () => {
    exportToDd2vtt(matrix, canvas, tileSize);
});

let isDrawing = false;

function drawTileAtMouse(e: MouseEvent) {
    if (currentEditorMode !== 'draw') return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const centerCol = Math.floor(mouseX / tileSize);
    const centerRow = Math.floor(mouseY / tileSize);
    const brushRadius = parseInt((document.getElementById("brush_size") as HTMLInputElement)?.value || "0", 10);

    let changed = false;
    for (let r = centerRow - brushRadius; r <= centerRow + brushRadius; r++) {
        for (let c = centerCol - brushRadius; c <= centerCol + brushRadius; c++) {
            if (r >= 0 && r < size && c >= 0 && c < size) {
                if (matrix[r][c] !== activeTileId) {
                    matrix[r][c] = activeTileId;
                    changed = true;
                }
            }
        }
    }
    if (changed) {
        // Ha változott a pálya, frissíthetjük az automatikus ajtókat is, ha még nem nyúlt hozzá manuálisan, vagy kezelhetjük dinamikusan.
        scheduleDraw(matrix);
    }
}

canvas.addEventListener("mousedown", (e) => {
    if (currentEditorMode === 'draw') {
        isDrawing = true;
        drawTileAtMouse(e);
    }
});

canvas.addEventListener("mousemove", (e) => {
    if (isDrawing && currentEditorMode === 'draw') {
        drawTileAtMouse(e);
    }
});

window.addEventListener("mouseup", () => { isDrawing = false; });

// Ajtó hozzáadása / törlése kattintással
canvas.addEventListener("click", (e) => {
    if (currentEditorMode !== 'door') return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);

    const c = Math.floor(mouseX / tileSize);
    const r = Math.floor(mouseY / tileSize);
    const localX = (mouseX / tileSize) - c;
    const localY = (mouseY / tileSize) - r;

    let segment: any;
    if (Math.abs(localX - 0.5) > Math.abs(localY - 0.5)) {
        const edgeX = localX > 0.5 ? c + 1 : c;
        segment = { p1: { x: edgeX, y: r }, p2: { x: edgeX, y: r + 1 } };
    } else {
        const edgeY = localY > 0.5 ? r + 1 : r;
        segment = { p1: { x: c, y: edgeY }, p2: { x: c + 1, y: edgeY } };
    }

    togglePortalAt(segment, tileSize);
    scheduleDraw(matrix);
});