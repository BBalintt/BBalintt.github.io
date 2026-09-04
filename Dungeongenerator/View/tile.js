export class tile {
    constructor(id, name, color, isSelectable = true, isolatedFrom = [], isFloor = true, texture = "none") {
        this.id = Number(id);
        this.name = name;
        this.color = color;
        this.isSelectable = isSelectable;
        this.isolatedFrom = isolatedFrom.map(Number); // Mindig számként tároljuk
        this.isFloor = isFloor;
        this.texture = texture;
    }

    isIsolatedFrom(targetId) {
        return this.isolatedFrom.includes(Number(targetId));
    }
}