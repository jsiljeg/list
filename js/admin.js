/* Theatrium — the 86 board.
 *
 * A switch per wine. Flipping one rewrites data/unavailable.json through the
 * GitHub contents API, the deploy publishes it, and every tablet's 30-second
 * poll picks it up. Two taps instead of editing JSON on a tablet keyboard
 * mid-service.
 *
 * What is and isn't security, stated plainly because the repo is public and
 * this page is served with it:
 *   - The PIN is a screen lock. It stops a guest who wanders onto /admin from
 *     seeing the board. It is client-side and protects nothing else.
 *   - The GitHub token is the only real credential. It lives in this tablet's
 *     localStorage. Issue it fine-grained, scoped to jsiljeg/list, Contents:
 *     Read and write, and nothing else — then the worst anyone who takes the
 *     tablet can do is hide and unhide wines on our own list, and revoking it
 *     on github.com/settings/tokens takes a minute.
 *
 * The receipt is the point of the page. A switch you don't trust is worse than
 * typing JSON, because typing JSON at least feels like it did something — so
 * the page never says "done", it reports saved → published → on the tablets,
 * and verifies the middle step by re-fetching the live file rather than
 * assuming the deploy worked.
 */
"use strict";

const REPO = "jsiljeg/list";
const PATH = "data/unavailable.json";
const BRANCH = "main";
/* Change this to whatever the staff will remember. It is visible to anyone who
   reads this file — the repo is public — and that is fine, because it guards a
   screen and not a credential. The token is the credential. */
const PIN = "7777";
const LS_TOKEN = "theatrium-admin-token";
const POLL_MS = 4000;               /* how often we re-check the published file */
const PUBLISH_TIMEOUT_MS = 180000;  /* deploys run 20–50s; give it three minutes */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let token = "";
let wines = [];        /* one row per distinct wine: {key, name, producer, inGlass, inBottle} */
let rules = [];        /* the current contents of unavailable.json */
let sha = null;        /* the blob sha we last saw, for the conditional write */
let onlyOff = false;
let queue = [];        /* commit messages waiting to be written */
let draining = false;

/* ---------- base64 that survives Croatian ----------
   btoa() throws on anything above U+00FF, and the reasons people type contain
   č, ž and đ. Encode to UTF-8 bytes first, decode back the same way. */
