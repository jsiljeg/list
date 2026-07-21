/* Theatrium by Filho — app logic */
"use strict";

const LS_KEY = "theatrium-lang";

/* Croatian flag needs a unique clip-path id per rendered instance:
   duplicate SVG ids across the DOM (start screen + header) make the
   browser resolve the clip against a hidden copy and the šahovnica
   disappears, leaving what looks like the Dutch tricolour. */
let flagUid = 0;
function hrFlag() {
  const id = "hrsh" + (flagUid++);
  const checks = Array.from({ length: 25 }, (_, i) => {
    const c = i % 5, r = (i - c) / 5;
    return (c + r) % 2 === 0
      ? `<rect x="${20 + c * 4}" y="${11 + r * 4.4}" width="4" height="4.4" fill="#e8112d"/>` : "";
  }).join("");
  const crown = [0, 1, 2, 3, 4].map((i) =>
    `<rect x="${20.4 + i * 3.9}" y="${8.6 - Math.sin((i / 4) * Math.PI) * 1.6}" width="3.5" height="3.2" rx="0.6" fill="#4a67b0" stroke="#fff" stroke-width="0.5"/>`
  ).join("");
  return `<svg viewBox="0 0 60 40" aria-hidden="true">
    <rect width="60" height="40" fill="#fff"/>
    <rect width="60" height="13.4" fill="#e8112d"/>
    <rect y="26.6" width="60" height="13.4" fill="#171796"/>
    ${crown}
    <defs><clipPath id="${id}"><path d="M20,11 h20 v11.5 a10,10 0 0 1 -20,0 z"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect x="20" y="11" width="20" height="23" fill="#fff"/>${checks}</g>
    <path d="M20,11 h20 v11.5 a10,10 0 0 1 -20,0 z" fill="none" stroke="#fff" stroke-width="1.2"/>
  </svg>`;
}

const FLAGS = {
  en: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#012169"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="4"/><path d="M30,0 V40 M0,20 H60" stroke="#fff" stroke-width="13"/><path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="7"/></svg>',
  it: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="20" height="40" fill="#009246"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ce2b37"/></svg>',
  fr: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="20" height="40" fill="#002395"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ed2939"/></svg>',
  de: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="13.4" fill="#000"/><rect y="13.4" width="60" height="13.3" fill="#dd0000"/><rect y="26.7" width="60" height="13.3" fill="#ffce00"/></svg>'
};
const flagHTML = (code) => (code === "hr" ? hrFlag() : FLAGS[code]);

const COUNTRY_FLAGS = {
  HR: () => hrFlag(),
  DE: () => FLAGS.de,
  FR: () => FLAGS.fr,
  IT: () => FLAGS.it,
  AT: () => '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#ed2939"/><rect y="13.3" width="60" height="13.4" fill="#fff"/></svg>',
  ES: () => '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#aa151b"/><rect y="10" width="60" height="20" fill="#f1bf00"/></svg>',
  SI: () => '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#fff"/><rect y="13.3" width="60" height="13.4" fill="#005da4"/><rect y="26.7" width="60" height="13.3" fill="#ed1c24"/><g><path d="M12,5 h10 v8 a5,5 0 0 1 -10 0 z" fill="#005da4" stroke="#fff" stroke-width="0.8"/><path d="M13.5,11.5 L16,7.5 17,9 18,7.5 20.5,11.5 z" fill="#fff"/></g></svg>',
  US: () => {
    let stripes = "";
    for (let i = 0; i < 13; i++) if (i % 2 === 0) stripes += `<rect y="${i * 3.077}" width="60" height="3.077" fill="#b22234"/>`;
    let stars = "";
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) stars += `<circle cx="${3.5 + c * 5.5}" cy="${3.5 + r * 5.5}" r="1.1" fill="#fff"/>`;
    return `<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#fff"/>${stripes}<rect width="24" height="21.5" fill="#3c3b6e"/>${stars}</svg>`;
  },
  CN: () => '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#de2910"/><path d="M13,5 L14.7,9.6 19.7,9.6 15.6,12.6 17.1,17.3 13,14.4 8.9,17.3 10.4,12.6 6.3,9.6 11.3,9.6 Z" fill="#ffde00"/></svg>'
};

