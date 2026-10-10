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
  const POLL_MS = 15000;
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
    running: "Claude upravo radi na ovom vinu — pričekajte.",
    too_late: "Vino je već objavljeno.",
    empty: "Niste ništa promijenili.",
    /* errors a request carries, from the inbox or the run */
    run_timed_out: "Claude nije završio na vrijeme. Pokušajte ponovno.",
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
  async function shrink(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    let q = 0.88, blob;
    do { blob = await new Promise((res) => c.toBlob(res, "image/jpeg", q)); q -= 0.1; } while (blob && blob.size > 1400000 && q > 0.4);
    return blob;
  }

  const STATUS = {
    queued: ["U redu čekanja", "Claude će početi uskoro."],
    working: ["Claude piše karticu", "Istraživanje i pisanje traje 5–15 minuta."],
    needs_info: ["Treba odgovor", "Odgovorite na pitanje ispod."],
    ready: ["Spremno za pregled", "Pročitajte i objavite."],
    publishing: ["Objavljujem…", "Vino ide na kartu."],
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
        <h2>Novo vino</h2>
        <ol class="steps">
          <li><b>Prednja etiketa</b> — cijela, oštra, bez odsjaja.</li>
          <li><b>Stražnja etiketa</b> — tamo su obično alkohol i volumen. Bez nje Claude će vas to pitati.</li>
          <li><b>Cijena</b> — boce, i čaše ako se toči.</li>
        </ol>
        <p class="muted">To je sve. Claude istraži vino i napiše karticu na 8 jezika (5–15 minuta).
          Ako nešto ne može pročitati, pitat će vas ovdje. Prije objave vidite cijelu karticu i možete je ispraviti.</p>
        <div class="shots">
          ${shot("n-front", "Prednja etiketa", "obavezno")}
          ${shot("n-back", "Stražnja etiketa", "alkohol, volumen")}
          ${shot("n-extra", "Dodatna", "neobavezno")}
        </div>
        <div class="grid2">
          <label class="lbl">Cijena boce (€) *<input id="n-bottle" type="text" inputmode="decimal" placeholder="npr. 130"></label>
          <label class="lbl">Cijena čaše (€)<input id="n-glass" type="text" inputmode="decimal" placeholder="ako se toči"></label>
        </div>
        <label class="lbl">Volumen boce
          <select id="n-vol"><option value="">Prepoznaj sa slike</option><option value="0.75">0,75 l</option><option value="0.375">0,375 l</option>
            <option value="0.5">0,5 l</option><option value="1.5">1,5 l (magnum)</option><option value="3">3 l</option></select></label>
        <label class="chk"><input id="n-rec" type="checkbox"> Moja preporuka — bilješka ide s mojim potpisom</label>
        <label class="lbl">Napomena (neobavezno)
          <input id="n-remark" type="text" maxlength="300" placeholder="npr. zamjenjuje Amarone Ravazzol"></label>
        <button class="btn" id="n-send">Pošalji</button>
        <div class="muted" id="novo-msg" style="margin-top:8px">${esc(lim)}</div>
      </div>
      ${items.length ? `<h2 class="sec">Zahtjevi</h2>` : ""}
      ${items.map(card).join("")}`;
    $("n-send").addEventListener("click", submit);
    /* A photo slot shows what was taken, so Filho sees the label is readable
       before anything is sent. */
    for (const id of ["n-front", "n-back", "n-extra"]) {
      $(id).addEventListener("change", () => {
        const f = $(id).files[0], tile = $(id).closest(".shot");
        tile.classList.toggle("has", !!f);
        tile.querySelector(".shot-img").style.backgroundImage = f ? `url(${URL.createObjectURL(f)})` : "";
      });
    }
    box.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act, b.dataset.id)));
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
    box.innerHTML = (long ? `<textarea rows="${field === "komentar" ? 3 : 6}"></textarea>` : `<input type="text">`) +
      `<div class="acts"><button class="btn small ok">U redu</button><button class="btn ghost small no">Odustani</button></div>`;
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

  function shot(id, title, hint) {
    return `<label class="shot"><input id="${id}" type="file" accept="image/*" capture="environment">
      <span class="shot-img"></span><span class="shot-cam">📷</span>
      <b>${title}</b><span class="muted">${hint}</span></label>`;
  }

  function card(it) {
    const [label, hint] = STATUS[it.status] || [it.status, ""];
    const r = it.result || {};
    const w = (r.draft && r.draft.wine) || null;
    const title = w ? `${w.producer} — ${w.name}` : (r.name || "Novo vino");
    const pics = it.photos.map((n) => thumbHtml(it.id, n)).join("");
    const prices = [it.price_bottle != null ? `boca ${eur(it.price_bottle)}` : "", it.price_glass != null ? `čaša ${eur(it.price_glass)}` : "",
      it.vol ? String(it.vol).replace(".", ",") + " l" : ""].filter(Boolean).join(" · ");
    let body = "";
    if (it.status === "needs_info") {
      body = `<div class="ask">${it.questions.map((q, i) => `<label class="lbl">${esc(q)}
          <input type="text" data-answer="${i}" maxlength="500"></label>`).join("")}
        <label class="lbl">Dodatna fotografija (neobavezno)<input type="file" data-more accept="image/*" capture="environment" multiple></label>
        <button class="btn" data-act="odgovor" data-id="${esc(it.id)}">Pošalji odgovor</button></div>`;
    }
    if (it.status === "ready" && w) {
      const n = Object.keys(pending[it.id] || {}).length;
      body = preview(it, r) + (it.error ? `<p class="err">${esc(errText(it.error))}</p>` : "") +
        `<p class="muted">Nešto ne valja? Dodirnite ✎ uz polje i ispravite. Cijena se mijenja odmah;
           ispravak teksta Claude prenese na svih 8 jezika (par minuta).</p>
        <div class="acts">${n
          ? `<button class="btn" data-act="ispravak" data-id="${esc(it.id)}">Pošalji ispravke (${n})</button>
             <button class="btn ghost" data-act="ponisti" data-id="${esc(it.id)}">Poništi</button>`
          : `<button class="btn" data-act="objavi" data-id="${esc(it.id)}">Objavi na karti</button>
             <button class="btn ghost" data-act="odustani" data-id="${esc(it.id)}">Odustani</button>`}</div>`;
    }
    if (it.status === "published") body = `<p class="muted">Objavljeno ${esc((it.published_at || "").slice(0, 10))}. Gosti ga vide pod NOVO.</p>`;
    if (it.status === "queued" && it.error) body = `<p class="muted">${esc(errText(it.error))}</p>`;
    if (it.status === "failed") body = `<p class="err">${esc(errText(it.error) || "Nepoznata greška")}</p>
      <div class="acts"><button class="btn ghost" data-act="ponovi" data-id="${esc(it.id)}">Pokušaj ponovno</button>
      <button class="btn ghost" data-act="odustani" data-id="${esc(it.id)}">Odustani</button></div>`;
    if (["queued", "needs_info"].includes(it.status)) body += `<div class="acts"><button class="btn ghost" data-act="odustani" data-id="${esc(it.id)}">Odustani</button></div>`;
    return `<div class="card req st-${esc(it.status)}" id="req-${esc(it.id)}">
      <div class="req-head"><div><div class="nm">${esc(title)}</div><div class="muted">${esc(prices)} · ${esc(it.created_at.slice(0, 10))}</div></div>
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
    return `<button class="novo ${on ? "on" : ""}" data-act="novo" data-id="${esc(it.id)}" aria-pressed="${on}">NOVO</button>
      ${on ? "Prikazuje se pod NOVO" : "Ne prikazuje se pod NOVO"}${why}`;
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
        <tr><th>NOVO</th><td>${novoSwitch(it, r)}</td></tr>
        ${ed("Položaj", "terroir", w.terroir)}
        ${/* the style string already carries the body ("Crno · puno") */ ""}
        ${row("Stil", [tr("styles", i.style), tr("sweetness", i.sweetness)].filter(Boolean).join(" · "))}
        ${ed("Alkohol (%)", "alcohol", i.alcohol ? String(i.alcohol).replace(".", ",") : "")}
        ${ed("Posluživanje (°C)", "temp", i.temp)}
        ${row("Čaša", r.glass || i.glass || "")}
        ${row("Arome", (i.aromas || []).map((k) => tr("aromas", k)).join(", "))}
        ${row("Uz jelo", (i.pairings || []).map((k) => tr("pairings", k)).join(", "))}
        ${row("Ocjene", (w.ratings || []).map((x) => `${x.critic} ${x.score}`).join(", "))}
      </table>
      ${note ? `<p class="note${mine.note ? " changed" : ""}">${w.notePlain ? "" : "„"}${esc(note)}${w.notePlain ? "" : "“ — Filho"}
        <button class="pen" data-edit="note" data-id="${esc(it.id)}" data-long="1" data-from="${esc((w.note && w.note.hr) || "")}" aria-label="Ispravi bilješku">✎</button></p>` : ""}
      ${p ? `<p class="blurb${mine.blurb ? " changed" : ""}"><b>${esc(p.name)}</b> — ${esc(mine.blurb ? mine.blurb.to : (p.blurb && p.blurb.hr))}
        <button class="pen" data-edit="blurb" data-id="${esc(it.id)}" data-long="1" data-from="${esc((p.blurb && p.blurb.hr) || "")}" aria-label="Ispravi priču o vinariji">✎</button></p>` : ""}
      <p class="muted"><button class="linkish" data-edit="komentar" data-id="${esc(it.id)}" data-long="1" data-from="">+ Napišite Claudeu što još promijeniti</button>
        ${mine.komentar ? `<br><i>${esc(mine.komentar.to)}</i>` : ""}</p>
      ${r.placement ? `<p class="muted">Na karti: ${esc(r.placement)}</p>` : ""}
      ${(r.gaps || []).length ? `<p class="muted">Nije potvrđeno: ${esc(r.gaps.join("; "))}</p>` : ""}
    </div>`;
  }

  async function submit() {
    const front = $("n-front").files[0], back = $("n-back").files[0], extra = $("n-extra").files[0];
    const files = [front, back, extra].filter(Boolean);
    const msg = $("novo-msg");
    if (!front) { msg.textContent = "Dodajte fotografiju prednje etikete."; return; }
    if (!$("n-bottle").value.trim() && !$("n-glass").value.trim()) { msg.textContent = MSG.no_price; return; }
    if (!back && !confirm("Bez stražnje etikete Claude vjerojatno neće znati alkohol i pitat će vas. Poslati ipak?")) return;
    $("n-send").disabled = true;
    msg.textContent = "Pripremam fotografije…";
    try {
      const fd = new FormData();
      for (const f of files) fd.append("photo", await shrink(f), "label.jpg");
      fd.append("price_bottle", $("n-bottle").value);
      fd.append("price_glass", $("n-glass").value);
      fd.append("vol", $("n-vol").value);
      if ($("n-rec").checked) fd.append("recommended", "1");
      fd.append("remark", $("n-remark").value);
      msg.textContent = "Šaljem…";
      await api("", { method: "POST", body: fd });
      await loadRequests();
      $("novo-msg").textContent = "Poslano. Claude počinje za koju minutu.";
    } catch (e) { msg.textContent = "Nije poslano: " + e.message; }
    finally { const b = $("n-send"); if (b) b.disabled = false; }
  }

  async function act(action, id) {
    const box = $("req-" + id);
    try {
      if (action === "ponisti") { delete pending[id]; renderNovo(); return; }
      if (action === "novo") {
        const it = items.find((x) => x.id === id);
        const on = !novoState(it, it.result || {});
        await api(`/${id}/ispravak`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ novo: on }) });
        await loadRequests();
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
        for (const f of [...(box.querySelector("[data-more]").files || [])].slice(0, 3)) fd.append("photo", await shrink(f), "label.jpg");
        await api(`/${id}/odgovor`, { method: "POST", body: fd });
      } else {
        if (action === "objavi" && !confirm("Objaviti ovo vino na karti? Gosti ga vide za minutu.")) return;
        if (action === "odustani" && !confirm("Odustati od ovog vina?")) return;
        await api(`/${id}/${action}`, { method: "POST" });
      }
      await loadRequests();
    } catch (e) { alert(e.message); }
  }

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
      /* Only wines that came onto the list or went off it (owner, 2026-10-10):
         prices, NOVO flips and corrections stay in GitHub's own history. */
      const kind = (m) => (/^Nema|^Nema na/.test(m) ? "makn" : /^Vraćeno/.test(m) ? "vrac" : /joins NOVO|joins the list|joins|^Novo vino/i.test(m) ? "novo" : null);
      const label = { novo: "Dodano", makn: "Skinuto", vrac: "Vraćeno" };
      box.innerHTML = rows.filter((c) => kind(c.commit.message.split("\n")[0])).map((c) => {
        const m = c.commit.message.split("\n")[0], k = kind(m);
        const d = new Date(c.commit.author.date).toLocaleString("hr-HR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
        const what = m.replace(/^(Nema na čašu|Nema na bocu|Nema|Vraćeno na kartu):\s*/, "").replace(/\s+joins NOVO.*$/, "");
        return `<div class="hist h-${k}"><span class="when">${esc(d)}</span><span class="badge">${label[k]}${/čašu/.test(m) ? " (čaša)" : /bocu/.test(m) ? " (boca)" : ""}</span><span class="what">${esc(what)}</span></div>`;
      }).join("") || `<p class="muted">Nema zapisa.</p>`;
    } catch (e) { box.innerHTML = `<p class="err">Ne mogu učitati povijest: ${esc(e.message)}</p>`; }
  }
})();
