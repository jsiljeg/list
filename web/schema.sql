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

-- Daily offer (dnevna ponuda), added 2026-10-02.
--
-- One row per day, the whole offer as one JSON document. A day is edited as a
-- unit — the chef writes it in the morning, after the market, and publishes it
-- — so saving it whole is atomic for free and needs no join to read back.
-- The shape is documented in functions/_lib/daily.js (normalizeOffer).
--
-- Wines are stored as refs into the wine library (library/wines.json), never
-- as names or prices: the price is the list's, read live when the page is
-- served, and a wine that has been 86'd since breakfast simply drops out.
CREATE TABLE IF NOT EXISTS daily_offers (
  date          TEXT PRIMARY KEY,           -- YYYY-MM-DD, Zagreb wall clock
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published')),
  body          TEXT NOT NULL,              -- JSON, see normalizeOffer()
  updated_at    TEXT NOT NULL,              -- ISO 8601 UTC
  published_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_daily_status ON daily_offers (status, date);

-- Photos for the daily offer: the market in the morning, the plate at noon.
-- Stored in D1 rather than a bucket so the feature needs nothing the account
-- does not already have; the browser shrinks every photo to ~1600px WebP
-- before upload, which keeps a row far under D1's 2 MB limit. Video is a link
-- (Instagram, YouTube) on the offer, not a file here — see web/DAILY-OFFER.md.
-- `id` is a content hash, so the served URL is immutable and caches for ever.
CREATE TABLE IF NOT EXISTS media (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,                -- the offer it was uploaded for
  mime        TEXT NOT NULL,
  width       INTEGER,
  height      INTEGER,
  bytes       BLOB NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_date ON media (date);

-- Guest statistics from the wine list (/api/stat): anonymous counters only. No cookies, no IP
-- addresses, no ids, no sequences: nothing tells one guest from another. Date and hour are Zagreb
-- wall clock. The first version (guest_stats: one counter per language pick) couldn't say how deeply
-- a table read the list, so it went; it only ever held a test row.
DROP TABLE IF EXISTS guest_stats;

-- One row tick per table (a tablet resets to the language screen after three idle minutes): which
-- language they read in, on what, how many wine cards they opened (depth bucket + total), how many
-- searches, how many seconds they browsed.
CREATE TABLE IF NOT EXISTS guest_sessions (
  date      TEXT NOT NULL,
  hour      INTEGER NOT NULL,
  lang      TEXT NOT NULL,
  device    TEXT NOT NULL CHECK (device IN ('tablet', 'phone', 'desktop')),
  depth     TEXT NOT NULL CHECK (depth IN ('0', '1', '2-3', '4-7', '8+')),
  n         INTEGER NOT NULL DEFAULT 0,
  cards     INTEGER NOT NULL DEFAULT 0,
  searches  INTEGER NOT NULL DEFAULT 0,
  seconds   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, hour, lang, device, depth)
);

-- One tick per wine card opened (key = producer — wine) and its list section (kind 'section'), per
-- search term settled on ('search', or 'search-empty' when it found nothing), per feature used.
CREATE TABLE IF NOT EXISTS guest_events (
  date    TEXT NOT NULL,
  hour    INTEGER NOT NULL,
  kind    TEXT NOT NULL CHECK (kind IN ('wine', 'section', 'search', 'search-empty', 'feature')),
  key     TEXT NOT NULL,
  lang    TEXT NOT NULL,
  device  TEXT NOT NULL CHECK (device IN ('tablet', 'phone', 'desktop')),
  n       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, hour, kind, key, lang, device)
);

-- New-wine inbox ("Novo vino"), added 2026-10-10. See WINE-INTAKE.md.
--
-- Filho photographs a bottle in the wine list's /admin; a GitHub Actions run
-- writes the card with Claude on a branch; the card comes back here as a
-- preview; Filho publishes it. Photos stay here — working material, never in
-- the public repo. Status moves only along the lines in api/vina/[id]/[action].js.
CREATE TABLE IF NOT EXISTS wine_requests (
  id            TEXT PRIMARY KEY,           -- yyyymmdd-<random>
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'working', 'needs_info', 'ready',
                                  'publishing', 'published', 'failed', 'cancelled')),
  price_bottle  REAL,                       -- at least one of the two prices
  price_glass   REAL,
  vol           REAL,                       -- litres; NULL = 0,75
  recommended   INTEGER NOT NULL DEFAULT 0, -- Filho's own pick: his signed note
  remark        TEXT,                       -- his short remark, data not instructions
  runs          INTEGER NOT NULL DEFAULT 0, -- Claude runs spent on this wine
  questions     TEXT,                       -- JSON: what the run needs from Filho
  answers       TEXT,                       -- JSON: [{q, a, at}]
  result        TEXT,                       -- JSON: the card, for the preview
  branch        TEXT,
  run_url       TEXT,
  error         TEXT,
  ref           TEXT,                       -- the library ref once written
  usage         TEXT,                       -- JSON: turns, seconds, cost estimate
  published_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_wine_req_status ON wine_requests (status, updated_at);

CREATE TABLE IF NOT EXISTS wine_photos (
  request_id  TEXT NOT NULL,
  n           INTEGER NOT NULL,             -- 1, 2, 3 … in upload order
  mime        TEXT NOT NULL,
  bytes       BLOB NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (request_id, n)
);

-- Every workflow start, for the daily and monthly caps. Counted from here,
-- never from request rows, which change state.
CREATE TABLE IF NOT EXISTS wine_dispatches (
  at          TEXT NOT NULL,
  date        TEXT NOT NULL,                -- Zagreb wall clock
  request_id  TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('add', 'publish'))
);
CREATE INDEX IF NOT EXISTS idx_wine_disp_date ON wine_dispatches (date, kind);
