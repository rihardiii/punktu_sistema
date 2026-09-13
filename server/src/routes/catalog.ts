import { Router } from 'express';
import { db } from '../db.ts';
import { requireParent, requireUser } from '../auth.ts';
import { HttpError, bool, id, int, optStr, str } from '../validate.ts';

export const catalogRouter = Router();

// --- Labie darbi / deeds ----------------------------------------------------

/** Kids only ever see active deeds; parents see the full catalog to manage it. */
catalogRouter.get('/deeds', requireUser, (req, res) => {
  const all = req.user!.role === 'parent' && req.query.all === 'true';
  const rows = db
    .prepare(
      `SELECT * FROM deeds ${all ? '' : 'WHERE active = 1'}
       ORDER BY sort_order, title_lv COLLATE NOCASE`,
    )
    .all();
  res.json({ deeds: rows });
});

catalogRouter.post('/deeds', requireParent, (req, res) => {
  const info = db
    .prepare(
      `INSERT INTO deeds (title_lv, title_en, icon, points, category, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      str(req.body?.title_lv, 'title_lv', { max: 80 }),
      optStr(req.body?.title_en, 'title_en', 80),
      optStr(req.body?.icon, 'icon', 8),
      int(req.body?.points, 'points', { min: 1, max: 10_000 }),
      optStr(req.body?.category, 'category', 40),
      int(req.body?.sort_order ?? 0, 'sort_order', { min: 0, max: 10_000 }),
      req.user!.id,
    );
  res.status(201).json({ deed: db.prepare('SELECT * FROM deeds WHERE id = ?').get(info.lastInsertRowid) });
});

catalogRouter.patch('/deeds/:id', requireParent, (req, res) => {
  const deedId = id(req.params.id, 'id');
  const row = db.prepare('SELECT * FROM deeds WHERE id = ?').get(deedId) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new HttpError(404, 'not_found');

  db.prepare(
    `UPDATE deeds SET title_lv = ?, title_en = ?, icon = ?, points = ?, category = ?,
            active = ?, sort_order = ? WHERE id = ?`,
  ).run(
    req.body?.title_lv === undefined ? row.title_lv : str(req.body.title_lv, 'title_lv', { max: 80 }),
    req.body?.title_en === undefined ? row.title_en : optStr(req.body.title_en, 'title_en', 80),
    req.body?.icon === undefined ? row.icon : optStr(req.body.icon, 'icon', 8),
    req.body?.points === undefined ? row.points : int(req.body.points, 'points', { min: 1, max: 10_000 }),
    req.body?.category === undefined ? row.category : optStr(req.body.category, 'category', 40),
    bool(req.body?.active, row.active === 1) ? 1 : 0,
    req.body?.sort_order === undefined
      ? row.sort_order
      : int(req.body.sort_order, 'sort_order', { min: 0, max: 10_000 }),
    deedId,
  );
  res.json({ deed: db.prepare('SELECT * FROM deeds WHERE id = ?').get(deedId) });
});

/**
 * Deletes a deed from the catalog. Past submissions keep their snapshotted
 * title, icon and points, so history and balances are untouched.
 */
catalogRouter.delete('/deeds/:id', requireParent, (req, res) => {
  const deedId = id(req.params.id, 'id');
  const info = db.prepare('DELETE FROM deeds WHERE id = ?').run(deedId);
  if (info.changes === 0) throw new HttpError(404, 'not_found');
  res.json({ ok: true });
});

// --- Balvas / rewards -------------------------------------------------------

catalogRouter.get('/rewards', requireUser, (req, res) => {
  const all = req.user!.role === 'parent' && req.query.all === 'true';
  const rows = db
    .prepare(
      `SELECT * FROM rewards ${all ? '' : 'WHERE active = 1'}
       ORDER BY sort_order, cost`,
    )
    .all();
  res.json({ rewards: rows });
});

catalogRouter.post('/rewards', requireParent, (req, res) => {
  const info = db
    .prepare(
      `INSERT INTO rewards (title_lv, title_en, icon, cost, description_lv, description_en,
                            sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      str(req.body?.title_lv, 'title_lv', { max: 80 }),
      optStr(req.body?.title_en, 'title_en', 80),
      optStr(req.body?.icon, 'icon', 8),
      int(req.body?.cost, 'cost', { min: 1, max: 1_000_000 }),
      optStr(req.body?.description_lv, 'description_lv', 300),
      optStr(req.body?.description_en, 'description_en', 300),
      int(req.body?.sort_order ?? 0, 'sort_order', { min: 0, max: 10_000 }),
      req.user!.id,
    );
  res
    .status(201)
    .json({ reward: db.prepare('SELECT * FROM rewards WHERE id = ?').get(info.lastInsertRowid) });
});

catalogRouter.patch('/rewards/:id', requireParent, (req, res) => {
  const rewardId = id(req.params.id, 'id');
  const row = db.prepare('SELECT * FROM rewards WHERE id = ?').get(rewardId) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new HttpError(404, 'not_found');

  db.prepare(
    `UPDATE rewards SET title_lv = ?, title_en = ?, icon = ?, cost = ?, description_lv = ?,
            description_en = ?, active = ?, sort_order = ? WHERE id = ?`,
  ).run(
    req.body?.title_lv === undefined ? row.title_lv : str(req.body.title_lv, 'title_lv', { max: 80 }),
    req.body?.title_en === undefined ? row.title_en : optStr(req.body.title_en, 'title_en', 80),
    req.body?.icon === undefined ? row.icon : optStr(req.body.icon, 'icon', 8),
    req.body?.cost === undefined ? row.cost : int(req.body.cost, 'cost', { min: 1, max: 1_000_000 }),
    req.body?.description_lv === undefined
      ? row.description_lv
      : optStr(req.body.description_lv, 'description_lv', 300),
    req.body?.description_en === undefined
      ? row.description_en
      : optStr(req.body.description_en, 'description_en', 300),
    bool(req.body?.active, row.active === 1) ? 1 : 0,
    req.body?.sort_order === undefined
      ? row.sort_order
      : int(req.body.sort_order, 'sort_order', { min: 0, max: 10_000 }),
    rewardId,
  );
  res.json({ reward: db.prepare('SELECT * FROM rewards WHERE id = ?').get(rewardId) });
});

catalogRouter.delete('/rewards/:id', requireParent, (req, res) => {
  const rewardId = id(req.params.id, 'id');
  const info = db.prepare('DELETE FROM rewards WHERE id = ?').run(rewardId);
  if (info.changes === 0) throw new HttpError(404, 'not_found');
  res.json({ ok: true });
});
