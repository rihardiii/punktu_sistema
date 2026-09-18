/**
 * Lietotnes versija / the app version.
 *
 * **Maina to tikai vienā vietā: saknes `package.json`.** Viss pārējais — šis
 * fails, lietotnes ekrāns "Par lietotni", `/api/health` un Docker attēla tags —
 * to nolasa no turienes. Līdz 0.12 tas pats skaitlis bija ierakstīts deviņās
 * vietās, un agrāk vai vēlāk kāda no tām palika aizmirsta.
 *
 * The app version is edited in exactly one place: the root `package.json`.
 * Everything else reads it from there.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// server/src/version.ts (dev) and server/dist/version.js (built) both sit two
// levels below the repo root, and the Docker runtime image copies package.json
// to /app/package.json — the same place relative to /app/server/dist. So this
// one path resolves in all three situations.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Projekta shēma ir `0.01`, `0.02`, … un `package.json` to glabā semver formātā
 * (`0.12` → `0.12.0`), tāpēc ceļš atpakaļ ir mazākās daļas papildināšana ar nulli:
 * `0.9.0` → `0.09`, `0.12.0` → `0.12`.
 *
 * Šī pati pārveide ir arī `web/vite.config.ts` — pārlūka pusē versija tiek
 * iešūta būvējot, nevis lasīta no faila. Ka abas atbild vienu un to pašu,
 * pārbauda `web/test/ui.mjs`.
 *
 * Patch daļa shēmā neeksistē, bet, ja tā kādreiz tiek uzlikta, tā tiek parādīta,
 * nevis klusi nomesta.
 */
export function toDisplayVersion(semver: string): string {
  const [major = '0', minor = '0', patch = '0'] = semver.split('.');
  const base = `${major}.${minor.padStart(2, '0')}`;
  return patch === '0' ? base : `${base}.${patch}`;
}

function readSemver(): string {
  try {
    const raw = readFileSync(resolve(repoRoot, 'package.json'), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0';
  } catch {
    // A missing or unreadable manifest must not stop the family's server from
    // starting — the version is a label, not a dependency.
    return '0.0.0';
  }
}

/** Semver, kā to glabā package.json: "0.12.0". */
export const semver = readSemver();

/** Projekta shēmā, kā to rāda lietotne: "0.12". */
export const version = toDisplayVersion(semver);