let DATA = null;
let lang = localStorage.getItem(LS_KEY);
let currentSection = null;
let picksOnly = false;

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
      const idleReset = sessionStorage.getItem("idle-reset");
      sessionStorage.removeItem("idle-reset");
      if (lang && I18N[lang] && !idleReset) showApp(); else showStart();
    });
}

/* ---------- start screen ---------- */
function showStart() {
  $("app").classList.add("hidden");
  $("story-screen").classList.add("hidden");
  $("start").classList.remove("hidden");
  const box = $("lang-buttons");
  box.innerHTML = LANGS.map((l) =>
    `<button class="lang-btn" data-lang="${l.code}">${flagHTML(l.code)}<span>${l.name}</span></button>`
  ).join("");
  box.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      lang = b.dataset.lang;
      localStorage.setItem(LS_KEY, lang);
      showStory();
    })
  );
}

/* ---------- story splash (front page, after language pick) ---------- */
function showStory() {
  const t = T();
  $("start").classList.add("hidden");
  $("app").classList.add("hidden");
  $("story-screen").classList.remove("hidden");
  $("story-body").innerHTML =
    `<h2 class="story-title">${esc(t.story.title)}</h2>` +
    t.story.paras.map((p) => `<p>${esc(p)}</p>`).join("") +
    `<p class="story-legend"><span class="rec-badge">★</span> ${esc(t.ui.recommended)}</p>`;
  $("story-enter").textContent = t.ui.enter;
  window.scrollTo({ top: 0 });
}

/* ---------- main app ---------- */
function showApp() {
  $("start").classList.add("hidden");
  $("story-screen").classList.add("hidden");
  $("app").classList.remove("hidden");
  document.documentElement.lang = lang;
  const t = T();
  $("subtitle").textContent = t.ui.subtitle;
  $("search").placeholder = t.ui.search;
  $("legal").textContent = t.ui.legal;
  $("company").textContent = t.ui.company;
  $("picks-toggle").querySelector("span").textContent = t.ui.picks;
  $("picks-toggle").classList.toggle("active", picksOnly);
  $("helper-open").querySelector("span").textContent = t.helper.title;
  renderLangSwitch();
  renderNav();
  renderContent();
}

function renderLangSwitch() {
  const box = $("lang-switch");
  box.innerHTML = LANGS.map((l) =>
    `<button data-lang="${l.code}" class="${l.code === lang ? "active" : ""}" aria-label="${l.name}" title="${l.name}">${flagHTML(l.code)}</button>`
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
      picksOnly = false;
      $("picks-toggle").classList.remove("active");
      renderNav();
      renderContent();
      window.scrollTo({ top: 0 });
    })
  );
}

const PRICE_LOCALE = { hr: "hr-HR", en: "en-GB", it: "it-IT", fr: "fr-FR", de: "de-DE" };
const fmtPrice = (n) => n.toLocaleString(PRICE_LOCALE[lang] || "hr-HR");

function priceHtml(item) {
  if (item.price == null) return "";
  return `<span class="item-price">${fmtPrice(item.price)}&nbsp;€</span>`;
}

function nameHtml(item) {
  const marked = esc(item.name).replace(/((?:19|20)\d{2})/, '<span class="vintage">$1</span>');
  return marked +
    (item.recommended ? ` <span class="rec-badge" title="${esc(T().ui.recommended)}">★</span>` : "") +
    (item.new ? ` <span class="new-badge">${esc(T().ui.newBadge)}</span>` : "");
}

function itemFlag(item) {
  const c = item.insight && item.insight.country;
  return c && COUNTRY_FLAGS[c] ? ` <span class="item-flag" title="${esc(T().countries[c] || c)}">${COUNTRY_FLAGS[c]()}</span>` : "";
}

