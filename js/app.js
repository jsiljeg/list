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

/* Five-point star path; rot rotates the first (topmost) point. */
function starPath(cx, cy, r, rot) {
  let p = "";
  for (let i = 0; i < 5; i++) {
    const ao = rot + (i * 2 * Math.PI) / 5;
    const ai = ao + Math.PI / 5;
    const ri = r * 0.382;
    p += (i ? "L" : "M") + (cx + r * Math.sin(ao)).toFixed(2) + "," + (cy - r * Math.cos(ao)).toFixed(2);
    p += "L" + (cx + ri * Math.sin(ai)).toFixed(2) + "," + (cy - ri * Math.cos(ai)).toFixed(2);
  }
  return p + "Z";
}
/* China: big star in the canton with four small stars each pointing at it. */
function cnFlag() {
  const big = starPath(10, 10, 6, 0);
  const smalls = [[20, 4], [24, 8], [24, 14], [20, 18]]
    .map(([x, y]) => starPath(x, y, 2, Math.atan2(10 - x, y - 10)))
    .join("");
  return `<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#de2910"/><path d="${big}${smalls}" fill="#ffde00"/></svg>`;
}

const FLAGS = {
  en: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#012169"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="4"/><path d="M30,0 V40 M0,20 H60" stroke="#fff" stroke-width="13"/><path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="7"/></svg>',
  it: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="20" height="40" fill="#009246"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ce2b37"/></svg>',
  fr: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="20" height="40" fill="#002395"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ed2939"/></svg>',
  de: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="13.4" fill="#000"/><rect y="13.4" width="60" height="13.3" fill="#dd0000"/><rect y="26.7" width="60" height="13.3" fill="#ffce00"/></svg>'
};
FLAGS.zh = cnFlag();
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
  CN: () => cnFlag()
};

let DATA = null;
let lang = localStorage.getItem(LS_KEY);
let currentSection = null;
let picksOnly = false;
let ratedOnly = false;

const $ = (id) => document.getElementById(id);
const bestScore = (item) => (item.ratings || []).reduce((m, r) => Math.max(m, parseFloat(r.score) || 0), 0);
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const T = () => I18N[lang] || I18N.en;

let MENU = null;
let PRODUCERS = {};
let REGIONS = [];
function init() {
  Promise.all([
    fetch("data/wines.json").then((r) => r.json()),
    fetch("data/menu.json").then((r) => r.json()).catch(() => ({ courses: [], dishes: [] })),
    fetch("data/producers.json").then((r) => r.json()).catch(() => ({ producers: {} })),
    fetch("data/regions.json").then((r) => r.json()).catch(() => ({ regions: [] }))
  ]).then(([d, m, pr, rg]) => {
      DATA = d;
      MENU = m;
      PRODUCERS = pr.producers || {};
      REGIONS = rg.regions || [];
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
    `<div class="story-legend">${legendHtml()}</div>`;
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
  $("rated-toggle").querySelector("span").textContent = t.ui.bestRated;
  $("rated-toggle").classList.toggle("active", ratedOnly);
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
  nav.innerHTML =
    `<button data-sec="__regions" class="region-chip ${currentSection === "__regions" ? "active" : ""}">◆ ${esc(t.ui.regions)}</button>` +
    DATA.sections.map((s) =>
      `<button data-sec="${s.id}" class="${s.id === currentSection ? "active" : ""}">${esc(t.sections[s.id] || s.id)}</button>`
    ).join("");
  nav.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      currentSection = b.dataset.sec;
      $("search").value = "";
      picksOnly = false;
      ratedOnly = false;
      $("picks-toggle").classList.remove("active");
      $("rated-toggle").classList.remove("active");
      renderNav();
      renderContent();
      window.scrollTo({ top: 0 });
    })
  );
}

