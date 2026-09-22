import { translations, currentLang } from "./lang.js";
import { tiletypes } from "./tileRegistry.js";
import { drawDungeon } from "../View/draw.js";

export function exportToDd2vtt(matrix, canvas, tileSize = 32) {
    // CSAK akkor hagyjuk ki a csempéket, ha VAN betöltve háttérkép.
    // Ha nincs háttér, a csempéket is bele kell menteni a képbe!
    const skipTilesIfNeeded = (backgroundImage !== null);

    // 1. LÉPÉS: Exportálás előtti újrarajzolás
    drawDungeon(matrix, skipTilesIfNeeded);

    const size = matrix.length;
    const los = [];
    const portals = [];

    // Helper: Verify grid coordinates are within bounds
    const isValid = (r, c) => r >= 0 && r < size && c >= 0 && c < size;

    // Helper: Retrieve tile object safely
    const getTile = (r, c) => {
        if (!isValid(r, c)) return null;
        const tileId = matrix[r][c];
        return tiletypes.find(t => t.id === tileId) || null;
    };

    const rawDoorSegments = [];

    // Iterate through all cells to check right (East) and bottom (South) edges
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const tileA = getTile(r, c);
            const isFloorA = tileA ? tileA.isFloor : false;

            checkEdge(
                r, c, r, c + 1,
                { x: c + 1, y: r }, { x: c + 1, y: r + 1 },
                `V_${c + 1}_${r}`
            );

            checkEdge(
                r, c, r + 1, c,
                { x: c, y: r + 1 }, { x: c + 1, y: r + 1 },
                `H_${c}_${r + 1}`
            );

            if (r === 0 && isFloorA) {
                los.push([{ x: c, y: r }, { x: c + 1, y: r }]);
            }
            if (c === 0 && isFloorA) {
                los.push([{ x: c, y: r }, { x: c, y: r + 1 }]);
            }
        }
    }

    function checkEdge(r1, c1, r2, c2, p1, p2, key) {
        const tileA = getTile(r1, c1);
        const tileB = getTile(r2, c2);

        const isFloorA = tileA ? tileA.isFloor : false;
        const isFloorB = tileB ? tileB.isFloor : false;

        if (isFloorA !== isFloorB) {
            los.push([p1, p2]);
            return;
        }

        if (!isFloorA && !isFloorB) return;

        const idA = matrix[r1][c1];
        const idB = matrix[r2][c2];

        const isIsolated = (tileA && tileA.isIsolatedFrom && tileA.isIsolatedFrom(idB)) ||
                           (tileB && tileB.isIsolatedFrom && tileB.isIsolatedFrom(idA));

        const isDifferentFloorType = idA !== idB;

        if (isDifferentFloorType || isIsolated) {
            rawDoorSegments.push({ p1, p2, key, r1, c1, r2, c2 });
        }
    }

    const visited = new Set();
    const groups = [];

    const areConnected = (s1, s2) => {
        return (s1.p1.x === s2.p1.x && s1.p1.y === s2.p1.y) ||
               (s1.p1.x === s2.p2.x && s1.p1.y === s2.p2.y) ||
               (s1.p2.x === s2.p1.x && s1.p2.y === s2.p1.y) ||
               (s1.p2.x === s2.p2.x && s1.p2.y === s2.p2.y);
    };

    for (let i = 0; i < rawDoorSegments.length; i++) {
        if (visited.has(i)) continue;

        const group = [];
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

    const pushPortal = (p1, p2) => {
        portals.push({
            position: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
            bounds: [p1, p2],
            rotation: 0,
            closed: true,
            freestanding: false,
            portal_type: 0
        });
    };

    // Segédfüggvény az azonos vonal mentén fekvő (collinear) szakaszok összevonására
    function simplifySegments(segments) {
        if (segments.length <= 1) return segments;

        // Vesszük a szakaszok pontjait páronként [{p1, p2}, ...]
        let lines = segments.map(s => ({ p1: { ...s.p1 }, p2: { ...s.p2 } }));
        let merged = true;

        while (merged) {
            merged = false;
            for (let i = 0; i < lines.length; i++) {
                for (let j = i + 1; j < lines.length; j++) {
                    const l1 = lines[i];
                    const l2 = lines[j];

                    // Ellenőrizzük, hogy vízszintesek vagy függőlegesek-e, és összeérnek-e
                    const isHorizontal1 = l1.p1.y === l1.p2.y;
                    const isHorizontal2 = l2.p1.y === l2.p2.y;

                    if (isHorizontal1 && isHorizontal2 && l1.p1.y === l2.p1.y) {
                        // Vízszintes vonalak összevonása, ha érintkeznek
                        const minX1 = Math.min(l1.p1.x, l1.p2.x);
                        const maxX1 = Math.max(l1.p1.x, l1.p2.x);
                        const minX2 = Math.min(l2.p1.x, l2.p2.x);
                        const maxX2 = Math.max(l2.p1.x, l2.p2.x);

                        if (maxX1 >= minX2 && maxX2 >= minX1) {
                            l1.p1.x = Math.min(minX1, minX2);
                            l1.p2.x = Math.max(maxX1, maxX2);
                            lines.splice(j, 1);
                            merged = true;
                            break;
                        }
                    } else if (!isHorizontal1 && !isHorizontal2 && l1.p1.x === l2.p1.x) {
                        // Függőleges vonalak összevonása, ha érintkeznek
                        const minY1 = Math.min(l1.p1.y, l1.p2.y);
                        const maxY1 = Math.max(l1.p1.y, l1.p2.y);
                        const minY2 = Math.min(l2.p1.y, l2.p2.y);
                        const maxY2 = Math.max(l2.p1.y, l2.p2.y);

                        if (maxY1 >= minY2 && maxY2 >= minY1) {
                            l1.p1.y = Math.min(minY1, minY2);
                            l1.p2.y = Math.max(maxY1, maxY2);
                            lines.splice(j, 1);
                            merged = true;
                            break;
                        }
                    }
                }
                if (merged) break;
            }
        }
        return lines;
    }

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

        // Kiválasztjuk a portált (ajtót)
        group.forEach(s => {
            if (s === bestSegment) {
                pushPortal(s.p1, s.p2);
            }
        });

        // A többi szakaszt kiszűrjük (ahol nem a portál van)
        const nonPortalSegments = group.filter(s => s !== bestSegment);
        
        // Összevonjuk az azonos vonal mentén lévő szakaszokat egyetlen hosszú vonallá
        const simplifiedLines = simplifySegments(nonPortalSegments);

        simplifiedLines.forEach(line => {
            los.push([line.p1, line.p2]);
        });
    });

    // Létrehozzuk a Base64 képet a csempe-nélküli változatról
    const dataUrl = canvas.toDataURL("image/png");
    const base64Image = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");

    // 2. LÉPÉS: Miután lementettük az adatot, azonnal visszaállítjuk a normális nézetet (csempékkel együtt)
    drawDungeon(matrix, false);

    const dd2vttData = {
        format: 0.2,
        resolution: {
            map_origin: { x: 0, y: 0 },
            map_size: { x: size, y: size },
            pixels_per_grid: tileSize
        },
        line_of_sight: los,
        portals: portals,
        lights: [],
        environment: { baked_lighting: true },
        image: base64Image
    };

    const jsonString = JSON.stringify(dd2vttData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const defaultFileName = (translations[currentLang] && translations[currentLang].fileName) 
        ? translations[currentLang].fileName 
        : "dungeon_map";

    const a = document.createElement("a");
    a.href = url;
    a.download = `${defaultFileName}.dd2vtt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}