// Sonde ponctuelle : état calculé des éléments fautifs en vue mobile.
//   node scripts/cm-probe.mjs [http://localhost:3001]
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3001";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const launchOptions = fs.existsSync(CHROME)
  ? { executablePath: CHROME }
  : { channel: "chrome" };

const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
const page = await context.newPage();
await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(1000);

const demo = page.locator("text=Afficher les comptes").first();
if (await demo.count()) {
  await demo.click();
  await page.waitForTimeout(400);
  const admin = page.locator("text=Marie RAKOTO").first();
  if (await admin.count()) { await admin.click(); await page.waitForTimeout(300); }
}
const submit = page.locator('button[type="submit"]').first();
if (await submit.count()) { await submit.click(); await page.waitForTimeout(2500); }

const out = await page.evaluate(() => {
  const de = document.documentElement;
  const dump = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      cls: (el.className || "").toString().slice(0, 140),
      position: cs.position,
      transform: cs.transform,
      width: Math.round(r.width),
      left: Math.round(r.left),
      right: Math.round(r.right),
      display: cs.display,
    };
  };
  const shell = document.querySelector(".cm-shell");
  const kids = shell ? Array.from(shell.children).map(dump) : [];
  // éléments qui dépassent réellement la fenêtre
  const over = Array.from(document.querySelectorAll("body *"))
    .filter((el) => el.getBoundingClientRect().right > de.clientWidth + 2)
    .slice(0, 12)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || "")
          .toString().slice(0, 100),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        parent: (el.parentElement?.className || "").toString().slice(0, 70),
      };
    });
  return {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    shell: dump(shell),
    shellChildren: kids,
    over,
  };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
