import { tile } from "../View/tile.js";
import { translations, currentLang } from "./lang.js";

const t = translations[currentLang];

// OPTIMALIZÁCIÓ: Az isolatedFrom tömbökben számokat (int) használunk stringek helyett
export let tiletypes = [
    new tile(0, t.tileNothing, "#000000", true, [1, 2], false),
    new tile(1, t.tileCorridor, "#DAA06D", true, [0], true),
    new tile(2, t.tileRoom, "#E1C16E", true, [0], true)
];

export let activeTileId = 1;

export function setActiveTileId(id) {
    activeTileId = Number(id);
}

export function createNewTileType(name, color = "#5588ff", isFloor = true) {
    const langDict = translations[currentLang];
    const defaultName = name || langDict.newTileDefaultName;
    const newId = tiletypes.length > 0 ? Math.max(...tiletypes.map(t => t.id)) + 1 : 0;
    const newTile = new tile(newId, defaultName, color, true, [0], isFloor);
    tiletypes.push(newTile);
    return newTile;
}

export function removeTileType(id) {
    if (tiletypes.length <= 1) return;
    tiletypes = tiletypes.filter(t => t.id !== id);
    if (activeTileId === id) {
        activeTileId = tiletypes[0].id;
    }
}

export function toggleIsolation(tileId, targetTileId) {
    const tileObj = tiletypes.find(t => t.id === tileId);
    if (!tileObj) return;

    const targetNum = Number(targetTileId);
    const index = tileObj.isolatedFrom.findIndex(id => Number(id) === targetNum);

    if (index > -1) {
        tileObj.isolatedFrom.splice(index, 1);
    } else {
        tileObj.isolatedFrom.push(targetNum);
    }
}