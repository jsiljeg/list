/* Theatrium by Filho — app logic */
"use strict";

const LS_KEY = "theatrium-lang";

/* Croatian flag needs a unique clip-path id per rendered instance:
   duplicate SVG ids across the DOM (start screen + header) make the
   browser resolve the clip against a hidden copy and the šahovnica
   disappears, leaving what looks like the Dutch tricolour. */
/* Croatia is the one flag not drawn by hand. Nine of the ten are simple enough
   to draw — bands, crosses, a couple of stars — but the Croatian coat of arms is
   a shield of 25 squares under a crown of five historical shields carrying a
   crescent, three crowned leopard heads, a goat and a running marten, and a
   drawn approximation of that is exactly what it looks like. assets/flag-hr.svg
   carries the official artwork verbatim from the public-domain Flag_of_Croatia.svg
   on Wikimedia Commons, re-framed from 1:2 onto the 60x40 box the rest of the set
   uses; the arms keep their proportion of the flag height and their off-centre
   placement, so the shield straddles the bands as it does on the real flag.

   It is an <img> and not inlined because hrFlag() is called for the language
   button, the header switch and every Croatian country heading — 67 kB of path
   data inlined would be pasted into the DOM once per call, where a file is
   fetched and cached once. */
function hrFlag() {
  return '<img class="flag-img" src="assets/flag-hr.svg" width="60" height="40" alt="" aria-hidden="true">';
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
/* language-picker flags for the two languages whose flag isn't otherwise in FLAGS */
FLAGS.sl = COUNTRY_FLAGS.SI();
FLAGS.es = COUNTRY_FLAGS.ES();

let DATA = null;
let lang = localStorage.getItem(LS_KEY);
let currentSection = null;
let picksOnly = false;
let ratedOnly = false;
let prideOnly = false;
const PRIDE_MIN = 500;

const $ = (id) => document.getElementById(id);
const bestScore = (item) => (item.ratings || []).reduce((m, r) => Math.max(m, parseFloat(r.score) || 0), 0);
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const T = () => I18N[lang] || I18N.en;

let MENU = null;
let PRODUCERS = {};
let REGIONS = [];

/* ---------- library + list ----------
   `library/wines.json` holds what a wine *is* — grape, terroir, alcohol,
   aromas, critic scores, Filho's note in eight languages — keyed by a ref like
   "meneghetti--blanc-de-blancs". `lists/theatrium.json` holds what this venue
   does with it: the section tree, the price, ★, NOVO. A second venue reuses the
   first file and writes only the second.

   The join happens here, in the browser, on ~365 wines: no build step, no
   generated file, the site stays the plain static files it has always been.
   A wine poured by the glass *and* sold by the bottle is now one library entry
   referenced twice at two prices — which is why the two copies can no longer
   drift apart, the way "Meneghetti White"/"white 2023" quietly had. */
function mergeList(lib, list) {
  const wines = (lib && lib.wines) || {};
  const missing = [];
  const sections = list.sections.map((sec) => ({
    ...sec,
    categories: sec.categories.map((cat) => ({
      ...cat,
      groups: cat.groups.map((g) => ({
        ...g,
        items: g.items.map((entry) => {
          const facts = wines[entry.ref];
          if (!facts) { missing.push(entry.ref); return null; }
          const venue = { ...entry };
          delete venue.ref;
          return { ...facts, ...venue };   /* the venue's price/★/NOVO win */
        }).filter(Boolean)
      }))
    }))
  }));
  /* validate.mjs fails the deploy on an unresolved ref, so this should be
     unreachable — but a silently shorter list is the one failure a guest
     would never notice, so say it out loud. */
  if (missing.length) console.error("wine refs not in the library:", missing.join(", "));
  return { ...list, sections };
}

/* ---------- temporarily unavailable wines ----------
   data/unavailable.json names what is out of stock tonight. Those items are
   dropped from DATA the moment it lands, before anything indexes into it, so
   the lists, the search, the badge counts, Filho's selection and the detail
   sheet's si/ci/gi/ii path all agree without a single call site knowing the
   feature exists. Nothing is removed from the library: putting the wine back
   is deleting one line from the small file. */
const hideNorm = (s) => String(s == null ? "" : s).trim().toLowerCase();

function hiddenTest(rules) {
  const rs = (Array.isArray(rules) ? rules : []).filter((r) => r && r.name);
  return (item, secId) => rs.some((r) =>
    hideNorm(r.name) === hideNorm(item.name) &&
    (!r.producer || hideNorm(r.producer) === hideNorm(item.producer)) &&
    (!r.where || (r.where === "glass" ? secId === "glass" : secId.startsWith("bottle"))));
}

/* A group, category or section left with nothing in it disappears too — an
   empty "Rosé" chip that opens onto blank space reads as a broken app. */
function dropHidden(data, rules) {
  const hit = hiddenTest(rules);
  const sections = data.sections.map((sec) => ({
    ...sec,
    categories: sec.categories.map((cat) => ({
      ...cat,
      groups: cat.groups
        .map((g) => ({ ...g, items: g.items.filter((i) => !hit(i, sec.id)) }))
        .filter((g) => g.items.length)
    })).filter((c) => c.groups.length)
  })).filter((s) => s.categories.length);
  /* Hiding the entire list is always a mistake, never an intention. */
  return sections.length ? { ...data, sections } : data;
}

/* `cache: "no-cache"` on every data fetch — not because the service worker
   forgets to (it rewrites these the same way) but because it is only in charge
   once it has installed and claimed the page, which it has not on a first visit
   or straight after its own update. GitHub Pages serves everything with
   `max-age=600`, so an uncontrolled page reads a **ten-minute-old** list out of
   the browser's own cache without ever asking the server. That is exactly what
   an edit that "didn't go live" looks like on a laptop. no-cache still lets the
   browser keep the bytes; it just has to ask first, and an unchanged file comes
   back as a bodyless 304. */
const fresh = (url) => fetch(url, { cache: "no-cache" });

function init() {
  Promise.all([
    fresh("library/wines.json").then((r) => r.json()),
    fresh("lists/theatrium.json").then((r) => r.json()),
    fresh("data/menu.json").then((r) => r.json()).catch(() => ({ courses: [], dishes: [] })),
    fresh("data/producers.json").then((r) => r.json()).catch(() => ({ producers: {} })),
    fresh("data/regions.json").then((r) => r.json()).catch(() => ({ regions: [] })),
    fresh("data/unavailable.json").then((r) => r.text()).catch(() => "")
  ]).then(([lib, list, m, pr, rg, unText]) => {
      FULL = mergeList(lib, list);
      hiddenRaw = unText;
      const d = dropHidden(FULL, parseHidden(unText));
      DATA = d;
      GLASS_PRICE = null;
      MENU = m;
      PRODUCERS = pr.producers || {};
      REGIONS = rg.regions || [];
      currentSection = d.sections[0].id;
      const idleReset = sessionStorage.getItem("idle-reset");
      sessionStorage.removeItem("idle-reset");
      if (lang && I18N[lang] && !idleReset) showApp(); else showStart();
      startPolling();
  });
}

/* ---------- staying current while the tablet is in a guest's hands ----------
   The app used to read its data once, at load. A tablet on the charger picked a
   change up within about four minutes — deploy, then the three-minute idle
   reload — but a tablet somebody was actually *reading* never reloaded at all.
   A wine 86'd at the start of a long browse could still be ordered at the end
   of it, which is the whole point of that feature, missed.

   Every 30 seconds the app now re-reads the 86 list **and the list itself**, as
   conditional requests: an unchanged file answers 304 with no body, so the
   steady state is three tiny round trips a minute even though the library is
   270 kB. A corrected tasting note or a new price is live within the minute,
   the same as an 86.

   What still needs a reload is *code*. A change to app.js, i18n.js or a search
   alias cannot be swapped into a running page, and rides the idle reload. */
const POLL_MS = 30000;
let FULL = null;         /* the merged list with nothing hidden — the baseline
                            every update is re-derived from, so unhiding a wine
                            brings it back without a reload */
let hiddenRaw = "";      /* the last 86 list applied, so no-op polls are free */
let dataRaw = "";        /* library+list as last seen, to spot a real change */
let pending = null;      /* an update waiting for the detail sheet to be closed */

function parseHidden(text) {
  try { return JSON.parse(text).hidden || []; } catch (e) { return []; }
}

/* One path for both kinds of change. `lib`/`list` are present only when the
   content itself moved; otherwise the merged baseline is left alone. */
function applyUpdate(u) {
  if (u.lib && u.list) FULL = mergeList(u.lib, u.list);
  DATA = dropHidden(FULL, u.rules);
  GLASS_PRICE = null;   /* a wine can be 86'd off one shelf and not the other */
  /* The guest may be standing in a category that just emptied. */
  if (!DATA.sections.some((s) => s.id === currentSection)) currentSection = DATA.sections[0].id;
  if (appEntered && !$("app").classList.contains("hidden")) {
    /* renderContent() re-reads the search box and every toggle, so the view
       comes back as the guest left it. Only the scroll needs holding: the
       column is rebuilt from scratch and the browser would send them to the top
       of it mid-read. */
    const y = window.scrollY;
    renderNav();
    renderContent();
    window.scrollTo(0, y);
  }
}

function pollData() {
  return Promise.all([
    fresh("library/wines.json").then((r) => (r.ok ? r.text() : null)),
    fresh("lists/theatrium.json").then((r) => (r.ok ? r.text() : null)),
    fresh("data/unavailable.json").then((r) => (r.ok ? r.text() : null))
  ]).then(([libText, listText, unText]) => {
    if (libText == null || listText == null || unText == null) return;
    /* Compared as text rather than by ETag. ETag was the first attempt and it
       *looked* right against GitHub Pages, which sends one — but any server
       that does not (our own test server, for one) made this silently do
       nothing for ever, which is the worst way for a freshness check to fail.
       The bytes cost nothing to compare: a 304 is answered from the browser
       cache, so `text()` is a local read, not a download. */
    const contentMoved = !!dataRaw && (libText + "\u0000" + listText) !== dataRaw;
    const hiddenMoved = unText !== hiddenRaw;
    dataRaw = libText + "\u0000" + listText;
    if (!contentMoved && !hiddenMoved) return;
    hiddenRaw = unText;

    const update = { rules: parseHidden(unText) };
    if (contentMoved) {
      try {
        update.lib = JSON.parse(libText);
        update.list = JSON.parse(listText);
      } catch (e) {
        /* Half-published deploy: keep the list we have and try again in 30s. */
        return;
      }
    }

    /* Never rebuild DATA under an open detail sheet. Every sheet is addressed by
       an si/ci/gi/ii path into DATA, so re-deriving it beneath one would leave
       the arrows stepping onto the wrong wines — and yanking a card out from
       under someone reading it is worse than the half-minute saved. It lands
       when they close it. */
    if (modalOpen) { pending = update; return; }
    applyUpdate(update);
  }).catch(() => { /* offline, or a deploy mid-flight: keep what we have */ });
}
/* The name the availability tests drive the tick by. */
function pollHidden() { return pollData(); }

function startPolling() {
  setInterval(pollData, POLL_MS);
  /* A tablet that was asleep in an apron pocket should not wait out the rest of
     its interval when it comes back. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pollData();
  });
}

/* Called by hideModal(): the deferred update lands the moment the sheet is gone. */
function flushHidden() {
  if (!pending) return;
  const u = pending;
  pending = null;
  applyUpdate(u);
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
      appEntered ? showApp() : showStory();   /* changing language skips the intro splash */
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
let appEntered = false;
function showApp() {
  guardBack();
  appEntered = true;
  $("start").classList.add("hidden");
  $("story-screen").classList.add("hidden");
  $("app").classList.remove("hidden");
  document.documentElement.lang = lang;
  const t = T();
  $("subtitle").textContent = t.ui.subtitle;
  $("search").placeholder = t.ui.search;
  $("legal").textContent = t.ui.legal;
  $("company").textContent = t.ui.company;
  $("copyright").textContent = t.ui.copyright;
  $("picks-toggle").querySelector("span").textContent = t.ui.picks;
  $("picks-toggle").classList.toggle("active", picksOnly);
  $("rated-toggle").querySelector("span").textContent = t.ui.bestRated;
  $("rated-toggle").classList.toggle("active", ratedOnly);
  $("pride-toggle").innerHTML = `${ICONS.crown}<span>${esc(t.ui.pride)}</span>`;
  $("pride-toggle").classList.toggle("active", prideOnly);
  $("helper-open").querySelector("span").textContent = t.helper.title;
  renderLangSwitch();
  renderNav();
  renderContent();
}

/* One compact language control (globe + current language) instead of a row
   of flags — the flags belong on the pick screen, not over the wines. Tap
   it to return to the language picker. */
const GLOBE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9s1.4-6.6 3.9-9z"/></svg>';
function renderLangSwitch() {
  const box = $("lang-switch");
  const cur = LANGS.find((l) => l.code === lang) || LANGS[0];
  box.innerHTML = `<button class="lang-current" type="button" aria-label="${esc(cur.name)}" title="${esc(cur.name)}"><span class="globe-sm">${GLOBE_SVG}</span><span class="lang-name">${esc(cur.name)}</span></button>`;
  box.querySelector("button").addEventListener("click", showStart);
}

function renderNav() {
  const t = T();
  const nav = $("nav");
  const hasNew = DATA.sections.some((s) => s.categories.some((c) => c.groups.some((g) => g.items.some((i) => i.new))));
  nav.innerHTML =
    `<button data-sec="__regions" class="region-chip ${currentSection === "__regions" ? "active" : ""}">◆ ${esc(t.ui.regions)}</button>` +
    (hasNew ? `<button data-sec="__new" class="region-chip ${currentSection === "__new" ? "active" : ""}">✦ ${esc(t.ui.newArrivals)}</button>` : "") +
    DATA.sections.map((s) =>
      `<button data-sec="${s.id}" class="${s.id === currentSection ? "active" : ""}">${esc(t.sections[s.id] || s.id)}</button>`
    ).join("");
  nav.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      currentSection = b.dataset.sec;
      $("search").value = "";
      picksOnly = false;
      ratedOnly = false;
      prideOnly = false;
      $("picks-toggle").classList.remove("active");
      $("rated-toggle").classList.remove("active");
      $("pride-toggle").classList.remove("active");
      renderNav();
      renderContent();
      window.scrollTo({ top: 0 });
    })
  );
}

