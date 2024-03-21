export class StatsDiv {
    public divElement: HTMLDivElement;

    public keyColor: string = 'gray';
    public valueColor: string = 'lightgray';

    constructor() {
        this.divElement = document.createElement('div');
        this.divElement.style.setProperty('position', 'absolute');
        this.divElement.style.setProperty('top', '4px');
        this.divElement.style.setProperty('right', '4px');
    }

    appendTo(target: HTMLElement): void {
        if (this.divElement.parentNode) {
            this.divElement.parentNode.removeChild(this.divElement);
        }

        target.appendChild(this.divElement);
    }

    update(data: object): void {
        this.divElement.innerHTML = Object.entries(data).map(([key, value]) =>
            `<span style="color: ${this.keyColor};">${key}:</span>&nbsp;<span style="color: ${this.valueColor};">${value}</span>`
        ).join('<br/>');
    }
}