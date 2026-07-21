/* Theatrium by Filho — app logic */
"use strict";

const LS_KEY = "theatrium-lang";

const FLAGS = {
  hr: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#fff"/><rect width="60" height="13.4" fill="#e8112d"/><rect y="26.6" width="60" height="13.4" fill="#171796"/><g>' +
      Array.from({length:20},(_,i)=>{const c=i%5,r=(i-c)/5;return ((c+r)%2===0)?`<rect x="${23+c*2.8}" y="${9+r*2.9}" width="2.8" height="2.9" fill="#e8112d"/>`:`<rect x="${23+c*2.8}" y="${9+r*2.9}" width="2.8" height="2.9" fill="#fff"/>`;}).join("") +
      '<rect x="23" y="9" width="14" height="11.6" fill="none" stroke="#8d8d8d" stroke-width="0.6"/></g></svg>',
  en: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#012169"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="4"/><path d="M30,0 V40 M0,20 H60" stroke="#fff" stroke-width="13"/><path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="7"/></svg>',
  it: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="20" height="40" fill="#009246"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ce2b37"/></svg>',
  fr: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="20" height="40" fill="#002395"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ed2939"/></svg>',
  de: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="13.4" fill="#000"/><rect y="13.4" width="60" height="13.3" fill="#dd0000"/><rect y="26.7" width="60" height="13.3" fill="#ffce00"/></svg>'
};

let DATA = null;
let lang = localStorage.getItem(LS_KEY);
let currentSection = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const T = () => I18N[lang] || I18N.en;

function init() {
  fetch("data/wines.json")
    .then((r) => r.json())
    .then((d) => {
      DATA = d;
      currentSection = d.sections[0].id;
      if (lang && I18N[lang]) showApp(); else showStart();
    });
}

/* ---------- start screen ---------- */
function showStart() {
  $("app").classList.add("hidden");
  $("start").classList.remove("hidden");
  const box = $("lang-buttons");
  box.innerHTML = LANGS.map((l) =>
    `<button class="lang-btn" data-lang="${l.code}">${FLAGS[l.code]}<span>${l.name}</span></button>`
  ).join("");
  box.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      lang = b.dataset.lang;
      localStorage.setItem(LS_KEY, lang);
      showApp();
    })
  );
}

/* ---------- main app ---------- */
function showApp() {
  $("start").classList.add("hidden");
  $("app").classList.remove("hidden");
  document.documentElement.lang = lang;
  const t = T();
  $("subtitle").textContent = t.ui.subtitle;
  $("search").placeholder = t.ui.search;
  $("legal").textContent = t.ui.legal;
  $("company").textContent = t.ui.company;
  renderLangSwitch();
  renderNav();
  renderContent();
}

function renderLangSwitch() {
  const box = $("lang-switch");
  box.innerHTML = LANGS.map((l) =>
    `<button data-lang="${l.code}" class="${l.code === lang ? "active" : ""}" aria-label="${l.name}" title="${l.name}">${FLAGS[l.code]}</button>`
  ).join("");
  box.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      lang = b.dataset.lang;
      localStorage.setItem(LS_KEY, lang);
      showApp();
    })
  );
}

function renderNav() {
  const t = T();
  const nav = $("nav");
  nav.innerHTML = DATA.sections.map((s) =>
    `<button data-sec="${s.id}" class="${s.id === currentSection ? "active" : ""}">${esc(t.sections[s.id] || s.id)}</button>`
  ).join("");
  nav.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      currentSection = b.dataset.sec;
      $("search").value = "";
      renderNav();
      renderContent();
      window.scrollTo({ top: 0 });
    })
  );
}

function priceHtml(item) {
  if (item.price == null) return "";
  return `<span class="item-price">${item.price}&nbsp;€</span>`;
}

function itemHtml(item, ref, context) {
  const clickable = !!item.insight;
  return `<${clickable ? `button class="item clickable" data-ref="${ref}"` : 'div class="item"'}>
    <span class="item-main">
      <span class="item-name">${esc(item.name)}</span>
      ${item.producer ? `<span class="item-producer">${esc(item.producer)}</span>` : ""}
      ${context ? `<span class="search-context">${esc(context)}</span>` : ""}
    </span>
    ${priceHtml(item)}
    ${clickable ? '<span class="item-chevron">›</span>' : ""}
  </${clickable ? "button" : "div"}>`;
}

