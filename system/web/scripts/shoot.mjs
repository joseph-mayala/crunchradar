// Screenshot every page against a running dev server (mock mode).
// Usage: node scripts/shoot.mjs [baseUrl] [outDir]
// Needs playwright-core; set PW_CORE to its path and CHROME to a Chromium binary.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE ?? "/tmp/pw/node_modules/playwright-core");
const base = process.argv[2] ?? "http://localhost:5199";
const out = process.argv[3] ?? ".shots";
mkdirSync(out, { recursive: true });

const S = "email=student%40example.edu&token=demo-token";
const pages = [
  ["landing", "/", true],
  ["overview", "/app", true],
  ["approvals", "/app/approvals", false],
  ["runs", "/app/runs", false],
  ["email", "/app/email", false],
  ["check", "/app/check", true],
  ["extensions", "/app/extensions", false],
  ["settings", "/app/settings", false],
  ["drawer", "/app", "only-mobile"],
  ["approve", "/approve/demo", true],
  ["approve-used", "/approve/used", false],
  ["approve-expired", "/approve/expired", false],
  ["approve-unknown", "/approve/nope", false],
  ["decline", "/lecturer/demo/decline", false],
  ["decline-used", "/lecturer/used/decline", false],
  ["student", `/student?${S}`, true],
  ["student-bad", "/student?email=x&token=bad", false],
  ["student-extension", `/student/extension?${S}`, true],
  ["notfound", "/nowhere", false],
  ["approve-done", "/approve/demo", false],
  ["student-extension-sent", `/student/extension?${S}`, false],
];

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/home/tinashe/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" });
const problems = [];
for (const [w, mobile] of [[1280, false], [375, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 812 : 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  for (const [name, path, key] of pages) {
    if (mobile && !key) continue;
    if (!mobile && key === "only-mobile") continue;
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && problems.push(`${name}@${w} console: ${m.text()}`));
    page.on("pageerror", (e) => problems.push(`${name}@${w} pageerror: ${e.message}`));
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(700);
    if (name === "check") {
      await page.getByRole("button", { name: "Check this week" }).click();
      await page.getByRole("button", { name: "Read brief" }).click();
      await page.waitForTimeout(900);
    }
    if (name === "drawer") {
      await page.getByRole("button", { name: "Open the menu" }).click();
      await page.waitForTimeout(700);
    }
    if (name === "approve-done") {
      await page.getByRole("button", { name: "Approve" }).click();
      await page.waitForTimeout(800);
    }
    if (name === "student-extension-sent") {
      await page.getByRole("button", { name: "Send request" }).click();
      await page.waitForTimeout(800);
    }
    if (name === "email") {
      await page.locator(".mail button[aria-expanded]").first().click();
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) problems.push(`${name}@${w}: horizontal page overflow ${overflow}px`);
    await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(problems.length ? problems.join("\n") : "no console errors or overflow");
