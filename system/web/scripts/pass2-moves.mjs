// Approve a move through the app (mock), then open its week and confirm the Moves section shows it.
// Also lists any 404 responses on a base URL. Usage: node scripts/pass2-moves.mjs <mockBase> <realBase> <outDir>
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE ?? "/tmp/pw/node_modules/playwright-core");
const [mock = "http://localhost:5199", real = "http://localhost:8800", out = ".shots/p2moves"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/home/tinashe/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" });
let fail = 0;
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const bad = [];
  p.on("response", (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
  for (const path of ["/", "/app"]) {
    await p.goto(real + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
  }
  console.log("real-backend 4xx/5xx:", bad.length ? bad.join(" | ") : "none");
}
{
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.goto(mock + "/approve/demo", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /^Approve/ }).click();
  await p.waitForTimeout(1200);
  // Same tab keeps the in-memory mock state: navigate client-side.
  await p.evaluate(() => { history.pushState({}, "", "/app"); dispatchEvent(new PopStateEvent("popstate")); });
  await p.waitForSelector(".chart rect.hit", { timeout: 20000 });
  for (const w of [11, 13]) {
    await p.locator(`.chart rect.hit[data-week="${w}"]`).click();
    await p.waitForFunction((w) => document.querySelector("#week-overlay-h")?.textContent?.trim() === `Week ${w}` && !document.querySelector('[role="dialog"] [aria-busy="true"]'), w);
    await p.waitForTimeout(500);
    const t = await p.locator('[role="dialog"]').innerText();
    const okMove = /APPROVED/i.test(t) && /Architecture report from Week 11 to Week 13/.test(t);
    console.log(`${okMove ? "PASS" : "FAIL"} week ${w} Moves section shows the approved SWAT move`);
    if (!okMove) fail++;
    if (w === 13) {
      await p.locator('[role="dialog"] h3', { hasText: "Moves touching" }).scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${out}-week13.png` });
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
  }
}
await browser.close();
process.exit(fail ? 1 : 0);
