import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        allowedHosts: [
            'particles.hyde144.com',
        ],
        host: true,
        port: 4000,
    },
});

