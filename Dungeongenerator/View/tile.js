export class tile
{
    constructor(color, border, isolatedFrom) {
        this.color = color;
        this.border = border;
        this.isolatedFrom = isolatedFrom;
        this.texture =0;
    }

    isIsolatedFrom(otherTile) {
        return this.isolatedFrom.includes(String(otherTile));
    }
}