import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { dbPath } from './db.ts';
import { loadUser, pruneSessions } from './auth.ts';
import { HttpError } from './validate.ts';
import { authRouter } from './routes/auth.ts';
import { usersRouter } from './routes/users.ts';
import { catalogRouter } from './routes/catalog.ts';
import { submissionsRouter } from './routes/submissions.ts';
import { redemptionsRouter } from './routes/redemptions.ts';
import { pointsRouter } from './routes/points.ts';
import { version } from './version.ts';

const PORT = Number(process.env.PORT ?? 4173);
// 0.0.0.0 by default: the whole point is that the kid's phone can reach it.
const HOST = process.env.HOST ?? '0.0.0.0';

const here = dirname(fileURLToPath(import.meta.url));
// dist/index.js -> server/ -> repo root -> web/dist
const webDist = resolve(here, '..', '..', 'web', 'dist');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(loadUser);

app.get('/api/health', (_req, res) => res.json({ ok: true, version }));
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/redemptions', redemptionsRouter);
app.use('/api/points', pointsRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// Serve the built PWA when it exists; in dev the Vite server handles this.
if (existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, maxAge: '1h' }));
  app.get(/.*/, (_req, res) => res.sendFile(join(webDist, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res
      .status(503)
      .type('text/plain')
      .send('Frontend nav uzbūvēts / frontend is not built yet.\nRun: npm run build'),
  );
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, detail: err.detail });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'server_error' });
});

/** Every LAN address the family can type into a browser. */
function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => `http://${net!.address}:${PORT}`);
}

pruneSessions();
setInterval(pruneSessions, 6 * 60 * 60 * 1000).unref();

app.listen(PORT, HOST, () => {
  console.log(`\n  Punktu sistēma v${version}`);
  console.log(`  Datubāze / database: ${dbPath}`);
  console.log(`  Lokāli / local:      http://localhost:${PORT}`);
  for (const address of lanAddresses()) {
    console.log(`  Tīklā / on the LAN:  ${address}`);
  }
  console.log('');
});
