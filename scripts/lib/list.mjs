/* Joining the wine library to a venue's list — for the tooling.

   The app does the same join in `mergeList()` (js/app.js), deliberately
   duplicated rather than shared: index.html loads classic scripts, not
   modules, and ten lines of spread syntax is a cheaper thing to keep in step
   than a build step would be. If you change one, change the other; the
   `data.spec.mjs` invariants run against this copy and the browser specs
   against that one, so a divergence shows up as a test disagreeing with itself. */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const read = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));

/** The library keyed by ref: what each wine *is*, independent of any venue. */
export function library() {
  return read("library/wines.json").wines;
}

/**
 * A venue's list with every ref resolved — the shape the rest of the tooling
 * has always expected from wines.json.
 * Returns `{ list, missing, orphans }` so callers can report rather than throw.
 */
export function joinList(rel = "lists/theatrium.json") {
  const wines = library();
  const list = read(rel);
  const missing = [];
  const used = new Set();
  const sections = list.sections.map((sec) => ({
    ...sec,
    categories: sec.categories.map((cat) => ({
      ...cat,
      groups: cat.groups.map((g) => ({
        ...g,
        items: g.items.map((entry) => {
          const facts = wines[entry.ref];
          if (!facts) { missing.push(entry.ref); return null; }
          used.add(entry.ref);
          const venue = { ...entry };
          delete venue.ref;
          return { ...facts, ...venue };
        }).filter(Boolean)
      }))
    }))
  }));
  const orphans = Object.keys(wines).filter((ref) => !used.has(ref));
  return { list: { ...list, sections }, missing, orphans };
}
