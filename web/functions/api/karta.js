/* /api/karta — the 86 board's two files, for a key with no GitHub access.
 *
 *   GET ?file=lists/theatrium.json | data/unavailable.json
 *        → {sha, content}: the GitHub contents envelope, so js/admin.js
 *          only swaps the address
 *   PUT  {file, content (base64 JSON), sha, message}
 *        → {content: {sha}} once committed; 409 {error:"conflict"} when the
 *          file moved since it was read (the board re-reads and says so);
 *          422 {error:"change"} for anything the board cannot do
 *
 * The head sommelier's Karta tab uses this (web/ROLES.md §3.4); Filho's page
 * still writes to GitHub with his own key. Every write is checked against the
 * file as GitHub has it now by _lib/karta.js and committed with the server's
 * KARTA_GH_TOKEN, signed with the key's name — never one the page sends. */
import { reply, cors } from "../_lib/wines.js";
import { wineListOrigin } from "../_lib/daily.js";
import { staffOrSomm, actorName } from "../_lib/roles.js";
import { FILES, checkList, checkRules, cleanMessage, readFile, writeFile, b64decode } from "../_lib/karta.js";

export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: cors(request) });

const ready = (env) => !!(env && env.KARTA_GH_TOKEN);

export async function onRequestGet({ request, env }) {
  if (!(await staffOrSomm(request, env))) return reply(request, { error: "key" }, 401);
  const file = new URL(request.url).searchParams.get("file");
  if (!FILES.includes(file)) return reply(request, { error: "file" }, 400);
  if (!ready(env)) return reply(request, { error: "not_configured" }, 503);
  const f = await readFile(env, file);
  if (f.error) return reply(request, { error: f.error }, 502);
  return reply(request, { sha: f.sha, content: f.content });
}

export async function onRequestPut({ request, env }) {
  const a = await staffOrSomm(request, env);
  if (!a) return reply(request, { error: "key" }, 401);
  let b;
  try { b = await request.json(); } catch { return reply(request, { error: "body" }, 400); }
  if (!b || !FILES.includes(b.file)) return reply(request, { error: "file" }, 400);
  let next;
  try { next = JSON.parse(b64decode(b.content)); } catch { return reply(request, { error: "body" }, 400); }
  if (!ready(env)) return reply(request, { error: "not_configured" }, 503);
  const cur = await readFile(env, b.file);
  if (cur.error) return reply(request, { error: cur.error }, 502);
  if (b.sha !== cur.sha) return reply(request, { error: "conflict" }, 409);
  let why;
  if (b.file === "lists/theatrium.json") why = checkList(cur.doc, next);
  else {
    let wines = {};
    try {
      const r = await fetch(`${wineListOrigin(env)}/library/wines.json`, { cf: { cacheTtl: 60 } });
      if (r.ok) wines = (await r.json()).wines || {};
    } catch { /* an unknown wine is then refused, which is the safe side */ }
    why = checkRules(cur.doc, next, wines);
  }
  if (why) {
    console.log(`karta: refused ${b.file} from ${a.role}: ${why}`);
    return reply(request, { error: "change", why }, 422);
  }
  const who = actorName(a, b.by);   /* a sommelier is named by his key, never by the page */
  const w = await writeFile(env, b.file, next, cur.sha, cleanMessage(b.message), who);
  if (w.error === "conflict") return reply(request, { error: "conflict" }, 409);
  if (w.error) return reply(request, { error: w.error }, 502);
  return reply(request, { content: { sha: w.sha } });
}