const b64encode = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str)));
const b64decode = (b64) => new TextDecoder().decode(
  Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();
const keyOf = (producer, name) => norm(producer) + "|" + norm(name);
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- gate ---------- */
function showGate() {
  $("gate").classList.remove("hidden");
  $("setup").classList.add("hidden");
  $("main").classList.add("hidden");
  $("pin").focus();
}
function afterPin() {
  token = localStorage.getItem(LS_TOKEN) || "";
  $("gate").classList.add("hidden");
  if (!token) { $("setup").classList.remove("hidden"); $("token").focus(); return; }
  start();
}
$("pin-go").addEventListener("click", () => {
  if ($("pin").value.trim() === PIN) { $("pin-err").textContent = ""; afterPin(); }
  else { $("pin-err").textContent = "Pogrešan PIN."; $("pin").value = ""; }
});
$("pin").addEventListener("keydown", (e) => { if (e.key === "Enter") $("pin-go").click(); });

$("token-go").addEventListener("click", async () => {
  const t = $("token").value.trim();
  if (!t) return;
  $("token-err").textContent = "provjeravam…";
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}?ref=${BRANCH}`,
      { headers: ghHeaders(t) });
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403
      ? "GitHub odbija ovaj ključ. Provjerite da je fine-grained, za jsiljeg/list, s dozvolom Contents: Read and write."
      : `GitHub je vratio ${r.status}.`);
    localStorage.setItem(LS_TOKEN, t);
    token = t;
    $("setup").classList.add("hidden");
    start();
  } catch (e) {
    $("token-err").textContent = e.message || String(e);
  }
});
$("logout").addEventListener("click", () => {
  if (!confirm("Obrisati ključ s ovog tableta?")) return;
  localStorage.removeItem(LS_TOKEN);
  location.reload();
});

const ghHeaders = (t) => ({
  "Authorization": "Bearer " + (t || token),
  "Accept": "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28"
});

/* ---------- load ---------- */
async function start() {
  $("main").classList.remove("hidden");
  setState("busy", "učitavam kartu…");
  try {
    const [lib, list] = await Promise.all([
      fetch("library/wines.json", { cache: "no-cache" }).then((r) => r.json()),
      fetch("lists/theatrium.json", { cache: "no-cache" }).then((r) => r.json())
    ]);
    wines = collect(lib.wines || {}, list);
    await loadRules();
    render();
    setState("live", "spremno");
    $("n-listed").textContent = wines.length + " vina na karti";
  } catch (e) {
    setState("bad", "ne mogu učitati kartu: " + (e.message || e));
  }
}

/* One row per distinct wine, remembering whether it is poured by the glass,
   sold by the bottle, or both — the 24 that are both need to be hideable
   separately, since running out of an open bottle is not running out of the
   wine. Only the drinks with a producer are shown: nobody 86s the tap water,
   and 389 rows is already a long thumb-scroll. */
function collect(library, list) {
  const seen = new Map();
  for (const sec of list.sections) {
    for (const cat of sec.categories) {
      for (const g of cat.groups) {
        for (const entry of g.items) {
          const w = library[entry.ref];
          if (!w || !w.producer) continue;
          const k = keyOf(w.producer, w.name);
          if (!seen.has(k)) seen.set(k, {
            key: k, name: w.name, producer: w.producer,
            hay: norm(w.producer + " " + w.name),
            inGlass: false, inBottle: false
          });
          const row = seen.get(k);
          if (sec.id === "glass") row.inGlass = true;
          else if (sec.id.startsWith("bottle")) row.inBottle = true;
        }
      }
    }
  }
  return [...seen.values()];
}

async function loadRules() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}?ref=${BRANCH}&t=${Date.now()}`,
    { headers: ghHeaders(), cache: "no-store" });
  if (!r.ok) throw new Error(`GitHub ${r.status} pri čitanju ${PATH}`);
  const j = await r.json();
  sha = j.sha;
  const doc = JSON.parse(b64decode(j.content));
  rules = Array.isArray(doc.hidden) ? doc.hidden : [];
}

/* ---------- state of one wine ---------- */
/* Returns "on" (available), "off" (hidden everywhere), "glass", or "bottle". */
function stateOf(w) { return stateIn(rules, w); }
function stateIn(rs, w) {
  const mine = rs.filter((r) => r && norm(r.name) === norm(w.name) &&
    (!r.producer || norm(r.producer) === norm(w.producer)));
  if (!mine.length) return "on";
  if (mine.some((r) => !r.where)) return "off";
  const where = new Set(mine.map((r) => r.where));
  if (where.has("glass") && where.has("bottle")) return "off";
  return where.has("glass") ? "glass" : "bottle";
}