const PRICE_LOCALE = { hr: "hr-HR", en: "en-GB", it: "it-IT", fr: "fr-FR", de: "de-DE", sl: "sl-SI", es: "es-ES", zh: "zh-CN" };
const fmtPrice = (n) => n.toLocaleString(PRICE_LOCALE[lang] || "hr-HR");

function priceHtml(item) {
  if (item.price == null) return "";
  return `<span class="item-price">${fmtPrice(item.price)}&nbsp;€</span>`;
}

/* minimalist gold marker icons for the list + legend */
const ICONS = {
  /* ---------- the three section motifs ----------
     All drawn in the same hand as the grape: an arrangement of *nails*, after
     the sculptures in the atrium. Which one a section gets is decided in
     `ornamentFor()` below.

     The alembic is wider than it is tall (36x24 against the grape's 24x24), so
     `.ornament svg` sizes by height and lets the width follow — see style.css.
     Its glass end is not a generic glass: it is the Glencairn measured off the
     owner's photograph, reduced to nails. Everything about it was learned the
     hard way at 20px, twice over — an *outline* of nails is unreadable that
     small (the same failure that killed the nail bowl), so the pot is a filled
     cluster like the grape, and legibility comes from two masses joined by an
     arc rather than from any detail. The breaks between nails are all one
     length: the grape's marks float too, but they float in rows, and a single
     stray stroke beside a wall reads as a mistake rather than as texture. */
  alembic: '<svg viewBox="0 0 36 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M4.6 9.1L7.0 10.1"/><path d="M7.0 10.1L9.4 9.1"/><path d="M3.0 12.9L5.4 11.9"/><path d="M5.4 11.9L7.8 12.9"/><path d="M7.8 12.9L10.2 11.9"/><path d="M2.2 14.7L5.0 15.7"/><path d="M5.0 15.7L7.8 14.7"/><path d="M7.8 14.7L10.6 15.7"/><path d="M2.7 18.5L5.3 17.5"/><path d="M5.3 17.5L7.9 18.5"/><path d="M7.9 18.5L10.5 17.5"/><path d="M4.4 20.1L7.0 21.1"/><path d="M7.0 21.1L9.6 20.1"/><path d="M6.4 7.6L6.8 5.6"/><path d="M8.4 7.6L8.0 5.6"/><path d="M7.3 4.7L8.9 3.7"/><path d="M9.7 3.2L11.6 3.0"/><path d="M12.6 2.9L14.4 3.0"/><path d="M15.4 3.2L17.2 3.5"/><path d="M18.1 3.9L19.8 4.8"/><path d="M20.7 5.2L22.3 6.1"/><path d="M23.1 6.7L24.7 7.6"/><path d="M25.7 8.0L27.4 8.6"/><path d="M26.7 10.2L28.9 10.2"/><path d="M29.9 10.2L32.1 10.2"/><path d="M26.7 10.7L26.3 12.7"/><path d="M26.1 13.6L25.7 15.6"/><path d="M25.5 16.5L25.1 18.5"/><path d="M25.7 19.0L27.5 20.1"/><path d="M32.1 10.7L32.5 12.7"/><path d="M32.7 13.6L33.1 15.6"/><path d="M33.3 16.5L33.7 18.5"/><path d="M33.1 19.0L31.3 20.1"/><path d="M26.6 22.8L28.9 22.8"/><path d="M29.8 22.8L32.2 22.8"/></svg>',
  /* A glass and a slice of citrus, both built out of nails.

     Seven attempts got here, and the owner named both faults. First: every
     early try was a *phenomenon* — a drop, three drops, bubbles, ripples, a
     wave — and a phenomenon has no outline, so at 24px it is a smudge. Then the
     bokal fixed that by being an object but introduced the second fault: it was
     a bare *contour*, and nothing else in this set is. The grape is rows of
     nails in the shape of a bunch; the still's pot is rows of nails in the
     shape of a pot. The mass is the mark. Only the Glencairn is an outline, and
     it gets away with it because a filled cluster stands beside it.

     So: mass, not contour, and two objects rather than one — which is also the
     alembic's structure. The glass is five rows narrowing downward under a flat
     rim; the citrus is a slice, which is the one subject where the nails *are*
     the thing, since a slice is segments. Between them they cover the shelf:
     water, juice, and something cold with a slice in it.

     The fruit is a **half** slice, not a whole one (owner, 2026-08-02: the
     glass read fine, the fruit did not read as fruit). The first version was a
     full round — spokes radiating from one shared centre inside a ring of
     dashes — and it had two faults that between them made a starburst. Every
     spoke met at a single point, which is a sunburst or an asterisk, not
     segments; and a *round* thing with marks inside it is the failure the nail
     bowl died of, an eye or a sun. Cutting it in half fixes both at once: the
     flat cut edge across the top breaks the radial symmetry that reads as a
     sun, and the segments now fan down from *along* that edge, stopping short
     of it, so nothing converges. It was checked against four other drawings
     (whole disc, denser disc, wedge) at 18/24/32/48/130px — the wedge read as
     an arrow, both discs as a flower, and this one as fruit at every size. */
  water: '<svg viewBox="0 0 34 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M5.6 7.0L9.0 7.0"/><path d="M9.0 7.0L12.4 7.0"/><path d="M5.9 10.2L9.0 11.0"/><path d="M9.0 11.0L12.1 10.2"/><path d="M6.3 13.4L9.0 14.2"/><path d="M9.0 14.2L11.7 13.4"/><path d="M6.8 16.6L9.0 17.4"/><path d="M9.0 17.4L11.2 16.6"/><path d="M7.4 19.8L9.0 20.5"/><path d="M9.0 20.5L10.6 19.8"/><path d="M16.6 11.4L20.3 11.4"/><path d="M21.3 11.4L25.1 11.4"/><path d="M26.1 11.4L29.8 11.4"/><path d="M29.8 12.0L29.4 13.7"/><path d="M28.9 14.8L27.7 16.2"/><path d="M26.8 16.9L25.2 17.7"/><path d="M24.1 17.9L22.3 17.9"/><path d="M21.2 17.7L19.6 16.9"/><path d="M18.7 16.2L17.5 14.8"/><path d="M17.0 13.7L16.6 12.0"/><path d="M25.5 12.1L28.1 13.0"/><path d="M24.6 13.3L26.3 15.6"/><path d="M23.2 13.8L23.2 16.6"/><path d="M21.8 13.3L20.1 15.6"/><path d="M20.9 12.1L18.3 13.0"/></svg>',
  /* The atrium's nails, arranged as a bunch of grapes: the restaurant's own
     material, the list's own subject. Fifteen short marks laid out 3-4-3-2-1
     under a stem — no two parallel, none of them touching. The bunch comes
     from the arrangement alone, never from an outline, so there is no stroke
     junction for the eye to resolve into a written character. */
  grape: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M12 6.4L12.6 2.4"/><path d="M11.2 2.9L13.9 2.2"/><path d="M7.7 8.2L10.3 9.2"/><path d="M10.9 9.5L13.2 8.1"/><path d="M13.9 8.4L16.3 9.5"/><path d="M6.2 11.6L8.7 10.4"/><path d="M9.3 11.1L11.8 12.3"/><path d="M12.4 12.1L14.8 10.8"/><path d="M15.4 11.3L17.8 12.4"/><path d="M7.6 14.3L10.2 15.4"/><path d="M10.8 15.2L13.2 13.9"/><path d="M13.8 14.4L16.2 15.5"/><path d="M9.2 17.6L11.7 18.6"/><path d="M12.3 18.4L14.7 17.1"/><path d="M11 20.7L13.2 21.4"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.26 6.9.6-5.2 4.5 1.55 6.74L12 17.2 5.85 20.6 7.4 13.86 2.2 9.36l6.9-.6z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4.2 3.4L12 4l4.8 7.4L21 8l-1.7 11H4.7L3 8z"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 7.6L21.5 12l-7.6 2.4L12 22l-1.9-7.6L2.5 12l7.6-2.4z"/></svg>',
  gem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 3h12l3.5 6L12 21.5 2.5 9zM2.5 9h19M8.5 3l-2.5 6 6 12.5 6-12.5-2.5-6"/></svg>',
  glass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10l-1.3 8.5a3.7 3.7 0 0 1-7.4 0zM12 15.5V21M8 21h8"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 13v4M8.5 21h7M9.5 21l.5-4h4l.5 4"/></svg>',
  chest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5,10.5 C3.5,6 20.5,6 20.5,10.5 V18 C20.5,18.6 20,19 19.4,19 H4.6 C4,19 3.5,18.6 3.5,18 Z"/><path d="M3.5,13 H20.5"/><path d="M11,13 V15.6 H13 V13"/></svg>'
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

/* localized item name (wines keep their original name; some non-wine
   items — e.g. waters — carry a nameI18n map for descriptor words) */
const itemName = (item) => (item.nameI18n && item.nameI18n[lang]) || item.name;

function nameHtml(item) {
  const marked = esc(itemName(item)).replace(/\b((?:19|20)\d{2})\b/, '<span class="vintage">$1</span>');
  const gloss = wineZh(itemName(item));
  const marks = markerIcons(item);
  return marked +
    (gloss ? ` <span class="zh-gloss">（${gloss}）</span>` : "") +
    (marks ? ` <span class="markers">${marks}</span>` : "") +
    (item.new ? ` <span class="new-badge">${esc(T().ui.newBadge)}</span>` : "");
}

function itemFlag(item) {
  const c = item.insight && item.insight.country;
  return c && COUNTRY_FLAGS[c] ? ` <span class="item-flag" title="${esc(T().countries[c] || c)}">${COUNTRY_FLAGS[c]()}</span>` : "";
}

function itemHtml(item, ref, context, showFlag, aside) {
  const clickable = !!item.insight;
  return `<${clickable ? `button class="item clickable" data-ref="${ref}"` : 'div class="item"'}>
    <span class="item-row">
      <span class="item-name">${nameHtml(item)}</span>
      <span class="dots" aria-hidden="true"></span>
      ${priceHtml(item)}
      ${clickable ? '<span class="item-chevron">›</span>' : ""}
    </span>
    ${item.producer || showFlag || aside ? `<span class="item-producer">${esc(item.producer || "")}${producerZh(item.producer) ? `<span class="zh-gloss">（${producerZh(item.producer)}）</span>` : ""}${showFlag ? itemFlag(item) : ""}${aside ? `<span class="item-aside">${aside}</span>` : ""}</span>` : ""}
    ${context ? `<span class="search-context">${esc(context)}</span>` : ""}
  </${clickable ? "button" : "div"}>`;
}

/* Producer|name → the by-the-glass price, for the wines sold both ways. 24 of
   the 32 pours are, which is what makes the sommelier's glass offer work as a
   line on a bottle rather than as a second list. Rebuilt whenever DATA is,
   since a wine can be 86'd off one shelf and not the other. */
let GLASS_PRICE = null;
function glassPrices() {
  if (GLASS_PRICE) return GLASS_PRICE;
  GLASS_PRICE = new Map();
  const sec = DATA.sections.find((s) => s.id === "glass");
  if (sec) for (const cat of sec.categories) for (const g of cat.groups) for (const it of g.items)
    if (it && typeof it.price === "number") GLASS_PRICE.set(`${it.producer}|${it.name}`, it.price);
  return GLASS_PRICE;
}

/* Cross-language search aliases: canonical region/grape token (as stored, lower-
   case) → extra searchable terms in other languages + Chinese, so e.g. "Burgun"
   finds Bourgogne wines. Keys are matched as substrings of the item haystack. */
const SEARCH_ALIAS = {
  // regions
  "bourgogne": "burgundy burgundija burgund borgogna borgoña 勃艮第",
  "toscana": "tuscany toskana toscane toskana 托斯卡纳",
  "piemonte": "piedmont piemont piémont 皮埃蒙特",
  "sicilia": "sicily sicilija sizilien sicile 西西里",
  "bordeaux": "bordo 波尔多",
  "champagne": "šampanjac 香槟",
  "españa": "spain spanish spanien espagne španjolska 西班牙",
  "rioja": "里奥哈",
  "mosel": "moselle 摩泽尔",
  "napa": "纳帕",
  "dalmacija": "dalmatia dalmatien dalmazia dalmatie 达尔马提亚",
  "istra": "istria istrien istrie 伊斯特拉",
  "veneto": "威尼托",
  "friuli": "friaul 弗留利",
  "alto adige": "südtirol sudtirol south tyrol 上阿迪杰",
  "loire": "卢瓦尔",
  "rheinhessen": "rhine hesse 莱茵黑森",
  "chablis": "夏布利",
  "barolo": "巴罗洛",
  "barbaresco": "巴巴莱斯科",
  "montalcino": "brunello 蒙塔奇诺",
  // grapes
  "pinot noir": "crni pinot pinot nero spätburgunder spatburgunder blauburgunder modri pinot 黑皮诺",
  "pinot grigio": "pinot gris grauburgunder sivi pinot 灰皮诺",
  "pinot blanc": "pinot bianco weissburgunder bijeli pinot 白皮诺",
  "chardonnay": "霞多丽",
  "riesling": "rajnski rizling rizling 雷司令",
  "cabernet sauvignon": "赤霞珠",
  "merlot": "美乐",
  "sauvignon blanc": "长相思",
  /* Pure grape synonyms, so they belong on the grape (unlike "brunello",
     which names a place). Dropping "Sauvignonasse" from Simčič's grape
     field would otherwise have made the word findable nowhere.
     "Tocai" and "Tokaj" are both here on purpose: no guest-facing text spells
     the grape Tocai any more (the notes tell the story as Tokaj, so that
     JAKOT reads as its reversal), but both spellings are on older labels and
     merchants' lists, and a guest who types either must land on the wine. */
  "friulano": "sauvignonasse sauvignon vert tocai tocai friulano tokaj tokaji jakot zeleni sauvignon 弗留拉诺",
  "syrah": "shiraz 西拉",
  "nebbiolo": "内比奥罗",
  /* "brunello" is deliberately NOT here. It is a Montalcino synonym for
     Sangiovese Grosso, so listing it as a grape alias made every Tuscan
     Sangiovese answer to it — a guest typing "brunello" got eighteen wines,
     four of them actually from Montalcino. The "montalcino" alias below already
     carries it, which is the appellation the guest means. */
  "sangiovese": "桑娇维塞",
  "malvazija": "malvasia malvasia istriana 马尔瓦齐娅",
  "plavac mali": "plavac 普拉瓦茨",
  "furmint": "福尔明特",
  /* One variety, many names. Whichever a guest knows, they find all of them.
     Diacritic-free spellings included: the search does not fold accents. */
  "tribidrag": "zinfandel primitivo pribidrag crljenak crljenak kaštelanski " +
    "crljenak kastelanski kaštelanski crljenak kastelanski crljenak " +
    "kratošija kratosija 特里比德拉格 仙粉黛",
  "graševina": "grasevina 格拉舍维纳",
  /* Grapes a guest names by a synonym we don't store. Each was found by typing
     what a guest would type and getting nothing back (2026-08-02):
     - Garnacha is on one label (López de Heredia's Bosconia); the rest of the
       world says Grenache.
     - Ribolla Gialla is Rebula to every Slovenian and most Croatians — the same
       grape on the other side of one border, the same case as Friulano/Jakot.
     - Rukatac is Maraština on half of Dalmatia's labels. Both stay out of the
       Malvasia bucket on purpose (see the one-grape-one-name rule): the variety
       *is* Malvasia Bianca Lunga, but folding it in would make a search for
       "malvasia" mix it with Malvazija istarska, which is what that rule exists
       to prevent. */
  "garnacha": "grenache",
  "ribolla": "rebula ribolla gialla",
  "rukatac": "maraština marastina"
};

/* Words for a *style* rather than a grape or a place. The style strings
   themselves are already in the haystack (itemHay), but they are written to be
   read on a card, not typed into a box: the Croatian one says "Macerirano
   bijelo · odležano na kožici", which no guest types, and none of the eight
   says "amber". These are the words people actually use for the shelf.
   The stems matter as much as the words — hayMatch anchors at a word start, so
   "maceration" answers "macerat" and "macerirano" answers "macerir", but
   neither answers the other. Both spellings of the Croatian go in, because the
   search folds accents only when the query carries none.

   The colour words are here for the same reason. The style strings are
   adjectives agreeing with *vino* — "Bijelo · svježe", "Crno · puno" — so
   "bijelo" found 116 wines and "bijela", the form in the section title the
   guest is looking at, found one. Whatever the app puts on screen has to be
   typeable. */
const BUBBLES = "pjenušac pjenušci pjenusac pjenusci pjenušavo vino sparkling wine spumante";
const CHAMPAGNE = "šampanjac sampanjac " + BUBBLES;
const WHITE = "bijela vina bijelo vino white wine vino bianco vin blanc weisswein";
const RED = "crna vina crno vino red wine vino rosso vin rouge rotwein";
const STYLE_ALIAS = {
  "orange": "orange wine amber wine ambrato macerirano macerirana maceracija " +
    "narančasto vino narancasto vino maceration macerated skin contact " +
    "macerato vino arancione vin orange macération oranje orangewein maischevergoren " +
    "oranžno vino oranzno vino vino naranja ámbar 橙酒 橘酒 " + WHITE,
  "sweet": "dessert wine desertno vino slatko vino süßwein susswein vin doux " +
    "vino dolce vino dulce sladko vino 甜酒",
  "sparkling": BUBBLES,
  "sparkling_rose": BUBBLES + " rosé vina roze",
  "champagne": CHAMPAGNE,
  "champagne_bdb": CHAMPAGNE + " blanc de blancs",
  "champagne_bdn": CHAMPAGNE + " blanc de noirs",
  "champagne_rose": CHAMPAGNE + " rosé vina roze",
  "champagne_prestige": CHAMPAGNE + " prestige cuvée prestige cuvee",
  "rose": "rosé vina roze rosato rosado",
  "white_fresh": WHITE,
  "white_aromatic": WHITE,
  "white_mineral": WHITE,
  "white_rich": WHITE,
  "red_light": RED,
  "red_medium": RED,
  "red_full": RED,
  "red_mature": RED
};

/* Food words whose stored phrasing doesn't contain the word a guest types.
   `hayMatch` anchors at a word start, so "jela s tartufima" answers "tartufi"
   by luck of Croatian morphology while "truffle dishes" does not answer
   "truffles" — the plural is not a prefix of the singular. Keyed by pairing
   key; add a line whenever a guest types something reasonable and gets zero. */
const PAIRING_ALIAS = {
  "truffles": "truffles tartufi tartuf tartufo trüffel truffe",
  /* Biftek is what a Croatian says, and what this kitchen writes on two of its
     own dishes — "Tartar od bifteka", "Rižoto od bifteka". */
  "beef": "biftek",
  "steak": "biftek biftec"
};

/* Synonyms that must NOT go into the haystack, because they contain another
   variety's name as a substring. "Riesling italico" is Graševina, which is not
   a Riesling at all — pasting it into the haystack would make a search for
   "riesling" return Graševina. So these rewrite the query instead: typing the
   synonym finds the wine, typing "riesling" never does. */
const SEARCH_QUERY_ALIAS = [
  [/riesling italico|welschriesling|olaszrizling|laški rizling|laski rizling/g, "graševina"]
];
function expandQuery(q) {
  for (const [re, to] of SEARCH_QUERY_ALIAS) q = q.replace(re, to);
  return q;
}
/* "Kuća" and "Kuca" should both find the house. Latin-1 accents and the Slavic
   carons are stripped so a guest on any keyboard reaches the same wines. */
function fold(str) {
  return str.normalize ? str.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D") : str;
}
/* A query matches where a word starts, not anywhere inside one. Plain substring
   matching turned "burgun" into 94 hits: SEARCH_ALIAS feeds every Pinot its
   German names, so spätburgunder, grauburgunder, weissburgunder and
   blauburgunder all contain the query, and a guest looking for Burgundy got the
   whole Pinot family instead of the 51 Burgundies. Typing any of those names in
   full still finds them — they start words of their own. Chinese has no word
   boundaries to anchor to, so a CJK query falls back to a substring search. */
const CJK = /[㐀-鿿豈-﫿]/;
const WORDCHAR = /[a-z0-9À-ɏ]/;
function hayMatch(hay, q) {
  if (!q) return true;
  if (CJK.test(q)) return hay.indexOf(q) !== -1;
  for (let i = hay.indexOf(q); i !== -1; i = hay.indexOf(q, i + 1)) {
    if (i === 0 || !WORDCHAR.test(hay[i - 1])) return true;
  }
  return false;
}
function itemHay(item) {
  if (item._hay) return item._hay;
  const ins = item.insight || {};
  const parts = [item.name, item.producer, ins.grape, ins.region, item.terroir];
  if (item.nameI18n) parts.push(...Object.values(item.nameI18n));
  if (ins.country) for (const l of LANGS) {
    const c = I18N[l.code] && I18N[l.code].countries && I18N[l.code].countries[ins.country];
    if (c) parts.push(c);
  }
  /* Every name a region goes by. A Croatian guest types Pijemont, a German
     Piemont, a Frenchman Piémont — all three are the same shelf. Region and
     terroir tokens also contribute their Chinese. */
  for (const field of [ins.region, item.terroir]) {
    for (const raw of String(field || "").split(",")) {
      const tok = raw.trim();
      if (!tok) continue;
      if (typeof REGION_I18N !== "undefined" && REGION_I18N[tok]) parts.push(...Object.values(REGION_I18N[tok]));
      if (typeof REGION_ALIAS !== "undefined" && REGION_ALIAS[tok]) parts.push(...REGION_ALIAS[tok]);
      if (typeof ZH_REGION !== "undefined" && ZH_REGION[tok]) parts.push(ZH_REGION[tok]);
    }
  }
  if (typeof ZH_GRAPE !== "undefined") {
    for (const raw of String(ins.grape || "").split(",")) {
      const tok = raw.trim().replace(/\s*\d+(?:[.,]\d+)?\s*%$/, "");
      if (ZH_GRAPE[tok]) parts.push(ZH_GRAPE[tok]);
    }
  }
  /* A spirit has no grape, so without this a guest typing "rum", "mezcal",
     "Islay" or "mizunara" found nothing — the words only exist as keys until
     something renders them. Every language's rendering goes in, the same way
     the country names above do, because the search box is one box for eight
     languages. */
  if (ins.kind === "spirit" && typeof SPIRIT_I18N !== "undefined") {
    for (const l of LANGS) {
      const s = SPIRIT_I18N[l.code];
      if (!s) continue;
      if (s.classes[ins.class]) parts.push(s.classes[ins.class]);
      for (const [dict, keys] of [["bases", ins.base], ["stills", ins.still], ["casks", ins.cask]])
        for (const k of keys || []) if (s[dict][k]) parts.push(s[dict][k]);
    }
  }
  /* A wine's style is the same kind of fact, and it was missing: "orange",
     "macerirano" and "narančasto" all returned nothing, while "macerat" found
     thirteen spirits and not one of the twelve orange wines — the spirit
     vocabulary above was in the haystack and the wine vocabulary was not.
     Style and sweetness go in, in every language, so a guest can search the
     shelf the way they'd ask for it: pjenušavo, trocken, dolce, orange.

     **Body deliberately does not.** It was in here for a day and earned its
     way out by measurement: the word cannot discriminate, because "srednje
     puno" contains "puno", so a query of "puno" returned 276 of 308 wines —
     and English "medium" begins with "med", so a Croatian guest searching for
     honey got 130 wines that merely have a body. Every one of those matches
     was correct and useless. "Lagano" still finds the light reds through the
     style string, which is where the useful half of it lived anyway. */
  if (ins.kind !== "spirit") {
    for (const l of LANGS) {
      const d = I18N[l.code];
      if (!d) continue;
      for (const [dict, key] of [["styles", ins.style], ["sweetness", ins.sweetness]])
        if (key && d[dict] && d[dict][key]) parts.push(d[dict][key]);
    }
    if (STYLE_ALIAS[ins.style]) parts.push(STYLE_ALIAS[ins.style]);
  }
  /* Badges and critics: both are printed on the card, so both are typeable.
     Four tag keys and fifteen critic names — cheap, and "rijetka boca" or
     "parker" is a real way to ask. `criticName()` resolves the merchant's
     spelling first, so a rating stored as "RP" is still found as Parker. */
  for (const l of LANGS) {
    const d = I18N[l.code];
    for (const tg of item.tags || []) if (d && d.tags && d.tags[tg]) parts.push(d.tags[tg]);
  }
  for (const r of item.ratings || []) parts.push(criticName(r.critic), r.score);
  /* A large format has no separate name, only "– 1,5 l" appended. Magnum is
     what a guest calls it. */
  if (/1,5\s*l/.test(item.name || "")) parts.push("magnum");

  /* ---- the second haystack: what it tastes like and what it goes with ----
     Aromas and pairings were searchable nowhere, which for a *restaurant* list
     is the odd gap: twenty of twenty-two food words a guest might type —
     "janjetina", "tartufi", "kamenice", "pršut" — returned nothing, though
     every one of them is already translated into eight languages two files
     away. They go in a separate string rather than the main one because they
     are a weaker kind of match: a wine *named* Orange and a wine that merely
     smells of orange should not rank together, and `renderContent()` uses
     `itemCore()` to keep the first above the second. */
  const flavour = [];
  const sd = typeof SPIRIT_I18N !== "undefined" ? SPIRIT_I18N : null;
  for (const l of LANGS) {
    const d = I18N[l.code];
    if (!d) continue;
    /* SPIRIT_I18N.aromas is read before I18N.aromas, the same precedence
       `spiritTerm()` applies on the card, so peat and koji are searchable. */
    const sa = sd && sd[l.code] && sd[l.code].aromas;
    for (const k of ins.aromas || []) {
      if (sa && sa[k]) flavour.push(sa[k]);
      else if (d.aromas && d.aromas[k]) flavour.push(d.aromas[k]);
    }
    for (const k of ins.pairings || []) if (d.pairings && d.pairings[k]) flavour.push(d.pairings[k]);
  }
  for (const k of ins.pairings || []) if (PAIRING_ALIAS[k]) flavour.push(PAIRING_ALIAS[k]);

  const finish = (arr) => {
    const joined = arr.filter(Boolean).join(" ").toLowerCase();
    return joined + " " + fold(joined);
  };
  let core = finish(parts);
  /* SEARCH_ALIAS is about grapes and places, so it widens the core only. */
  for (const k in SEARCH_ALIAS) if (core.indexOf(k) !== -1) core += " " + SEARCH_ALIAS[k];
  item._core = core;
  return (item._hay = core + " " + finish(flavour));
}

/** What the wine *is* — everything but the aromas and pairings. */
function itemCore(item) {
  itemHay(item);
  return item._core;
}

/* Wine sections keep the grape; anything distilled gets the still; water and
   the soft drinks get the drop. The cross-section views (Filho's picks, the
   ratings, the new arrivals) keep the grape whatever they contain — there the
   grape is the house mark rather than a description of the shelf. */
function ornamentFor(sectionId) {
  if (sectionId === "spirits" || sectionId === "rakija-beer") return ICONS.alembic;
  if (sectionId === "other") return ICONS.water;
  return ICONS.grape;
}

function renderContent() {
  const t = T();
  const q = expandQuery($("search").value.trim().toLowerCase());
  /* Accent folding helps a foreign keyboard, but it must not erase a
     distinction the guest just made: "proš" folds to "pros", which is
     inside "prosecco" — and prošek is not prosecco. So a query that
     carries diacritics is matched literally; only an unaccented one is
     allowed to reach the folded copy of the text. */
  const qf = fold(q) === q ? q : null;
  const box = $("content");
  let html = "";

  if (q) {
    /* Global search across all sections, in two halves:

         what it IS       — name, producer, grape, region, style, tags, critics
         what it TASTES   — aroma and food pairing

       and wines before spirits inside each. Identity has to come first because
       the moment aromas became searchable, "orange" matched two quite different
       things: the eleven orange wines and every wine with orange peel in its
       nose. Wines before spirits because the list is a wine list — a guest
       typing "macerat" means the shelf, and the gins that macerate botanicals
       are the footnote.

       **The second half is labelled** (owner asked, 2026-08-02: "do we really
       want to search aromas?"). The results were never wrong, but a guest who
       typed "orange" and got 45 rows had no way to know that the first twelve
       were the answer and the rest merely smell of it. A heading is the whole
       fix: it keeps the two browse modes that only search can offer — by
       flavour, and by "what goes with lamb" — and stops the weaker one looking
       like padding. No headings at all when everything landed in one half,
       which is the common case. */
    let found = 0;
    searchRefs = [];
    const blocks = [[], [], [], []];
    DATA.sections.forEach((sec, si) => {
      sec.categories.forEach((cat, ci) => {
        cat.groups.forEach((g, gi) => {
          g.items.forEach((item, ii) => {
            const hay = itemHay(item);
            if ((hayMatch(hay, q) || (qf && hayMatch(hay, qf))) && (!picksOnly || item.recommended || item.new)) {
              const ref = [si, ci, gi, ii].join(".");
              const ctx = [t.sections[sec.id], t.categories[cat.id], g.country ? t.countries[g.country] : null]
                .filter(Boolean).join(" · ");
              /* A wine is an item with insight and no `kind` — the same single
                 switch openDetail() reads. Water and the soft drinks have no
                 insight at all and belong in the second block with the spirits. */
              const isWine = item.insight && !item.insight.kind ? 0 : 1;
              const core = itemCore(item);
              const isCore = hayMatch(core, q) || (qf && hayMatch(core, qf)) ? 0 : 1;
              blocks[isCore * 2 + isWine].push({ item, ref, ctx });
            }
          });
        });
      });
    });
    const identity = blocks[0].concat(blocks[1]);
    const flavour = blocks[2].concat(blocks[3]);
    /* Both halves are labelled, and both carry their count. Labelling only the
       second left the first with no explanation of what it was (owner,
       2026-08-02) — and a count answers that better than any noun would, while
       dodging Slavic plural agreement entirely: "Rezultati · 12" needs no
       concord, "12 vina/vino/vina" needs three rules and gets one of them
       wrong on 21. */
    const render = (rows, label) => {
      if (!rows.length) return;
      if (found === 0) html += `<div class="cat">`;
      html += `<div class="search-group">${esc(label)} <span class="search-count">${rows.length}</span></div>`;
      for (const r of rows) {
        found++;
        searchRefs.push(r.ref);
        html += itemHtml(r.item, r.ref, r.ctx);
      }
    };
    render(identity, t.ui.searchResults);
    render(flavour, t.ui.byFlavour);
    html += found ? "</div>" : `<p class="no-results">${t.ui.noResults}</p>`;
  } else if (currentSection === "__regions" && !picksOnly && !ratedOnly && !prideOnly) {
    html = REGIONS.map((rg) => {
      const map = localizeMap((typeof REGION_MAPS !== "undefined" && REGION_MAPS[rg.id]) || "");
      /* The appellation chips go through the same localiser as the region line
         on a wine card (owner, 2026-08-02: the Chinese view still read "Barolo,
         Barbaresco, La Morra, Alba, Langhe"). In the Latin-script languages
         almost all of them pass straight through, which is correct — an
         appellation is shown as the label spells it — and only the names with
         an established exonym move. Chinese is where it shows, because there
         every one of them has one. */
      const apps = (rg.appellations || []).map((a) => `<span class="region-app">${esc(localizeRegion(a))}</span>`).join("");
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
  } else if (currentSection === "__new" && !picksOnly && !ratedOnly && !prideOnly) {
    let newHtml = "";
    DATA.sections.forEach((sec, si) => {
      sec.categories.forEach((cat, ci) => {
        cat.groups.forEach((g, gi) => {
          g.items.forEach((item, ii) => {
            if (!item.new) return;
            const ctx = [t.sections[sec.id], g.country ? t.countries[g.country] : null].filter(Boolean).join(" · ");
            newHtml += itemHtml(item, [si, ci, gi, ii].join("."), ctx);
          });
        });
      });
    });
    html = newHtml
      ? `<section class="cat"><h2 class="cat-title"><span class="pride-badge">${ICONS.sparkle}</span>${esc(t.ui.newArrivals)}</h2><div class="ornament" aria-hidden="true">${ICONS.grape}</div>${newHtml}</section>`
      : `<p class="no-results">${t.ui.noResults}</p>`;
  } else if (prideOnly) {
    const pride = [];
    DATA.sections.forEach((sec, si) => {
      sec.categories.forEach((cat, ci) => {
        cat.groups.forEach((g, gi) => {
          g.items.forEach((item, ii) => {
            if (!(typeof item.price === "number" && item.price >= PRIDE_MIN)) return;
            pride.push({ item, ref: [si, ci, gi, ii].join("."), sec, country: g.country });
          });
        });
      });
    });
    pride.sort((a, b) => b.item.price - a.item.price);
    if (pride.length) {
      html += `<section class="cat"><h2 class="cat-title"><span class="pride-badge">${ICONS.crown}</span>${esc(t.ui.pride)}</h2><div class="ornament" aria-hidden="true">${ICONS.grape}</div><p class="pride-sub">${esc(t.ui.prideSub)}</p>`;
      html += pride.map((r) => itemHtml(r.item, r.ref, [t.sections[r.sec.id], r.country ? t.countries[r.country] : null].filter(Boolean).join(" · "))).join("");
      html += `</section>`;
    } else {
      html = `<p class="no-results">${t.ui.noResults}</p>`;
    }
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
      html += `<section class="cat"><h2 class="cat-title"><span class="pride-badge">${ICONS.trophy}</span>${esc(t.ui.bestRated)}</h2><div class="ornament" aria-hidden="true">${ICONS.grape}</div>`;
      html += rated.map((r) => itemHtml(r.item, r.ref, [t.sections[r.sec.id], r.country ? t.countries[r.country] : null].filter(Boolean).join(" · "))).join("");
      html += `</section>`;
    } else {
      html = `<p class="no-results">${t.ui.noResults}</p>`;
    }
  } else if (picksOnly) {
    /* Filho's selection = recommended wines only, under one clear title
       with per-section sub-groups; new arrivals live in "__new". */
    let total = 0, body = "";
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
      if (secHtml) body += `<h3 class="picks-group">${esc(t.sections[sec.id])}</h3>${secHtml}`;
    });
    html = total
      ? `<section class="cat"><h2 class="cat-title"><span class="pride-badge">${ICONS.star}</span>${esc(t.ui.picks)}</h2><div class="ornament" aria-hidden="true">${ICONS.grape}</div>${body}</section>`
      : `<p class="no-results">${t.ui.noResults}</p>`;
  } else {
    const sec = DATA.sections.find((s) => s.id === currentSection);
    const si = DATA.sections.indexOf(sec);
    sec.categories.forEach((cat, ci) => {
      html += `<section class="cat"><h2 class="cat-title">${esc(t.categories[cat.id] || cat.id)}${cat.serving ? ` <span class="cat-serving">${cat.serving}</span>` : ""}</h2><div class="ornament" aria-hidden="true">${ornamentFor(sec.id)}</div>`;
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
  /* Stepping stays inside whatever the guest is actually looking at — this
     section, these search hits, this filter — in the order shown. Someone
     choosing a dessert wine is choosing between dessert wines; swiping out of
     the category and into the reds is noise, and it makes both ends of the
     set mean something ("that is all of them") instead of one end being the
     end of the entire cellar. */
  const shown = Array.from(box.querySelectorAll(".item.clickable"));
  const scope = shown.map((b) => b.dataset.ref);
  shown.forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.ref, null, scope)));
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

/* ---------- spirits ----------
   A spirit card answers different questions from a wine card — what it was
   made from, what still, what wood, how long — so its vocabulary lives in
   js/spirits.js rather than doubling js/i18n.js. Everything the two have in
   common (aromas, pairings, countries, the note) still comes from i18n.js;
   these two helpers just look in the spirit dictionary first.

   Both tolerate js/spirits.js being absent. It is loaded before app.js in
   index.html, but a spirit-free venue list should not need the file at all. */
function sT() {
  if (typeof SPIRIT_I18N === "undefined") return null;
  return SPIRIT_I18N[lang] || SPIRIT_I18N.en || null;
}
function spiritTerm(dict, key, fallback) {
  const s = sT();
  if (s && s[dict] && s[dict][key]) return s[dict][key];
  if (fallback && fallback[key]) return fallback[key];
  return key;
}

/* ---------- detail modal ---------- */
function openDetail(ref, back, scope) {
  detailScope = scope || null;
  if (!stepTimers.length) pendingRef = null;
  const [si, ci, gi, ii] = ref.split(".").map(Number);
  const item = DATA.sections[si].categories[ci].groups[gi].items[ii];
  const ins = item.insight;
  if (!ins) return;
  const t = T();
  const field = (label, value, wide) =>
    value ? `<div class="detail-field${wide ? " wide" : ""}"><div class="detail-label">${label}</div><div class="detail-value">${value}</div></div>` : "";
  const list = (keys, dict) => (keys || []).map((k) => dict[k] || k).join(", ");
  // Formal region name (localized) + country, always.
  const region = [esc(localizeRegion(ins.region)), t.countries[ins.country] || ins.country].filter(Boolean).join(", ");

  /* A bottle is either a wine or a spirit, and the two share the frame but not
     the fields. `kind` is the only switch: no `kind` means wine, which is what
     every one of the 365 wines already says by saying nothing. */
  const spirit = ins.kind === "spirit";
  const su = (sT() || {}).ui || {};
  const slist = (keys, dict) => (keys || []).map((k) => spiritTerm(dict, k)).join(", ");
  const glass = spirit
    ? (typeof vesselFor === "function" ? vesselFor(ins.class, ins.vessel) : null)
    : glassFor(ins.style, ins.grape, ins.glass, ins.region);
  const glassSvg = spirit
    ? (glass && typeof SPIRIT_VESSELS !== "undefined" ? SPIRIT_VESSELS[glass] : "")
    : (glass ? GLASS_ICONS[glass] : "");
  const noteText = item.note && (item.note[lang] || item.note.en || item.note.hr);
  $("modal-body").innerHTML = `
    ${back ? `<button class="detail-back" type="button">${esc(t.helper.backToWines)}</button>` : ""}
    <div class="detail-header">
      <div class="detail-head-text">
        <div class="detail-name">${esc(itemName(item))}${wineZh(itemName(item)) ? ` <span class="zh-gloss">（${wineZh(itemName(item))}）</span>` : ""}</div>
        ${item.producer ? `<div class="detail-producer">${esc(item.producer)}${producerZh(item.producer) ? ` <span class="zh-gloss">（${producerZh(item.producer)}）</span>` : ""}</div>` : ""}
      </div>
      ${glassSvg ? `<div class="detail-glass">${glassSvg}</div>` : ""}
    </div>
    ${item.recommended ? `<div class="detail-rec">★ ${esc(t.ui.recommended)}</div>` : ""}
    ${item.new ? `<div class="detail-rec detail-new">${esc(t.ui.newBadge)}</div>` : ""}
    ${(item.tags && item.tags.length) ? `<div class="detail-tags">${item.tags.map((tg) => `<span class="wine-tag tag-${tg}">${TAG_ICON[tg] ? `<span class="marker">${ICONS[TAG_ICON[tg]]}</span>` : ""}${esc(t.tags[tg] || tg)}</span>`).join("")}</div>` : ""}
    ${item.ratings && item.ratings.length ? `<div class="detail-ratings"><span class="detail-label">${esc(t.ui.ratings)}</span>${item.ratings.map((r) => `<span class="rating-chip"><b>${esc(r.score)}</b> ${esc(criticName(r.critic))}</span>`).join("")}</div>` : ""}
    ${item.price != null ? `<div class="detail-price">${fmtPrice(item.price)} €</div>` : ""}
    <div class="detail-style">${spirit
      ? esc(spiritTerm("classes", ins.class))
      : esc(t.styles[ins.style] || "") + (ins.dosage ? " · " + esc(localizeDosage(ins.dosage)) : "") + (ins.sweetness && t.sweetness ? " · " + esc(t.sweetness[ins.sweetness] || ins.sweetness) : "")}</div>
    ${noteText ? (item.notePlain
      ? `<div class="detail-note">${esc(noteText)}</div>`
      : `<div class="detail-note">„${esc(noteText)}“ <span class="detail-note-sig">— ${esc(item.noteSig || "Filho")}</span></div>`) : ""}
    <div class="detail-grid">
      ${spirit ? `
      ${field(su.base, esc(slist(ins.base, "bases")))}
      ${field(t.ui.region, region)}
      ${field(su.still, esc(slist(ins.still, "stills")))}
      ${field(su.cask, esc(slist(ins.cask, "casks")))}
      ${field(su.age, ins.age ? esc(ins.age) + " " + esc(su.years || "") : (ins.age === 0 ? esc(su.noAge || "") : ""))}
      ${field(t.ui.alcohol, ins.alcohol ? esc(ins.alcohol) + " % vol." : "")}
      ${/* Independent bottlings are half this shelf — the distillery made it,
            somebody else chose the cask and put their name on it. A company
            name is not translated, so this one is a plain string. */
        field(su.bottler, ins.bottler ? esc(ins.bottler) : "")}
      ${field(t.ui.aromas, esc((ins.aromas || []).map((k) => spiritTerm("aromas", k, t.aromas)).join(", ")), true)}
      ${field(su.serve, esc(slist(ins.serve, "serves")), true)}
      ${field(t.ui.pairings, esc((ins.pairings || []).map((k) => spiritTerm("pairings", k, t.pairings)).join(", ")), true)}
      ` : `
      ${field(t.ui.grape, esc(localizeGrape(ins.grape)))}
      ${field(t.ui.region, region)}
      ${field(t.ui.body, esc(t.bodies[ins.body] || ins.body))}
      ${field(t.ui.alcohol, ins.alcohol ? esc(ins.alcohol) + " % vol." : "")}
      ${/* Residual sugar, only where a producer publishes it for that exact
            vintage — the same rule as alcohol. It answers the question the
            sweetness word cannot: "slatko" covers everything from 46 g/l to
            194, and a guest deciding between a Kabinett and an Yquem is asking
            about that gap. Blank on most wines because most producers do not
            publish it; see the note in CLAUDE.md before spending a day on it. */
        field(t.ui.rs, ins.rs != null ? esc(String(ins.rs)) + " g/l" : "")}
      ${field(t.ui.temp, ins.temp ? esc(ins.temp) + " °C" : "")}
      ${field(t.ui.aromas, esc(list(ins.aromas, t.aromas)), true)}
      ${field(t.ui.pairings, esc(list(ins.pairings, t.pairings)), true)}
      `}
      ${field(t.ui.musicPairing, item.music ? esc(item.music) : "", true)}
    </div>
    ${(() => {
      const info = producerInfo(item.producer);
      const blurb = info && info.blurb && (info.blurb[lang] || info.blurb.en);
      if (!blurb) return "";
      // The producer's home region is only a fallback. An explicit terroir on the
      // item wins — including an empty one, which deliberately suppresses the line
      // for wines that don't come from where the domaine is based.
      const terroir = item.terroir !== undefined ? item.terroir : info.region;
      const ter = terroir ? `<div class="detail-terroir"><span class="detail-label">${esc(t.ui.terroir)}</span> ${esc(localizeRegion(terroir))}</div>` : "";
      /* "O vinaru" on a rum reads as a mistake, so the same block is labelled
         "the distillery" when the bottle is a spirit. Terroir is suppressed
         there outright: a distillery's address is not a vineyard, and printing
         one under that heading is the exact error CLAUDE.md warns about. */
      const label = spirit ? (su.distillery || t.ui.winemaker) : t.ui.winemaker;
      return `<div class="detail-winemaker"><div class="detail-label">${esc(label)}${item.producer ? " · " + esc(item.producer) : ""}</div><p>${esc(blurb)}</p>${spirit ? "" : ter}</div>`;
    })()}
    ${(() => {
      if (spirit) return "";
      const dishes = dishesForWine(ins);
      if (!dishes.length) return "";
      return `<div class="detail-dishes"><span class="detail-label">${esc(t.ui.pairsWith)}</span>${dishes.map((dn) => `<span class="dish-chip">${esc(dn.name[lang] || dn.name.en || dn.name.hr)}</span>`).join("")}</div>`;
    })()}`;
  // The glass icon is absolutely positioned inside .detail-header so a short
  // name+producer never leaves dead space below it — but that also means the
  // header's auto height can be shorter than the icon needs. Only when that
  // happens, bump the header's min-height just enough to clear the icon,
  // so tall wine names get zero extra space and short ones get exactly what's needed.
  if (glass) {
    const headerEl = $("modal-body").querySelector(".detail-header");
    const glassEl = headerEl && headerEl.querySelector(".detail-glass");
    if (headerEl && glassEl) {
      const needed = glassEl.offsetTop + glassEl.offsetHeight;
      if (headerEl.offsetHeight < needed) headerEl.style.minHeight = needed + "px";
    }
  }
  showModal("detail");
  if (back) { const bb = $("modal-body").querySelector(".detail-back"); if (bb) bb.addEventListener("click", back); }
  setDetailNav(ref, back);
}

/* ---------- step between wines ---------- */
/* Straight through the whole list in menu order, across groups, categories and
   sections — the last Barolo leads into the first Brunello, not into a wall.
   The arrows hide only at the very first and very last wine, and hide rather
   than grey out: on a tablet a disabled control still invites a tap. */
let detailNav = { prev: null, next: null, back: null };
/* When the sheet was opened from a shortlist — the sommelier's three picks —
   stepping stays inside that shortlist. Swiping off the end of three suggested
   wines into the whole cellar is not what the guest asked for. */
let detailScope = null;
let searchRefs = [];
let FLAT_REFS = null, FLAT_POS = null;
function flatRefs() {
  if (FLAT_REFS) return FLAT_REFS;
  FLAT_REFS = []; FLAT_POS = Object.create(null);
  DATA.sections.forEach((sec, si) => sec.categories.forEach((cat, ci) =>
    cat.groups.forEach((g, gi) => g.items.forEach((it, ii) => {
      if (!it.insight) return;
      const ref = [si, ci, gi, ii].join(".");
      FLAT_POS[ref] = FLAT_REFS.length;
      FLAT_REFS.push(ref);
    }))));
  return FLAT_REFS;
}
function neighbourRef(ref, step) {
  const all = detailScope || flatRefs();
  const p = detailScope ? detailScope.indexOf(ref) : FLAT_POS[ref];
  if (p == null || p < 0) return null;
  const j = p + step;
  return j >= 0 && j < all.length ? all[j] : null;
}
function setDetailNav(ref, back) {
  const t = T();
  detailNav = { prev: neighbourRef(ref, -1), next: neighbourRef(ref, 1), back: back || null };
  [["modal-prev", detailNav.prev, t.ui.prevWine], ["modal-next", detailNav.next, t.ui.nextWine]]
    .forEach(([id, target, label]) => {
      const b = $(id);
      if (!b) return;
      b.classList.toggle("hidden", !target);
      b.setAttribute("aria-label", label);
      b.title = label;
    });
}
function clearDetailNav() {
  detailNav = { prev: null, next: null, back: null };
  ["modal-prev", "modal-next"].forEach((id) => { const b = $(id); if (b) b.classList.add("hidden"); });
}
/* Swap the card with a short slide+fade so the change reads as movement rather
   than a flicker. Only the body moves; the sheet itself stays put, which keeps
   the ✕ and the arrows stable under the finger. */
/* The card leaves in the direction of travel, the next one arrives from the
   far side. Carrying the finger's momentum through instead of snapping the
   card back to centre first is what makes it read as one movement.
   The sheet frame holds its height across the swap so the border does not
   jump between a short wine and a tall one. */
let stepTimers = [];
let pendingRef = null;      // where an in-flight step is heading
function stepDetail(dir) {
  // Tap the arrow three times quickly and you should advance three wines, not
  // restart the same one: each step aims from wherever the last one is going.
  const from = pendingRef;
  const target = from ? neighbourRef(from, dir) : (dir < 0 ? detailNav.prev : detailNav.next);
  if (!target) return false;
  pendingRef = target;
  const body = $("modal-body"), sheet = $("modal-sheet");
  if (!body || !sheet) return false;
  stepTimers.forEach(clearTimeout); stepTimers = [];

  const span = Math.max(180, Math.round((sheet.clientWidth || 320) * 0.32));
  const out = dir > 0 ? -span : span;          // forward → the card exits left
  body.style.willChange = "transform, opacity";
  const outMs = 110;
  body.style.transition =
    `transform ${outMs}ms cubic-bezier(.4,0,1,1), opacity ${outMs}ms linear`;
  body.style.transform = `translateX(${out}px)`;
  body.style.opacity = "0";

  stepTimers.push(setTimeout(() => {
    /* Swap while the card is invisible. Nothing measures or animates the frame
       any more: it is a fixed size and the content scrolls inside it. The old
       code set height:auto here to measure the incoming card, which let the
       sheet balloon to the full page for a frame before snapping back — the
       grow-then-crop that showed on every open and every swipe. */
    openDetail(target, detailNav.back, detailScope);
    sheet.scrollTop = 0;
    body.style.transition = "none";
    body.style.transform = `translateX(${-out}px)`;
    body.style.opacity = "0";
    void body.offsetWidth;
    requestAnimationFrame(() => {
      body.style.transition = "transform .3s cubic-bezier(.17,.84,.44,1), opacity .22s ease-out";
      body.style.transform = "";
      body.style.opacity = "1";
      stepTimers.push(setTimeout(() => {
        body.style.willChange = "";
        body.style.transition = "";
        pendingRef = null;
      }, 360));
    });
  }, outMs));
  return true;
}

/* Modal open/close with a history entry so the phone/tablet back button
   (and Esc) just closes the modal instead of leaving the page. */
let modalOpen = false;
function showModal(kind) {
  const ms = $("modal-sheet");
  clearDetailNav();
  /* Set before the sheet is ever shown. Adding it afterwards let the card
     paint once at its natural height — often the full page — and then snap to
     the fixed frame, which is the growing-then-cropping you could see. */
  $("modal").classList.toggle("detail-mode", kind === "detail");
  if (ms) { ms.style.transform = ""; ms.style.transition = ""; }
  $("modal").classList.remove("hidden");
  // Reset the scroll only *after* the sheet is visible again: while the modal
  // is display:none the assignment is ignored and the browser restores the
  // previous offset, so the next wine would open mid-way down.
  if (ms) ms.scrollTop = 0;
  /* Lock the page behind the sheet without losing your place. Plain
     `overflow: hidden` lets mobile browsers forget the scroll offset, so
     closing the sheet dumped you back at the top of the list — which read as
     the whole app reloading. Pin the body instead and put the offset back. */
  if (!modalOpen) {
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollLockY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";
    modalOpen = true;
    history.pushState({ theaModal: true }, "");
  }
}
let scrollLockY = 0;
function hideModal() {
  modalOpen = false;
  $("modal").classList.add("hidden");
  /* Undo any drag *after* the modal is out of sight. closeModal() goes through
     history.back(), which fires popstate asynchronously — resetting the
     transform before that landed snapped the sheet back to centre for a frame
     or two, in full view, which is the flicker at the end of a swipe-away. */
  const ms = $("modal-sheet"), bd = $("modal-backdrop");
  if (ms) { ms.style.transition = ""; ms.style.transform = ""; }
  if (bd) { bd.style.transition = ""; bd.style.opacity = ""; }
  const mb = $("modal-body");
  if (mb) { mb.style.transition = ""; mb.style.transform = ""; mb.style.opacity = ""; }
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.overflow = "";
  window.scrollTo(0, scrollLockY);
  /* An 86 that arrived while this sheet was open has been waiting for it. */
  flushHidden();
}
function closeModal() {
  if (modalOpen && history.state && history.state.theaModal) history.back(); // → popstate → hideModal
  else hideModal();
}
/* ---------- back button: one press to be asked, two to leave ---------- */
/* A tablet on a restaurant table gets the back gesture by accident — a thumb on
   the edge of the screen, a swipe that started too close to the bezel. Leaving
   the list dumps the guest back to a blank tab, and they have to find the QR
   code again. So the app keeps one spare history entry of its own: the first
   back consumes it and says "press again", the second is let through.

   Touch devices only. On a laptop the back button is deliberate, and a browser
   refusing to go back the first time is worse than the problem. */
const backGuard = { armed: false, timer: 0, on: false };
function guardBack() {
  if (backGuard.on) return;
  if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) return;
  backGuard.on = true;
  history.pushState({ theaGuard: true }, "");
}
function showExitHint() {
  let el = $("exit-hint");
  if (!el) {
    el = document.createElement("div");
    el.id = "exit-hint";
    el.className = "exit-hint";
    document.body.appendChild(el);
  }
  el.textContent = T().ui.exitHint;
  el.classList.add("show");
  clearTimeout(showExitHint._t);
  showExitHint._t = setTimeout(() => el.classList.remove("show"), 2000);
}
window.addEventListener("popstate", () => {
  if (modalOpen) { hideModal(); return; }
  if (!backGuard.on) return;                 // desktop, or the app never opened
  if (backGuard.armed) return;               // second press inside the window: let it go
  /* First press. Put our entry back so the browser stays where it is, and ask. */
  backGuard.armed = true;
  history.pushState({ theaGuard: true }, "");
  showExitHint();
  clearTimeout(backGuard.timer);
  backGuard.timer = setTimeout(() => { backGuard.armed = false; }, 2200);
});

