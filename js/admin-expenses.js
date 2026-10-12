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
    odrzavanje: "Održavanje", rezije: "Režije i najam", usluge: "Usluge", dekor: "Cvijeće i dekor", ostalo: "Ostalo",
  };
  /* Six groups a chef thinks in; categories inside them on a tap. */
  const GROUPS = [
    ["hrana", "Hrana", ["meso", "riba", "povrce", "mlijecno", "suha", "pekara"], "#c9a961"],
    ["pice", "Piće", ["vino", "zestoko", "pivo_sokovi", "kava"], "#a5544a"],
    ["potrosno", "Potrošno", ["ciscenje", "ambalaza", "dekor"], "#6f8f9a"],
    ["oprema", "Oprema i održavanje", ["oprema", "odrzavanje"], "#8a7bb0"],
    ["rezije", "Režije i usluge", ["rezije", "usluge"], "#6c9a6f"],
    ["ostalo", "Ostalo", ["ostalo"], "#7d776b"],
  ];
  const groupOf = (c) => (GROUPS.find((g) => g[2].includes(c)) || GROUPS[5]);
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
  const monthOf = (r) => dateOf(r).slice(0, 7);
  const hrDate = (d) => (d ? `${Number(d.slice(8, 10))}. ${Number(d.slice(5, 7))}.` : "");

  /* ---------- state ---------- */
  let opened = false;
  let receipts = [], limits = null, sub = "pregled", month = "", open = null, timer = null, err = "";
  let openGroup = null, catPick = null, confirmDel = null;
  const groupView = {};         /* picker scope → a group opened but not yet chosen from */
  const picked = [];            /* photos chosen, not yet sent */
  let oneReceipt = false, sending = "";
  /* an expense with no receipt being typed in, or one being corrected:
     {editId, vendor, date, payment, lines: [{name, total, category, picked}]} */
  let manual = null, saving = false;
  let mer = null, merBusy = false;      /* moj-eRačun: how the connection stands */
  const thumbs = new Map();

  /* ---------- the demo (owner, 2026-10-12: "mock data … so I can show Filho
     how it works") ----------
     Six months of made-up receipts from Zagreb suppliers, answered by the same
     api() every screen uses — so upload, reading, recategorising and deleting
     all behave as they will for real. Nothing leaves the phone: no request is
     made while the demo is on, and leaving it brings the real tab back. A
     receipt "sent" in the demo is "read" a few seconds later, which is the
     whole flow in one minute. */
  let demo = false, demoData = null, demoMer = null;
  function seeded(seed) {
    let s = seed;
    return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  }
  const DEMO_SHOPS = [
    ["Metro Cash & Carry", "38016445738", "kartica", [
      ["Pileća prsa", "pileca prsa", "kg", 8.49, "meso", 4, 9], ["Svinjski vrat", "svinjski vrat", "kg", 7.2, "meso", 3, 7],
      ["Maslinovo ulje ekstra djevičansko 5 l", "maslinovo ulje ekstra djevicansko", "l", 8.4, "suha", 10, 10],
      ["Brašno T-550", "brasno t550", "kg", 0.89, "suha", 10, 25], ["Tjestenina penne", "tjestenina penne", "kg", 2.1, "suha", 5, 10],
      ["Riža arborio", "riza arborio", "kg", 3.6, "suha", 3, 6], ["Vrhnje za kuhanje 1 l", "vrhnje za kuhanje", "l", 2.89, "mlijecno", 6, 12],
      ["Maslac", "maslac", "kg", 9.9, "mlijecno", 2, 4], ["Parmigiano Reggiano", "parmigiano reggiano", "kg", 21.9, "mlijecno", 1, 3],
      ["Jaja L", "jaja", "kom", 0.32, "mlijecno", 30, 90], ["Prozirna folija 300 m", "prozirna folija", "kom", 6.5, "ambalaza", 1, 2],
      ["Papir za pečenje", "papir za pecenje", "kom", 4.2, "ambalaza", 1, 3], ["Deterdžent za suđe 5 l", "deterdzent za sude", "l", 2.98, "ciscenje", 5, 10],
      ["Sol za perilicu", "sol za perilicu", "kg", 0.9, "ciscenje", 4, 8]]],
    ["Ribarnica Kaptol", "61928374650", "gotovina", [
      ["Brancin", "brancin", "kg", 18.5, "riba", 3, 8], ["Orada", "orada", "kg", 16.9, "riba", 2, 6],
      ["Škampi", "skampi", "kg", 38, "riba", 1, 3], ["Lignje", "lignje", "kg", 19.5, "riba", 1, 4]]],
    ["OPG Horvat, Dolac", "", "gotovina", [
      ["Rajčica", "rajcica", "kg", 3.2, "povrce", 5, 12], ["Tikvice", "tikvice", "kg", 2.4, "povrce", 3, 8],
      ["Bosiljak", "bosiljak", "kom", 1.2, "povrce", 5, 15], ["Krumpir", "krumpir", "kg", 1.1, "povrce", 10, 25],
      ["Limun", "limun", "kg", 2.9, "povrce", 2, 5]]],
    ["Mesnica Bobić", "28374655102", "kartica", [
      ["Junetina za gulaš", "junetina za gulas", "kg", 13.9, "meso", 3, 7], ["Juneći file", "juneci file", "kg", 39, "meso", 1, 3],
      ["Teleći obrazi", "teleci obrazi", "kg", 18.5, "meso", 2, 4]]],
    ["Vinoteka Bornstein", "90817263544", "virman", [
      ["Kunjas Pošip 2024", "kunjas posip", "kom", 14.2, "vino", 6, 12], ["Meneghetti Blanc de Blancs", "meneghetti blanc de blancs", "kom", 24, "vino", 6, 6],
      ["Pinot Grigio Vie di Romans", "vie di romans pinot grigio", "kom", 28, "vino", 3, 6]]],
    ["Pekara Dubravica", "11223344556", "gotovina", [
      ["Kruh pšenični", "kruh psenicni", "kom", 1.9, "pekara", 10, 20], ["Ciabatta", "ciabatta", "kom", 0.9, "pekara", 20, 40]]],
    ["Franck kava", "45612378901", "virman", [["Kava u zrnu 1 kg", "kava u zrnu", "kg", 19.8, "kava", 4, 8]]],
  ];
  function demoReceipts() {
    const rnd = seeded(20261012), out = [];
    const today = new Date();
    let n = 0;
    for (let back = 5; back >= 0; back--) {
      const d0 = new Date(Date.UTC(today.getFullYear(), today.getMonth() - back, 1));
      const ym = d0.toISOString().slice(0, 7);
      const fullDays = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 0)).getUTCDate();
      const lastDay = back === 0 ? today.getDate() : fullDays;
      const visits = [[0, 4], [1, 3], [2, 4], [3, 2], [4, 2], [5, 4], [6, 1]];
      for (const [si, times] of visits) {
        const [vendor, oib, pay, goods] = DEMO_SHOPS[si];
        for (let t = 0; t < times; t++) {
          /* days spread over the whole month; this month keeps only those up to today */
          const day = Math.min(fullDays, Math.max(1, Math.round(((t + 0.5) / times) * fullDays + (rnd() - 0.5) * 4)));
          if (day > lastDay) { rnd(); continue; }
          const pickN = Math.max(1, Math.min(goods.length, 2 + Math.floor(rnd() * 5)));
          const chosen = goods.slice().sort(() => rnd() - 0.5).slice(0, pickN);
          const items = chosen.map(([name, key, unit, base, category, lo, hi]) => {
            const qty = unit === "kom" || lo >= 5 ? Math.round(lo + rnd() * (hi - lo)) : Math.round((lo + rnd() * (hi - lo)) * 100) / 100;
            /* two that visibly climb, for Cijene */
            /* a few climb, one gets cheaper with the season, the rest hold */
            const months = 5 - back;
            const climb = { "maslinovo ulje ekstra djevicansko": 1 + months * 0.03, skampi: 1 + months * 0.025, "juneci file": 1 + (months >= 3 ? 0.08 : 0),
              "pileca prsa": 1 + (months >= 4 ? 0.06 : 0), rajcica: 1 - months * 0.04, "kava u zrnu": 1 + (months >= 2 ? 0.05 : 0) }[key] || 1;
            const unit_price = Math.round(base * climb * 100) / 100;
            return { name, key, qty, unit, unit_price, total: Math.round(qty * unit_price * 100) / 100, category };
          });
          const total = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
          /* invoiced suppliers arrive through moj-eRačun; the market stall
             has no receipt and is typed in by hand */
          const source = si === 2 ? "rucno" : pay === "virman" || si === 0 ? "mer" : "foto";
          out.push({ id: `demo-${++n}`, created_at: `${ym}-${String(day).padStart(2, "0")}T10:00:00Z`, updated_at: "",
            created_by: source === "mer" ? "MER" : "Filho", source, dup_of: "",
            status: "done", vendor, vendor_oib: oib, doc_date: `${ym}-${String(day).padStart(2, "0")}`, doc_no: `${n}/1/1`,
            total, vat: source === "rucno" ? null : Math.round(total * 0.16 * 100) / 100, payment: pay,
            items: source === "rucno" ? items.map((i) => ({ ...i, qty: null, unit: "", unit_price: null, key: i.key })) : items,
            note: "", error: "", photos: [] });
        }
      }
      /* the monthly bills */
      for (const [vendor, name, key, amount, category, day] of [
        ["HEP Elektra", "Električna energija", "struja", 610 + (5 - back) * 18, "rezije", 20],
        ["Gradska plinara Zagreb", "Plin", "plin", 240 - back * 6, "rezije", 18],
        ["Najam prostora", "Najam", "najam", 2500, "rezije", 1],
        ["Knjigovodstvo Marić", "Knjigovodstvene usluge", "knjigovodstvo", 300, "usluge", 5]]) {
        if (day > lastDay) continue;
        out.push({ id: `demo-${++n}`, created_at: `${ym}-${String(day).padStart(2, "0")}T09:00:00Z`, updated_at: "", created_by: "Filho",
          status: "done", vendor, vendor_oib: "", doc_date: `${ym}-${String(day).padStart(2, "0")}`, doc_no: "", total: amount, vat: null,
          payment: "virman", items: [{ name, key, qty: 1, unit: "kom", unit_price: amount, total: amount, category }], note: "", error: "", photos: [] });
      }
    }
    /* the repairman, paid in cash, no receipt */
    for (const [back, name, amount] of [[1, "Popravak bojlera", 80], [3, "Servis rashladne vitrine", 120]]) {
      const d = new Date(Date.UTC(today.getFullYear(), today.getMonth() - back, 14)).toISOString().slice(0, 10);
      out.push({ id: `demo-${++n}`, created_at: d + "T12:00:00Z", updated_at: "", created_by: "Filho", source: "rucno", dup_of: "",
        status: "done", vendor: "Majstor Ivo", vendor_oib: "", doc_date: d, doc_no: "", total: amount, vat: null, payment: "gotovina",
        items: [{ name, key: "", qty: null, unit: "", unit_price: null, total: amount, category: "odrzavanje" }], note: "", error: "", photos: [] });
    }
    /* a Metro invoice photographed although it also came from moj-eRačun */
    const twin = out.filter((r) => r.source === "mer" && r.vendor.startsWith("Metro")).pop();
    if (twin) out.push({ ...twin, id: "demo-dvaput", source: "foto", created_by: "Filho", dup_of: twin.id });
    /* one that could not be read, as it will happen */
    out.push({ id: "demo-mutan", created_at: today.toISOString(), updated_at: "", created_by: "Filho", status: "failed",
      vendor: "", items: [], photos: [], note: "", error: "Slika je mutna — ukupni iznos se ne vidi. Slikajte račun ravno, pri svjetlu." });
    return out.sort((a, b) => (b.doc_date || b.created_at).localeCompare(a.doc_date || a.created_at));
  }
  /* a receipt "sent" in the demo is read a few seconds later */
  function demoRead(r) {
    const rnd = seeded(Date.now() % 100000);
    const [vendor, oib, pay, goods] = DEMO_SHOPS[Math.floor(rnd() * 3)];
    const items = goods.slice(0, 3 + Math.floor(rnd() * 3)).map(([name, key, unit, base, category, lo, hi]) => {
      const qty = unit === "kom" || lo >= 5 ? Math.round(lo + rnd() * (hi - lo)) : Math.round((lo + rnd() * (hi - lo)) * 100) / 100;
      const unit_price = Math.round(base * 1.1 * 100) / 100;
      return { name, key, qty, unit, unit_price, total: Math.round(qty * unit_price * 100) / 100, category };
    });
    const total = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
    Object.assign(r, { status: "done", vendor, vendor_oib: oib, payment: pay, doc_date: new Date().toISOString().slice(0, 10),
      doc_no: "99/1/1", total, vat: Math.round(total * 0.16 * 100) / 100, items });
  }
  async function demoApi(path, opts = {}) {
    await new Promise((res) => setTimeout(res, 250));
    const method = opts.method || "GET";
    if (!path && method === "GET") return { items: demoData, limits: { ready: true }, mer: demoMer };
    if (path === "/mer") { demoMer = { ...demoMer, last_ok: new Date().toISOString() }; return { mer: demoMer }; }
    if (!path && method === "POST" && typeof opts.body === "string") {
      const b = JSON.parse(opts.body);
      const r = { id: `demo-new-${Date.now()}`, created_at: new Date().toISOString(), updated_at: "", created_by: b.by || "Filho",
        source: "rucno", dup_of: "", status: "done", vendor: b.vendor || b.items[0].name, vendor_oib: "", doc_date: b.doc_date, doc_no: "",
        total: Math.round(b.items.reduce((s, i) => s + i.total, 0) * 100) / 100, vat: null, payment: b.payment,
        items: b.items.map((i) => ({ ...i, key: "", qty: null, unit: "", unit_price: null })), note: "", error: "", photos: [] };
      demoData.unshift(r);
      return { ok: true, item: r };
    }
    if (!path && method === "POST") {
      const r = { id: `demo-new-${Date.now()}`, created_at: new Date().toISOString(), updated_at: "", created_by: who() || "Filho",
        status: "working", source: "foto", dup_of: "", vendor: "", items: [], photos: [], note: "", error: "" };
      demoData.unshift(r);
      setTimeout(() => { demoRead(r); if (demo) load(); }, 5000);
      return { ok: true, item: r };
    }
    const [, id, action] = path.split("/");
    const r = demoData.find((x) => x.id === id);
    if (!r) throw new Error("not_found");
    if (action === "kategorija") { const b = JSON.parse(opts.body); r.items[b.i].category = b.category; return { ok: true }; }
    if (action === "obrisi") {
      demoData = demoData.filter((x) => x !== r);
      demoData.forEach((x) => { if (x.dup_of === r.id) x.dup_of = ""; });
      return { ok: true };
    }
    if (action === "nije_isti") { r.dup_of = ""; return { ok: true }; }
    if (action === "uredi") {
      const b = JSON.parse(opts.body);
      Object.assign(r, { vendor: b.vendor || b.items[0].name, doc_date: b.doc_date, payment: b.payment,
        total: Math.round(b.items.reduce((s, i) => s + i.total, 0) * 100) / 100,
        items: b.items.map((i) => ({ ...i, key: "", qty: null, unit: "", unit_price: null })) });
      return { ok: true };
    }
    if (action === "ponovi") {
      r.status = "working"; r.error = "";
      setTimeout(() => { demoRead(r); if (demo) load(); }, 5000);
      return { ok: true };
    }
    return { ok: true };
  }
  function setDemo(on) {
    demo = on; demoData = on ? demoReceipts() : null;
    demoMer = on ? { state: "ok", last_ok: new Date(Date.now() - 12 * 60000).toISOString(), error: "", imported: 0 } : null;
    manual = null;
    open = null; openGroup = null; catPick = null; confirmDel = null; err = "";
    sub = "pregled"; month = new Date().toISOString().slice(0, 7);
    load();
  }

  async function api(path, opts = {}) {
    if (demo) return demoApi(path, opts);
    const r = await fetch(API + path, { ...opts, headers: { authorization: "Bearer " + ghKey(), ...(opts.headers || {}) } });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error || "HTTP " + r.status);
    return b;
  }

  async function load() {
    clearTimeout(timer);
    try {
      const b = await api("");
      receipts = b.items || []; limits = b.limits; mer = b.mer || null; err = "";
    } catch (e) { err = "Ne mogu učitati troškove: " + e.message; }
    if (!month) month = latestMonth();
    /* until the first receipt is read, the tab opens where receipts are added */
    if (!opened) { opened = true; if (!receipts.some((r) => r.status === "done")) sub = "racuni"; }
    render();
    if (visible() && receipts.some((r) => r.status === "queued" || r.status === "working")) timer = setTimeout(load, demo ? 1500 : POLL_MS);
  }
  const visible = () => { const t = $("tab-troskovi"); return t && !t.classList.contains("hidden"); };
  const latestMonth = () => new Date().toISOString().slice(0, 7);
  window.loadExpenses = load;

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
        ${[["pregled", "Pregled"], ["racuni", "Računi"], ["cijene", "Cijene"]].map(([k, l]) =>
          `<button data-sub="${k}" class="${sub === k ? "on" : ""}" aria-pressed="${sub === k}">${l}</button>`).join("")}
      </div>
      ${demo ? `<div class="demo-bar"><span><b>Primjer</b> s izmišljenim računima — ništa se ne sprema.</span>
        <button class="linkbtn" data-demo="">izađi iz primjera</button></div>` : ""}
      ${err ? `<p class="err">${esc(err)}</p>` : ""}
      ${waiting ? `<p class="muted small center"><span class="spin"></span> ${waiting} ${waiting === 1 ? "račun se čita" : "računa se čita"} — ${demo ? "u primjeru nekoliko sekundi" : "obično minuta-dvije"}.</p>` : ""}
      ${sub === "pregled" ? overview() : sub === "racuni" ? receiptsView() : pricesView()}
      ${demo ? "" : `<p class="center" style="margin:28px 0 8px"><button class="linkbtn" data-demo="1">Pogledaj primjer s izmišljenim računima</button></p>`}`;
    wire(box);
  }

  function monthNav() {
    const now = new Date().toISOString().slice(0, 7);
    return `<div class="mnav"><button data-m="-1" aria-label="Prethodni mjesec">‹</button>
      <b>${esc(monthName(month))}</b>
      <button data-m="1" aria-label="Sljedeći mjesec" ${month >= now ? "disabled" : ""}>›</button></div>`;
  }

  function overview() {
    const list = inMonth(month), prev = inMonth(shiftMonth(month, -1));
    const total = list.reduce((s, r) => s + totalOf(r), 0), prevTotal = prev.reduce((s, r) => s + totalOf(r), 0);
    if (!done().length) {
      /* Receipts are added in one place only, Računi (owner, 2026-10-12:
         "why does Pregled also let me upload?"). */
      return `<p class="muted center">Još nema pročitanih računa. Kad ih dodate, ovdje se vidi kamo odlazi novac.</p>
        <button class="btn wide" data-sub="racuni">Dodaj račun</button>`;
    }
    /* A month still running is compared with the same days of the last one
       — 12 days of October against all of September always looks like a drop. */
    const pm = shiftMonth(month, -1), pmName = MONTHS_GEN[Number(pm.slice(5, 7)) - 1];
    const running = month === new Date().toISOString().slice(0, 7);
    const upTo = new Date().getDate();
    const prevSame = running ? prev.filter((r) => Number(dateOf(r).slice(8, 10)) <= upTo).reduce((s, r) => s + totalOf(r), 0) : prevTotal;
    const p = pct(total, prevSame);
    const cmp = prevSame && list.length
      ? `<span class="${p > 0 ? "up" : "down"}">${p > 0 ? "▲" : "▼"} ${Math.abs(p)}%</span> ${running
          ? `u odnosu na 1.–${upTo}. ${pmName} (${eur0(prevSame)})` : `u odnosu na ${MONTHS[Number(pm.slice(5, 7)) - 1]} (${eur0(prevSame)})`}`
      : "";
    const { cats, rest } = byCategory(list);
    const groups = GROUPS.map(([k, label, members, color]) => ({
      k, label, color, sum: members.reduce((s, c) => s + (cats[c] || 0), 0) + (k === "ostalo" ? rest : 0),
      parts: members.map((c) => [c, cats[c] || 0]).filter(([, v]) => Math.abs(v) > 0.004).sort((a, b) => b[1] - a[1]),
    })).filter((g) => Math.abs(g.sum) > 0.004).sort((a, b) => b.sum - a.sum);
    const max = Math.max(...groups.map((g) => g.sum), 1);
    const bars = groups.map((g) => `
      <button class="bar" data-group="${g.k}" aria-expanded="${openGroup === g.k}">
        <span class="bl">${esc(g.label)}</span><span class="bv">${eur0(g.sum)} <small>${total ? Math.round((g.sum / total) * 100) : 0}%</small></span>
        <span class="track"><span style="width:${Math.max(2, (g.sum / max) * 100)}%;background:${g.color}"></span></span>
      </button>
      ${openGroup === g.k ? `<div class="parts">${g.parts.map(([c, v]) =>
        `<div><span>${esc(CAT[c])}</span><span>${eur0(v)}</span></div>`).join("")}${g.k === "ostalo" && Math.abs(rest) > 0.05
        ? `<div><span>nerazvrstano</span><span>${eur0(rest)}</span></div>` : ""}</div>` : ""}`).join("");

    /* suppliers */
    const vend = {};
    for (const r of list) { const v = r.vendor || "Nepoznat"; vend[v] = (vend[v] || 0) + totalOf(r); }
    const topV = Object.entries(vend).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const vmax = Math.max(...topV.map(([, v]) => v), 1);

    /* six months */
    const six = [...Array(6)].map((_, i) => shiftMonth(month, i - 5));
    const sums = six.map((m) => inMonth(m).reduce((s, r) => s + totalOf(r), 0));
    const smax = Math.max(...sums, 1);

    /* the biggest single lines this month */
    const lines = list.flatMap((r) => r.items.map((i) => ({ ...i, vendor: r.vendor, date: dateOf(r) })))
      .filter((i) => i.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

    const days = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
    const today = new Date().toISOString().slice(0, 7) === month ? new Date().getDate() : days;
    return `
      ${monthNav()}
      ${list.length ? `
      <div class="big"><b>${eur0(total)}</b>
        <span class="muted small">${list.length} ${list.length % 10 === 1 && list.length % 100 !== 11 ? "račun" : "računa"} · prosječno ${eur0(total / Math.max(1, today))} dnevno</span>
        ${cmp ? `<span class="small">${cmp}</span>` : ""}
        ${(() => {
          const cash = list.filter((r) => r.source === "rucno"), sum = cash.reduce((s, r) => s + totalOf(r), 0);
          return cash.length ? `<span class="muted small">od toga bez računa ${eur0(sum)} (${cash.length} ${plural(cash.length, "upis", "upisa", "upisa")})</span>` : "";
        })()}</div>
      <h3 class="h">Kamo ide novac</h3>
      <div class="bars">${bars}</div>
      <h3 class="h">Dobavljači</h3>
      <div class="vend">${topV.map(([v, s]) => `<div><span class="vn">${esc(v)}</span><span class="vt">${eur0(s)}</span>
        <span class="track"><span style="width:${(s / vmax) * 100}%"></span></span></div>`).join("")}</div>
      <h3 class="h">Najveće stavke</h3>
      <div class="lines">${lines.map((i) => `<div><span>${esc(i.name)}<small>${esc(i.vendor || "")} · ${hrDate(i.date)}</small></span><b>${eur(i.total)}</b></div>`).join("")}</div>`
      : `<p class="muted center">U ${MONTHS_LOC[Number(month.slice(5, 7)) - 1]} nema računa.</p>`}
      <h3 class="h">Zadnjih 6 mjeseci</h3>
      <div class="cols">${six.map((m, i) => `<button data-month="${m}" class="${m === month ? "on" : ""}">
        <span class="cv">${sums[i] ? eur0(sums[i]).replace(" €", "") : ""}</span>
        <span class="cb"><span style="height:${Math.max(sums[i] ? 3 : 0, (sums[i] / smax) * 100)}%"></span></span>
        <span class="cl">${MONTHS[Number(m.slice(5, 7)) - 1].slice(0, 3)}</span></button>`).join("")}</div>`;
  }

  /* ---------- upload ---------- */
  function uploadCard(compact) {
    if (manual) return manualForm();
    const n = picked.length;
    return `<div class="card up${compact && !n ? " compact" : ""}">
      ${compact && !n ? "" : `<p class="muted small" style="margin:0 0 10px">Slikajte račun ili ga odaberite iz galerije. Dug račun može imati više slika. Gotovina bez računa (plac, majstor) upisuje se ručno.</p>`}
      <div class="ch-acts">
        <label class="nema shot-btn">📷 Slikaj račun<input type="file" accept="image/*" capture="environment" data-up></label>
        <label class="nema shot-btn">🖼 Galerija<input type="file" accept="image/*,.heic,.heif" multiple data-up></label>
      </div>
      ${n ? "" : `<button class="nema man-btn" data-manual="">✍️ Plaćeno bez računa — upiši</button>`}
      ${n ? `<div class="pics up-pics">${picked.map((f, i) => `<span class="upth" style="background-image:url(${esc(f.url)})"><button data-unpick="${i}" aria-label="Makni sliku">✕</button></span>`).join("")}</div>
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
    [/majstor|popravak|popravi|servis|vodoinstal|elektri[cč]ar|bravar|stolar|keramičar|keramicar|limar|klima/i, "odrzavanje"],
    [/povr[cć]|vo[cć]e|salat|raj[cč]ic|krumpir|luk|gljiv|tikvic|paprik|limun|bilj|za[cč]in|plac|tr[zž]nic|dolac|opg/i, "povrce"],
    [/meso|mesn|pilet|piler|junet|june[cć]|svinj|tele[cć]|janj|kobasic|pr[sš]ut|slanin/i, "meso"],
    [/rib|[sš]kamp|lign|[sš]kolj|kamenic|dagnj|hobotnic/i, "riba"],
    [/mlijek|sir|jaja|jaje|vrhnj|maslac|jogurt/i, "mlijecno"],
    [/kruh|pekar|peciv|kifl/i, "pekara"],
    [/cvije[cć]|svije[cć]|dekor|ukras/i, "dekor"],
    [/[cč]i[sš][cć]|deterd|sapun|spu[zž]v/i, "ciscenje"],
    [/led|leda|vre[cć]ic|folij|salvet|ambala/i, "ambalaza"],
    [/vin[oa]/i, "vino"], [/kav[ae]?|[cč]aj/i, "kava"], [/piv[oa]|sok|vod[ae]/i, "pivo_sokovi"],
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
    const members = (GROUPS.find((x) => x[0] === g) || GROUPS[5])[2];
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
      manual = null; saving = false; catPick = null;
      await load();
    } catch (e) { saving = false; err = "Nije spremljeno: " + e.message; render(); }
  }

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
        for (const p of g) fd.append("photo", await shrink(p.file), "racun.jpg");
        fd.append("by", who());
        await api("", { method: "POST", body: fd });
      }
      picked.splice(0).forEach((p) => URL.revokeObjectURL(p.url));
      oneReceipt = false; sending = "";
      sub = "racuni";
      await load();
    } catch (e) { sending = ""; err = "Nije poslano: " + e.message; render(); }
  }

  /* ---------- receipts ---------- */
  function receiptsView() {
    /* grouped by month, each with its total, newest first */
    let lastMonth = "";
    const rows = receipts.map((r) => {
      const m = monthOf(r);
      let headline = "";
      if (m !== lastMonth) {
        lastMonth = m;
        const sum = inMonth(m).reduce((s, x) => s + totalOf(x), 0);
        headline = `<h3 class="h mh"><span>${esc(monthName(m))}</span><span>${sum ? eur0(sum) : ""}</span></h3>`;
      }
      return headline + receiptRow(r);
    }).join("");
    return `${uploadCard()}${merLine()}${rows || `<p class="muted center">Nema računa.</p>`}`;
  }

  /* moj-eRačun: one quiet line. E-invoices come in by themselves; the line
     says when the inbox was last asked, or what is missing. */
  function merLine() {
    if (!mer) return "";
    const at = (iso) => {
      if (!iso) return "";
      const d = new Date(iso), t = d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
      return d.toDateString() === new Date().toDateString() ? `danas u ${t}` : `${d.getDate()}. ${d.getMonth() + 1}. u ${t}`;
    };
    const btn = merBusy ? `<span><span class="spin"></span> provjeravam…</span>` : `<button class="linkbtn" data-mer>provjeri sada</button>`;
    if (mer.state === "not_set_up") return `<p class="mer">📨 e-Računi iz moj-eRačuna stizat će ovdje sami — spajanje je u pripremi.</p>`;
    if (mer.state === "error") return `<p class="mer"><span class="badge bad">moj-eRačun se ne javlja</span><span>${esc(mer.error)}</span>${btn}</p>`;
    return `<p class="mer">📨 e-Računi iz moj-eRačuna stižu sami${mer.last_ok ? ` · provjereno ${at(mer.last_ok)}` : ""}${btn}</p>`;
  }

  function receiptRow(r) {
    {
      const st = r.status;
      const badge = st === "done" ? "" : st === "failed" ? `<span class="badge bad">nije pročitan</span>`
        : `<span class="badge">${r.source === "mer" ? "razvrstava se" : "čita se"}</span>`;
      const src = r.source === "mer" ? `<span class="badge src">e-račun</span>` : r.source === "rucno" ? `<span class="badge src">bez računa</span>` : "";
      const head = `<button class="rhead" data-open="${esc(r.id)}" aria-expanded="${open === r.id}">
        <span class="rv">${esc(r.vendor || (st === "done" ? "Nepoznat" : "Račun"))}${src}${r.dup_of ? `<span class="badge src dup">dvaput</span>` : ""}<small>${hrDate(dateOf(r))}${r.items.length ? ` · ${r.items.length} ${plural(r.items.length, "stavka", "stavke", "stavki")}` : ""}${r.created_by ? ` · ${esc(r.created_by)}` : ""}</small></span>
        <span class="rt">${st === "done" ? eur(totalOf(r)) : badge}</span></button>`;
      const cls = r.dup_of ? " dup" : "";
      if (open !== r.id) return `<div class="rec${cls}">${head}</div>`;
      return `<div class="rec open${cls}">${head}
        ${r.dup_of ? `<p class="muted small">Isti račun stigao je i kao e-račun iz moj-eRačuna, pa se ovaj ne zbraja. Slobodno ga obrišite.
          <button class="linkbtn" data-notdup="${esc(r.id)}">nije isti račun</button></p>` : ""}
        ${r.note ? `<p class="muted small">${esc(r.note)}</p>` : ""}
        ${st === "failed" ? `<p class="err">${esc(r.error || "Račun se ne može pročitati.")}</p>` : ""}
        ${r.items.length ? `<div class="items">${r.items.map((it, i) => `
          <div class="it"><span class="in">${esc(it.name)}${it.qty != null ? `<small>${String(it.qty).replace(".", ",")} ${esc(it.unit || "")}${it.unit_price != null ? ` × ${eur(it.unit_price)}` : ""}</small>` : ""}</span>
            <b>${eur(it.total)}</b>
            <button class="chip" data-cat="${esc(r.id)}|${i}" style="border-color:${groupOf(it.category)[3]}">${esc(CAT[it.category] || it.category)} ▾</button>
            ${catPick === `${r.id}|${i}` ? catPicker(`r|${r.id}|${i}`, it.category) : ""}
          </div>`).join("")}</div>` : ""}
        ${r.vat != null ? `<p class="muted small">PDV ${eur(r.vat)}${r.payment ? ` · ${esc(r.payment)}` : ""}${r.doc_no ? ` · br. ${esc(r.doc_no)}` : ""}</p>`
          : r.source === "rucno" ? `<p class="muted small">Plaćeno ${esc(r.payment || "gotovina")}, bez računa${r.created_by ? ` · upisao ${esc(r.created_by)}` : ""}</p>` : ""}
        <div class="pics">${r.photos.map((n) => thumb(r, n)).join("")}</div>
        ${confirmDel === r.id
          ? `<div class="ch-acts"><button class="nema all" data-del="${esc(r.id)}" data-sure="1">da, obriši račun</button><button class="nema cancel" data-nodel>odustani</button></div>`
          : `<div class="ch-acts">${st === "failed" ? `<button class="nema ok" data-retry="${esc(r.id)}">pokušaj ponovno</button>` : ""}
              ${r.source === "rucno" ? `<button class="nema" data-edit="${esc(r.id)}">ispravi</button>` : ""}
              ${st === "working" ? "" : `<button class="nema" data-del="${esc(r.id)}">obriši</button>`}</div>`}
      </div>`;
    }
  }

  function thumb(r, n) {
    const id = r.id, k = id + "|" + n;
    if (!thumbs.has(k)) loadThumb(id, n);
    const url = thumbs.get(k);
    /* an e-invoice's attachment is the supplier's PDF, not a photo */
    if (r.source === "mer") return url ? `<a class="nema shot-btn" href="${esc(url)}" target="_blank" rel="noopener">📄 Račun u PDF-u</a>` : "";
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="Račun, slika ${n}"></a>` : `<span class="ph">${n}</span>`;
  }
  async function loadThumb(id, n) {
    const k = id + "|" + n;
    thumbs.set(k, "");
    try {
      const r = await fetch(`${API}/${id}/foto/${n}`, { headers: { authorization: "Bearer " + ghKey() } });
      if (!r.ok) throw new Error(r.status);
      thumbs.set(k, URL.createObjectURL(await r.blob()));
      render();
    } catch { thumbs.delete(k); }
  }

  /* ---------- prices ---------- */
  function pricesView() {
    const seen = {};
    for (const r of done().slice().sort((a, b) => dateOf(a).localeCompare(dateOf(b)))) {
      for (const it of r.items) {
        /* products only: a bill or a service has no unit price worth following */
        if (!it.key || it.unit_price == null || it.unit_price <= 0 || ["rezije", "usluge", "odrzavanje"].includes(it.category)) continue;
        const k = it.key + "|" + (it.unit || "");
        (seen[k] = seen[k] || []).push({ p: it.unit_price, d: dateOf(r), v: r.vendor, name: it.name, unit: it.unit, spent: it.total || 0 });
      }
    }
    const rows = Object.values(seen).filter((h) => h.length >= 2).map((h) => {
      const last = h[h.length - 1], prev = h[h.length - 2], first = h[0];
      return { name: last.name, unit: last.unit, last, prev, first, n: h.length, change: pct(last.p, prev.p),
               since: pct(last.p, first.p), spent: h.reduce((s, x) => s + x.spent, 0) };
    });
    if (!rows.length) {
      return `<p class="muted center">Kad isti proizvod kupite barem dvaput, ovdje se vidi kako mu se mijenja cijena.</p>`;
    }
    /* moved = changed since the last purchase, or since the first one we have */
    const moved = rows.filter((r) => r.change || r.since).sort((a, b) => Math.abs(b.change || b.since) - Math.abs(a.change || a.since));
    const steady = rows.filter((r) => !r.change && !r.since).sort((a, b) => b.spent - a.spent);
    const mname = (d) => MONTHS_LOC[Number(d.slice(5, 7)) - 1];
    const arrow = (v, text) => `<span class="${v > 0 ? "up" : "down"}">${v > 0 ? "▲" : "▼"} ${Math.abs(v)}%${text}</span>`;
    const row = (r) => {
      const where = r.last.v === r.prev.v ? esc(r.last.v || "") : `${esc(r.prev.v || "")} → ${esc(r.last.v || "")}`;
      const was = r.change ? `prije ${eur(r.prev.p)}` : r.since ? `u ${mname(r.first.d)} ${eur(r.first.p)}` : "";
      return `<div class="pr">
      <span class="pn">${esc(r.name)}<small>${where} · ${r.n}× · zadnje ${hrDate(r.last.d)}${was ? ` · ${was}` : ""}</small></span>
      <span class="pp"><b>${eur(r.last.p)}</b><small>/${esc(r.unit || "kom")}</small>
        ${r.change ? arrow(r.change, "") : r.since ? arrow(r.since, ` od ${MONTHS_GEN[Number(r.first.d.slice(5, 7)) - 1]}`) : `<span class="muted">ista</span>`}</span></div>`;
    };
    return `<p class="muted small">Isti proizvod, zadnja kupnja prema prethodnoj. Cijena po kg, l ili komadu, s PDV-om.</p>
      ${moved.length ? `<h3 class="h">Promijenjene cijene</h3>${moved.map(row).join("")}` : ""}
      ${steady.length ? `<h3 class="h">Iste cijene</h3>${steady.map(row).join("")}` : ""}`;
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
    box.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", () => setDemo(!!b.dataset.demo)));
    box.querySelectorAll("[data-sub]").forEach((b) => b.addEventListener("click", () => { sub = b.dataset.sub; render(); }));
    box.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => { month = shiftMonth(month, Number(b.dataset.m)); openGroup = null; render(); }));
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
    if (!box.dataset.picks) {        /* once: the box outlives every render */
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
    box.querySelectorAll("[data-notdup]").forEach((b) => b.addEventListener("click", async () => {
      try { await api(`/${b.dataset.notdup}/nije_isti`, { method: "POST" }); await load(); } catch (e) { err = e.message; render(); }
    }));
    box.querySelectorAll("[data-mer]").forEach((b) => b.addEventListener("click", async () => {
      merBusy = true; render();
      try { const r = await api("/mer", { method: "POST" }); mer = r.mer; await load(); }
      catch (e) { err = "moj-eRačun: " + e.message; }
      merBusy = false; render();
    }));
    box.querySelectorAll("[data-nodel]").forEach((b) => b.addEventListener("click", () => { confirmDel = null; render(); }));
    box.querySelectorAll("[data-retry]").forEach((b) => b.addEventListener("click", async () => {
      try { await api(`/${b.dataset.retry}/ponovi`, { method: "POST" }); await load(); } catch (e) { err = e.message; render(); }
    }));
  }
})();