const PRICE_LOCALE = { hr: "hr-HR", en: "en-GB", it: "it-IT", fr: "fr-FR", de: "de-DE", zh: "zh-CN" };
const fmtPrice = (n) => n.toLocaleString(PRICE_LOCALE[lang] || "hr-HR");

function priceHtml(item) {
  if (item.price == null) return "";
  return `<span class="item-price">${fmtPrice(item.price)}&nbsp;€</span>`;
}

/* minimalist gold marker icons for the list + legend */
const ICONS = {
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.26 6.9.6-5.2 4.5 1.55 6.74L12 17.2 5.85 20.6 7.4 13.86 2.2 9.36l6.9-.6z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4.2 3.4L12 4l4.8 7.4L21 8l-1.7 11H4.7L3 8z"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 7.6L21.5 12l-7.6 2.4L12 22l-1.9-7.6L2.5 12l7.6-2.4z"/></svg>',
  gem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 3h12l3.5 6L12 21.5 2.5 9zM2.5 9h19M8.5 3l-2.5 6 6 12.5 6-12.5-2.5-6"/></svg>',
  glass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10l-1.3 8.5a3.7 3.7 0 0 1-7.4 0zM12 15.5V21M8 21h8"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 13v4M8.5 21h7M9.5 21l.5-4h4l.5 4"/></svg>'
};
const TAG_ICON = { legendary_vintage: "crown", excellent_vintage: "sparkle", rare: "gem", drinking_now: "glass" };

function markerIcons(item) {
  const t = T();
  let h = "";
  if (item.recommended) h += `<span class="marker" title="${esc(t.ui.recommended)}">${ICONS.star}</span>`;
  (item.tags || []).forEach((tg) => {
    if (TAG_ICON[tg]) h += `<span class="marker" title="${esc(t.tags[tg] || tg)}">${ICONS[TAG_ICON[tg]]}</span>`;
  });
  if (item.ratings && item.ratings.length) h += `<span class="marker" title="${esc(t.ui.bestRated)}">${ICONS.trophy}</span>`;
  return h;
}

function legendHtml() {
  const t = T();
  const items = [["star", t.ui.recommended], ["crown", t.tags.legendary_vintage],
    ["sparkle", t.tags.excellent_vintage], ["gem", t.tags.rare],
    ["glass", t.tags.drinking_now], ["trophy", t.ui.bestRated]];
  return `<div class="legend">` + items.map(([ic, lbl]) =>
    `<span class="legend-item"><span class="marker">${ICONS[ic]}</span>${esc(lbl)}</span>`).join("") + `</div>`;
}

