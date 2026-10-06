import { defineConfig } from 'vite';
import { smoke } from '@n3rdw1z4rd/smoke-ui/vite-plugin';

export default defineConfig({
    plugins: [smoke()],
    build: {
        rolldownOptions: {
            output: {
                codeSplitting: true,
            },
        },
    },
    server: {
        host: true,
        allowedHosts: ['dev.n3rdw1z4rd.io'],
    },
});
