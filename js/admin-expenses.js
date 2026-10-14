/* Troškovi — where Filho's money goes (owner, 2026-10-11).
 *
 * He photographs a receipt (camera or gallery, like Dodaj vino); a private
 * run reads every line and files it under a restaurant category; this tab
 * answers the three questions a chef-owner actually has:
 *
 *   Pregled  how much this month, against last month; which categories and
 *            which suppliers take it; how the last six months moved.
 *   Računi   every receipt, its lines, and the category of each — which he
 *            can correct with one tap.
 *   Cijene   the same product bought again at a different price: where the
 *            money quietly leaks.
 *
 * Confidential: receipts never touch the public repo. Photos and results live
 * on theatrium.devinos.hr behind the same GitHub key as the rest of /admin
 * (web/EXPENSES.md). */
(function () {
  const API = window.EXPENSE_API || "https://theatrium.devinos.hr/api/troskovi";
  const LS_GH = "theatrium-admin-token";
  const POLL_MS = 10000;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const ghKey = () => localStorage.getItem(LS_GH) || "";
  const who = () => (window.adminWho && window.adminWho()) || "";

  /* ---------- vocabulary ---------- */
  const CAT = {
    meso: "Meso", riba: "Riba i plodovi mora", povrce: "Voće i povrće", mlijecno: "Mliječno i jaja",
    suha: "Suha roba", pekara: "Pekara", vino: "Vino", zestoko: "Žestoka pića", pivo_sokovi: "Pivo, sokovi, voda",
    kava: "Kava i čaj", ciscenje: "Čišćenje i higijena", ambalaza: "Ambalaža i potrošno", oprema: "Oprema i inventar",
    odrzavanje: "Održavanje", rezije: "Režije i najam", usluge: "Usluge", dekor: "Cvijeće i dekor", place: "Plaće", ostalo: "Ostalo",
  };
  /* Six groups a chef thinks in; categories inside them on a tap. */
  const GROUPS = [
    ["hrana", "Hrana", ["meso", "riba", "povrce", "mlijecno", "suha", "pekara"], "#c9a961"],
    ["pice", "Piće", ["vino", "zestoko", "pivo_sokovi", "kava"], "#a5544a"],
    ["potrosno", "Potrošno", ["ciscenje", "ambalaza", "dekor"], "#6f8f9a"],
    ["oprema", "Oprema i održavanje", ["oprema", "odrzavanje"], "#8a7bb0"],
    ["rezije", "Režije i usluge", ["rezije", "usluge"], "#6c9a6f"],
    /* salaries (owner, 2026-10-13): their own group, so a month's food and
       drink are not read against a payroll that dwarfs them */
    ["place", "Plaće", ["place"], "#b07a5a"],
    ["ostalo", "Ostalo", ["ostalo"], "#7d776b"],
  ];
  const OSTALO = GROUPS.find((g) => g[0] === "ostalo");
  const groupOf = (c) => (GROUPS.find((g) => g[2].includes(c)) || OSTALO);
  const MONTHS = ["siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj", "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac"];
  const MONTHS_GEN = ["siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja", "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca"];
  const MONTHS_LOC = ["siječnju", "veljači", "ožujku", "travnju", "svibnju", "lipnju", "srpnju", "kolovozu", "rujnu", "listopadu", "studenome", "prosincu"];
  const eur = (n) => (n == null ? "—" : new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " €");
  const eur0 = (n) => new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " €";
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  /* Croatian: 1 stavka, 2–4 stavke, 5+ stavki (and 21 stavka, 22 stavke …) */
  const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);
  const dateOf = (r) => r.doc_date || (r.created_at || "").slice(0, 10);
  /* A supplier as a person says it (owner, 2026-10-12: "pretty but clean"):
     "SELECTA ADRIA d.o.o. za trgovinu" → Selecta Adria, "HEP-OPSKRBA D.O.O."
     → HEP-Opskrba. The legal form and whatever follows it go; a word in
     capitals gets ordinary ones unless it is short enough to be an acronym
     (HEP, CWS, PPD). The full name stays on the opened receipt. */
  const LEGAL = /[\s,]+(j\.?\s?d\.?\s?o\.?\s?o\.?|d\.?\s?o\.?\s?o\.?|d\.\s?d\.?|j\.?\s?t\.?\s?d\.?|društvo s ograničenom|obrt\b)(?=[\s,.]|$).*$/i;
  const SMALL_WORDS = new Set(["i", "u", "za", "na", "od", "s"]);
  /* short words, not acronyms: MOJ MESAR is Moj Mesar, HEP stays HEP */
  const SHORT_WORDS = new Set(["moj", "dan", "naš", "vaš", "tvoj", "dom", "sve", "pod", "kod", "put", "bio", "eko", "top", "vin", "riba", "mar"]);
  function shortName(v) {
    const cut = String(v || "").replace(LEGAL, "").trim();
    const name = cut || String(v || "").trim();
    return name.split(/(\s+|-)/).map((w, i) => {
      if (!/\p{Lu}/u.test(w) || w !== w.toLocaleUpperCase("hr")) return w;   /* not all capitals: as written */
      const low = w.toLocaleLowerCase("hr");
      if (i > 0 && SMALL_WORDS.has(low)) return low;
      if (w.length <= 3 && !SHORT_WORDS.has(low)) return w;                         /* an acronym */
      return low[0].toLocaleUpperCase("hr") + low.slice(1);
    }).join("");
  }
  const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
  const monthOf = (r) => dateOf(r).slice(0, 7);
  const hrDate = (d) => (d ? `${Number(d.slice(8, 10))}. ${Number(d.slice(5, 7))}.` : "");

  /* ---------- state ---------- */
  let opened = false;
  let receipts = [], limits = null, sub = "pregled", month = "", open = null, timer = null, err = "";
  let openGroup = null, catPick = null, confirmDel = null;
  let kind = "";                /* Računi shows one kind of receipt, or all */
  let unpaidOnly = false, showDup = false, query = "";
  const groupView = {};         /* picker scope → a group opened but not yet chosen from */
  const picked = [];            /* photos chosen, not yet sent */
  let oneReceipt = false, sending = "";
  /* an expense with no receipt being typed in, or one being corrected:
     {editId, vendor, date, payment, lines: [{name, total, category, picked}]} */
  let manual = null, saving = false;
  let mer = null;                       /* moj-eRačun: how the connection stands */
  const thumbs = new Map();
  const pdfThumbs = new Set();          /* receipt|n whose file is a PDF */

  async function api(path, opts = {}) {
    const r = await fetch(API + path, { ...opts, headers: { authorization: "Bearer " + ghKey(), ...(opts.headers || {}) } });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error || "HTTP " + r.status);
    return b;
  }

  /* In pages: a whole year in one answer ran the server over its CPU limit
     (2026-10-12). And fast (2026-10-13: "it takes 5 seconds when I click
     Troškovi"): the newest FIRST receipts are shown as soon as they arrive,
     the rest are asked for all at once, not one page after another. While
     receipts are being read, the 10-second refresh asks only for the newest
     page and merges it in. */
  const FIRST = 60, PAGE = 150;
  let olderLoading = false, polls = 0;
  async function load(quick) {
    clearTimeout(timer);
    try {
      const b = await api(`?limit=${FIRST}`);
      const head = b.items || [];
      limits = b.limits; mer = b.mer || null; err = "";
      if (quick === true && receipts.length) {
        const ids = new Set(head.map((r) => r.id));
        receipts = head.concat(receipts.filter((r) => !ids.has(r.id)));
      } else {
        receipts = head;
        if (b.more) {
          olderLoading = true; settle(); render();
          let all = head;
          if (b.total) {
            const offs = [];
            for (let o = head.length; o < Math.min(b.total, 6000); o += PAGE) offs.push(o);
            const pages = await Promise.all(offs.map((o) => api(`?offset=${o}&limit=${PAGE}`)));
            all = head.concat(...pages.map((p) => p.items || []));
          } else {
            /* a server without a total: the rest one page at a time */
            for (let more = true; more && all.length < 6000;) {
              const n = await api(`?offset=${all.length}&limit=${PAGE}`);
              all = all.concat(n.items || []); more = n.more;
            }
          }
          receipts = all;
        }
        loadedAt = Date.now();
      }
    } catch (e) { err = "Ne mogu učitati troškove: " + e.message; }
    olderLoading = false;
    settle();
    render();
    /* every sixth refresh is a full one: a receipt being read can be an old
       one (a backfill), which the newest page does not carry */
    if (visible() && receipts.some((r) => r.status === "queued" || r.status === "working")) {
      polls += 1;
      timer = setTimeout(() => load(polls % 6 !== 0), POLL_MS);
    }
  }
  function settle() {
    if (!month) month = latestMonth();
    /* until the first receipt is read, the tab opens where receipts are added */
    if (!opened) { opened = true; if (!receipts.some((r) => r.status === "done")) sub = "racuni"; }
  }
  const visible = () => { const t = $("tab-troskovi"); return t && !t.classList.contains("hidden"); };
  const latestMonth = () => new Date().toISOString().slice(0, 7);
  /* coming back to the tab: what is already here is shown at once and freshened
     with the newest page; a full reload only when it is over 5 minutes old */
  let loadedAt = 0;
  window.loadExpenses = () => {
    if (receipts.length && Date.now() - loadedAt < 5 * 60000) { render(); return load(true); }
    return load();
  };

  /* ---------- numbers ---------- */
  /* a photo of an invoice that also came from MER counts once, as the e-invoice */
  const done = () => receipts.filter((r) => r.status === "done" && !r.dup_of);
  const inMonth = (m) => done().filter((r) => monthOf(r) === m);
  const totalOf = (r) => (r.total != null ? r.total : r.items.reduce((s, i) => s + (i.total || 0), 0));
  /* Category amounts from the lines; whatever the lines do not explain
     (a receipt read without lines, rounding) shows as "nerazvrstano". */
  function byCategory(list) {
    const cats = {};
    let rest = 0;
    for (const r of list) {
      const lines = r.items.reduce((s, i) => s + (i.total || 0), 0);
      for (const i of r.items) cats[i.category] = (cats[i.category] || 0) + (i.total || 0);
      const gap = totalOf(r) - lines;
      if (Math.abs(gap) > 0.05) rest += gap;
    }
    return { cats, rest };
  }
  /* ---------- paid or not (owner, 2026-10-12) ----------
     Every receipt carries one pill, PLAĆENO or NEPLAĆENO, and a tap flips it
     — like NOVO on the wine board ("simply click and toggle it"). No
     confirm: the next tap undoes it. Until he taps, a receipt paid by card or
     cash counts as paid and one "na virman" as not (paid_at: a date = paid,
     "ne" = not paid, empty = by the way it was paid). */
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const isPaid = (r) => (r.paid_at === "ne" ? false : r.paid_at ? true : r.payment !== "virman");
  const daysTo = (d) => Math.round((Date.parse(d) - Date.parse(todayIso())) / 86400000);
  const isLate = (r) => !!r.due_date && daysTo(r.due_date) < 0;
  function dueText(r) {
    if (!r.due_date) return `račun od ${hrDate(dateOf(r))}`;
    const n = daysTo(r.due_date);
    return n < 0 ? `kasni ${-n} ${plural(-n, "dan", "dana", "dana")}` : n === 0 ? "dospijeva danas"
      : n === 1 ? "dospijeva sutra" : `dospijeva ${hrDate(r.due_date)}`;
  }
  /* The pill on the receipt is the only place it is changed (Filho,
     2026-10-12: "samo po mjesecima … bez ove gornje za neplaćene posebno") —
     the separate Za platiti list above the receipts is gone. */
  async function markPaid(id, paid) {
    const r = receipts.find((x) => x.id === id);
    if (!r) return;
    const before = r.paid_at;
    r.paid_at = paid ? todayIso() : "ne";
    render();
    try { await api(`/${id}/placeno`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paid, by: who() }) }); }
    catch (e) { r.paid_at = before; err = "Nije spremljeno: " + e.message; render(); }
  }
  function payPill(r) {
    const paid = isPaid(r), late = !paid && isLate(r);
    return `<button class="paypill ${paid ? "on" : late ? "late" : ""}" data-togglepaid="${esc(r.id)}" aria-pressed="${paid}"
      aria-label="${paid ? "Plaćeno — dodirnite za neplaćeno" : "Neplaćeno — dodirnite za plaćeno"}">${paid ? "PLAĆENO" : late ? "KASNI" : "NEPLAĆENO"}</button>`;
  }

  /* ---------- what kind of receipt (Filho, 2026-10-12: "bilo bi dobro ako
     bi moglo i račune razvrstavat — kao hrana, piće, potrošno, režije") ----------
     A receipt is the group most of its money went to, from its own lines, so
     correcting a line's category moves the receipt with it. One that is not
     read yet has no kind and shows only under Sve. */
  function kindOf(r) {
    if (r.status !== "done" || !r.items.length) return "";
    const by = {};
    for (const i of r.items) { const g = groupOf(i.category)[0]; by[g] = (by[g] || 0) + Math.abs(i.total || 0); }
    return Object.entries(by).sort((a, b) => b[1] - a[1])[0][0];
  }
  /* unpaid is a filter on the same row, never a list of its own (Filho:
     "bez ove gornje za neplaćene posebno") */
  const unpaid = (r) => r.status === "done" && !r.dup_of && !isPaid(r) && totalOf(r) > 0;
  function kindChips(list) {
    const counts = {};
    for (const r of list) { const k = !r.dup_of && kindOf(r); if (k) counts[k] = (counts[k] || 0) + 1; }
    const shown = GROUPS.filter(([k]) => counts[k] || k === kind);
    const owed = list.filter(unpaid).length;
    if (shown.length < 2 && !kind && !owed && !unpaidOnly) return "";
    return `<div class="kinds" role="group" aria-label="Vrsta računa">
      <button data-kind="" class="${kind ? "" : "on"}" aria-pressed="${!kind}">Sve</button>
      ${shown.map(([k, label, , color]) => `<button data-kind="${k}" class="${kind === k ? "on" : ""}" aria-pressed="${kind === k}"
        style="--c:${color}">${esc(label)}<small>${counts[k] || 0}</small></button>`).join("")}
      ${owed || unpaidOnly ? `<button data-unpaid class="unp${unpaidOnly ? " on" : ""}" aria-pressed="${unpaidOnly}">Neplaćeno<small>${owed}</small></button>` : ""}</div>`;
  }

  const shiftMonth = (m, d) => {
    const [y, mo] = m.split("-").map(Number);
    const t = new Date(Date.UTC(y, mo - 1 + d, 1));
    return t.toISOString().slice(0, 7);
  };
  const monthName = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

  /* ---------- render ---------- */
  function render() {
    const box = $("tab-troskovi");
    if (!box) return;
    const waiting = receipts.filter((r) => r.status === "queued" || r.status === "working").length;
    box.innerHTML = `
      <div class="seg3" role="group" aria-label="Troškovi">
        ${[["pregled", "Pregled"], ["prihodi", "Prihodi"], ["racuni", "Računi"], ["cijene", "Cijene"], ["pdv", "PDV"]].map(([k, l]) =>
          `<button data-sub="${k}" class="${sub === k ? "on" : ""}" aria-pressed="${sub === k}">${l}</button>`).join("")}
      </div>
      ${err ? `<p class="err">${esc(err)}</p>` : ""}
      ${waiting ? `<p class="muted small center"><span class="spin"></span> ${waiting} ${waiting === 1 ? "račun se čita" : "računa se čita"} — obično minuta-dvije.</p>` : ""}
      ${olderLoading ? `<p class="muted small center"><span class="spin"></span> učitavam starije račune…</p>` : ""}
      ${sub === "pregled" ? overview() : sub === "prihodi" ? incomeView() : sub === "racuni" ? receiptsView() : sub === "pdv" ? vatView() : pricesView()}`;
    wire(box);
  }

  function monthNav() {
    const now = new Date().toISOString().slice(0, 7);
    return `<div class="mnav"><button data-m="-1" aria-label="Prethodni mjesec">‹</button>
      <b>${esc(monthName(month))}</b>
      <button data-m="1" aria-label="Sljedeći mjesec" ${month >= now ? "disabled" : ""}>›</button></div>`;
  }

  /* ---------- Prihodi (owner, 2026-10-13: "the counterpart of Kamo idu
     novci … income and expenses at the same admin place") ----------
     Every bill the till issued, read from Remaris every morning at 6:00 by
     the private repo's run (theatrium-troskovi/remaris/sync.py); nobody
     uploads anything. The server sums a month; this only draws it. */
  const INCOME_API = API.replace(/\/troskovi$/, "/prihodi");
  const income = {};            /* month → summary, or "loading" */
  let incomeErr = "", allCusts = false;   /* 30 companies a month: the top 8 until asked */
  function needIncome(m) {
    if (income[m]) return income[m] === "loading" ? null : income[m];
    income[m] = "loading";
    fetch(`${INCOME_API}?mjesec=${m}`, { headers: { authorization: "Bearer " + ghKey() } })
      .then((r) => r.json().then((b) => { if (!r.ok) throw new Error(b.error || "HTTP " + r.status); return b; }))
      .then((b) => { income[m] = b; incomeErr = ""; render(); })
      .catch((e) => { delete income[m]; incomeErr = "Ne mogu učitati prihode: " + e.message; render(); });
    return null;
  }
  const incTotal = (s) => (s && s.days ? s.days.reduce((a, d) => a + d.total, 0) : 0);
  /* izlazni PDV by rate, per the lines' tax group. Only food's label carries
     its rate ("H (HRANA IZLAZ 13%)"); drinks read "P (PIĆE IZLAZ)", so a
     label without one takes it from its own sums, total ÷ net. */
  function outVat(s) {
    const rates = {};
    let total = 0;
    for (const t of (s && s.taxes) || []) {
      const v = (t.total || 0) - (t.net || 0), m = String(t.tax || "").match(/(\d+(?:[.,]\d+)?)\s*%/);
      const k = m ? m[1].replace(",", ".") : t.net > 0 ? String(Math.round(((t.total / t.net) - 1) * 100)) : "?";
      rates[k] = (rates[k] || 0) + v; total += v;
    }
    return { total, rates };
  }
  /* Filho's rubrike (2026-10-14: "Vino, Žestoko, Hrana"). A till line is
     food by its tax group (H, 13%); a drink is wine when its sales group says
     so, alcoholic (P) otherwise žestoko, and non-alcoholic (N) the rest. The
     receipts side is the matching expense categories. */
  const RUBRICS = [
    ["hrana", "Hrana", ["meso", "riba", "povrce", "mlijecno", "suha", "pekara"]],
    ["vino", "Vino", ["vino"]],
    ["zestoko", "Žestoko", ["zestoko"]],
    ["ostalo", "Kava, sokovi, voda", ["pivo_sokovi", "kava"]],
  ];
  function rubricOf(grp, tax) {
    const g = String(grp || ""), t = String(tax || "");
    if (/^H\b|HRAN/i.test(t)) return "hrana";
    if (/vin|šampanj|sampanj|pjenu|champ|prosecc/i.test(g)) return "vino";
    if (/^N\b|NAPIT/i.test(t) || /kav|sok|vod/i.test(g)) return "ostalo";
    if (/^P\b|PIĆ|PIC/i.test(t) || /rakij|grapp|whisk|rum|gin|vodk|cognac|koktel|liker|pivo/i.test(g)) return "zestoko";
    return "hrana";
  }
  function salesByRubric(s) {
    const by = {};
    for (const r of (s && s.groups) || []) {
      const k = rubricOf(r.grp, r.tax), b = by[k] || (by[k] = { total: 0, net: 0, groups: {} });
      b.total += r.total || 0; b.net += r.net != null ? r.net : (r.total || 0);
      b.groups[r.grp || "—"] = (b.groups[r.grp || "—"] || 0) + (r.total || 0);
    }
    return by;
  }
  let openRub = null;
  function incomeView() {
    const s = needIncome(month), prev = needIncome(shiftMonth(month, -1));
    if (!s) return `${monthNav()}${incomeErr ? `<p class="err">${esc(incomeErr)}</p>` : `<p class="muted center"><span class="spin"></span> učitavam prihode…</p>`}`;
    const total = incTotal(s), n = s.days.reduce((a, d) => a + d.n, 0);
    const state = s.state || {}, fail = (() => { try { return state.error ? JSON.parse(state.error) : null; } catch { return null; } })();
    const footer = `<p class="muted small">Iz Remarisa, svako jutro u 6:00, sami.${state.last_ok
        ? ` Zadnje čitanje: ${hrDate(state.last_ok.slice(0, 10))} u ${new Date(state.last_ok).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}.` : ""}</p>
      ${fail && fail.msg ? `<p class="err">Zadnje čitanje Remarisa nije uspjelo (${hrDate(fail.at.slice(0, 10))}): ${esc(fail.msg)}</p>` : ""}`;
    const twelve = [...Array(12)].map((_, i) => shiftMonth(month, i - 11));
    const byM = Object.fromEntries((s.months || []).map((x) => [x.m, x.total]));
    const mmax = Math.max(...twelve.map((m) => byM[m] || 0), 1);
    const months12 = `<h3 class="h">Zadnjih 12 mjeseci</h3>
      <div class="cols c12">${twelve.map((m) => `<button data-month="${m}" class="${m === month ? "on" : ""}">
        <span class="cv">${byM[m] ? Math.round(byM[m] / 1000) + "k" : ""}</span>
        <span class="cb"><span style="height:${Math.max(byM[m] ? 3 : 0, ((byM[m] || 0) / mmax) * 100)}%"></span></span>
        <span class="cl">${MONTHS[Number(m.slice(5, 7)) - 1].slice(0, 3)}</span></button>`).join("")}</div>`;
    if (!n) return `${monthNav()}<p class="muted center">U ${MONTHS_LOC[Number(month.slice(5, 7)) - 1]} nema računa iz Remarisa.</p>${months12}${footer}`;
    /* a running month against the same days of the last one, as Pregled does */
    const running = month === new Date().toISOString().slice(0, 7), upTo = new Date().getDate();
    const pm = shiftMonth(month, -1);
    const prevSame = prev ? prev.days.filter((d) => !running || Number(d.day.slice(8, 10)) <= upTo).reduce((a, d) => a + d.total, 0) : 0;
    const p = pct(total, prevSame);
    const cmp = prevSame ? `<span class="${p >= 0 ? "down" : "up"}">${p >= 0 ? "▲" : "▼"} ${Math.abs(p)}%</span> ${running
        ? `u odnosu na 1.–${upTo}. ${MONTHS_GEN[Number(pm.slice(5, 7)) - 1]} (${eur0(prevSame)})` : `u odnosu na ${MONTHS[Number(pm.slice(5, 7)) - 1]} (${eur0(prevSame)})`}` : "";
    /* the same month last year, the same days of it while this one runs
       (2025 arrives a month a morning from 2026-10-14) */
    const ly = needIncome(shiftMonth(month, -12));
    const lySame = ly ? ly.days.filter((d) => !running || Number(d.day.slice(8, 10)) <= upTo).reduce((a, d) => a + d.total, 0) : 0;
    const py = lySame ? pct(total, lySame) : null;
    const cmpY = lySame ? `<span class="${py >= 0 ? "down" : "up"}">${py >= 0 ? "▲" : "▼"} ${Math.abs(py)}%</span> u odnosu na ${MONTHS[Number(month.slice(5, 7)) - 1]} ${Number(month.slice(0, 4)) - 1}. (${eur0(lySame)})` : "";
    const workDays = s.days.filter((d) => d.total > 0).length;
    const dmax = Math.max(...s.days.map((d) => d.total), 1);
    const custs = (s.custs || []).filter((c) => Math.abs(c.total) > 0.004);
    const g = guestSum(s.guests), gp = guestSum(prev && prev.guests);
    const gch = g.guests && gp.guests ? pct(g.total / g.guests, gp.total / gp.guests) : null;
    return `${monthNav()}
      <div class="big"><b>${eur0(total)}</b>
        <span class="muted small">${n} ${plural(n, "račun", "računa", "računa")} · ${workDays} ${plural(workDays, "radni dan", "radna dana", "radnih dana")}</span>
        <span class="muted small">prosječni račun ${eur0(total / Math.max(1, n))} · prosječno ${eur0(total / Math.max(1, workDays))} po danu</span>
        ${g.guests > 0 ? `<span class="small">po gostu <b>${eur0(g.total / g.guests)}</b> · ${nf(g.guests)} ${plural(Math.round(g.guests), "gost", "gosta", "gostiju")} po couvertu${gch != null ? ` <span class="${gch >= 0 ? "down" : "up"}">${gch >= 0 ? "▲" : "▼"} ${Math.abs(gch)}%</span>` : ""}</span>
        <span class="muted small">računi bez couverta (šank, kava, vaš stol): ${g.other_n}, ${eur0(g.other)} — nisu u potrošnji po gostu</span>` : ""}
        ${cmp ? `<span class="small">${cmp}</span>` : ""}
        ${cmpY ? `<span class="small">${cmpY}</span>` : ""}</div>
      <h3 class="h">Po danima</h3>
      <div class="days">${s.days.map((d) => `<span title="${hrDate(d.day)} · ${eur0(d.total)} · ${d.n} ${plural(d.n, "račun", "računa", "računa")}">
        <span style="height:${Math.max(2, (d.total / dmax) * 100)}%"></span><small>${Number(d.day.slice(8, 10))}</small></span>`).join("")}</div>
      <h3 class="h">Što se prodaje</h3>
      <div class="bars">${rubBars(s, total)}</div>
      ${salesDetail(s, prev)}
      ${custs.length ? `<h3 class="h">Tvrtke <small>računi izdani na tvrtku</small></h3>
      <div class="lines">${(allCusts ? custs : custs.slice(0, 8)).map((c) => `<div><span>${esc(shortName(c.cust))}<small>${c.n} ${plural(c.n, "račun", "računa", "računa")}${c.virman ? ` · na virman ${eur(c.virman)}` : ""}</small></span><b>${eur(c.total)}</b></div>`).join("")}</div>
      ${custs.length > 8 ? `<button class="nema" data-allcusts>${allCusts ? "Manje" : `Sve tvrtke (${custs.length})`}</button>` : ""}` : ""}
      ${months12}${footer}`;
  }
  /* ---------- Vinska karta i blagajna (owner, 2026-10-14) ----------
     Which wines on the list actually sell, by the bottle and by the glass,
     and which have not sold for three months — money standing on a shelf.

     The till names wines its own way ("BENVENUTI, MALVAZIJA 0,1L", "AMARONE
     2015, Dal Forno", "Hubert LAMY ST-AUBIN, LES FRI"), so every till article
     is mapped to a list wine ONCE, by hand, in data/till-map.json (owner,
     2026-10-14: "I need clarity on this topic and precise 1:1 mapping"):
       {ref, vol}        the wine and the size the article pours (0.1 = glass)
       {ref, vol, ask}   a suggestion waiting for Filho — not counted
       {none, why}       sold, but not a wine on the list ("nije na karti")
                         or not wine at all ("nije vino": a gin tonik rung
                         under a wine group)
     Only {ref, vol} counts. A till name the map has never seen — a new wine,
     a new vintage, a renamed article — lands in "Za povezati" with the strict
     matcher's guess as a suggestion, and one tap writes it into the map
     through the GitHub contents API, as the 86 board writes its file. So
     every Remaris pull is read against what was already agreed, and only
     what is genuinely new is asked. */
  const TILL_PATH = "data/till-map.json", GH_REPO = "jsiljeg/list", GH_BRANCH = "main";
  const TILL_STOP = new Set("de du la le les di del della e et und and the vino vina vinarija vinogradi podrum domaine dom chateau ch az agr azienda agricola weingut cantina tenuta estate winery cellars bodega bodegas maison famille fattoria podere opg srl doo 1er cru grand l".split(" "));
  const tfold = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
  /* "0,75L", "0.75", "0,1", "0,05L" are the size, not the name */
  const tillKey = (v) => tfold(v).replace(/\b\d+[.,]\d+\s*l?\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  const ttoks = (v) => tillKey(v).split(" ").filter((x) => x.length > 1 && !TILL_STOP.has(x) && !/^(19|20)\d{2}$/.test(x));
  const tyear = (v) => Number((String(v).match(/\b(19|20)\d{2}\b/) || [])[0] || 0);
  /* the size a till name says; a name with none is a 0,75 bottle — the few
     glass articles that print no size were set by hand in the map */
  function tillVol(name) {
    const n = String(name).toLowerCase().replace(/\s+/g, "");
    if (/0[,.]05/.test(n)) return 0.05;
    if (/0[,.]375/.test(n)) return 0.375;
    if (/0[,.]5(?!\d)/.test(n)) return 0.5;
    if (/0[,.]1/.test(n)) return 0.1;
    if (/1[,.]5|magnum/.test(n)) return 1.5;
    if (/(^|[^\d,.])3l/.test(n)) return 3;
    return 0.75;
  }
  /* the Remaris group an article belongs in, from the wine itself: by the
     glass is "Vina na čaše" whatever the colour; a bottle goes by style and
     by the till's country pairs */
  const TILL_REG = { HR: "HR/SLO", SI: "HR/SLO", DE: "DE/AUT", AT: "DE/AUT", FR: "FRA", IT: "ITA/ES", ES: "ITA/ES", US: "USA" };
  function tillGroup(w, vol) {
    if (vol <= 0.15) return "Vina na čaše";
    const st = w.style || "";
    if (st.startsWith("champagne")) return "Šampanjci";
    if (st.startsWith("sparkling")) return "Pjenušci";
    if (st === "sweet") return "Desertna vina";
    return `${st.startsWith("red") ? "Crvena" : "Bijela"} vina ${TILL_REG[w.country] || ""}`.trim();
  }
  let wineList = null, wineListLoading = false, openWineBox = "", listFrom = "";
  let tillMap = null, tillSha = "", tillMsg = "", tillBusy = "";
  const ghHead = () => ({ Authorization: `Bearer ${ghKey()}`, Accept: "application/vnd.github+json" });
  const utf8b64 = (s) => { const b = new TextEncoder().encode(s); let o = ""; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(o); };
  const b64utf8 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  /* read from GitHub, not the site: a confirmation made a minute ago must
     not come back as a question while the deploy runs */
  async function readTillMap() {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${TILL_PATH}?ref=${GH_BRANCH}&t=${Date.now()}`, { headers: ghHead(), cache: "no-store" });
    if (r.status === 404) { tillSha = ""; return { articles: {} }; }
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const j = await r.json();
    tillSha = j.sha;
    return JSON.parse(b64utf8(j.content));
  }
  function needWineList() {
    if (wineList || wineListLoading) return wineList;
    wineListLoading = true;
    /* list-since.json is written by the deploy from git history (scripts/
       list-since.mjs); unavailable.json is the 86 board. Both optional. */
    const opt = (u, d) => fetch(u, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : d)).catch(() => d);
    Promise.all([fetch("library/wines.json", { cache: "no-cache" }).then((r) => r.json()), fetch("lists/theatrium.json", { cache: "no-cache" }).then((r) => r.json()),
      opt("data/list-since.json", { since: {} }), opt("data/unavailable.json", { hidden: [] }),
      readTillMap().catch(() => opt(TILL_PATH, { articles: {} }))])
      .then(([lib, list, since, una, tm]) => {
        listFrom = since.from || "";
        tillMap = tm;
        const hidden = new Set((una.hidden || []).filter((h) => !h.where).map((h) => `${h.producer}|${h.name}`));
        const seen = new Map();
        (function walk(o) {
          if (Array.isArray(o)) return o.forEach(walk);
          if (!o || typeof o !== "object") return;
          if (o.ref && lib.wines[o.ref] && lib.wines[o.ref].insight && !lib.wines[o.ref].insight.kind) {   /* wines only: not spirits, not water */
            const w = lib.wines[o.ref], e = seen.get(o.ref) || { ref: o.ref, name: w.name, producer: w.producer, prices: [], style: w.insight.style, country: w.insight.country };
            if (o.price != null) e.prices.push(o.price);
            seen.set(o.ref, e);
          }
          Object.values(o).forEach(walk);
        })(list.sections || list);
        /* a mapped wine that has since left the list still has a name to show */
        const extra = Object.values(tm.articles || {}).filter((a) => a.ref && !seen.has(a.ref) && lib.wines[a.ref]).map((a) => {
          const w = lib.wines[a.ref]; return { ref: a.ref, name: w.name, producer: w.producer, prices: [], style: (w.insight || {}).style, country: (w.insight || {}).country, gone: true };
        });
        wineList = [...seen.values(), ...extra].map((w) => ({ ...w, p: ttoks(w.producer), n: ttoks(w.name), y: tyear(w.name),
          since: (since.since || {})[w.ref] || "", off: hidden.has(`${w.producer}|${w.name}`) }));
        render();
      })
      .catch(() => { wineList = []; tillMap = tillMap || { articles: {} }; })
      .finally(() => { wineListLoading = false; });
    return null;
  }
  /* The strict matcher only SUGGESTS now: the producer's words, and every
     other word of the till name must be in the wine's name; a vintage more
     than 3 years off is another wine; a tie is no suggestion. */
  function suggestTill(name) {
    const all = ttoks(name), y = tyear(name), c = [];
    /* the till cuts names short ("En Chaill", "Schiefer."): a word of 4+
       letters matches the start of the wine's word */
    const hit = (words, x) => words.some((w) => w === x || (x.length >= 4 && w.startsWith(x)));
    for (const w of wineList) {
      if (w.gone) continue;
      const pm = w.p.filter((x) => hit(all, x) || all.some((a) => a.length >= 4 && x.startsWith(a)));
      const rest = all.filter((x) => !hit(w.p, x)), nm = rest.filter((x) => hit(w.n, x));
      if (!pm.length && nm.length < 2) continue;
      if (rest.length && nm.length < rest.length) continue;              /* its every own word is the wine's */
      if (!rest.length && wineList.filter((o) => o.p.join() === w.p.join()).length > 1 && !(y && y === w.y)) continue;
      if (y && w.y && Math.abs(y - w.y) > 3) continue;
      c.push({ w, sc: pm.length * 2 + nm.length * 2 + (y && y === w.y ? 2 : 0) - (y && w.y ? Math.abs(y - w.y) : 0) });
    }
    c.sort((a, b) => b.sc - a.sc);
    return c.length && !(c[1] && c[1].sc === c[0].sc) ? c[0].w : null;
  }
  /* One article, one commit ("Blagajna: X → Y"). A 409 means another tablet
     or a commit from the office got there first: re-read and say so, never
     write over it (the 86 board's rule). */
  async function saveTill(name, entry) {
    tillBusy = name; tillMsg = ""; render();
    try {
      const doc = await readTillMap();
      doc.articles = doc.articles || {};
      doc.articles[name] = entry;
      doc.articles = Object.fromEntries(Object.keys(doc.articles).sort().map((k) => [k, doc.articles[k]]));
      const w = entry.ref && wineList.find((x) => x.ref === entry.ref);
      const what = entry.ref ? `${w ? `${w.producer} · ${w.name}` : entry.ref}${entry.vol <= 0.15 ? " (čaša)" : ""}` : entry.none;
      const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${TILL_PATH}`, {
        method: "PUT", headers: { ...ghHead(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Blagajna: ${name} → ${what}${who() ? ` — ${who()}` : ""}`, content: utf8b64(JSON.stringify(doc, null, 1) + "\n"), sha: tillSha || undefined, branch: GH_BRANCH }),
      });
      if (r.status === 409) { tillMap = await readTillMap(); throw new Error("netko je u međuvremenu mijenjao popis — osvježeno, ponovite"); }
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      tillSha = (await r.json()).content.sha;
      tillMap = doc;
      tillMsg = `Spremljeno: ${name} → ${what}`;
    } catch (e) { tillMsg = `Nije spremljeno: ${e.message}`; }
    tillBusy = ""; render();
  }
  /* three months to the shown one: what sold, what did not, what to map */
  function wineSales() {
    if (!needWineList() || !tillMap) return null;
    const ms = [0, -1, -2].map((d) => shiftMonth(month, d)), ss = ms.map(needIncome);
    if (ss.some((x) => !x)) return null;
    const arts = tillMap.articles || {}, byRef = new Map(wineList.map((w) => [w.ref, w]));
    const by = new Map(), lines = new Map();
    for (const s of ss) for (const it of s.items || []) {
      if (!isWine(it) || !(it.qty > 0)) continue;
      const l = lines.get(it.name) || { name: it.name, grp: it.grp, q: 0, t: 0 };
      l.q += it.qty; l.t += it.total; lines.set(it.name, l);
    }
    const ask = [], off = [], wrong = [];
    for (const l of lines.values()) {
      const a = arts[l.name];
      if (!a || a.ask) { ask.push({ ...l, a, sug: a && a.ask ? byRef.get(a.ref) : suggestTill(l.name) }); continue; }
      if (a.none) { off.push({ ...l, a }); if (a.none === "nije vino") wrong.push({ ...l, want: "izvan grupa vina" }); continue; }
      const w = byRef.get(a.ref);
      if (!w) { ask.push({ ...l, a: null, sug: null }); continue; }
      const e = by.get(w.ref) || { w, bottles: 0, glasses: 0, t: 0 };
      if (a.vol <= 0.15) e.glasses += l.q; else e.bottles += l.q * a.vol / 0.75;   /* a magnum counts two bottles */
      e.t += l.t; by.set(w.ref, e);
      const want = tillGroup(w, a.vol);
      if (l.grp !== want) wrong.push({ ...l, want });
    }
    const sold = [...by.values()].sort((a, b) => b.t - a.t);
    /* fair to the list (owner, 2026-10-14: "the wine list changed, so be
       reasonable"): unsold only if on the list the whole period and not 86'd
       now; a wine added since is "new", with what it sold so far. Cheapest
       first: a trophy bottle that sits is normal, an everyday one is not. */
    const start = `${ms[2]}-01`, price = (w) => (w.prices.length ? Math.min(...w.prices) : 0);
    /* the history starts 2026-07-31: a wine dated then was there before it */
    const isNew = (w) => !!w.since && w.since > start && w.since !== listFrom;
    const live = wineList.filter((w) => !w.gone && !w.off);
    const still = live.filter((w) => !by.has(w.ref) && !isNew(w)).sort((a, b) => price(a) - price(b));
    const fresh = live.filter((w) => isNew(w)).map((w) => ({ w, e: by.get(w.ref) })).sort((a, b) => (b.e ? b.e.t : 0) - (a.e ? a.e.t : 0));
    const sum = (xs) => xs.reduce((a, x) => a + x.t, 0);
    ask.sort((a, b) => b.t - a.t); off.sort((a, b) => b.t - a.t); wrong.sort((a, b) => b.t - a.t);
    const matched = sum(sold);
    return { ms, sold, still, fresh, ask, off, wrong, matched, total: matched + sum(ask) + sum(off) };
  }
  function wineBox() {
    const x = wineSales();
    if (!x) return wineList === null || wineListLoading ? `<p class="muted small"><span class="spin"></span> povezujem vinsku kartu s blagajnom…</p>` : "";
    const span = `${MONTHS[Number(x.ms[2].slice(5, 7)) - 1]}–${MONTHS[Number(x.ms[0].slice(5, 7)) - 1]}`;
    const qty = (e) => [e.bottles ? `${nf(e.bottles)} ${plural(Math.round(e.bottles), "boca", "boce", "boca")}` : "", e.glasses ? `${nf(e.glasses)} ${plural(Math.round(e.glasses), "čaša", "čaše", "čaša")}` : ""].filter(Boolean).join(" · ");
    const box = (k, title, rows) => `<button class="nema wide-left" data-winebox="${k}" aria-expanded="${openWineBox === k}">${title}</button>
      ${openWineBox === k ? `<div class="lines">${rows}</div>` : ""}`;
    const sum = (xs) => eur0(xs.reduce((a, u) => a + u.t, 0));
    const size = (v) => (v <= 0.15 ? "čaša" : v === 0.75 ? "boca" : `${String(v).replace(".", ",")} l`);
    const opts = wineList.filter((w) => !w.gone).slice().sort((a, b) => `${a.producer} ${a.name}`.localeCompare(`${b.producer} ${b.name}`, "hr"))
      .map((w) => `<option value="${esc(w.ref)}">${esc(w.producer)} · ${esc(w.name)}</option>`).join("");
    const askRow = (u) => {
      const v = u.a && u.a.vol ? u.a.vol : tillVol(u.name), busy = tillBusy === u.name;
      return `<div class="tillask"><span>${esc(u.name)}<small>${u.grp ? `${esc(u.grp)} · ` : ""}${nf(u.q)} kom</small>
          ${u.a && u.a.ask ? `<small class="q">${esc(u.a.ask)}</small>` : ""}
          ${u.sug ? `<button class="pill" data-tillok="${esc(u.name)}" data-ref="${esc(u.sug.ref)}" data-vol="${v}" ${busy ? "disabled" : ""}>✓ ${esc(u.sug.producer)} · ${esc(u.sug.name)} · ${size(v)}</button>` : ""}
          <select data-tillpick="${esc(u.name)}" data-vol="${v}" ${busy ? "disabled" : ""}><option value="">${u.sug ? "drugo vino…" : "koje je to vino?"}</option>${opts}</select>
          <p class="row"><button class="pill" data-tillnone="${esc(u.name)}" data-none="nije na karti" ${busy ? "disabled" : ""}>nije na karti</button>
          <button class="pill" data-tillnone="${esc(u.name)}" data-none="nije vino" ${busy ? "disabled" : ""}>nije vino</button></p>
        </span><b>${eur0(u.t)}</b></div>`;
    };
    return `<h3 class="h">Vinska karta i blagajna <small>${span}</small></h3>
      <div class="lines">${x.sold.slice(0, 10).map((e) => `<div><span>${esc(e.w.producer)} · ${esc(e.w.name)}<small>${qty(e)}</small></span><b>${eur0(e.t)}</b></div>`).join("")}</div>
      ${tillMsg ? `<p class="small ${/^Nije/.test(tillMsg) ? "err" : "muted"}">${esc(tillMsg)}</p>` : ""}
      ${x.ask.length ? box("ask", `Za povezati: ${x.ask.length} (${sum(x.ask)}) — ne broji se dok se ne potvrdi`,
        `<p class="muted small">Artikli iz blagajne koje karta još ne zna. Jednom potvrđeno, vrijedi za svako sljedeće čitanje Remarisa.</p>` + x.ask.map(askRow).join("")) : ""}
      ${box("still", `Cijelo razdoblje na karti, a nije se prodalo: ${x.still.length} ${plural(x.still.length, "vino", "vina", "vina")}`,
        `<p class="muted small">Najjeftinija prva: skupa boca koja stoji je normalna, svakodnevno vino koje se ne prodaje nije. Vina trenutačno skinuta s karte nisu ovdje.${x.ask.length ? " Dok je nešto u \"Za povezati\", ovaj popis može biti predug." : ""}</p>`
        + x.still.map((w) => `<div><span>${esc(w.producer)} · ${esc(w.name)}</span><b>${w.prices.length ? eur0(Math.min(...w.prices)) : ""}</b></div>`).join(""))}
      ${x.fresh.length ? box("fresh", `Nova na karti u tom razdoblju: ${x.fresh.length}`,
        x.fresh.map(({ w, e }) => `<div><span>${esc(w.producer)} · ${esc(w.name)}<small>na karti od ${hrDate(w.since)}${e ? ` · ${qty(e)}` : " · još nije prodano"}</small></span><b>${e ? eur0(e.t) : ""}</b></div>`).join("")) : ""}
      ${x.off.length ? box("off", `Prodano, a nije s karte: ${x.off.length} (${sum(x.off)})`,
        `<p class="muted small">Vina kojih više nema na karti, i ono što nije vino a upisano je u grupu vina.</p>`
        + x.off.map((u) => `<div><span>${esc(u.name)}<small>${esc(u.a.none)}${u.a.why ? ` · ${esc(u.a.why)}` : ""}</small></span><b>${eur0(u.t)}</b></div>`).join("")) : ""}
      ${x.wrong.length ? box("wrong", `U blagajni u krivoj grupi: ${x.wrong.length}`,
        `<p class="muted small">Grupa u Remarisu prema karti: čaša je uvijek "Vina na čaše", boca po boji i zemlji. Krive grupe kvare i usporedbu konobara (čaša / boca / šampanjac).</p>`
        + x.wrong.map((u) => `<div><span>${esc(u.name)}<small>${esc(u.grp || "—")} → <b>${esc(u.want)}</b></small></span><b>${eur0(u.t)}</b></div>`).join("")) : ""}
      <p class="muted small">Povezano je ${Math.round((x.matched / Math.max(1, x.total)) * 100)}% prodaje vina. Svaki artikl blagajne povezan je ručno s vinom s karte (data/till-map.json); novi artikli čekaju u "Za povezati". Datum "na karti od" je iz povijesti karte (od 31. 7. 2026).</p>`;
  }
  /* ---------- Konobari (Filho, 2026-10-14: "koji je konobar što prodao, i
     koji promet ima i što mu je palo … jer onda mogu upozorit i ispravit —
     dal mu fali aperitiv, dal više proda pjenušca a ne šampanjca") ----------
     The server compares each waiter with the rest of the team at the same mix
     of lunches and dinners (web/functions/_lib/sales.js, staffReport); here
     his own last month is added: what fell. */
  const STAFF_LABEL = { aperitiv: "kokteli i aperitivi", sampanjac: "šampanjac", pjenusac: "pjenušac", casa: "vino na čašu",
    boca: "vino na bocu", desertno: "desertno vino", predjelo: "predjela i juhe", desert: "deserti", zestoko: "žestoko" };
  const p0 = (x) => `${Math.round((x || 0) * 100)}%`;
  function staffNotes(w, prevW) {
    const notes = w.flags.map((f) => f.c === "mjehurici"
      ? { bad: true, text: `Mjehurići: ${p0(f.rate)} šampanjca, ostali ${p0(f.exp)} — više pjenušca nego šampanjca` }
      : { bad: true, text: `${cap(STAFF_LABEL[f.c])}: na ${p0(f.rate)} računa, ostali na istim stolovima ${p0(f.exp)}` });
    if (w.owner) return [];
    if (prevW && prevW.n >= 15 && w.n >= 15) {
      for (const c of Object.keys(STAFF_LABEL)) {
        const was = prevW.rate[c] || 0, now = w.rate[c] || 0;
        if (was >= 0.08 && now < was * 0.65 && !w.flags.some((f) => f.c === c)) notes.push({ bad: true, text: `${cap(STAFF_LABEL[c])} pali: ${p0(was)} → ${p0(now)} računa` });
      }
      const pa = prevW.avg, ca = w.avg;
      if (pa && ca < pa * 0.92) notes.push({ bad: true, text: `Prosječni račun pao: ${eur0(pa)} → ${eur0(ca)}` });
    }
    return notes;
  }
  let openStaff = "";
  function staffBox(s, prev) {
    const prevBy = new Map(((prev && prev.staff) || []).map((w) => [w.waiter, w]));
    const ws = (s.staff || []).filter((w) => w.n >= 5), wine = new Map((s.waiters || []).map((w) => [w.waiter, w.wine / Math.max(1, w.n)]));
    if (!ws.length) return "";
    const own = (s.ownTable || []).reduce((a, x) => ({ n: a.n + x.n, t: a.t + x.total }), { n: 0, t: 0 });
    return `<h3 class="h">Konobari <small>prema ostalima na istom omjeru ručkova i večera, samo dane kad je toga bilo, i prema svom prošlom mjesecu</small></h3>
      ${own.n ? `<p class="muted small">Stol bez hrane s 300 €+ vina (vaš stol): ${own.n} ${plural(own.n, "račun", "računa", "računa")}, ${eur0(own.t)} — izuzeto iz usporedbe konobara, prosječnog računa i vina po računu.</p>` : ""}
      <div class="staff">${ws.map((w) => {
        const pw = prevBy.get(w.waiter), notes = staffNotes(w, pw), tp = pw ? pct(w.avg, pw.avg) : null;
        const open = openStaff === w.waiter;
        return `<div class="sc"><button class="sh" data-staff="${esc(w.waiter)}" aria-expanded="${open}">
          <b>${esc(w.waiter)}</b><span>${eur0(w.total)}</span></button>
          <p class="muted small">${w.n} ${plural(w.n, "račun", "računa", "računa")}${w.lunch ? ` (${w.lunch} ručak)` : ""} · prosječno ${eur0(w.avg)}${wine.has(w.waiter) ? ` · vino ${eur0(wine.get(w.waiter))}/rač.` : ""}${tp ? ` <span class="${tp > 0 ? "down" : "up"}">${tp > 0 ? "▲" : "▼"} ${Math.abs(tp)}%</span>` : ""}</p>
          ${w.owner ? `<p class="muted small">Vlasnik — ne uspoređuje se.</p>` : notes.length ? notes.map((x) => `<p class="sn">${esc(x.text)}</p>`).join("") : `<p class="sn ok">U redu u odnosu na ostale.</p>`}
          ${(w.topWines || []).length ? `<p class="muted small">Najviše vina: ${w.topWines.map((t) => esc(nameCase(t.name))).join(" · ")}</p>` : ""}
          ${open ? `<div class="lines">${Object.keys(STAFF_LABEL).map((c) => `<div><span>${cap(STAFF_LABEL[c])}<small>ostali ${p0(w.exp[c])}${pw ? ` · prošli mj. ${p0(pw.rate[c])}` : ""}</small></span><b>${p0(w.rate[c])}</b></div>`).join("")}</div>
            <p class="muted small">Postotak računa na kojima je bilo nešto iz te skupine.</p>` : ""}
        </div>`;
      }).join("")}</div>`;
  }
  /* The evidence behind Pregled's list (2026-10-14): the dishes and wines
     that carry the month, with their move against last month per open day;
     the week; lunch against dinner; each waiter. */
  function salesDetail(s, prev) {
    const days = workDaysOf(s), pd = workDaysOf(prev);
    const prevBy = new Map(((prev && prev.items) || []).map((i) => [i.name, i]));
    const top = (test) => (s.items || []).filter(test).slice(0, 10).map((i) => {
      const p = prevBy.get(i.name), ch = p && pd && days ? pct(i.qty / days, p.qty / pd) : null;
      return `<div><span>${esc(nameCase(i.name))}<small>${nf(i.qty)} kom${ch != null && Math.abs(ch) >= 10
        ? ` · <span class="${ch > 0 ? "down" : "up"}">${ch > 0 ? "▲" : "▼"} ${Math.abs(ch)}%</span>` : ""}</small></span><b>${eur0(i.total)}</b></div>`;
    }).join("");
    const dishes = top(isDish);
    const menus = (s.items || []).filter((i) => isMenu(i) && rubricOf(i.grp, i.tax) === "hrana");
    const menuSum = menus.reduce((a, i) => ({ q: a.q + i.qty, t: a.t + i.total }), { q: 0, t: 0 });
    const wk = [1, 2, 3, 4, 5, 6, 0].map((d) => (s.weekdays || []).find((w) => w.wd === d)).filter(Boolean).map((w) => ({ ...w, per: w.total / Math.max(1, w.days) }));
    const wmax = Math.max(...wk.map((w) => w.per), 1);
    const parts = (s.dayparts || []).slice().sort((a) => (a.part === "rucak" ? -1 : 1));
    return `${dishes ? `<h3 class="h">Jela koja nose mjesec <small>▲▼ prema prošlom mjesecu, po radnom danu</small></h3><div class="lines">${dishes}</div>` : ""}
      ${menuSum.t ? `<div class="lines"><div><span>Grupni meniji<small>${nf(menuSum.q)} osoba · dolaze s grupama, pa ih nema svaki mjesec</small></span><b>${eur0(menuSum.t)}</b></div></div>` : ""}
      ${wineBox()}
      ${wk.length ? `<h3 class="h">Dan u tjednu <small>prosječno po otvorenom danu</small></h3>
      <div class="bars">${wk.map((w) => `<div class="bar"><span class="bl">${cap(WD[w.wd])} <small>${w.days}×</small></span><span class="bv">${eur0(w.per)}</span>
        <span class="track"><span style="width:${Math.max(2, (w.per / wmax) * 100)}%;background:#c9a961"></span></span></div>`).join("")}</div>` : ""}
      ${parts.length ? `<h3 class="h">Ručak i večera <small>prije i poslije 16 h</small></h3>
      <div class="lines">${parts.map((x) => {
        const gx = (s.guests || []).find((r) => r.part === x.part);
        const per = gx && gx.guests > 0 ? ` · po gostu ${eur0(gx.total / gx.guests)} (${nf(gx.guests)} ${plural(Math.round(gx.guests), "gost", "gosta", "gostiju")})` : "";
        return `<div><span>${x.part === "rucak" ? "Ručak" : "Večera"}<small>${x.n} ${plural(x.n, "račun", "računa", "računa")} · prosječno ${eur0(x.total / Math.max(1, x.n))}${per}</small></span><b>${eur0(x.total)}</b></div>`;
      }).join("")}</div>` : ""}
      ${staffBox(s, prev)}`;
  }
  /* lunch + dinner rows of /api/prihodi's `guests` summed (sales.js guestData) */
  function guestSum(rows) {
    return (rows || []).reduce((a, r) => ({ guests: a.guests + (r.guests || 0), total: a.total + (r.total || 0),
      other_n: a.other_n + (r.other_n || 0), other: a.other + (r.other || 0) }), { guests: 0, total: 0, other_n: 0, other: 0 });
  }
  /* the four rubrike as bars; a tap opens the till's own sales groups */
  function rubBars(s, total) {
    const by = salesByRubric(s), rows = RUBRICS.map(([k, label]) => [k, label, by[k]]).filter(([, , b]) => b && Math.abs(b.total) > 0.004);
    const max = Math.max(...rows.map(([, , b]) => b.total), 1), color = { hrana: "#c9a961", vino: "#a5544a", zestoko: "#8a7bb0", ostalo: "#6f8f9a" };
    return rows.map(([k, label, b]) => `<button class="bar" data-rub="${k}" aria-expanded="${openRub === k}">
        <span class="bl">${esc(label)}</span><span class="bv">${eur0(b.total)} <small>${total ? Math.round((b.total / total) * 100) : 0}%</small></span>
        <span class="track"><span style="width:${Math.max(2, (b.total / max) * 100)}%;background:${color[k]}"></span></span></button>
      ${openRub === k ? `<div class="parts">${Object.entries(b.groups).sort((x, y) => y[1] - x[1])
        .map(([g, v]) => `<div><span>${esc(g)}</span><span>${eur0(v)}</span></div>`).join("")}</div>` : ""}`).join("");
  }
  /* ---------- Pregled (owner, 2026-10-14: "not generic data, but the useful
     ones … to drive him to the right direction"; the owner is the chef) ----------
     It opens with what to look at, ranked by the euros at stake, each with
     what to do. Then the month's result WITHOUT PDV (the till's PDV belongs to
     the state, the receipts' PDV comes back as pretporez), prime cost, the
     rubrike sold against bought over three months, the other costs and six
     months. Everything else — the evidence — lives in Prihodi, Računi, Cijene. */
  const netOf = (r) => { const t = totalOf(r); return r.vat != null && t ? t - r.vat : t; };
  /* a receipt's lines without PDV: an e-invoice line has its own net
     (doc_total), a photographed one shares its receipt's net ÷ gross */
  function netByCategory(list) {
    const cats = {};
    let rest = 0;
    for (const r of list) {
      const t = totalOf(r), ratio = r.vat != null && t ? (t - r.vat) / t : 1;
      let lines = 0;
      for (const i of r.items) {
        const v = r.source === "mer" && i.doc_total != null ? i.doc_total : (i.total || 0) * ratio;
        cats[i.category] = (cats[i.category] || 0) + v; lines += v;
      }
      const gap = netOf(r) - lines;
      if (Math.abs(gap) > 0.05) rest += gap;
    }
    return { cats, rest, total: list.reduce((a, r) => a + netOf(r), 0) };
  }
  const salesNet = (s) => ((s && s.taxes) || []).reduce((a, t) => a + (t.net || 0), 0);
  const GOODS = RUBRICS.flatMap(([, , members]) => members);
  /* Orientation, not law: the ranges a restaurant consultant quotes for the
     share of sales spent on the goods sold. */
  const BANDS = { hrana: [25, 35], vino: [30, 45], zestoko: [15, 25], ostalo: [15, 30] };
  function rubricMonth(m) {
    const s = needIncome(m);
    if (!s) return null;
    const sold = salesByRubric(s), { cats } = netByCategory(inMonth(m));
    return Object.fromEntries(RUBRICS.map(([k, , members]) =>
      [k, { sold: sold[k] ? sold[k].net : 0, bought: members.reduce((a, c) => a + (cats[c] || 0), 0) }]));
  }
  /* three months together: stock bought in one month is sold in the next */
  function rubricRolling(m) {
    const xs = [0, -1, -2].map((d) => rubricMonth(shiftMonth(m, d)));
    if (xs.some((x) => !x)) return null;
    return Object.fromEntries(RUBRICS.map(([k]) => [k, xs.reduce((a, x) => ({ sold: a.sold + x[k].sold, bought: a.bought + x[k].bought }), { sold: 0, bought: 0 })]));
  }
  const shareOf = (x) => (x && x.sold > 0 && x.bought > 0 ? (x.bought / x.sold) * 100 : null);
  const isPast = (m) => m < new Date().toISOString().slice(0, 7);
  const payroll = (m) => inMonth(m).reduce((a, r) => a + r.items.filter((i) => i.category === "place").reduce((b, i) => b + (i.total || 0), 0), 0);

  /* what supplier price changes cost this month: every product bought this
     month and before, (new − old price) × what was bought now */
  function priceImpact(m) {
    const { seen, mixed } = priceHistory();
    const FRESH = new Set(["meso", "riba", "povrce"]);
    const per = [];
    for (const [k, h] of Object.entries(seen)) {
      if (mixed.has(k)) continue;
      let e = 0, bad = false;
      for (let i = 1; i < h.length; i++) {
        const x = h[i], y = h[i - 1];
        if (x.d.slice(0, 7) !== m) continue;
        const ch = pct(x.p, y.p), weighed = FRESH.has(x.cat) && /^(kg|g|l)$/.test(x.unit || "");
        if (!weighed && ch != null && (ch > 60 || ch < -40)) { bad = true; break; }
        e += (x.p - y.p) * (x.spent / x.p);
      }
      if (!bad && Math.abs(e) > 0.5) per.push({ name: h[h.length - 1].name, v: h[h.length - 1].v, e });
    }
    per.sort((a, b) => b.e - a.e);
    return { total: per.reduce((a, x) => a + x.e, 0), up: per.filter((x) => x.e > 0) };
  }

  const WD = ["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"];
  const cap = (w) => w[0].toLocaleUpperCase("hr") + w.slice(1);
  const workDaysOf = (s) => ((s && s.days) || []).filter((d) => d.total > 0).length;
  const MAIN = /glavn|predjel|juh|desert|abonn/i;     /* dishes, not couvert and sides */
  /* group menus (Repertoire, "MENU 60") come with group bookings (Filho,
     2026-10-14: "Meniji su grupe, zato ih nema uvijek") — never ranked or
     trended as dishes, shown as one line of their own */
  const isMenu = (it) => /repertoire|\bmenu\b|\bmeni\b/i.test(`${it.grp || ""} ${it.name || ""}`);   /* whole words: KAMENICA is oysters, not a menu */
  const isDish = (it) => rubricOf(it.grp, it.tax) === "hrana" && MAIN.test(it.grp || "") && !/couvert/i.test(it.name) && !isMenu(it);
  const isWine = (it) => rubricOf(it.grp, it.tax) === "vino";
  const nameCase = (n) => { const s = String(n || ""); return s === s.toLocaleUpperCase("hr") ? s.charAt(0) + s.slice(1).toLocaleLowerCase("hr") : s; };

  /* What Pregled leads with. Filho, 2026-10-14: "Prosječni račun je ok. Vina
     po računu. Ostale opaske su nebitne — nekad imaš puno ulaza rakije, al se
     prebacuje dalje": stock bought in bulk is sold for months, so a month's
     purchases say little, and storno and discounts are not where his money
     is. The owner (same day): the house may be in danger — give him numbers
     he can steer by. So three cards, always in this order:
       1. prag — what must be sold per open day to cover every cost, against
          what is sold (3 complete months, net of PDV, plaće included);
       2. the average bill;
       3. wine per bill, and by waiter. */
  /* Filho's goal (2026-10-14): "dnevna zarada 1k € dnevno — što je meni cilj, tako i držat" */
  const PROFIT_TARGET = 1000;
  function breakEven() {
    const end = isPast(month) ? month : shiftMonth(month, -1);
    const ms = [0, -1, -2].map((d) => shiftMonth(end, d));
    const ss = ms.map(needIncome);
    if (ss.some((x) => !x)) return null;
    /* Only months with plaće count — a month without them would show a
       profit nobody made. Of the three, those that have them are used and the
       rest are named (owner, 2026-10-14: August showed "čeka plaće" for June
       while July and August had them). */
    const mName = (m) => MONTHS[Number(m.slice(5, 7)) - 1];
    const use = ms.map((m, i) => [m, ss[i]]).filter(([m]) => payroll(m) > 0);
    const noPay = ms.filter((m) => !payroll(m));
    if (!use.length) return { e: 0, head: "Zarada i prag čekaju plaće",
      why: `Za ${noPay.map(mName).join(", ")} nema upisanih plaća.`,
      act: "Kad se upišu, ovdje piše koliko treba prodati po danu da se pokriju svi troškovi — i koliko do toga nedostaje ili ga prelazite." };
    const span = (use.length === 1 ? mName(use[0][0]) : `${mName(use[use.length - 1][0])}–${mName(use[0][0])}`)
      + (noPay.length ? ` (bez ${noPay.map((m) => MONTHS_GEN[Number(m.slice(5, 7)) - 1]).join(", ")} — nema plaća)` : "");
    const k = use.length;
    let inc = 0, gross = 0, goods = 0, other = 0, days = 0, bills = 0;
    const parts = {};
    use.forEach(([m, sm]) => {
      const n = netByCategory(inMonth(m)), g = GOODS.reduce((a, c) => a + (n.cats[c] || 0), 0);
      inc += salesNet(sm); gross += incTotal(sm); goods += g; other += n.total - g;
      days += workDaysOf(sm); bills += sm.days.reduce((a, d) => a + d.n, 0);
      for (const [c, v] of Object.entries(n.cats)) if (!GOODS.includes(c)) parts[c] = (parts[c] || 0) + v;
      if (Math.abs(n.rest) > 0.05) parts.ostalo = (parts.ostalo || 0) + n.rest;
    });
    if (!inc || !days || !bills) return null;
    const keep = 1 - goods / inc;                 /* of each euro sold, what is left after the goods */
    if (keep <= 0) return null;
    /* profit, not "revenue above the threshold" (2026-10-14: the card said
       the 1.034 € above it was profit; profit is that × keep) */
    const need = other / keep / days, have = inc / days, profit = (inc - goods - other) / days;
    const toGo = PROFIT_TARGET - profit, perBill = gross / bills, billsDay = bills / days;
    const moreSales = toGo > 0 ? toGo / keep : 0;               /* net sales a day that make up the gap */
    const vatX = gross / inc;                                    /* the till's own gross ÷ net */
    const costs = Object.entries(parts).filter(([, v]) => Math.abs(v) > 1).sort((a, b) => b[1] - a[1])
      .map(([c, v]) => `${esc(CAT[c] || c)} ${eur0(v / k)}`).join(" · ");
    return { e: 0, key: "prag",
      head: `Zarada: ${eur0(profit)} po radnom danu <small>cilj ${eur0(PROFIT_TARGET)}</small>`,
      why: `${span}, bez PDV-a · prodaja ${eur0(have)} dnevno (s PDV-om ${eur0(have * vatX)}) · prag ${eur0(need)} (s PDV-om ${eur0(need * vatX)}) · od eura prodaje nakon robe ostaje ${Math.round(keep * 100)} centi<br>
        Uračunati troškovi mjesečno: ${costs || "—"} — ako nešto fali (najam, kredit, knjigovodstvo, gotovina na tržnici), prag je viši, a zarada manja.`,
      act: toGo > 0 ? `Do cilja nedostaje ${eur0(toGo)} zarade dnevno = ${eur0(moreSales * vatX)} više prometa dnevno: ${Math.ceil((moreSales * vatX) / perBill)} ${plural(Math.ceil((moreSales * vatX) / perBill), "račun", "računa", "računa")} više (danas ${Math.round(billsDay)}) ili ${eur0((moreSales * vatX) / billsDay)} više po računu.`
        : `Cilj je ispunjen: ${eur0(-toGo)} iznad njega po radnom danu.` };
  }
  function insights() {
    const s = needIncome(month), prev = needIncome(shiftMonth(month, -1)), ly = needIncome(shiftMonth(month, -12));
    if (!s) return [];
    const out = [breakEven()];
    const lyN = ly ? ly.days.reduce((a, d) => a + d.n, 0) : 0;
    const lyW = ((ly && ly.waiters) || []).reduce((a, w) => ({ n: a.n + w.n, wine: a.wine + w.wine }), { n: 0, wine: 0 });
    /* without the owner's own table (Filho, 2026-10-14) — the waiter sums leave it out */
    const sums = (x) => ((x && x.waiters) || []).reduce((a, w) => ({ n: a.n + w.n, t: a.t + w.total }), { n: 0, t: 0 });
    const cur0 = sums(s), prev0 = sums(prev);
    const n = cur0.n, total = cur0.t;
    if (n) {
      const ca = total / n, pn = prev0.n, pa = pn ? prev0.t / pn : 0;
      const part = (k) => { const x = (s.dayparts || []).find((d) => d.part === k); return x && x.n ? eur0(x.total / x.n) : "—"; };
      const p = pa ? pct(ca, pa) : null;
      out.push({ e: p != null && p < 0 ? (pa - ca) * n : 0, sub: "prihodi",
        head: `Prosječni račun: ${eur0(ca)}${p ? ` <span class="${p > 0 ? "down" : "up"}">${p > 0 ? "▲" : "▼"} ${Math.abs(p)}%</span>` : ""}`,
        why: `${pa ? `prošli mjesec ${eur0(pa)} · ` : ""}${lyN ? `lani ${eur0(incTotal(ly) / lyN)} · ` : ""}ručak ${part("rucak")} · večera ${part("vecera")} · ${n} računa`,
        act: p != null && p < 0 ? `To je ${eur0((pa - ca) * n)} manje ovaj mjesec. Što se manje naručuje — predjela, deserti, vino? Pogledajte jela u Prihodima.`
          : `Svaki euro više po računu je ${eur0(n)} mjesečno. Predjelo ili desert više na stolu je ono što ga diže.` });
    }
    const ws = (s.waiters || []).filter((w) => w.n >= 20).map((w) => ({ ...w, wpb: w.wine / w.n })).sort((a, b) => b.wpb - a.wpb);
    const all = (s.waiters || []).reduce((a, w) => ({ n: a.n + w.n, wine: a.wine + w.wine, wb: a.wb + w.wine_bills }), { n: 0, wine: 0, wb: 0 });
    if (all.n) {
      const pw = ((prev && prev.waiters) || []).reduce((a, w) => ({ n: a.n + w.n, wine: a.wine + w.wine }), { n: 0, wine: 0 });
      const cur = all.wine / all.n, was = pw.n ? pw.wine / pw.n : 0, p = was ? pct(cur, was) : null;
      let gain = 0, mid = 0;
      if (ws.length >= 2) {
        const h = ws.length / 2;
        mid = ws.length % 2 ? ws[Math.floor(h)].wpb : (ws[h - 1].wpb + ws[h].wpb) / 2;
        gain = ws.reduce((a, w) => a + Math.max(0, mid - w.wpb) * w.n, 0);
      }
      out.push({ e: gain, sub: "prihodi",
        head: `Vino po računu: ${eur0(cur)}${p ? ` <span class="${p > 0 ? "down" : "up"}">${p > 0 ? "▲" : "▼"} ${Math.abs(p)}%</span>` : ""}`,
        why: `${was ? `prošli mjesec ${eur0(was)} · ` : ""}${lyW.n ? `lani ${eur0(lyW.wine / lyW.n)} · ` : ""}vino na ${Math.round((all.wb / all.n) * 100)}% računa${ws.length >= 2 ? " · " + ws.map((w) => `${esc(w.waiter.split(" ")[0])} ${eur0(w.wpb)}`).join(" · ") : ""}`,
        act: gain > 100 ? `Kad bi svi preporučivali vino barem kao sredina (${eur0(mid)} po računu), to je do ${eur0(gain)} mjesečno — dio razlike je i tko radi ručkove. "Pomozi mi odabrati" na tabletu pomaže.`
          : "Vino je najveća marža na stolu — preporuka uz svako glavno jelo." });
    }
    /* 4. waiters — what Filho asked to see first among the details */
    const pBy = new Map(((prev && prev.staff) || []).map((w) => [w.waiter, w]));
    const notes = (s.staff || []).filter((w) => w.n >= 15).flatMap((w) => staffNotes(w, pBy.get(w.waiter)).map((x) => `${esc(w.waiter.split(" ")[0])}: ${esc(x.text.charAt(0).toLowerCase() + x.text.slice(1))}`));
    if ((s.staff || []).length) out.push({ e: 0, sub: "prihodi", head: notes.length ? `Konobari: ${notes.length} ${plural(notes.length, "stvar", "stvari", "stvari")} za popraviti` : "Konobari: sve u redu",
      why: notes.slice(0, 4).join("<br>") + (notes.length > 4 ? "<br>…" : ""), act: "Detalji po konobaru u Prihodima." });
    return out.filter(Boolean);
  }
  let allFocus = false;

  function overview() {
    const list = inMonth(month), sales = needIncome(month);
    const net = netByCategory(list), incNet = salesNet(sales), mloc = MONTHS_LOC[Number(month.slice(5, 7)) - 1];
    if (!list.length && !(sales && incTotal(sales))) {
      return `${monthNav()}${sales ? `<p class="muted center">U ${mloc} još nema ni prihoda ni troškova.</p>` : `<p class="muted center"><span class="spin"></span> učitavam…</p>`}`;
    }
    const pay = payroll(month), goods = GOODS.reduce((a, c) => a + (net.cats[c] || 0), 0);
    const result = incNet - net.total;
    const out = sales && incTotal(sales) ? outVat(sales).total : 0, pre = vatOf(list).total;
    const warn = !pay && isPast(month)
      ? `<p class="warn">Plaće za ${mloc} nisu upisane, pa je rezultat previsok. Upišite ih u Računima (✍️ bez računa), s datumom u ${mloc}.</p>` : "";

    const card = sales && incNet ? `<div class="card bal">
      <div><span>Prihodi <small>bez PDV-a</small></span><b>${eur0(incNet)}</b></div>
      <div><span>Troškovi <small>bez PDV-a${pay ? "" : ", bez plaća"}</small></span><b>− ${eur0(net.total)}</b></div>
      <div class="sum"><span>Rezultat</span><b class="${result < 0 ? "up" : ""}">${result < 0 ? "− " : ""}${eur0(Math.abs(result))} <small>${Math.round((result / incNet) * 100)}%</small></b></div>
      <div class="kpi"><span>Prime cost <small>roba + plaće ÷ prihodi · zdravo do ~65%</small></span><b>${pay ? Math.round(((goods + pay) / incNet) * 100) + "%" : "—"}</b></div>
      ${out ? `<div class="kpi" data-sub="pdv" role="button"><span>PDV za uplatu <small>odvojite ga</small></span><b>${eur0(out - pre)}</b></div>` : ""}
    </div>` : "";

    const ins = insights(), shown = ins;
    const focus = ins.length ? `<h3 class="h">Na što se usredotočiti</h3>
      <div class="focus">${shown.map((x) => `<div class="fc${x.sub ? " go" : ""}${x.key === "prag" ? " prag" : ""}"${x.sub ? ` data-sub="${x.sub}" role="button"` : ""}>
        <div class="fh"><b>${x.head}</b>${x.e > 0 ? `<span class="fe">${eur0(x.e)}<small>/mj</small></span>` : ""}</div>
        ${x.why ? `<p class="muted small">${x.why}</p>` : ""}<p class="fa">${x.act}</p></div>`).join("")}</div>
` : "";

    const cur = rubricMonth(month), roll = rubricRolling(month);
    const rubRows = RUBRICS.map(([k, label]) => {
      const c = cur && cur[k], r = roll && roll[k], s3 = shareOf(r), [lo, hi] = BANDS[k];
      const cls = s3 == null ? "" : s3 > hi ? "up" : s3 < lo ? "low" : "ok";
      return `<div class="rub"><span class="rl">${esc(label)}</span><span>${c && c.sold ? eur0(c.sold) : "—"}</span>
        <span class="rp ${cls}">${s3 != null ? Math.round(s3) + "%" : ""}</span>
        <span class="rp dim">${lo}–${hi}%</span></div>`;
    }).join("");

    const others = GROUPS.filter(([k]) => !["hrana", "pice"].includes(k)).map(([k, label, members, color]) => ({
      k, label, color, members, sum: members.reduce((a, c) => a + (net.cats[c] || 0), 0) + (k === "ostalo" ? net.rest : 0),
    })).filter((g) => Math.abs(g.sum) > 0.004).sort((a, b) => b.sum - a.sum);
    const omax = Math.max(...others.map((g) => g.sum), 1);
    const otherBars = others.map((g) => `
      <button class="bar" data-group="${g.k}" aria-expanded="${openGroup === g.k}">
        <span class="bl">${esc(g.label)}</span><span class="bv">${eur0(g.sum)}</span>
        <span class="track"><span style="width:${Math.max(2, (g.sum / omax) * 100)}%;background:${g.color}"></span></span>
      </button>
      ${openGroup === g.k ? `<div class="parts">${g.members.map((c) => [c, net.cats[c] || 0]).filter(([, v]) => Math.abs(v) > 0.004)
        .map(([c, v]) => `<div><span>${esc(CAT[c])}</span><span>${eur0(v)}</span></div>`).join("")}${g.k === "ostalo" && Math.abs(net.rest) > 0.05
        ? `<div><span>nerazvrstano</span><span>${eur0(net.rest)}</span></div>` : ""}</div>` : ""}`).join("");

    const six = [...Array(6)].map((_, i) => shiftMonth(month, i - 5));
    const byM = Object.fromEntries(((sales && sales.months) || []).map((x) => [x.m, x.total - (x.vat || 0)]));
    const outs = six.map((m) => inMonth(m).reduce((a, r) => a + netOf(r), 0));
    const smax = Math.max(...six.map((m) => byM[m] || 0), ...outs, 1);
    const pairs = six.map((m, i) => `<button data-month="${m}" class="${m === month ? "on" : ""}">
        <span class="cv">${byM[m] ? Math.round((byM[m] - outs[i]) / 1000) + "k" : ""}</span>
        <span class="cb pair"><span class="in" style="height:${Math.max(byM[m] ? 3 : 0, ((byM[m] || 0) / smax) * 100)}%"></span><span style="height:${Math.max(outs[i] ? 3 : 0, (outs[i] / smax) * 100)}%"></span></span>
        <span class="cl">${MONTHS[Number(m.slice(5, 7)) - 1].slice(0, 3)}</span></button>`).join("");

    return `
      ${monthNav()}
      ${warn}${card}${focus}
      <h3 class="h">Po rubrikama <small>bez PDV-a</small></h3>
      <div class="rubs"><div class="rub head"><span></span><span>prodano</span><span>nabava, 3 mj.</span><span>uobič.</span></div>${rubRows}</div>
      <p class="muted small">Nabava kao udio prodaje, zadnja 3 mjeseca — samo orijentacija: roba kupljena odjednom (rakija, vino) prodaje se mjesecima.</p>
      ${others.length ? `<h3 class="h">Ostali troškovi <small>bez PDV-a</small></h3><div class="bars">${otherBars}</div>` : ""}
      <h3 class="h">Zadnjih 6 mjeseci <small><i class="lg in"></i>prihodi <i class="lg"></i>troškovi · bez PDV-a</small></h3>
      <div class="cols">${pairs}</div>`;
  }

  /* ---------- upload ---------- */
  function uploadCard(compact) {
    if (manual) return manualForm();
    const n = picked.length;
    return `<div class="card up${compact && !n ? " compact" : ""}">
      <div class="ch-acts">
        <label class="nema shot-btn">📷 Slikaj račun<input type="file" accept="image/*" capture="environment" data-up></label>
        <label class="nema shot-btn">🖼 Galerija<input type="file" accept="image/*,.heic,.heif,application/pdf,.pdf" multiple data-up></label>
      </div>
      ${n ? "" : `<button class="nema man-btn" data-manual="">✍️ Plaćeno bez računa — upiši</button>`}
      ${n ? `<div class="pics up-pics">${picked.map((f, i) => isPdf(f.file)
          ? `<span class="upth pdf" title="${esc(f.file.name)}">📄<small>${esc(f.file.name.slice(0, 18))}</small><button data-unpick="${i}" aria-label="Makni dokument">✕</button></span>`
          : `<span class="upth" style="background-image:url(${esc(f.url)})"><button data-unpick="${i}" aria-label="Makni sliku">✕</button></span>`).join("")}</div>
        ${n > 1 ? `<div class="ch-acts seg2"><button class="nema ${oneReceipt ? "" : "ok"}" data-one="">${n} računa</button><button class="nema ${oneReceipt ? "ok" : ""}" data-one="1">1 račun, ${n} slike</button></div>` : ""}
        ${sending ? `<button class="btn wide busy" disabled><span class="spin"></span>${esc(sending)}</button>`
          : `<div class="ch-acts"><button class="nema ok" data-send>pošalji${n > 1 && !oneReceipt ? ` (${n})` : ""}</button><button class="nema cancel" data-clear>odustani</button></div>`}` : ""}
    </div>`;
  }

  /* ---------- no receipt (Filho, 2026-10-12: "kad unesem 200 € napišem
     opise, povrće koje i koliko je cijena … majstora isto plaćam gotovinom
     bez računa — i da se to unese i prati") ----------
     A description and an amount per line; the category is guessed from the
     words as he types and is one tap to change. Saved as read, at once — no
     run, nothing to wait for. */
  const GUESS = [
    [/pla[cć]e\b|pla[cć]a\b|obra[cč]un pla|joppd|bruto|neto pla/i, "place"],
    [/majstor|popravak|popravi|servis|vodoinstal|elektri[cč]ar|bravar|stolar|keramičar|keramicar|limar|klima/i, "odrzavanje"],
    [/povr[cć]|vo[cć]e|salat|raj[cč]ic|krumpir|\bluk|gljiv|tikvic|paprik|limun|bilj|za[cč]in|plac|tr[zž]nic|dolac|opg/i, "povrce"],
    [/meso|mesn|pilet|piler|junet|june[cć]|svinj|tele[cć]|janj|kobasic|pr[sš]ut|slanin/i, "meso"],
    [/rib|[sš]kamp|lign|[sš]kolj|kamenic|dagnj|hobotnic/i, "riba"],
    [/mlijek|\bsir|jaja|jaje|vrhnj|maslac|jogurt/i, "mlijecno"],
    [/kruh|pekar|peciv|kifl/i, "pekara"],
    [/cvije[cć]|svije[cć]|dekor|ukras/i, "dekor"],
    [/[cč]i[sš][cć]|deterd|sapun|spu[zž]v/i, "ciscenje"],
    [/\bled\b|leda\b|vre[cć]ic|folij|salvet|ambala/i, "ambalaza"],
    [/\bvin[oa]\b/i, "vino"], [/\bkav[ae]?\b|\b[cč]aj/i, "kava"], [/\bpiv[oa]|\bsok|\bvod[ae]\b/i, "pivo_sokovi"],
    [/dostav|praonic|pranje|knjigov|ra[cč]unovod|taksi|parking/i, "usluge"],
    [/struj|plin|najam|re[zž]ij/i, "rezije"],
    [/lonac|tav|no[zž]|[cč]a[sš]|tanjur|alat|aparat/i, "oprema"],
  ];
  /* Categories in two short steps instead of eighteen at once (owner,
     2026-10-12: "not intuitive to click and open all categories"): the six
     groups always in view, the chosen group's own categories under them. A
     group of one (Ostalo) is chosen by its own tap. scope says whose line it
     is: "m|<line>" in the form, "r|<receipt>|<line>" on a read receipt. */
  function catPicker(scope, current, hint) {
    const g = groupView[scope] || groupOf(current)[0];
    const members = (GROUPS.find((x) => x[0] === g) || OSTALO)[2];
    return `<div class="catpick" data-pickscope="${esc(scope)}" data-cur="${esc(current)}">
      <div class="cg">${GROUPS.map(([k, label, , color]) => `<button type="button" data-pickg="${esc(scope)}|${k}" class="${k === g ? "on" : ""}"
        style="--c:${color}">${esc(label)}</button>`).join("")}</div>
      ${members.length > 1 ? `<div class="cs">${members.map((c) => `<button type="button" data-pickc="${esc(scope)}|${c}"
        ${scope[0] === "r" ? `data-setcat="${esc(scope.slice(2))}|${c}"` : ""} class="${c === current ? "on" : ""}">${esc(CAT[c])}</button>`).join("")}</div>` : ""}
      ${hint && !groupView[scope] ? `<p class="muted small">${esc(hint)}</p>` : ""}
    </div>`;
  }

  const guess = (text) => (GUESS.find(([re]) => re.test(text || "")) || [, ""])[1];
  const amountOf = (v) => { const n = Number(String(v || "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const blankLine = () => ({ name: "", total: "", category: "", picked: false });
  function startManual(r) {
    manual = r
      ? { editId: r.id, vendor: r.vendor, date: dateOf(r), payment: r.payment || "gotovina",
          lines: r.items.map((i) => ({ name: i.name, total: String(i.total ?? "").replace(".", ","), category: i.category, picked: true })) }
      : { editId: "", vendor: "", date: new Date().toISOString().slice(0, 10), payment: "gotovina", lines: [blankLine()] };
    err = "";
  }
  const lineCat = (l) => l.category || guess(l.name) || guess(manual.vendor) || "ostalo";
  const linePicker = (i) => {
    const l = manual.lines[i], c = lineCat(l);
    return catPicker(`m|${i}`, c, !l.category && c === "ostalo" && (l.name || l.total) ? "Odaberite vrstu troška." : "");
  };
  const manualTotal = () => manual.lines.reduce((s, l) => s + amountOf(l.total), 0);
  function manualForm() {
    const m = manual;
    const today = new Date().toISOString().slice(0, 10);
    return `<div class="card man">
      <h3>${m.editId ? "Ispravak — bez računa" : "Plaćeno bez računa"}</h3>
      <label class="f" for="man-vendor">Kome ili za što</label>
      <input type="text" id="man-vendor" data-mf="vendor" value="${esc(m.vendor)}" placeholder="npr. Plac Dolac, majstor za bojler" autocomplete="off">
      <label class="f" for="man-date">Datum</label>
      <input type="date" id="man-date" data-mf="date" value="${esc(m.date)}" max="${today}">
      <label class="f">Plaćeno</label>
      <div class="ch-acts">${["gotovina", "kartica", "virman"].map((p) =>
        `<button class="nema ${m.payment === p ? "ok" : ""}" data-pay="${p}">${p}</button>`).join("")}</div>
      <label class="f">Što je plaćeno</label>
      ${m.lines.map((l, i) => {
        return `<div class="ml">
          <div class="mrow">
            <input type="text" data-ml="${i}" data-k="name" value="${esc(l.name)}" placeholder="${i ? "još nešto" : "npr. rajčica, tikvice"}" autocomplete="off" aria-label="Opis">
            <span class="amt"><input type="text" inputmode="decimal" data-ml="${i}" data-k="total" value="${esc(l.total)}" placeholder="0,00" aria-label="Iznos"><span>€</span></span>
          </div>
          ${linePicker(i)}
          ${m.lines.length > 1 ? `<button class="linkbtn x" data-mldel="${i}">makni stavku</button>` : ""}
        </div>`;
      }).join("")}
      <button class="nema add" data-mladd>+ još jedna stavka</button>
      <div class="tot"><span>Ukupno</span><b id="man-total">${eur(manualTotal())}</b></div>
      ${saving ? `<button class="btn wide busy" disabled><span class="spin"></span>Spremam…</button>`
        : `<div class="ch-acts"><button class="nema ok" data-mansave>spremi</button><button class="nema cancel" data-mancancel>odustani</button></div>`}
    </div>`;
  }
  async function saveManual() {
    const m = manual;
    const lines = m.lines.filter((l) => amountOf(l.total) !== 0);
    if (!lines.length) { err = "Upišite iznos."; render(); return; }
    if (lines.some((l) => !l.name.trim()) && !m.vendor.trim()) { err = "Upišite kome ili za što je plaćeno."; render(); return; }
    const body = {
      vendor: m.vendor.trim(), doc_date: m.date, payment: m.payment, by: who(),
      items: lines.map((l) => ({ name: l.name.trim() || m.vendor.trim(), total: Math.round(amountOf(l.total) * 100) / 100,
                                 category: l.category || guess(l.name) || guess(m.vendor) || "ostalo" })),
    };
    saving = true; err = ""; render();
    try {
      await api(m.editId ? `/${m.editId}/uredi` : "", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      month = (m.date || "").slice(0, 7) || month;
      manual = null; saving = false; catPick = null;
      await load();
    } catch (e) { saving = false; err = "Nije spremljeno: " + e.message; render(); }
  }

  const isPdf = (f) => f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));
  const PDF_MAX = 1_500_000;            /* the server's PHOTO_MAX */
  async function shrink(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file))
      .catch(() => { throw new Error("Ovu sliku telefon ne može otvoriti — odaberite drugu."); });
    /* a till roll's small print needs the pixels: 2400 on the long side */
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    let q = 0.86, blob;
    do { blob = await new Promise((res) => c.toBlob(res, "image/jpeg", q)); q -= 0.08; } while (blob && blob.size > 1400000 && q > 0.4);
    return blob;
  }

  async function send() {
    const groups = oneReceipt ? [picked.slice(0, 4)] : picked.map((p) => [p]);
    try {
      let i = 0;
      for (const g of groups) {
        i += 1;
        sending = groups.length > 1 ? `Šaljem ${i} od ${groups.length}…` : "Šaljem…"; render();
        const fd = new FormData();
        for (const p of g) {
          /* a PDF goes as it is: it is text already, and smaller than a photo of it */
          if (isPdf(p.file)) {
            if (p.file.size > PDF_MAX) throw new Error(`PDF „${p.file.name}" je prevelik (najviše 1,5 MB) — pošaljite ga kao sliku stranica.`);
            fd.append("photo", new Blob([p.file], { type: "application/pdf" }), "racun.pdf");
          } else fd.append("photo", await shrink(p.file), "racun.jpg");
        }
        fd.append("by", who());
        await api("", { method: "POST", body: fd });
      }
      picked.splice(0).forEach((p) => URL.revokeObjectURL(p.url));
      oneReceipt = false; sending = "";
      sub = "racuni"; month = latestMonth();
      await load();
    } catch (e) { sending = ""; err = "Nije poslano: " + e.message; render(); }
  }

  /* ---------- receipts ---------- */
  /* One month at a time (owner, 2026-10-12: "month option to select and only
     then invoices are shown — not endless scrolling"), with the same ‹ month ›
     switch and the same month as Pregled; a kind chosen narrows it further
     and the total follows. */
  function receiptsView() {
    return `${uploadCard()}${merLine()}
      <input type="search" id="rq" class="rq" value="${esc(query)}" placeholder="Traži: dobavljač, broj računa, iznos" autocomplete="off" aria-label="Traži račune">
      <div id="rlist">${receiptList()}</div>`;
  }
  /* A search looks through every month — "when did we last pay Selecta?" —
     by supplier, invoice number, a line's name, or the amount ("523", "523,65"). */
  function matches(r, q) {
    const words = fold([r.vendor, shortName(r.vendor), r.doc_no, ...r.items.map((i) => i.name)].join(" "));
    if (words.includes(q)) return true;
    if (!/\d/.test(q)) return false;
    const qa = q.replace(/[\s€]/g, "").replace(/\.(\d{1,2})$/, ",$1").replace(/\./g, "");
    return eur(totalOf(r)).replace(/[\s\u00a0\u202f€.]/g, "").includes(qa);
  }
  function receiptList() {
    const q = fold(query.trim());
    const base = q ? receipts.filter((r) => matches(r, q)) : receipts.filter((r) => monthOf(r) === month);
    const fits = (r) => (!kind || kindOf(r) === kind) && (!unpaidOnly || unpaid(r));
    /* a photo that also arrived from MER counts once; it is out of the way
       until asked for */
    const twins = base.filter((r) => r.dup_of && fits({ ...r, dup_of: "" }));
    const list = base.filter((r) => (showDup || !r.dup_of) && (r.dup_of ? fits({ ...r, dup_of: "" }) : fits(r)));
    const counted = list.filter((r) => r.status === "done" && !r.dup_of);
    const sum = counted.reduce((s, r) => s + totalOf(r), 0);
    const mloc = MONTHS_LOC[Number(month.slice(5, 7)) - 1];
    const head = q ? `${counted.length} ${plural(counted.length, "pronađen", "pronađena", "pronađenih")}`
      : `${counted.length} ${plural(counted.length, "račun", "računa", "računa")}${unpaidOnly ? " za platiti" : ""}`;
    const empty = q ? "Ništa nije pronađeno." : unpaidOnly ? `U ${mloc} je sve plaćeno.` : `${kind ? "Ovakvih računa" : "Računa"} u ${mloc} nema.`;
    return `${q ? "" : monthNav()}${kindChips(base)}
      ${list.length ? `<h3 class="h mh"><span>${head}</span><span>${sum ? eur0(sum) : ""}</span></h3>
        ${list.map(receiptRow).join("")}` : `<p class="muted center">${empty}</p>`}
      ${twins.length ? `<button class="linkbtn dups" data-showdup>${showDup ? "sakrij slike koje su stigle i kao e-račun"
        : `${twins.length} ${plural(twins.length, "slika", "slike", "slika")} — ${twins.length === 1 ? "stigla" : "stigle"} i kao e-račun ›`}</button>` : ""}`;
  }

  /* moj-eRačun: silent while it works; one line when it does not. */
  function merLine() {
    if (!mer) return "";
    const at = (iso) => {
      if (!iso) return "";
      const d = new Date(iso), t = d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
      return d.toDateString() === new Date().toDateString() ? `danas u ${t}` : `${d.getDate()}. ${d.getMonth() + 1}. u ${t}`;
    };
    /* Only when something is wrong (owner, 2026-10-12: "we probably don't
       need this note, and possibly even the option to pull now"). The inbox
       is asked by itself every 30 minutes; a working connection says nothing. */
    if (mer.state !== "error") return "";
    return `<p class="mer"><span class="badge bad">moj-eRačun se ne javlja</span><span>${esc(mer.error)}${mer.last_ok ? ` · zadnje uspješno ${at(mer.last_ok)}` : ""}</span></p>`;
  }

  /* A line in the paper's own quantity and unit (owner, 2026-10-12:
     "Teranino didn't cost like you put it"), priced WITH PDV ("you can just
     show price with PDV"): an invoice that prints 6 kom × 16,80 € − 5% net
     reads 6 kom × 19,95 € · s rabatom 5%, = 119,70 €. A till receipt already
     prints with PDV, so its price is the printed one. The per-kg/l price that
     Cijene compares is never shown here. */
  const nf = (n) => new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 3 }).format(n);
  function lineSmall(it) {
    if (it.doc_total != null) {
      const u = esc(it.doc_unit || "kom");
      const q = it.doc_qty != null ? `${nf(it.doc_qty)} ${u}` : "";
      const asPrinted = it.total == null || Math.abs(it.doc_total - it.total) < 0.01;
      const price = asPrinted ? it.doc_price
        : it.doc_qty ? Math.round((it.total / it.doc_qty) * (it.doc_base || 1) * 100) / 100 : null;
      const p = price != null ? `${eur(price)}${it.doc_base ? ` / ${nf(it.doc_base)} ${u}` : ""}` : "";
      const parts = [[q, p].filter(Boolean).join(" × "), it.discount ? `s rabatom ${nf(it.discount)}%` : ""].filter(Boolean);
      return parts.length ? `<small>${parts.join(" · ")}</small>` : "";
    }
    /* read before 2026-10-12: only the converted figures exist */
    return it.qty != null ? `<small>${nf(it.qty)} ${esc(it.unit || "")}${it.unit_price != null ? ` × ${eur(it.unit_price)}` : ""}</small>` : "";
  }

  function receiptRow(r) {
    {
      const st = r.status;
      const badge = st === "done" ? "" : st === "failed" ? `<span class="badge bad">nije pročitan</span>`
        : `<span class="badge">${r.source === "mer" ? "razvrstava se" : "čita se"}</span>`;
      const k = kindOf(r), g = k && GROUPS.find((x) => x[0] === k);
      const kindTag = g ? `<span class="kind" style="--c:${g[3]}">${esc(g[1])}</span> · ` : "";
      /* where it came from rides in the quiet line, so the name has the width */
      const src = r.source === "mer" ? ` · <span class="from">e-račun</span>` : r.source === "rucno" ? ` · <span class="from">bez računa</span>` : "";
      const head = `<button class="rhead" data-open="${esc(r.id)}" aria-expanded="${open === r.id}">
        <span class="rv">${esc(shortName(r.vendor) || (st === "done" ? "Nepoznat" : "Račun"))}${r.dup_of ? `<span class="badge src dup">dvaput</span>` : ""}<small>${kindTag}${hrDate(dateOf(r))}${query && dateOf(r).slice(0, 4) !== String(new Date().getFullYear()) ? " " + dateOf(r).slice(0, 4) + "." : ""}${src}</small></span>
        <span class="rt">${st === "done" ? eur(totalOf(r)) : badge}</span></button>`;
      const cls = r.dup_of ? " dup" : "";
      const top = st === "done" && !r.dup_of ? `<div class="rrow">${head}${payPill(r)}</div>` : head;
      if (open !== r.id) return `<div class="rec${cls}">${top}</div>`;
      return `<div class="rec open${cls}">${top}
        ${r.vendor && shortName(r.vendor) !== r.vendor || r.created_by || r.items.length > 1
          ? `<p class="muted small">${[r.vendor && shortName(r.vendor) !== r.vendor ? esc(r.vendor) : "",
              r.items.length > 1 ? `${r.items.length} ${plural(r.items.length, "stavka", "stavke", "stavki")}` : "",
              r.created_by ? `dodao ${esc(r.created_by)}` : ""].filter(Boolean).join(" · ")}</p>` : ""}
        ${r.dup_of ? `<p class="muted small">Isti račun stigao je i kao e-račun iz moj-eRačuna, pa se ovaj ne zbraja. Slobodno ga obrišite.
          <button class="linkbtn" data-notdup="${esc(r.id)}">nije isti račun</button></p>` : ""}
        ${r.note ? `<p class="muted small">${esc(r.note)}</p>` : ""}
        ${st === "failed" ? `<p class="err">${esc(r.error || "Račun se ne može pročitati.")}</p>` : ""}
        ${r.items.length ? `<div class="items">${r.items.map((it, i) => `
          <div class="it"><span class="in">${esc(it.name)}${lineSmall(it)}</span>
            <b>${eur(it.total != null ? it.total : it.doc_total)}</b>
            <button class="chip" data-cat="${esc(r.id)}|${i}" style="border-color:${groupOf(it.category)[3]}">${esc(CAT[it.category] || it.category)} ▾</button>
            ${catPick === `${r.id}|${i}` ? catPicker(`r|${r.id}|${i}`, it.category) : ""}
          </div>`).join("")}</div>` : ""}
        ${r.vat != null ? `<p class="muted small">PDV ${eur(r.vat)}${r.payment ? ` · ${esc(r.payment)}` : ""}${r.doc_no ? ` · br. ${esc(r.doc_no)}` : ""}</p>`
          : r.source === "rucno" ? `<p class="muted small">${r.payment === "virman" ? "Na virman" : `Plaćeno ${esc(r.payment || "gotovina")}`}, bez računa${r.created_by ? ` · upisao ${esc(r.created_by)}` : ""}</p>` : ""}
        ${st === "done" && !r.dup_of ? `<p class="muted small">${isPaid(r)
          ? (/^\d{4}-/.test(r.paid_at) ? `Plaćeno ${hrDate(r.paid_at)}.` : `Plaćeno${{ gotovina: " gotovinom", kartica: " karticom" }[r.payment] || ""}.`)
          : `<span class="${isLate(r) ? "late" : ""}">Nije plaćeno · ${dueText(r)}</span>`}</p>` : ""}
        <div class="pics">${r.photos.map((n) => thumb(r, n)).join("")}</div>
        ${confirmDel === r.id
          ? `<div class="ch-acts"><button class="nema all" data-del="${esc(r.id)}" data-sure="1">da, obriši račun</button><button class="nema cancel" data-nodel>odustani</button></div>`
          : `<div class="ch-acts">${st === "failed" ? `<button class="nema ok" data-retry="${esc(r.id)}">pokušaj ponovno</button>`
              : st === "done" && r.source === "foto" ? `<button class="nema" data-retry="${esc(r.id)}">pročitaj ponovno</button>` : ""}
              ${r.source === "rucno" ? `<button class="nema" data-edit="${esc(r.id)}">ispravi</button>` : ""}
              ${st === "done" && r.source !== "rucno" && r.vendor ? `<button class="nema" data-pricevendor="${esc(shortName(r.vendor))}">usporedi cijene</button>` : ""}
              ${st === "working" ? "" : `<button class="nema" data-del="${esc(r.id)}">obriši</button>`}</div>`}
      </div>`;
    }
  }

  function thumb(r, n) {
    const id = r.id, k = id + "|" + n;
    if (!thumbs.has(k)) loadThumb(id, n);
    const url = thumbs.get(k);
    /* an e-invoice's attachment is the supplier's PDF, not a photo; so is a
       PDF uploaded from the gallery */
    if (r.source === "mer" || pdfThumbs.has(k)) return url ? `<a class="nema shot-btn" href="${esc(url)}" target="_blank" rel="noopener">📄 ${r.source === "mer" ? "Račun" : "Dokument"} u PDF-u</a>` : "";
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="Račun, slika ${n}"></a>` : `<span class="ph">${n}</span>`;
  }
  async function loadThumb(id, n) {
    const k = id + "|" + n;
    thumbs.set(k, "");
    try {
      const r = await fetch(`${API}/${id}/foto/${n}`, { headers: { authorization: "Bearer " + ghKey() } });
      if (!r.ok) throw new Error(r.status);
      const blob = await r.blob();
      if (/pdf/.test(blob.type)) pdfThumbs.add(k);
      thumbs.set(k, URL.createObjectURL(blob));
      render();
    } catch { thumbs.delete(k); }
  }

  /* ---------- PDV (Filho, 2026-10-13: "koliko PDV-a moram platiti") ----------
     PDV za uplatu = izlazni PDV (the till, Remaris) − pretporez (the invoices).
     The accountant: monthly, by invoice date (fakturirana realizacija) — so an
     invoice counts in its own month, paid or not — and the accountant takes
     out what is not deductible (reprezentacija, cars), so this is an estimate.
     Pretporez comes from Troškovi: e-invoices exactly, rate by rate from their
     lines; a photographed receipt counts only if it was made out to the
     company (R-1), which the reader cannot always tell, so photos are shown
     apart. Hand-typed cash and Plaće carry no PDV. Izlazni PDV waits for the
     Remaris CSV. */
  function vatOf(list) {
    const rates = {};
    let total = 0, photos = 0, n = 0;
    for (const r of list) {
      if (r.source === "rucno" || r.vat == null) continue;
      n += 1; total += r.vat;
      if (r.source !== "mer") { photos += r.vat; continue; }
      let lines = 0;
      for (const i of r.items) {
        if (i.vat_rate == null || i.doc_total == null || i.total == null) continue;
        const v = i.total - i.doc_total;
        rates[i.vat_rate] = (rates[i.vat_rate] || 0) + v; lines += v;
      }
      if (Math.abs(r.vat - lines) > 0.05) rates["?"] = (rates["?"] || 0) + (r.vat - lines);
    }
    return { total, photos, n, rates };
  }
  function vatView() {
    const list = inMonth(month);
    const v = vatOf(list);
    const mloc = MONTHS_LOC[Number(month.slice(5, 7)) - 1];
    const rateRows = Object.entries(v.rates).filter(([, x]) => Math.abs(x) > 0.004)
      .sort((a, b) => (b[0] === "?" ? -1 : Number(b[0])) - (a[0] === "?" ? -1 : Number(a[0])))
      .map(([k, x]) => `<div><span>${k === "?" ? "stopa nije na stavkama" : `${nf(Number(k))}%`}</span><b>${eur(x)}</b></div>`).join("");
    /* newest first; what he asked, first, its parts below it (owner, 2026-10-13) */
    const six = [...Array(6)].map((_, i) => shiftMonth(month, -i));
    /* izlazni PDV from the till's own lines (Remaris, every morning) */
    const sales = needIncome(month), out = sales && incTotal(sales) ? outVat(sales) : null;
    const outRows = out ? Object.entries(out.rates).filter(([, x]) => Math.abs(x) > 0.004)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([k, x]) => `<div><span>${k === "?" ? "bez porezne grupe" : `${nf(Number(k))}%`}</span><b>${eur(x)}</b></div>`).join("") : "";
    return `${monthNav()}
      <div class="card vat">
        <h3>PDV za uplatu</h3>
        ${out ? `<div class="vbig">${eur(out.total - v.total)}</div>
        <p class="muted small">Izlazni PDV ${eur(out.total)} − pretporez ${eur(v.total)}</p>`
        : `<p class="muted small">Izlazni PDV − pretporez. ${sales ? `Za ${mloc} još nema računa iz Remarisa.` : "Učitavam izlazni PDV…"}</p>`}
      </div>
      <div class="card vat">
        <h3>Pretporez <small>PDV na ulaznim računima</small></h3>
        <div class="vbig">${eur(v.total)}</div>
        <p class="muted small">${v.n} ${plural(v.n, "račun", "računa", "računa")} u ${mloc}, prema datumu računa${v.photos ? ` · od toga ${eur(v.photos)} sa slikanih računa — priznaje se samo ako je račun izdan na tvrtku (R-1)` : ""}</p>
        ${rateRows ? `<div class="vrates">${rateRows}</div>` : ""}
      </div>
      <div class="card vat">
        <h3>Izlazni PDV <small>PDV na prodaji, iz Remarisa</small></h3>
        ${out ? `<div class="vbig">${eur(out.total)}</div>
        <p class="muted small">s blagajne u ${mloc}, po poreznim grupama na stavkama računa; storno računi uključeni</p>
        ${outRows ? `<div class="vrates">${outRows}</div>` : ""}`
        : `<p class="muted small">Računi s blagajne čitaju se iz Remarisa svako jutro u 6:00.</p>`}
      </div>
      <p class="muted small">Procjena, mjesečno, prema datumu računa (fakturirana realizacija). Računovodstvo izuzima troškove kod kojih se pretporez ne priznaje ili priznaje djelomično (reprezentacija, osobni automobili…), pa je stvarni pretporez nešto manji, a PDV za uplatu nešto veći.</p>
      <h3 class="h">Pretporez, zadnjih 6 mjeseci</h3>
      <div class="lines">${six.map((m) => `<div><span>${esc(monthName(m))}</span><b>${eur(vatOf(inMonth(m)).total)}</b></div>`).join("")}</div>`;
  }

  /* ---------- prices ----------
     Owner, 2026-10-12: "check what you are comparing — Hampden didn't
     increase 179%". It had not: Bumbu and Hampden shared the key "rum". So:
     only real products (no deposit, interest, delivery, fee or discount),
     one purchase per invoice, two pack sizes never one product, and every
     row opens onto the invoices and lines it compares — the evidence, so a
     wrong pairing is visible at a glance. */
  const NOT_A_PRODUCT = /povratn|naknad|kamat|dostav|prijevoz|popust|rabat|kaucij|tro[sš]ak|pristojb|[cč]lanarin|pretplat/i;
  /* "0,75 l", "800 g", "300–400 g", "1,5 kg" in a line's name */
  function packOf(name) {
    const m = String(name || "").match(/(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\+?\s*(ml|cl|l|kg|g)\b/i);
    if (m) return `${m[1].replace(",", ".")}${m[2] ? "-" + m[2].replace(",", ".") : ""}${m[3].toLowerCase()}`;
    /* a bottle printed bare after the name: "BRUT NAT. 0,75", "… 1,50" */
    const b = String(name || "").match(/\s(\d[.,]\d{1,3})\s*$/);
    return b ? `${Number(b[1].replace(",", "."))}l` : "";
  }
  /* a size that lives only in the key ("… brut nature 1,5 l") is shown on
     the row, or a bottle and a magnum would read the same */
  const keySize = (key, name) => {
    if (packOf(name)) return "";
    const m = String(key || "").match(/\s(\d+(?:,\d+)?\s?(?:l|ml|g|kg))$/);
    return m ? ` · ${m[1]}` : "";
  };
  let openPrice = null;
  /* one supplier at a time (Filho, 2026-10-12: "da ja stisnem usporedi mi sve
     cijene iz Moj Mesar i onda on sve usporedi"): only that supplier's own
     invoices, every product bought from them at least twice */
  let priceVendor = "";
  const PAY_KEY = "place|mj|";
  /* biggest rise first; a tap on another sort starts it at its natural end */
  const priceSort = { by: "promjena", dir: -1 };
  /* every product's purchases in date order, shared by Cijene and Pregled's
     price impact (2026-10-14) */
  function priceHistory() {
    const seen = {}, mixed = new Set();
    for (const r of done().slice().sort((a, b) => dateOf(a).localeCompare(dateOf(b)))) {
      const here = new Map();
      for (const it0 of r.items) {
        /* The printed price per printed unit, with PDV and after the line's
           rabat, wherever the paper's numbers exist (2026-10-13). The reader's
           per-kg conversion was not steady: the same "3 kom" of ricotta at
           7,70 € became 0,75 kg one week and 3 kg the next. */
        const printed = it0.doc_qty > 0 && it0.total > 0;
        const it = printed ? { ...it0, unit_price: Math.round((it0.total / it0.doc_qty) * 10000) / 10000, unit: it0.doc_unit || "kom" } : it0;
        if (!it.key || it.unit_price == null || it.unit_price <= 0 || ["rezije", "usluge", "odrzavanje", "place"].includes(it.category)) continue;
        if (NOT_A_PRODUCT.test(it.name) || NOT_A_PRODUCT.test(it.key)) continue;
        const k = `${it.key}|${it.unit || ""}|${packOf(it.name)}`;
        /* the same article twice on one invoice is one purchase; the same
           name at two prices on one invoice is two articles the name does not
           tell apart (a bottle and a magnum, two vintages, two origins) —
           never compared, set aside to be checked (2026-10-12, Henri Giraud) */
        if (here.has(k)) {
          if (Math.abs(here.get(k) - it.unit_price) <= it.unit_price * 0.005) continue;
          mixed.add(k);
        }
        here.set(k, it.unit_price);
        (seen[k] = seen[k] || []).push({ p: it.unit_price, d: dateOf(r), v: shortName(r.vendor), name: it.name, unit: it.unit,
          spent: it.total || 0, id: r.id, no: r.doc_no, line: lineSmall(it), cat: it.category });
      }
    }
    return { seen, mixed };
  }
  function pricesView() {
    const { seen, mixed } = priceHistory();
    /* Plaće, month against month (owner, 2026-10-13: "plaće could also be in
       Cijene"): not a unit price, but the same question — what did this
       month's salaries cost against the last. One entry per month, the
       payroll documents of a month added together. */
    const pay = new Map();
    for (const r of done()) {
      const sum = r.items.filter((i) => i.category === "place").reduce((s, i) => s + (i.total || 0), 0);
      if (!sum) continue;
      const m = monthOf(r), e = pay.get(m) || { p: 0, d: dateOf(r), ids: [], nos: [] };
      e.p += sum; e.ids.push(r.id); if (r.doc_no) e.nos.push(r.doc_no);
      pay.set(m, e);
    }
    if (pay.size) {
      seen[PAY_KEY] = [...pay].sort((a, b) => a[0].localeCompare(b[0])).map(([m, e]) => ({
        p: Math.round(e.p * 100) / 100, d: e.d, v: "Plaće", name: "Plaće · po mjesecu", unit: "mj", spent: e.p,
        id: e.ids[0], no: "", line: `<small>${esc(monthName(m))}</small>`, cat: "place" }));
    }
    /* suppliers with something to compare, most products first */
    const per = {};
    for (const h of Object.values(seen)) {
      const c = {};
      for (const x of h) c[x.v] = (c[x.v] || 0) + 1;
      for (const [v, n] of Object.entries(c)) if (n >= 2) per[v] = (per[v] || 0) + 1;
    }
    const vendors = Object.entries(per).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (priceVendor && !per[priceVendor]) priceVendor = "";
    const hist = Object.entries(seen).map(([k, h]) => [k, priceVendor ? h.filter((x) => x.v === priceVendor) : h]);
    const once = priceVendor ? hist.filter(([, h]) => h.length === 1).length : 0;
    const rows = hist.filter(([, h]) => h.length >= 2).map(([k, h]) => {
      const last = h[h.length - 1], prev = h[h.length - 2], first = h[0];
      return { k, name: last.name, unit: last.unit, last, prev, first, h, n: h.length, change: pct(last.p, prev.p),
               since: pct(last.p, first.p), spent: h.reduce((s, x) => s + x.spent, 0) };
    });
    if (!rows.length) {
      return `<p class="muted center">Kad isti proizvod kupite barem dvaput, ovdje se vidi kako mu se mijenja cijena.</p>`;
    }
    /* moved = changed since the last purchase, or since the first one we have */
    /* A bottled or packed article does not really move +60% or −40% between
       two deliveries; a jump like that is a magnum read as a bottle (Henri
       Giraud's 1,5 l is "ESPRIT BRUT NAT." in the XML, like the 0,75 l). Fresh
       goods can, with the season, so they are left alone. */
    /* everything but fresh food: a jar of Tabasco and its box of twelve were
       one name too (2026-10-13) */
    const FRESH = new Set(["meso", "riba", "povrce"]);
    const wild = (v) => v != null && (v > 60 || v < -40);
    /* fresh food is exempt only when it is weighed — a "kom" of peas is a bag */
    const weighed = (r) => FRESH.has(r.last.cat) && /^(kg|g|l)$/.test(r.unit || "");
    /* salaries can move a lot with the season — never "two articles" */
    for (const r of rows) if (r.k !== PAY_KEY && !weighed(r) && (wild(r.change) || wild(r.since))) mixed.add(r.k);
    const check = rows.filter((r) => mixed.has(r.k));
    rows.splice(0, rows.length, ...rows.filter((r) => !mixed.has(r.k)));
    /* sorted as he chooses (owner, 2026-10-13: "some sorting in Cijene, asc/desc
       when I click"): by change, by money spent, or by name; a second tap on
       the same one turns it round */
    const mv = (r) => r.change || r.since || 0;
    const by = {
      promjena: (a, b) => mv(a) - mv(b) || a.spent - b.spent,
      potroseno: (a, b) => a.spent - b.spent,
      naziv: (a, b) => a.name.localeCompare(b.name, "hr"),
    }[priceSort.by];
    const sorted = (list) => list.slice().sort((a, b) => by(a, b) * priceSort.dir);
    const moved = sorted(rows.filter((r) => r.change || r.since));
    const steady = sorted(rows.filter((r) => !r.change && !r.since));
    const mname = (d) => MONTHS_LOC[Number(d.slice(5, 7)) - 1];
    const arrow = (v, text) => `<span class="${v > 0 ? "up" : "down"}">${v > 0 ? "▲" : "▼"} ${Math.abs(v)}%${text}</span>`;
    const row = (r) => {
      const where = r.last.v === r.prev.v ? esc(r.last.v || "") : `${esc(r.prev.v || "")} → ${esc(r.last.v || "")}`;
      const was = r.change ? `prije ${eur(r.prev.p)}` : r.since ? `u ${mname(r.first.d)} ${eur(r.first.p)}` : "";
      const isOpen = openPrice === r.k;
      return `<div class="pr${isOpen ? " open" : ""}"><button class="prh" data-price="${esc(r.k)}" aria-expanded="${isOpen}">
      <span class="pn">${esc(r.name)}${esc(keySize(r.k.split("|")[0], r.name))}<small>${where} · ${r.n}× · zadnje ${hrDate(r.last.d)}${was ? ` · ${was}` : ""}</small></span>
      <span class="pp"><b>${eur(r.last.p)}</b><small>/${esc(r.unit || "kom")}</small>
        ${mixed.has(r.k) ? `<span class="muted">provjeriti</span>` : r.change ? arrow(r.change, "") : r.since ? arrow(r.since, ` od ${MONTHS_GEN[Number(r.first.d.slice(5, 7)) - 1]}`) : `<span class="muted">ista</span>`}</span></button>
      ${isOpen ? `<div class="ph">${r.h.slice().reverse().map((x) => `<button class="phr" data-goto="${esc(x.id)}">
          <span>${hrDate(x.d)} · ${esc(x.v || "")}${x.no ? ` · br. ${esc(x.no)}` : ""}<small>${esc(x.name)}</small>${x.line}</span>
          <b>${eur(x.p)}<small>/${esc(x.unit || "kom")}</small></b></button>`).join("")}</div>` : ""}</div>`;
    };
    /* no heading: "Svi dobavljači" already says what it is (owner, 2026-10-13) */
    const picker = vendors.length > 1 ? `<select id="pv" class="pv" aria-label="Dobavljač"><option value="">Svi dobavljači</option>${vendors.map(([v, n]) =>
        `<option value="${esc(v)}" ${v === priceVendor ? "selected" : ""}>${esc(v)} (${n})</option>`).join("")}</select>` : "";
    const up = rows.filter((r) => (r.change || r.since) > 0).length, down = rows.filter((r) => (r.change || r.since) < 0).length;
    const summary = priceVendor ? `<p class="psum"><b>${rows.length} ${plural(rows.length, "proizvod", "proizvoda", "proizvoda")}</b>
      ${up ? ` · <span class="up">▲ ${up} ${plural(up, "poskupio", "poskupjela", "poskupjelo")}</span>` : ""}
      ${down ? ` · <span class="down">▼ ${down} ${plural(down, "pojeftinio", "pojeftinila", "pojeftinilo")}</span>` : ""}
      ${rows.length - up - down ? ` · ${rows.length - up - down} ${plural(rows.length - up - down, "ista cijena", "iste cijene", "istih cijena")}` : ""}
      ${once ? `<small>Još ${once} ${plural(once, "proizvod", "proizvoda", "proizvoda")} kupljeno samo jednom — nema s čim usporediti.</small>` : ""}</p>` : "";
    return `<p class="muted small">Isti proizvod, zadnja kupnja prema prethodnoj. Cijena po kg, l ili komadu, s PDV-om. Dodirnite proizvod da vidite račune koji se uspoređuju.</p>
      ${picker}${summary}
      <div class="psort" role="group" aria-label="Poredaj">${[["promjena", "Promjena"], ["potroseno", "Potrošeno"], ["naziv", "Naziv"]].map(([k, l]) => {
        const on = priceSort.by === k, arrow = on ? (priceSort.dir < 0 ? (k === "naziv" ? " Ž–A" : " ▼") : (k === "naziv" ? " A–Ž" : " ▲")) : "";
        return `<button data-psort="${k}" class="${on ? "on" : ""}" aria-pressed="${on}">${l}${arrow}</button>`;
      }).join("")}</div>
      ${moved.length ? `<h3 class="h">Promijenjene cijene</h3>${moved.map(row).join("")}` : ""}
      ${steady.length ? `<h3 class="h">Iste cijene</h3>${steady.map(row).join("")}` : ""}
      ${check.length ? `<h3 class="h">Treba provjeriti</h3><p class="muted small">Isti naziv po dvije cijene na istom računu, ili skok cijene kakav se ne događa — vjerojatno dva artikla (veličina boce, berba, porijeklo). Ne uspoređuje se dok se ne razdvoje; dodirnite da vidite stavke.</p>${check.map(row).join("")}` : ""}`;
  }

  /* a tap in a category picker: a group opens (or, alone, is chosen); a
     category is chosen */
  function pick(b) {
    const g = b.dataset.pickg, raw = g || b.dataset.pickc;
    const cut = raw.lastIndexOf("|"), scope = raw.slice(0, cut), val = raw.slice(cut + 1);
    const node = () => $("tab-troskovi").querySelector(`[data-pickscope="${CSS.escape(scope)}"]`);
    let c = val;
    if (g) {
      const members = GROUPS.find((x) => x[0] === val)[2];
      if (members.length > 1) {
        groupView[scope] = val;
        const n = node(); if (n) n.outerHTML = catPicker(scope, n.dataset.cur);
        return;
      }
      c = members[0];
    }
    delete groupView[scope];
    if (scope[0] === "m") {
      const i = Number(scope.slice(2));
      manual.lines[i].category = c;
      const n = node(); if (n) n.outerHTML = linePicker(i);
      return;
    }
    setCat(scope.slice(2), c);
  }
  async function setCat(idI, c) {
    const cut = idI.lastIndexOf("|"), id = idI.slice(0, cut), i = Number(idI.slice(cut + 1));
    const r = receipts.find((x) => x.id === id);
    const before = r.items[i].category;
    r.items[i].category = c; catPick = null; render();         /* at once; the server follows */
    try { await api(`/${id}/kategorija`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ i, category: c }) }); }
    catch (e) { r.items[i].category = before; err = "Kategorija nije spremljena: " + e.message; render(); }
  }

  /* ---------- wiring ---------- */
  function wire(box) {
    box.querySelectorAll("[data-rub]").forEach((b) => b.addEventListener("click", () => { openRub = openRub === b.dataset.rub ? null : b.dataset.rub; render(); }));
    box.querySelectorAll("[data-staff]").forEach((b) => b.addEventListener("click", () => { openStaff = openStaff === b.dataset.staff ? "" : b.dataset.staff; render(); }));
    box.querySelectorAll("[data-winebox]").forEach((b) => b.addEventListener("click", () => { openWineBox = openWineBox === b.dataset.winebox ? "" : b.dataset.winebox; render(); }));
    /* Za povezati: one tap writes the article into data/till-map.json */
    box.querySelectorAll("[data-tillok]").forEach((b) => b.addEventListener("click", () => saveTill(b.dataset.tillok, { ref: b.dataset.ref, vol: Number(b.dataset.vol) })));
    box.querySelectorAll("[data-tillpick]").forEach((s) => s.addEventListener("change", () => { if (s.value) saveTill(s.dataset.tillpick, { ref: s.value, vol: Number(s.dataset.vol) }); }));
    box.querySelectorAll("[data-tillnone]").forEach((b) => b.addEventListener("click", () => saveTill(b.dataset.tillnone, { none: b.dataset.none })));
    box.querySelectorAll("[data-allfocus]").forEach((b) => b.addEventListener("click", () => { allFocus = !allFocus; render(); }));
    box.querySelectorAll("[data-allcusts]").forEach((b) => b.addEventListener("click", () => { allCusts = !allCusts; render(); }));
    box.querySelectorAll("[data-sub]").forEach((b) => b.addEventListener("click", () => { sub = b.dataset.sub; render(); }));
    box.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => { month = shiftMonth(month, Number(b.dataset.m)); openGroup = null; open = null; render(); }));
    box.querySelectorAll("[data-month]").forEach((b) => b.addEventListener("click", () => { month = b.dataset.month; openGroup = null; render(); }));
    box.querySelectorAll("[data-group]").forEach((b) => b.addEventListener("click", () => { openGroup = openGroup === b.dataset.group ? null : b.dataset.group; render(); }));
    box.querySelectorAll("[data-up]").forEach((inp) => inp.addEventListener("change", () => {
      for (const f of inp.files || []) picked.push({ file: f, url: URL.createObjectURL(f) });
      err = ""; render();
    }));
    box.querySelectorAll("[data-unpick]").forEach((b) => b.addEventListener("click", () => {
      const [p] = picked.splice(Number(b.dataset.unpick), 1); if (p) URL.revokeObjectURL(p.url); render();
    }));
    box.querySelectorAll("[data-one]").forEach((b) => b.addEventListener("click", () => { oneReceipt = !!b.dataset.one; render(); }));
    box.querySelectorAll("[data-send]").forEach((b) => b.addEventListener("click", send));
    box.querySelectorAll("[data-clear]").forEach((b) => b.addEventListener("click", () => { picked.splice(0).forEach((p) => URL.revokeObjectURL(p.url)); render(); }));
    box.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => {
      open = open === b.dataset.open ? null : b.dataset.open; catPick = null; confirmDel = null; render();
    }));
    box.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => { catPick = catPick === b.dataset.cat ? null : b.dataset.cat; delete groupView[`r|${b.dataset.cat}`]; render(); }));
    if (box.id === "tab-troskovi" && !box.dataset.picks) {        /* once: the box outlives every render */
      box.dataset.picks = "1";
      box.addEventListener("click", (e) => {
        const b = e.target.closest("[data-pickg],[data-pickc]");
        if (b) pick(b);
      });
    }
    box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.del;
      if (!b.dataset.sure) { confirmDel = id; render(); return; }
      confirmDel = null;
      try { await api(`/${id}/obrisi`, { method: "POST" }); open = null; await load(); }
      catch (e) { err = "Nije obrisano: " + e.message; render(); }
    }));
    /* no receipt: typing never re-renders (the keyboard would drop); the
       total and the guessed category follow in place */
    box.querySelectorAll("[data-manual]").forEach((b) => b.addEventListener("click", () => { startManual(); render(); $("man-vendor") && $("man-vendor").focus(); }));
    box.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
      startManual(receipts.find((x) => x.id === b.dataset.edit)); sub = "racuni"; render();
      box.querySelector(".man") && box.querySelector(".man").scrollIntoView({ block: "start", behavior: "smooth" });
    }));
    /* the guess follows the words; only the picker is redrawn, never the inputs */
    const showGuess = () => manual && manual.lines.forEach((l, i) => {
      const node = box.querySelector(`[data-pickscope="m|${i}"]`);
      if (node && !l.category && !groupView[`m|${i}`] && node.dataset.cur !== lineCat(l)) node.outerHTML = linePicker(i);
    });
    box.querySelectorAll("[data-mf]").forEach((inp) => inp.addEventListener("input", () => { manual[inp.dataset.mf] = inp.value; showGuess(); }));
    box.querySelectorAll("[data-ml]").forEach((inp) => inp.addEventListener("input", () => {
      manual.lines[Number(inp.dataset.ml)][inp.dataset.k] = inp.value;
      const t = $("man-total"); if (t) t.textContent = eur(manualTotal());
      showGuess();
    }));
    box.querySelectorAll("[data-ml][data-k=total]").forEach((inp) => inp.addEventListener("keydown", (e) => {
      /* Enter on the last amount opens the next line */
      if (e.key !== "Enter") return;
      e.preventDefault();
      const i = Number(inp.dataset.ml);
      if (i === manual.lines.length - 1) manual.lines.push(blankLine());
      render(); const next = box.querySelector(`[data-ml="${i + 1}"][data-k=name]`); if (next) next.focus();
    }));
    box.querySelectorAll("[data-pay]").forEach((b) => b.addEventListener("click", () => { manual.payment = b.dataset.pay; render(); }));
    box.querySelectorAll("[data-mladd]").forEach((b) => b.addEventListener("click", () => {
      manual.lines.push(blankLine()); render();
      const last = box.querySelector(`[data-ml="${manual.lines.length - 1}"][data-k=name]`); if (last) last.focus();
    }));
    box.querySelectorAll("[data-mldel]").forEach((b) => b.addEventListener("click", () => {
      manual.lines.splice(Number(b.dataset.mldel), 1);
      Object.keys(groupView).forEach((k) => { if (k[0] === "m") delete groupView[k]; });
      render();
    }));
    box.querySelectorAll("[data-mansave]").forEach((b) => b.addEventListener("click", saveManual));
    box.querySelectorAll("[data-mancancel]").forEach((b) => b.addEventListener("click", () => { manual = null; catPick = null; err = ""; render(); }));
    box.querySelectorAll("[data-togglepaid]").forEach((b) => b.addEventListener("click", () => {
      const r = receipts.find((x) => x.id === b.dataset.togglepaid);
      if (r) markPaid(r.id, !isPaid(r));
    }));
    box.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => { kind = b.dataset.kind; open = null; render(); }));
    box.querySelectorAll("[data-psort]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.psort;
      if (priceSort.by === k) priceSort.dir = -priceSort.dir;
      else { priceSort.by = k; priceSort.dir = k === "naziv" ? 1 : -1; }
      openPrice = null; render();
    }));
    box.querySelectorAll("#pv").forEach((sel) => sel.addEventListener("change", () => { priceVendor = sel.value; openPrice = null; render(); }));
    box.querySelectorAll("[data-pricevendor]").forEach((b) => b.addEventListener("click", () => {
      priceVendor = b.dataset.pricevendor; openPrice = null; sub = "cijene"; render(); window.scrollTo(0, 0);
    }));
    box.querySelectorAll("[data-price]").forEach((b) => b.addEventListener("click", () => { openPrice = openPrice === b.dataset.price ? null : b.dataset.price; render(); }));
    box.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => {
      const r = receipts.find((x) => x.id === b.dataset.goto);
      if (!r) return;
      sub = "racuni"; month = monthOf(r); kind = ""; unpaidOnly = false; query = ""; open = r.id; catPick = null; render();
      const el = box.querySelector(`[data-open="${CSS.escape(r.id)}"]`); if (el) el.scrollIntoView({ block: "start" });
    }));
    box.querySelectorAll("[data-unpaid]").forEach((b) => b.addEventListener("click", () => { unpaidOnly = !unpaidOnly; open = null; render(); }));
    box.querySelectorAll("[data-showdup]").forEach((b) => b.addEventListener("click", () => { showDup = !showDup; render(); }));
    box.querySelectorAll("#rq").forEach((inp) => inp.addEventListener("input", () => {
      query = inp.value; open = null;
      const l = $("rlist"); if (l) { l.innerHTML = receiptList(); wire(l); }
    }));
    box.querySelectorAll("[data-notdup]").forEach((b) => b.addEventListener("click", async () => {
      try { await api(`/${b.dataset.notdup}/nije_isti`, { method: "POST" }); await load(); } catch (e) { err = e.message; render(); }
    }));
    box.querySelectorAll("[data-nodel]").forEach((b) => b.addEventListener("click", () => { confirmDel = null; render(); }));
    box.querySelectorAll("[data-retry]").forEach((b) => b.addEventListener("click", async () => {
      try { await api(`/${b.dataset.retry}/ponovi`, { method: "POST" }); await load(); } catch (e) { err = e.message; render(); }
    }));
  }
})();
