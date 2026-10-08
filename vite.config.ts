import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        chunkSizeWarningLimit: 1000,
    },
    server: {
        host: true,
        allowedHosts: ['dev.n3rdw1z4rd.io'],
    },
});
