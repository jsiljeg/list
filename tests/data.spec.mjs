/* Data invariants — the conventions written down in CLAUDE.md, checked instead
   of trusted. These need no browser and run in a second.

   Guards: 1ddedd7 (the style line's casing), the region rule that produced
   "France, Francuska" by putting the country in insight.region, the large-format
   twin rule (a wine and its 1,5 l must carry identical insight), the blend
   notation (name first, descending share), the critic-name list, and 87dffea
   (a producer's region contradicting the wine's). */
import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { allItems, producers, library } from "./helpers.mjs";
import { joinList as joinRaw } from "../scripts/lib/list.mjs";
import { parseRs } from "../scripts/lib/rs.mjs";
import { rankPairings, STYLE_ORDER } from "../scripts/lib/pairing-rank.mjs";

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

test("green pepper only goes on wines with Cabernet in them", () => {
  /* Pyrazines are a Cabernet Franc and cool-Cabernet marker. Added by hand to
     six wines on 2026-07-31; the risk is a later bulk edit spraying them across
     the Cabernet shelf, including the ripe warm ones — Sassicaia, Ornellaia,
     Solaia, Ao Yun — where they would simply be wrong, and a guest would taste
     that we were wrong.

     Corrected 2026-08-02: this covered `tomato_leaf` too and had been failing
     ever since, on four Sangiovese — Conti Costanti's Brunello, both Chiara
     Condellos and Montevertine. The data was right and the test was wrong.
     Tomato leaf is a textbook Sangiovese descriptor, not a pyrazine claim; it
     is *capsicum*, green pepper, that belongs to the Cabernet family alone.
     A test that fails on correct data teaches everyone to ignore the suite. */
  const bad = items
    .filter((i) => (i.insight.aromas || []).includes("capsicum"))
    .filter((i) => !/cabernet|carménère|carmenere/i.test(i.insight.grape || ""))
    .map((i) => `${i.producer} — ${i.name}: ${i.insight.grape}`);
  expect(bad, "green pepper on a wine with no Cabernet in it").toEqual([]);
});

