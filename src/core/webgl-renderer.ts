import { Color } from './color';
import { clamp } from './math';

export class WebGlRenderer {
    private _canvas: HTMLCanvasElement;
    public gl: WebGL2RenderingContext | WebGLRenderingContext;

    private _program: WebGLProgram;
    private _positionLocation: number;
    private _textureLocation: WebGLUniformLocation;
    private _pixelBuffer: Uint8Array;
    private _texture: WebGLTexture;
    private _surface: WebGLBuffer;

    public pixelRatio: number = window.devicePixelRatio;

    public get width(): number { return this._canvas.width; }
    public get height(): number { return this._canvas.height; }

    constructor(canvas?: HTMLCanvasElement) {
        this._canvas = canvas ?? document.createElement('canvas');

        this.gl = (this._canvas.getContext('webgl2') ?? this._canvas.getContext('webgl'))!;

        this._program = this.gl.createProgram()!;

        const vertShader: WebGLShader = this.gl.createShader(this.gl.VERTEX_SHADER)!;
        this.gl.shaderSource(vertShader, `
            attribute vec2 a_position;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position.x, -a_position.y, 0.0, 1.0);
                v_texCoord = a_position * 0.5 + 0.5;
            }
        `);

        this.gl.compileShader(vertShader);
        this.gl.attachShader(this._program, vertShader);

        const fragShader: WebGLShader = this.gl.createShader(this.gl.FRAGMENT_SHADER)!;
        this.gl.shaderSource(fragShader, `
            precision mediump float;
            uniform sampler2D u_texture;
            varying vec2 v_texCoord;
            void main() {
                gl_FragColor = texture2D(u_texture, v_texCoord);
            }
        `);

        this.gl.compileShader(fragShader);
        this.gl.attachShader(this._program, fragShader);

        this.gl.linkProgram(this._program);
        this.gl.useProgram(this._program);

        this._positionLocation = this.gl.getAttribLocation(this._program, 'a_position');
        this._textureLocation = this.gl.getUniformLocation(this._program, 'u_texture')!;

        this._pixelBuffer = new Uint8Array(this._canvas.width * this._canvas.height * 4);

        this._texture = this.gl.createTexture()!;
        this._bindTexture();

        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

        this._surface = this.gl.createBuffer()!;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._surface);
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
            this.gl.STATIC_DRAW
        );

        this.gl.enableVertexAttribArray(this._positionLocation);
        this.gl.vertexAttribPointer(this._positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this._texture);
        this.gl.uniform1i(this._textureLocation, 0);
    }

    private _bindTexture(): void {
        this.gl.bindTexture(this.gl.TEXTURE_2D, this._texture);

        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA,
            this._canvas.width,
            this._canvas.height,
            0,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            this._pixelBuffer
        );
    }

    appendTo(target: HTMLElement, autoResize: boolean = true): void {
        if (this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }

        target.appendChild(this._canvas);

        if (autoResize) {
            this.resize();
        }
    }

    resize(displayWidth?: number, displayHeight?: number): boolean {
        const { width, height } = (
            this._canvas.parentElement?.getBoundingClientRect() ??
            this._canvas.getBoundingClientRect()
        );

        displayWidth = (0 | (displayWidth ?? width) * this.pixelRatio);
        displayHeight = (0 | (displayHeight ?? height) * this.pixelRatio);

        if (this._canvas.width !== displayWidth || this._canvas.height !== displayHeight) {
            this._canvas.width = displayWidth
            this._canvas.height = displayHeight;

            this.gl.viewport(0, 0, displayWidth, displayHeight);
            this._pixelBuffer = new Uint8Array(displayWidth * displayHeight * 4);
            this._bindTexture();

            return true;
        }

        return false;
    }

    private _setPixel(x: number, y: number, color: Color): void {
        const offset: number = ((y * this._canvas.width + x) * 4);

        this._pixelBuffer[offset] = color.r;
        this._pixelBuffer[offset + 1] = color.g;
        this._pixelBuffer[offset + 2] = color.b;
        this._pixelBuffer[offset + 3] = color.a;
    }

    setPixel(x: number, y: number, color: Color, size: number = 2): void {
        x = (0 | clamp(x, 0, this._canvas.width - size));
        y = (0 | clamp(y, 0, this._canvas.height - size));

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                this._setPixel(x + i, y + j, color);
            }
        }
    }

    render(): void {
        this._bindTexture();
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        this._pixelBuffer.fill(0);
    }
}