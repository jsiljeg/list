/* Data invariants — the conventions written down in CLAUDE.md, checked instead
   of trusted. These need no browser and run in a second.

   Guards: 1ddedd7 (the style line's casing), the region rule that produced
   "France, Francuska" by putting the country in insight.region, the large-format
   twin rule (a wine and its 1,5 l must carry identical insight), the blend
   notation (name first, descending share), the critic-name list, and 87dffea
   (a producer's region contradicting the wine's). */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { allItems, producers } from "./helpers.mjs";
import { joinList as joinRaw } from "../scripts/lib/list.mjs";

/* import.meta.dirname needs Node 20.11; this works everywhere. */
const HERE = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(HERE, "..");
const menu = JSON.parse(readFileSync(resolve(HERE, "../data/menu.json"), "utf8"));
const items = allItems();
const i18n = readFileSync(resolve(ROOT, "js/i18n.js"), "utf8");

/* js/i18n.js is a classic script, so it is evaluated rather than imported —
   the same way scripts/validate.mjs reads it. */
const I18N = (() => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(i18n + "\nthis.I = I18N;", ctx);
  return ctx.I;
})();

test("the list is not empty and every wine has a name", () => {
  expect(items.length).toBeGreaterThan(300);
  expect(items.filter((i) => !i.name).map((i) => JSON.stringify(i).slice(0, 80))).toEqual([]);
});

test("insight.region never repeats the country", () => {
  /* The app appends the localized country itself, so a country in the ladder
     rendered as "France, Francuska". */
  const COUNTRIES = /(^|,\s*)(France|Francuska|Italy|Italija|Italia|Croatia|Hrvatska|Germany|Njemačka|Deutschland|Spain|Španjolska|España|Slovenia|Slovenija|USA|United States|SAD|China|Kina|Austria|Austrija)\s*$/i;
  const bad = items
    .filter((i) => COUNTRIES.test(i.insight.region || ""))
    .map((i) => `${i.name}: ${i.insight.region}`);
  expect(bad, "country inside the region ladder").toEqual([]);
});

