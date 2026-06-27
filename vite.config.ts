import { defineConfig } from 'vite';

export default defineConfig({
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
