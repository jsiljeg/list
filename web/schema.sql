-- Cloudflare D1 (SQLite) — reservations and the mailing list.
--
--   npx wrangler d1 create theatrium
--   npx wrangler d1 execute theatrium --file=schema.sql            (local)
--   npx wrangler d1 execute theatrium --remote --file=schema.sql   (live)
--
-- Two principles run through this:
--
--   1. Times are the restaurant's own wall clock. `date` is YYYY-MM-DD and
--      `start_min` is minutes from midnight, both local. No UTC conversion,
--      because a booking at 20:00 is at 20:00 in the room and daylight saving
--      must never be able to move it.
--
--   2. Consent is recorded, not assumed. Under the GDPR the defence is the
--      record of when and how permission was given, so every consent has its
--      own timestamp column rather than a single boolean.

CREATE TABLE IF NOT EXISTS reservations (
  id             TEXT PRIMARY KEY,          -- uuid
  created_at     TEXT NOT NULL,             -- ISO 8601 UTC, for audit only
  date           TEXT NOT NULL,             -- YYYY-MM-DD, local
  start_min      INTEGER NOT NULL,          -- minutes from midnight, local
  turn_min       INTEGER NOT NULL,          -- how long the table is held
  covers         INTEGER NOT NULL,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  note           TEXT,

  -- 'confirmed' the moment it is taken: this is a booking, not a request.
  -- 'cancelled' keeps the row so the slot history stays honest.
  status         TEXT NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('confirmed', 'cancelled', 'seated', 'noshow')),

  cancel_token   TEXT NOT NULL,             -- in the guest's email link
  consent_privacy_at  TEXT NOT NULL,        -- required to submit
  consent_marketing_at TEXT,                -- NULL = did not opt in
  locale         TEXT NOT NULL DEFAULT 'hr',
  source         TEXT NOT NULL DEFAULT 'web'
);

-- The availability query is always "everything live on this date".
CREATE INDEX IF NOT EXISTS idx_res_date ON reservations (date, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_res_cancel ON reservations (cancel_token);

-- Closures and private events. A row with no times closes the whole day.
CREATE TABLE IF NOT EXISTS blackouts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL,
  start_min  INTEGER,
  end_min    INTEGER,
  reason     TEXT
);
CREATE INDEX IF NOT EXISTS idx_blackout_date ON blackouts (date);

-- Mailing list. Double opt-in: a row is only mailable once confirmed_at is set.
CREATE TABLE IF NOT EXISTS subscribers (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  created_at     TEXT NOT NULL,
  consent_at     TEXT NOT NULL,             -- when they ticked the box
  confirm_token  TEXT,
  confirmed_at   TEXT,                      -- when they clicked the link
  unsub_token    TEXT NOT NULL,
  unsubscribed_at TEXT,
  -- Optional and only with its own purpose stated. A birthday greeting is
  -- marketing, so it needs the same consent as everything else.
  birthday       TEXT,                      -- MM-DD; no year, we do not need one
  locale         TEXT NOT NULL DEFAULT 'hr',
  source         TEXT NOT NULL DEFAULT 'web'
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_unsub ON subscribers (unsub_token);
CREATE INDEX IF NOT EXISTS idx_sub_birthday ON subscribers (birthday, confirmed_at);

-- Private events. A separate table from `reservations` on purpose: an enquiry
-- is not a booking. It has no slot, it does not consume capacity, and it is
-- answered by a person rather than by the availability rules.
CREATE TABLE IF NOT EXISTS event_enquiries (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  company      TEXT,
  kind         TEXT,               -- rodendan / poslovni / vjencanje / ostalo
  date         TEXT,               -- YYYY-MM-DD, may be empty: "sometime in May"
  guests       INTEGER,
  message      TEXT,
  status       TEXT NOT NULL DEFAULT 'new'
               CHECK (status IN ('new', 'answered', 'booked', 'lost')),
  consent_privacy_at TEXT NOT NULL,
  locale       TEXT NOT NULL DEFAULT 'hr'
);
CREATE INDEX IF NOT EXISTS idx_enq_status ON event_enquiries (status, created_at);