/* ---------- "Help me choose" sommelier wizard ---------- */
/* Glass silhouettes traced from the house stemware (product photos):
   Sophienwald Grand Cru Champagne wine glass (elongated vertical tulip on a
   filigree stem, with a faint crystal sheen), Veloce Riesling, Veloce Chardonnay (white
   Burgundy, only for the oaked/heavy whites), the two Winewings bowls on the
   flat "wing" base — Burgundy for Pinot/Nebbiolo, Bordeaux for Cabernet/Merlot
   — the wide straight-sided cone on a long stem for all other reds, and the
   narrow high-bellied sweet glass. */
const GLASS_ICONS = {
  /* Measured off the owner's photo rather than judged by eye: a row-by-row scan
     of the silhouette (scripts/trace-outline.py) gives rim 160px, widest 249px,
     so the rim is .64 of the widest — every drawn-from-the-eye attempt made it
     .75 and got a white-wine tulip. The other thing the scan settled is that
     the bowl does not end in a V: it tapers continuously and merges into the
     stem two-thirds of the way down, which is where the elegance lives. Rim
     drawn as the shallow ellipse it is when seen from above; the faint inner
     line is the crystal sheen, kept from the first drawing. */
  champagne: '<svg viewBox="0 0 40 100" aria-hidden="true"><path d="M9.8,4.7 C8.2,11.5 4.9,20.5 4.1,29.4 C4.0,40.3 19.4,50 20,66 C20.6,50 36,40.3 35.9,29.4 C35.1,20.5 31.8,11.5 30.2,4.7"/><path d="M9.8,4.7 C9.8,3 30.2,3 30.2,4.7 C30.2,6.4 9.8,6.4 9.8,4.7 Z"/><path d="M20,66 V92"/><path d="M4.3,95.2 c6,-3.4 25.4,-3.4 31.4,0"/><path d="M11.2,9.5 C9,17 7.6,24 7.3,30.5" style="stroke-width:.8;opacity:.45"/></svg>',
  /* Riedel Veloce Riesling, from the maker's dimensioned drawing: 247mm tall,
     92mm at the widest, 92mm across the foot. Both Veloce glasses are 247mm, so
     drawing every icon to one 60px height makes their viewBox widths carry the
     real difference — 42 here against the Chardonnay's 50. The bowl holds its
     widest across a long plateau (units 32-37) and only then folds in. */
  riesling: '<svg viewBox="0 0 42 100" aria-hidden="true"><path d="M9.8,5.8 C8,12.5 4.4,24 4.2,31.8 C4.15,34 4.2,36 4.3,38.4 C6,43.2 10.8,46.6 12.3,48.2 C15.5,51.2 19.6,56 21,61 C22.4,56 26.5,51.2 29.7,48.2 C31.2,46.6 36,43.2 37.7,38.4 C37.8,36 37.85,34 37.8,31.8 C37.6,24 34,12.5 32.2,5.8"/><path d="M9.8,5.8 C9.8,3.9 32.2,3.9 32.2,5.8 C32.2,7.7 9.8,7.7 9.8,5.8 Z"/><path d="M21,61 V91.5"/><path d="M4.5,95.2 c6,-3.5 27,-3.5 33,0"/></svg>',
  /* Riedel Veloce Chardonnay, the oaked-white glass: 247mm tall but 113mm at the
     widest and 100mm across the foot, so it is a third wider than the Riesling
     at the same height. Its belly sits high (a quarter of the way down) and the
     wall then runs dead straight into the point at the stem — that straight run
     plus the wide rim (77% of the widest, against the champagne flute's 64%) is
     what keeps it from reading as the flute at icon size. */
  chardonnay: '<svg viewBox="0 0 50 100" aria-hidden="true"><path d="M9.65,5.8 C8.3,10.5 5.2,17 5.03,22.9 C5.1,27 8.4,33 12.5,35.5 L21.85,44.9 C23.1,47.4 24.6,50.2 25,53 C25.4,50.2 26.9,47.4 28.15,44.9 L37.5,35.5 C41.6,33 44.9,27 44.97,22.9 C44.8,17 41.7,10.5 40.35,5.8"/><path d="M9.65,5.8 C9.65,3.9 40.35,3.9 40.35,5.8 C40.35,7.7 9.65,7.7 9.65,5.8 Z"/><path d="M25,53 V90"/><path d="M7.8,94.5 c6,-3.6 28.4,-3.6 34.4,0"/></svg>',
  /* The two Winewings, from Riedel's dimensioned drawings — both 250mm tall on a
     100mm foot, 117mm and 115mm across, so the millimetres alone would make them
     the same icon. What separates them is the wall, and the row scan is what
     found it: the Cabernet's wall is an S — 0.21 units of run per unit of drop
     at the shoulder, 0.10 through the middle, 0.25 again as it kicks out into
     the plate. Averaging that into a straight line (tried, and it cut visibly
     inside the real glass through the upper third) throws away both the flare
     and the kick, which are the two things that say Winewings across a table,
     so the S is drawn here a little past the measurement on purpose — it has to
     survive a 60px icon. The Pinot's wall instead races out at the shoulder and
     then holds dead level for thirty rows before flaring again. Its bowl ends
     higher (51% of the glass against 55%), so it sits rounder and squatter over
     a longer stem. Checked side by side at 60px: they read apart. */
  winewingsBordeaux: '<svg viewBox="0 0 51 100" aria-hidden="true"><path d="M10.9,6.32 C8.3,15.5 6.55,23 5.9,34.5 C5.75,38.5 4.3,41.6 4.09,46.2 C4.15,49.8 6.2,52.5 8.84,53.6 C13.8,55.1 21.5,56.4 25.5,56.6 C29.5,56.4 37.2,55.1 42.16,53.6 C44.8,52.5 46.85,49.8 46.91,46.2 C46.7,41.6 45.25,38.5 45.1,34.5 C44.45,23 42.7,15.5 40.1,6.32"/><path d="M10.9,6.32 C10.9,4 40.1,4 40.1,6.32 C40.1,8.64 10.9,8.64 10.9,6.32 Z"/><path d="M25.5,56.6 V90"/><path d="M7.3,95.2 c6,-3.5 30.4,-3.5 36.4,0"/></svg>',
  winewingsBurgundy: '<svg viewBox="0 0 50 100" aria-hidden="true"><path d="M10.53,6.43 C9,11.5 5.6,21.5 5.06,27.5 C5.03,30 5,32 4.95,34.5 C4.7,37.5 4.15,39.8 3.95,42.06 C4,46 7,49.4 10.12,50.6 C13.5,51.5 19.5,52.35 25,52.6 C30.5,52.35 36.5,51.5 39.88,50.6 C43,49.4 46,46 46.05,42.06 C45.85,39.8 45.3,37.5 45.05,34.5 C45,32 44.97,30 44.94,27.5 C44.4,21.5 41,11.5 39.47,6.43"/><path d="M10.53,6.43 C10.53,4.9 39.47,4.9 39.47,6.43 C39.47,7.96 10.53,7.96 10.53,6.43 Z"/><path d="M25,52.6 V90"/><path d="M6.8,95.2 c6,-3.5 30.4,-3.5 36.4,0"/></svg>',
  /* Traced off the owner's photo of the actual glass rather than guessed at:
     the bowl is as wide as it is tall, the rim is 64% of that width, the sides
     run straight between the two, and the base is a shallow cone that tucks
     sharply into the stem — the row scan puts the widest point 71% of the way
     down the bowl, and the width then falls off a cliff. Drawn as a rounded cup
     (which is what shipped first) it bulges well outside the real glass.
     Wider viewBox than its siblings because the glass genuinely is wider —
     they are all drawn to the same 60px height, so the box carries the
     proportion. */
  burgundy: '<svg viewBox="0 0 46 100" aria-hidden="true"><path d="M10.35,5.5 L3.2,36.15 C3.3,41 6.6,44.5 11.43,45.1 C15.8,45.9 21.6,47.9 23,49.6 C24.4,47.9 30.2,45.9 34.57,45.1 C39.4,44.5 42.7,41 42.8,36.15 L35.65,5.5 Z"/><path d="M23,49.6 V88.5"/><path d="M11.5,93.5 c4.4,-3.2 18.6,-3.2 23,0"/></svg>',
  /* The sweet-wine glass, traced from the owner's photo. Narrowest of the set —
     the bowl is a quarter of the glass's width against the flute's third — with
     the belly high, the bowl only 45% of the total height and a very long stem
     under it. That is what separates it from the flute at icon size; the old
     dessert glass relied on being drawn short, which stopped working once every
     icon was normalised to one 60px height. The foot is wider than the bowl. */
  dessert: '<svg viewBox="0 0 32 100" aria-hidden="true"><path d="M7.8,6 C6.6,10.6 5,17 4.88,21 C4.95,26 9.6,33.3 11.55,36.71 C13.3,39.7 15.4,44.6 16,47.5 C16.6,44.6 18.7,39.7 20.45,36.71 C22.4,33.3 27.05,26 27.12,21 C27,17 25.4,10.6 24.2,6"/><path d="M7.8,6 C7.8,3.9 24.2,3.9 24.2,6 C24.2,8.1 7.8,8.1 7.8,6 Z"/><path d="M16,47.5 V89.5"/><path d="M2.35,93.6 c5,-3.4 22.3,-3.4 27.3,0"/></svg>'
};
/* Bilingual Chinese rendering for the free-text grape/region fields.
 * Only transforms when lang === "zh": each comma-separated token is looked up
 * in ZH_GRAPE / ZH_REGION and shown as 中文 (Latin); unknown tokens (indigenous
 * grapes, small villages) stay Latin. ZH_ONLY tokens render Chinese-only. */
