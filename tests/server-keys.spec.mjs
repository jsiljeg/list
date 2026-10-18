/* The server takes listed GitHub keys only (2026-10-18). Before, any key of
   the owner's account opened Troškovi and Prihodi on theatrium.devinos.hr, so
   a leaked gh CLI key would have been enough. isStaffAsync() now also needs
   the key's fingerprint in TABLET_KEYS (or WINE_GH_KEYS), and an unlisted key
   of the owner's is reported once rather than refused silently. */
import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { isStaffAsync, TABLET_KEYS } from "../web/functions/_lib/wines.js";

const print = (t) => createHash("sha256").update(t).digest("hex").slice(0, 16);
const req = (t) => new Request("https://theatrium.devinos.hr/api/troskovi", { headers: { authorization: `Bearer ${t}` } });

test("only a listed key of the owner's account is staff", async () => {
  const real = globalThis.fetch, mails = [];
  globalThis.fetch = async (url) => (String(url).includes("api.github.com/user")
    ? new Response(JSON.stringify({ login: "jsiljeg" }), { status: 200 }) : new Response("{}"));
  const ALERTS = { fetch: async (_u, init) => { mails.push(JSON.parse(init.body)); return new Response("{}"); } };
  try {
    const listed = "github_pat_" + "L".repeat(40), other = "github_pat_" + "U".repeat(40);
    const env = { WINE_GH_KEYS: print(listed), ALERTS };
    expect(await isStaffAsync(req(listed), env)).toBe(true);
    /* the owner's account, but not a listed device */
    expect(await isStaffAsync(req(other), env)).toBe(false);
    expect(await isStaffAsync(req(other), env)).toBe(false);
    expect(mails.length).toBe(1);
    expect(mails[0].body).toContain(print(other));
    /* the code list holds fingerprints, never keys */
    expect(Object.keys(TABLET_KEYS).every((k) => /^[0-9a-f]{16}$/.test(k))).toBe(true);
  } finally { globalThis.fetch = real; }
});
