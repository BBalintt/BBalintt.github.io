export function exportToDd2vtt(matrix, canvas, tileSize = 32) {
    const size = matrix.length;
    const los = [];

    // Segédfüggvény: Ellenőrzi, hogy a megadott cella járható padló-e
    const isFloor = (x, y) => {
        if (x < 0 || x >= size || y < 0 || y >= size) return false;
        return matrix[x][y] === 1 || matrix[x][y] === 2; // Folyosó (1) vagy Szoba (2)
    };

    // 1. Falak (line_of_sight) kinyerése a mátrixból
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (isFloor(r, c)) {
                // Északi/Felső fal (r - 1 szomszéd)
                if (!isFloor(r - 1, c)) {
                    // Vonatkozó sarokpontok koordinátái: (x, y) formában
                    los.push([{ x: c, y: r }, { x: c + 1, y: r }]);
                }
                // Déli/Alsó fal (r + 1 szomszéd)
                if (!isFloor(r + 1, c)) {
                    los.push([{ x: c, y: r + 1 }, { x: c + 1, y: r + 1 }]);
                }
                // Nyugati/Bal fal (c - 1 szomszéd)
                if (!isFloor(r, c - 1)) {
                    los.push([{ x: c, y: r }, { x: c, y: r + 1 }]);
                }
                // Keleti/Jobb fal (c + 1 szomszéd)
                if (!isFloor(r, c + 1)) {
                    los.push([{ x: c + 1, y: r }, { x: c + 1, y: r + 1 }]);
                }
            }
        }
    }

    // 2. A Canvas tartalmának átalakítása tisztított Base64 formátumra
    // (eltávolítjuk a "data:image/png;base64," előtagot)
    const dataUrl = canvas.toDataURL("image/png");
    const base64Image = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");

    // 3. A dd2vtt JSON objektum felépítése
    const dd2vttData = {
        format: 0.2,
        resolution: {
            map_origin: { x: 0, y: 0 },
            map_size: { x: size, y: size },
            pixels_per_grid: tileSize
        },
        line_of_sight: los,
        portals: [], //Később ajtók
        lights: [],  //Később fáklyák/fények
        environment: {
            baked_lighting: true
        },
        image: base64Image
    };

    // 4. JSON fájl generálása és letöltése
    const jsonString = JSON.stringify(dd2vttData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "generated_dungeon.dd2vtt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}