function zhTokens(str, map) {
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((tok) => {
      // split off a trailing blend percentage (e.g. "Chardonnay 80%")
      const m = tok.match(/^(.*?)\s*(\d+(?:[.,]\d+)?\s*%)$/);
      const name = m ? m[1].trim() : tok;
      const pct = m ? " " + m[2].replace(/\s+/g, "") : "";
      let zh = map[name];
      /* "Čara (Korčula)" is one token, so a map that knows both Čara and
         Korčula still matched neither. Translate the parts it does know. */
      if (!zh) {
        const m = name.match(/^(.+?)\s*\((.+)\)$/);
        if (m) {
          const base = map[m[1].trim()], qual = map[m[2].trim()];
          if (base) return `${base}（${m[1].trim()}${qual ? " · " + qual : ""}）${pct}`;
        }
      }
      if (!zh) return tok;
      if (typeof ZH_ONLY !== "undefined" && ZH_ONLY[name]) return zh + pct;
      /* A name that carries its own synonym — "Zibibbo (Muscat of Alexandria)"
         — must not land inside the Chinese brackets as-is, or it renders with
         nested brackets: 亚历山大麝香（Zibibbo (Muscat of Alexandria)）. The
         synonym becomes a slash instead, which is what the two entries that
         looked right were doing by hand, with the Latin baked into their
         Chinese string and a ZH_ONLY flag to stop it being appended twice.
         Doing it here means one mechanism, and the next such grape just works. */
      return `${zh}（${name.replace(/\s*\((.+)\)\s*$/, " / $1")}）${pct}`;
    })
    .join("、");
}
/* Per-language grape name overrides.
 *
 * The policy, settled 2026-07-31 (see CLAUDE.md "One grape, one stored name"):
 * a variety is stored **once**, under one canonical name, and each language
 * view renders it under the name that language's drinkers actually use. The
 * guest's language wins over the bottle's origin — a Croatian guest reads
 * "Rebula" whether the wine is from Brda or Oslavia — because the field is
 * there to tell them what they are drinking, not to transcribe the label. The
 * label is already on the table, and the wine's own *name* is never touched.
 *
 * Malvazija istarska is the case that forced the rule. It was stored three
 * ways — "Malvasia", "Malvazija", "Malvazija istarska" — for one grape, and
 * the bare forms are worse than untidy: Caroline Gilby MW counts ~290
 * varieties sharing the name Malvasia, most of them unrelated to each other,
 * so "Malvasia" on its own identifies nothing. Croatia alone grows three
 * different ones. Never store a bare Malvasia/Malvazija again. */
