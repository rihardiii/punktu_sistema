import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS } from './schema.ts';

// Both server/src/db.ts (dev) and server/dist/db.js (built) sit two levels
// below the repo root, so the family's data always lands in <repo>/data —
// never wherever the process happened to be started from. A service manager
// launching this from / must not create a second, empty database.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const DB_PATH = process.env.PUNKTI_DB
  ? resolve(process.env.PUNKTI_DB)
  : resolve(repoRoot, 'data', 'punkti.sqlite');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/** Applies any migrations the database has not seen yet. */
function migrate(): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let version = current; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version]!;
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${version + 1}`);
    })();
    console.log(`[db] applied migration ${version + 1}`);
  }
}

migrate();

export const dbPath = DB_PATH;
