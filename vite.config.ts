import { defineConfig } from 'vite';
// import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    build: {
        rolldownOptions: {
            output: {
                codeSplitting: true,
            },
        },
    },
    // remove this code once we've verifyied VR works without it
    // plugins: [basicSsl()],
    // server: {
    // //     allowedHosts: [
    // //         'particles.n3rdw1z4rd.io',
    // //     ],
    // //     host: true,
    //     port: 4000,
    // },
});

