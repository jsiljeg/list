/* Reservation logic — pure, no database, no network.

   Everything that decides whether a table can be offered lives here so it can
   be reasoned about and tested without a D1 binding. The endpoints do I/O and
   call into this; they make no decisions of their own.

   THE MODEL: covers-based pacing with turn times, not table assignment.

   That is a deliberate choice and worth stating, because "real reservations"
   can mean either. Assigning specific tables means modelling table sizes,
   combining two-tops into a four, splitting them back, and deciding which
   party goes where — and getting it wrong strands a party at the door on a
   Saturday. Pacing asks two simpler questions that produce the same guest
   experience (instant confirmation, capacity respected):

     1. How many covers are in the room at once?   -> CAPACITY
     2. How many arrive in the same 15 minutes?    -> PACING

   The second is the one restaurants actually get wrong. A kitchen that can
   serve 40 covers across an evening cannot serve 20 that walk in together.

   Times are the restaurant's own wall clock (Europe/Zagreb). Nothing here
   converts to UTC: a booking at 20:00 is at 20:00 in the room, and storing
   local time removes a whole class of daylight-saving bugs. */

export const TZ = "Europe/Zagreb";

/* 0 = Sunday, matching Date#getDay. Empty array = closed.
 *
 * Taken from the Google Business Profile on 2026-09-07: Mon-Sat 12:00-23:00
 * continuous, Sunday closed. NOT the split lunch/dinner service I first
 * guessed — the room runs straight through.
 *
 * TWO THINGS TO CONFIRM WITH THE OWNER, because Google cannot answer them:
 *   - 23:00 is when the *door* closes. If the kitchen stops earlier, the last
 *     seating must come off the kitchen time, not the door time.
 *   - A 90-minute turn against a 23:00 close puts the last bookable table at
 *     21:30, and a party of five at 20:45. If that feels late or early, it is
 *     the turn times below that need changing, not this. */
export const SERVICE = {
  0: [],
  1: [{ from: "12:00", to: "23:00" }],
  2: [{ from: "12:00", to: "23:00" }],
  3: [{ from: "12:00", to: "23:00" }],
  4: [{ from: "12:00", to: "23:00" }],
  5: [{ from: "12:00", to: "23:00" }],
  6: [{ from: "12:00", to: "23:00" }],
};

export const CONFIG = {
  slotMinutes: 15,
  /* How long a table is held. Bigger parties eat longer — this is the single
     number most worth tuning once there is real data. */
  turnMinutes: (covers) => (covers <= 2 ? 90 : covers <= 4 ? 105 : 135),
  /* Seats in the room available to online booking. Keep this BELOW the true
     capacity so walk-ins and the phone still have somewhere to go. */
  capacity: 34,
  /* Covers allowed to start within one slot, so arrivals do not bunch. */
  pacing: 8,
  /* The latest table offered, regardless of when the door shuts. This is how
     SevenRooms is configured for the restaurant today (last booking 22:00) and
     it is a different rule from the one I first built: I derived the last slot
     from the turn time against closing, which pushed a party of five back to
     20:45. A room will happily seat you at 22:00 and let you sit past close.
     The turn still governs how long the table counts against capacity. */
  lastSeating: "22:00",
  minParty: 1,
  maxParty: 8,
  /* Above maxParty we ask them to call — a private-event conversation, not a
     form. */
  leadMinutes: 120,
  horizonDays: 60,
};

export const hhmm = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const toMin = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
};

/** YYYY-MM-DD -> weekday index, without constructing a local Date. */
export function weekday(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Today and now in the restaurant's timezone, as { date, minutes }. */
export function nowInZagreb(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(at).reduce((o, p) => (o[p.type] = p.value, o), {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: +parts.hour * 60 + +parts.minute,
  };
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Every slot the kitchen would in principle seat on this date. */
export function candidateSlots(dateStr, covers) {
  const out = [];
  const last = toMin(CONFIG.lastSeating);
  for (const period of SERVICE[weekday(dateStr)] || []) {
    const from = toMin(period.from), to = toMin(period.to);
    /* Bounded by the last-seating rule, and never past the door closing —
       whichever comes first. Not by turn time: the restaurant decides when it
       stops seating, not the arithmetic. */
    const cap = Math.min(to, last);
    for (let t = from; t <= cap; t += CONFIG.slotMinutes) out.push(t);
  }
  return out;
}

/**
 * Which slots can still take `covers`, given what is already booked.
 *
 * `booked` is [{ start, covers, turn }] for that date, already filtered to
 * live reservations. Pure: the caller does the query.
 */
export function availableSlots({ date, covers, booked = [], blackouts = [], now = nowInZagreb() }) {
  if (!isValidDate(date)) return [];
  if (covers < CONFIG.minParty || covers > CONFIG.maxParty) return [];
  if (date < now.date || date > addDays(now.date, CONFIG.horizonDays)) return [];

  const turn = CONFIG.turnMinutes(covers);
  const earliest = date === now.date ? now.minutes + CONFIG.leadMinutes : -Infinity;

  return candidateSlots(date, covers).filter((start) => {
    if (start < earliest) return false;

    const end = start + turn;
    if (blackouts.some((b) => start < (b.end ?? 1440) && end > (b.start ?? 0))) return false;

    let concurrent = covers, starting = covers;
    for (const r of booked) {
      if (r.start < end && r.start + r.turn > start) concurrent += r.covers;
      if (r.start === start) starting += r.covers;
    }
    return concurrent <= CONFIG.capacity && starting <= CONFIG.pacing;
  }).map((start) => ({ start, time: hhmm(start), turn }));
}

/** Validation shared by the endpoint and the form. Returns [] when clean. */
export function validate({ date, time, covers, name, email, consentPrivacy }) {
  const errors = [];
  if (!isValidDate(date)) errors.push("date");
  if (toMin(time) === null) errors.push("time");
  if (!Number.isInteger(covers) || covers < CONFIG.minParty || covers > CONFIG.maxParty) errors.push("covers");
  if (!name || String(name).trim().length < 2) errors.push("name");
  /* Deliberately loose. Strict email regexes reject valid addresses and the
     confirmation mail is the real check. */
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim())) errors.push("email");
  if (!consentPrivacy) errors.push("consent");
  return errors;
}
