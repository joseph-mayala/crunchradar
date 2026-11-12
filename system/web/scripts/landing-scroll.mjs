// Scroll the landing page and screenshot every half viewport, at desktop, phone and reduced motion.
// Usage: node scripts/landing-scroll.mjs [baseUrl] [outDir]
// Needs playwright-core (PW_CORE) and a Chromium binary (CHROME). Writes shots, a contact sheet per run and report.json.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE ?? "/tmp/pw/node_modules/playwright-core");
const base = process.argv[2] ?? "http://localhost:5199";
const out = process.argv[3] ?? ".shots/landing";
mkdirSync(out, { recursive: true });

const runs = [
  { name: "desk", width: 1280, height: 800, reduced: false },
  { name: "phone", width: 375, height: 812, reduced: false },
  { name: "reduced", width: 1280, height: 800, reduced: true },
];
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/home/tinashe/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" });
const report = {};
for (const r of runs) {
  const ctx = await browser.newContext({ viewport: { width: r.width, height: r.height }, deviceScaleFactor: 1, reducedMotion: r.reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForSelector(".relief, .relief-pair", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const dashes = await page.evaluate(() => (document.body.innerText.match(/[–—]/g) || []).length);
  const shots = [];
  const step = Math.round(r.height / 2);
  for (let y = 0, i = 0; y < (await page.evaluate(() => document.documentElement.scrollHeight)) - r.height / 2 + step; y += step, i++) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(r.reduced ? 120 : 650);
    const f = `${out}/${r.name}-${String(i).padStart(3, "0")}.png`;
    await page.screenshot({ path: f });
    shots.push(f);
  }
  report[r.name] = { total, overflowX, dashes, errors, shots: shots.length };
  // contact sheet
  const cols = r.width > 600 ? 5 : 8;
  const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px">${shots
    .map((s, i) => `<div style="position:relative"><img src="file://${process.cwd()}/${s}" style="width:100%;display:block"><b style="position:absolute;top:2px;left:4px;color:#ff0;font:12px monospace">${i}</b></div>`)
    .join("")}</body></html>`;
  writeFileSync(`${out}/${r.name}-sheet.html`, html);
  const sp = await ctx.newPage();
  await sp.setViewportSize({ width: 1600, height: 900 });
  await sp.goto(`file://${process.cwd()}/${out}/${r.name}-sheet.html`);
  await sp.waitForTimeout(500);
  await sp.screenshot({ path: `${out}/${r.name}-sheet.png`, fullPage: true });
  await ctx.close();
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
