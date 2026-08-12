import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const PORT = 4189;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 700, height: 300 }, deviceScaleFactor: 3, baseURL: `http://127.0.0.1:${PORT}` });
const page = await ctx.newPage();
/* Difference blend: identical images cancel to pure black, and a pure-black
   PNG compresses to almost nothing. Any surviving pixel is a real change. */
await page.setContent(`<body style="margin:0;background:#000">
  <div style="position:relative;width:680px;height:190px;isolation:isolate">
    <img src="http://127.0.0.1:${PORT}/scratch/shots/logo-old.svg" style="position:absolute;inset:0;width:680px">
    <img src="http://127.0.0.1:${PORT}/scratch/shots/logo-new.svg" style="position:absolute;inset:0;width:680px;mix-blend-mode:difference">
  </div></body>`);
await page.waitForTimeout(1200);
const diff = await page.screenshot({ clip: { x: 0, y: 0, width: 680, height: 190 } });
console.log("difference image:", diff.length, "bytes (a few hundred = identical)");
await page.setContent(`<body style="margin:0;background:#161513">
  <img src="http://127.0.0.1:${PORT}/scratch/shots/logo-new.svg" style="width:340px;display:block;margin:20px auto">
  <img src="http://127.0.0.1:${PORT}/scratch/shots/logo-old.svg" style="width:340px;display:block;margin:20px auto"></body>`);
await page.waitForTimeout(1200);
await page.screenshot({ path: "scratch/shots/logo-compare.png" });
await browser.close(); server.kill(); process.exit(0);