const LANG_GRAPE = {
  it: { "Pinot Noir": "Pinot Nero", "Malvazija istarska": "Malvasia Istriana" },
  hr: { "Pinot Bianco": "Pinot Blanc", "Ribolla Gialla": "Rebula" },
  /* Malvasia Istriana is the name the international literature uses — it is
     the variety name in Gilby's table, with Malvazija Istarska as the synonym.
     French and German trade both take the Italian form; "Malvoisie" would be
     actively wrong, being one of the ambiguous variants the article warns
     about. Spanish accents its own spelling of the word. */
  en: { "Malvazija istarska": "Malvasia Istriana" },
  fr: { "Malvazija istarska": "Malvasia Istriana" },
  de: { "Malvazija istarska": "Malvasia Istriana" },
  es: { "Malvazija istarska": "Malvasía istriana" },
  /* Slovenia's own name for the grape everyone else calls Friulano. It was
     Sauvignonasse / Zeleni sauvignon after the 2007 ban and officially became
     Jakot in 2013 — so a Slovenian guest reading Prinčič's "Jakot 2019" or
     Simčič's "Sauvignon Vert" sees the variety under the name they use, which
     is the settled rule. The wine's own name is never touched. */
  sl: { "Friulano": "Jakot" }
};
function langTokens(str, map) {
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((tok) => {
      const m = tok.match(/^(.*?)\s*(\d+(?:[.,]\d+)?\s*%)$/);
      const name = m ? m[1].trim() : tok;
      const pct = m ? " " + m[2].replace(/\s+/g, "") : "";
      return map[name] ? map[name] + pct : tok;
    })
    .join(", ");
}
function localizeGrape(str) {
  if (!str) return str;
  // Whole-string descriptor phrases (e.g. "Autohtone dalmatinske sorte").
  if (typeof GRAPE_I18N !== "undefined" && GRAPE_I18N[str]) return GRAPE_I18N[str][lang] || GRAPE_I18N[str].en || str;
  if (lang === "zh" && typeof ZH_GRAPE !== "undefined") return zhTokens(str, ZH_GRAPE);
  if (LANG_GRAPE[lang]) return langTokens(str, LANG_GRAPE[lang]);
  return str;
}
/* The place names drawn *inside* a region map, translated the same way as the
   chips beside it and the region line on a wine card. The maps are hand-drawn
   SVG with the labels written into them, so the text is rewritten on the way
   out rather than assembled from data — the alternative was a coordinate table
   per language, which is a lot of machinery for six pictures.

   Only the three label classes are touched, never a path or a viewBox. A label
   may carry two names joined by " · " ("Dingač · Postup"), which are split and
   localized apart. Rivers and seas come from MAP_FEATURES: they are places on
   a map but not places wine comes from, so they have no business in
   ZH_REGION.

   Chinese gets the Chinese name **alone**, not the 兰斯山（Montagne de Reims）
   form the cards and the chips use. That form is right where it has room — it
   lets a guest tie the name back to the label — but a map label is placed at a
   hand-picked x/y, and tripling its width made "阿维兹（Avize）" run through
   "Côte des Blancs" and pushed Le Mesnil clean off the picture. The chips
   beside the map carry both forms, so nothing is lost by the map being a map. */
