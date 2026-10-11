/* Theatrium admin — "Novo vino" and "Povijest".
 *
 * Novo vino: Filho photographs a bottle (front and back — alcohol is often on
 * the back), types the price, and sends it. The inbox on the restaurant site
 * (theatrium.devinos.hr/api/vina) queues it; a GitHub Actions run writes the
 * card with Claude; if something is not legible it asks him here, in
 * Croatian; when the card is done he reads the preview and taps "Objavi".
 * Design: web/WINE-INTAKE.md.
 *
 * Povijest: what changed on the list, newest first, from the repository's own
 * commits — wines added, prices, what ran out. Read-only.
 *
 * Kept out of js/admin.js on purpose: the 86 board is used mid-service and
 * must not be able to break because of a form it does not need. The two share
 * only the page and the GitHub token (Povijest reads commits with it).
 */
"use strict";
(function () {
  const API = window.WINE_API || "https://theatrium.devinos.hr/api/vina";
  /* The same GitHub key the 86 board stores — the inbox checks it with GitHub.
     No second key for Filho to find (owner, 2026-10-10). */
  const LS_GH = "theatrium-admin-token";
  const POLL_MS = 8000;
  const T = (typeof I18N !== "undefined" && I18N.hr) || {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const eur = (n) => (n == null ? "" : String(n).replace(".", ",") + " €");

  const ghKey = () => localStorage.getItem(LS_GH) || "";
  let items = [], limits = null, timer = null, tab = "karta";
  const thumbs = new Map();   /* id|n -> object URL, so photos are fetched once */

  /* ---------- tabs ---------- */
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));
  function show(name) {
    tab = name;
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    ["karta", "novo", "povijest"].forEach((t) => $("tab-" + t).classList.toggle("hidden", t !== name));
    $("filters").classList.toggle("hidden", name !== "karta");
    clearTimeout(timer);
    /* Coming back to Karta always starts from the whole list. */
    if (name === "karta" && typeof window.boardView === "function") window.boardView("sve");
    if (name === "novo") loadRequests();
    if (name === "povijest") loadHistory();
  }

  /* ---------- the inbox ---------- */
  async function api(path, opts = {}) {
    const r = await fetch(API + path, { ...opts, headers: { authorization: "Bearer " + ghKey(), ...(opts.headers || {}) } });
    if (r.status === 401) throw new Error("Ključ na ovom tabletu ne vrijedi za novo vino — javite vlasniku.");
    const ct = r.headers.get("content-type") || "";
    const body = ct.includes("json") ? await r.json().catch(() => ({})) : r;
    if (!r.ok) throw new Error(MSG[body.error] || body.error || `HTTP ${r.status}`);
    return body;
  }
  const MSG = {
    no_photo: "Dodajte barem jednu fotografiju etikete.",
    no_price: "Upišite cijenu boce ili čaše.",
    price: "Cijena nije broj (npr. 130 ili 8,50).",
    vol: "Volumen nije ispravan.",
    too_many_photos: "Najviše 3 fotografije odjednom.",
    photo_too_big: "Fotografija je prevelika.",
    photo_type: "Fotografija mora biti JPEG, WebP ili PNG.",
    not_ready: "Vino još nije spremno za objavu.",
    disabled: "Unos novih vina je trenutno isključen.",
    running: "Na ovom vinu se upravo radi — pričekajte.",
    too_late: "Vino je već objavljeno.",
    empty: "Niste ništa promijenili.",
    /* errors a request carries, from the inbox or the run */
    run_timed_out: "Rad nije završio na vrijeme. Pokušajte ponovno.",
    too_many_rounds: "Previše pokušaja za ovo vino — javite vlasniku.",
    no_dispatch_token: "Čeka da vlasnik uključi automatsko dodavanje.",
    daily_cap: "Danas je dosegnut dnevni limit — nastavlja sutra.",
    monthly_cap: "Dosegnut je mjesečni limit — javite vlasniku.",
  };
  const errText = (e) => MSG[e] || (/^github_/.test(e || "") ? "Pokretanje nije uspjelo — pokušat će ponovno." : e);

  async function loadRequests() {
    try {
      const b = await api("");
      items = b.items || []; limits = b.limits;
      renderNovo();
      for (const it of items) for (const n of it.photos) loadThumb(it.id, n);
    } catch (e) { renderNovo(); $("novo-msg").textContent = "Ne mogu učitati: " + e.message; }
    /* Poll while something is moving; a finished list does not need it. */
    if (tab === "novo" && items.some((i) => ["queued", "working", "publishing"].includes(i.status)))
      timer = setTimeout(loadRequests, POLL_MS);
  }

  async function loadThumb(id, n) {
    const k = id + "|" + n;
    if (thumbs.has(k)) return;
    thumbs.set(k, "");   /* loading — a re-render shows the placeholder, not a broken image */
    try {
      const r = await fetch(`${API}/${id}/foto/${n}`, { headers: { authorization: "Bearer " + ghKey() } });
      if (!r.ok) throw new Error(r.status);
      thumbs.set(k, URL.createObjectURL(await r.blob()));
      const ph = document.querySelector(`[data-thumb="${CSS.escape(k)}"]`);
      if (ph) ph.outerHTML = thumbHtml(id, n);
    } catch (e) { thumbs.delete(k); /* tried again on the next refresh */ }
  }

  /* Shrunk on the tablet before it leaves: a 12 MP photo is 5–8 MB, and the
     label's small print still reads at 2000px — which is why this is larger
     than the 1600px the daily offer uses. */
  /* Any photo the phone offers — camera or gallery, iPhone or Android
     (owner, 2026-10-11: "pull pictures from gallery … not only live
     pictures"; `capture` forced the camera on Android, so it is gone). It
     is decoded here and re-encoded as JPEG, which also turns an iPhone's
     HEIC into something the inbox accepts. A format this phone's browser
     cannot decode gets a plain message rather than a silent failure. */
  async function shrink(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" })
      .catch(() => createImageBitmap(file))
      .catch(() => { throw new Error("Ovu fotografiju telefon ne može otvoriti. Odaberite drugu ili je fotografirajte ponovno."); });
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    let q = 0.88, blob;
    do { blob = await new Promise((res) => c.toBlob(res, "image/jpeg", q)); q -= 0.1; } while (blob && blob.size > 1400000 && q > 0.4);
    return blob;
  }

  const STATUS = {
    queued: ["U redu čekanja", ""],
    working: ["U izradi", ""],
    needs_info: ["Treba odgovor", "Odgovorite na pitanje ispod."],
    ready: ["Spremno za pregled", "Pročitajte i objavite."],
    publishing: ["Objavljujem", ""],
    published: ["Na karti", ""],
    failed: ["Nije uspjelo", ""],
    cancelled: ["Odustano", ""],
  };

  function renderNovo() {
    const box = $("tab-novo");
    const lim = limits ? (limits.enabled
      ? `Danas ${limits.today}/${limits.dailyCap} · ovaj mjesec ${limits.month}/${limits.monthlyCap}`
      : "Unos novih vina je trenutno isključen — zahtjevi čekaju.") : "";
    box.innerHTML = `
      <div class="card">
        <p class="muted" style="margin:0">Fotografirajte etiketu i upišite cijenu.</p>
        <div class="shots">
          ${shot("n-front", "Prednja etiketa", "obavezno")}
          ${shot("n-back", "Stražnja etiketa", "ako postoji")}
        </div>
        <div class="grid2">
          <label class="lbl">Cijena boce (€)<input id="n-bottle" type="text" inputmode="decimal" placeholder="npr. 130"></label>
          <label class="lbl">Cijena čaše (€)<input id="n-glass" type="text" inputmode="decimal" placeholder="ako se toči"></label>
        </div>
        <!-- Offered on every wine (owner, 2026-10-11): ratings he already
             knows go straight onto the card. -->
        <label class="lbl">Ocjene kritičara, ako ih znate
          <input id="n-ratings" type="text" maxlength="300" placeholder="npr. Parker 95, Suckling 96"></label>
        <!-- Rarely needed, so folded away: the size is read off the label by
             default (owner, 2026-10-11: "easier … and a bit more clean"). -->
        <details class="more">
          <summary>Više</summary>
          <label class="lbl">Volumen boce
            <select id="n-vol"><option value="">Prepoznaj sa slike</option><option value="0.75">0,75 l</option><option value="0.375">0,375 l</option>
              <option value="0.5">0,5 l</option><option value="1.5">1,5 l (magnum)</option><option value="3">3 l</option></select></label>
          <label class="chk"><input id="n-rec" type="checkbox"> Moja preporuka — bilješka s mojim potpisom</label>
          <label class="lbl">Napomena
            <input id="n-remark" type="text" maxlength="300" placeholder="npr. zamjenjuje Amarone Ravazzol"></label>
        </details>
        <div id="n-send-row">${sendRow()}</div>
        <div class="muted center" id="novo-msg">${esc(lim)}</div>
      </div>
      ${shown().length ? `<h2 class="sec">Zahtjevi</h2>` : ""}
      ${shown().map(card).join("")}`;
    wireSend();
    /* A photo slot shows what was taken, so Filho sees the label is readable
       before anything is sent. */
    for (const inp of document.querySelectorAll("#tab-novo .shot input")) {
      inp.addEventListener("change", () => {
        const f = inp.files[0], slot = inp.dataset.slot, tile = $(slot + "-tile");
        if (!f) return;
        picked[slot] = f;
        tile.classList.add("has");
        tile.querySelector(".shot-img").style.backgroundImage = `url(${URL.createObjectURL(f)})`;
      });
    }
    box.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act, b.dataset.id, b)));
    box.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => editField(b)));
  }

  /* Filho's corrections, held on the tablet until he sends them. A field is
     edited in place: a box for a number or a short phrase, a larger one for
     the note and the winery story. Nothing leaves until "Pošalji ispravke". */
  const pending = {};
  function editField(btn) {
    const id = btn.dataset.id, field = btn.dataset.edit, from = btn.dataset.from;
    const mine = (pending[id] = pending[id] || {});
    const cur = mine[field] ? mine[field].to : from;
    const holder = btn.closest("td") || btn.closest("p");
    const long = !!btn.dataset.long;
    const box = document.createElement("div");
    box.className = "editbox";
    /* The field and its two buttons share one width (owner, 2026-10-11),
       the same row of equal cells as everywhere else on the page. */
    box.innerHTML = (long ? `<textarea rows="${field === "komentar" ? 3 : 6}"></textarea>` : `<input type="text">`) +
      `<div class="ch-acts"><button class="nema ok">U redu</button><button class="nema cancel no">odustani</button></div>`;
    const inp = box.querySelector(long ? "textarea" : "input");
    inp.value = cur;
    holder.replaceChildren(box);
    inp.focus();
    box.querySelector(".ok").addEventListener("click", () => {
      const v = inp.value.trim();
      if (v === from || (!v && field === "komentar")) delete mine[field]; else mine[field] = { field, from, to: v };
      renderNovo();
    });
    box.querySelector(".no").addEventListener("click", renderNovo);
  }

  function thumbHtml(id, n) {
    const k = id + "|" + n, url = thumbs.get(k);
    return url ? `<img data-thumb="${esc(k)}" src="${esc(url)}" alt="Etiketa ${n}">`
               : `<span class="ph" data-thumb="${esc(k)}">${n}</span>`;
  }

  /* Two ways into one slot (owner, 2026-10-11): "Slikaj" opens the camera
     (capture), "Galerija" the photos and files. Newer Android pickers offer
     no camera at all without `capture`, and with it no gallery — so both,
     side by side, on every phone. Whichever was used last fills the slot. */
  const picked = {};
  function shot(id, title, hint) {
    return `<div class="shot" id="${id}-tile">
      <span class="shot-img"></span>
      <b>${title}</b><span class="muted">${hint}</span>
      <span class="shot-btns">
        <label class="shot-btn">📷 Slikaj<input id="${id}-cam" data-slot="${id}" type="file" accept="image/*" capture="environment"></label>
        <label class="shot-btn">🖼 Galerija<input id="${id}" data-slot="${id}" type="file" accept="image/*,.heic,.heif"></label>
      </span></div>`;
  }

  /* Cancelled requests are nobody's business any more, and a published wine
     belongs to Povijest after a few days (owner, 2026-10-11: "not sure what
     'Odustano' means"). */
  const shown = () => items.filter((it) => it.status !== "cancelled" &&
    !(it.status === "published" && Date.now() - Date.parse(it.published_at || it.updated_at) > 3 * 86400000));

  /* What a run is doing, step by step, with the time on the current one
     (owner, 2026-10-11: "we need to see the progress all the time"). The steps
     come from the run itself; the page only adds the clock. */
  const hm = (iso) => new Date(iso).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
  const mins = (from) => Math.max(0, Math.floor((Date.now() - Date.parse(from)) / 60000));
  function progress(it) {
    const steps = [{ t: "Poslano", at: it.created_at }, ...(it.progress || [])];
    const live = ["queued", "working", "publishing"].includes(it.status);
    if (it.status === "queued") steps.push({ t: it.error ? errText(it.error) : "Čeka na red", at: it.updated_at });
    const li = steps.map((s, i) => {
      const now = live && i === steps.length - 1;
      return `<li class="${now ? "now" : "done"}"><span class="dot">${now ? `<span class="spin"></span>` : "✓"}</span>
        <span class="t">${esc(s.t)}</span><span class="at"${now ? ` data-since="${esc(s.at)}"` : ""}>${now ? `${mins(s.at)} min` : esc(hm(s.at))}</span></li>`;
    }).join("");
    const start = it.status === "publishing" ? (it.progress && it.progress[0] ? it.progress[0].at : it.updated_at) : it.created_at;
    const usual = it.status === "publishing" ? "obično 1–2 min" : "obično 5–15 min";
    return `<ol class="prog">${li}</ol>${live ? `<p class="muted small">Ukupno <span data-since="${esc(start)}">${mins(start)} min</span> · ${usual}.
      Možete zaključati mobitel ili zatvoriti stranicu — sve se radi na serveru, a ovdje piše dokle je stiglo.</p>` : ""}`;
  }
  /* A row of equal buttons; a step that cannot be undone asks on the same
     row first — "da, objavi" · "odustani" — never in a pop-up. */
  let confirming = null;   /* {id, action} */
  const novoSaving = {};    /* id -> the NOVO save in flight */
  const cardErr = {};
  const ASK = { objavi: ["da, objavi", "ok"], odbaci: ["da, odbaci vino", "all"] };
  function actRow(id, acts) {
    if (confirming && confirming.id === id) {
      const [label, cls] = ASK[confirming.action];
      return `<div class="ch-acts"><button class="nema ${cls}" data-act="${confirming.action}" data-sure="1" data-id="${esc(id)}">${label}</button>
        <button class="nema cancel" data-act="ne" data-id="${esc(id)}">odustani</button></div>`;
    }
    return `<div class="ch-acts">${acts.map(([act, label, cls]) =>
      `<button class="nema ${cls || ""}" data-act="${act}" data-id="${esc(id)}">${label}</button>`).join("")}</div>`;
  }

  function card(it) {
    const [label, hint] = STATUS[it.status] || [it.status, ""];
    const r = it.result || {};
    const w = (r.draft && r.draft.wine) || null;
    const title = w ? `${w.producer} — ${w.name}` : (r.name || "Vino u obradi");
    const pics = it.photos.map((n) => thumbHtml(it.id, n)).join("");
    const prices = [it.price_bottle != null ? `boca ${eur(it.price_bottle)}` : "", it.price_glass != null ? `čaša ${eur(it.price_glass)}` : "",
      it.vol ? String(it.vol).replace(".", ",") + " l" : ""].filter(Boolean).join(" · ");
    let body = "";
    if (it.status === "needs_info") {
      body = `<div class="ask">${it.questions.map((q, i) => `<label class="lbl">${esc(q)}
          <input type="text" data-answer="${i}" maxlength="500"></label>`).join("")}
        <span class="lbl">Dodatna fotografija (neobavezno)</span>
        <span class="shot-btns inline">
          <label class="shot-btn">📷 Slikaj<input type="file" data-more accept="image/*" capture="environment"></label>
          <label class="shot-btn">🖼 Galerija<input type="file" data-more accept="image/*,.heic,.heif" multiple></label>
        </span>
        <button class="btn wide" data-act="odgovor" data-id="${esc(it.id)}">Pošalji odgovor</button></div>
        ${actRow(it.id, [["odbaci", "odbaci vino"]])}`;
    }
    if (it.status === "ready" && w) {
      const n = Object.keys(pending[it.id] || {}).length;
      body = preview(it, r) + (it.error ? `<p class="err">${esc(errText(it.error))}</p>` : "") +
        `<p class="muted">✎ ispravlja polje.</p>
        ${n ? actRow(it.id, [["ispravak", `pošalji ispravke (${n})`, "ok"], ["ponisti", "poništi"]])
            : actRow(it.id, [["objavi", "objavi na karti", "ok"], ["odbaci", "odbaci vino"]])}`;
    }
    /* Says what was actually published (owner, 2026-10-11: the line said
       "pod NOVO" on a new vintage that, by the rule, was not NOVO). */
    if (it.status === "published") body = `<p class="muted">Objavljeno ${esc((it.published_at || "").slice(0, 10))}. ${novoState(it, r)
      ? "Gosti ga vide pod NOVO." : `Na karti je, ali nije pod NOVO${r.novo_reason ? ` (${esc(r.novo_reason)})` : ""} — uključuje se na Karti.`}</p>`;
    if (["queued", "working", "publishing"].includes(it.status)) body = progress(it) +
      (it.status === "queued" ? actRow(it.id, [["odbaci", "odbaci vino"]]) : "");
    /* A failure says where it stopped, and that nothing has to be sent again. */
    if (it.status === "failed") {
      const lastStep = (it.progress || []).slice(-1)[0];
      body = `<p class="err">${esc(errText(it.error) || "Nepoznata greška")}</p>
      ${lastStep ? `<p class="muted small">Stalo kod: ${esc(lastStep.t)}.</p>` : ""}
      <p class="muted small">Fotografije i cijene su spremljene — „pokušaj ponovno” kreće ispočetka, ništa ne treba slati ponovno.</p>
      ${actRow(it.id, [["ponovi", "pokušaj ponovno", "ok"], ["odbaci", "odbaci vino"]])}`;
    }
    if (cardErr[it.id]) body += `<p class="err">${esc(cardErr[it.id])}</p>`;
    return `<div class="card req st-${esc(it.status)}" id="req-${esc(it.id)}">
      <div class="req-head"><div><div class="nm">${esc(title)}</div><div class="muted">${esc(prices)} · ${esc(it.created_at.slice(0, 10))}${it.created_by ? ` · poslao ${esc(it.created_by)}` : ""}${it.published_by ? ` · objavio ${esc(it.published_by)}` : ""}</div></div>
        <span class="badge">${esc(label)}</span></div>
      ${hint ? `<p class="muted">${esc(hint)}</p>` : ""}
      <div class="pics">${pics}</div>${body}</div>`;
  }

  /* The card as the guest will read it, in Croatian, plus what the run could
     not settle. Not the app's own renderer — that would mean loading the guest
     app into the staff page — but every field the card prints. */
  /* NOVO is decided on the preview, with one tap and no run (owner,
     2026-10-10): a wine that has just arrived is NOVO; a new vintage of a wine
     we already pour is not. The run proposes, Filho decides. */
  function novoState(it, r) {
    const mine = [...(it.answers || [])].reverse().find((a) => a.kind === "novo");
    return mine ? !!mine.to : r.novo !== false;
  }
  function novoSwitch(it, r) {
    const on = novoState(it, r);
    const why = r.novo_reason ? ` <span class="muted">(${esc(r.novo_reason)})</span>` : "";
    /* Two choices, the chosen one lit (owner, 2026-10-11: a lone NOVO tag
       did not look tappable, and waited on the server before changing). */
    return `<div class="ch-acts seg"><button class="nema ${on ? "ok" : ""}" data-act="novo" data-to="1" data-id="${esc(it.id)}" aria-pressed="${on}">NOVO</button>
      <button class="nema ${on ? "" : "ok"}" data-act="novo" data-to="" data-id="${esc(it.id)}" aria-pressed="${!on}">nije novo</button></div>${why}`;
  }

  /* The winery, always said (owner, 2026-10-11: "if we have the producer, it
     should say so"): a new story the run wrote, the story already on the list
     with what else of theirs we pour, or that there is none. Either story is
     corrected with ✎ like any field; a change to an existing one is made in
     place, in all 8 languages, by an edit run. */
  function winery(it, r, p, mine) {
    const known = r.producer_known;
    const status = r.producer_status || (p ? "new" : known ? "known" : "");
    const name = p ? p.name : known ? known.name : "";
    const text = p ? (p.blurb && p.blurb.hr) || "" : known ? known.blurb_hr || "" : "";
    const head = status === "new" ? "Nova vinarija na karti — nova priča"
      : status === "known" ? `Vinarija je već na karti${known.other_wines && known.other_wines.length
          ? ` (${known.other_wines.map(esc).join(", ")})` : ""} — priča ostaje ista`
      : status === "none" ? "Vinarija nema priču na karti" : "";
    if (!head) return "";
    return `<div class="winery"><div class="w-head">${head}</div>
      ${text ? `<p class="blurb${mine.blurb ? " changed" : ""}"><b>${esc(name)}</b> — ${esc(mine.blurb ? mine.blurb.to : text)}
        <button class="pen" data-edit="blurb" data-id="${esc(it.id)}" data-long="1" data-from="${esc(text)}" aria-label="Ispravi priču o vinariji">✎</button></p>` : ""}
      ${r.producer_note ? `<p class="muted small">${esc(r.producer_note)}</p>` : ""}</div>`;
  }

  function preview(it, r) {
    const w = r.draft.wine, i = w.insight || {}, p = r.draft.producer;
    const tr = (group, k) => (T[group] && T[group][k]) || k;
    const row = (k, v) => (v ? `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>` : "");
    const mine = pending[it.id] || {};
    /* An editable value: what Filho changed wins over what the run wrote. */
    const ed = (label, field, value, long) => {
      const v = mine[field] != null ? mine[field].to : value;
      const changed = mine[field] != null ? " changed" : "";
      return `<tr><th>${esc(label)}</th><td><span class="ev${changed}">${esc(v || "—")}</span>
        <button class="pen" data-edit="${field}" data-id="${esc(it.id)}" data-long="${long ? 1 : ""}"
                data-from="${esc(value || "")}" aria-label="Ispravi ${esc(label)}">✎</button></td></tr>`;
    };
    const note = mine.note ? mine.note.to : (w.note && w.note.hr);
    return `<div class="pv">
      <table>
        ${ed("Cijena boce", "price_bottle", it.price_bottle != null ? String(it.price_bottle).replace(".", ",") : "")}
        ${it.price_glass != null ? ed("Cijena čaše", "price_glass", String(it.price_glass).replace(".", ",")) : ""}
        ${ed("Sorta", "grape", i.grape)}
        ${ed("Regija", "region", i.region)}
        ${row("Država", tr("countries", i.country))}
        <tr><th>Pod NOVO</th><td>${novoSwitch(it, r)}</td></tr>
        ${ed("Položaj", "terroir", w.terroir)}
        ${/* the style string already carries the body ("Crno · puno") */ ""}
        ${row("Stil", [tr("styles", i.style), tr("sweetness", i.sweetness)].filter(Boolean).join(" · "))}
        ${ed("Alkohol (%)", "alcohol", i.alcohol ? String(i.alcohol).replace(".", ",") : "")}
        ${ed("Posluživanje (°C)", "temp", i.temp)}
        ${row("Čaša", r.glass || i.glass || "")}
        ${row("Arome", (i.aromas || []).map((k) => tr("aromas", k)).join(", "))}
        ${row("Uz jelo", (i.pairings || []).map((k) => tr("pairings", k)).join(", "))}
        ${ed("Ocjene", "ratings", (w.ratings || []).map((x) => `${x.critic} ${x.score}`).join(", "))}
      </table>
      ${note ? `<p class="note${mine.note ? " changed" : ""}">${w.notePlain ? "" : "„"}${esc(note)}${w.notePlain ? "" : "“ — Filho"}
        <button class="pen" data-edit="note" data-id="${esc(it.id)}" data-long="1" data-from="${esc((w.note && w.note.hr) || "")}" aria-label="Ispravi bilješku">✎</button></p>`
        /* No note is a normal card (owner, 2026-10-11: a note is earned, never forced). */
        : `<p class="muted small">Bez bilješke — vino je ne treba ako nema što posebno reći.
            <button class="linkish" data-edit="note" data-id="${esc(it.id)}" data-long="1" data-from="">+ dodaj bilješku</button></p>`}
      ${winery(it, r, p, mine)}
      <p class="muted"><button class="linkish" data-edit="komentar" data-id="${esc(it.id)}" data-long="1" data-from="">+ Što još promijeniti?</button>
        ${mine.komentar ? `<br><i>${esc(mine.komentar.to)}</i>` : ""}</p>
      ${r.placement ? `<p class="muted">Na karti: ${esc(r.placement)}</p>` : ""}
      ${(r.gaps || []).length ? `<p class="muted">Nije potvrđeno: ${esc(r.gaps.join("; "))}</p>` : ""}
    </div>`;
  }

  /* The send button is the progress (owner, 2026-10-11: "progress show when
     I click"): it says what it is doing until the request is in. A missing
     back label is asked on the same row, like every other confirm. */
  let askBack = false, sending = "";
  function sendRow() {
    if (sending) return `<button class="btn wide busy" id="n-send" disabled><span class="spin"></span>${esc(sending)}</button>`;
    if (askBack) return `<p class="muted center" style="margin:16px 0 8px">Nema stražnje etikete? Alkohol je obično tamo.</p>
      <div class="ch-acts"><button class="nema ok" id="n-send-front">samo prednju</button><button class="nema cancel" id="n-send-no">odustani</button></div>`;
    return `<button class="btn wide" id="n-send">Pošalji</button>`;
  }
  function setSend() { const r = $("n-send-row"); if (r) { r.innerHTML = sendRow(); wireSend(); } }
  function wireSend() {
    const go = $("n-send"), front = $("n-send-front"), no = $("n-send-no");
    if (go && !sending) go.addEventListener("click", () => submit(false));
    if (front) front.addEventListener("click", () => { askBack = false; submit(true); });
    if (no) no.addEventListener("click", () => { askBack = false; setSend(); });
  }

  async function submit(frontOnly) {
    const front = picked["n-front"], back = picked["n-back"];
    const files = [front, back].filter(Boolean);
    const msg = $("novo-msg");
    if (!front) { msg.textContent = "Dodajte fotografiju prednje etikete."; return; }
    if (!$("n-bottle").value.trim() && !$("n-glass").value.trim()) { msg.textContent = MSG.no_price; return; }
    if (!back && !frontOnly) { askBack = true; setSend(); return; }
    msg.textContent = "";
    sending = "Pripremam fotografije…"; setSend();
    try {
      const fd = new FormData();
      for (const f of files) fd.append("photo", await shrink(f), "label.jpg");
      fd.append("price_bottle", $("n-bottle").value);
      fd.append("price_glass", $("n-glass").value);
      fd.append("vol", $("n-vol").value);
      if ($("n-rec").checked) fd.append("recommended", "1");
      fd.append("remark", $("n-remark").value);
      fd.append("ratings", $("n-ratings").value);
      fd.append("by", (window.adminWho && window.adminWho()) || "");
      sending = "Šaljem…"; setSend();
      await api("", { method: "POST", body: fd });
      sending = "";
      delete picked["n-front"]; delete picked["n-back"];
      await loadRequests();
      $("novo-msg").textContent = "Poslano — napredak pratite ispod.";
      const first = document.querySelector("#tab-novo .req");
      if (first) first.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { sending = ""; setSend(); $("novo-msg").textContent = "Nije poslano: " + e.message; }
  }

  async function act(action, id, btn) {
    const box = $("req-" + id);
    delete cardErr[id];
    if (action === "ne") { confirming = null; renderNovo(); return; }
    if (ASK[action] && !(btn && btn.dataset.sure)) { confirming = { id, action }; renderNovo(); return; }
    confirming = null;
    try {
      if (action === "ponisti") { delete pending[id]; renderNovo(); return; }
      if (action === "novo") {
        /* Shown at once; the server catches up behind it, and a failure puts
           it back and says so. */
        const it = items.find((x) => x.id === id);
        const on = !!(btn && btn.dataset.to);
        if (on === novoState(it, it.result || {})) return;
        const mark = { kind: "novo", to: on, local: true };
        it.answers = [...(it.answers || []), mark];
        renderNovo();
        /* Filho's choice is final (owner, 2026-10-11), so "objavi" waits for
           it to be saved rather than racing it. */
        const save = (novoSaving[id] || Promise.resolve()).then(() =>
          api(`/${id}/ispravak`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ novo: on }) }));
        novoSaving[id] = save.catch(() => {});
        try { await save; } catch (e) {
          it.answers = it.answers.filter((a) => a !== mark);
          cardErr[id] = "NOVO nije spremljen: " + e.message;
          renderNovo();
        }
        return;
      }
      if (action === "ispravak") {
        const mine = pending[id] || {};
        const body = { edits: [] };
        for (const [field, e] of Object.entries(mine)) {
          if (field === "price_bottle" || field === "price_glass") body[field] = e.to;
          else body.edits.push(e);
        }
        await api(`/${id}/ispravak`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        delete pending[id];
        await loadRequests();
        return;
      }
      if (action === "odgovor") {
        const fd = new FormData();
        box.querySelectorAll("[data-answer]").forEach((inp) => fd.append("answer_" + inp.dataset.answer, inp.value));
        const more = [...box.querySelectorAll("[data-more]")].flatMap((i) => [...(i.files || [])]);
        for (const f of more.slice(0, 3)) fd.append("photo", await shrink(f), "label.jpg");
        await api(`/${id}/odgovor`, { method: "POST", body: fd });
      } else {
        if (action === "objavi" && novoSaving[id]) await novoSaving[id];
        if (cardErr[id]) return;   /* the NOVO choice did not save: say so, publish nothing */
        const path = action === "odbaci" ? "odustani" : action;
        await api(`/${id}/${path}`, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ by: (window.adminWho && window.adminWho()) || "" }) });
      }
      await loadRequests();
    } catch (e) { cardErr[id] = e.message; renderNovo(); }
  }

  /* The minute counters tick between polls. */
  setInterval(() => {
    for (const el of document.querySelectorAll("#tab-novo [data-since]")) el.textContent = mins(el.dataset.since) + " min";
  }, 10000);

  /* ---------- Povijest ---------- */
  async function loadHistory() {
    const box = $("tab-povijest");
    const token = localStorage.getItem("theatrium-admin-token") || "";
    box.innerHTML = `<p class="muted">Učitavam…</p>`;
    try {
      const paths = ["lists/theatrium.json", "data/unavailable.json", "library/wines.json"];
      const lists = await Promise.all(paths.map((p) => fetch(
        `https://api.github.com/repos/jsiljeg/list/commits?sha=main&path=${encodeURIComponent(p)}&per_page=40`,
        { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" } }).then((r) => (r.ok ? r.json() : []))));
      const seen = new Map();
      for (const c of lists.flat()) if (!seen.has(c.sha)) seen.set(c.sha, c);
      const rows = [...seen.values()].sort((a, b) => b.commit.author.date.localeCompare(a.commit.author.date)).slice(0, 60);
      /* Everything the two of them change, and who did it (owner, 2026-10-11:
         "full history of changes … between ourselves"): wines added, taken
         off and brought back, prices, NOVO on and off. A batch commit
         ("3 promjene na karti") lists its changes one per line in the body,
         and each becomes its own row, under the batch's signer. */
      const kind = (m) => (/^Nema/.test(m) ? "makn" : /^Vraćeno/.test(m) ? "vrac"
        : /^Cijena:/.test(m) ? "cijena" : /^NOVO:/.test(m) ? "flag"
        : /joins NOVO|joins the list|joins|^Novo vino|^Dodaj vino/i.test(m) ? "novo" : null);
      const label = { novo: "Dodano", makn: "Skinuto", vrac: "Vraćeno", cijena: "Cijena", flag: "NOVO" };
      const entries = [];
      for (const c of rows) {
        const lines = c.commit.message.split("\n");
        const first = lines[0];
        /* Who: the name the first line is signed with ("… — Filho") — but not
           NOVO's own "— dodano/maknuto" on an older, unsigned commit — else
           the commit's author; the owner's GitHub login reads as "Jure". */
        let signer = (first.match(/ — ([^—]+)$/) || [])[1];
        if (/^(dodano|maknuto)$/.test(signer || "")) signer = "";
        const by = signer || ({ jsiljeg: "Jure" }[c.commit.author.name] || c.commit.author.name);
        const items = /^\d+ promjen/.test(first) ? lines.slice(1).filter((l) => l.trim()) : [first];
        for (const raw of items) {
          const item = signer ? raw.replace(new RegExp(` — ${signer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "") : raw;
          const k = kind(item);
          if (k) entries.push({ c, item, k, by });
        }
      }
      box.innerHTML = entries.slice(0, 80).map(({ c, item, k, by }) => {
        const d = new Date(c.commit.author.date).toLocaleString("hr-HR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
        let badge = label[k], what = item;
        if (k === "makn" || k === "vrac") {
          badge += /čašu/.test(item) ? " (čaša)" : /bocu/.test(item) ? " (boca)" : "";
          what = item.replace(/^(Nema na čašu|Nema na bocu|Nema|Vraćeno na kartu):\s*/, "");
        } else if (k === "cijena") {
          what = item.replace(/^Cijena:\s*/, "");
        } else if (k === "flag") {
          const on = / — dodano$/.test(item);
          badge = on ? "NOVO uklj." : "NOVO isklj.";
          what = item.replace(/^NOVO:\s*/, "").replace(/ — (dodano|maknuto)$/, "");
        } else {
          what = item.replace(/\s+joins NOVO.*$/, "");
        }
        return `<div class="hist h-${k}"><span class="when">${esc(d)}</span><span class="badge">${esc(badge)}</span><span class="what">${esc(what)}<span class="by"> · ${esc(by)}</span></span></div>`;
      }).join("") || `<p class="muted">Nema zapisa.</p>`;
      /* Which key this device uses, by its fingerprint — the owner reads it
         here to register his own key as "Jure" (see KEY_PEOPLE in admin.js). */
      box.insertAdjacentHTML("beforeend", `<p class="muted keyline">Prijavljen: ${esc((window.adminWho && window.adminWho()) || "?")}
        · ključ ${esc(window.adminKeyPrint || "?")}</p>`);
    } catch (e) { box.innerHTML = `<p class="err">Ne mogu učitati povijest: ${esc(e.message)}</p>`; }
  }
})();
