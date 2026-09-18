import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:4173';

/*
 * Versija nāk no saknes package.json — vienīgās vietas, kur to maina — un tiek
 * iešūta paketē būvējot. Fails tiek lasīts šeit, nevis importēts no kopīga
 * moduļa, apzināti: Vite konfigurāciju sabūvē pagaidu failā, un importētam
 * modulim `import.meta.url` var tikt pārrakstīts uz konfigurācijas atrašanās
 * vietu, kas klusi salauztu no tā atkarīgu ceļu.
 *
 * Tāpēc `toDisplayVersion` ir divās vietās: šeit un server/src/version.ts.
 * Ka abas atbild vienu un to pašu, pārbauda web/test/ui.mjs.
 */
const semver = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version?: string;
  }
).version;

function toDisplayVersion(value: string): string {
  const [major = '0', minor = '0', patch = '0'] = value.split('.');
  const base = `${major}.${minor.padStart(2, '0')}`;
  return patch === '0' ? base : `${base}.${patch}`;
}

const APP_VERSION = toDisplayVersion(semver ?? '0.0.0');

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Punktu sistēma',
        short_name: 'Punkti',
        description: 'Ģimenes punktu sistēma par labiem darbiem',
        lang: 'lv',
        theme_color: '#6C8EF5',
        background_color: '#0F1420',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The API is never cached: a stale points balance would be worse than
        // no balance at all. Only the app shell is served offline.
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': { target: API_TARGET, changeOrigin: true } },
  },
  // No sourcemaps in the shipped bundle: they added ~1.7 MB to every image and
  // to every phone's precache, and the source they map back to is a public
  // repo anyway. Flip to true when you need to debug a production build.
  build: { outDir: 'dist', sourcemap: false },
});
