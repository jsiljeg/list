/* Theatrium's own e-mail sender — alerts about Theatrium, signed Theatrium.
 *
 * Owner, 2026-10-10: an alert goes out under what it is about. Novo vino is
 * Theatrium (this repo), so it must not travel through, or be signed by, the
 * owner's personal monitoring (pr-checkups) — those are separate projects.
 *
 * Why a Worker at all: Cloudflare Email Routing sends through a `send_email`
 * binding, which Workers have and Pages Functions do not. The restaurant site
 * (Pages) reaches this through a service binding, ALERTS. There is no public
 * address — workers_dev is off and there is no route — so nothing else can
 * make it send. It can only write to the one address verified in Email
 * Routing (the owner's Gmail), which is the whole point.
 *
 * Deployed by .github/workflows/deploy-web.yml. Plain JavaScript, no build. */
import { EmailMessage } from "cloudflare:email";

const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const enc = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const clean = (s, n) => String(s ?? "").replace(/[\r\n<>"]/g, " ").trim().slice(0, n);

export default {
  /* POST {topic, title, body, click} from a bound service. `topic` is the
     part of Theatrium it is about ("Dodaj vino"); the sender is always
     Theatrium. */
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("POST only", { status: 405 });
    let a;
    try { a = await request.json(); } catch { return new Response("bad json", { status: 400 }); }
    if (!a || typeof a.title !== "string") return new Response("title required", { status: 400 });
    if (!env.MAIL || !env.MAIL_FROM || !env.MAIL_TO) return Response.json({ ok: false, mail: false });

    const topic = clean(a.topic, 40);
    const from = topic ? `Theatrium · ${topic}` : "Theatrium";
    const click = typeof a.click === "string" && /^https:\/\//.test(a.click) ? a.click : "";
    const when = new Date().toISOString().slice(0, 16).replace("T", " ");
    const text = `${String(a.body || "").slice(0, 4000)}${click ? `\n\n${click}` : ""}\n\n— ${from}, ${when} UTC\n`;
    const raw = [
      `From: ${enc(from)} <${env.MAIL_FROM}>`,
      `To: ${env.MAIL_TO}`,
      `Subject: ${enc(clean(a.title, 200))}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@${env.MAIL_FROM.split("@")[1]}>`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      b64(text).replace(/.{76}/g, "$&\r\n"),
    ].join("\r\n");
    try {
      await env.MAIL.send(new EmailMessage(env.MAIL_FROM, env.MAIL_TO, raw));
      return Response.json({ ok: true, mail: true });
    } catch (e) {
      console.log(`mail failed: ${e.message || e}`);
      return Response.json({ ok: false, mail: false, why: String(e.message || e) }, { status: 502 });
    }
  },
};
