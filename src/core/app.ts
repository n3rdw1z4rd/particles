import { CanvasRenderer } from './canvas-renderer';
import { Clock } from './clock';
import { WebGlRenderer } from './webgl-renderer';
import { GetUrlParams, UrlParameters } from './helpers';
import './css';
import { Rng } from './rng';

export class App extends Clock {
    public renderer: CanvasRenderer | WebGlRenderer;
    public urlParams: UrlParameters;
    public rng: Rng;

    constructor(
        renderer?: CanvasRenderer | WebGlRenderer,
        parentElement: HTMLElement = document.body,
    ) {
        super();
        this.renderer = renderer ?? new CanvasRenderer();
        this.renderer.appendTo(parentElement);
        this.urlParams = GetUrlParams();
        this.rng = new Rng();
    }
}