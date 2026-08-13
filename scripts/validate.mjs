/* Validates the wine data against js/i18n.js before deploy.
   Run: node scripts/validate.mjs (from repo root). Exits 1 on any problem
   so a broken edit never replaces the live list.

   Since the library split there are three ways to break the data instead of
   one, and the two new ones are silent — a listing pointing at a ref that
   isn't in the library, and a hide rule matching no wine, both end with a
   guest being offered something that isn't there, or not offered something
   that is. Neither is allowed past this script. */
import fs from "node:fs";
import vm from "node:vm";
import { joinList } from "./lib/list.mjs";
import { rankPairings } from "./lib/pairing-rank.mjs";
import { parseRs } from "./lib/rs.mjs";

const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync("js/i18n.js", "utf8") + "\nthis.I18N = I18N; this.LANGS = LANGS;",
  ctx
);
const { I18N, LANGS } = ctx;

/* The spirits vocabulary lives in its own file for the reasons written at the
   top of js/spirits.js. It gets the same treatment as the wine vocabulary: an
   unknown key fails the deploy, because a card that renders "ex_bourbon" at a
   guest is worse than no card. */
const sctx = {};
vm.createContext(sctx);
vm.runInContext(
  fs.readFileSync("js/spirits.js", "utf8") +
    "\nthis.SPIRIT_I18N = SPIRIT_I18N; this.SPIRIT_VESSELS = SPIRIT_VESSELS; this.VESSEL_BY_CLASS = VESSEL_BY_CLASS;",
  sctx
);
const { SPIRIT_I18N, SPIRIT_VESSELS, VESSEL_BY_CLASS } = sctx;

let data, missing = [], orphans = [];
try {
  ({ list: data, missing, orphans } = joinList());
} catch (e) {
  console.error("library/wines.json or lists/theatrium.json is not valid JSON:\n" + e.message);
  console.error("Tip: a missing comma or quote is the usual cause. Undo the last edit and retry.");
  process.exit(1);
}

const errors = [];

/* A listing whose ref isn't in the library would just vanish off the list —
   the wine is on the shelf, priced, and no guest ever sees it. */
for (const ref of new Set(missing))
  errors.push(`lists/theatrium.json: "${ref}" is not in library/wines.json — check the ref`);
const langs = LANGS.map((l) => l.code);

