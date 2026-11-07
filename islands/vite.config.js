import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the homepage's React islands into ../assets/islands/ (committed, so
// GitHub Pages serves them without a build step). One small entry script,
// islands.js, loads each component's chunk only when its placeholder needs it.
export default defineConfig({
  plugins: [react()],
  base: './',
  // The components are written against React; preact/compat runs them with the
  // same hooks API for ~4 KB instead of React DOM's ~67 KB (gzip). Remove this
  // alias to build with React itself.
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom/client': 'preact/compat/client',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime'
    }
  },
  publicDir: false,
  build: {
    outDir: '../assets/islands',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        entryFileNames: 'islands.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'chunks/[name]-[hash][extname]'
      }
    }
  }
});
