#!/usr/bin/env node
/* A key for the head sommelier's /admin (web/ROLES.md §4).
 *
 *   node scripts/new-somm-key.mjs Toni
 *
 * Prints the key — give it to him, paste it on his device's /admin, and
 * nowhere else: never in a commit, a ticket or a chat that keeps it — and the
 * line that registers it on the server. Only the SHA-256 is ever stored; it
 * cannot be turned back into the key, so it is safe in the public repo.
 * Nothing is written to disk by this script. */
import { randomBytes, createHash } from "node:crypto";

const name = (process.argv[2] || "").replace(/[^\p{L} .-]/gu, "").trim();
if (!name) {
  console.error("usage: node scripts/new-somm-key.mjs <Name>");
  process.exit(1);
}
const key = "somm_" + randomBytes(32).toString("base64url");
const sha = createHash("sha256").update(key).digest("hex");
console.log(`
Ključ za ${name} (dajte mu ga, ne spremajte ga nigdje drugdje):

  ${key}

Registrirajte ga JEDNIM od ova dva načina:

  1. u kodu — web/functions/_lib/roles.js, u SOMM_KEYS:
       "${sha}": "${name}",
     pa deploy (deploy-web.yml);

  2. bez promjene koda — tajna WINE_SOMM_KEYS u okruženju theatrium
     (više ključeva odvojite zarezom):
       gh secret set WINE_SOMM_KEYS -e theatrium --body "${sha}:${name}"
     pa ponovno pokrenite deploy-web.yml.

Otisak na /admin (Prijavljen …): ${sha.slice(0, 16)}
`);