for (const sec of data.sections) {
  for (const lc of langs) if (!I18N[lc].sections[sec.id]) errors.push(`${lc}: unknown section id "${sec.id}"`);
  for (const cat of sec.categories) {
    for (const lc of langs) if (!I18N[lc].categories[cat.id]) errors.push(`${lc}: unknown category id "${cat.id}"`);
    for (const g of cat.groups) {
      if (g.country) for (const lc of langs) if (!I18N[lc].countries[g.country]) errors.push(`${lc}: unknown country "${g.country}"`);
      for (const item of g.items) {
        const where = `${sec.id}/${cat.id}: "${item.name || "?"}"`;
        if (!item.name) errors.push(`item without name in ${sec.id}/${cat.id}`);
        if (item.price != null && typeof item.price !== "number") errors.push(`${where}: price must be a number (no quotes, no €)`);
        /* The bottle format belongs to the listing, in litres, as a number:
           `"vol": 0.375`, never "0,375 l" and never inside the name. The app
           formats it per language; a string here would print a Croatian decimal
           comma to a German. */
        if (item.vol != null && (typeof item.vol !== "number" || !(item.vol > 0)))
          errors.push(`${where}: vol must be litres as a number, e.g. 0.375 (got ${JSON.stringify(item.vol)})`);
        if (/\d\s*(l|ml|cl)\s*$/i.test(String(item.name || "")))
          errors.push(`${where}: the bottle format goes in "vol" on the list item, not in the name`);
        /* Residual sugar is grams per litre without the unit — "144" or the
           range "120–140", never "144 g/l". It is only present where a producer
           published it for that exact vintage, so a shape we can't read here is
           a paste error. See scripts/lib/rs.mjs for why it is a string. */
        if (item.insight && item.insight.rs != null) {
          if (!parseRs(item.insight.rs))
            errors.push(`${where}: insight.rs must be g/l with no unit — "144" or "120–140" (got ${JSON.stringify(item.insight.rs)})`);
          if (item.insight.sweetness === "dry")
            errors.push(`${where}: a wine tagged dry should not carry a residual-sugar figure`);
        }
        if (item.ratings) for (const r of item.ratings) {
          if (!r.critic || !r.score) errors.push(`${where}: each rating needs "critic" and "score"`);
        }
        if (item.note != null && (typeof item.note !== "object" || Array.isArray(item.note) ||
            Object.values(item.note).some((v) => typeof v !== "string"))) {
          errors.push(`${where}: "note" must be an object like {"hr": "...", "en": "..."}`);
        }
        const ins = item.insight;
        if (!ins) continue;
        if (ins.kind === "spirit") {
          if (ins.vessel && !SPIRIT_VESSELS[ins.vessel]) errors.push(`${where}: unknown vessel "${ins.vessel}"`);
          if (!VESSEL_BY_CLASS[ins.class]) errors.push(`${where}: class "${ins.class}" has no glass in VESSEL_BY_CLASS`);
          for (const lc of langs) {
            const s = SPIRIT_I18N[lc], t = I18N[lc];
            if (!s) { errors.push(`js/spirits.js has no "${lc}"`); continue; }
            /* Unlike a wine, a spirit may legitimately have no country: a blend
               of Barbados and Jamaica belongs to neither, and an independent
               bottling sometimes will not say. An empty string is that answer;
               a wrong code still fails. */
            if (ins.country && !t.countries[ins.country]) errors.push(`${lc}: unknown country "${ins.country}" (${where})`);
            if (!s.classes[ins.class]) errors.push(`${lc}: unknown spirit class "${ins.class}" (${where})`);
            for (const [dict, keys] of [["bases", ins.base], ["stills", ins.still], ["casks", ins.cask], ["serves", ins.serve]])
              for (const k of keys || []) if (!s[dict][k]) errors.push(`${lc}: unknown ${dict} key "${k}" (${where})`);
            /* Aromas and pairings may come from either dictionary: the spirits
               file adds what wine never needed (peat, koji, cubeb pepper) and
               everything else is shared with the wine cards. */
            for (const a of ins.aromas || []) if (!s.aromas[a] && !t.aromas[a]) errors.push(`${lc}: unknown aroma "${a}" (${where})`);
            for (const p of ins.pairings || []) if (!s.pairings[p] && !t.pairings[p]) errors.push(`${lc}: unknown pairing "${p}" (${where})`);
          }
          continue;
        }
        for (const lc of langs) {
          const t = I18N[lc];
          if (!t.styles[ins.style]) errors.push(`${lc}: unknown style "${ins.style}" (${where})`);
          if (!t.bodies[ins.body]) errors.push(`${lc}: unknown body "${ins.body}" (${where})`);
          if (!t.countries[ins.country]) errors.push(`${lc}: unknown country "${ins.country}" (${where})`);
          for (const a of ins.aromas || []) if (!t.aromas[a]) errors.push(`${lc}: unknown aroma "${a}" (${where})`);
          for (const p of ins.pairings || []) if (!t.pairings[p]) errors.push(`${lc}: unknown pairing "${p}" (${where})`);
        }
      }
    }
  }
}

/* data/unavailable.json — the temporarily-out-of-stock list.
   A rule that matches nothing is the dangerous failure: the owner believes a
   wine is hidden, the guest is offered it, and the waiter has to apologise.
   So a typo is an error here, not a shrug. */
let hidden = [];
try {
  hidden = JSON.parse(fs.readFileSync("data/unavailable.json", "utf8")).hidden || [];
} catch (e) {
  if (e.code !== "ENOENT") {
    console.error("data/unavailable.json is not valid JSON:\n" + e.message);
    process.exit(1);
  }
}
const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();
const all = [];
for (const sec of data.sections)
  for (const cat of sec.categories)
    for (const g of cat.groups) for (const it of g.items) all.push({ it, secId: sec.id });

