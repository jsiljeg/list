/* Theatrium's clock — starts the private repo's syncs on time.
 *
 * GitHub's own schedule only promises to try (2026-10-14/15: the 6:10 Remaris
 * run started at 11:28, MER's 9:05 at 14:49, and the next morning's 6:10 and
 * 7:10 never started). A workflow started through the API (workflow_dispatch)
 * starts within seconds, and Cloudflare's Cron Triggers fire on the minute.
 * So this Worker is the only clock (owner, 2026-10-15: "I want it to work
 * even when nothing is checking from my side"); the workflows in
 * theatrium-troskovi have no schedule of their own any more.
 *
 * One trigger at :10 on the UTC hours that are 6, 8, 9, 16, 17 or 23 in Zagreb
 * in summer or winter (10 wake-ups a day); the Zagreb hour decides which act, so
 * the clock change needs no edit. Remaris three times, MER twice (owner:
 * "reliable 2 Remaris per day and 2 MER per day", then "add the 23:10 run"):
 *   Remaris  6:10  yesterday, whole — the till's day closes overnight
 *            16:10 today's lunch, the same afternoon
 *            23:10 tonight's dinner, the same night (late tables at 6:10)
 *   MER      9:10 and 17:10 — e-invoices are issued through the working day
 *   Weekly report, Monday 8:10
 * A start GitHub refuses is mailed to the owner (ALERTS), so silence means it
 * worked. No fetch handler and no route: nothing outside can make it run.
 * Deployed by .github/workflows/deploy-web.yml with DISPATCH_TOKEN (the token
 * that may start theatrium-troskovi's workflows). Plain JavaScript, no build. */
export const SLOTS = { 6: ["remaris-sync.yml"], 9: ["mer-sync.yml"], 16: ["remaris-sync.yml"], 17: ["mer-sync.yml"], 23: ["remaris-sync.yml"] };
export const WEEKLY = { day: 1, hour: 8, wf: "weekly-report.yml" };   /* Monday */
const zagreb = (d) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zagreb", weekday: "short", hour: "2-digit", hour12: false })
  .formatToParts(d).map((x) => [x.type, x.value]));
export const zagrebHour = (d) => Number(zagreb(d).hour) % 24;
export function dueAt(d) {
  const z = zagreb(d), h = Number(z.hour) % 24, wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(z.weekday);
  return [...(SLOTS[h] || []), ...(wd === WEEKLY.day && h === WEEKLY.hour ? [WEEKLY.wf] : [])];
}

/* GitHub answers a dispatch with a 500 now and then (owner's mail, 2026-11:
 * "mer-sync.yml — GitHub 500") and is fine seconds later. So a 5xx, a 429 or a
 * network error is tried again — 3 tries, 15 s then 60 s apart — and only the
 * last failure is mailed. A 401/403/404/422 is a wrong token or workflow name;
 * retrying cannot fix it, so it is mailed at once. A 500 that did create the
 * run can make a sync run twice; that is harmless, the syncs write only what
 * is new or changed. Returns "" when started, else the reason. */
export const RETRY_WAITS = [15000, 60000];
export async function dispatch(wf, env, { fetchFn = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), waits = RETRY_WAITS } = {}) {
  if (!env.DISPATCH_TOKEN) return "no DISPATCH_TOKEN";
  let why = "";
  for (let i = 0; i <= waits.length; i++) {
    if (i) await sleep(waits[i - 1]);
    let retry = false;
    try {
      const r = await fetchFn(`https://api.github.com/repos/${env.REPO}/actions/workflows/${wf}/dispatches`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.DISPATCH_TOKEN}`, accept: "application/vnd.github+json", "user-agent": "theatrium-clock", "content-type": "application/json" },
        body: JSON.stringify({ ref: "main" }),
      });
      if (r.ok) return "";
      why = `GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`;
      retry = r.status >= 500 || r.status === 429;
    } catch (e) { why = String((e && e.message) || e).slice(0, 200); retry = true; }
    console.log(`${wf}: try ${i + 1} — ${why}`);
    if (!retry) return why;
  }
  return `${why} (${waits.length + 1} pokušaja)`;
}

export default {
  async scheduled(event, env) {
    const due = dueAt(new Date(event.scheduledTime));
    if (!due.length) return;
    const failed = [];
    for (const wf of due) {
      const why = await dispatch(wf, env);
      console.log(`${wf}: ${why || "started"}`);
      if (why) failed.push(`${wf} — ${why}`);
    }
    if (failed.length && env.ALERTS) {
      await env.ALERTS.fetch("https://alerts/notify", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: "Sat", title: "Sinkronizacija nije pokrenuta", body: `Sat nije uspio pokrenuti:\n${failed.join("\n")}\n\nPodaci u adminu ostaju od zadnjeg čitanja dok se ovo ne riješi.` }),
      }).catch((e) => console.log(`alert failed: ${e}`));
    }
  },
};
