import { defineConfig } from 'vite';

export default defineConfig({
    esbuild: {
        jsx: "transform",
        jsxDev: false,
        jsxImportSource: "@",
        jsxInject: `import { jsx } from '@/jsx-runtime'`,
        jsxFactory: "jsx.component",
        jsxFragment: "jsx.fragment",
    },
    resolve: {
        alias: {
            "@": new URL('./src', import.meta.url).pathname,
        }
    },
    server: {
        allowedHosts: [
            'particles.hyde144.com',
        ],
        host: true,
        port: 4000,
    },
});