/* ---- wine and food have to be compatible, not merely both present ----
   Owner, 2026-08-02: "I don't want non-compatible wine-food pairings... quality
   before quantity". Every one of the 964 tags was read against these five
   rules; four wines failed and were corrected. The rules stay so the next edit
   is checked rather than trusted, and each carries the reason a sommelier
   would give, because "explain it" was half the request.

   These describe genuine clashes, not merely unusual choices. Anything a
   reasonable sommelier would defend is left alone — this is a floor, not a
   house style. */
const DESSERT_FOOD = ["desserts", "fruit_desserts", "dark_chocolate"];
const RED_MEAT_FOOD = ["beef", "steak", "lamb", "game", "bbq", "stews", "pasticada"];
const DELICATE_FOOD = ["oysters", "caviar", "sushi", "white_fish", "grilled_fish", "shellfish"];
const PAIRING_RULES = [
  ["a dry wine with a sweet dish tastes thin and sour — the sugar in the food must never outrun the sugar in the glass",
    (ins, p) => ins.sweetness !== "sweet" && ins.sweetness !== "semi_sweet" && DESSERT_FOOD.includes(p)
      /* One exception, and it is a real pairing rather than a loophole: a Brut
         rosé sparkling with a red-fruit dessert. The acidity matches the fruit's
         and the wine's own red-berry character echoes it — which is why the
         kitchen's strawberry dessert lists champagne_rose itself. Generic
         `desserts` and `dark_chocolate` stay forbidden even here. */
      && !(/rose$/.test(ins.style) && /^(sparkling|champagne)/.test(ins.style) && p === "fruit_desserts")],
  ["a sweet wine with a savoury main is a clash of purpose — blue cheese, foie gras and pudding are what it is for",
    (ins, p) => ins.style === "sweet" &&
      [...RED_MEAT_FOOD, ...DELICATE_FOOD, "seafood", "light_starters", "aperitif",
       "poultry", "veal", "pork", "white_meat", "pasta", "risotto", "pizza"].includes(p)],
  ["tannin plus iodine reads metallic: a big red ruins oysters, caviar and raw fish, and they ruin it back",
    (ins, p) => /^(red_full|red_mature)$/.test(ins.style) && DELICATE_FOOD.includes(p)],
  ["a white or a sparkling has no weight for red meat or game",
    (ins, p) => /^(white|sparkling|champagne)/.test(ins.style) && RED_MEAT_FOOD.includes(p)],
  ["dark chocolate needs residual sugar and body; it strips a dry sparkling wine bare",
    (ins, p) => /^(sparkling|champagne)/.test(ins.style) && p === "dark_chocolate"]
];
for (const { it } of all) {
  const ins = it.insight;
  if (!ins || ins.kind === "spirit") continue;
  for (const p of ins.pairings || [])
    for (const [why, clash] of PAIRING_RULES)
      if (clash(ins, p))
        errors.push(`${it.producer} — ${it.name}: "${p}" does not go with a ${ins.style} — ${why}`);
}

for (const r of hidden) {
  const at = `unavailable.json: "${(r && r.name) || "?"}"`;
  if (!r || !r.name) { errors.push(`${at}: every entry needs a "name"`); continue; }
  if (r.where && r.where !== "glass" && r.where !== "bottle")
    errors.push(`${at}: "where" must be "glass" or "bottle" (or left out for both)`);
  const byName = all.filter((x) => norm(x.it.name) === norm(r.name));
  if (!byName.length) { errors.push(`${at}: no wine with that name — check the spelling and the vintage against wines.json`); continue; }
  const byProd = r.producer ? byName.filter((x) => norm(x.it.producer) === norm(r.producer)) : byName;
  if (!byProd.length) { errors.push(`${at}: "${r.producer}" doesn't make it — wines.json says ${[...new Set(byName.map((x) => x.it.producer))].join(", ")}`); continue; }
  /* `vol` narrows the rule to one format — the magnum out, the 0,75 still
     poured. A vol nobody stocks is the same silent failure as a misspelt name. */
  const byVol = r.vol == null ? byProd : byProd.filter((x) => Number(r.vol) === x.it.vol);
  if (!byVol.length) {
    errors.push(`${at}: not listed in ${r.vol} l — the sizes on the list are ${[...new Set(byProd.map((x) => x.it.vol || 0.75))].join(", ")}`);
    continue;
  }
  const matched = byVol.filter((x) => !r.where || (r.where === "glass" ? x.secId === "glass" : x.secId.startsWith("bottle")));
  if (!matched.length) errors.push(`${at}: not on the list as "${r.where}" — it is in ${[...new Set(byProd.map((x) => x.secId))].join(", ")}`);
  if (!r.producer && new Set(byName.map((x) => norm(x.it.producer))).size > 1)
    errors.push(`${at}: more than one producer makes a wine by that name — add "producer" so it hides the right one`);
}

