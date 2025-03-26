import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		allowedHosts: [
			'dev.hyde144.com',
		],
	host: true,
	port: 5173,
    },
});

