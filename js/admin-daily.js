/* Theatrium admin — "Dnevna ponuda" (2026-10-13).
 *
 * Filho sends today's menu the way he already makes it: a photo (or a
 * screenshot) of the menu graphic, or the text pasted. The inbox on the
 * restaurant site (theatrium.devinos.hr/api/kuhinja/citaj) starts a run that
 * reads it with the sommelier skill and writes the whole offer — the dishes in
 * 8 languages, their food tags and 1–3 wines each. It comes back here as a
 * preview: he can add prices, drop a wine or a dish, and tap "Objavi". From
 * that moment it is on the website (/dnevna-ponuda/) and the first group in
 * the wine list's "Pomozi mi odabrati", and it rolls off by itself overnight.
 * Design: web/DAILY-OFFER.md.
 *
 * Its own file for the same reason as admin-wines.js: the 86 board is used
 * mid-service and must not break because of a form it does not need.
 */
"use strict";
(function () {
  const SITE = window.DAILY_SITE || "https://theatrium.devinos.hr";
  const API = SITE + "/api/kuhinja";
  const LS_GH = "theatrium-admin-token";
  const POLL_MS = 8000;
  const T = (typeof I18N !== "undefined" && I18N.hr) || {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const eur = (n) => (n == null ? "" : String(n).replace(".", ",") + " €");
  const ghKey = () => localStorage.getItem(LS_GH) || "";
  const COURSE = { starters: "Predjelo", soups: "Juha", mains: "Glavno jelo", desserts: "Desert" };
  const food = (k) => (T.pairings && T.pairings[k]) || k.replace(/_/g, " ");
  const style = (k) => (T.styles && T.styles[k]) || k.replace(/_/g, " ");

  let items = [], limits = null, live = null, today = "", timer = null, wines = null, sending = "";
  const files = [];          /* photos picked, not yet sent */
  const drafts = {};         /* id -> Filho's edits to a preview, held until Objavi */

  async function api(path, opts = {}) {
    const r = await fetch(API + path, { ...opts, headers: { authorization: "Bearer " + ghKey(), ...(opts.headers || {}) } });
    if (r.status === 401) throw new Error("Ključ na ovom tabletu ne vrijedi za dnevnu ponudu — javite vlasniku.");
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(MSG[body.error] || body.error || `HTTP ${r.status}`);
    return body;
  }
  const MSG = {
    empty_menu: "Dodajte fotografiju jelovnika ili zalijepite tekst.",
    too_many_photos: "Najviše 3 fotografije odjednom.",
    photo_too_big: "Fotografija je prevelika.",
    photo_type: "Fotografija mora biti JPEG, WebP ili PNG.",
    not_ready: "Ponuda još nije spremna.",
    no_dishes: "U ponudi nije ostalo nijedno jelo.",
    running: "Na ponudi se upravo radi — pričekajte.",
    too_late: "Već je objavljeno.",
    stale: "Ova ponuda je za jučer — pošaljite današnji jelovnik.",
    run_timed_out: "Rad nije završio na vrijeme. Pokušajte ponovno.",
    too_many_rounds: "Previše pokušaja — javite vlasniku.",
    no_dispatch_token: "Čeka da vlasnik uključi automatsku obradu.",
    daily_cap: "Danas je dosegnut dnevni limit.",
    monthly_cap: "Dosegnut je mjesečni limit — javite vlasniku.",
  };
  const errText = (e) => MSG[e] || (/^github_/.test(e || "") ? "Pokretanje nije uspjelo — pokušat će ponovno." : e);

  /* The list's own files, for the wine names and tonight's prices on the
     preview. Read once per visit; the preview is a minute's work. */
  async function loadWines() {
    if (wines) return wines;
    const [lib, list] = await Promise.all([
      fetch("library/wines.json", { cache: "no-cache" }).then((r) => r.json()),
      fetch("lists/theatrium.json", { cache: "no-cache" }).then((r) => r.json()),
    ]);
    const m = new Map();
    for (const sec of list.sections) for (const cat of sec.categories) for (const g of cat.groups) for (const it of g.items) {
      const w = lib.wines[it.ref];
      if (!w) continue;
      const e = m.get(it.ref) || { name: w.name, producer: w.producer, bottle: null, glass: null };
      if (sec.id === "glass") e.glass = it.price; else if (e.bottle == null || it.price < e.bottle) e.bottle = it.price;
      m.set(it.ref, e);
    }
    return (wines = m);
  }

  window.loadDaily = async function () {
    clearTimeout(timer);
    try {
      const [b, p] = await Promise.all([api("/citaj"), api("/ponuda"), loadWines().catch(() => null)]);
      items = b.items || []; limits = b.limits; today = b.today;
      live = p.offer && p.offer.status === "published" ? p.offer : null;
      render();
    } catch (e) { render(); say(e.message); }
    if (window.adminTab && window.adminTab() === "ponuda" && items.some((i) => ["queued", "working"].includes(i.status)))
      timer = setTimeout(window.loadDaily, POLL_MS);
  };
  const say = (t) => { const m = $("d-msg"); if (m) m.textContent = t || ""; };

  const STATUS = {
    queued: "U redu čekanja", working: "Čita jelovnik i bira vina", ready: "Spremno za pregled",
    published: "Objavljeno", failed: "Nije uspjelo", cancelled: "Odustano",
  };

  function render() {
    const box = $("tab-ponuda");
    if (!box) return;
    const lim = limits ? (limits.enabled
      ? `Danas ${limits.today}/${limits.dailyCap} · ovaj mjesec ${limits.month}/${limits.monthlyCap}`
      : "Automatska obrada je trenutno isključena — zahtjevi čekaju.") : "";
    /* Only today's: an offer belongs to its service day and is gone from the
       website and the tablets at the 03:00 UTC rollover, so yesterday's
       preview has nothing left to publish. */
    const shown = items.filter((i) => i.status !== "cancelled" && i.date === today);
    box.innerHTML = `
      ${liveCard()}
      <div class="card">
        <h2>Dnevna ponuda</h2>
        <p class="muted" style="margin:0">Fotografija ili snimka zaslona današnjeg jelovnika — ili zalijepite tekst. Vina, prijevode i sljubljivanje pripremi sustav; vi pregledate i objavite.</p>
        <div class="up-pics">
          ${files.map((f, i) => `<span class="upth" style="background-image:url(${f.url})"><button data-rm="${i}" aria-label="Ukloni">✕</button></span>`).join("")}
          ${files.length < 3 ? `<label class="shot-btn btn small ghost">📷 Slikaj<input id="d-cam" type="file" accept="image/*" capture="environment"></label>
          <label class="shot-btn btn small ghost">🖼 Galerija<input id="d-gal" type="file" accept="image/*,.heic,.heif" multiple></label>` : ""}
        </div>
        <label class="lbl">Ili tekst jelovnika
          <textarea id="d-text" rows="5" placeholder="BIJELI TARTUF&#10;Pašta ili risotto&#10;…">${esc($("d-text") ? $("d-text").value : "")}</textarea></label>
        <label class="lbl">Napomena (nije obavezno)
          <input id="d-remark" type="text" maxlength="300" placeholder="npr. uz srnetinu ponudite Poggio di Sotto" value="${esc($("d-remark") ? $("d-remark").value : "")}"></label>
        ${sending ? `<button class="btn wide busy" disabled><span class="spin"></span>${esc(sending)}</button>` : `<button class="btn wide" id="d-send">Pošalji</button>`}
        <div class="muted center" id="d-msg">${esc(lim)}</div>
      </div>
      ${shown.length ? `<h2 class="sec">Zahtjevi</h2>` : ""}
      ${shown.map(card).join("")}`;
    wire(box);
  }

  function liveCard() {
    if (!live) return `<div class="card"><p class="muted" style="margin:0">Danas još nema objavljene ponude.</p></div>`;
    return `<div class="card">
      <div class="req-head"><div><div class="nm">Na webu i na karti danas</div>
        <div class="muted">${live.dishes.map((d) => esc(d.name.hr)).join(" · ")}</div></div>
        <a class="linkbtn" href="${SITE}/dnevna-ponuda/" target="_blank" rel="noopener">pogledaj</a></div>
      <button class="btn small ghost" id="d-pull">Povuci objavu</button>
    </div>`;
  }

  function card(it) {
    const at = new Date(it.updated_at).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
    let body = "";
    if (it.status === "queued" || it.status === "working")
      body = `<p class="muted"><span class="spin"></span> ${it.status === "working" ? "Obično 3–5 minuta." : esc(errText(it.error) || "Kreće uskoro.")}</p>`;
    if (it.status === "failed")
      body = `<p class="err">${esc(errText(it.error) || "Nije uspjelo.")}</p>
        <div class="ch-acts"><button class="nema ok" data-act="ponovi" data-id="${it.id}">pokušaj ponovno</button>
        <button class="nema cancel" data-act="odustani" data-id="${it.id}">odustani</button></div>`;
    if ((it.status === "ready" || it.status === "published") && it.result) body = preview(it);
    return `<div class="card req" data-id="${it.id}">
      <div class="req-head"><div><div class="nm">${esc(STATUS[it.status] || it.status)}</div>
        <div class="muted">${esc(it.date)} · ${at}${it.created_by ? " · " + esc(it.created_by) : ""}</div></div>
        ${it.run_url ? `<a class="linkbtn" href="${esc(it.run_url)}" target="_blank" rel="noopener">tijek</a>` : ""}</div>
      ${body}</div>`;
  }

  /* Filho's working copy of a preview: prices typed, wines and dishes removed. */
  function draftOf(it) {
    if (!drafts[it.id]) drafts[it.id] = JSON.parse(JSON.stringify(it.result.offer));
    return drafts[it.id];
  }

  function preview(it) {
    const o = draftOf(it), r = it.result, isLive = it.status === "published" && !!live;
    const wineRow = (ref, di, wi) => {
      const w = wines && wines.get(ref);
      const price = w ? [w.glass != null ? "čaša " + eur(w.glass) : "", w.bottle != null ? "boca " + eur(w.bottle) : ""].filter(Boolean).join(" · ") : "";
      return `<li>${w ? `<b>${esc(w.name)}</b> <span class="muted">${esc(w.producer)}${price ? " · " + price : ""}</span>` : esc(ref)}
        ${isLive ? "" : `<button class="d-x inline" data-rmw="${di}:${wi}" data-id="${it.id}" aria-label="Makni vino">✕</button>`}</li>`;
    };
    const dishes = o.dishes.map((d, di) => `<div class="d-dish">
      <div class="d-dish-head"><span class="muted">${esc(COURSE[d.course] || d.course)}</span>
        ${isLive ? "" : `<button class="d-x inline" data-rmd="${di}" data-id="${it.id}" aria-label="Makni jelo">✕</button>`}</div>
      <div class="nm">${esc(d.name.hr)}</div>
      ${d.description && d.description.hr ? `<div class="muted">${esc(d.description.hr)}</div>` : ""}
      <label class="lbl d-price">Cijena (€)<input type="text" inputmode="decimal" data-price="${di}" data-id="${it.id}"
        value="${d.price != null ? esc(String(d.price).replace(".", ",")) : ""}" placeholder="nije obavezno" ${isLive ? "disabled" : ""}></label>
      <div class="muted small">uz: ${esc(d.pairings.map(food).join(", ") || "—")}${d.styles.length ? " · " + esc(d.styles.map(style).join(", ")) : ""}</div>
      <ul class="d-wines">${d.wines.map((ref, wi) => wineRow(ref, di, wi)).join("") || `<li class="muted">bez vina</li>`}</ul>
    </div>`).join("");
    const notes = r.notes ? `<details class="more"><summary>Zašto ova vina</summary><p class="muted small" style="white-space:pre-wrap">${esc(r.notes)}</p></details>` : "";
    const dropped = (r.dropped || []).length ? `<details class="more"><summary>Napomene provjere (${r.dropped.length})</summary><ul class="muted small">${r.dropped.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : "";
    const acts = isLive
      ? `<p class="muted">Objavljeno${it.published_by ? " · " + esc(it.published_by) : ""}.</p>`
      : `<button class="btn wide" data-act="objavi" data-id="${it.id}">Objavi</button>
         <div class="ch-acts"><button class="nema ok" data-act="ponovi" data-id="${it.id}">napravi ponovno</button>
         <button class="nema cancel" data-act="odustani" data-id="${it.id}">odustani</button></div>`;
    return dishes + notes + dropped + acts;
  }

  async function shrink(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" })
      .catch(() => createImageBitmap(file))
      .catch(() => { throw new Error("Ovu fotografiju telefon ne može otvoriti. Odaberite drugu."); });
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    let q = 0.88, blob;
    do { blob = await new Promise((res) => c.toBlob(res, "image/jpeg", q)); q -= 0.1; } while (blob && blob.size > 1400000 && q > 0.4);
    return blob;
  }

  function wire(box) {
    for (const id of ["d-cam", "d-gal"]) {
      const inp = $(id);
      if (inp) inp.addEventListener("change", () => {
        for (const f of inp.files) if (files.length < 3) files.push({ file: f, url: URL.createObjectURL(f) });
        render();
      });
    }
    box.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { files.splice(+b.dataset.rm, 1); render(); }));
    if ($("d-send")) $("d-send").addEventListener("click", submit);
    if ($("d-pull")) $("d-pull").addEventListener("click", pull);
    box.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act, b.dataset.id, b)));
    box.querySelectorAll("[data-rmw]").forEach((b) => b.addEventListener("click", () => {
      const [di, wi] = b.dataset.rmw.split(":").map(Number);
      draftOf(items.find((i) => i.id === b.dataset.id)).dishes[di].wines.splice(wi, 1); render();
    }));
    box.querySelectorAll("[data-rmd]").forEach((b) => b.addEventListener("click", () => {
      draftOf(items.find((i) => i.id === b.dataset.id)).dishes.splice(+b.dataset.rmd, 1); render();
    }));
    box.querySelectorAll("[data-price]").forEach((inp) => inp.addEventListener("change", () => {
      const d = draftOf(items.find((i) => i.id === inp.dataset.id)).dishes[+inp.dataset.price];
      const t = inp.value.trim().replace(/\s|€/g, "").replace(",", ".");
      d.price = /^\d+(\.\d{1,2})?$/.test(t) && +t > 0 ? +t : null;
      if (t && d.price == null) inp.value = "";
    }));
  }

  async function submit() {
    const text = $("d-text").value.trim();
    if (!files.length && !text) { say(MSG.empty_menu); return; }
    sending = "Šaljem…"; render();
    try {
      const fd = new FormData();
      for (const f of files) fd.append("photo", await shrink(f.file), "jelovnik.jpg");
      fd.append("text", text);
      fd.append("remark", $("d-remark").value.trim());
      fd.append("by", (window.adminWho && window.adminWho()) || "");
      await api("/citaj", { method: "POST", body: fd });
      files.length = 0;
      sending = ""; render();
      $("d-text").value = ""; $("d-remark").value = "";
      window.loadDaily();
    } catch (e) { sending = ""; render(); say(e.message); }
  }

  async function act(action, id, btn) {
    const it = items.find((i) => i.id === id);
    if (action === "odustani" && !confirm("Odustati od ove ponude?")) return;
    btn.disabled = true;
    try {
      const body = action === "objavi"
        ? { offer: { ...draftOf(it), photos: [] }, by: (window.adminWho && window.adminWho()) || "" }
        : {};
      await api(`/citaj/${id}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (action !== "objavi") delete drafts[id];
      window.loadDaily();
    } catch (e) { btn.disabled = false; say(e.message); }
  }

  /* Off the website and the tablets now, not at 03:00. The offer stays as a
     draft, so publishing the same request again brings it back. */
  async function pull() {
    if (!confirm("Povući današnju ponudu s weba i s karte?")) return;
    try {
      const p = await api("/ponuda");
      if (p.offer) await api("/ponuda", { method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...p.offer, date: p.date, status: "draft" }) });
      window.loadDaily();
    } catch (e) { say(e.message); }
  }
})();
