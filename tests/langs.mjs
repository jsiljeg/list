/* The languages the app offers, read out of js/i18n.js rather than hard-coded,
   so adding a ninth language does not silently skip it in the tests. */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/* import.meta.dirname needs Node 20.11; this works everywhere. */
const HERE = dirname(fileURLToPath(import.meta.url));

const src = readFileSync(resolve(HERE, "../js/i18n.js"), "utf8");
const block = src.slice(src.indexOf("const LANGS"), src.indexOf("];", src.indexOf("const LANGS")));
export const I18N_LANGS = [...block.matchAll(/code:\s*"([a-z-]+)"/g)].map((m) => m[1]);

if (I18N_LANGS.length < 2) throw new Error("could not read the language list out of js/i18n.js");
