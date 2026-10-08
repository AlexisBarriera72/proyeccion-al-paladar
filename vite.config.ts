import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The Worker (wrangler dev --env local, port 8787) serves the API in development;
// `npm run dev` starts both. In production the Worker serves dist/ as static assets.
// PAP_DEV_STAFF (set by scripts/dev.mjs) signs /api calls in as a local test staff member,
// through the TEST_AUTH switch that only a local Worker on loopback honors.
const devStaff = process.env.PAP_DEV_STAFF;
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {outDir: 'dist', emptyOutDir: true, sourcemap: false},
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        headers: devStaff ? {'x-test-access-email': devStaff, origin: 'http://127.0.0.1:8787'} : {},
      },
    },
  },
});
