/* /api/troskovi/<id>/foto/<n>  GET (staff, or the reading run): one photo. */
import { reply, isStaffAsync, isExpenseWorker } from "../../../../_lib/expenses.js";
import { cors } from "../../../../_lib/wines.js";

export async function onRequestGet({ request, env, params }) {
  if (!isExpenseWorker(request, env) && !(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  const row = await env.DB.prepare("SELECT mime, bytes FROM expense_photos WHERE receipt_id = ?1 AND n = ?2")
    .bind(params.id, Number(params.n)).first();
  if (!row) return reply(request, { error: "not_found" }, 404);
  /* An e-invoice's PDF is stored as base64 text and decoded here, on the one
     request that wants it (2026-10-12); a photo is a BLOB, which D1 hands back
     as an array of numbers in production. */
  const b64 = /;base64$/.test(row.mime || "");
  const bytes = b64 ? fromB64(String(row.bytes)) : new Uint8Array(row.bytes);
  return new Response(bytes, {
    headers: { "content-type": b64 ? row.mime.replace(/;base64$/, "") : row.mime, "cache-control": "private, no-store", ...cors(request) },
  });
}

function fromB64(s) {
  if (typeof Uint8Array.fromBase64 === "function") return Uint8Array.fromBase64(s.replace(/\s+/g, ""));
  const bin = atob(s.replace(/\s+/g, "")), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
