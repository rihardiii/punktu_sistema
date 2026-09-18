/**
 * Versija nāk no saknes `package.json` — vienīgās vietas, kur to maina. Vite to
 * nolasa būvējot un iešuj paketē (`define` iekš `vite.config.ts`), tāpēc šeit
 * nav ko uzturēt un nekas nevar novecot.
 *
 * The version comes from the root `package.json`, the only place it is edited.
 * Vite reads it at build time and inlines it here.
 */

declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;
