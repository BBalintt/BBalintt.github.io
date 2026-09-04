import { translations, currentLang } from "./lang.js";
import { tiletypes } from "./tileRegistry.js";

/**
 * Generates and downloads a .dd2vtt map file based on the dungeon matrix and canvas state.
 * 
 * Boundary Decision Rules:
 * 1. Wall (LOS): Placed between Floor and Wall/Void, or outer bounds.
 * 2. Door (Portal): Placed at connected boundaries between Corridors & Rooms, or isolated floor boundaries.
 * 3. Nothing (Passage): Open space between adjacent connected floor tiles.
 *
 * @param {Array<Array<number>>} matrix 2D grid matrix of tile IDs
 * @param {HTMLCanvasElement} canvas Canvas element containing the rendered map image
 * @param {number} tileSize Grid size in pixels (default: 32)
 */
export function exportToDd2vtt(matrix, canvas, tileSize = 32) {
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

            // --- Horizontal Neighbor Check (Cell (r, c) vs Cell (r, c + 1)) ---
            checkEdge(
                r, c, r, c + 1,
                { x: c + 1, y: r }, { x: c + 1, y: r + 1 },
                `V_${c + 1}_${r}`
            );

            // --- Vertical Neighbor Check (Cell (r, c) vs Cell (r + 1, c)) ---
            checkEdge(
                r, c, r + 1, c,
                { x: c, y: r + 1 }, { x: c + 1, y: r + 1 },
                `H_${c}_${r + 1}`
            );

            // --- Outer Map Boundaries (North & West edges for boundary cells) ---
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

        // Case 1: Transition between Floor and Non-Floor (Wall / Void)
        if (isFloorA !== isFloorB) {
            los.push([p1, p2]);
            return;
        }

        // Case 2: Both tiles are non-floor (Void to Void) -> No edge needed
        if (!isFloorA && !isFloorB) return;

        // Case 3: Both tiles are Floors
        const idA = matrix[r1][c1];
        const idB = matrix[r2][c2];

        // Check isolation configuration between tile types
        const isIsolated = (tileA && tileA.isIsolatedFrom && tileA.isIsolatedFrom(idB)) ||
                           (tileB && tileB.isIsolatedFrom && tileB.isIsolatedFrom(idA));

        // Junction between different floor tile types (Corridor, Room, or user-created custom tiles)
        const isDifferentFloorType = idA !== idB;

        if (isDifferentFloorType || isIsolated) {
            // Door Candidate: Corridor-to-Room, Room-to-Room, or custom floor tile boundaries
            rawDoorSegments.push({ p1, p2, key, r1, c1, r2, c2 });
        } else {
            // Open Passage: Connected floor tiles of the same type -> Nothing (pass-through)
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

    groups.forEach(group => {
        if (group.length === 0) return;

        // Calculate average center point of contiguous door boundary group
        let avgX = 0, avgY = 0;
        group.forEach(s => {
            avgX += (s.p1.x + s.p2.x) / 2;
            avgY += (s.p1.y + s.p2.y) / 2;
        });
        avgX /= group.length;
        avgY /= group.length;

        // Select the segment closest to group center for the portal
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

        group.forEach(s => {
            if (s === bestSegment) {
                pushPortal(s.p1, s.p2);
            } else {
                // Remaining contiguous segments become wall LOS so sight is blocked
                los.push([s.p1, s.p2]);
            }
        });
    });

    const dataUrl = canvas.toDataURL("image/png");
    const base64Image = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");

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