export const translations = {
    hu: {
        exportBtn: "Exportálás DD2VTT-be",
        fileName: "generalt_dungeon",
        title: "Dungeon Generátor",
        generateBtn: "Új Dungeon Generálása",
        brushSize:"Ecset mérete",
        room:"szoba",
        corridor:"folyósó",
        void:"semmi",
        wallsHeader:"Fal textúra"
    },
    en: {
        exportBtn: "Export to DD2VTT",
        fileName: "generated_dungeon",
        title: "Dungeon Generator",
        generateBtn: "Generate New Dungeon",
        brushSize:"Brush size",
        room:"room",
        corridor:"corridor",
        void:"void",
        wallsHeader:"Wall texture"
    }
};

// Alapértelmezett nyelv
export let currentLang = "hu";

export function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
    }
}