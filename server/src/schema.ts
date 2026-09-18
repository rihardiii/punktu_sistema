/**
 * Datubāzes shēma / Database schema.
 *
 * Migrations are applied in order and tracked by `user_version`. To change the
 * schema, append a new entry — never edit an existing one, or already-deployed
 * family databases will drift.
 */

export const MIGRATIONS: string[] = [
  // --- v1: initial schema -------------------------------------------------
  `
  CREATE TABLE users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    name        TEXT    NOT NULL,
    role        TEXT    NOT NULL CHECK (role IN ('parent', 'kid')),
    pin_hash    TEXT    NOT NULL,
    pin_salt    TEXT    NOT NULL,
    avatar      TEXT    NOT NULL DEFAULT '🙂',
    color       TEXT    NOT NULL DEFAULT '#6C8EF5',
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE sessions (
    token       TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT    NOT NULL
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  -- Labo darbu katalogs / catalog of good deeds parents can offer.
  CREATE TABLE deeds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title_lv    TEXT    NOT NULL,
    title_en    TEXT    NOT NULL DEFAULT '',
    icon        TEXT    NOT NULL DEFAULT '',
    points      INTEGER NOT NULL CHECK (points > 0),
    category    TEXT    NOT NULL DEFAULT '',
    active      INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
  );

  -- Balvu katalogs / what points can be exchanged for.
  CREATE TABLE rewards (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title_lv       TEXT    NOT NULL,
    title_en       TEXT    NOT NULL DEFAULT '',
    icon           TEXT    NOT NULL DEFAULT '',
    cost           INTEGER NOT NULL CHECK (cost > 0),
    description_lv TEXT    NOT NULL DEFAULT '',
    description_en TEXT    NOT NULL DEFAULT '',
    active         INTEGER NOT NULL DEFAULT 1,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL
  );

  -- Kid claims a deed was done; a parent approves or rejects it.
  -- Title/icon/points are snapshotted so later catalog edits never rewrite history.
  CREATE TABLE submissions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deed_id      INTEGER REFERENCES deeds(id) ON DELETE SET NULL,
    deed_title   TEXT    NOT NULL,
    deed_icon    TEXT    NOT NULL DEFAULT '',
    points       INTEGER NOT NULL,
    note         TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected')),
    done_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    reviewed_at  TEXT,
    reviewed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    review_note  TEXT    NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_submissions_kid ON submissions(kid_id, status);
  CREATE INDEX idx_submissions_status ON submissions(status, created_at);

  -- Kid asks to spend points; a parent approves or rejects it.
  CREATE TABLE redemptions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id    INTEGER REFERENCES rewards(id) ON DELETE SET NULL,
    reward_title TEXT    NOT NULL,
    reward_icon  TEXT    NOT NULL DEFAULT '',
    cost         INTEGER NOT NULL,
    note         TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    reviewed_at  TEXT,
    reviewed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    review_note  TEXT    NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_redemptions_kid ON redemptions(kid_id, status);
  CREATE INDEX idx_redemptions_status ON redemptions(status, created_at);

  -- Append-only point ledger. A kid's balance is SUM(delta) — never a stored
  -- counter, so balances can always be recomputed and audited.
  CREATE TABLE ledger (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta      INTEGER NOT NULL,
    reason     TEXT    NOT NULL DEFAULT '',
    ref_type   TEXT    NOT NULL CHECK (ref_type IN ('submission', 'redemption', 'adjustment')),
    ref_id     INTEGER,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE INDEX idx_ledger_kid ON ledger(kid_id, created_at);
  CREATE UNIQUE INDEX idx_ledger_ref ON ledger(ref_type, ref_id) WHERE ref_id IS NOT NULL;
  `,

  // --- v2: admin flag and PIN reset requests ------------------------------
  `
  -- Admin is a flag on a parent, not a third role, so every existing
  -- role === 'parent' check keeps working untouched. Exactly one user carries
  -- it: the person who set the app up, and whoever they later hand it to.
  ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

  -- Existing databases predate the flag: the first parent ever created is the
  -- one who ran setup, so they inherit it.
  UPDATE users SET is_admin = 1
   WHERE id = (SELECT id FROM users WHERE role = 'parent' ORDER BY id LIMIT 1);

  -- "I forgot my PIN" — filed from the login screen by someone who by
  -- definition cannot log in, so this table is written without a session.
  -- A kid's request is handled by any parent; a parent's only by the admin.
  CREATE TABLE pin_requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'resolved', 'dismissed')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE INDEX idx_pin_requests_status ON pin_requests(status, created_at);

  -- One open request per person. Without this, tapping "forgot my PIN" ten
  -- times would put ten identical rows in front of a parent.
  CREATE UNIQUE INDEX idx_pin_requests_open ON pin_requests(user_id)
    WHERE status = 'pending';
  `,

  // --- v3: when a deed may be done, and how often -------------------------
  `
  -- 0 means "as often as you like", which is how every existing deed behaves,
  -- so the default silently keeps the whole catalog working as before.
  ALTER TABLE deeds ADD COLUMN max_per_day INTEGER NOT NULL DEFAULT 0;

  -- Times of day a deed may be filed in. A deed with no rows here is available
  -- around the clock. Several rows are the point rather than a nicety: "brush
  -- your teeth, morning and evening" is two disjoint windows, which a single
  -- from/to pair on the deed itself could never express.
  --
  -- Minutes since local midnight, both ends inclusive, so 420–600 reads as
  -- "07:00 to 10:00" — exactly what the parent typed.
  CREATE TABLE deed_windows (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    deed_id   INTEGER NOT NULL REFERENCES deeds(id) ON DELETE CASCADE,
    start_min INTEGER NOT NULL CHECK (start_min >= 0 AND start_min <= 1439),
    end_min   INTEGER NOT NULL CHECK (end_min   >= 0 AND end_min   <= 1439),
    CHECK (end_min > start_min)
  );
  CREATE INDEX idx_deed_windows_deed ON deed_windows(deed_id, start_min);

  -- "How many times today" is counted per kid per deed on every catalog load,
  -- so give that count an index of its own.
  CREATE INDEX idx_submissions_kid_deed ON submissions(kid_id, deed_id, created_at);
  `,
];
