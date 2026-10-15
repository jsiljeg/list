/* Theatrium's clock — starts the private repo's syncs on time.
 *
 * GitHub's own schedule only promises to try (2026-10-14/15: the 6:10 Remaris
 * run started at 11:28, MER's 9:05 at 14:49, and the next morning's 6:10 and
 * 7:10 never started). A workflow started through the API (workflow_dispatch)
 * starts within seconds, and Cloudflare's Cron Triggers fire on the minute, so
 * this Worker is the clock and GitHub only does the work. The workflows'
 * own cron stays as a fallback: a second run of either changes nothing (the
 * Remaris export replaces the last 4 days and only changed bills are written;
 * MER skips documents already imported).
 *
 * One trigger, every hour at :10 UTC; the Zagreb hour decides, so summer and
 * winter time need no second cron:
 *   Remaris  6:10 (yesterday, whole) · 9:10 (safety net) · 16:10 (today's lunch)
 *   MER      9:10 · 16:10
 * No fetch handler and no route: nothing outside can make it run.
 * Deployed by .github/workflows/deploy-web.yml with DISPATCH_TOKEN (the token
 * that may start theatrium-troskovi's workflows). Plain JavaScript, no build. */
export const SLOTS = { 6: ["remaris-sync.yml"], 9: ["remaris-sync.yml", "mer-sync.yml"], 16: ["remaris-sync.yml", "mer-sync.yml"] };
export const zagrebHour = (d) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zagreb", hour: "2-digit", hour12: false }).format(d)) % 24;

export default {
  async scheduled(event, env) {
    const due = SLOTS[zagrebHour(new Date(event.scheduledTime))] || [];
    if (!due.length) return;
    if (!env.DISPATCH_TOKEN) { console.log("no DISPATCH_TOKEN"); return; }
    for (const wf of due) {
      const r = await fetch(`https://api.github.com/repos/${env.REPO}/actions/workflows/${wf}/dispatches`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.DISPATCH_TOKEN}`, accept: "application/vnd.github+json", "user-agent": "theatrium-clock", "content-type": "application/json" },
        body: JSON.stringify({ ref: "main" }),
      });
      console.log(`${wf}: ${r.status}${r.ok ? "" : " " + (await r.text()).slice(0, 200)}`);
    }
  },
};
