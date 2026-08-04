/* Builds a readable proof sheet of every producer blurb, for the owner to check.
   One-shot generator; re-run after editing data/producers.json. */
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("scratch/producers-export.json", "utf8"));

const COUNTRY = {
  HR: "Hrvatska", FR: "Francuska", IT: "Italija", DE: "Njemačka", AT: "Austrija",
  ES: "Španjolska", SI: "Slovenija", US: "SAD", CN: "Kina", PT: "Portugal",
  SCT: "Škotska", IE: "Irska", JP: "Japan", TW: "Tajvan", MX: "Meksiko",
  JM: "Jamajka", HT: "Haiti", BB: "Barbados", GD: "Grenada", AU: "Australija",
  CH: "Švicarska", LV: "Latvija", "": "Ostalo"
};
const ORDER = ["HR", "FR", "IT", "DE", "AT", "ES", "SI", "US", "CN", "PT"];
const rank = (c) => { const i = ORDER.indexOf(c); return i === -1 ? 90 : i; };

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SEC = { glass: "na čašu", "bottle-sparkling": "pjenušac", "bottle-white": "bijelo",
  "bottle-rose": "rosé", "bottle-red": "crno", "bottle-dessert": "desertno",
  spirits: "žestoko", "rakija-beer": "rakija", other: "ostalo" };
const prettyWhere = (w) => w.split(" · ").map((s) => {
  const m = s.match(/^(\S+)\s+(.+)$/);
  return m ? `${SEC[m[1]] || m[1]} ${m[2]}` : s;
}).join(" · ");

const groups = new Map();
for (const p of data) {
  const c = p.country || "";
  if (!groups.has(c)) groups.set(c, []);
  groups.get(c).push(p);
}
const ordered = [...groups].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));

let body = "";
for (const [code, list] of ordered) {
  const wineN = list.reduce((n, p) => n + p.wines.length, 0);
  body += `<section class="country" id="c-${esc(code || "x")}">
    <h2 class="country-name">${esc(COUNTRY[code] || code)}
      <span class="country-meta">${list.length} ${list.length === 1 ? "proizvođač" : "proizvođača"} · ${wineN} ${wineN === 1 ? "etiketa" : "etiketa"}</span>
    </h2>`;
  for (const p of list) {
    const many = p.wines.length >= 4;
    body += `<article class="prod${many ? " prod--many" : ""}" data-id="${esc(p.producer)}"
        data-search="${esc((p.producer + " " + p.region + " " + p.hr + " " + p.en).toLowerCase())}">
      <header class="prod-head">
        <label class="tick"><input type="checkbox" data-id="${esc(p.producer)}"><span aria-hidden="true"></span><span class="sr">Provjereno</span></label>
        <h3 class="prod-name">${esc(p.producer)}</h3>
        <p class="prod-meta">
          ${p.region ? `<span class="region">${esc(p.region)}</span>` : ""}
          <span class="count${many ? " count--many" : ""}">${p.wines.length} ${p.wines.length === 1 ? "etiketa" : "etiketa"}</span>
        </p>
      </header>
      <ul class="labels">${p.wines.map((w) =>
        `<li><span class="label-name">${esc(w.name)}</span><span class="label-where">${esc(prettyWhere(w.where))}</span></li>`).join("")}</ul>
      <div class="blurbs">
        <div class="blurb"><span class="lang">hr</span><p>${esc(p.hr) || "<em>nema teksta</em>"}</p></div>
        <div class="blurb blurb--en"><span class="lang">en</span><p>${esc(p.en) || "<em>no text</em>"}</p></div>
      </div>
    </article>`;
  }
  body += `</section>`;
}

const nav = ordered.map(([c, l]) =>
  `<a href="#c-${esc(c || "x")}">${esc(COUNTRY[c] || c)}<span>${l.length}</span></a>`).join("");

