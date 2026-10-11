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
  /* The winery story is its own step (owner, 2026-10-11): checking whether
     the house already has one, writing a new one, or changing the old one. */
  const text = String(input.content || "") + String(input.new_string || "");
  if ((name === "Read" || name === "Grep") && has(file, /producers\.json/)) return "Provjerava je li vinarija već na karti";
  if ((name === "Write" || name === "Edit") && has(file, /producers\.json/)) return "Dopunjuje priču o vinariji";
  if ((name === "Write" || name === "Edit") && has(file, /result\.json/)) return "Završava";
  if ((name === "Write" || name === "Edit") && has(file, /intake\//) && /"blurb"/.test(text))
    return ["Piše karticu", "Piše priču o vinariji"];   /* one draft usually holds both */
  if ((name === "Write" || name === "Edit") && has(file, /intake\//)) return "Piše karticu";
  if ((name === "Write" || name === "Edit") && has(file, /i18n|zh-terms/)) return "Dodaje prijevode";
  if ((name === "Read" || name === "Grep" || name === "Glob") && has(file + (input.pattern || ""), /library|lists|producers/))
    return "Uspoređuje sa sličnim vinima na karti";
  return null;
}

/* Steps are sent at most one per GAP_MS. A short queue keeps two steps that
   arrive together (the card, then the winery story) both visible; a burst of
   research keeps only the latest three, so the list never lags far behind. */
let last = "", lastAt = 0, timer = null;
const queue = [];
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
function drain() {
  timer = null;
  if (!queue.length) return;
  lastAt = Date.now();
  send(queue.shift());
  if (queue.length) timer = setTimeout(drain, GAP_MS);
}
function report(t) {
  if (!t || t === last) return;
  last = t;
  queue.push(t);
  if (queue.length > 3) queue.shift();
  if (!timer) timer = setTimeout(drain, Math.max(0, lastAt + GAP_MS - Date.now()));
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  let ev;
  try { ev = JSON.parse(line); } catch { return; }
  if (ev.type !== "assistant") return;
  for (const c of (ev.message && ev.message.content) || []) {
    if (c.type === "tool_use") [].concat(phase(c.name, c.input || {})).forEach(report);
  }
});
rl.on("close", async () => {
  if (timer) clearTimeout(timer);
  while (queue.length) await send(queue.shift());
});
