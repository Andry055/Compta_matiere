const { chromium } = require("playwright");
const path = require("path");

const URL = "http://localhost:3456/";

(async () => {
  const browser = await chromium.launch();

  // --- Desktop 1920 : clair → sombre → persistance ---
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const readState = () =>
    page.evaluate(() => {
      const html = document.documentElement;
      const card = document.querySelector(".lg-card");
      const input = document.querySelector(".lg-input");
      const toggle = document.querySelector(".lg-toggle");
      const cs = (el) => (el ? getComputedStyle(el) : null);
      return {
        isDarkClass: html.classList.contains("dark"),
        savedTheme: localStorage.getItem("theme"),
        pageBg: cs(document.querySelector(".lg-page")).backgroundColor,
        cardBg: cs(card).backgroundColor,
        cardBorder: cs(card).borderTopColor,
        titleColor: cs(document.querySelector(".lg-title")).color,
        inputBg: cs(input).backgroundColor,
        inputBorder: cs(input).borderTopColor,
        inputColor: cs(input).color,
        footerColor: cs(document.querySelector(".lg-footer")).color,
        toggleVisible: !!toggle && toggle.getBoundingClientRect().width > 0,
        toggleIcon: toggle ? toggle.getAttribute("aria-label") : null,
        overflowX: html.scrollWidth > html.clientWidth,
      };
    });

  const light = await readState();
  console.log("[clair]");
  console.log(`  .dark: ${light.isDarkClass} | theme: ${light.savedTheme} | fond: ${light.pageBg}`);
  console.log(`  carte: ${light.cardBg} | titre: ${light.titleColor} | input: ${light.inputBg}`);
  console.log(`  toggle visible: ${light.toggleVisible} ("${light.toggleIcon}") | overflowX: ${light.overflowX}`);
  await page.screenshot({ path: path.join(__dirname, "login-light-desktop.jpg"), type: "jpeg", quality: 80, fullPage: true });

  // Bascule vers le sombre
  await page.click(".lg-toggle");
  await page.waitForTimeout(500);
  const dark = await readState();
  console.log("[sombre après clic]");
  console.log(`  .dark: ${dark.isDarkClass} | theme: ${dark.savedTheme} | fond: ${dark.pageBg}`);
  console.log(`  carte: ${dark.cardBg} | bordure: ${dark.cardBorder} | titre: ${dark.titleColor}`);
  console.log(`  input: ${dark.inputBg} / bordure ${dark.inputBorder} / texte ${dark.inputColor}`);
  console.log(`  footer: ${dark.footerColor} | toggle ("${dark.toggleIcon}") | overflowX: ${dark.overflowX}`);
  await page.screenshot({ path: path.join(__dirname, "login-dark-desktop.jpg"), type: "jpeg", quality: 80, fullPage: true });

  // Persistance après rechargement
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const afterReload = await readState();
  console.log("[rechargement]");
  console.log(`  .dark: ${afterReload.isDarkClass} | theme: ${afterReload.savedTheme} | carte: ${afterReload.cardBg}`);

  // Retour au clair
  await page.click(".lg-toggle");
  await page.waitForTimeout(400);
  const backLight = await readState();
  console.log("[retour clair] .dark: " + backLight.isDarkClass + " | theme: " + backLight.savedTheme);
  await ctx.close();

  // --- Mobile 375 : sombre ---
  const ctxM = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pageM = await ctxM.newPage();
  await pageM.goto(URL, { waitUntil: "networkidle" });
  await pageM.evaluate(() => localStorage.setItem("theme", "dark"));
  await pageM.reload({ waitUntil: "networkidle" });
  await pageM.waitForTimeout(1000);
  const mobile = await pageM.evaluate(() => {
    const html = document.documentElement;
    const toggle = document.querySelector(".lg-toggle");
    const r = toggle ? toggle.getBoundingClientRect() : null;
    return {
      isDarkClass: html.classList.contains("dark"),
      overflowX: html.scrollWidth > html.clientWidth,
      toggleInViewport: r ? r.right <= html.clientWidth && r.top >= 0 : false,
      brokenImgs: Array.from(document.querySelectorAll("img"))
        .filter((i) => i.src && (!i.complete || i.naturalWidth === 0))
        .map((i) => i.alt || i.src),
    };
  });
  console.log("[mobile sombre 375]");
  console.log(`  .dark: ${mobile.isDarkClass} | overflowX: ${mobile.overflowX} | toggle visible: ${mobile.toggleInViewport}`);
  console.log(`  images cassées: ${JSON.stringify(mobile.brokenImgs)}`);
  await pageM.screenshot({ path: path.join(__dirname, "login-dark-mobile.jpg"), type: "jpeg", quality: 80, fullPage: true });
  await ctxM.close();

  await browser.close();

  const ok =
    !light.isDarkClass &&
    dark.isDarkClass &&
    dark.savedTheme === "dark" &&
    afterReload.isDarkClass &&
    backLight.isDarkClass === false &&
    backLight.savedTheme === "light" &&
    !dark.overflowX &&
    !mobile.overflowX &&
    mobile.isDarkClass &&
    mobile.toggleInViewport &&
    mobile.brokenImgs.length === 0;
  console.log(ok ? "✅ TOUTES LES VÉRIFICATIONS PASSENT" : "❌ ÉCHEC DANS LES VÉRIFICATIONS");
  process.exit(ok ? 0 : 1);
})();