const html = `<title>Theatrium — tekstovi o vinarijama</title>
<style>
:root {
  color-scheme: light dark;
  --paper: #f1f0ea;
  --card: #fbfaf6;
  --ink: #1b1a17;
  --muted: #6e6d64;
  --rule: #d9d7ce;
  --gold: #8a6d33;
  --gold-dim: #b9a97f;
  --flag: #9c4221;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --sans: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #161513; --card: #1e1c19; --ink: #efe9dd; --muted: #9a9384;
    --rule: #35322d; --gold: #c9a961; --gold-dim: #7c7466; --flag: #d08a5e;
  }
}
:root[data-theme="dark"] {
  --paper: #161513; --card: #1e1c19; --ink: #efe9dd; --muted: #9a9384;
  --rule: #35322d; --gold: #c9a961; --gold-dim: #7c7466; --flag: #d08a5e;
}
:root[data-theme="light"] {
  --paper: #f1f0ea; --card: #fbfaf6; --ink: #1b1a17; --muted: #6e6d64;
  --rule: #d9d7ce; --gold: #8a6d33; --gold-dim: #b9a97f; --flag: #9c4221;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--paper); color: var(--ink);
  font-family: var(--sans); line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.top {
  position: sticky; top: 0; z-index: 5;
  background: color-mix(in srgb, var(--paper) 94%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--rule);
}
.top-in {
  max-width: 78rem; margin: 0 auto; padding: 1rem 1.5rem .8rem;
  display: flex; flex-wrap: wrap; gap: .8rem 1.4rem; align-items: baseline;
}
h1 {
  font-family: var(--serif); font-size: 1.35rem; font-weight: 600;
  margin: 0; letter-spacing: .01em;
}
h1 span { color: var(--muted); font-weight: 400; font-size: .85em; }
.tools { margin-left: auto; display: flex; gap: .7rem; align-items: center; }
#q {
  font: inherit; font-size: .9rem; padding: .42rem .7rem; min-width: 15rem;
  background: var(--card); color: var(--ink);
  border: 1px solid var(--rule); border-radius: 6px;
}
#q:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
.progress {
  font-size: .82rem; color: var(--muted); font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.progress b { color: var(--gold); font-weight: 600; }
.reset {
  font: inherit; font-size: .8rem; background: none; color: var(--muted);
  border: 1px solid var(--rule); border-radius: 999px; padding: .25rem .7rem; cursor: pointer;
}
.reset:hover { color: var(--ink); border-color: var(--gold-dim); }
nav {
  max-width: 78rem; margin: 0 auto; padding: 0 1.5rem .7rem;
  display: flex; flex-wrap: wrap; gap: .3rem .45rem;
}
nav a {
  font-size: .76rem; letter-spacing: .04em; text-transform: uppercase;
  color: var(--muted); text-decoration: none;
  border: 1px solid var(--rule); border-radius: 999px; padding: .2rem .6rem;
  display: inline-flex; gap: .4rem; align-items: baseline;
}
nav a span { font-variant-numeric: tabular-nums; opacity: .6; }
nav a:hover { color: var(--ink); border-color: var(--gold-dim); }

main { max-width: 78rem; margin: 0 auto; padding: 2rem 1.5rem 6rem; }
.intro {
  font-family: var(--serif); font-size: 1.02rem; color: var(--muted);
  max-width: 60ch; margin: 0 0 2.4rem; line-height: 1.6;
}
.intro strong { color: var(--ink); font-weight: 600; }

.country { margin-bottom: 3rem; }
.country-name {
  font-family: var(--serif); font-size: 1.5rem; font-weight: 600; margin: 0 0 1.2rem;
  padding-bottom: .45rem; border-bottom: 2px solid var(--gold);
  display: flex; flex-wrap: wrap; gap: .8rem; align-items: baseline;
}
.country-meta {
  font-family: var(--sans); font-size: .74rem; font-weight: 400;
  letter-spacing: .07em; text-transform: uppercase; color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.prod {
  background: var(--card); border: 1px solid var(--rule); border-radius: 10px;
  padding: 1.1rem 1.3rem 1.2rem; margin-bottom: .9rem;
  display: grid; gap: .85rem;
}
.prod--many { border-left: 3px solid var(--gold-dim); }
.prod.done { opacity: .5; }
.prod.hide { display: none; }

.prod-head { display: flex; flex-wrap: wrap; gap: .35rem .8rem; align-items: baseline; }
.prod-name { font-family: var(--serif); font-size: 1.16rem; font-weight: 600; margin: 0; }
.prod-meta {
  margin: 0; display: flex; gap: .8rem; align-items: baseline; flex-wrap: wrap;
  font-size: .76rem; letter-spacing: .05em; text-transform: uppercase; color: var(--muted);
}
.count { font-variant-numeric: tabular-nums; }
.count--many { color: var(--flag); font-weight: 600; }

.tick { display: inline-flex; align-items: center; cursor: pointer; }
.tick input { position: absolute; opacity: 0; width: 0; height: 0; }
.tick span[aria-hidden] {
  width: 1.05rem; height: 1.05rem; border: 1.5px solid var(--rule); border-radius: 4px;
  display: inline-block; transition: background .12s, border-color .12s;
}
.tick span[aria-hidden] { position: relative; }
.tick span[aria-hidden]::after {
  content: ""; position: absolute; left: 50%; top: 46%;
  width: .28rem; height: .55rem; opacity: 0;
  border: solid var(--card); border-width: 0 2px 2px 0;
  transform: translate(-50%, -55%) rotate(42deg);
}
.tick input:checked + span[aria-hidden] { background: var(--gold); border-color: var(--gold); }
.tick input:checked + span[aria-hidden]::after { opacity: 1; }
.tick input:focus-visible + span[aria-hidden] { outline: 2px solid var(--gold); outline-offset: 2px; }

.labels {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-wrap: wrap; gap: .3rem .45rem;
}
.labels li {
  font-size: .78rem; border: 1px solid var(--rule); border-radius: 5px;
  padding: .15rem .5rem; display: inline-flex; gap: .45rem; align-items: baseline;
}
.label-where { color: var(--muted); font-variant-numeric: tabular-nums; font-size: .92em; }

.blurbs { display: grid; gap: .7rem; }
@media (min-width: 62rem) { .blurbs { grid-template-columns: 1fr 1fr; gap: 1.6rem; } }
.blurb { display: grid; grid-template-columns: 1.7rem 1fr; gap: .5rem; align-items: start; }
.lang {
  font-size: .66rem; letter-spacing: .1em; text-transform: uppercase;
  color: var(--gold); padding-top: .34rem; font-weight: 600;
}
.blurb p {
  margin: 0; font-family: var(--serif); font-size: 1rem; line-height: 1.62;
  max-width: 62ch;
}
.blurb--en p { color: var(--muted); }

.empty { color: var(--muted); font-family: var(--serif); padding: 2rem 0; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<header class="top">
  <div class="top-in">
    <h1>Tekstovi o vinarijama <span>· ${data.length} proizvođača</span></h1>
    <div class="tools">
      <input id="q" type="search" placeholder="Traži proizvođača ili riječ u tekstu…" aria-label="Traži">
      <span class="progress"><b id="done">0</b> / ${data.length} provjereno</span>
      <button class="reset" id="reset" type="button">Poništi</button>
    </div>
  </div>
  <nav>${nav}</nav>
</header>

<main>
  <p class="intro">Svi tekstovi o vinarijama i destilerijama koji se pojavljuju na kartici vina,
  hrvatski i engleski jedan uz drugi. Kvačica pamti dokle ste stigli — ostaje spremljena
  u pregledniku i kad zatvorite stranicu. <strong>Zlatna crta s lijeve strane</strong> označava
  proizvođače s četiri ili više etiketa: tu je najveći rizik da tekst opisuje samo jedno vino,
  a ne cijelu kuću.</p>
  ${body}
  <p class="empty" id="empty" hidden>Ništa ne odgovara toj pretrazi.</p>
</main>

<script>
(function () {
  var KEY = "theatrium-producer-check";
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { state = {}; }
  var boxes = Array.prototype.slice.call(document.querySelectorAll(".tick input"));
  var doneEl = document.getElementById("done");

  function paint() {
    var n = 0;
    boxes.forEach(function (b) {
      var on = !!state[b.dataset.id];
      b.checked = on;
      b.closest(".prod").classList.toggle("done", on);
      if (on) n++;
    });
    doneEl.textContent = n;
  }
  boxes.forEach(function (b) {
    b.addEventListener("change", function () {
      if (b.checked) state[b.dataset.id] = 1; else delete state[b.dataset.id];
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      paint();
    });
  });
  document.getElementById("reset").addEventListener("click", function () {
    state = {};
    try { localStorage.removeItem(KEY); } catch (e) {}
    paint();
  });
  paint();

  var q = document.getElementById("q");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".prod"));
  var sections = Array.prototype.slice.call(document.querySelectorAll(".country"));
  var empty = document.getElementById("empty");
  q.addEventListener("input", function () {
    var v = q.value.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (c) {
      var hit = !v || c.dataset.search.indexOf(v) !== -1;
      c.classList.toggle("hide", !hit);
      if (hit) shown++;
    });
    sections.forEach(function (s) {
      s.hidden = !s.querySelector(".prod:not(.hide)");
    });
    empty.hidden = shown > 0;
  });
})();
</script>`;

fs.writeFileSync("scratch/vinarije.html", html, "utf8");
console.log("wrote scratch/vinarije.html —", data.length, "producers,", Math.round(html.length / 1024), "kB");