function localizeMap(svg) {
  if (!svg) return svg;
  const zh = lang === "zh" && typeof ZH_REGION !== "undefined";
  return svg.replace(/(class="t-(?:town|dot|zone)"[^>]*>)([^<]+)(<)/g, (m, open, text, close) => {
    const out = text.split("·").map((part) => {
      const tok = part.trim();
      if (!tok) return tok;
      const feat = typeof MAP_FEATURES !== "undefined" && MAP_FEATURES[tok];
      if (feat && feat[lang]) return feat[lang];
      if (zh) return ZH_REGION[tok] || tok;
      return localizeRegion(tok);
    }).join(" · ");
    return open + esc(out) + close;
  });
}

function localizeRegion(str) {
  if (!str) return str;
  if (lang === "zh" && typeof ZH_REGION !== "undefined") return zhTokens(str, ZH_REGION);
  // Translate any region token with an established exonym (e.g. Dalmacija→Dalmatia).
  if (typeof REGION_I18N !== "undefined") {
    return str
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((tok) => (REGION_I18N[tok] && REGION_I18N[tok][lang]) || tok)
      .join(", ");
  }
  return str;
}
function localizeDosage(str) {
  if (lang !== "zh" || !str || typeof ZH_DOSAGE === "undefined") return str;
  return ZH_DOSAGE[str] ? `${ZH_DOSAGE[str]}（${str}）` : str;
}
/* Icon producer/cuvée names: keep Latin PRIMARY (it's what's on the label) and
   append the established Chinese as a gloss — Latin（中文）. Only in the zh view,
   only for curated names in ZH_PRODUCER / ZH_WINE. Returns the gloss text (中文)
   or "" so callers can format/escape as they like. */