test("tomato leaf stays on Cabernet and Sangiovese", () => {
  /* The other half of the rule above. Tomato leaf is honest on both families
     and on very little else, so it is still worth guarding — just not as a
     pyrazine. */
  const bad = items
    .filter((i) => (i.insight.aromas || []).includes("tomato_leaf"))
    .filter((i) => !/cabernet|carménère|carmenere|sangiovese/i.test(i.insight.grape || ""))
    .map((i) => `${i.producer} — ${i.name}: ${i.insight.grape}`);
  expect(bad, "tomato leaf somewhere it does not belong").toEqual([]);
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

test("no wine stores a bare Muscat", () => {
  /* Same argument as the Malvasia test above, and the same gap CLAUDE.md had
     left open: "Muscat" alone is blanc à petits grains, Ottonel or Alexandria,
     three different grapes. Geržinić's was bare until the owner settled it as
     Moscato Giallo on 2026-08-03, off the estate's own "Muškat žuti".

     The other half of this — that a German guest reads Goldmuskateller and a
     Slovenian Rumeni muškat — needs the running app, so it lives in
     localization.spec.mjs. */
  const bare = items
    .filter((i) => String(i.insight.grape || "").split(",")
      .some((t) => /^\s*mus[ck]at\s*$|^\s*muškat\s*$/i.test(t)))
    .map((i) => `${i.producer} — ${i.name}: ${i.insight.grape}`);
  expect(bare, "wines storing an unqualified Muscat").toEqual([]);
  expect(items.filter((i) => (i.insight.grape || "").includes("Moscato Giallo")).length,
    "no wine carries Moscato Giallo any more — was it renamed?").toBeGreaterThan(0);
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

test("the rewritten Croatian house stories survive in every language", () => {
  /* Added 2026-08-03 at the owner's request: five blurbs were one flat line
     each ("shallow and pathetic", in their words) and were rewritten around
     the fact that actually makes each house worth reading about. The risk is a
     later tidy-up or a re-translation quietly flattening them back, in one
     language only — which nobody would notice, because the Croatian would
     still read fine.

     Each entry names the load-bearing facts, matched as proper nouns so they
     survive translation. Chinese transliterates them, so every pattern carries
     its Chinese form as an alternative.

     Match the **stem**, never the nominative: Croatian and Slovenian decline
     proper nouns like everything else, so the first draft of this test failed
     on six true sentences — "iz Nape", "na kamenitu Deforu", "enologiju
     Agrolagune" — and Slovenian spells the grape plavec. */
  const STORIES = {
    /* Zinfandel is Tribidrag: he carried the grape home from Napa, and
       without both names the sentence is just an American buying vines. */
    "Benmosche Family": [/\bnap[ae]\b|纳帕/i, /tribidrag|特里比德拉格/i],
    /* Three generations by name — grandfather's plot, father's second job,
       and the range that now carries the father's name. */
    "Benvenuti": [/pietro|彼得罗/i, /livio|利维奥/i],
    /* Grk has functionally female flowers and cannot set fruit without a
       Plavac planted to pollinate it — which DNA then shows is its own
       relative, through Tribidrag. Defora is the site Frano Milina replanted
       after phylloxera. Lose any of the three and it is a boring grape. */
    "Bire": [/plav[ae]c|普拉瓦茨/i, /tribidrag|特里比德拉格/i, /defor|德福拉/i],
    /* He saved Gegić from extinction; the Michelin star came after. */
    "Boškinac": [/gegi|格吉奇/i, /michelin|米其林/i],
    /* Twelve years making Agrolaguna's wine before his own label, OMO. */
    "Budinski": [/agrolagun|阿格罗拉古纳/i, /\bomo\b/i],
    /* Third batch, 2026-08-03. */
    "Markus": [/fetivi/i],
    "Matošević": [/grimald|格里马尔达/i, /vinistr/i],
    "Meneghetti": [/2001/, /relais/i],
    "Miloš": [/ponik|波尼克韦/i, /garmaz|加尔马兹/i],
    "Mrgudić": [/moskar/i, /postup/i],
    "Niko Bura": [/1410/, /ruža dalmatinska|ruza dalmatinska/i],
    "Rizman": [/komarn|科马尔纳/i, /vianna|维亚纳/i],
    "Skaramuča": [/1992/, /dingač|dingac|丁加奇/i],
    "Šember": [/pavlovčani|pavlovcani|帕夫洛夫恰尼/i, /plavec|普拉韦茨/i],
    "Tomaz": [/barbarossa|巴巴罗萨/i, /1918/],
    /* Fourth batch and the owner's corrections, 2026-08-03. Krajančić must
       credit both authors of Wine Grapes by name, and Budinski's DipWSET is
       the qualification behind everything else the blurb claims. */
    "Krajančić": [/jancis|简希斯/i, /vouillamoz|武亚莫兹/i],
    "Budinski": [/agrolagun|阿格罗拉古纳/i, /\bomo\b/i, /dipwset/i],
    "Clai": [/trst|trieste|triest|的里雅斯特/i, /gravner|格拉夫纳/i],
    "Tomac": [/seloss|塞洛斯/i, /decanter/i],
    "Corte Aura": [/2009/],
    "Wise Grus": [/daruvar|达鲁瓦尔/i],
    "Zmajska pivovara": [/2013/],
    "Aura": [/karbun/i, /2006/],
    /* The German shelf, 2026-08-03. Dates carry through every language and
       are the spine of each of these stories. */
    "Egon Müller": [/1797/, /scharzhof|沙尔茨霍夫/i, /molitor|莫利托/i, /lubentiushof/i],
    "Prüm": [/1842/, /jodocus|约多库斯/i],
    "Zilliken": [/1742/, /geltz|盖尔茨/i],
    /* Eva Clüsserath is married to Philipp Wittmann, which is why two German
       estates on this list are one family — the point of the blurb. */
    "Clüsserath": [/1670/, /wittmann|维特曼/i, /rheinhess|莱茵黑森/i],
    "Heymann-Löwenstein": [/terrassenmosel|阶地摩泽尔/i, /1980/],
    "Knebel": [/1642/, /2008/, /molitor|莫利托/i, /lubentiushof/i],
    "Wittmann": [/1663/, /2004/, /cl[üu]sserath|克吕塞拉特/i],
    /* Shortened 2026-08-05 at the owner's request — the founding date and the
       Biodyvin line went with it, so the guard now names what the card is
       actually about: the 1828 tax survey and the 1994 self-classification. */
    "Bürklin-Wolf": [/1828/, /1994/, /gaisböhl|盖斯波尔/i],
    "Christmann": [/\bvdp\b/i, /sophie|索菲/i],
    /* German spirits and Italy, first round (Piedmont), 2026-08-03. Note the
       stems again: Italian calls the saint Uberto, and Croatian declines
       Teresa to "Teresom". */
    "Jägermeister": [/hubert|uberto|休伯特/i, /1934/],
    "Monkey 47": [/collins|柯林斯/i, /1951/],
    "Brick Gin": [/weimar|魏玛/i],
    "Roagna": [/1961/, /asili|阿西利/i],
    "Boschis": [/1981/, /1990/],
    /* Darmagi is the whole anecdote: what Angelo's father muttered every time
       he walked past the Nebbiolo his son had replaced with Cabernet. */
    "Gaja": [/1859/, /darmagi/i],
    "Crissante Alessandria": [/1958/, /teres|特蕾莎/i],
    "Lalù": [/2015/, /pollenz|波伦佐/i],
    "Le Piane": [/1988/, /cerri|切里/i],
    /* Tuscany, 2026-08-03. French calls the city Lucques, so the stem has to
       allow both spellings — the same declension trap in a different guise. */
    "Antinori": [/1385/, /tignanello|天娜/i],
    "Tenuta San Guido": [/1948/, /tachis|塔基斯/i],
    "Ornellaia": [/1981/, /antinori|安蒂诺里/i],
    "Isole e Olena": [/1956/, /cepparello|切帕雷洛/i],
    "Montevertine": [/1971/, /trebbiano|特雷比亚诺/i],
    "Soldera": [/2012/, /sangiovese|桑娇维塞/i],
    "Conti Costanti": [/1555/, /matrichese/i],
    "Poggio di Sotto": [/1989/, /gambelli|甘贝利/i],
    "Poggio Scalette": [/1991/, /carbonaione/i],
    "Chiara Condello": [/2015/, /spungone/i],
    "Magliano": [/1996/, /luc[cq]|卢卡/i],
    /* Italy round three, the Northeast, 2026-08-03. */
    "Radikon": [/1995/, /kante|坎特/i],
    "Vodopivec": [/2004/, /gravner|格拉夫纳/i],
    "Damijan": [/1998/, /gravner|格拉夫纳/i],
    "Prinčič": [/1988/, /oslav|奥斯拉维亚/i],
    "Vie di Romans": [/1978/, /gianfranco|詹弗兰科/i],
    /* Veneto, Alto Adige, Sicily and the coast, 2026-08-03. */
    "Giuseppe Quintarelli": [/1950/],
    "Dal Forno": [/1983/, /quintarelli|昆塔雷利/i],
    "Ca' La Bionda": [/1902/, /castellani|卡斯泰拉尼/i],
    "Benanti": [/1988/, /pietramarina/i],
    "Donnafugata": [/1983/, /ben ry|风之子/i],
    "Lageder": [/1823/, /löwengang/i],
    "Dipoli": [/1987/, /voglar/i],
    "Duemani": [/2000/, /demet/i],
    /* Austria, 2026-08-04. */
    "Bernhard Ott": [/1889/, /1989/],
    "Prager": [/1302/, /1715/, /\b25\b/],
    "Muster": [/2000/, /opok/i, /tscheppe|切佩/i],
    /* The American shelf, 2026-08-04. */
    "Ridge": [/1976/, /1966/, /18/],
    "Heitz": [/1965/, /1966/, /tchelistcheff|切利斯切夫/i, /montelena|蒙特兰那/i, /1973/],
    "Mayacamas": [/1889/, /fisher|费舍尔/i],
    "Cakebread": [/1972/, /adams|亚当斯/i, /2\.500|2 500|\$2,500/],
    "Togni": [/1956/, /peynaud|佩诺/i, /lascombes|拉斯康/i],
    "Occidental": [/2011/, /2017/],
    "Résonance": [/1859/, /2013/, /1981/],
    "Walter Scott": [/2008/, /twa|环球航空/i],
    "Tyler": [/2005/, /2015/],
    "Duckhorn": [/1976/, /1978/],
    "Domaine Eden": [/1945/, /1983/, /2007/],
    /* Owner's flesh pass, 2026-08-04. Each of these is the fact the blurb was
       rewritten around; losing it puts the card back where it started. */
    "Boschis": [/1981/, /1990/, /altare|阿尔塔雷/i],
    "Montevertine": [/1971/, /manfredi|曼弗雷迪/i],
    "Soldera": [/2012/, /graziella|格拉齐耶拉/i],
    "Giuseppe Quintarelli": [/1950/, /rosso del bepi/i],
    /* Darmagi is not our bottle; the Barbaresco is. The story is the 17 years
       when this was the only wine of theirs allowed to carry the name. */
    "Gaja": [/1859/, /1996/, /2013/],
    "Ornellaia": [/1981/, /2009/, /abramovi|阿布拉莫维奇/i],
    "Antinori": [/1385/, /albiera|阿尔比耶拉/i, /alessia|阿莱西娅/i],
    "Poggio di Sotto": [/1989/, /gambelli|甘贝利/i, /decanter/i],
    "Tenuta San Guido": [/1948/, /tachis|塔基斯/i, /sass/i],
    /* France, 2026-08-04. The Chablis pair must keep pointing at each other:
       Raveneau married a Dauvissat, and losing that in one language loses the
       reason both cards exist. */
    "Domaine Armand Rousseau": [/1902/, /1959/, /baudoin|博杜安/i],
    "Raveneau": [/1948/, /dauvissat|多维萨/i],
    "Dauvissat": [/1948/, /raveneau|拉沃诺/i],
    "Hubert Lamy": [/1995/, /30[ .,]000/],
    "Jules Desjourneys": [/2007/, /chauvet|肖韦/i],
    "Lignier": [/2004/, /romain|罗曼/i],
    "Pattes Loup": [/2004/, /2006/, /2009/],
    "Piuze": [/2008/, /qu[eé]bec|魁北克/i],
    "Bernard-Bonin": [/1998/, /michelot|米什洛/i],
    "Philippe Chavy": [/1990/, /1932/],
    "Rémi Jobard": [/2011/, /stockinger|施托金格/i],
    /* "Beaune" declines to "Beauna" in Slovenian, so match the stem. */
    "David Moret": [/1998/, /beaun|博讷/i],
    "Moret-Nominé": [/2000/, /moret|莫雷/i],
    "Machard de Gramont": [/1983/, /axelle|阿克塞尔/i],
    "Chartron": [/1859/, /dupard|迪帕尔/i],
    "Mikulski": [/1939/, /boillot|布瓦洛/i],
    "Théo Dancer": [/1996/, /2020/],
    "Albert Mann": [/1654/, /1997/],
    "Bourdy": [/1475/, /1865/],
    "Pascal Cotat": [/damn/i, /fran[cç]ois|弗朗索瓦/i],
    "Crochet": [/1998/, /caillottes/i],
    "l'Écu": [/1972/, /bossard|博萨尔/i],
    /* Champagne, 2026-08-04. Four of these carry a cross-reference to another
       card, and a cross-reference is exactly what a lazy translation drops. */
    "Roederer": [/1876/, /1881/, /1945/, /aleksand|alexand|alessandro|alejandro|亚历山大/i, /pez/i],
    "Krug": [/1843/, /1971/, /1698/, /1[.,]84/, /clos du mesnil/i],
    /* Without Delamotte the point of declaring fewer than 45 vintages is lost:
       the fruit does not disappear, it becomes the sister house's wine. */
    "Salon": [/1921/, /\b45\b/, /delamotte/i],
    "Delamotte": [/salon/i, /mesnil|勒梅尼/i],
    /* The solera came from López de Heredia and Jerez, and Heredia is on this
       list. Croatian and Slovenian decline the surname — match the stem. */
    "Jacques Selosse": [/1974/, /1986/, /heredi/i, /solera|索莱拉/i],
    "Moët": [/pérignon|perignon|培里侬/i, /hautviller|奥维莱/i, /p2/i],
    "Billecart-Salmon": [/1818/, /elisabeth|伊丽莎白/i],
    "Deutz": [/1838/, /geldermann|热尔德曼/i, /aÿ|艾伊/i],
    "Henri Giraud": [/argon|阿尔贡/i, /\b12\b/],
    "Egly-Ouriet": [/1946/, /1947/, /ambonnay|昂博内/i],
    "De Sousa": [/1986/, /1999/, /portugal|portogall|葡萄牙/i],
    /* Gautherot trained at Selosse, and the horse is the line a guest repeats.
       Every language declines or compounds it: konj- / cheva- / cavall- /
       caball- / Pferd / horse / 马. */
    "Vouette": [/seloss|塞洛斯/i, /1998/, /konj|horse|cheva|cavall|pferd|caball|马/i],
    "Ruppert-Leroy": [/essoyes|埃索瓦/i, /demet/i, /2010/],
    "Pertois-Moriset": [/1951/, /cécile|cecile|塞西尔/i],
    "L'Hoste": [/1970/, /bassuet|巴叙埃/i, /vitry|维特里/i],
  };
  const bad = [];
  for (const [name, patterns] of Object.entries(STORIES)) {
    const rec = producers[name];
    if (!rec || !rec.blurb) { bad.push(`${name}: no producer record`); continue; }
    for (const lc of ["hr", "en", "it", "fr", "de", "zh", "sl", "es"]) {
      const text = rec.blurb[lc];
      if (!text) { bad.push(`${name}/${lc}: missing`); continue; }
      const lost = patterns.filter((p) => !p.test(text)).map(String);
      if (lost.length) bad.push(`${name}/${lc}: lost ${lost.join(" ")}`);
    }
  }
  /* The Santa Elisabetta note is the same request in the wine's own record:
     the guest asked what the cuvée actually is, and 330 m is the fact the
     whole selection story hangs off. A bare number travels through every
     language, including Chinese. */
  const se = library.wines["benvenuti--santa-elizabeta-2021"];
  if (!se || !se.note) bad.push("Santa Elizabeta 2021: no note");
  else for (const lc of ["hr", "en", "it", "fr", "de", "zh", "sl", "es"])
    if (!/330/.test(se.note[lc] || "")) bad.push(`Santa Elizabeta/${lc}: note lost the 330 m site`);

  /* The error the owner caught twice: a blurb selling a wine we do not pour.
     Ivanić's advertised his Škrlet "Pukli kamen" when we list only his Pinot,
     and Niko Bura's opened on Dingač when the only Bura on the list is the
     prošek. Both are fixed; this pins the second, because the family really
     has farmed Dingač since 1410 and it is the tempting thing to lead with.
     A guest who reads Dingač here and cannot order it has been sold a wine
     twice — once by the card and once by the waiter saying no. */
  for (const [lc, text] of Object.entries(producers["Niko Bura"].blurb))
    if (/dingač|dingac|丁加奇/i.test(text))
      bad.push(`Niko Bura/${lc}: names Dingač, which we do not pour from them`);

  /* One caron, the whole meaning: "opraši" is pollinates, "oprasi" is farrows.
     The Grk blurb turns on Plavac pollinating it, so this typo made the
     sentence comic in the one language most guests read it in. */
  if (/\boprasi\b/i.test(producers["Bire"].blurb.hr))
    bad.push('Bire/hr: "oprasi" (farrows) — it is "opraši"');

  /* A Bordeaux producer must be a château, never an appellation. Five of them
     were appellations until 2026-08-04, so the "about the winemaker" block
     could only ever describe a place — and one key, "Saint-Émilion Grand Cru",
     was doing duty for two different châteaux at once, which no single blurb
     can do honestly. */
  const APPELLATION = /^(Saint-Est[eè]phe|Saint-[EÉ]milion.*|Pomerol|Saint-Julien|Sauternes|Margaux|Pauillac|Graves)$/i;
  for (const it of items) {
    if (it.insight.country === "FR" && APPELLATION.test(String(it.producer || "").trim()))
      bad.push(`${it.name}: producer "${it.producer}" is an appellation, not a house`);
  }

  /* Reinhard Löwenstein announced the sale of the estate in November 2025 and
     his daughter Sarah did not take it on; the blurb said she ran it, which
     was true when it was written and stopped being true two months later.
     A living fact needs a guard, because nothing else will notice. */
  for (const [lc, text] of Object.entries(producers["Heymann-Löwenstein"].blurb))
    if (/sarah/i.test(text)) bad.push(`Heymann-Löwenstein/${lc}: still says Sarah runs it`);
  expect(bad, "house stories that lost their point").toEqual([]);
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

test("no wine claims a food it clashes with", () => {
  /* Added 2026-08-02 (owner: "I don't want non-compatible wine-food
     pairings... quality before quantity"). All 964 pairing tags were read
     against five rules; four wines failed and were corrected:

       Pertois-Moriset rosé      `desserts`       → light_starters
       Henri Giraud Hommage      `dark_chocolate` → removed
       Dom Pérignon P2           `game`           → poultry
       Jacques Selosse Rosé      `game`           → charcuterie

     The last two were an error I made merging the vocabulary: Moët's own note
     says *pigeon*, and `pigeon` → `game` turned a game bird into venison on
     the card.

     These are genuine clashes, not house style. Anything a sommelier would
     defend is left alone — the same rules run in validate.mjs so a bad tag
     fails the deploy rather than reaching a guest. */
  const DESSERT = ["desserts", "fruit_desserts", "dark_chocolate"];
  const RED_MEAT = ["beef", "steak", "lamb", "game", "bbq", "stews", "pasticada"];
  const DELICATE = ["oysters", "caviar", "sushi", "white_fish", "grilled_fish", "shellfish"];
  const bad = [];
  for (const it of items) {
    const ins = it.insight || {};
    if (ins.kind === "spirit" || !ins.style) continue;
    const bubbles = /^(sparkling|champagne)/.test(ins.style);
    for (const p of ins.pairings || []) {
      const at = `${it.producer} — ${it.name} (${ins.style}): ${p}`;
      const sweetish = ins.sweetness === "sweet" || ins.sweetness === "semi_sweet";
      /* A Brut rosé sparkling with a red-fruit dessert is the one allowed
         crossing, and a real pairing — the kitchen's strawberry dish asks for
         champagne_rose itself. */
      const roseBerries = bubbles && /rose$/.test(ins.style) && p === "fruit_desserts";
      if (!sweetish && DESSERT.includes(p) && !roseBerries) bad.push(`${at} — dry wine, sweet dish`);
      if (ins.style === "sweet" && [...RED_MEAT, ...DELICATE, "poultry", "veal", "pork",
          "white_meat", "pasta", "risotto", "pizza"].includes(p)) bad.push(`${at} — sweet wine, savoury main`);
      if (/^(red_full|red_mature)$/.test(ins.style) && DELICATE.includes(p)) bad.push(`${at} — tannin and iodine`);
      if ((bubbles || /^white/.test(ins.style)) && RED_MEAT.includes(p)) bad.push(`${at} — no weight for red meat`);
      if (bubbles && p === "dark_chocolate") bad.push(`${at} — chocolate strips a dry sparkler`);
    }
  }
  expect(bad, "incompatible wine and food").toEqual([]);
});

test("pairings are stored best food first", () => {
  /* Added 2026-08-02 (owner: "rank the best pairing for each wine and match
     them accordingly"). The order is not decoration: the card prints it as
     stored, and `dishScore()` weights the wine's first food at 4 points, its
     second at 3, its third at 2 and the rest at 1. So an order that drifts —
     a new tag appended at the end, say — quietly changes both what a guest
     reads and which wine the sommelier reaches for.

     The table is scripts/lib/pairing-rank.mjs: the style's own order, with a
     short list of grapes whose classic dish outranks it (Nebbiolo takes
     truffles before steak, Riesling takes the spice, Pinot Noir the bird). */
  const bad = [];
  for (const it of items) {
    const ins = it.insight || {};
    if (ins.kind === "spirit" || !ins.pairings) continue;
    const want = rankPairings(ins).join(",");
    const have = ins.pairings.join(",");
    if (want !== have) bad.push(`${it.producer} — ${it.name}: ${have} should be ${want}`);
  }
  expect(bad, "pairings not in ranked order").toEqual([]);
});

test("the ranking table covers every food actually used", () => {
  /* A tag missing from its style's order sorts to the end regardless of how
     good the pairing is — silently. Better to notice. */
  const missing = new Set();
  for (const it of items) {
    const ins = it.insight || {};
    if (ins.kind === "spirit" || !ins.pairings) continue;
    const order = STYLE_ORDER[ins.style] || [];
    for (const p of ins.pairings) if (!order.includes(p)) missing.add(`${ins.style}: ${p}`);
  }
  expect([...missing], "foods with no place in their style's order").toEqual([]);
});

test("a fried dish does not ask for a rich, sweet-edged white", () => {
  /* Added 2026-08-02 (owner: "what was the reasoning for PG Albert Mann with
     residual sugar for wiener schnitzel?"). There wasn't a good one. The dish
     listed `white_rich` among its target styles, so Albert Mann's Hengst —
     off-dry, 14.5%, honey and pineapple — scored three points for being
     exactly what the dish asked for. Breaded and fried wants acidity to cut
     the crumb, which is why Austria drinks Grüner and dry Riesling with it.

     The wine's own `white_meat` tag is fine and stays: an Alsace Grand Cru
     Pinot Gris with roast pork or guinea fowl is classic. It was the dish that
     was wrong. */
  const fried = menu.dishes.filter((d) => /Schnitzel|tempura|Fritto/i.test(d.name.en));
  expect(fried.length, "no fried dishes found — did the menu change?").toBeGreaterThan(1);
  const bad = fried
    .filter((d) => (d.styles || []).includes("white_rich"))
    .map((d) => d.name.en);
  expect(bad, "a fried dish asking for a rich white").toEqual([]);
});

test("the same wine is one library entry, not two that differ only by name", () => {
  /* Added 2026-08-03 (owner spotted it): "Cifra 2021 (Demeter biodinamika)" was
     the by-the-glass listing and "Cifra 2021" the bottle — two library entries,
     byte-identical apart from the parenthetical. The library split collapsed 24
     such duplicates in July by matching on name; this one slipped through
     because the names were not the same.

     A duplicate is not cosmetic. The two drift apart the first time anyone
     edits one of them, and the guest reads different tasting notes for the same
     wine depending on whether they tapped the glass list or the bottle list. */
  const norm = (s) => String(s).toLowerCase().replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  const bad = [];
  const byProducer = new Map();
  for (const [ref, w] of Object.entries(library)) {
    /* Only things with an insight: Coca-Cola and Coca-Cola Zero are two
       products that share a producer and carry no facts to compare. */
    if (!w.insight) continue;
    if (!byProducer.has(w.producer)) byProducer.set(w.producer, []);
    byProducer.get(w.producer).push({ ref, w });
  }
  for (const [, group] of byProducer) {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        const na = norm(a.w.name), nb = norm(b.w.name);
        /* Large formats are a deliberate second entry (the "– 1,5 l" twins). */
        if (/\d\s*l$/.test(na) || /\d\s*l$/.test(nb)) continue;
        if (na !== nb && !na.startsWith(nb) && !nb.startsWith(na)) continue;
        const strip = (x) => JSON.stringify({ ...x.w, name: undefined });
        if (strip(a) === strip(b))
          bad.push(`${a.ref} and ${b.ref} are the same wine under two names`);
      }
  }
  expect(bad, "duplicate library entries").toEqual([]);
});

test("residual sugar is g/l without the unit, and only on wines that have any", () => {
  /* Added 2026-08-03 (owner asked for RS on the 23 non-dry still wines). It
     sits under the same rule as alcohol: the producer's own sheet, or a
     listing quoting the analysis for that exact wine and vintage. A
     neighbouring vintage is not a source — Zilliken's Rausch Kabinett measured
     48.6 g/l in 2023 and 60 in 2019, so borrowing across years invents a
     number.

     Stored as a string so a producer who publishes a range keeps it: widened
     2026-08-03 for Ca' La Bionda's Recioto, which is 120-140 g/l on their own
     page and nothing narrower. See scripts/lib/rs.mjs.

     Populated on nine wines, because nine is how many I could source. See
     CLAUDE.md before spending another day on it: RS is far less published than
     alcohol, and most of the German Prädikat producers publish nothing. */
  const bad = [];
  for (const it of items) {
    const ins = it.insight || {};
    if (ins.rs == null) continue;
    const rs = parseRs(ins.rs);
    if (!rs) { bad.push(`${it.name}: rs is ${JSON.stringify(ins.rs)}, want g/l with no unit`); continue; }
    if (ins.sweetness === "dry") bad.push(`${it.name}: tagged dry but carries a residual-sugar figure`);
    /* A number this size is a dessert wine, whatever the sweetness field says.
       Judged on the bottom of a range: if even that is over the line, so is the
       wine. */
    if (rs.lo > 45 && ins.sweetness !== "sweet") bad.push(`${it.name}: ${ins.rs} g/l is sweet by any definition, but tagged ${ins.sweetness}`);
  }
  expect(bad, "residual-sugar problems").toEqual([]);
  expect(items.filter((i) => (i.insight || {}).rs != null).length,
    "no wine carries a residual-sugar figure any more — was the data lost?").toBeGreaterThan(0);
});
test("no source file contains a stray control character", () => {
  /* 2026-08-04, and this one was invisible for weeks. Writing a regex through
     a shell heredoc collapsed the escape, so `\b` reached the file as a raw
     0x08 byte: `/grk\b/` became `/grk<BS>/`, which is a valid regex that can
     never match, because no text contains a backspace. Three regexes died
     silently that way — the Grk and the Sauvignon rules in pairing-rank.mjs,
     which left both Grks and both Sancerres out of the grape ranking and put
     the wrong food first on four cards, and the leaked-key detector in
     i18n.spec.mjs, which had been matching nothing at all.

     Nothing else caught it: the files parse, the tests pass, and a diff shows
     the byte as an invisible column. So the guard is at the byte level. Tab,
     newline and carriage return are the only control characters this repo has
     any business containing. */
  const ALLOWED = new Set([9, 10, 13]);
  const roots = ["js", "css", "scripts", "tests", "data", "library", "lists"];
  const bad = [];
  const walk = (dir) => {
    for (const e of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(rel); continue; }
      if (!/\.(mjs|js|json|css|html)$/.test(e.name)) continue;
      const buf = readFileSync(resolve(ROOT, rel));
      for (let i = 0; i < buf.length; i++) {
        const c = buf[i];
        if (c < 32 && !ALLOWED.has(c)) {
          const line = buf.subarray(0, i).filter((b) => b === 10).length + 1;
          bad.push(`${rel}:${line}: control byte 0x${c.toString(16).padStart(2, "0")}`);
          break;   /* one report per file is enough to send someone looking */
        }
      }
    }
  };
  roots.forEach(walk);
  expect(bad, "stray control bytes — almost certainly a mangled regex escape").toEqual([]);
});
test("VDP is explained on every card that uses it", () => {
  /* Owner, 2026-08-05: "not sure if people understand what VDP means. we have
     explanation in christmann, but we use it in other places as well." It was
     on four cards and glossed on exactly one. A guest reads one card, not
     four, so the gloss has to travel with the term — the same reason a house
     story lives in producers.json rather than on one bottle's note.

     Checked per language, because a gloss is precisely the clause that
     survives translation into six languages and quietly vanishes in the other
     two. */
  const GLOSS = {
    hr: /udru/i, en: /association/i, it: /associazione/i, fr: /association/i,
    de: /verband/i, zh: /联合会|协会/, sl: /združenj/i, es: /asociaci/i,
  };
  const bad = [];
  let mentions = 0;
  for (const [name, rec] of Object.entries(producers)) {
    if (!rec || !rec.blurb) continue;
    for (const [lc, text] of Object.entries(rec.blurb)) {
      if (!/VDP/.test(text) || !GLOSS[lc]) continue;
      mentions++;
      if (!GLOSS[lc].test(text)) bad.push(`${name}/${lc}: says VDP without saying what it is`);
    }
  }
  expect(bad, "VDP used with no explanation of what it is").toEqual([]);
  /* Otherwise dropping the term everywhere would make this pass vacuously. */
  expect(mentions, "no card mentions the VDP any more — was the guard left behind?").toBeGreaterThan(8);
});
