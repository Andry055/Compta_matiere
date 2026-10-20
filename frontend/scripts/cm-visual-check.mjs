// Vérification visuelle et responsive de la refonte « Console Orbital ».
//
//   node scripts/cm-visual-check.mjs [http://localhost:3001]
//
// Contrôles, pour chaque point de rupture :
//   1. absence d'erreur console / d'exception ;
//   2. absence de débordement horizontal (documentElement.scrollWidth) ;
//   3. rendu des surfaces du design system (`.cm-shell`, `.cm-panel`, …) ;
//   4. capture PNG pour relecture visuelle.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3001";
const OUT = path.join(process.cwd(), ".cm-shots");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide", width: 1920, height: 1080 },
];

const PROBE = `(() => {
  const de = document.documentElement;
  const q = (s) => document.querySelector(s);
  const all = (s) => Array.from(document.querySelectorAll(s));
  // On repère les éléments qui dépassent le cadre de la fenêtre.
  const overflowing = all("body *").filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > de.clientWidth + 2;
  }).slice(0, 5).map((el) => ({
    tag: el.tagName,
    cls: (el.className || "").toString().slice(0, 90),
    right: Math.round(el.getBoundingClientRect().right),
  }));
  const cs = getComputedStyle(document.body);
  return {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    overflowX: de.scrollWidth > de.clientWidth + 1,
    hasShell: !!q(".cm-shell"),
    panels: all(".cm-panel, .cm-panel-solid, .cm-kpi").length,
    navItems: all(".cm-nav-item").length,
    topbars: all(".cm-topbar").length,
    bodyBg: cs.backgroundColor,
    bodyFont: cs.fontFamily,
    overflowing,
  };
})()`;

// Le binaire Playwright n'est pas téléchargé sur cette machine : on utilise
// le Chrome déjà installé (même approach que scripts/photo-e2e-test.mjs).
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const launchOptions = fs.existsSync(CHROME)
  ? { executablePath: CHROME }
  : { channel: "chrome" };

const browser = await chromium.launch(launchOptions);
let failures = 0;

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => consoleErrors.push(`EXCEPTION: ${e.message}`.slice(0, 160)));

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);

  // Écran de connexion : on renseigne un compte de démonstration pour
  // atteindre le tableau de bord (mode hors ligne).
  const demo = page.locator("text=Afficher les comptes").first();
  if (await demo.count()) {
    await demo.click();
    await page.waitForTimeout(400);
    const admin = page.locator("text=Marie RAKOTO").first();
    if (await admin.count()) {
      await admin.click();
      await page.waitForTimeout(300);
    }
  }
  const submit = page.locator('button[type="submit"]').first();
  if (await submit.count()) {
    await submit.click();
    await page.waitForTimeout(2500);
  }

  const probe = await page.evaluate(PROBE);
  const shot = path.join(OUT, `${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  const problems = [];
  if (consoleErrors.length) problems.push(`console: ${consoleErrors.slice(0, 3).join(" | ")}`);
  if (probe.overflowX) {
    problems.push(
      `débordement horizontal : scrollWidth=${probe.scrollWidth} > clientWidth=${probe.clientWidth}` +
        (probe.overflowing.length
          ? ` → ${probe.overflowing.map((o) => o.cls).join(" ; ")}`
          : ""),
    );
  }
  if (!probe.hasShell) problems.push("coque .cm-shell absente");

  if (problems.length) failures++;
  console.log(
    `\n[${vp.name} ${vp.width}×${vp.height}] ${problems.length ? "✗" : "✓"} ` +
      `panels=${probe.panels} nav=${probe.navItems} topbar=${probe.topbars} ` +
      `bg=${probe.bodyBg} scrollW=${probe.scrollWidth}`,
  );
  for (const p of problems) console.log(`    → ${p}`);

  await context.close();
}

await browser.close();
console.log(`\nCaptures : ${OUT}`);
process.exit(failures ? 1 : 0);
