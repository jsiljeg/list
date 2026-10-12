/* /api/troskovi/kljucevi  POST (staff) {changes: [{id, i, key}]}
 *
 * Product keys set in bulk (owner, 2026-10-12: "check what you are comparing —
 * Hampden didn't increase 179%"). Cijene compares lines by key, and the key
 * used to be written per receipt, alone, under a rule that left the brand
 * out: Bumbu and Hampden were both "rum". This re-files lines onto one key
 * per article without reading a single receipt again. Only the key moves;
 * amounts, names and categories are untouched. */
import { reply, isStaffAsync, readReceipt, setFields, clip } from "../../_lib/expenses.js";

export async function onRequestPost({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const b = await request.json().catch(() => ({}));
  const changes = Array.isArray(b && b.changes) ? b.changes.slice(0, 3000) : [];
  const byId = new Map();
  for (const c of changes) {
    if (!c || typeof c.id !== "string" || !Number.isInteger(c.i) || typeof c.key !== "string") continue;
    (byId.get(c.id) || byId.set(c.id, []).get(c.id)).push(c);
  }
  let changed = 0, missing = 0;
  for (const [id, list] of byId) {
    const r = await readReceipt(env, id);
    if (!r) { missing += list.length; continue; }
    let dirty = false;
    for (const c of list) {
      const it = r.items[c.i];
      const key = clip(c.key, 80).toLowerCase().trim();
      if (!it || !key) { missing += 1; continue; }
      if (it.key !== key) { it.key = key; dirty = true; changed += 1; }
    }
    if (dirty) await setFields(env, id, { items: JSON.stringify(r.items) });
  }
  return reply(request, { ok: true, changed, missing });
}