function producerZh(str) {
  if (lang !== "zh" || !str || typeof ZH_PRODUCER === "undefined") return "";
  return ZH_PRODUCER[str] || "";
}
function wineZh(name) {
  if (lang !== "zh" || !name || typeof ZH_WINE === "undefined") return "";
  for (const k in ZH_WINE) if (name.indexOf(k) !== -1) return ZH_WINE[k];
  return "";
}
/* ---------- critic names ----------
   The house rule is "Robert Parker", never "Wine Advocate" — the publication
   is real, but a guest scanning a wine list reads the name. Rather than make
   that a rule the owner has to remember while pasting scores off a merchant's
   page, the alias is normalised on the way to the screen. Whatever is typed,
   the list says the same thing.

   Add the form you keep meeting on the left; the canonical spelling from
   CLAUDE.md goes on the right. */
const CRITIC_ALIAS = {
  "wine advocate": "Robert Parker",
  "the wine advocate": "Robert Parker",
  "robert parker wine advocate": "Robert Parker",
  "parker": "Robert Parker",
  "rp": "Robert Parker",
  "ws": "Wine Spectator",
  "js": "James Suckling",
  "we": "Wine Enthusiast",
  "jr": "Jancis Robinson",
  "jancis": "Jancis Robinson",
  "vinous - antonio galloni": "Vinous",
  "antonio galloni": "Vinous"
};
function criticName(name) {
  return CRITIC_ALIAS[String(name == null ? "" : name).trim().toLowerCase()] || name;
}

function glassFor(style, grape, override, region) {
  /* `insight.glass` in wines.json wins over everything below: which glass a
     bottle gets is a sommelier's call, and a grape-name rule cannot make it.
     Grimalda and Ottocento Crni are the cases in point — Merlot on paper, but
     Istrian blends poured in the wide glass, not the Bordeaux barrel. */
  if (override && GLASS_ICONS[override]) return override;
  if (!style) return null;
  if (style.startsWith("sparkling") || style.startsWith("champagne")) return "champagne";
  if (style === "sweet") return "dessert";
  /* Pinot Noir, Nebbiolo, Merlot and Cabernet take a Winewings; every other red
     the wide cone. Which Winewings follows Riedel's own varietal lists: Pinot
     Noir and Nebbiolo to the Burgundy bowl, Cabernet and Merlot to the Bordeaux
     cone. The dominant grape decides, since our blends are written name-first in
     descending share — so Grimalda's "Teran 50%, Merlot 50%" is not a Bordeaux
     by accident of listing order. Blends led by a third grape fall through to
     the Bordeaux glass on their Cabernet or Merlot component, which is where
     Riedel puts Sangiovese too (Brunello is on its Bordeaux list, not the
     Burgundy one) — that is Tignanello, and Quintarelli's two Veneto wines. */
  if (style.startsWith("red")) {
    const g = grape || "", r = region || "";
    const first = g.split(",")[0];
    if (/pinot noir|nebbiolo/i.test(first)) return "winewingsBurgundy";
    /* Riedel's Bordeaux list, read literally: the Cabernet family and Merlot,
       Zinfandel under every name it answers to — Kratošija in the Balkans,
       Tribidrag on our Dalmatian labels, Primitivo in Puglia — and Brunello,
       which is Sangiovese from Montalcino. Plavac mali is a different grape,
       Tribidrag's offspring rather than Tribidrag, and stays on the cone. */
    if (/merlot|cabernet|tribidrag|zinfandel|primitivo|kratošija/i.test(first)) return "winewingsBordeaux";
    if (/sangiovese/i.test(first) && /montalcino/i.test(r)) return "winewingsBordeaux";
    /* Blends led by a third grape still reach a Winewings on their Cabernet or
       Merlot component: Tignanello, and Quintarelli's two Veneto wines. */
    if (/merlot|cabernet/i.test(g)) return "winewingsBordeaux";
    if (/pinot noir|nebbiolo/i.test(g)) return "winewingsBurgundy";
    return "burgundy";
  }
  /* Orange goes in the wide Chardonnay bowl, not the narrow Riesling one it
     used to get. No glassmaker publishes an orange-wine shape — Riedel's guide
     has no entry for the style, and indexes Ribolla Gialla and Friulano as the
     light unoaked whites they are when nobody macerates them — so the call is
     made on the grapes we actually pour. Riedel's Winewings Chardonnay list
     names Friulano, Ribolla Gialla, Pinot Gris and Sauvignon Blanc, which is
     seven of our twelve; the rest (Malvazija, Vitovska, Godello) Riedel either
     doesn't list at all or lists elsewhere, and splitting the style down that
     line would dress an arbitrary cut up as evidence. The wide bowl is also
     simply what months on the skins need: these have phenolic grip and want
     air. Not the red Burgundy cone — the grip is tannic but the aromatics are
     a white's, and on the list it would file orange in with the reds. */
  if (style === "orange") return "chardonnay";
  /* The wide Chardonnay glass is otherwise for the oaked, heavy whites only —
     the whole white Burgundy shelf, plus the barrel-aged Viura, Savagnin and
     Alsace Pinot Gris that sit beside them. Everything else white, including
     the steely Chablis and the fresh unoaked Chardonnay, takes the Riesling
     glass. */
  if (style === "white_rich") return "chardonnay";
  return "riesling";
}

/* "Bez ograničenja" (any) = spare no expense → only the Filhov ponos 500 €+
   bottles that suit the dish. The owner asked for both that wording and that
   behaviour, and asked for them back after a round of renaming. The glass is
   not a band here — a glass price is not a bottle budget — it is the flip
   under the results. */
const HELPER_BUDGET = { b1: [0, 60], b2: [60, 120], b3: [120, Infinity], any: [PRIDE_MIN, Infinity] };
const helperState = { step: 0, dish: null, budgetKey: "any", mode: "bottle", picks: null };

function openHelper() {
  helperState.step = 0; helperState.dish = null; helperState.mode = "bottle";
  helperState.picks = null;
  renderHelperStep();
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
  showModal();
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

/* How well a wine suits the chosen dish.

   A shared food is worth **more when it is near the front of the wine's own
   list**, because since 2026-08-02 that list is stored best-first
   (scripts/lib/pairing-rank.mjs). Lamb is what a Dingač is *for*; a Bordeaux
   that lists lamb third is a good answer but not the same answer, and the
   score now says so — 4 points for the wine's first food, 3 for its second, 2
   for its third, 1 after that. The style is worth 3 and one of Filho's picks
   1, both unchanged.

   That is the same ranking the card shows, read from the same array, so the
   two directions the owner asked about cannot disagree: whatever puts a wine
   at the top of a dish's list is also what is printed first under "K jelima". */
function dishScore(dish, item) {
  const ins = item.insight;
  if (!ins) return 0;
  let score = 0;
  (ins.pairings || []).forEach((p, i) => {
    if ((dish.pairings || []).includes(p)) score += Math.max(1, 4 - i);
  });
  if ((dish.styles || []).includes(ins.style)) score += 3;
  if (item.recommended) score += 1;
  return score;
}

function renderHelperResults(budgetKey) {
  const t = T();
  helperState.budgetKey = budgetKey;
  const dish = helperState.dish || { pairings: [], styles: [] };
  const [lo, hi] = HELPER_BUDGET[budgetKey] || [0, Infinity];
  const scored = [], glasses = [];
  DATA.sections.forEach((sec, si) => {
    const byGlass = sec.id === "glass";
    if (!byGlass && !sec.id.startsWith("bottle-")) return;
    sec.categories.forEach((cat, ci) => {
      cat.groups.forEach((g, gi) => {
        g.items.forEach((item, ii) => {
          if (!item.insight) return;
          /* The budget bands are bottle prices, so they say nothing about a
             glass — a guest on a €60 bottle budget is not on a €60 glass. The
             by-the-glass pours are scored on the dish alone. */
          if (!byGlass && (item.price == null || item.price < lo || item.price > hi)) return;
          const score = dishScore(dish, item);
          if (score <= 0) return;
          /* The tie-break used to be 0.4, which only ever shuffled *exact*
             ties — so 25 of the 120 dish x budget combinations returned the
             same three wines for ever, and 80 bottles could never be
             suggested for anything. 3.0 is one scoring step: a wine can
             leapfrog at most one shared pairing or the style match, so wines
             that are genuinely comparable take turns and a wine four points
             behind still cannot displace the leader. It went from 0.4 to 3 when
             the score stepped by 3, and to 4 when ranked pairings made the
             steps finer (4/3/2/1 rather than 3 each): measured over 200 runs
             per combination, 4 keeps 252 of 276 bottles reachable and 8.4
             different wines per combination, while the wine that gets
             suggested still lists the dish's food as, on average, its first.
             Higher buys little — the remaining 29 locked combinations are
             locked by the food-first filter, not by the tie-break. */
          const row = { score: score + Math.random() * 4, ref: [si, ci, gi, ii].join("."), item, sec, country: g.country };
          (byGlass ? glasses : scored).push(row);
        });
      });
    });
  });
  scored.sort((a, b) => b.score - a.score);
  glasses.sort((a, b) => b.score - a.score);
  const byGlass = helperState.mode === "glass";

  /* One list at a time, never two (owner, 2026-08-02: "super confusing... it
     mentions bottle many times but still offers glass"). The budget question
     is the four bands it always was, and the answer is three bottles.

     The glass is offered two ways instead, both quiet:

       - **on the row**, when the suggested bottle is also poured by the glass.
         24 of the 32 pours are, so at least one of the three carries the line
         in 57% of dish x band combinations — and it upsells the wine the guest
         is already reading, which is the only upsell that does not feel like
         one. A guest who won't commit to a €75 bottle will often take a €14
         glass of it.
       - **one link underneath**, for the guest who only ever wanted a glass.

     Both answers are **three rows**, so the flip never resizes the sheet, and
     both are **frozen for as long as the dish and the budget hold**. The
     scoring carries a random tie-break, so recomputing on every flip reshuffled
     the bottles behind the guest's back; picking once and remembering makes the
     link a toggle rather than a reroll.

     And the glass list deliberately **skips whatever the bottle view already
     advertised inline** (owner, 2026-08-02): showing the same three wines
     twice is not three more options. If that leaves fewer than three it tops
     back up from the ones it skipped — a short list is worse than a repeat. */
  /* **A suggestion has to name the food on its own card** (owner, 2026-08-02:
     "I don't want to have some wine recommendation for some food, but not to
     have that food in wine description"). The score is three points per shared
     pairing *plus* three for the style, so a wine could be proposed on style
     alone — and 15.7% of all suggestions were: the guest tapped a wine
     recommended for their pea soup and read "beef, game, aged cheese".

     So the food matches are used on their own whenever there are any, and the
     style-only ones are never mixed in beside them to pad the list to three.
     Showing two wines that genuinely suit the dish beats three where one is
     there to fill a slot. The fallback exists only for the handful of
     combinations — four of 120, all in the Ikone band, where the shelf is
     tiny by design — that would otherwise answer with nothing at all. */
  const sharesFood = (r) =>
    (r.item.insight.pairings || []).some((p) => (dish.pairings || []).includes(p));
  const foodFirst = (rows) => {
    const yes = rows.filter(sharesFood);
    return yes.length ? yes : rows;
  };
  const key = `${dishName(dish)}|${budgetKey}`;
  if (!helperState.picks || helperState.picks.key !== key) {
    const bottles = foodFirst(scored).slice(0, 3);
    const twins = new Set(bottles.map((r) => `${r.item.producer}|${r.item.name}`)
                                 .filter((k) => glassPrices().has(k)));
    const pool = foodFirst(glasses);
    const fresh = pool.filter((r) => !twins.has(`${r.item.producer}|${r.item.name}`));
    const rest = pool.filter((r) => twins.has(`${r.item.producer}|${r.item.name}`));
    helperState.picks = { key, bottles, glasses: fresh.concat(rest).slice(0, 3) };
  }
  const rows = helperState.picks[byGlass ? "glasses" : "bottles"];
  const gp = glassPrices();
  /* Under the dish, the foods the suggestions actually share with it — "uz
     janjetinu i tvrde sireve". This is the answer to the owner's question about
     printing the kitchen's ingredient list here (2026-08-02): the ingredients
     would be 30 dishes x 8 languages of text that goes stale the day the
     kitchen changes, and they tell the guest something they already know —
     they ordered the dish. What they cannot know is *why* these three wines.
     This line says it, in words already translated, from data already there. */
  const why = rows.length
    ? [...new Set(rows.flatMap((r) => (r.item.insight.pairings || [])
        .filter((f) => (dish.pairings || []).includes(f))))]
        .slice(0, 3).map((f) => t.pairings[f] || f)
    : [];
  const forDish = helperState.dish
    ? `<div class="helper-fordish">${esc(dishName(helperState.dish))}` +
      (why.length ? `<span class="helper-why">${esc(t.ui.pairings.toLowerCase())}: ${esc(why.join(", "))}</span>` : "") +
      `</div>`
    : "";
  const list = rows.length
    ? rows.map((r) => {
        const also = !byGlass && gp.get(`${r.item.producer}|${r.item.name}`);
        const aside = also ? `🍷 ${esc(t.ui.alsoByGlass)} ${esc(fmtPrice(also))} €` : "";
        return itemHtml(r.item, r.ref, "", true, aside);
      }).join("")
    : `<p class="no-results">${t.ui.noResults}</p>`;
  const flip = `<button class="helper-flip" type="button">🍷 ${esc(byGlass ? t.ui.ratherBottle : t.ui.ratherGlass)}</button>`;
  $("modal-body").innerHTML = `<div class="helper"><div class="helper-title">🍷 ${esc(t.helper.results)}</div>${forDish}${list}${flip}<div class="helper-nav"><button class="helper-opt helper-budget" type="button">${esc(t.helper.changeBudget)}</button><button class="helper-opt helper-again" type="button">${esc(t.helper.again)}</button></div></div>`;
  showModal();
  $("modal-body").querySelector(".helper-flip").addEventListener("click", () => {
    helperState.mode = byGlass ? "bottle" : "glass";
    renderHelperResults(budgetKey);
  });
  const scope = rows.map((r) => r.ref);
  $("modal-body").querySelectorAll(".item.clickable").forEach((b) =>
    b.addEventListener("click", () =>
      openDetail(b.dataset.ref, () => renderHelperResults(budgetKey), scope))
  );
  $("modal-body").querySelector(".helper-budget").addEventListener("click", () => {
    /* "Promijeni budžet" is a bottle question, so it comes back with bottles
       even if the guest was looking at glasses — otherwise they pick a new
       band and get the same glass list, which is not an answer to what they
       asked (owner, 2026-08-02). */
    helperState.mode = "bottle";
    helperState.picks = null;
    helperState.step = 1;
    renderHelperStep();
  });
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
  if ($("search").value.trim() && (picksOnly || ratedOnly || prideOnly)) {
    picksOnly = ratedOnly = prideOnly = false;
    ["picks-toggle", "rated-toggle", "pride-toggle"].forEach((b) => $(b).classList.remove("active"));
  }
  renderContent();
});
$("modal-close").addEventListener("click", closeModal);
$("modal-backdrop").addEventListener("click", closeModal);

