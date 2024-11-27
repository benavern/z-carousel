import { defineConfig } from 'vite';
import dtsPlugin from 'vite-plugin-dts';

const WebComponentFile = 'src/z-carousel.ts';

export default defineConfig({
    plugins: [
        dtsPlugin({
            insertTypesEntry: true,
            include:  [WebComponentFile]
        }),
    ],
    build: {
        outDir: 'dist',
        lib: {
            entry: 'src/z-carousel.ts',
            formats: ['es'],
        },
    },
});
