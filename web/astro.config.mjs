import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Staging host for now. Phase 4 swaps this for https://theatrium.hr and every
// old URL gets a 301 — those six indexed pages are the search equity we have.
export default defineConfig({
  site: "https://theatrium.preview.devinos.hr",
  // /kuhinja/ is the staff page for the daily offer: public by necessity
  // (Pages has no auth), useless without the key, and no business in a sitemap.
  integrations: [sitemap({ filter: (page) => !page.includes("/kuhinja/") })],
  build: { inlineStylesheets: "auto" },
  compressHTML: true,
});
