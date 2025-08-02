import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [basicSsl()],
    server: {
        allowedHosts: [
            'particles.hyde144.com',
        ],
        host: true,
        port: 4000,
    },
});

