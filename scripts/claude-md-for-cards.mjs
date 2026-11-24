#!/usr/bin/env node
/* Trim CLAUDE.md, inside a Dodaj vino run only, to what writing a card needs.

   Claude Code loads CLAUDE.md into every turn. The full file is ~132 kB
   (~38k tokens) — tests, deploys, fonts, glass icons, the admin board, the
   cjenik — and a card takes ~40 turns, so most of each run's input was the
   project's history (owner, 2026-11-24: "we're overspending tokens"). The
   run's job is never pushed (the patch takes library/lists/data/js only), so
   this rewrite stays in the runner. The wine rules are kept whole.

     node scripts/claude-md-for-cards.mjs          # rewrite CLAUDE.md in place
     node scripts/claude-md-for-cards.mjs --check  # print sizes only */
import fs from "node:fs";

export const KEEP = [
  "## Wine-data conventions",
  "## The kitchen's card is seasonal",          /* also holds the blurb, spirit-region and note rules */
  "## Spirits get cards too",
  "## Descriptor capitalisation",
  "## The sommelier: what it scores",           /* pairing rules: tag cap, clashes, foods not recipes */
  "## Novo vino — Filho adds wines himself",
];

export function trim(md) {
  const parts = md.split(/^(?=## )/m);
  const head = parts[0].startsWith("## ") ? "" : parts.shift();
  const kept = parts.filter((p) => KEEP.some((k) => p.startsWith(k)));
  const missing = KEEP.filter((k) => !kept.some((p) => p.startsWith(k)));
  return { text: head + kept.join(""), missing };
}

const md = fs.readFileSync("CLAUDE.md", "utf8");
const { text, missing } = trim(md);
if (missing.length) { console.error("CLAUDE.md: section(s) not found: " + missing.join(" | ")); process.exit(1); }
console.log(`CLAUDE.md for the card: ${md.length} → ${text.length} characters`);
if (!process.argv.includes("--check")) fs.writeFileSync("CLAUDE.md", text);
