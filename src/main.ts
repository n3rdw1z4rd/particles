import { GetUrlParams } from './utils/misc';
// import { StartParticleSystem } from './particles-og';
import { StartParticleSystem } from './particles-3d';

const root = document.getElementById('root')!;
const params = GetUrlParams();

StartParticleSystem(root, params);
