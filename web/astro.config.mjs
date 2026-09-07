import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Staging host for now. Phase 4 swaps this for https://theatrium.hr and every
// old URL gets a 301 — those six indexed pages are the search equity we have.
export default defineConfig({
  site: "https://theatrium.preview.devinos.hr",
  integrations: [sitemap()],
  build: { inlineStylesheets: "auto" },
  compressHTML: true,
});
