/* GET /media/<id> — a daily-offer photo, served from D1.
 *
 * The id is a hash of the bytes, so the response never changes and is cached
 * as immutable: after the first guest, Cloudflare's edge serves it and D1 is
 * not asked again. */
export async function onRequestGet({ env, params }) {
  const id = String(params.id || "");
  if (!/^[a-f0-9]{16,64}$/.test(id) || !env.DB) return new Response("not found", { status: 404 });
  const row = await env.DB.prepare("SELECT mime, bytes FROM media WHERE id = ?1").bind(id).first();
  if (!row) return new Response("not found", { status: 404 });
  return new Response(row.bytes instanceof ArrayBuffer ? row.bytes : new Uint8Array(row.bytes), {
    headers: {
      "content-type": row.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