/* search: revealed by the corner icon; close via ✕ / Esc / the icon */
function openSearch() {
  $("search-bar").classList.add("open");
  $("search-toggle").classList.add("active");
  $("search").focus();
}
function closeSearch() {
  $("search-bar").classList.remove("open");
  $("search-toggle").classList.remove("active");
  if ($("search").value) { $("search").value = ""; renderContent(); }
}
$("search-toggle").addEventListener("click", () =>
  $("search-bar").classList.contains("open") ? closeSearch() : openSearch()
);
$("search-close").addEventListener("click", closeSearch);

$("modal-prev").addEventListener("click", () => stepDetail(-1));
$("modal-next").addEventListener("click", () => stepDetail(1));

document.addEventListener("keydown", (e) => {
  if (modalOpen && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    if (stepDetail(e.key === "ArrowLeft" ? -1 : 1)) e.preventDefault();
    return;
  }
  if (e.key !== "Escape") return;
  if (modalOpen) { closeModal(); return; }
  if ($("search-bar").classList.contains("open")) closeSearch();
});

/* Swipe the wine sheet away to dismiss (phones): drag down when already at
   the top, or up when already at the bottom (you finished reading and keep
   swiping). Normal content scrolling is untouched in between. */
(function () {
  const sheet = $("modal-sheet");
  const modal = $("modal");
  if (!sheet || !modal) return;
  let startY = 0, startX = 0, dy = 0, dx = 0, mode = "none", dragging = false, axis = "";
  /* A horizontal drag that starts on a scrollable row (chip strips) belongs to
     that row, not to us. */
  const onScroller = (el) => {
    for (let n = el; n && n !== modal; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 4) return true;
    }
    return false;
  };
  /* Bound to the modal rather than the card. On a tablet the card is 700px wide
     inside a 1024px screen, so listening on the card alone left a 160px dead
     strip down each side — which is exactly where a thumb starts. A sideways
     drag from the backdrop now steps wines too; the drag-away stays a gesture
     on the card itself, since dragging the backdrop downwards should not throw
     the card off the screen. */
  modal.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { dragging = false; return; }
    const onCard = sheet.contains(e.target);
    const atTop = sheet.scrollTop <= 0;
    const atBottom = sheet.scrollTop + sheet.clientHeight >= sheet.scrollHeight - 1;
    mode = !onCard ? "none" : atTop && atBottom ? "both" : atTop ? "down" : atBottom ? "up" : "none";
    const canStep = (detailNav.prev || detailNav.next) && !onScroller(e.target);
    if (mode === "none" && !canStep) { dragging = false; return; }
    startY = e.touches[0].clientY; startX = e.touches[0].clientX;
    dy = dx = 0; axis = ""; dragging = true;
    sheet.style.transition = "none";
  }, { passive: true });
  const allowed = () => mode === "both" || (mode === "down" && dy > 0) || (mode === "up" && dy < 0);
  modal.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    dy = e.touches[0].clientY - startY;
    dx = e.touches[0].clientX - startX;
    // Lock to one axis once the finger has committed, so a slightly diagonal
    // scroll never turns into a dismissal and vice versa.
    if (!axis) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
      if (axis === "x" && !(detailNav.prev || detailNav.next)) { dragging = false; return; }
    }
    if (axis === "x") {
      /* A hint of give, not a drag. Following the finger 1:1 and fading the
         card out under it looked like dragging a panel around; the arrows look
         better precisely because the card only ever performs one clean
         movement. So the gesture peeks — heavily damped, capped, fully opaque
         — and the movement itself happens on release. */
      const body = $("modal-body");
      const wall = (dx > 0 && !detailNav.prev) || (dx < 0 && !detailNav.next);
      const damp = wall ? 0.06 : 0.18;
      const shift = Math.max(-26, Math.min(26, dx * damp));
      body.style.transition = "none";
      body.style.willChange = "transform";
      body.style.transform = `translateX(${shift}px)`;
      return;
    }
    if (!allowed()) { dy = 0; sheet.style.transform = ""; $("modal-backdrop").style.opacity = ""; return; }
    sheet.style.transform = `translateY(${dy}px)`;
    $("modal-backdrop").style.opacity = String(Math.max(.25, 1 - Math.abs(dy) / 450));
  }, { passive: true });
  function end() {
    if (!dragging) return;
    dragging = false;
    if (axis === "x") {
      const dir = dx > 0 ? -1 : 1;               // drag right → previous wine
      const body = $("modal-body");
      // No fromDx: release runs exactly the animation an arrow tap runs.
      if (!(Math.abs(dx) > 80 && stepDetail(dir))) {
        // Not far enough: settle the card back under the finger's last spot.
        body.style.transition = "transform .3s cubic-bezier(.17,.84,.44,1), opacity .2s ease-out";
        body.style.transform = "";
        body.style.opacity = "1";
        setTimeout(() => { body.style.willChange = ""; body.style.transition = ""; }, 320);
      }
      return;
    }
    if (allowed() && Math.abs(dy) > 110) {
      // Finish the gesture instead of cutting it short: keep sliding the sheet
      // the rest of the way off-screen (same direction the finger was already
      // going) and fade the backdrop, then close once that's actually done.
      const backdrop = $("modal-backdrop");
      const dir = dy > 0 ? 1 : -1;
      const dist = (sheet.getBoundingClientRect().height || window.innerHeight) + 60;
      sheet.style.transition = "transform .42s cubic-bezier(.32,.72,0,1)";
      sheet.style.transform = `translateY(${dir * dist}px)`;
      backdrop.style.transition = "opacity .42s ease-out";
      backdrop.style.opacity = "0";
      // The card is on its way out; its arrows should not hang in the air.
      clearDetailNav();
      // hideModal puts the styles back, once the sheet is actually hidden.
      setTimeout(closeModal, 420);
    } else {
      $("modal-backdrop").style.opacity = "";
      sheet.style.transition = "transform .38s cubic-bezier(.32,.72,0,1)";
      sheet.style.transform = "";
    }
  }
  /* On window, not on the sheet: a swipe often ends with the finger past the
     sheet's edge, and a touchend the sheet never hears used to leave it stuck
     mid-drag — with the ✕ dragged off with it, so nothing could be tapped. */
  window.addEventListener("touchend", end);
  window.addEventListener("touchcancel", end);
  /* Belt and braces: whatever happened, an open sheet is never left displaced. */
  window.addEventListener("blur", () => { if (!dragging) return; dragging = false; resetSheet(); });
  function resetSheet() {
    sheet.style.transition = "";
    sheet.style.transform = "";
    const b = $("modal-backdrop");
    if (b) { b.style.transition = ""; b.style.opacity = ""; }
  }
})();

/* ---------- swipe between sections on the list itself ---------- */
/* Same idiom as the wine sheet: sideways moves to the neighbouring tab, so
   Bijela vina → Rosé vina without reaching for the chips. */
function navChipIds() {
  return Array.from($("nav").querySelectorAll("button")).map((b) => b.dataset.sec);
}
function stepSection(dir) {
  if (modalOpen || $("search").value.trim() || picksOnly || ratedOnly || prideOnly) return false;
  const ids = navChipIds();
  const i = ids.indexOf(currentSection);
  if (i < 0 || ids.length < 2) return false;
  // The tabs are a ring: past the last one comes the first. Stopping dead at
  // either end reads as the gesture having failed.
  const j = (i + dir + ids.length) % ids.length;
  currentSection = ids[j];
  renderNav();
  const c = $("content");
  c.style.transition = "none";
  c.style.opacity = "0";
  c.style.transform = `translateX(${dir > 0 ? 40 : -40}px)`;
  renderContent();
  window.scrollTo({ top: 0 });
  const chip = $("nav").querySelector(`button[data-sec="${CSS.escape(currentSection)}"]`);
  if (chip && chip.scrollIntoView) chip.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  requestAnimationFrame(() => {
    c.style.transition = "opacity .28s ease-out, transform .34s cubic-bezier(.32,.72,0,1)";
    c.style.opacity = "1";
    c.style.transform = "";
  });
  return true;
}
(function () {
  /* The whole app, not just #content. The list column is capped at 900px, so on
     a 1024px tablet it left a 62px dead gutter down each edge — and the footer,
     which a short category now parks at the bottom of the screen, was dead too.
     Both are where a thumb naturally lands. The chip strip still wins its own
     gestures: it is horizontally scrollable, so onScroller() bails on it. */
  const area = $("app") || $("content");
  if (!area) return;
  let sx = 0, sy = 0, dx = 0, dy = 0, axis = "", live = false;
  const onScroller = (el) => {
    /* The header owns its own gestures: the chip strip scrolls sideways, and a
       swipe across the mode buttons or the search field is not a request for the
       next section. Checking scrollWidth alone was not enough — at 1024px the
       chips sometimes fit exactly, and then the strip is not a scroller and the
       swipe was stolen from it. */
    if (el && el.closest && el.closest(".header")) return true;
    for (let n = el; n && n !== area; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 4) return true;
    }
    return false;
  };
  area.addEventListener("touchstart", (e) => {
    live = e.touches.length === 1 && !modalOpen && !onScroller(e.target);
    if (!live) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = dy = 0; axis = "";
  }, { passive: true });
  area.addEventListener("touchmove", (e) => {
    if (!live) return;
    dx = e.touches[0].clientX - sx; dy = e.touches[0].clientY - sy;
    if (!axis && (Math.abs(dx) > 14 || Math.abs(dy) > 14))
      axis = Math.abs(dx) > Math.abs(dy) * 1.5 ? "x" : "y";
    if (axis === "y") live = false;                 // it is a scroll, leave it alone
  }, { passive: true });
  function end() {
    if (!live) return;
    live = false;
    if (axis === "x" && Math.abs(dx) > 80) stepSection(dx > 0 ? -1 : 1);
  }
  window.addEventListener("touchend", end);
  window.addEventListener("touchcancel", end);
})();
$("home-logo").addEventListener("click", showStart);
// the splash logo goes back too — it is the only way out of the story screen
$("story-logo").addEventListener("click", showStart);
$("story-enter").addEventListener("click", showApp);
function bindToggle(id, get, set) {
  $(id).addEventListener("click", () => {
    const on = !get();
    picksOnly = ratedOnly = prideOnly = false;
    set(on);
    currentSection = on ? "" : DATA.sections[0].id;
    $("search").value = "";
    ["picks-toggle", "rated-toggle", "pride-toggle"].forEach((b) => $(b).classList.remove("active"));
    $(id).classList.toggle("active", on);
    renderNav();
    renderContent();
    window.scrollTo({ top: 0 });
  });
}
bindToggle("picks-toggle", () => picksOnly, (v) => { picksOnly = v; });
bindToggle("rated-toggle", () => ratedOnly, (v) => { ratedOnly = v; });
bindToggle("pride-toggle", () => prideOnly, (v) => { prideOnly = v; });
$("helper-open").addEventListener("click", openHelper);

if ("serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

init();
