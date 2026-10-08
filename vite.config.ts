import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The Worker (wrangler dev --env local, port 8787) serves the API in development;
// `npm run dev` starts both. In production the Worker serves dist/ as static assets.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {outDir: 'dist', emptyOutDir: true, sourcemap: false},
  server: {
    port: 5173,
    strictPort: true,
    proxy: {'/api': 'http://127.0.0.1:8787'},
  },
});
