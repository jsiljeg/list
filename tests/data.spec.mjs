/* Data invariants — the conventions written down in CLAUDE.md, checked instead
   of trusted. These need no browser and run in a second.

   Guards: 1ddedd7 (the style line's casing), the region rule that produced
   "France, Francuska" by putting the country in insight.region, the large-format
   twin rule (a wine and its 1,5 l must carry identical insight), the blend
   notation (name first, descending share), the critic-name list, and 87dffea
   (a producer's region contradicting the wine's). */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { allItems, producers } from "./helpers.mjs";

/* import.meta.dirname needs Node 20.11; this works everywhere. */
const HERE = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(HERE, "..");
const items = allItems();
const i18n = readFileSync(resolve(ROOT, "js/i18n.js"), "utf8");

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

test("critic names come from the agreed list", () => {
  /* "Wine Advocate" instead of "Robert Parker" is the one that keeps recurring. */
  const KNOWN = new Set(["Robert Parker", "James Suckling", "Wine Spectator", "Wine Enthusiast", "Vinous",
    "Decanter", "Falstaff", "Jasper Morris", "Tim Atkin", "Jancis Robinson", "Lobenberg", "Jeff Leve",
    "Jeb Dunnuck", "Jeannie Cho Lee", "Stuart Pigott"]);
  const bad = [];
  for (const it of items) for (const r of it.ratings || []) {
    if (!KNOWN.has(r.critic)) bad.push(`${it.name}: "${r.critic}"`);
    if (r.critic === "Jancis Robinson" && !/\/20/.test(String(r.score))) bad.push(`${it.name}: Jancis Robinson not out of 20 (${r.score})`);
  }
  expect(bad).toEqual([]);
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

test("wines.json round-trips byte for byte", () => {
  /* CLAUDE.md: both data files must survive json.dumps(indent=1) + CRLF, so a
     structural edit never rewrites the whole file. A diff of 5000 lines hides
     the one line that mattered. */
  const raw = readFileSync(resolve(ROOT, "data/wines.json"), "utf8");
  const round = JSON.stringify(JSON.parse(raw), null, 1) + "\n";
  expect(raw.replace(/\r\n/g, "\n"), "file is not in canonical form").toBe(round);
});
