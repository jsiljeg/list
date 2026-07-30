import { defineConfig, devices } from "@playwright/test";

/* Three viewports, because nearly every layout bug this list has had was one
   viewport only: the glass under the ✕ needed a phone, the rating chips over the
   glass needed a laptop, and the swipe dead zones needed a tablet and passed
   everywhere else. Touch is on for tablet and phone — the gesture tests need a
   real touch pipeline, not synthetic events. */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }], ["list"]] : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: `http://127.0.0.1:${process.env.PORT || 4173}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    /* The app animates on nearly every interaction. Tests assert on the settled
       state, so the animations are only latency. */
    reducedMotion: "reduce"
  },

  projects: [
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }
    },
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    },
    {
      name: "laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }
    }
  ],

  webServer: {
    command: "node tests/serve.mjs",
    url: `http://127.0.0.1:${process.env.PORT || 4173}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore"
  }
});
