import { translations, currentLang } from "./lang.js";

export function exportToDd2vtt(matrix, canvas, tileSize = 32) {
    const size = matrix.length;
    const los = [];
    const portals = [];

    const isValid = (x, y) => x >= 0 && x < size && y >= 0 && y < size;

    const isFloor = (x, y) => {
        if (!isValid(x, y)) return false;
        return matrix[x][y] === 1 || matrix[x][y] === 2;
    };

    // Eldönti, hogy a két cella között ajtójelölt határ van-e
    const isDoorBoundary = (x1, y1, x2, y2) => {
        if (!isValid(x1, y1) || !isValid(x2, y2)) return false;
        const c1 = matrix[x1][y1];
        const c2 = matrix[x2][y2];
        return (c1 === 1 && c2 === 2) || (c1 === 2 && c2 === 1);
    };

    // 1. Összes határszegmens kinyerése (Ajtójelöltek és Falak)
    const rawDoorSegments = [];

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (isFloor(r, c)) {

                // Északi / Felső határ
                if (isDoorBoundary(r, c, r - 1, c)) {
                    if (r > 0 && matrix[r][c] === 2 && matrix[r - 1][c] === 1) {
                        rawDoorSegments.push({ p1: { x: c, y: r }, p2: { x: c + 1, y: r }, key: `H_${c}_${r}` });
                    }
                } else if (!isFloor(r - 1, c)) {
                    los.push([{ x: c, y: r }, { x: c + 1, y: r }]);
                }

                // Déli / Alsó határ
                if (isDoorBoundary(r, c, r + 1, c)) {
                    if (r < size - 1 && matrix[r][c] === 2 && matrix[r + 1][c] === 1) {
                        rawDoorSegments.push({ p1: { x: c, y: r + 1 }, p2: { x: c + 1, y: r + 1 }, key: `H_${c}_${r + 1}` });
                    }
                } else if (!isFloor(r + 1, c)) {
                    los.push([{ x: c, y: r + 1 }, { x: c + 1, y: r + 1 }]);
                }

                // Nyugati / Bal határ
                if (isDoorBoundary(r, c, r, c - 1)) {
                    if (c > 0 && matrix[r][c] === 2 && matrix[r][c - 1] === 1) {
                        rawDoorSegments.push({ p1: { x: c, y: r }, p2: { x: c, y: r + 1 }, key: `V_${c}_${r}` });
                    }
                } else if (!isFloor(r, c - 1)) {
                    los.push([{ x: c, y: r }, { x: c, y: r + 1 }]);
                }

                // Keleti / Jobb határ
                if (isDoorBoundary(r, c, r, c + 1)) {
                    if (c < size - 1 && matrix[r][c] === 2 && matrix[r][c + 1] === 1) {
                        rawDoorSegments.push({ p1: { x: c + 1, y: r }, p2: { x: c + 1, y: r + 1 }, key: `V_${c + 1}_${r}` });
                    }
                } else if (!isFloor(r, c + 1)) {
                    los.push([{ x: c + 1, y: r }, { x: c + 1, y: r + 1 }]);
                }

            }
        }
    }

    // 2. Szomszédos ajtó-szegmensek csoportosítása (Flood Fill / BFS)
    // Két szegmens szomszédos, ha van közös végpontjuk.
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

    // 3. Ajtók és Falak szétválasztása csoportonként
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

    groups.forEach(group => {
        if (group.length === 0) return;

        // Csoport geometriai közepe (Súlypont)
        let avgX = 0, avgY = 0;
        group.forEach(s => {
            avgX += (s.p1.x + s.p2.x) / 2;
            avgY += (s.p1.y + s.p2.y) / 2;
        });
        avgX /= group.length;
        avgY /= group.length;

        // Kiválasztjuk azt az 1 szegmenst, ami a legközelebb van a középponthoz
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

        // A kiválasztott szegmens ajtó lesz, a többi fal!
        group.forEach(s => {
            if (s === bestSegment) {
                pushPortal(s.p1, s.p2);
            } else {
                los.push([s.p1, s.p2]);
            }
        });
    });

    // 4. Base64 Kép generálása
    const dataUrl = canvas.toDataURL("image/png");
    const base64Image = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");

    // 5. JSON Felépítése
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
        environment: {
            baked_lighting: true
        },
        image: base64Image
    };

    // 6. Fájl Letöltése
    const jsonString = JSON.stringify(dd2vttData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const defaultFileName = translations[currentLang].fileName;

    const a = document.createElement("a");
    a.href = url;
    a.download = `${defaultFileName}.dd2vtt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}