function itemHtml(item, ref, context, showFlag) {
  const clickable = !!item.insight;
  return `<${clickable ? `button class="item clickable" data-ref="${ref}"` : 'div class="item"'}>
    <span class="item-row">
      <span class="item-name">${nameHtml(item)}</span>
      <span class="dots" aria-hidden="true"></span>
      ${priceHtml(item)}
      ${clickable ? '<span class="item-chevron">›</span>' : ""}
    </span>
    ${item.producer || showFlag ? `<span class="item-producer">${esc(item.producer || "")}${showFlag ? itemFlag(item) : ""}</span>` : ""}
    ${context ? `<span class="search-context">${esc(context)}</span>` : ""}
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
            const ins = item.insight || {};
            const hay = [item.name, item.producer, ins.grape, ins.region].filter(Boolean).join(" ").toLowerCase();
            if (hay.includes(q) && (!picksOnly || item.recommended || item.new)) {
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
  } else if (picksOnly) {
    let total = 0;
    DATA.sections.forEach((sec, si) => {
      let secHtml = "";
      sec.categories.forEach((cat, ci) => {
        cat.groups.forEach((g, gi) => {
          g.items.forEach((item, ii) => {
            if (!item.recommended && !item.new) return;
            total++;
            const ctx = g.country ? t.countries[g.country] : null;
            secHtml += itemHtml(item, [si, ci, gi, ii].join("."), ctx);
          });
        });
      });
      if (secHtml) html += `<section class="cat"><h2 class="cat-title">${esc(t.sections[sec.id])}</h2><div class="ornament" aria-hidden="true">◆</div>${secHtml}</section>`;
    });
    if (!total) html = `<p class="no-results">${t.ui.noResults}</p>`;
  } else {
    const sec = DATA.sections.find((s) => s.id === currentSection);
    const si = DATA.sections.indexOf(sec);
    sec.categories.forEach((cat, ci) => {
      html += `<section class="cat"><h2 class="cat-title">${esc(t.categories[cat.id] || cat.id)}${cat.serving ? ` <span class="cat-serving">${cat.serving}</span>` : ""}</h2><div class="ornament" aria-hidden="true">◆</div>`;
      if (cat.priceNote) html += `<p class="price-note">${t.ui.priceNote}</p>`;
      cat.groups.forEach((g, gi) => {
        if (g.country) html += `<h3 class="country">${COUNTRY_FLAGS[g.country] ? `<span class="country-flag">${COUNTRY_FLAGS[g.country]()}</span>` : ""}<span>${esc(t.countries[g.country] || g.country)}</span></h3>`;
        html += g.items.map((item, ii) => itemHtml(item, [si, ci, gi, ii].join("."))).join("");
      });
      html += `</section>`;
    });
  }

  box.innerHTML = html;
  box.classList.remove("content-fade");
  void box.offsetWidth;
  box.classList.add("content-fade");
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

  const glass = glassFor(ins.style, ins.grape);
  const noteText = item.note && (item.note[lang] || item.note.hr || item.note.en);
  $("modal-body").innerHTML = `
    ${glass ? `<div class="detail-glass">${GLASS_ICONS[glass]}</div>` : ""}
    <div class="detail-name">${esc(item.name)}</div>
    ${item.producer ? `<div class="detail-producer">${esc(item.producer)}</div>` : ""}
    ${item.recommended ? `<div class="detail-rec">★ ${esc(t.ui.recommended)}</div>` : ""}
    ${item.new ? `<div class="detail-rec detail-new">${esc(t.ui.newBadge)}</div>` : ""}
    ${item.ratings && item.ratings.length ? `<div class="detail-ratings"><span class="detail-label">${esc(t.ui.ratings)}</span>${item.ratings.map((r) => `<span class="rating-chip"><b>${esc(r.score)}</b> ${esc(r.critic)}</span>`).join("")}</div>` : ""}
    ${item.price != null ? `<div class="detail-price">${fmtPrice(item.price)} €</div>` : ""}
    <div class="detail-style">${esc(t.styles[ins.style] || "")}</div>
    ${noteText ? `<div class="detail-note">„${esc(noteText)}“ <span class="detail-note-sig">— Filho</span></div>` : ""}
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

/* ---------- "Help me choose" sommelier wizard ---------- */
const HELPER_FOOD = {
  seafood: ["seafood", "oysters", "shellfish", "white_fish", "grilled_fish", "sushi", "caviar"],
  meat: ["steak", "beef", "lamb", "game", "bbq", "stews"],
  pasta: ["pasta", "risotto", "pizza", "truffles", "mushrooms"],
  white: ["poultry", "white_meat", "veal", "pork"],
  cheese: ["cheese_hard", "cheese_blue", "cheese_fresh", "charcuterie", "prosciutto"],
  dessert: ["desserts", "chocolate", "fruit_desserts", "nuts", "foie_gras"],
  none: ["aperitif", "light_starters", "salads", "solo"]
};
const HELPER_STYLE = {
  fresh: { bodies: ["light", "medium"], styles: ["white_fresh", "white_mineral", "white_aromatic", "sparkling", "sparkling_rose", "rose", "red_light", "champagne", "champagne_bdb", "champagne_rose"] },
  rich: { bodies: ["full"], styles: ["white_rich", "red_medium", "red_full", "red_mature", "champagne_prestige"] },
  bold: { bodies: [], styles: ["orange", "red_mature", "sweet", "champagne_prestige"] }
};
const HELPER_BUDGET = { b1: [0, 60], b2: [60, 120], b3: [120, Infinity], any: [0, Infinity] };

/* Glass silhouettes drawn after Riedel stemware profiles (the house
   glassware): Champagne Wine Glass (slim tulip, not a flute),
   Riesling, Cabernet/Merlot, Pinot Noir with its flared lip, and a
   small dessert tulip. Open rims, hair-thin stems. */
const GLASS_ICONS = {
  champagne: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M14.8,4 C13.4,16 13,25 14.3,33 C15.7,40.5 17.6,43.6 20,44.6 C22.4,43.6 24.3,40.5 25.7,33 C27,25 26.6,16 25.2,4"/><path d="M20,44.6 V88"/><path d="M11.5,92.5 c3.4,-2.8 13.6,-2.8 17,0"/></svg>',
  white: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M13.2,8 C11.4,18 10.9,27 12.7,35.5 C14.4,43 16.8,46 20,47 C23.2,46 25.6,43 27.3,35.5 C29.1,27 28.6,18 26.8,8"/><path d="M20,47 V88"/><path d="M11.5,92.5 c3.4,-2.8 13.6,-2.8 17,0"/></svg>',
  bordeaux: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M12.6,4 C10.2,17 9.4,29 11.2,38.5 C13.2,47 16.2,50 20,51 C23.8,50 26.8,47 28.8,38.5 C30.6,29 29.8,17 27.4,4"/><path d="M20,51 V88"/><path d="M11.5,92.5 c3.4,-2.8 13.6,-2.8 17,0"/></svg>',
  burgundy: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M12.3,4 C13.6,5.6 13.8,6.4 13.4,7.4 C9.6,13.8 7.6,22 9.2,30 C11.2,40.6 14.8,45.4 20,46.4 C25.2,45.4 28.8,40.6 30.8,30 C32.4,22 30.4,13.8 26.6,7.4 C26.2,6.4 26.4,5.6 27.7,4"/><path d="M20,46.4 V88"/><path d="M11.5,92.5 c3.4,-2.8 13.6,-2.8 17,0"/></svg>',
  dessert: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M15.2,22 C13.9,30 13.7,36 15,42 C16.4,47 18,49.2 20,50 C22,49.2 23.6,47 25,42 C26.3,36 26.1,30 24.8,22"/><path d="M20,50 V88"/><path d="M11.5,92.5 c3.4,-2.8 13.6,-2.8 17,0"/></svg>'
};
function glassFor(style, grape) {
  if (!style) return null;
  if (style.startsWith("sparkling") || style.startsWith("champagne")) return "champagne";
  if (style === "sweet") return "dessert";
  if (style.startsWith("red")) {
    /* Riedel logic: Pinot Noir & Nebbiolo take the wide Burgundy bowl
       with the flared lip; other reds the taller Cabernet shape. */
    return /pinot|nebbiolo|burgund/i.test(grape || "") || style === "red_light" ? "burgundy" : "bordeaux";
  }
  return "white";
}

const helperState = { step: 0, food: null, style: null };

function openHelper() {
  helperState.step = 0; helperState.food = null; helperState.style = null;
  renderHelperStep();
  $("modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function helperOptions(map, onPick) {
  return Object.keys(map).map((k) => `<button class="helper-opt" data-k="${k}">${esc(map[k])}</button>`).join("");
}

function renderHelperStep() {
  const t = T();
  const h = t.helper;
  let inner;
  if (helperState.step === 0) inner = `<h3 class="helper-q">${esc(h.qFood)}</h3><div class="helper-opts">${helperOptions(h.food)}</div>`;
  else if (helperState.step === 1) inner = `<h3 class="helper-q">${esc(h.qStyle)}</h3><div class="helper-opts">${helperOptions(h.style)}</div>`;
  else inner = `<h3 class="helper-q">${esc(h.qBudget)}</h3><div class="helper-opts">${helperOptions(h.budget)}</div>`;
  $("modal-body").innerHTML = `<div class="helper"><div class="helper-title">🍷 ${esc(h.title)}</div>${inner}</div>`;
  $("modal-body").querySelectorAll(".helper-opt").forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.dataset.k;
      if (helperState.step === 0) { helperState.food = k; helperState.step = 1; renderHelperStep(); }
      else if (helperState.step === 1) { helperState.style = k; helperState.step = 2; renderHelperStep(); }
      else renderHelperResults(k);
    })
  );
}

