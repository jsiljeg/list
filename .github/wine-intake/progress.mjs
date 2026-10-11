// Dodaj vino — what the run is doing, told to the inbox as it happens
// (owner, 2026-10-11: "we need to see the progress all the time").
//
// Reads Claude's stream-json on stdin, turns each tool call into one short
// Croatian step ("Čita etiketu", "Istražuje · wittmann-weingut.com") and posts
// it to $INBOX/$ID/stanje as {phase}. Posting is best effort and throttled:
// a step that fails to send is simply overtaken by the next one, and nothing
// here can fail the run. Lives under .github/, which the run cannot edit.
import { createInterface } from "node:readline";

const { INBOX, ID, KEY } = process.env;
const GAP_MS = 6000;

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const has = (s, re) => re.test(String(s || ""));

function phase(name, input = {}) {
  const file = input.file_path || input.path || "";
  const cmd = input.command || "";
  if (name === "Read" && has(file, /intake\/photo/)) return "Čita etiketu";
  if (name === "WebSearch") return "Istražuje vino i vinariju";
  if (name === "WebFetch") return host(input.url) ? `Istražuje · ${host(input.url)}` : "Istražuje vino i vinariju";
  if (name === "Bash" && has(cmd, /neighbours\.mjs/)) return "Bira mjesto na karti i čašu";
  if (name === "Bash" && has(cmd, /pair\.mjs/)) return "Bira jela uz vino";
  if (name === "Bash" && has(cmd, /add\.py/)) return "Upisuje vino na kartu";
  if (name === "Bash" && has(cmd, /validate\.mjs|after-86/)) return "Provjerava karticu";
  if (name === "Bash" && has(cmd, /rank-ratings/)) return "Slaže ocjene kritičara";
  if ((name === "Write" || name === "Edit") && has(file, /result\.json/)) return "Završava";
  if ((name === "Write" || name === "Edit") && has(file, /intake\//)) return "Piše karticu";
  if ((name === "Write" || name === "Edit") && has(file, /i18n|zh-terms/)) return "Dodaje prijevode";
  if ((name === "Read" || name === "Grep" || name === "Glob") && has(file + (input.pattern || ""), /library|lists|producers/))
    return "Uspoređuje sa sličnim vinima na karti";
  return null;
}

let last = "", lastAt = 0, waiting = null, timer = null;
async function send(t) {
  if (!INBOX || !ID || !KEY) return;
  try {
    await fetch(`${INBOX}/${ID}/stanje`, {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ phase: t }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* overtaken by the next step */ }
}
function report(t) {
  if (!t || t === last) return;
  last = t;
  const wait = lastAt + GAP_MS - Date.now();
  if (wait <= 0) { lastAt = Date.now(); send(t); return; }
  waiting = t;
  if (!timer) timer = setTimeout(() => { timer = null; lastAt = Date.now(); const w = waiting; waiting = null; send(w); }, wait);
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  let ev;
  try { ev = JSON.parse(line); } catch { return; }
  if (ev.type !== "assistant") return;
  for (const c of (ev.message && ev.message.content) || []) {
    if (c.type === "tool_use") report(phase(c.name, c.input || {}));
  }
});
rl.on("close", async () => {
  if (timer) { clearTimeout(timer); timer = null; if (waiting) await send(waiting); }
});