test("blends are written name first, descending share", () => {
  /* zhTokens strips a *trailing* percentage, so "80% Sangiovese" breaks the
     Chinese view silently. */
  const bad = [];
  for (const it of items) {
    for (const tok of String(it.insight.grape || "").split(",")) {
      const t = tok.trim();
      if (!t) continue;
      if (/^\d/.test(t)) bad.push(`${it.name}: "${t}" leads with a number`);
    }
    const shares = [...String(it.insight.grape || "").matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((m) => parseFloat(m[1].replace(",", ".")));
    for (let i = 1; i < shares.length; i++) {
      if (shares[i] > shares[i - 1] + 0.001) bad.push(`${it.name}: shares out of order (${shares.join(", ")})`);
    }
  }
  expect(bad).toEqual([]);
});

test("large-format twins carry identical insight, ratings and tags", () => {
  const byBase = new Map();
  for (const it of items) {
    const base = String(it.name).replace(/\s*–\s*\d+([.,]\d+)?\s*l\s*$/i, "").trim();
    if (base === it.name) continue;
    (byBase.get(base) || byBase.set(base, []).get(base)).push(it);
  }
  const mismatched = [];
  for (const [base, twins] of byBase) {
    const parent = items.find((i) => i.name === base && i.producer === twins[0].producer);
    if (!parent) continue;
    for (const t of twins) {
      const strip = (o) => { const c = { ...o.insight }; delete c.alcohol; return JSON.stringify(c); };
      if (strip(parent) !== strip(t)) mismatched.push(`${t.name}: insight differs from ${base}`);
      if (JSON.stringify(parent.ratings || []) !== JSON.stringify(t.ratings || [])) mismatched.push(`${t.name}: ratings differ`);
      if (JSON.stringify(parent.tags || []) !== JSON.stringify(t.tags || [])) mismatched.push(`${t.name}: tags differ`);
    }
  }
  expect(mismatched).toEqual([]);
});

test("a wine listed by the glass and by the bottle carries identical data", () => {
  /* Owner, 2026-07-30. The same wine appears twice — once on the by-the-glass
     list, once by the bottle — and only the price and the pour differ. Every
     research batch so far edited one listing and left the other seeded from the
     first import, so Meneghetti White had two different aroma sets, Rausch
     Kabinett had its critic scores on one side only, and CL98 wore its vintage
     badge on the bottle but not the glass.

     `price` is the only field allowed to differ. */
  const groups = new Map();
  for (const it of items) {
    const key = `${String(it.name || "").trim().toLowerCase()}|${String(it.producer || "").trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const WINE_FIELDS = ["terroir", "ratings", "tags", "note", "noteSig", "notePlain", "recommended", "new"];
  const bad = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const [first, ...rest] = list;
    for (const other of rest) {
      for (const k of new Set([...Object.keys(first.insight), ...Object.keys(other.insight)])) {
        if (JSON.stringify(first.insight[k]) !== JSON.stringify(other.insight[k]))
          bad.push(`${first.name}: insight.${k} differs between listings (${JSON.stringify(first.insight[k])} vs ${JSON.stringify(other.insight[k])})`);
      }
      for (const k of WINE_FIELDS) {
        if (JSON.stringify(first[k]) !== JSON.stringify(other[k]))
          bad.push(`${first.name}: ${k} differs between listings`);
      }
    }
  }
  expect(bad).toEqual([]);
});

test("every critic name resolves to one from the agreed list", () => {
  /* "Wine Advocate" for "Robert Parker" is the one that keeps recurring, and
     the owner would rather paste what the merchant wrote than remember the
     house spelling — so CRITIC_ALIAS in app.js normalises it on the way to the
     screen. This test therefore checks what a *guest* ends up reading, not
     what is typed: an alias is fine, an unknown name is not, because it would
     reach the screen unchanged. */
  const ALIAS = {};
  for (const m of readFileSync(resolve(ROOT, "js/app.js"), "utf8")
    .split("const CRITIC_ALIAS = {")[1].split("};")[0]
    .matchAll(/"([^"]+)":\s*"([^"]+)"/g)) ALIAS[m[1]] = m[2];

  const KNOWN = new Set(["Robert Parker", "James Suckling", "Wine Spectator", "Wine Enthusiast", "Vinous",
    "Decanter", "Falstaff", "Jasper Morris", "Tim Atkin", "Jancis Robinson", "Lobenberg", "Jeff Leve",
    "Jeb Dunnuck", "Jeannie Cho Lee", "Stuart Pigott"]);
  const canonical = (c) => ALIAS[String(c || "").trim().toLowerCase()] || c;

  const bad = [];
  for (const it of items) for (const r of it.ratings || []) {
    const c = canonical(r.critic);
    if (!KNOWN.has(c)) bad.push(`${it.name}: "${r.critic}" resolves to "${c}", which is not on the list`);
    if (c === "Jancis Robinson" && !/\/20/.test(String(r.score))) bad.push(`${it.name}: Jancis Robinson not out of 20 (${r.score})`);
  }
  expect(bad).toEqual([]);

  /* Every alias must land on a name we actually allow, or the map quietly
     rewrites one unknown critic into another. */
  expect(Object.values(ALIAS).filter((v) => !KNOWN.has(v))).toEqual([]);
});

test("sweetness and body descriptors are lowercase in every language", () => {
  /* 1ddedd7: the style line is sentence case across the whole compound, so only
     the first segment is capitalised. `sweetness` was the outlier. */
  const bad = [];
  for (const m of i18n.matchAll(/"?(sweetness|bodies)"?:\s*\{([^}]*)\}/g)) {
    for (const v of m[2].matchAll(/:\s*"([^"]+)"/g)) {
      const first = v[1][0];
      if (first && first === first.toUpperCase() && first !== first.toLowerCase())
        bad.push(`${m[1]}: "${v[1]}"`);
    }
  }
  expect(bad, "a descriptor is capitalised mid-line").toEqual([]);
});

test("every glass override names a glass we draw", () => {
  const KNOWN = ["champagne", "riesling", "chardonnay", "winewingsBordeaux", "winewingsBurgundy", "burgundy", "dessert"];
  const bad = items
    .filter((i) => i.insight.glass && !KNOWN.includes(i.insight.glass))
    .map((i) => `${i.name}: ${i.insight.glass}`);
  expect(bad).toEqual([]);
});

test("no producer record points at a wine that is gone", () => {
  /* producers.json is keyed by a *short* form — "Togni", "Damijan", "Lageder" —
     and producerInfo() matches by longest containing substring, so a record key
     is reachable when some wine's producer name contains it. Comparing keys
     exactly says forty-seven records are orphaned when none is.

     Only this direction is an invariant. The other way round is not: blurbs are
     written estate by estate and most wines still have none, which is a backlog
     rather than a bug. */
  const named = items.map((i) => String(i.producer || "").toLowerCase()).filter(Boolean);
  const orphans = Object.keys(producers)
    .filter((k) => k.charAt(0) !== "_")
    .filter((k) => !named.some((n) => n.includes(k.toLowerCase())));
  expect(orphans, "producer records no wine can reach").toEqual([]);
});

test("no producer record is shadowed by a longer one", () => {
  /* producerInfo() takes the longest matching key, so adding "Chartron" beside
     "Domaine Jean Chartron" silently hides the shorter blurb for those wines.
     Worth knowing about, since the shorter key usually predates the longer. */
  const keys = Object.keys(producers).filter((k) => k.charAt(0) !== "_");
  const shadowed = [];
  for (const short of keys) {
    for (const long of keys) {
      if (long !== short && long.toLowerCase().includes(short.toLowerCase())) {
        const reachable = items.some((i) => {
          const n = String(i.producer || "").toLowerCase();
          return n.includes(short.toLowerCase()) && !n.includes(long.toLowerCase());
        });
        if (!reachable) shadowed.push(`"${short}" is never used — "${long}" always wins`);
      }
    }
  }
  expect([...new Set(shadowed)]).toEqual([]);
});

test("a producer record and its wines agree on the country", () => {
  /* Deliberately only the country. A record saying "Reims" while the wine says
     "Champagne" is the documented convention — the village belongs to the
     producer, the appellation to the wine — so anything finer would assert the
     opposite of the rule. What this does catch is the Ivanic case: a record
     placing an estate in a different country from everything it makes. */
  const HOME = {
    HR: /hrvat|istra|dalmac|dalmatin|ple[s\u0161]ivica|moslavina|zagorje|me[d\u0111]imurje|primorje|pag\b|kor[c\u010d]ula|pelje[s\u0161]ac|skradin|krapina|neretva|primo[s\u0161]ten|buje|kutina/i,
    FR: /france|champagne|bourgogne|bordeaux|reims|a[y\u00ff]\b|loire|jura|alsace|rh[o\u00f4]ne|beaujolais|chablis|mesnil|avize|cramant|oger|mareuil|aube|marne/i
  };
  const bad = [];
  for (const [name, rec] of Object.entries(producers)) {
    const home = String(rec.region || "");
    if (!home) continue;
    const mine = items.filter((i) => i.producer === name);
    if (!mine.length) continue;
    for (const [code, re] of Object.entries(HOME)) {
      if (!re.test(home)) continue;
      if (!mine.some((i) => i.insight.country === code))
        bad.push(`${name}: record "${home}" reads as ${code}, its wines are ${mine[0].insight.country}`);
    }
  }
  expect(bad).toEqual([]);
});

test("prices are numbers and plausible", () => {
  const bad = items
    .filter((i) => i.price != null && (typeof i.price !== "number" || i.price <= 0 || i.price > 20000))
    .map((i) => `${i.name}: ${i.price}`);
  expect(bad).toEqual([]);
});

for (const f of ["library/wines.json", "lists/theatrium.json", "data/producers.json"])
  test(`${f} round-trips byte for byte`, () => {
    /* CLAUDE.md: the data files must survive json.dumps(indent=1) + CRLF, so a
       structural edit never rewrites the whole file. A diff of 5000 lines hides
       the one line that mattered. */
    const raw = readFileSync(resolve(ROOT, f), "utf8");
    const round = JSON.stringify(JSON.parse(raw), null, 1) + "\n";
    expect(raw.replace(/\r\n/g, "\n"), "file is not in canonical form").toBe(round);
  });

test("every listing points at a wine in the library", () => {
  /* The silent failure the split introduces: a bad ref drops the wine off the
     list entirely — priced, on the shelf, invisible. validate.mjs blocks the
     deploy on it; this says so in the suite too. */
  const { missing, orphans } = joinRaw();
  expect(missing, "listings whose ref is not in library/wines.json").toEqual([]);
  /* Orphans are legal once a second venue exists — a wine this list stopped
     pouring stays in the library. Today there is one list, so an orphan means
     a listing lost its wine. */
  expect(orphans, "library wines no list references").toEqual([]);
});

test("green pepper and tomato leaf only go on wines with Cabernet in them", () => {
  /* Pyrazines are a Cabernet Franc and cool-Cabernet marker. Added by hand to
     six wines on 2026-07-31; the risk is a later bulk edit spraying them across
     the Cabernet shelf, including the ripe warm ones — Sassicaia, Ornellaia,
     Solaia, Ao Yun — where they would simply be wrong, and a guest would taste
     that we were wrong. */
  const bad = items
    .filter((i) => (i.insight.aromas || []).some((a) => a === "capsicum" || a === "tomato_leaf"))
    .filter((i) => !/cabernet|carménère|carmenere/i.test(i.insight.grape || ""))
    .map((i) => `${i.producer} — ${i.name}: ${i.insight.grape}`);
  expect(bad).toEqual([]);
});

test("no wine stores a bare Malvasia or Malvazija", () => {
  /* Caroline Gilby MW, April 2026: ~290 varieties share the name Malvasia and
     most are unrelated to one another — Croatia alone grows three. The bare
     word identifies nothing, so it must always carry its qualifier. */
  const bad = items
    .filter((i) => String(i.insight.grape || "").split(",")
      .some((t) => /^\s*malvas(ia|ija)\s*$|^\s*malvazija\s*$/i.test(t)))
    .map((i) => `${i.producer} — ${i.name}: ${i.insight.grape}`);
  expect(bad).toEqual([]);
});

test("guest-facing text spells the lost name Tokaj, never Tocai", () => {
  /* Owner, 2026-08-01. The notes told the Friulano story with the Friulian
     spelling "Tocai" and then said Jakot was "Tokaj backwards" — two spellings
     of one name in the same paragraph, and the anagram, which is the whole
     point of Prinčič's label, did not land. One spelling now: Tokaj. "Tocai"
     survives only in SEARCH_ALIAS, where no guest reads it. */
  const bad = [];
  for (const it of items) {
    for (const [lc, text] of Object.entries(it.note || {}))
      if (/tocai/i.test(text)) bad.push(`${it.producer} — ${it.name} (${lc})`);
  }
  for (const [name, rec] of Object.entries(producers))
    for (const [lc, text] of Object.entries((rec && rec.blurb) || {}))
      if (/tocai/i.test(text)) bad.push(`producer ${name} (${lc})`);
  expect(bad, 'guest text still says "Tocai"').toEqual([]);
});

test("the Jakot note spells the reversal out", () => {
  /* The relation is the reason the wine is called that, so it must be readable
     without knowing the story already: every language has to name both JAKOT
     and TOKAJ. */
  const jakot = items.find((i) => /jakot/i.test(i.name));
  expect(jakot, "Prinčič Jakot is on the list").toBeTruthy();
  const missing = Object.entries(jakot.note || {})
    .filter(([, text]) => !(/jakot/i.test(text) && /tokaj/i.test(text)))
    .map(([lc]) => lc);
  expect(missing, "a language that does not connect Jakot to Tokaj").toEqual([]);
});

test("every Friuli wine carries the same region ladder", () => {
  /* Owner, 2026-08-01: "friuli, furlanija" were used inconsistently. The stored
     ladder ends in the one token "Friuli" — never a bare appellation, never an
     exonym — and js/i18n.js renders Furlanija / Frioul / Friaul per language.
     A Croatian card used to read "Friuli" in the region line and "Furlanija"
     in the note two lines above it. */
  const bad = [];
  for (const it of items) {
    const region = String(it.insight.region || "");
    if (!/friuli|furlanij|frioul|friaul/i.test(region) && !/friulano/i.test(it.insight.grape || "")) continue;
    if (it.insight.country !== "IT") continue;
    const rungs = region.split(",").map((s) => s.trim());
    if (rungs[rungs.length - 1] !== "Friuli")
      bad.push(`${it.producer} — ${it.name}: "${region}" does not end in Friuli`);
    if (/furlanij|frioul|friaul/i.test(region))
      bad.push(`${it.producer} — ${it.name}: "${region}" stores an exonym`);
  }
  expect(bad).toEqual([]);
});

/* ---------------------------------------------------------------- spirits
   The spirits shelf got insight cards on 2026-08-01. Its vocabulary lives in
   js/spirits.js rather than js/i18n.js, so none of the invariants above see
   it; these are the equivalent guards. */

const spiritCtx = (() => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(
    readFileSync(resolve(ROOT, "js/spirits.js"), "utf8") +
      "\nthis.S = SPIRIT_I18N; this.V = SPIRIT_VESSELS; this.BY = VESSEL_BY_CLASS;",
    ctx
  );
  return ctx;
})();
const spirits = items.filter((i) => i.insight.kind === "spirit");

test("every language in js/spirits.js has the same keys", () => {
  /* The failure this catches is silent and per-language: a key added to `en`
     and forgotten in `sl` renders the raw key — "ex_bourbon" — to a Slovenian
     guest, and only to them. */
  const { S } = spiritCtx;
  const DICTS = ["ui", "classes", "bases", "stills", "casks", "serves", "aromas", "pairings"];
  const bad = [];
  for (const lc of Object.keys(S)) {
    for (const d of DICTS) {
      const ref = Object.keys(S.en[d]), got = Object.keys(S[lc][d]);
      for (const k of ref) if (!got.includes(k)) bad.push(`${lc}.${d}: missing "${k}"`);
      for (const k of got) if (!ref.includes(k)) bad.push(`${lc}.${d}: has "${k}", en does not`);
    }
  }
  expect(bad).toEqual([]);
  expect(Object.keys(S).sort()).toEqual(["de", "en", "es", "fr", "hr", "it", "sl", "zh"]);
});

test("every spirit key resolves in every language", () => {
  const { S } = spiritCtx;
  const bad = [];
  for (const it of spirits) {
    const ins = it.insight, at = `${it.producer} — ${it.name}`;
    for (const lc of Object.keys(S)) {
      const s = S[lc], t = I18N[lc];
      if (!s.classes[ins.class]) bad.push(`${at}: class "${ins.class}" (${lc})`);
      for (const [d, keys] of [["bases", ins.base], ["stills", ins.still], ["casks", ins.cask], ["serves", ins.serve]])
        for (const k of keys || []) if (!s[d][k]) bad.push(`${at}: ${d} "${k}" (${lc})`);
      /* Aromas and pairings may live in either dictionary. */
      for (const a of ins.aromas || []) if (!s.aromas[a] && !t.aromas[a]) bad.push(`${at}: aroma "${a}" (${lc})`);
      for (const p of ins.pairings || []) if (!s.pairings[p] && !t.pairings[p]) bad.push(`${at}: pairing "${p}" (${lc})`);
      if (ins.country && !t.countries[ins.country]) bad.push(`${at}: country "${ins.country}" (${lc})`);
    }
  }
  expect(bad).toEqual([]);
});

test("every spirit class has a glass, and every glass exists", () => {
  const { S, V, BY } = spiritCtx;
  expect(Object.keys(S.en.classes).filter((c) => !BY[c]), "class with no vessel").toEqual([]);
  expect(Object.values(BY).filter((v) => !V[v]), "vessel that is not drawn").toEqual([]);
  expect(spirits.filter((i) => i.insight.vessel && !V[i.insight.vessel]).map((i) => i.name)).toEqual([]);
});

test("a spirit does not carry wine-only fields", () => {
  /* `grape`, `style` and `body` are never read on the spirit branch of
     openDetail(), so anything stored in them is invisible — and a style would
     additionally send it through glassFor() if the branch were ever removed. */
  const bad = spirits
    .filter((i) => i.insight.grape || i.insight.style || i.insight.body || i.insight.glass)
    .map((i) => `${i.producer} — ${i.name}`);
  expect(bad).toEqual([]);
});

test("no two bottles share a note", () => {
  /* Six house stories were originally pasted onto every bottle the house made,
     so a guest tapping three Mulassanos read the same paragraph three times.
     The house story belongs in producers.json; the note is per bottle.
     Vintages of one wine and large-format twins are the legitimate exceptions. */
  const byNote = new Map();
  for (const it of items) {
    const en = it.note && it.note.en;
    if (!en) continue;
    if (!byNote.has(en)) byNote.set(en, []);
    byNote.get(en).push(it);
  }
  const bad = [];
  for (const [, group] of byNote) {
    if (group.length < 2) continue;
    /* Same producer + same name (a twin or a second listing) is fine, and so
       are two vintages of one wine — strip a trailing year and compare. */
    const stem = (i) => `${i.producer}|${String(i.name).replace(/\s*(–\s*\d+([.,]\d+)?\s*l|\b(19|20)\d{2}\b)\s*/gi, "").trim()}`;
    if (new Set(group.map(stem)).size > 1)
      bad.push(group.map((i) => `${i.producer} — ${i.name}`).join(" / "));
  }
  expect(bad, "different bottles sharing one note").toEqual([]);
});

test("guest text in a Latin-script language contains no Cyrillic", () => {
  /* Two Croatian notes shipped with "ком" inside a Latin word — invisible when
     you read it, and a search for the word would never match. */
  const CYR = /[Ѐ-ӿ]/;
  const bad = [];
  for (const it of items)
    for (const [lc, text] of Object.entries(it.note || {}))
      if (lc !== "zh" && CYR.test(text)) bad.push(`${it.producer} — ${it.name} (${lc})`);
  for (const [name, rec] of Object.entries(producers))
    for (const [lc, text] of Object.entries((rec && rec.blurb) || {}))
      if (lc !== "zh" && CYR.test(text)) bad.push(`producer ${name} (${lc})`);
  expect(bad).toEqual([]);
});

test("a spirit does not inherit a winery's blurb", () => {
  /* producerInfo() matches by longest containing substring, so "Clairin"
     picked up Giorgio Clai's winery blurb until a Clairin record was added.
     Any spirit whose blurb comes from a record shorter than its own producer
     name is suspect; the assertion here is the narrow one that broke. */
  const keys = Object.keys(producers).filter((k) => k.charAt(0) !== "_");
  const resolve_ = (n) => {
    const p = String(n || "").toLowerCase();
    let best = null;
    for (const k of keys) if (p.includes(k.toLowerCase()) && (!best || k.length > best.length)) best = k;
    return best;
  };
  expect(resolve_("Clairin")).toBe("Clairin");
  const bad = spirits
    .map((i) => [i.producer, resolve_(i.producer)])
    .filter(([p, k]) => k && !String(p).toLowerCase().startsWith(k.toLowerCase()))
    .map(([p, k]) => `${p} resolves to "${k}"`);
  expect(bad).toEqual([]);
});

test("the Saints Hills blurb tells the Rolland story in every language", () => {
  /* Added 2026-08-02 at the owner's request: the blurb said "a top consultant"
     and never named him. Michel Rolland consulted here from 2006 — his only
     Croatian project — and the family called him a friend and a teacher before
     an oenologist. Every language has to carry the name and the Frenchie label
     it is told through, or a guest reading in that language gets the old,
     anonymous version of the sentence. */
  const rec = producers["Saints Hills"];
  expect(rec, "Saints Hills has a producer record").toBeTruthy();
  const missing = Object.entries(rec.blurb)
    /* Chinese writes him 米歇尔·罗兰, so the name is matched in either script. */
    .filter(([, text]) => !((/rolland/i.test(text) || /罗兰/.test(text)) && /frenchie/i.test(text) && /2006/.test(text)))
    .map(([lc]) => lc);
  expect(missing, "languages missing the Rolland story").toEqual([]);
});

test("no nail ornament converges on a single point", () => {
  /* Added 2026-08-02: the water/juice ornament's citrus was drawn as spokes
     radiating from one shared centre, which reads as a starburst rather than
     as segments — the owner could not tell it was fruit. The whole set is
     built of nails that never touch, so three strokes meeting at one point is
     the tell, whichever ornament it happens in. */
  const src = readFileSync(resolve(HERE, "../js/app.js"), "utf8");
  const icons = /const ICONS = \{([\s\S]*?)\n\};/.exec(src);
  expect(icons, "ICONS block not found").toBeTruthy();
  const bad = [];
  for (const m of icons[1].matchAll(/^\s*(\w+): '(<svg[^']*)'/gm)) {
    const [, name, svg] = m;
    if (!/stroke-linecap/.test(svg)) continue;           // the nail motifs only
    const seen = new Map();
    for (const d of svg.matchAll(/M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)/g))
      for (const pt of [`${d[1]},${d[2]}`, `${d[3]},${d[4]}`])
        seen.set(pt, (seen.get(pt) || 0) + 1);
    for (const [pt, n] of seen) if (n > 2) bad.push(`${name}: ${n} strokes meet at ${pt}`);
  }
  expect(bad, "an ornament radiates from a point").toEqual([]);
});

test("the pairing vocabulary is shared, not one wine's private list", () => {
  /* Added 2026-08-02: three bottles carried pairings pasted verbatim from their
     producer's own notes — `salmon_zucchini_tart`, `goat_cheese_veg_tiramisu`,
     `scallops_basil_mustard`, `istrian_fuzi`, `green_tomato_sorbet` and a dozen
     more, each on exactly one wine. On the card they read as a shopping list;
     in the sommelier they matched nothing, because no dish speaks a vocabulary
     invented for one bottle. A pairing has to be a food, not a recipe. */
  const count = new Map();
  for (const it of items)
    for (const p of (it.insight || {}).pairings || []) count.set(p, (count.get(p) || 0) + 1);
  const singletons = [...count].filter(([, n]) => n === 1).map(([p]) => p);
  /* Two exemptions, both foods rather than recipes. `pasticada` is on the
     kitchen's menu, which is the whole point of a specific key. `smoked_fish`
     is on one peated Islay because peat and smoked salmon is the pairing —
     rare here only because we pour one Islay. */
  const menuKeys = new Set(menu.dishes.flatMap((d) => d.pairings || []));
  const allowed = new Set([...menuKeys, "smoked_fish"]);
  const orphaned = singletons.filter((p) => !allowed.has(p));
  expect(orphaned, "pairings on exactly one wine and no dish").toEqual([]);

  /* And no two keys for one food. */
  for (const [a, b] of [["chocolate", "dark_chocolate"], ["sushi_sashimi", "sushi"],
                        ["fish", "white_fish"], ["red_meat", "beef"], ["game_birds", "game"]])
    expect(count.has(a), `"${a}" is a second name for "${b}"`).toBe(false);
});

test("every dish pairing and style can actually be poured", () => {
  /* The Tiramisu asked for `coffee`, which was in no dictionary and on no
     wine, so it scored zero silently. validate.mjs now fails the deploy on
     that; this says the same thing where a developer will read it. */
  const winePairings = new Set(items.flatMap((i) => (i.insight || {}).pairings || []));
  const wineStyles = new Set(items.map((i) => (i.insight || {}).style).filter(Boolean));
  const bad = [];
  for (const d of menu.dishes) {
    for (const p of d.pairings || []) if (!winePairings.has(p)) bad.push(`${d.name.en}: pairing ${p}`);
    for (const s of d.styles || []) if (!wineStyles.has(s)) bad.push(`${d.name.en}: style ${s}`);
  }
  expect(bad, "menu asking for something no wine carries").toEqual([]);
});
