export function drawStoneTexture(ctx, x, y, tileSize, baseColor) {
    const startX = x * tileSize;
    const startY = y * tileSize;
    

    // 4 különálló kőlap kirajzolása a csempén belül
    const subTiles = [
        { rx: 1, ry: 1, rw: tileSize / 2 - 2, rh: tileSize / 2 - 2 },
        { rx: tileSize / 2 + 1, ry: 1, rw: tileSize / 2 - 2, rh: tileSize / 2 - 2 },
        { rx: 1, ry: tileSize / 2 + 1, rw: tileSize / 2 - 2, rh: tileSize / 2 - 2 },
        { rx: tileSize / 2 + 1, ry: tileSize / 2 + 1, rw: tileSize / 2 - 2, rh: tileSize / 2 - 2 }
    ];

    subTiles.forEach(st => {
        // Kőlap alapszín
        ctx.fillStyle = baseColor;
        ctx.fillRect(startX + st.rx, startY + st.ry, st.rw, st.rh);
        // Determinisztikus áttetszőség kőlaponként (0.05 és 0.25 között)
        const shineSeed = Math.abs(Math.sin((x + st.rx) * 12.9898 + (y + st.ry) * 78.233));
        const highlightAlpha = 0.05 + (shineSeed % 1) * 0.20;

        // Felső/bal oldali csúcsfény (highlight)
        ctx.fillStyle = "rgba(255, 255, 255, "+Math.random()+")";
        ctx.fillRect(startX + st.rx, startY + st.ry, st.rw, 2);
        ctx.fillRect(startX + st.rx, startY + st.ry, 2, st.rh);

        // Alsó/jobb oldali árnyék
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fillRect(startX + st.rx, startY + st.ry + st.rh - 2, st.rw, 2);
        ctx.fillRect(startX + st.rx + st.rw - 2, startY + st.ry, 2, st.rh);
    });
}

export function drawWoodTexture(ctx, x, y, tileSize) {
    const startX = x * tileSize;
    const startY = y * tileSize;

    // 2. Tiszta, kiszámíthatatlan randomitás a görcsnek (~25% esély)
    const hasKnot = Math.random() < 0.25;
    
    // Bárhová kerülhet a csempén belül, nincsenek kötött rácspontok
    const knotX = startX + 3 + (Math.random() * (tileSize - 6));
    const knotY = startY + 3 + (Math.random() * (tileSize - 6));
    const knotRadius = 1.2 + (Math.random() * 1.8);

    // 3. Erezetvonalak
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    ctx.lineWidth = 1;

    const lineCount = 5;
    const step = tileSize / lineCount;

    // Teljesen véletlenszerű kanyarodási irány és erősség CSEMPE-LEVELEN
    const globalWave = (Math.random() - 0.5) * (tileSize * 0.5);

    for (let i = 0; i < lineCount; i++) {
        // A kezdő és végpont FIX MAGASSÁGBAN van (hogy a szomszéd csempével összeérjen),
        // de a csempén BELÜLI kanyarulat teljesen random!
        const lineY = startY + (i * step) + (step / 2);

        let controlX = startX + (tileSize * 0.2) + (Math.random() * tileSize * 0.6);
        let controlY = lineY + globalWave;

        // Ha van görcs ezen a csempén, a vonalak kitérnek előle
        if (hasKnot) {
            const distY = lineY - knotY;
            if (Math.abs(distY) < tileSize * 0.35) {
                const pushDirection = distY >= 0 ? 1 : -1;
                controlX = knotX;
                controlY = knotY + (pushDirection * (knotRadius + 2.5));
            }
        }

        ctx.beginPath();
        ctx.moveTo(startX, lineY);
        ctx.quadraticCurveTo(controlX, controlY, startX + tileSize, lineY);
        ctx.stroke();
    }

    // 4. Görcs kirajzolása (ha van)
    if (hasKnot) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.beginPath();
        ctx.arc(knotX, knotY, knotRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function drawCobblestoneTexture(ctx, x, y, tileSize, baseColor) {
    const startX = x * tileSize;
    const startY = y * tileSize;

    // Determinisztikus hash a rács-koordinátákból (nincs villogás)
    const hash = (offset) => {
        let n = Math.sin(x * 12.9898 + y * 78.233 + offset * 43758.5453) * 43758.5453;
        return n - Math.floor(n);
    };

    // 1. Alap sötét föld / sár réteg a sziklák között
    ctx.fillStyle = "#12100e";
    ctx.fillRect(startX, startY, tileSize, tileSize);

    // 2. A csempét 2x2-es hálóra osztjuk a szikláknak (így garantáltan nem érnek egymáshoz)
    const gridSize = 2;
    const cellSize = tileSize / gridSize;

    for (let cx = 0; cx < gridSize; cx++) {
        for (let cy = 0; cy < gridSize; cy++) {
            const seed = cx * 3 + cy * 7;
            
            // A szikla közepe a cellán belül mozdul el eltolással (nem sormintás)
            const centerX = startX + (cx * cellSize) + (cellSize * 0.3) + (hash(seed + 1) * cellSize * 0.4);
            const centerY = startY + (cy * cellSize) + (cellSize * 0.3) + (hash(seed + 2) * cellSize * 0.4);

            // Sugár a cella méretéhez igazítva, hogy ne érjenek össze
            const rx = (cellSize * 0.28) + (hash(seed + 3) * cellSize * 0.15);
            const ry = (cellSize * 0.28) + (hash(seed + 4) * cellSize * 0.15);

            // 3. Szabálytalan, deformált ovális rajzolása (kő alakzat)
            ctx.beginPath();
            const points = 6; // 6 szögpont a természetes sziklaformáért
            for (let i = 0; i < points; i++) {
                const angle = (i / points) * Math.PI * 2;
                // A sugár deformációja pontonként
                const deform = 0.8 + hash(seed + 5 + i) * 0.4;
                const px = centerX + Math.cos(angle) * rx * deform;
                const py = centerY + Math.sin(angle) * ry * deform;

                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();

            // Kő kitöltése az alapszínnel
            ctx.fillStyle = baseColor;
            ctx.fill();

            // 4. Árnyékolás és élfény a 3D szikla hatásért
            // Finom belső árnyék
            ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Felső/bal oldali csúcsfény (Highlight)
            const shineAlpha = 0.1 + hash(seed + 12) * 0.2;
            ctx.fillStyle = `rgba(255, 255, 255, ${shineAlpha.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(centerX - rx * 0.2, centerY - ry * 0.2, Math.min(rx, ry) * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}