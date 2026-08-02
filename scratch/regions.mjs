import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const { list } = joinList();
const regions = JSON.parse(fs.readFileSync("data/regions.json", "utf8")).regions;
const wines = [];
for (const sec of list.sections) for (const c of sec.categories) for (const g of c.groups) for (const it of g.items)
  if (it && it.insight && !it.insight.kind) wines.push(it);

/* bucket a wine by the last rung of its region ladder + country */
const RULES = [
  ["Champagne",            (r,c) => /Champagne/i.test(r)],
  ["Burgundy (Côte d'Or)", (r,c) => /Bourgogne/i.test(r)],
  ["Bordeaux",             (r,c) => /Bordeaux/i.test(r)],
  ["Piedmont",             (r,c) => /Piemonte/i.test(r)],
  ["Tuscany",              (r,c) => /Toscana/i.test(r)],
  ["Dalmatia",             (r,c) => c==="HR" && /Dalmac|Dalmatinska|Komarna|Pelješac|Hvar|Korčula|Konavle|Skradin|Šibenik|Kaštela|Split|Brač|Vis|Neretva|Primošten|Zadar|Benkovac/i.test(r)],
  ["Istria",               (r,c) => c==="HR" && /Istra|Istrian/i.test(r)],
  ["Continental Croatia",  (r,c) => c==="HR"],
  ["Friuli / Collio",      (r,c) => /Friuli|Collio|Isonzo|Carso|Gorizia|Oslavia/i.test(r) && c==="IT"],
  ["Veneto / Valpolicella",(r,c) => /Veneto|Valpolicella|Soave|Prosecco|Amarone/i.test(r)],
  ["Mosel & German Riesling",(r,c)=> c==="DE"],
  ["Slovenia (Brda/Kras)", (r,c) => c==="SI"],
  ["Rhône",                (r,c) => /Rhône|Hermitage|Cornas|Côte-Rôtie|Châteauneuf/i.test(r)],
  ["Loire",                (r,c) => /Loire|Sancerre|Vouvray|Chinon/i.test(r)],
  ["Alsace",               (r,c) => /Alsace/i.test(r)],
  ["Jura",                 (r,c) => /Jura|Château-Chalon/i.test(r)],
  ["Rest of France",       (r,c) => c==="FR"],
  ["Sicily / Etna",        (r,c) => /Sicilia|Etna|Pantelleria/i.test(r)],
  ["Rest of Italy",        (r,c) => c==="IT"],
  ["Spain",                (r,c) => c==="ES"],
  ["California",           (r,c) => /California|Napa|Sonoma|Santa/i.test(r)],
  ["Oregon",               (r,c) => /Oregon|Willamette/i.test(r)],
  ["Austria",              (r,c) => c==="AT"],
  ["China",                (r,c) => c==="CN"],
];
const seen = new Map();
for (const w of wines) {
  const r = w.insight.region || "", c = w.insight.country || "";
  const hit = RULES.find(([, f]) => f(r, c));
  const k = hit ? hit[0] : `?? ${c}`;
  if (!seen.has(k)) seen.set(k, []);
  seen.get(k).push(w);
}
const have = new Set(["Champagne","Burgundy (Côte d'Or)","Bordeaux","Piedmont","Tuscany","Dalmatia"]);
console.log("region                      wines   card?");
for (const [k, ws] of [...seen].sort((a, b) => b[1].length - a[1].length))
  console.log(`  ${k.padEnd(26)} ${String(ws.length).padStart(3)}   ${have.has(k) ? "yes" : "—"}`);
console.log(`\ntotal wines: ${wines.length}; covered by the 6 existing cards: ${[...seen].filter(([k])=>have.has(k)).reduce((a,[,v])=>a+v.length,0)}`);
