import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Elemanager',
        short_name: 'Elemanager',
        description: 'Raccolta ufficiosa risultati elettorali',
        theme_color: '#0a0f1e',
        background_color: '#0a0f1e',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
});