/* ---------- render ---------- */
function render() {
  const q = norm($("q").value);
  const rows = wines
    .filter((w) => (!q || w.hay.indexOf(q) !== -1))
    .filter((w) => (!onlyOff || stateOf(w) !== "on"));
  const off = wines.filter((w) => stateOf(w) !== "on");
  $("n-hidden").textContent = off.length;
  $("only-off").classList.toggle("on", onlyOff);

  if (!rows.length) {
    $("rows").innerHTML = `<p class="muted" style="padding:24px 0">Ništa ne odgovara.</p>`;
    return;
  }
  $("rows").innerHTML = rows.map((w) => {
    const st = stateOf(w);
    const rule = rules.find((r) => r && norm(r.name) === norm(w.name) &&
      (!r.producer || norm(r.producer) === norm(w.producer)));
    const both = w.inGlass && w.inBottle;
    const meta = st !== "on" && rule && (rule.since || rule.reason)
      ? `<div class="meta">${esc([rule.since, rule.reason].filter(Boolean).join(" · "))}</div>` : "";
    const scope = both ? `<div class="scope">
        <button data-k="${esc(w.key)}" data-w="glass" class="${st === "glass" ? "on" : ""}">nema na čašu</button>
        <button data-k="${esc(w.key)}" data-w="bottle" class="${st === "bottle" ? "on" : ""}">nema na bocu</button>
      </div>` : "";
    return `<div class="row ${st === "on" ? "" : "off"}">
      <div class="who">
        <div class="nm">${esc(w.name)}</div>
        <div class="pr">${esc(w.producer)}</div>${meta}
      </div>
      ${scope}
      <button class="sw" data-k="${esc(w.key)}" aria-pressed="${st === "off"}"
              aria-label="${esc(w.name)}"></button>
    </div>`;
  }).join("");

  $("rows").querySelectorAll(".sw").forEach((b) =>
    b.addEventListener("click", () => toggle(b.dataset.k, null)));
  $("rows").querySelectorAll(".scope button").forEach((b) =>
    b.addEventListener("click", () => toggle(b.dataset.k, b.dataset.w)));
}

$("q").addEventListener("input", render);
$("only-off").addEventListener("click", () => { onlyOff = !onlyOff; render(); });

/* ---------- the flip ---------- */
function toggle(key, where) {
  const w = wines.find((x) => x.key === key);
  if (!w) return;
  const st = stateOf(w);
  const without = rules.filter((r) => !(r && norm(r.name) === norm(w.name) &&
    (!r.producer || norm(r.producer) === norm(w.producer))));

  let next;
  if (where) {
    /* Each scoped button toggles *its own* half and leaves the other alone.
       Concatenating a fresh rule instead used to wipe the other scope: with the
       glass pour already 86'd, clicking "nema na bocu" quietly put the glass
       back on the list — the opposite of what the second click means. */
    const out = st === "off" ? new Set(["glass", "bottle"])
      : st === "on" ? new Set() : new Set([st]);
    out.has(where) ? out.delete(where) : out.add(where);
    next = out.size === 2
      ? without.concat([{ producer: w.producer, name: w.name, since: today() }])
      : out.size === 1
        ? without.concat([{ producer: w.producer, name: w.name, where: [...out][0], since: today() }])
        : without;
  } else {
    next = st === "on"
      ? without.concat([{ producer: w.producer, name: w.name, since: today() }])
      : without;   /* any hidden state → fully back on the list */
  }
  /* The message described the *button*, so every scoped click read "Vraćeno na
     kartu" even when it was hiding something — and the GitHub history, which is
     the record of what ran out and when, said the opposite of what happened.
     Describe the resulting state instead: it is right for all nine transitions,
     including glass→bottle, which is neither a hide nor an un-hide. */
  const who = `${w.producer} ${w.name}`;
  const message = {
    off: `Nema: ${who}`,
    glass: `Nema na čašu: ${who}`,
    bottle: `Nema na bocu: ${who}`,
    on: `Vraćeno na kartu: ${who}`
  }[stateIn(next, w)];

  /* Optimistic: the switch moves now, the write catches up. */
  rules = next;
  render();
  queue.push(message);
  drain();
}

/* One writer, a queue behind it.
   The first version locked every switch until the whole receipt had run —
   publish plus the 30-second tablet window, so about forty seconds per wine.
   Mid-service you 86 three things at once, and a board that refuses the second
   and third is a board nobody will use. So flips are never blocked: they land
   in `rules` immediately and queue a write. The worker always sends the *current*
   rules rather than a snapshot, so a flip that arrives mid-flight is simply
   included in the next write, and it restarts the receipt instead of reporting
   a stale one. */