function renderHelperResults(budgetKey) {
  const t = T();
  const foodKeys = HELPER_FOOD[helperState.food] || [];
  const style = HELPER_STYLE[helperState.style] || { bodies: [], styles: [] };
  const [lo, hi] = HELPER_BUDGET[budgetKey] || [0, Infinity];
  const scored = [];
  DATA.sections.forEach((sec, si) => {
    if (!sec.id.startsWith("bottle-")) return;
    sec.categories.forEach((cat, ci) => {
      cat.groups.forEach((g, gi) => {
        g.items.forEach((item, ii) => {
          const ins = item.insight;
          if (!ins || item.price == null || item.price < lo || item.price > hi) return;
          let score = 0;
          score += (ins.pairings || []).filter((p) => foodKeys.includes(p)).length * 3;
          if (style.styles.includes(ins.style)) score += 2;
          if (style.bodies.includes(ins.body)) score += 1;
          if (item.recommended) score += 1.5;
          if (score <= 0) return;
          scored.push({ score: score + Math.random() * 0.5, ref: [si, ci, gi, ii].join("."), item, sec, country: g.country });
        });
      });
    });
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  const list = top.length
    ? top.map((r) => itemHtml(r.item, r.ref, t.sections[r.sec.id], true)).join("")
    : `<p class="no-results">${t.ui.noResults}</p>`;
  $("modal-body").innerHTML = `<div class="helper"><div class="helper-title">🍷 ${esc(t.helper.results)}</div>${list}<button class="helper-opt helper-again">${esc(t.helper.again)}</button></div>`;
  $("modal-body").querySelectorAll(".item.clickable").forEach((b) =>
    b.addEventListener("click", () => openDetail(b.dataset.ref))
  );
  $("modal-body").querySelector(".helper-again").addEventListener("click", openHelper);
}

/* ---------- idle reset: hand the tablet back clean ---------- */
const IDLE_MS = 3 * 60 * 1000;
let lastActivity = Date.now();
["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) =>
  document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true })
);
setInterval(() => {
  if (Date.now() - lastActivity < IDLE_MS) return;
  if ($("start").classList.contains("hidden")) {
    /* Reload (not just reset): the tablet silently picks up newly
       deployed versions while idle, then lands on the language screen. */
    sessionStorage.setItem("idle-reset", "1");
    location.reload();
  }
}, 30000);

/* ---------- events ---------- */
$("search").addEventListener("input", renderContent);
$("modal-close").addEventListener("click", closeModal);
$("modal-backdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
$("home-logo").addEventListener("click", showStart);
$("story-enter").addEventListener("click", showApp);
$("picks-toggle").addEventListener("click", () => {
  picksOnly = !picksOnly;
  $("picks-toggle").classList.toggle("active", picksOnly);
  renderContent();
  window.scrollTo({ top: 0 });
});
$("helper-open").addEventListener("click", openHelper);

if ("serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

init();
