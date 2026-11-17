/* The 86 board's two files, written through the server (web/ROLES.md §3.4).
 *
 * The head sommelier has no GitHub key: a key that can write the list can
 * write web/ too, and a push there deploys this server. So his Karta tab
 * sends the whole new document here, and this file decides whether it is a
 * change the board can make — a price, NOVO, a hide or a return, a bottle
 * put on by the glass — and nothing else. Only then is it committed, with
 * the server's own token (KARTA_GH_TOKEN), signed with his name.
 *
 * The check is a diff against the file as GitHub has it now, so "nothing
 * else" is literal: one changed anchor, one renamed category, one extra
 * field anywhere, and the whole write is refused. */
export const REPO = "jsiljeg/list";
export const BRANCH = "main";
export const FILES = ["lists/theatrium.json", "data/unavailable.json"];

const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);
const keysBut = (o, skip) => Object.keys(o).filter((k) => !skip.includes(k)).sort();
/* the same keys, and the same values on every key but `skip` */
function sameExcept(a, b, skip) {
  if (!isObj(a) || !isObj(b)) return false;
  const ka = keysBut(a, skip), kb = keysBut(b, skip);
  if (ka.join("\u0000") !== kb.join("\u0000")) return false;
  return ka.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
}
const isPrice = (p) => typeof p === "number" && Number.isFinite(p) && p > 0 && p < 100000
  && Math.abs(Math.round(p * 100) - p * 100) < 1e-6;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* "" when `next` differs from `old` only in what the board may change,
   otherwise a short reason (for the log and the test, never shown as data). */
export function checkList(old, next) {
  if (!isObj(next) || !Array.isArray(next.sections)) return "shape";
  if (!sameExcept(old, next, ["sections"])) return "top";
  if (old.sections.length !== next.sections.length) return "sections";
  const bottleRefs = new Set(), glassRefs = new Set(), bottleCats = new Set();
  for (const s of old.sections) for (const c of s.categories || []) for (const g of c.groups || []) for (const it of g.items || []) {
    if (String(s.id).startsWith("bottle")) { bottleRefs.add(it.ref); bottleCats.add(c.id); }
    if (s.id === "glass") glassRefs.add(it.ref);
  }
  const added = new Set();
  const newPour = (it) => {
    if (!isObj(it) || Object.keys(it).sort().join() !== "price,ref") return "glass_item";
    if (typeof it.ref !== "string" || !bottleRefs.has(it.ref) || glassRefs.has(it.ref) || added.has(it.ref)) return "glass_ref";
    if (!isPrice(it.price)) return "price";
    added.add(it.ref);
    return "";
  };
  const item = (o, n) => {
    if (!isObj(n) || !sameExcept(o, n, ["price", "new"])) return "item";
    if (!isPrice(n.price)) return "price";
    if (!(n.new === undefined || n.new === true)) return "new";
    return "";
  };
  const items = (os, ns, glass) => {
    if (!Array.isArray(ns)) return "items";
    let j = 0;
    for (const n of ns) {
      const o = os[j];
      if (o && isObj(n) && n.ref === o.ref && same(n.vol, o.vol)) { const e = item(o, n); if (e) return e; j++; continue; }
      if (!glass) return "items";
      const e = newPour(n);
      if (e) return e;
    }
    return j === os.length ? "" : "items";
  };
  const category = (oc, nc, glass) => {
    if (!sameExcept(oc, nc, ["groups"]) || !Array.isArray(nc.groups) || nc.groups.length !== oc.groups.length) return "category";
    for (let k = 0; k < oc.groups.length; k++) {
      if (!sameExcept(oc.groups[k], nc.groups[k], ["items"])) return "group";
      const e = items(oc.groups[k].items, nc.groups[k].items, glass);
      if (e) return e;
    }
    return "";
  };
  for (let i = 0; i < old.sections.length; i++) {
    const os = old.sections[i], ns = next.sections[i];
    if (!sameExcept(os, ns, ["categories"]) || !Array.isArray(ns.categories)) return "section";
    const glass = os.id === "glass";
    let j = 0;
    const have = new Set(os.categories.map((c) => c.id));
    for (const nc of ns.categories) {
      const oc = os.categories[j];
      if (oc && isObj(nc) && nc.id === oc.id) { const e = category(oc, nc, glass); if (e) return e; j++; continue; }
      /* a first rosé by the glass: a new category on the glass shelf, only
         one a bottle shelf already has, one group, new pours only */
      if (!glass || !isObj(nc) || Object.keys(nc).sort().join() !== "groups,id" || !bottleCats.has(nc.id) || have.has(nc.id)) return "category";
      have.add(nc.id);
      if (!Array.isArray(nc.groups) || nc.groups.length !== 1) return "category";
      const g = nc.groups[0];
      if (!isObj(g) || Object.keys(g).sort().join() !== "country,items" || g.country !== null) return "group";
      const e = items([], g.items, true);
      if (e) return e;
    }
    if (j !== os.categories.length) return "category";
  }
  return "";
}

