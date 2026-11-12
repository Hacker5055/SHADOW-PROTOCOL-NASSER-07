import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // The Arena live-preview proxies the app under *.e2b.app. Allow any host so the
    // preview iframe is never rejected by Vite's host check.
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' }
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000
  }
});
