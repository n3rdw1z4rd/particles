import { CanvasRenderer } from './canvas-renderer';
import { Clock } from './clock';
import { WebGlRenderer } from './webgl-renderer';
import { GetUrlParams, UrlParameters } from './helpers';
import './css';
import { Rng } from './rng';

export class App {
    public renderer: CanvasRenderer | WebGlRenderer;
    public clock: Clock;
    public urlParams: UrlParameters;
    public rng: Rng;

    constructor(
        renderer: CanvasRenderer | WebGlRenderer,
        parentElement: HTMLElement = document.body,
    ) {
        this.renderer = renderer;
        this.renderer.appendTo(parentElement);
        this.clock = new Clock(parentElement);
        this.urlParams = GetUrlParams();
        this.rng = new Rng();
    }
}