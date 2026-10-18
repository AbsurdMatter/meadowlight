import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // deploy/embed readiness: relative asset base so dist/ works at any
  // subpath, on any host, and in file:// contexts
  base: './',
  build: {
    // three.js core is ~690 kB minified even fully tree-shaken; splitting it
    // further would only hurt long-term caching. Perf thresholds (fps, heap)
    // live in scripts/perf-test.mjs and remain strict.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
          fiber: ['@react-three/fiber', 'zustand'],
        },
      },
    },
  },
});
