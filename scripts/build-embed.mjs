/* Builds the drinks list as a plain HTML fragment for theatrium.hr.
 *
 * The restaurant's own site keeps a second, hand-typed copy of this list, and
 * the two had drifted badly by 2026-09-04: 83 of 353 wines, no prices at all,
 * four wrong vintages, and none of the spirits added since August. The cure is
 * not to re-type it more often — it is to stop having a second copy. This
 * writes the same list the tablets read, as markup their WordPress page can
 * drop straight in.
 *
 * Deliberately *not* the guest app in an iframe: the page keeps its own design,
 * its own fonts and its own place in Google's index, and gets only the words.
 *
 * Output: embed-hr.html and embed-en.html — fragments, no <html>/<head>, one
 * <style> scoped under .tl so nothing leaks either way. Regenerated on every
 * deploy, so the site cannot go stale again.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { joinList } from "./lib/list.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

const ctx = {};
vm.createContext(ctx);
vm.runInContext(read("js/i18n.js") + "\nthis.I18N = I18N;", ctx);
const { I18N } = ctx;

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LOCALE = { hr: "hr-HR", en: "en-GB" };
const price = (n, lang) => n.toLocaleString(LOCALE[lang]);
const vol = (v, lang) => `${v.toLocaleString(LOCALE[lang])} l`;

/* The site is Croatian with an English version; the other six languages live
   in the app, where a guest picks one. */
const LANGS = ["hr", "en"];

const CSS = `
.tl{--tl-rule:currentColor;font-variant-numeric:tabular-nums}
.tl h2{margin:2.2em 0 .2em}
.tl h3{margin:1.6em 0 .2em;font-size:1em;letter-spacing:.14em;text-transform:uppercase;opacity:.65;font-weight:400}
.tl h2:first-child{margin-top:0}
.tl ul{list-style:none;margin:0;padding:0}
.tl li{display:flex;align-items:baseline;gap:.5em;padding:.3em 0}
.tl .tl-n{font-weight:600}
.tl .tl-p{font-size:.82em;letter-spacing:.1em;text-transform:uppercase;opacity:.7}
.tl .tl-v{font-size:.82em;opacity:.7;white-space:nowrap}
.tl .tl-fill{flex:1 1 auto;border-bottom:1px dotted;opacity:.35;transform:translateY(-.25em);min-width:1em}
.tl .tl-c{white-space:nowrap}
.tl .tl-note{margin-top:2.5em;font-size:.82em;opacity:.6}
@media (max-width:520px){
  .tl li{flex-wrap:wrap}
  .tl .tl-fill{min-width:.5em}
}`.trim();

for (const lang of LANGS) {
  const { list } = joinList();
  const t = I18N[lang];
  const out = [`<div class="tl" lang="${lang}">`, `<style>${CSS}</style>`];

  for (const sec of list.sections) {
    out.push(`<h2>${esc(t.sections[sec.id] || sec.id)}</h2>`);
    for (const cat of sec.categories) {
      out.push(`<h3>${esc(t.categories[cat.id] || cat.id)}</h3>`, `<ul>`);
      for (const g of cat.groups) {
        for (const it of g.items) {
          const name = (it.nameI18n && it.nameI18n[lang]) || it.name;
          const bits = [`<span class="tl-n">${esc(name)}</span>`];
          if (it.producer) bits.push(`<span class="tl-p">${esc(it.producer)}</span>`);
          if (it.vol) bits.push(`<span class="tl-v">${esc(vol(it.vol, lang))}</span>`);
          bits.push(`<span class="tl-fill"></span>`);
          if (it.price != null) bits.push(`<span class="tl-c">${esc(price(it.price, lang))}&nbsp;&euro;</span>`);
          out.push(`<li>${bits.join(" ")}</li>`);
        }
      }
      out.push(`</ul>`);
    }
  }

  /* Where the full card lives, since this fragment is only the words: no
     tasting notes, no producer stories, no food pairing. */
  out.push(`<p class="tl-note">${esc(t.ui.copyright || "")}</p>`, `</div>`);
  const file = `embed-${lang}.html`;
  writeFileSync(resolve(ROOT, file), out.join("\n") + "\n");
  const items = out.filter((l) => l.startsWith("<li>")).length;
  console.log(`${file} — ${items} items, ${(out.join("\n").length / 1024).toFixed(0)} kB`);
}
