import { joinList } from "../scripts/lib/list.mjs";
const { list } = joinList();
const wines = [];
for (const sec of list.sections) for (const c of sec.categories) for (const g of c.groups) for (const it of g.items)
  if (it && it.insight && !it.insight.kind) wines.push(it);
const groups = {
  "GERMANY":     (w) => w.insight.country === "DE",
  "ISTRIA":      (w) => w.insight.country === "HR" && /Istra/i.test(w.insight.region),
  "VENETO":      (w) => /Veneto|Valpolicella|Soave|Prosecco/i.test(w.insight.region),
  "FRIULI":      (w) => /Friuli|Collio|Isonzo|Kras|Carso|Gorizia|Oslavia/i.test(w.insight.region) && w.insight.country === "IT",
  "CONT-CROATIA":(w) => w.insight.country === "HR" && !/Istra/i.test(w.insight.region) && !/Dalmac|Dalmatinska|Komarna|Pelješac|Hvar|Korčula|Konavle|Skradin|Šibenik|Kaštela|Brač|Vis|Neretva|Primošten|Zadar|Benkovac/i.test(w.insight.region),
};
for (const [name, f] of Object.entries(groups)) {
  const ws = wines.filter(f);
  const uniq = new Map();
  for (const w of ws) uniq.set(w.insight.region, (uniq.get(w.insight.region) || 0) + 1);
  console.log(`\n=== ${name}  (${ws.length} listings, ${new Set(ws.map(w=>w.producer)).size} producers)`);
  for (const [r, n] of [...uniq].sort((a,b)=>b[1]-a[1])) console.log(`   ${String(n).padStart(2)}  ${r}`);
  console.log("   producers: " + [...new Set(ws.map(w=>w.producer))].join(", "));
}