/* data/menu.json — the kitchen's dishes, and the only other file that speaks
   the pairing vocabulary. It was never checked, and it showed: the Tiramisu
   asked for a pairing called `coffee`, which is in no dictionary and on no
   wine, so it silently scored zero and nobody could see that it had. A dish
   key that no wine carries is the same kind of quiet failure as an unresolved
   ref — the helper still answers, just worse, and never says why. */
let menu = { dishes: [] };
try {
  menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") {
    console.error("data/menu.json is not valid JSON:\n" + e.message);
    process.exit(1);
  }
}
const winePairings = new Set();
const wineStyles = new Set();
for (const { it } of all) {
  const ins = it.insight || {};
  for (const p of ins.pairings || []) winePairings.add(p);
  if (ins.style) wineStyles.add(ins.style);
}
const thin = [];
for (const dish of menu.dishes || []) {
  const at = `menu.json: "${(dish.name && dish.name.en) || "?"}"`;
  if (!dish.name || !dish.name.en) { errors.push(`${at}: every dish needs a name in all languages`); continue; }
  for (const l of langs) if (!dish.name[l]) errors.push(`${at}: missing the ${l} name`);
  if (!(menu.courses || []).includes(dish.course)) errors.push(`${at}: course "${dish.course}" is not in menu.courses`);
  for (const p of dish.pairings || []) {
    if (!I18N.hr.pairings[p]) errors.push(`${at}: pairing "${p}" is in no language — add it to js/i18n.js or use an existing key`);
    else if (!winePairings.has(p)) errors.push(`${at}: pairing "${p}" is on no wine we pour, so it can never score — tag some wines or drop it`);
    else {
      const n = all.filter((x) => ((x.it.insight || {}).pairings || []).includes(p)).length;
      if (n < 5) thin.push(`${p} (${n} wine${n === 1 ? "" : "s"})`);
    }
  }
  for (const s of dish.styles || []) {
    if (!I18N.hr.styles[s]) errors.push(`${at}: style "${s}" is not a wine style`);
    else if (!wineStyles.has(s)) errors.push(`${at}: style "${s}" is on no wine we pour`);
  }
}

if (errors.length) {
  console.error("Validation failed:\n" + [...new Set(errors)].join("\n"));
  process.exit(1);
}
const listed = all.length;
console.log(`list OK — ${listed} listings, all keys resolve in ${langs.join(", ")}`);
console.log(hidden.length
  ? `unavailable.json OK — ${hidden.length} wine(s) hidden from guests`
  : "unavailable.json OK — nothing hidden");
/* Not an error: a wine this venue stopped pouring stays in the library on
   purpose, ready for the next list. Worth saying, so a ref typo that both
   drops a listing and strands its wine reads as the one mistake it is. */
if (orphans.length)
  console.log(`note — ${orphans.length} library wine(s) this list doesn't pour: ${orphans.slice(0, 5).join(", ")}${orphans.length > 5 ? ", …" : ""}`);
console.log(`menu OK — ${(menu.dishes || []).length} dishes, every pairing and style reachable`);
/* Also not an error, but worth saying out loud: a dish asking for a pairing
   almost no wine carries falls back to matching on style alone, and the
   suggestions get vaguer without anything looking broken. */
