// Design checks against a running dev server (mock mode): emulated media queries,
// 200% zoom, 200% text size, and WCAG contrast of buttons, tags and inputs.
// Usage: node scripts/checks.mjs [baseUrl] [outDir]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE ?? "/tmp/pw/node_modules/playwright-core");
const base = process.argv[2] ?? "http://localhost:5199";
const out = process.argv[3] ?? ".shots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/home/tinashe/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" });

async function open(path, features = [], width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (features.length) await cdp.send("Emulation.setEmulatedMedia", { features });
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForSelector("h1", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page };
}

const modes = [
  ["reduced-motion", [{ name: "prefers-reduced-motion", value: "reduce" }], "(prefers-reduced-motion: reduce)"],
  ["reduced-transparency", [{ name: "prefers-reduced-transparency", value: "reduce" }], "(prefers-reduced-transparency: reduce)"],
  ["more-contrast", [{ name: "prefers-contrast", value: "more" }], "(prefers-contrast: more)"],
];
for (const [name, features, query] of modes) {
  for (const [slug, path] of [["landing", "/"], ["overview", "/app"], ["approve", "/approve/demo"]]) {
    const { ctx, page } = await open(path, features);
    const matches = await page.evaluate((q) => matchMedia(q).matches, query);
    const nav = await page.evaluate(() => {
      const el = document.querySelector(".navbar, .sidebar");
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, blur: cs.backdropFilter };
    });
    await page.evaluate(() => window.scrollTo(0, 420));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${slug}-${name}.png` });
    console.log(`${name} ${slug}: media matches=${matches} nav=${JSON.stringify(nav)}`);
    await ctx.close();
  }
}

// 200% zoom: a 1280 px window at 200% browser zoom is a 640 CSS px viewport at device scale 2.
// Also 200% text-only size: double the root font size (rem-based layout).
for (const [slug, path] of [["landing", "/"], ["overview", "/app"], ["check", "/app/check"], ["approve", "/approve/demo"]]) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 450 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForSelector("h1", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.screenshot({ path: `${out}/${slug}-zoom200.png` });
  console.log(`zoom 200% ${slug}: horizontal overflow ${overflow}px`);
  await ctx.close();
}
for (const [slug, path] of [["landing", "/"], ["overview", "/app"], ["check", "/app/check"]]) {
  const { ctx, page } = await open(path, [], 1280);
  await page.addStyleTag({ content: "html{font-size:200% !important}" });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.screenshot({ path: `${out}/${slug}-text200.png` });
  console.log(`text-only 200% ${slug}: horizontal overflow ${overflow}px`);
  await ctx.close();
}

// Contrast of interactive elements and tags.
const { ctx, page } = await open("/approve/demo");
const { ctx: ctx2, page: page2 } = await open("/app/approvals");
const { ctx: ctx3, page: page3 } = await open("/app/check");
const measure = (sel) => {
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  // Blend a translucent colour onto an opaque one.
  const over = (fg, bg) => {
    const a = fg[3] ?? 1;
    return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
  };
  const effectiveBg = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) stack.push(parse(getComputedStyle(n).backgroundColor));
    let c = [8, 7, 14];
    for (const layer of stack.reverse()) if (layer.length && (layer[3] ?? 1) > 0) c = over(layer, c);
    return c;
  };
  return [...document.querySelectorAll(sel)].slice(0, 6).map((el) => {
    const fg = parse(getComputedStyle(el).color);
    const bg = effectiveBg(el);
    const L1 = lum(over(fg, bg));
    const L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    return `${(el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 28)}: ${ratio.toFixed(2)}`;
  });
};
console.log("lime button:", await page.evaluate(measure, ".btn-primary"));
console.log("ghost button:", await page.evaluate(measure, ".btn-ghost"));
console.log("tags (approvals):", await page2.evaluate(measure, "li span.uppercase"));
console.log("muted meta text:", await page2.evaluate(measure, "li .text-mute"));
console.log("inputs:", await page3.evaluate(measure, ".field"));
console.log("help text:", await page3.evaluate(measure, ".field-help"));
await ctx.close();
await ctx2.close();
await ctx3.close();
await browser.close();
