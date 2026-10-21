// Sonde : structure réelle d'une carte KPI.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3001";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const launchOptions = fs.existsSync(CHROME) ? { executablePath: CHROME } : { channel: "chrome" };

const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
const page = await context.newPage();
await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(1000);
const demo = page.locator("text=Afficher les comptes").first();
if (await demo.count()) { await demo.click(); await page.waitForTimeout(400); const a = page.locator("text=Marie RAKOTO").first(); if (await a.count()) { await a.click(); await page.waitForTimeout(300); } }
const submit = page.locator('button[type="submit"]').first();
if (await submit.count()) { await submit.click(); await page.waitForTimeout(2500); }

const out = await page.evaluate(() => {
  const kpi = document.querySelector(".cm-kpi");
  if (!kpi) return { error: "aucune carte KPI" };
  const row = kpi.firstElementChild;
  const icon = kpi.querySelector(".cm-kpi-icon");
  const body = kpi.querySelector(".cm-kpi-body");
  const d = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      cls: (el.className || "").toString().slice(0, 80),
      display: cs.display,
      gap: cs.gap,
      alignItems: cs.alignItems,
      position: cs.position,
      order: cs.order,
      flexDirection: cs.flexDirection,
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
    };
  };
  return {
    kpi: d(kpi),
    row: d(row),
    rowChildren: Array.from(row.children).map(d),
    icon: d(icon),
    body: d(body),
    iconExists: !!icon,
    bodyExists: !!body,
  };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
