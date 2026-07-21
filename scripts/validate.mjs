/* Validates data/wines.json against js/i18n.js before deploy.
   Run: node scripts/validate.mjs (from repo root). Exits 1 on any problem
   so a broken edit never replaces the live list. */
import fs from "node:fs";
import vm from "node:vm";

const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync("js/i18n.js", "utf8") + "\nthis.I18N = I18N; this.LANGS = LANGS;",
  ctx
);
const { I18N, LANGS } = ctx;

let data;
try {
  data = JSON.parse(fs.readFileSync("data/wines.json", "utf8"));
} catch (e) {
  console.error("data/wines.json is not valid JSON:\n" + e.message);
  console.error("Tip: a missing comma or quote is the usual cause. Undo the last edit and retry.");
  process.exit(1);
}

const errors = [];
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
        const ins = item.insight;
        if (!ins) continue;
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

if (errors.length) {
  console.error("Validation failed:\n" + [...new Set(errors)].join("\n"));
  process.exit(1);
}
console.log("wines.json OK — all keys resolve in", langs.join(", "));