async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const msgs = queue.splice(0);
      receipt(1, "now");
      await put(rules, msgs.length === 1 ? msgs[0] : `${msgs.length} ${changesWord(msgs.length)} na karti`);
      if (queue.length) continue;              /* someone flipped again — write once more */
      receipt(1, "done"); receipt(2, "now");
      const ok = await waitForPublish(rules);
      if (queue.length) continue;
      if (!ok) throw new Error("objava traje predugo — provjerite Actions na GitHubu");
      receipt(2, "done"); receipt(3, "now");
      await countdown(30);
      if (queue.length) continue;
      receipt(3, "done");
      setState("live", "sve je na tabletima");
      setTimeout(() => $("receipt").classList.add("hidden"), 4000);
    }
  } catch (e) {
    $("s-err").textContent = "· " + (e.message || e);
    setState("bad", "nije objavljeno");
    await loadRules().catch(() => {});         /* resync with what GitHub really has */
    render();
  } finally {
    draining = false;
    if (queue.length) drain();
  }
}

/* If a second tablet wrote since we read, GitHub answers 409. We do NOT retry
   over the top: re-read, show what is actually live, and say so. Losing the
   flip that was just made is recoverable in one tap; silently erasing what
   somebody else did on another tablet is not. (Our own consecutive writes take
   their new sha from the PUT response, so they never collide with themselves.) */
async function put(next, message) {
  const body = JSON.stringify({
    _: "Vina koja se trenutno NE prikazuju gostima. Uređuje se preko /admin.html ili ručno.",
    hidden: next
  }, null, 1) + "\n";
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
    method: "PUT",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: b64encode(body), sha, branch: BRANCH })
  });
  if (r.status === 409) {
    await loadRules();
    render();
    throw new Error("netko je u međuvremenu mijenjao popis — osvježeno, ponovite izmjenu");
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`GitHub ${r.status}${t ? " — " + t.slice(0, 120) : ""}`);
  }
  const j = await r.json();
  sha = j.content && j.content.sha;
}

/* Verified, not assumed: re-fetch the file the tablets actually read until it
   matches what we just wrote. */
const fingerprint = (list) => JSON.stringify((list || []).map((r) => [
  norm(r.producer), norm(r.name), r.where || ""
]).sort());

async function waitForPublish(next) {
  const want = fingerprint(next);
  const until = Date.now() + PUBLISH_TIMEOUT_MS;
  while (Date.now() < until) {
    if (queue.length) return true;   /* superseded — the next write will verify */
    await sleep(POLL_MS);
    try {
      const r = await fetch(`${PATH}?t=${Date.now()}`, { cache: "no-store" });
      if (r.ok) {
        const doc = await r.json();
        if (fingerprint(doc.hidden) === want) return true;
      }
    } catch (e) { /* mid-deploy; try again */ }
  }
  return false;
}

async function countdown(sec) {
  for (let i = sec; i > 0; i--) {
    /* The countdown is a progress bar, not a lock. Someone flipping another
       switch must not wait it out — that was a 30-second delay on an un-hide,
       which is exactly the wrong thing to be slow at. */
    if (queue.length) return;
    $("s3").textContent = `3 · na tabletima (${i}s)`;
    await sleep(1000);
  }
  $("s3").textContent = "3 · na tabletima";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 2 promjene, 5 promjena — and 12 promjena, which the naive rule gets wrong. */
function changesWord(n) {
  const t = n % 10, h = n % 100;
  return (t >= 2 && t <= 4 && !(h >= 12 && h <= 14)) ? "promjene" : "promjena";
}

function receipt(step, cls) {
  $("receipt").classList.remove("hidden");
  if (step === 1) $("s-err").textContent = "";
  const el = $("s" + step);
  el.className = cls;
  if (cls === "now") setState("busy", "objavljujem…");
  if (step === 3 && cls === "done") setState("live", "sve je na tabletima");
}

function setState(kind, text) {
  $("dot").className = "dot " + kind;
  $("state").textContent = text;
}

showGate();
