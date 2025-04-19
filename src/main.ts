// import { StartParticleSystem } from './particles-2d';
import { StartParticleSystem } from './particles-3d';
import { GetUrlParams } from './utils/misc';

const root = document.getElementById('root')!;
const params = GetUrlParams();

StartParticleSystem(root, params);
