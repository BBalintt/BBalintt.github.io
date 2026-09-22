// 2. Sima stílus: Háromszögek rajzolása a sarkokba, ahol nincsenek szomszédok
function drawSmoothWalls(ctx, matrix, tileSize, rows, cols, tileLookup) {
    const defaultTileColor = tiletypes[0] ? tiletypes[0].color : "#000000";

    ctx.save();
    
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const tileId = matrix[y][x];
            if (tileId === 0) continue;

            const tiletype = tileLookup.get(tileId);
            if (!tiletype || typeof tiletype.isIsolatedFrom !== "function") continue;

            const baseX = x * tileSize;
            const baseY = y * tileSize;

            // Szomszédok ellenőrzése (van-e fal vagy üres terület)
            const hasTop = y - 1 >= 0 && matrix[y - 1][x] !== tileId && tiletype.isIsolatedFrom(matrix[y - 1][x]);
            const hasBottom = y + 1 < rows && matrix[y + 1][x] !== tileId && tiletype.isIsolatedFrom(matrix[y + 1][x]);
            const hasLeft = x - 1 >= 0 && matrix[y][x - 1] !== tileId && tiletype.isIsolatedFrom(matrix[y][x - 1]);
            const hasRight = x + 1 < cols && matrix[y][x + 1] !== tileId && tiletype.isIsolatedFrom(matrix[y][x + 1]);

            // A háromszög színe (ha az alap csempe az 0-ás, akkor a szomszéd vagy a default szín, különben a csempe saját színe)
            const fillColor = (tiletype === tiletypes[0]) ? defaultTileColor : tiletype.color;
            ctx.fillStyle = fillColor;

            const cornerSize = tileSize / 3; // A sarokháromszög mérete

            // FELSŐ-JOBB SAROK (ha nincs fent és nincs jobb oldalt szomszéd)
            if (hasTop && hasRight) {
                ctx.beginPath();
                ctx.moveTo(baseX + tileSize, baseY);
                ctx.lineTo(baseX + tileSize, baseY + cornerSize);
                ctx.lineTo(baseX + tileSize - cornerSize, baseY);
                ctx.closePath();
                ctx.fill();
            }

            // FELSŐ-BAL SAROK (ha nincs fent és nincs bal oldalt szomszéd)
            if (hasTop && hasLeft) {
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.lineTo(baseX + cornerSize, baseY);
                ctx.lineTo(baseX, baseY + cornerSize);
                ctx.closePath();
                ctx.fill();
            }

            // ALSÓ-JOBB SAROK (ha nincs lent és nincs jobb oldalt szomszéd)
            if (hasBottom && hasRight) {
                ctx.beginPath();
                ctx.moveTo(baseX + tileSize, baseY + tileSize);
                ctx.lineTo(baseX + tileSize - cornerSize, baseY + tileSize);
                ctx.lineTo(baseX + tileSize, baseY + tileSize - cornerSize);
                ctx.closePath();
                ctx.fill();
            }

            // ALSÓ-BAL SAROK (ha nincs lent és nincs bal oldalt szomszéd)
            if (hasBottom && hasLeft) {
                ctx.beginPath();
                ctx.moveTo(baseX, baseY + tileSize);
                ctx.lineTo(baseX, baseY + tileSize - cornerSize);
                ctx.lineTo(baseX + cornerSize, baseY + tileSize);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    ctx.restore();
}