const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();
const RULE_KEYS = ["name", "producer", "reason", "since", "where"];
/* `wines` is library/wines.json's map; only a rule that is NEW needs it */
export function checkRules(old, next, wines) {
  if (!isObj(next) || !Array.isArray(next.hidden)) return "shape";
  if (keysBut(next, ["_", "hidden"]).length) return "top";
  if (next._ !== undefined && (typeof next._ !== "string" || next._.length > 300)) return "top";
  if (next.hidden.length > 500) return "too_many";
  const was = new Set(((old && old.hidden) || []).map((r) => JSON.stringify(r)));
  const known = new Set(Object.values(wines || {}).map((w) => norm(w.producer) + "|" + norm(w.name)));
  for (const r of next.hidden) {
    if (!isObj(r) || Object.keys(r).some((k) => !RULE_KEYS.includes(k))) return "rule";
    if (Object.values(r).some((v) => typeof v !== "string" || v.length > 200)) return "rule";
    if (!r.name) return "rule";
    if (r.where !== undefined && !["glass", "bottle"].includes(r.where)) return "where";
    if (r.since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(r.since)) return "since";
    if (!was.has(JSON.stringify(r)) && !known.has(norm(r.producer) + "|" + norm(r.name))) return "unknown_wine";
  }
  return "";
}

/* A commit message from the page: plain lines, bounded, never the signature
   — the server signs with the key's name. */
export function cleanMessage(m) {
  const lines = String(m == null ? "" : m).replace(/\r/g, "").split("\n")
    .map((l) => l.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200)).slice(0, 60);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.length && lines[0].trim() ? lines : ["Promjena na karti"];
}

/* ---- GitHub, with the server's own token ---- */
const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, "")), (c) => c.charCodeAt(0)));
const b64encode = (s) => {
  const b = new TextEncoder().encode(s);
  let o = "";
  for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(o);
};
const ghHeaders = (env) => ({ authorization: `Bearer ${env.KARTA_GH_TOKEN}`, accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28", "user-agent": "theatrium-karta", "content-type": "application/json" });

export async function readFile(env, path) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}&t=${Date.now()}`,
    { headers: ghHeaders(env), cache: "no-store" });
  if (!r.ok) return { error: `github_${r.status}` };
  const j = await r.json();
  return { sha: j.sha, content: j.content, doc: JSON.parse(b64decode(j.content)) };
}

export async function writeFile(env, path, doc, sha, lines, who) {
  const body = JSON.stringify(doc, null, 1) + "\n";      /* the board's own serialisation */
  lines[0] = `${lines[0]} — ${who}`;
  const email = `${who.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "") || "osoblje"}@theatrium-admin.invalid`;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: "PUT", headers: ghHeaders(env),
    body: JSON.stringify({ message: lines.join("\n"), content: b64encode(body), sha, branch: BRANCH, author: { name: who, email } }),
  });
  if (r.status === 409) return { error: "conflict" };
  if (!r.ok) return { error: `github_${r.status}` };
  const j = await r.json();
  return { sha: j.content && j.content.sha };
}
export { b64decode, b64encode };
