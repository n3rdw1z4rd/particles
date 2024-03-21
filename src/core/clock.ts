import { StatsDiv } from './stats-div';

export class Clock {
    private _lastFrameTime: number = 0;
    private _daltaTimeMilliseconds: number = 0;
    private _deltaTimeSeconds: number = 0;
    private _avgDeltaTime: number = 0;
    private _frameCount: number = 0;
    private _frameTime: number = 0;
    private _fps: number = 0;
    private _isRunning: boolean = false;
    private _updateCallback: (deltaTime: number) => void = () => { };
    private _statsDiv: StatsDiv | undefined;

    get fps(): number { return this._fps; }
    get deltaTimeSeconds(): number { return this._deltaTimeSeconds; }
    get deltaTimeMilliseconds(): number { return this._daltaTimeMilliseconds; }
    get avgDeltaTime(): number { return this._avgDeltaTime; }
    get time(): number { return this._lastFrameTime; }

    private _update(time: number) {
        this.update(time);

        this._updateCallback(this._deltaTimeSeconds);

        if (this._isRunning) {
            requestAnimationFrame(this._update.bind(this));
        }
    }

    public update(time: number) {
        this._daltaTimeMilliseconds = time - this._lastFrameTime;
        this._deltaTimeSeconds = this._daltaTimeMilliseconds / 1000;
        this._lastFrameTime = time;

        if (this._frameTime + 1000 >= time) {
            this._frameCount += 1;
        } else {
            this._frameTime = time;
            this._fps = this._frameCount;
            this._frameCount = 0;
        }

        this._avgDeltaTime = (this._avgDeltaTime * this._frameCount + this._daltaTimeMilliseconds) / (this._frameCount + 1);
    }

    public run(callback: (deltaTime: number) => void) {
        if (!this._isRunning) {
            this._isRunning = true;
            this._updateCallback = callback;
            requestAnimationFrame(this._update.bind(this));
        }
    }

    public runOnce(callback: (deltaTime: number) => void) {
        this._isRunning = false;
        this._updateCallback = callback;
        this._update(0);
    }

    public stop() {
        this._isRunning = false;
    }

    public getExecuteTime(func: () => void): number {
        const now: number = performance.now();
        func();
        return performance.now() - now;
    }

    public showStats(data: object = {}) {
        if (!this._statsDiv) {
            this._statsDiv = new StatsDiv();
            this._statsDiv.appendTo(document.body);
        }

        this._statsDiv.update({
            fps: this._fps,
            'deltaTime(s)': `${this._deltaTimeSeconds.toFixed(3)}`,
            'avgDeltaTime(ms)': `${this._avgDeltaTime.toFixed(3)}`,
            ...data,
        });
    }
}