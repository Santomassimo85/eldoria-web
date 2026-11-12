// Build della DEMO delle Segrete (npm run build:demo): niente Firebase, niente sprite,
// tutto in un solo file HTML (tools/pack-demo.mjs). Il motore gira nel browser (demo/fake).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'

const r = (p) => path.resolve(p)
export default defineConfig({
  root: r('demo'),
  base: './',
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^firebase\/firestore$/, replacement: r('demo/fake/firestore.js') },
      { find: /^firebase\/functions$/, replacement: r('demo/fake/functions.js') },
      { find: /^firebase\/(app|auth|storage|messaging)$/, replacement: r('demo/fake/firebase.js') },
      { find: /^(\.\.\/)+firebase(\.js)?$/, replacement: r('demo/fake/firebase.js') },
      { find: /^\.\.\/utils\/segreteRooms(\.js)?$/, replacement: r('demo/fake/rooms.js') },
    ],
  },
  esbuild: { legalComments: 'none', drop: ['console', 'debugger'] },
  build: {
    outDir: r('dist-demo'),
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
