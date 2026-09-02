export const translations = {
    hu: {
        exportBtn: "Exportálás DD2VTT-be",
        fileName: "generalt_dungeon",
        title: "Dungeon Generátor",
        generateBtn: "Új Dungeon Generálása",
        brushSize: "Ecset mérete",
        room: "szoba",
        corridor: "folyósó",
        void: "semmi",
        wallsHeader: "Fal textúra",
        // Új textúra és UI kulcsok
        roomTexture: "Szobák textúrája",
        corridorTexture: "Folyosók textúrája",
        voidTexture: "Void / Háttér textúrája",
        textureNone: "Nincs (Tömör szín)",
        textureStone: "Kőpadló",
        textureWood: "Fapadló",
        textureCobblestone: "Sziklás / Kockakő",
        languageLabel: "Nyelv"
    },
    en: {
        exportBtn: "Export to DD2VTT",
        fileName: "generated_dungeon",
        title: "Dungeon Generator",
        generateBtn: "Generate New Dungeon",
        brushSize: "Brush size",
        room: "room",
        corridor: "corridor",
        void: "void",
        wallsHeader: "Wall texture",
        // New texture & UI keys
        roomTexture: "Room texture",
        corridorTexture: "Corridor texture",
        voidTexture: "Void / Background texture",
        textureNone: "None (Solid Color)",
        textureStone: "Stone Floor",
        textureWood: "Wood Floor",
        textureCobblestone: "Cobblestone / Rocky",
        languageLabel: "Language"
    }
};

export let currentLang = "hu";

export function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        applyTranslations();
    }
}

// Végigmegy a HTML-ben lévő data-i18n attribútumokon és átírja a szövegeket
export function applyTranslations() {
    const dict = translations[currentLang];
    if (!dict) return;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (dict[key]) {
            // Ha gomb vagy beviteli mező placeholder-e, vagy sima elem szövege
            if (el.tagName === "INPUT" && el.type === "button") {
                el.value = dict[key];
            } else {
                el.textContent = dict[key];
            }
        }
    });
}