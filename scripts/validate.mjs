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

for (const r of hidden) {
  const at = `unavailable.json: "${(r && r.name) || "?"}"`;
  if (!r || !r.name) { errors.push(`${at}: every entry needs a "name"`); continue; }
  if (r.where && r.where !== "glass" && r.where !== "bottle")
    errors.push(`${at}: "where" must be "glass" or "bottle" (or left out for both)`);
  const byName = all.filter((x) => norm(x.it.name) === norm(r.name));
  if (!byName.length) { errors.push(`${at}: no wine with that name — check the spelling and the vintage against wines.json`); continue; }
  const byProd = r.producer ? byName.filter((x) => norm(x.it.producer) === norm(r.producer)) : byName;
  if (!byProd.length) { errors.push(`${at}: "${r.producer}" doesn't make it — wines.json says ${[...new Set(byName.map((x) => x.it.producer))].join(", ")}`); continue; }
  const matched = byProd.filter((x) => !r.where || (r.where === "glass" ? x.secId === "glass" : x.secId.startsWith("bottle")));
  if (!matched.length) errors.push(`${at}: not on the list as "${r.where}" — it is in ${[...new Set(byProd.map((x) => x.secId))].join(", ")}`);
  if (!r.producer && new Set(byName.map((x) => norm(x.it.producer))).size > 1)
    errors.push(`${at}: more than one producer makes a wine by that name — add "producer" so it hides the right one`);
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
