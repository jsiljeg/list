/* Email, via Resend.
 *
 * We send; staff never touch a campaign tool. That was the decision, and it
 * means the API key lives here and nobody logs into anything.
 *
 * What we do NOT do is run our own sending. Deliverability — SPF, DKIM, DMARC
 * alignment, bounce and complaint handling, warm-up — is a specialist job, and
 * getting it wrong puts the restaurant's own booking confirmations in spam
 * folders. Resend does that part; we hand it finished messages.
 *
 * BEFORE THE FIRST SEND: verify the sending domain in Resend and publish the
 * SPF/DKIM records it gives you. Sending from an unverified domain is how a new
 * domain earns a bad reputation in a week that takes months to undo.
 *
 * YOU DO NOT NEED A MAILBOX AT THE SENDING ADDRESS. Resend authenticates the
 * *domain* by DNS; nothing has to receive at rezervacije@devinos.hr for mail to
 * go out from it. What that does mean is that a guest hitting reply would be
 * writing to nowhere — so every message sets reply_to to MAIL_HOUSE, which is a
 * real inbox.
 *
 * TEMPORARY: devinos.hr is a testing sender. A guest booking Theatrium and
 * receiving mail from devinos.hr reads as a phishing attempt, and it wastes the
 * sending reputation we build on a domain we will abandon. SWITCH TO
 * theatrium.hr BEFORE GOING LIVE — it needs DNS access to theatrium.hr, which
 * is the same access the Phase 4 cutover needs anyway. */

const API = "https://api.resend.com/emails";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const hhmm = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

async function send(env, { to, subject, html, replyTo }) {
  /* No key yet (local dev, or before the account exists): log and carry on.
     A missing key must never fail a booking that is already in the database. */
  if (!env.RESEND_API_KEY) {
    console.log("[mail skipped — no RESEND_API_KEY]", subject, "->", to);
    return { skipped: true };
  }
  const r = await fetch(API, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || "Theatrium <rezervacije@theatrium.hr>",
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
  return r.json();
}

/* Plain, dark-friendly HTML. Email clients are not browsers: inline styles
   only, tables where layout matters, and it must read fine with images off. */
const wrap = (inner) => `
<div style="font-family:Georgia,'Times New Roman',serif;background:#161513;color:#efe9dd;padding:32px 24px">
  <div style="max-width:520px;margin:0 auto">
    <p style="letter-spacing:.28em;text-transform:uppercase;font-size:12px;color:#c9a961;margin:0 0 24px">
      Theatrium by Filho
    </p>
    ${inner}
    <p style="margin-top:36px;font-size:12px;color:#7c7466;line-height:1.6">
      Teslina 7, Zagreb &middot; +385 99 5844 652<br>
      Podatke iz rezervacije koristimo isklju&#269;ivo za njezinu obradu.
    </p>
  </div>
</div>`;

export function sendGuestConfirmation(env, { name, email, date, start, covers, note, id, cancelToken, origin }) {
  const html = wrap(`
    <h1 style="font-size:26px;font-weight:normal;margin:0 0 16px">Rezervacija je potvr&#273;ena</h1>
    <p style="margin:0 0 20px;color:#a89f8f;line-height:1.7">
      Hvala, ${esc(name)}. O&#269;ekujemo vas.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:16px">
      <tr><td style="padding:8px 0;color:#a89f8f">Datum</td><td style="padding:8px 0;text-align:right">${esc(date)}</td></tr>
      <tr><td style="padding:8px 0;color:#a89f8f">Vrijeme</td><td style="padding:8px 0;text-align:right">${hhmm(start)}</td></tr>
      <tr><td style="padding:8px 0;color:#a89f8f">Gostiju</td><td style="padding:8px 0;text-align:right">${esc(covers)}</td></tr>
      ${note ? `<tr><td style="padding:8px 0;color:#a89f8f">Napomena</td><td style="padding:8px 0;text-align:right">${esc(note)}</td></tr>` : ""}
    </table>
    <p style="margin:28px 0 0;font-size:14px;color:#a89f8f;line-height:1.7">
      Ako ne mo&#382;ete do&#263;i, javite nam
      <a href="${origin}/otkazivanje/?t=${cancelToken}" style="color:#c9a961">jednim klikom</a>
      &mdash; stol tada mo&#382;e dobiti netko drugi.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#7c7466">Broj rezervacije: ${esc(id).slice(0, 8)}</p>
  `);
  /* Replies go to a real inbox, not to the sending domain. */
  return send(env, {
    to: email,
    subject: `Rezervacija ${date} u ${hhmm(start)} — Theatrium`,
    html,
    replyTo: env.MAIL_HOUSE || "joy@theatrium.hr",
  });
}

export function sendHouseNotice(env, { name, email, phone, date, start, covers, note, id }) {
  const to = env.MAIL_HOUSE || "joy@theatrium.hr";
  const html = wrap(`
    <h1 style="font-size:22px;font-weight:normal;margin:0 0 16px">Nova rezervacija</h1>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      <tr><td style="padding:6px 0;color:#a89f8f">Kada</td><td style="padding:6px 0;text-align:right">${esc(date)} &middot; ${hhmm(start)}</td></tr>
      <tr><td style="padding:6px 0;color:#a89f8f">Gostiju</td><td style="padding:6px 0;text-align:right">${esc(covers)}</td></tr>
      <tr><td style="padding:6px 0;color:#a89f8f">Ime</td><td style="padding:6px 0;text-align:right">${esc(name)}</td></tr>
      <tr><td style="padding:6px 0;color:#a89f8f">E-mail</td><td style="padding:6px 0;text-align:right">${esc(email)}</td></tr>
      ${phone ? `<tr><td style="padding:6px 0;color:#a89f8f">Telefon</td><td style="padding:6px 0;text-align:right">${esc(phone)}</td></tr>` : ""}
      ${note ? `<tr><td style="padding:6px 0;color:#a89f8f">Napomena</td><td style="padding:6px 0;text-align:right">${esc(note)}</td></tr>` : ""}
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#7c7466">${esc(id)}</p>
  `);
  /* Reply-to the guest, so answering the notice reaches them directly. */
  return send(env, { to, subject: `Rezervacija ${date} ${hhmm(start)} · ${covers} os. · ${name}`, html, replyTo: email });
}
