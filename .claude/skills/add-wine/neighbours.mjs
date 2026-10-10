/* The wines already on the list that a new one should agree with.

     node .claude/skills/add-wine/neighbours.mjs <ref>            a library wine
     node .claude/skills/add-wine/neighbours.mjs draft.json       a draft (see add.py)

   A new card is judged against its shelf, not in a vacuum: the glass, the
   serving temperature, the body and the vocabulary of aromas and foods should
   read like the wines a guest will open next to it. This prints the closest
   ones — same producer, then same style and leading grape, then same style
   and region — with the glass the app would actually draw for each
   (glassFor() from js/app.js, run as-is), and flags where the new wine
   departs from the majority. A departure is allowed; it has to be a reason,
   not an accident. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = new URL("../../../", import.meta.url);
const rd = (p) => JSON.parse(readFileSync(new URL(p, ROOT), "utf8"));
const lib = rd("library/wines.json").wines;
const list = rd("lists/theatrium.json");

/* glassFor, lifted out of the app so the answer is the app's, not a copy. */
const src = readFileSync(new URL("js/app.js", ROOT), "utf8");
const a = src.indexOf("function glassFor("), b = src.indexOf("\n}\n", a) + 2;
const known = [...src.matchAll(/^\s{2}(\w+):\s*'<svg/gm)].map((m) => m[1]);
const glassFor = new Function("GLASS_ICONS", `${src.slice(a, b)}; return glassFor;`)(
  Object.fromEntries(known.map((k) => [k, true])));
const glassOf = (w) => w.insight ? glassFor(w.insight.style, w.insight.grape, w.insight.glass, w.insight.region) : null;
/* The keys are internal names, and "burgundy" is not the Burgundy glass — it
   is the wide red cone. The first cloud run read the key and told Filho the
   Amarone goes in "čaša za Bordeaux". Say what each one is, in Croatian too. */
const GLASS_NAME = {
  champagne: "flute — čaša za pjenušac", riesling: "uska čaša za bijelo (Riesling)",
  chardonnay: "široka čaša za bijelo (Chardonnay)", burgundy: "široki stožac za crno",
  winewingsBordeaux: "Winewings Bordeaux (Cabernet, Merlot)", winewingsBurgundy: "Winewings Burgundy (Pinot noir, Nebbiolo)",
  dessert: "čaša za desertno vino",
};
const glassText = (w) => { const k = glassOf(w); return k ? `${k} = ${GLASS_NAME[k] || k}` : "—"; };

const arg = process.argv[2];
if (!arg) { console.error("usage: neighbours.mjs <ref | draft.json>"); process.exit(1); }
let ref = arg, wine = lib[arg];
if (!wine) {
  const d = JSON.parse(readFileSync(resolve(arg), "utf8"));
  wine = d.wine; ref = d.ref || "(draft)";
}
if (!wine || !wine.insight) { console.error(`no wine: ${arg}`); process.exit(1); }

/* price per ref, from the list, so a neighbour can be read for what it costs */
const price = new Map();
(function walk(n) {
  if (Array.isArray(n)) return n.forEach(walk);
  if (n && typeof n === "object") {
    if (n.ref && n.price != null && !price.has(n.ref)) price.set(n.ref, n.price);
    Object.values(n).forEach(walk);
  }
})(list);

const I = wine.insight;
const first = (g) => String(g || "").split(",")[0].replace(/\s*\d+(?:[.,]\d+)?%$/, "").trim().toLowerCase();
const rungs = (r) => String(r || "").split(",").map((s) => s.trim()).filter(Boolean);
const shareRung = (x) => rungs(x).some((r) => rungs(I.region).includes(r));
const pool = Object.entries(lib).filter(([r, w]) => r !== ref && w.insight && !w.insight.kind && price.has(r));
const pick = (f, why) => pool.filter(([r, w]) => f(w)).map(([r, w]) => ({ r, w, why }));
const seen = new Set();
const near = [
  ...pick((w) => w.producer === wine.producer, "same producer"),
  ...pick((w) => w.insight.style === I.style && first(w.insight.grape) === first(I.grape) && shareRung(w.insight.region), "style + grape + region"),
  ...pick((w) => w.insight.style === I.style && first(w.insight.grape) === first(I.grape), "style + grape"),
  ...pick((w) => w.insight.style === I.style && shareRung(w.insight.region), "style + region"),
].filter((x) => !seen.has(x.r) && seen.add(x.r)).slice(0, 10);

const line = (r, w, why) => {
  const x = w.insight;
  return `${(why || "").padEnd(22)} ${String(price.get(r) ?? "").padStart(5)} €  ${w.producer} — ${w.name}\n` +
    `${"".padEnd(31)}${x.style} · ${x.body} · ${x.temp} °C · glass ${glassText(w)}${x.glass ? " (override)" : ""} · ${x.alcohol || "—"}%\n` +
    `${"".padEnd(31)}aromas: ${(x.aromas || []).join(", ")}\n${"".padEnd(31)}food:   ${(x.pairings || []).join(", ")}`;
};

console.log(`NEW  ${wine.producer} — ${wine.name}  [${ref}]`);
console.log(line(ref, wine, "this wine").replace(/^.*?€  /, "".padEnd(31)));
console.log(`\nCLOSEST ON THE LIST`);
for (const { r, w, why } of near) console.log(line(r, w, why));

const majority = (vals) => {
  const c = new Map(); vals.filter(Boolean).forEach((v) => c.set(v, (c.get(v) || 0) + 1));
  const top = [...c.entries()].sort((p, q) => q[1] - p[1])[0];
  return top && top[1] >= 2 ? top : null;
};
const peers = near.filter((x) => x.why !== "same producer" || near.length < 3).map((x) => x.w);
const flags = [];
for (const [label, mine, theirs] of [
  ["glass", glassOf(wine), peers.map(glassOf)],
  ["temp", I.temp, peers.map((w) => w.insight.temp)],
  ["body", I.body, peers.map((w) => w.insight.body)],
]) {
  const m = majority(theirs);
  if (m && m[0] !== mine) flags.push(`  ${label}: this wine says ${mine}, ${m[1]} of its neighbours say ${m[0]}`);
}
const vocab = (k) => new Set(peers.flatMap((w) => w.insight[k] || []));
const lonelyAromas = (I.aromas || []).filter((x) => !vocab("aromas").has(x));
const lonelyFood = (I.pairings || []).filter((x) => !vocab("pairings").has(x));
if (lonelyAromas.length) flags.push(`  aromas no neighbour uses: ${lonelyAromas.join(", ")} (fine if the producer's note says so)`);
if (lonelyFood.length) flags.push(`  foods no neighbour carries: ${lonelyFood.join(", ")}`);
console.log(`\n${flags.length ? "DEPARTURES — each needs a reason:\n" + flags.join("\n") : "No departures from the neighbours."}`);
