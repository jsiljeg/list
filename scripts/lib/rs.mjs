/* Residual sugar in grams per litre.

   Stored as a **string**, like `insight.alcohol` — every other analytic figure
   in wines.json already is one, and a string is what lets a producer's own
   imprecision through without us inventing a number to replace it.

   Ca' La Bionda publish their Recioto as "120-140 grams per litre" and nothing
   narrower, because a passito's sugar moves with the drying. Storing the
   midpoint would print 130 g/l at a guest as if somebody had measured it. The
   range is the fact; "120–140 g/l" is what the card says.

   Accepted: "144", "129.33", "120–140". The separator is an en dash, matching
   the serving temperatures. Returns {lo, hi} in g/l, or null when the string
   is not a figure we can read — the caller decides whether that is an error. */
export function parseRs(rs) {
  if (typeof rs !== "string") return null;
  const m = /^(\d+(?:\.\d+)?)(?:\s*–\s*(\d+(?:\.\d+)?))?$/.exec(rs.trim());
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] === undefined ? lo : Number(m[2]);
  /* 0 is not a figure worth printing — a dry wine simply omits the field —
     and nothing ferments past 600 g/l, so either end outside that is a typo. */
  if (!(lo > 0 && hi < 600 && lo <= hi)) return null;
  return { lo, hi };
}
