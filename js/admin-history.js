/* Theatrium admin — "Povijest" (moved out of admin-wines.js, 2026-11-17).
 *
 * What changed on the list, newest first, from the repository's own commits —
 * wines added, prices, what ran out — and, beside them, who marked which
 * invoice paid, from Troškovi's own log (/api/troskovi/povijest).
 *
 * Its own file because that second half is Troškovi's: this script is loaded
 * by js/admin.js for a full key only, so a sommelier's page never has it, and
 * the server refuses him the endpoint as well (web/ROLES.md).
 */
"use strict";
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---------- Povijest ---------- */
  window.loadHistory = async function loadHistory() {
    if (!window.adminMode || window.adminMode() !== "full") return;   /* never for a sommelier key */
    const box = $("tab-povijest");
    if (!box) return;
    const token = localStorage.getItem("theatrium-admin-token") || "";
    box.innerHTML = `<p class="muted">Učitavam…</p>`;
    try {
      const paths = ["lists/theatrium.json", "data/unavailable.json", "library/wines.json"];
      /* Troškovi keeps its own log beside the receipts (never in git); a
         failure there must not cost the wine list its history */
      const expenses = fetch("https://theatrium.devinos.hr/api/troskovi/povijest", { headers: { Authorization: "Bearer " + token } })
        .then((r) => (r.ok ? r.json() : { events: [] })).then((b) => b.events || []).catch(() => []);
      /* Dodaj vino and Ponuda keep theirs in D1 (staff_log), named by the
         server — the sommelier's work among it (owner, 2026-11-17: "we need
         to see his activities in history, but he should not see any
         history"; /api/dnevnik is full keys only) */
      const staff = fetch("https://theatrium.devinos.hr/api/dnevnik", { headers: { Authorization: "Bearer " + token } })
        .then((r) => (r.ok ? r.json() : { events: [] })).then((b) => b.events || []).catch(() => []);
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
        : /^Cijena:/.test(m) ? "cijena" : /^Na čašu:/.test(m) ? "casa" : /^NOVO:/.test(m) ? "flag"
        : /joins NOVO|joins the list|joins|^Novo vino|^Dodaj vino/i.test(m) ? "novo" : null);
      const label = { novo: "Dodano", makn: "Skinuto", vrac: "Vraćeno", cijena: "Cijena", casa: "Na čašu", flag: "NOVO",
                      placeno: "PLAĆENO", neplaceno: "NEPLAĆENO", vina: "Dodaj vino", ponuda: "Ponuda" };
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
          if (k) entries.push({ at: c.commit.author.date, item, k, by });
        }
      }
      const money = (n) => (n == null ? "" : " · " + new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " €");
      for (const e of await expenses) {
        entries.push({ at: e.at, item: `Račun: ${e.vendor || "bez naziva"}${money(e.amount)}`, k: e.action, by: e.who || "?" });
      }
      for (const e of await staff) {
        if (e.area === "vina" || e.area === "ponuda") entries.push({ at: e.at, item: e.what, k: e.area, by: e.who || "?" });
      }
      entries.sort((a, b) => b.at.localeCompare(a.at));
      box.innerHTML = entries.slice(0, 80).map(({ at, item, k, by }) => {
        const d = new Date(at).toLocaleString("hr-HR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
        let badge = label[k], what = item;
        if (k === "makn" || k === "vrac") {
          badge += /čašu/.test(item) ? " (čaša)" : /bocu/.test(item) ? " (boca)" : "";
          what = item.replace(/^(Nema na čašu|Nema na bocu|Nema|Vraćeno na kartu):\s*/, "");
        } else if (k === "cijena") {
          what = item.replace(/^Cijena:\s*/, "");
        } else if (k === "casa") {
          /* a bottle now poured by the glass, from "+ čaša" on the board (2026-10-23) */
          what = item.replace(/^Na čašu:\s*/, "");
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
  };
})();