/* The sommelier only suggests a wine whose own card names the food, so a dish
   with almost no by-the-glass matches gets a thin, repetitive glass answer —
   which is how one Cabernet Franc came to be the standing suggestion for
   Wiener Schnitzel: `veal` is on none of the 32 pours and `white_meat` on
   three. Not an error; the shelf is the shelf. Worth saying where it is seen. */
const byGlass = all.filter((x) => x.secId === "glass").map((x) => x.it);
const glassThin = [];
for (const dish of menu.dishes || []) {
  const n = byGlass.filter((w) => ((w.insight || {}).pairings || [])
    .some((p) => (dish.pairings || []).includes(p))).length;
  if (n < 3) glassThin.push(`${dish.name.hr || dish.name.en} (${n})`);
}
/* The pairings are stored best-food-first, which is both what the card prints
   and what dishScore() weights — so an order that has drifted quietly changes
   the suggestions. A note rather than an error: the owner is allowed to know
   better than the table for a given wine. */
const misordered = [];
for (const { it } of all) {
  const ins = it.insight;
  if (!ins || ins.kind === "spirit" || !ins.pairings) continue;
  const want = rankPairings(ins);
  if (want.join(",") !== ins.pairings.join(","))
    misordered.push(`${it.producer} — ${it.name} (${ins.pairings.join(",")} → ${want.join(",")})`);
}
if (misordered.length) {
  const shown = misordered.slice(0, 6).map((x) => `\n       ${x}`).join("");
  console.log(`note — ${misordered.length} wine(s) whose pairings are not in ranked order:` +
    shown + (misordered.length > 6 ? "\n       …" : ""));
}

/* `red_mature` is the one style that describes *age* rather than weight, which
   makes it easy to forget: a dish lists red_full and the aged Cabernets
   silently drop out of its suggestions. Every mature red on this list is a
   serious red of full or medium body, and age only makes it a better match for
   a rich dish — so a dish asking for red_full almost certainly wants
   red_mature too. A note, because "almost certainly" is not "always". */
const forgotMature = (menu.dishes || [])
  .filter((d) => (d.styles || []).includes("red_full") && !(d.styles || []).includes("red_mature"))
  .map((d) => d.name.hr || d.name.en);
if (forgotMature.length)
  console.log(`note — dishes asking for red_full but not red_mature: ${forgotMature.join(", ")}`);

if (glassThin.length)
  console.log(`note — dishes with under three by-the-glass matches: ${glassThin.join(", ")}`);
if (thin.length)
  console.log(`note — thin pairings the menu leans on: ${[...new Set(thin)].sort().join(", ")}`);
/* Blurb density (2026-08-05). The owner asked whether there is a character
   limit for producer blurbs. There is not, and the numbers say why: the blurb
   he loved most is 577 characters and the one he called tiring was 813. What
   separated them was distinct years — one against six — because a card that
   lists a founding, a marriage, a takeover and two certifications is a CV, and
   a CV is tiring at any length.

   So this is a note, not an error, and it never gates the deploy: a long card
   that tells one story is fine, and the owner overrides this whenever the
   story earns it. It is here to catch the ones that drifted back into being a
   CV without anybody rereading them. See CLAUDE.md, "One story per card". */
const producers = JSON.parse(fs.readFileSync("data/producers.json", "utf8")).producers || {};
const YEARS = /\b1[4-9]\d\d|\b20[0-2]\d/g;
const wordy = [], listy = [];
for (const [name, rec] of Object.entries(producers)) {
  const hr = ((rec || {}).blurb || {}).hr;
  if (!hr) continue;
  if (hr.length > 600) wordy.push(`${name} (${hr.length})`);
  const years = new Set(hr.match(YEARS) || []);
  if (years.size >= 4) listy.push(`${name} (${years.size} years)`);
}
if (wordy.length)
  console.log(`note — blurbs over 600 characters, check they are one story: ${wordy.join(", ")}`);
if (listy.length)
  console.log(`note — blurbs reading like a CV, 4+ distinct years: ${listy.join(", ")}`);
