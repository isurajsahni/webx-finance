import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    // Pages load on demand; the remaining main chunk is React, router, forms and
    // data fetching (~160 kB gzipped), which every screen needs.
    build: { chunkSizeWarningLimit: 600 },
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    server: {
      port: 5173,
      // Same-origin in dev: the browser talks to Vite, Vite forwards /api to Express.
      proxy: { '/api': { target: env.VITE_API_PROXY || 'http://localhost:5050', changeOrigin: true } },
      fs: { allow: [path.resolve(import.meta.dirname, '..')] },
    },
  };
});
