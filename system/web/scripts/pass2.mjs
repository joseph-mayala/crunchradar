// Pass 2 checks: palette D, the bar chart, the week overlay (e2e), media queries, zoom, console errors.
// Usage: node scripts/pass2.mjs [baseUrl] [outDir]
// Base URL: the mock dev server (http://localhost:5199) or the real backend serving dist (http://localhost:8800).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE ?? "/tmp/pw/node_modules/playwright-core");
const base = process.argv[2] ?? "http://localhost:5199";
const out = process.argv[3] ?? ".shots/pass2";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/home/tinashe/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" });
const fails = [];
const notes = [];
const ok = (cond, msg) => (cond ? notes.push(`PASS ${msg}`) : fails.push(`FAIL ${msg}`));

async function ctx(width, opts = {}) {
  const c = await browser.newContext({ viewport: { width, height: width < 600 ? 812 : 900 }, deviceScaleFactor: 1, ...opts });
  const p = await c.newPage();
  p.on("console", (m) => m.type() === "error" && fails.push(`FAIL console@${width}: ${m.text()}`));
  p.on("pageerror", (e) => fails.push(`FAIL pageerror@${width}: ${e.message}`));
  return { c, p };
}
const dialog = (p) => p.locator('[role="dialog"][aria-labelledby="week-overlay-h"]');
async function waitWeek(p, n) {
  await dialog(p).waitFor({ state: "visible", timeout: 15000 });
  await p.waitForFunction((n) => document.querySelector("#week-overlay-h")?.textContent?.trim() === `Week ${n}`, n, { timeout: 15000 });
  await p.waitForFunction(() => !document.querySelector('[role="dialog"] [aria-busy="true"]'), null, { timeout: 15000 });
  await p.waitForTimeout(650);
}
async function closeAndCheckFocus(p, label) {
  await p.keyboard.press("Escape");
  await dialog(p).waitFor({ state: "detached", timeout: 5000 });
  const back = await p.evaluate(() => document.activeElement?.getAttribute("data-week"));
  ok(back !== null, `${label}: focus returns to the trigger (data-week=${back})`);
}

for (const width of [1280, 375]) {
  const { c, p } = await ctx(width);
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/landing-top-${width}.png` });
  const barH = await p.evaluate(() => [...document.querySelectorAll(".navbar a, .navbar button")].map((e) => Math.round(e.getBoundingClientRect().height)));
  ok(barH.every((h) => h >= 44), `top bar targets >= 44 px at ${width} (${barH.join(",")})`);

  await p.goto(base + "/app", { waitUntil: "networkidle" });
  await p.waitForSelector(".chart .bar", { timeout: 20000 });
  await p.waitForTimeout(1200);
  await p.locator("#load").screenshot({ path: `${out}/chart-${width}.png` });
  await p.locator("#heat").screenshot({ path: `${out}/heat-${width}.png` });
  const hot = await p.locator(".chart .bar.hot").count();
  ok(hot >= 1, `over-limit bars drawn in coral at ${width} (${hot})`);
  ok((await p.locator(".chart text.limlab").textContent())?.startsWith("limit "), `limit label present at ${width}`);

  // 1. From a week header.
  if (width >= 768) {
    const head = p.locator('button.heat-head[data-week="11"]');
    await head.focus();
    await p.keyboard.press("Enter");
    await waitWeek(p, 11);
    const txt = await dialog(p).innerText();
    ok(/15 to 21 Mar/.test(txt), "header: date range 15 to 21 Mar");
    ok(/over the 28 h limit/.test(txt), "header: over-limit line");
    ok(/found in a brief/i.test(txt), "header: hidden task tag");
    await p.screenshot({ path: `${out}/overlay-header-${width}.png` });
    // Keyboard path: Tab stays inside, arrows move weeks.
    for (let i = 0; i < 12; i++) await p.keyboard.press("Tab");
    ok(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), "focus stays trapped in the overlay after 12 Tabs");
    await p.keyboard.press("ArrowRight");
    await waitWeek(p, 12);
    await p.keyboard.press("ArrowLeft");
    await waitWeek(p, 11);
    ok(true, "arrow keys move between weeks");
    await closeAndCheckFocus(p, "header");
  }

  // 2. From a cell (SWAT, week 11): that module's rows are highlighted.
  const cell = p.locator('button.heat-cell[data-week="11"][data-mod="SWAT"]');
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await waitWeek(p, 11);
  const sel = await dialog(p).locator('[data-selected="true"]').count();
  ok(sel >= 1, `cell@${width}: pressed module highlighted (${sel})`);
  await p.screenshot({ path: `${out}/overlay-cell-${width}.png` });
  // click outside closes (desktop only; the sheet covers the bottom)
  if (width >= 768) {
    await p.mouse.click(10, 10);
    await dialog(p).waitFor({ state: "detached", timeout: 5000 });
    ok(true, "click outside closes");
  } else {
    await closeAndCheckFocus(p, `cell@${width}`);
  }

  // 3. From a bar.
  const bar = p.locator('.chart rect.hit[data-week="11"]');
  await bar.scrollIntoViewIfNeeded();
  await bar.click();
  await waitWeek(p, 11);
  await p.screenshot({ path: `${out}/overlay-bar-${width}.png` });
  await p.getByRole("button", { name: /^Next week/ }).click();
  await waitWeek(p, 12);
  await closeAndCheckFocus(p, `bar@${width}`);

  for (const [name, path] of [["approvals", "/app/approvals"], ["settings", "/app/settings"], ["runs", "/app/runs"], ["approve", "/approve/demo"]]) {
    await p.goto(base + path, { waitUntil: "networkidle" });
    await p.waitForSelector("h1", { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
  }
  await c.close();
}

// Emulated media: reduced motion, reduced transparency, more contrast; and 200% zoom.
for (const [label, opts] of [
  ["reduced-motion", { reducedMotion: "reduce" }],
  ["more-contrast", { contrast: "more" }],
]) {
  const { c, p } = await ctx(1280, opts);
  await p.goto(base + "/app", { waitUntil: "networkidle" });
  await p.waitForSelector(".chart .bar", { timeout: 20000 });
  await p.locator('.chart rect.hit[data-week="11"]').click();
  await waitWeek(p, 11);
  await p.screenshot({ path: `${out}/media-${label}.png` });
  await c.close();
}
{
  const { c, p } = await ctx(1280);
  const cdp = await c.newCDPSession(p);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
  await p.goto(base + "/app", { waitUntil: "networkidle" });
  await p.waitForSelector(".chart .bar", { timeout: 20000 });
  await p.locator('.chart rect.hit[data-week="11"]').click();
  await waitWeek(p, 11);
  const bf = await p.evaluate(() => getComputedStyle(document.querySelector(".overlay-scrim")).backdropFilter);
  ok(bf === "none", `reduced transparency: solid backdrop (backdrop-filter ${bf})`);
  await p.screenshot({ path: `${out}/media-reduced-transparency.png` });
  await c.close();
}
{
  // 200% zoom ~ a 640 px wide viewport at device scale 2.
  const { c, p } = await ctx(640, { deviceScaleFactor: 2 });
  await p.goto(base + "/app", { waitUntil: "networkidle" });
  await p.waitForSelector(".chart .bar", { timeout: 20000 });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(sw <= 0, `200% zoom: no horizontal page scroll (${sw})`);
  await p.locator('.chart rect.hit[data-week="11"]').click();
  await waitWeek(p, 11);
  await p.screenshot({ path: `${out}/zoom200.png` });
  await c.close();
}

await browser.close();
console.log(notes.join("\n"));
console.log(fails.length ? fails.join("\n") : "ALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