function nameHtml(item) {
  const marked = esc(item.name).replace(/((?:19|20)\d{2})/, '<span class="vintage">$1</span>');
  const marks = markerIcons(item);
  return marked +
    (marks ? ` <span class="markers">${marks}</span>` : "") +
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
  } else if (currentSection === "__regions") {
    html = REGIONS.map((rg) => {
      const map = (typeof REGION_MAPS !== "undefined" && REGION_MAPS[rg.id]) || "";
      const apps = (rg.appellations || []).map((a) => `<span class="region-app">${esc(a)}</span>`).join("");
      return `<section class="region-card">
        <div class="region-map">${map}</div>
        <div class="region-text">
          <h2 class="region-name">${esc(rg.name[lang] || rg.name.en)}</h2>
          <div class="region-sub">${esc((rg.sub && (rg.sub[lang] || rg.sub.en)) || "")}</div>
          <p class="region-blurb">${esc(rg.blurb[lang] || rg.blurb.en)}</p>
          <div class="region-apps">${apps}</div>
        </div>
      </section>`;
    }).join("");
    if (!REGIONS.length) html = `<p class="no-results">${t.ui.noResults}</p>`;
  } else if (ratedOnly) {
    const rated = [];
    DATA.sections.forEach((sec, si) => {
      sec.categories.forEach((cat, ci) => {
        cat.groups.forEach((g, gi) => {
          g.items.forEach((item, ii) => {
            if (!(item.ratings && item.ratings.length)) return;
            rated.push({ item, ref: [si, ci, gi, ii].join("."), sec, country: g.country, best: bestScore(item) });
          });
        });
      });
    });
    rated.sort((a, b) => b.best - a.best);
    if (rated.length) {
      html += `<section class="cat"><h2 class="cat-title">${esc(t.ui.bestRated)}</h2><div class="ornament" aria-hidden="true">◆</div>`;
      html += rated.map((r) => itemHtml(r.item, r.ref, [t.sections[r.sec.id], r.country ? t.countries[r.country] : null].filter(Boolean).join(" · "))).join("");
      html += `</section>`;
    } else {
      html = `<p class="no-results">${t.ui.noResults}</p>`;
    }
  } else if (picksOnly) {
    let total = 0;
    let newHtml = "";
    DATA.sections.forEach((sec, si) => {
      sec.categories.forEach((cat, ci) => {
        cat.groups.forEach((g, gi) => {
          g.items.forEach((item, ii) => {
            if (!item.new) return;
            total++;
            const ctx = [t.sections[sec.id], g.country ? t.countries[g.country] : null].filter(Boolean).join(" · ");
            newHtml += itemHtml(item, [si, ci, gi, ii].join("."), ctx);
          });
        });
      });
    });
    if (newHtml) html += `<section class="cat"><h2 class="cat-title">${esc(t.ui.newArrivals)}</h2><div class="ornament" aria-hidden="true">◆</div>${newHtml}</section>`;
    DATA.sections.forEach((sec, si) => {
      let secHtml = "";
      sec.categories.forEach((cat, ci) => {
        cat.groups.forEach((g, gi) => {
          g.items.forEach((item, ii) => {
            if (!item.recommended) return;
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

/* producer blurb: longest producers.json key contained in the wine's
   producer string (case-insensitive), so "Clai" also covers "Giorgio Clai". */
function producerInfo(producer) {
  if (!producer) return null;
  const p = producer.toLowerCase();
  let best = null;
  for (const key of Object.keys(PRODUCERS)) {
    if (key.charAt(0) === "_") continue;
    if (p.includes(key.toLowerCase()) && (!best || key.length > best.length)) best = key;
  }
  return best ? PRODUCERS[best] : null;
}

/* top dishes from the kitchen menu that suit this wine */
function dishesForWine(ins) {
  if (!ins || !MENU || !MENU.dishes) return [];
  const scored = MENU.dishes.map((dish) => {
    let sc = (dish.pairings || []).filter((k) => (ins.pairings || []).includes(k)).length * 3;
    if ((dish.styles || []).includes(ins.style)) sc += 3;
    return { dish, sc };
  }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
  return scored.slice(0, 2).map((x) => x.dish);
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
    ${(item.tags && item.tags.length) ? `<div class="detail-tags">${item.tags.map((tg) => `<span class="wine-tag tag-${tg}">${TAG_ICON[tg] ? `<span class="marker">${ICONS[TAG_ICON[tg]]}</span>` : ""}${esc(t.tags[tg] || tg)}</span>`).join("")}</div>` : ""}
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
    </div>
    ${(() => {
      const info = producerInfo(item.producer);
      const blurb = info && info.blurb && (info.blurb[lang] || info.blurb.en);
      if (!blurb) return "";
      const ter = info.region ? `<div class="detail-terroir"><span class="detail-label">${esc(t.ui.terroir)}</span> ${esc(info.region)}</div>` : "";
      return `<div class="detail-winemaker"><div class="detail-label">${esc(t.ui.winemaker)}${item.producer ? " · " + esc(item.producer) : ""}</div><p>${esc(blurb)}</p>${ter}</div>`;
    })()}
    ${(() => {
      const dishes = dishesForWine(ins);
      if (!dishes.length) return "";
      return `<div class="detail-dishes"><span class="detail-label">${esc(t.ui.pairsWith)}</span>${dishes.map((dn) => `<span class="dish-chip">${esc(dn.name[lang] || dn.name.en || dn.name.hr)}</span>`).join("")}</div>`;
    })()}`;
  $("modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("modal").classList.add("hidden");
  document.body.style.overflow = "";
}

/* ---------- "Help me choose" sommelier wizard ---------- */
/* Glass silhouettes traced from the house stemware (product photos):
   Grand Cru Champagne wine glass (tall tulip), Veloce Riesling, Veloce Chardonnay (white
   Burgundy), Winewings Pinot Noir/Nebbiolo (barrel bowl on the flat
   "wing" base), Winewings Cabernet/Merlot (tall tapered cone on the
   wing), small dessert tulip. */
const GLASS_ICONS = {
  champagne: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M13.5,5 C10.8,14 9.8,22 10.2,29 C10.6,37 13.5,43.5 20,46 C26.5,43.5 29.4,37 29.8,29 C30.2,22 29.2,14 26.5,5 L13.5,5"/><path d="M20,46 V88"/><path d="M10.5,93 c3.8,-3 15.2,-3 19,0"/></svg>',
  riesling: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M13.5,8 C12,16 11.2,26 11.2,32 L20,48 L28.8,32 C28.8,26 28,16 26.5,8 L13.5,8"/><path d="M20,48 V88"/><path d="M10.5,93 c3.8,-3 15.2,-3 19,0"/></svg>',
  chardonnay: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M11,10 C9.4,16 8.6,24 8.6,30 L20,46 L31.4,30 C31.4,24 30.6,16 29,10 L11,10"/><path d="M20,46 V88"/><path d="M10.5,93 c3.8,-3 15.2,-3 19,0"/></svg>',
  pinot: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M13,6 C9.8,12 7.8,21 7.8,29 C7.8,37 8.4,41.5 9.5,43.5 C12,45.8 28,45.8 30.5,43.5 C31.6,41.5 32.2,37 32.2,29 C32.2,21 30.2,12 27,6 L13,6"/><path d="M20,45.8 V88"/><path d="M10.5,93 c3.8,-3 15.2,-3 19,0"/></svg>',
  cabernet: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M14.5,4 C12.6,14 11,26 10.4,34 C10,40 10.4,42.8 11.2,44.6 C13.4,46.7 26.6,46.7 28.8,44.6 C29.6,42.8 30,40 29.6,34 C29,26 27.4,14 25.5,4 L14.5,4"/><path d="M20,46 V88"/><path d="M10.5,93 c3.8,-3 15.2,-3 19,0"/></svg>',
  dessert: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M15,22 C13.9,27 13.2,33 13.2,37 L20,50 L26.8,37 C26.8,33 26.1,27 25,22 L15,22"/><path d="M20,50 V88"/><path d="M10.5,93 c3.8,-3 15.2,-3 19,0"/></svg>'
};
function glassFor(style, grape) {
  if (!style) return null;
  if (style.startsWith("sparkling") || style.startsWith("champagne")) return "champagne";
  if (style === "sweet") return "dessert";
  if (style.startsWith("red")) {
    /* Winewings varietal logic: Pinot Noir & Nebbiolo take the barrel
       bowl; Cabernet, Merlot and other cuvées the tall tapered one. */
    return /pinot|nebbiolo|burgund/i.test(grape || "") || style === "red_light" ? "pinot" : "cabernet";
  }
  if (style === "white_rich") return "chardonnay";
  return "riesling";
}

const HELPER_BUDGET = { b1: [0, 60], b2: [60, 120], b3: [120, Infinity], any: [0, Infinity] };
const helperState = { step: 0, dish: null };

function openHelper() {
  helperState.step = 0; helperState.dish = null;
  renderHelperStep();
  $("modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function dishName(dish) {
  return dish.name[lang] || dish.name.en || dish.name.hr;
}

function renderHelperStep() {
  const t = T();
  const h = t.helper;
  let inner;
  if (helperState.step === 0) {
    /* Step 1: pick a real dish from the kitchen menu, grouped by course. */
    let groups = "";
    (MENU.courses || []).forEach((course) => {
      const dishes = MENU.dishes.filter((d) => d.course === course);
      if (!dishes.length) return;
      groups += `<div class="helper-course">${esc(h.courses[course] || course)}</div><div class="helper-opts">` +
        dishes.map((d) => `<button class="helper-opt" data-dish="${esc(dishName(d))}">${esc(dishName(d))}</button>`).join("") +
        `</div>`;
    });
    inner = `<h3 class="helper-q">${esc(h.pickDish)}</h3>${groups}`;
  } else {
    inner = `<h3 class="helper-q">${esc(h.qBudget)}</h3><div class="helper-opts">` +
      Object.keys(h.budget).map((k) => `<button class="helper-opt" data-k="${k}">${esc(h.budget[k])}</button>`).join("") + `</div>`;
  }
  $("modal-body").innerHTML = `<div class="helper"><div class="helper-title">🍷 ${esc(h.title)}</div>${inner}</div>`;
  $("modal-body").querySelectorAll(".helper-opt").forEach((b) =>
    b.addEventListener("click", () => {
      if (helperState.step === 0) {
        helperState.dish = MENU.dishes.find((d) => dishName(d) === b.dataset.dish);
        helperState.step = 1;
        renderHelperStep();
      } else {
        renderHelperResults(b.dataset.k);
      }
    })
  );
}

function renderHelperResults(budgetKey) {
  const t = T();
  const dish = helperState.dish || { pairings: [], styles: [] };
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
          score += (ins.pairings || []).filter((p) => (dish.pairings || []).includes(p)).length * 3;
          if ((dish.styles || []).includes(ins.style)) score += 3;
          if (item.recommended) score += 1;
          if (score <= 0) return;
          scored.push({ score: score + Math.random() * 0.4, ref: [si, ci, gi, ii].join("."), item, sec, country: g.country });
        });
      });
    });
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  const forDish = helperState.dish ? `<div class="helper-fordish">${esc(dishName(helperState.dish))}</div>` : "";
  const list = top.length
    ? top.map((r) => itemHtml(r.item, r.ref, t.sections[r.sec.id], true)).join("")
    : `<p class="no-results">${t.ui.noResults}</p>`;
  $("modal-body").innerHTML = `<div class="helper"><div class="helper-title">🍷 ${esc(t.helper.results)}</div>${forDish}${list}<button class="helper-opt helper-again">${esc(t.helper.again)}</button></div>`;
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
$("search").addEventListener("input", () => {
  if ($("search").value.trim() && (picksOnly || ratedOnly)) {
    picksOnly = false;
    ratedOnly = false;
    $("picks-toggle").classList.remove("active");
    $("rated-toggle").classList.remove("active");
  }
  renderContent();
});
$("modal-close").addEventListener("click", closeModal);
$("modal-backdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
$("home-logo").addEventListener("click", showStart);
$("story-enter").addEventListener("click", showApp);
$("picks-toggle").addEventListener("click", () => {
  picksOnly = !picksOnly;
  if (picksOnly) ratedOnly = false;
  $("search").value = "";
  $("picks-toggle").classList.toggle("active", picksOnly);
  $("rated-toggle").classList.remove("active");
  renderContent();
  window.scrollTo({ top: 0 });
});
$("rated-toggle").addEventListener("click", () => {
  ratedOnly = !ratedOnly;
  if (ratedOnly) picksOnly = false;
  $("search").value = "";
  $("rated-toggle").classList.toggle("active", ratedOnly);
  $("picks-toggle").classList.remove("active");
  renderContent();
  window.scrollTo({ top: 0 });
});
$("helper-open").addEventListener("click", openHelper);

if ("serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

init();
