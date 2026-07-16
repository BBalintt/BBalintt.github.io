export class tile
{
    constructor(color, border, isolatedFrom) {
        this.color = color;
        this.border = border;
        this.isolatedFrom = isolatedFrom;
    }

    isIsolatedFrom(otherTile) {
        return this.isolatedFrom.includes(String(otherTile));
    }
}