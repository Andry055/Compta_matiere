const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const viewports = [
    { name: "mobile-375", width: 375, height: 812 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1920", width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();
    await page.goto("http://localhost:3456/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const checks = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflowX = doc.scrollWidth > doc.clientWidth;
      const overflowingEls = [];
      if (overflowX) {
        document.querySelectorAll("*").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.right > doc.clientWidth + 2) {
            overflowingEls.push(
              el.tagName + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "")
            );
          }
        });
      }
      const imgs = Array.from(document.querySelectorAll("img"));
      const brokenImgs = imgs
        .filter((i) => i.src && (!i.complete || i.naturalWidth === 0))
        .map((i) => i.alt || i.src);
      const btn = document.querySelector('button[type="submit"]');
      const btnRect = btn ? btn.getBoundingClientRect() : null;
      const btnStyle = btn ? getComputedStyle(btn) : null;
      const btnVisibleInViewport = btnRect ? btnRect.top < window.innerHeight && btnRect.bottom > 0 : false;
      const btnBackground = btnStyle ? btnStyle.backgroundImage : "";
      const inputs = Array.from(document.querySelectorAll("input:not([type=checkbox])"));
      const inputsBordered = inputs.map((i) => getComputedStyle(i).borderTopWidth !== "0px");
      const eyeBtn = document.querySelector('button[aria-label*="ot de passe"]');
      return {
        overflowX,
        overflowingEls: overflowingEls.slice(0, 5),
        imgCount: imgs.length,
        brokenImgs,
        btnText: btn ? btn.textContent.trim() : null,
        btnVisibleInViewport,
        btnHasGradient: btnBackground.includes("gradient"),
        inputsBordered,
        eyeBtnIsButton: eyeBtn ? eyeBtn.tagName === "BUTTON" : false,
      };
    });

    await page.screenshot({
      path: path.join(__dirname, `login-${vp.name}.png`),
      fullPage: true,
    });

    console.log(`[${vp.name}]`);
    console.log(`  overflowX: ${checks.overflowX} ${checks.overflowingEls.length ? "| depasse: " + checks.overflowingEls.join(", ") : ""}`);
    console.log(`  images: ${checks.imgCount} | cassees: ${JSON.stringify(checks.brokenImgs)}`);
    console.log(`  bouton: "${checks.btnText}" | visible viewport: ${checks.btnVisibleInViewport} | dégradé: ${checks.btnHasGradient}`);
    console.log(`  inputs bordés: ${JSON.stringify(checks.inputsBordered)} | œil = button: ${checks.eyeBtnIsButton}`);
    await context.close();
  }

  await browser.close();
  console.log("Captures terminées.");
})();
