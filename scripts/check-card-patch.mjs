#!/usr/bin/env node
/* What a card written by Dodaj vino may change (web/ROLES.md, 2026-11-17).
 *
 *   node scripts/check-card-patch.mjs <unified diff>     exit 0 = fine
 *
 * The run that writes a card reads text a person typed — Filho's or, since
 * the head sommelier's role, Toni's: a remark, answers, corrections — and
 * Toni can publish his own card. js/i18n.js and js/zh-terms.js are in the
 * files a card may touch, and js/i18n.js is loaded by /admin itself, so a
 * line of script slipped into it (a prompt injection through that text, or
 * through a label) would run on Filho's /admin with Filho's key in reach.
 *
 * js/spirits.js joined them on 2026-11-25 (Jameson, a calvados and an
 * akvavit all stopped on a missing class word). So the JS files may only gain or lose plain entries — `"Nerello
 * Mascalese": "马斯卡斯奈莱洛",` — a key, a colon, one string literal, a
 * comma. That is every line a card run has ever written to them. Anything
 * else in a JS file, any other file, a rename, a mode change or a binary is
 * refused, and the card is not applied or published. */
import fs from "node:fs";

export const ALLOWED = ["library/wines.json", "lists/theatrium.json", "data/producers.json", "data/unavailable.json",
  "js/zh-terms.js", "js/i18n.js", "js/spirits.js"];
/* key: literal pairs, nothing else. A literal is a quoted string or a plain
   number; a line may carry several pairs (the vocabulary is written that
   way) or one `key: { pairs }` (the countries). No expression fits. */
const STR = String.raw`(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')`;
const KEY = String.raw`(?:${STR}|[A-Za-z_$][\w$]*)`;
const PAIR = String.raw`${KEY}\s*:\s*(?:${STR}|-?\d+(?:\.\d+)?)`;
const PAIRS = String.raw`${PAIR}(?:\s*,\s*${PAIR})*`;
export const DATA_LINE = new RegExp(String.raw`^\s*(?:${PAIRS}|${KEY}\s*:\s*\{\s*${PAIRS}\s*,?\s*\})\s*,?\s*$`);
/* A comment that opens and closes on its own line cannot reach code. One
   spread over several lines is refused: a line starting "*" could just as
   well be "*\/ fetch(…) /*". */
const COMMENT = /^\s*(?:\/\/.*|\/\*(?:(?!\*\/).)*\*\/\s*)$/;

export function checkPatch(text) {
  let file = null;
  for (const raw of String(text).replace(/\r/g, "").split("\n")) {
    if (raw.startsWith("diff --git ")) {
      const m = raw.match(/^diff --git a\/(\S+) b\/(\S+)$/);
      if (!m || m[1] !== m[2]) return `odd header: ${raw}`;
      file = m[1];
      if (!ALLOWED.includes(file)) return `patch touches ${file}`;
      continue;
    }
    if (/^(new file mode|deleted file mode|old mode|new mode|rename from|rename to|copy from|copy to|similarity index|Binary files|GIT binary patch)/.test(raw))
      return `${file}: ${raw}`;
    if (!file || !file.endsWith(".js")) continue;
    if (/^(\+\+\+|---) /.test(raw)) continue;
    if (!/^[+-]/.test(raw)) continue;
    const line = raw.slice(1);
    if (!/^\s*$/.test(line) && !DATA_LINE.test(line) && !COMMENT.test(line)) return `${file}: not a plain entry: ${line.slice(0, 120)}`;
  }
  return "";
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const why = checkPatch(fs.readFileSync(process.argv[2], "utf8"));
  if (why) { console.error(`card patch refused — ${why}`); process.exit(1); }
  console.log("card patch: data only");
}