function renderContent() {
  const t = T();
  const q = $("search").value.trim().toLowerCase();
  const box = $("content");
  let html = "";

  if (q) {
    /* global search across all sections */
    let found = 0;
    DATA.sections.forEach((sec, si) => {
      sec.categories.forEach((cat, ci) => {
        cat.groups.forEach((g, gi) => {
          g.items.forEach((item, ii) => {
            const hay = (item.name + " " + (item.producer || "")).toLowerCase();
            if (hay.includes(q)) {
              if (found === 0) html += `<div class="cat">`;
              found++;
              const ref = [si, ci, gi, ii].join(".");
              const ctx = [t.sections[sec.id], t.categories[cat.id], g.country ? t.countries[g.country] : null]
                .filter(Boolean).join(" · ");
              html += itemHtml(item, ref, ctx);
            }
          });
        });
      });
    });
    html += found ? "</div>" : `<p class="no-results">${t.ui.noResults}</p>`;
  } else {
    const sec = DATA.sections.find((s) => s.id === currentSection);
    const si = DATA.sections.indexOf(sec);
    sec.categories.forEach((cat, ci) => {
      html += `<section class="cat"><h2 class="cat-title">${esc(t.categories[cat.id] || cat.id)}${cat.serving ? ` <span class="cat-serving">${cat.serving}</span>` : ""}</h2>`;
      if (cat.priceNote) html += `<p class="price-note">${t.ui.priceNote}</p>`;
      cat.groups.forEach((g, gi) => {
        if (g.country) html += `<h3 class="country">${esc(t.countries[g.country] || g.country)}</h3>`;
        html += g.items.map((item, ii) => itemHtml(item, [si, ci, gi, ii].join("."))).join("");
      });
      html += `</section>`;
    });
  }

  box.innerHTML = html;
  box.querySelectorAll(".item.clickable").forEach((b) =>
    b.addEventListener("click", () => openDetail(b.dataset.ref))
  );
}

/* ---------- detail modal ---------- */
function openDetail(ref) {
  const [si, ci, gi, ii] = ref.split(".").map(Number);
  const item = DATA.sections[si].categories[ci].groups[gi].items[ii];
  const ins = item.insight;
  if (!ins) return;
  const t = T();
  const field = (label, value, wide) =>
    value ? `<div class="detail-field${wide ? " wide" : ""}"><div class="detail-label">${label}</div><div class="detail-value">${value}</div></div>` : "";
  const list = (keys, dict) => (keys || []).map((k) => dict[k] || k).join(", ");
  const region = [esc(ins.region), t.countries[ins.country] || ins.country].filter(Boolean).join(", ");

  $("modal-body").innerHTML = `
    <div class="detail-name">${esc(item.name)}</div>
    ${item.producer ? `<div class="detail-producer">${esc(item.producer)}</div>` : ""}
    ${item.price != null ? `<div class="detail-price">${item.price} €</div>` : ""}
    <div class="detail-style">${esc(t.styles[ins.style] || "")}</div>
    <div class="detail-grid">
      ${field(t.ui.grape, esc(ins.grape))}
      ${field(t.ui.region, region)}
      ${field(t.ui.body, esc(t.bodies[ins.body] || ins.body))}
      ${field(t.ui.temp, ins.temp ? esc(ins.temp) + " °C" : "")}
      ${field(t.ui.aromas, esc(list(ins.aromas, t.aromas)), true)}
      ${field(t.ui.pairings, esc(list(ins.pairings, t.pairings)), true)}
    </div>`;
  $("modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("modal").classList.add("hidden");
  document.body.style.overflow = "";
}

/* ---------- events ---------- */
$("search").addEventListener("input", renderContent);
$("modal-close").addEventListener("click", closeModal);
$("modal-backdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
$("home-logo").addEventListener("click", showStart);

init();
