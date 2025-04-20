import { GetUrlParams } from './utils/misc';
import { StartParticleSystem2d } from './particles-2d';
import { StartParticleSystem3d } from './particles-3d';
import { log } from './utils/logger';
import { rng } from './utils/rng';

const root = document.getElementById('root')!;
const params = GetUrlParams();

params.t = params.t ?? '2d';

if (params.seed) rng.seed = parseInt(params.seed);

log('params:', params);

if (params.t === '3d') {
    log('*** particles-3d ***');
    StartParticleSystem3d(root);
} else {
    log('*** particles-2d ***');
    StartParticleSystem2d(root);
}

const buttonContainer = document.createElement('div');
buttonContainer.id = 'button-container';
root.append(buttonContainer);

const setButton = document.createElement('button');
setButton.innerText = 'set';
setButton.addEventListener('click', (ev: MouseEvent) => {
    if (ev.button === 0) {
        const url = new URL(location.href);
        url.searchParams.set('t', params.t);
        url.searchParams.set('seed', String(rng.startingSeed));
        location.href = url.href;
    }
});

buttonContainer.append(setButton);

const resetButton = document.createElement('button');
resetButton.innerText = 'reset';
resetButton.addEventListener('click', (ev: MouseEvent) => {
    if (ev.button === 0) {
        const url = new URL(location.href);
        url.searchParams.set('t', params.t);
        url.searchParams.delete('seed');
        location.href = url.href;
    }
});

buttonContainer.append(resetButton);

const toggleButton = document.createElement('button');
toggleButton.innerText = '2d/3d';
toggleButton.addEventListener('click', (ev: MouseEvent) => {
    if (ev.button === 0) {
        params.t = (params.t === '2d') ? '3d' : '2d';

        const url = new URL(location.href);
        url.searchParams.set('t', params.t);
        url.searchParams.set('seed', String(rng.startingSeed));
        location.href = url.href;
    }
});

buttonContainer.append(toggleButton);
