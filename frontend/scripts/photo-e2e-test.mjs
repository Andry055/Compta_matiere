// Test E2E "Capture photo magasinier" — Node pur, WebSocket CDP brut.
// Le test passe par l'input fichier (même pipeline que la caméra :
// input → compressImageFile → aperçu → persistance localStorage → PV).
//
// Prérequis :
//   - serveur Vite lancé sur http://localhost:3000
//   - Chrome installé à l'emplacement CHROME
//
// Usage : node scripts/photo-e2e-test.mjs

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3000";
// Profil Chrome HORS du projet : Chrome verrouille ses fichiers (EBUSY) et
// faisait planter le watcher Vite. Chemin absolu requis sous Windows.
const PROFILE = path.join(os.tmpdir(), "compta-photo-e2e-profile");
const CDP_PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// JPEG 1x1 rouge (base64) — suffisant pour traverser le pipeline de compression.
const TEST_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDUzNDP/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAP8A/9k=";

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(JSON.parse(d)));
      })
      .on("error", reject);
  });
}

// ──────────────────────────────────────────────
// Classe client CDP minimal
// ──────────────────────────────────────────────

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.msgId = 0;
    this.pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error("Connexion WebSocket CDP impossible"));
    });
    return new CdpClient(ws);
  }

  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      const payload = sessionId
        ? { id, method, params, sessionId }
        : { id, method, params };
      this.ws.send(JSON.stringify(payload));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

// ──────────────────────────────────────────────
// Script JS injecté dans la page (seed + scénario)
// ──────────────────────────────────────────────

const SEED_SCRIPT = `(function () {
  localStorage.clear();
  localStorage.setItem("receptionEnCours", JSON.stringify({
    fournisseur: "Test Fournisseur SARL",
    numeroBL: "BL-PHOTO-001",
    dateBL: "${new Date().toISOString().split("T")[0]}",
    articles: [{
      id: "art-photo-1",
      designation: "Ordinateur portable test",
      referenceNomenclature: "NOM-INFO-001",
      quantiteCommandee: 2,
      quantiteLivree: 2,
      prixUnitaire: 1200000
    }],
    observationsBL: "",
    controles: [{
      articleId: "art-photo-1",
      etat: "neuf",
      conforme: true,
      remarque: ""
    }],
    magasinierCertifie: false,
    depositaireCertifie: false,
    journalEntryId: "JE-2026-0001"
  }));
  localStorage.removeItem("currentUser");
  localStorage.removeItem("loginTime");
})();`;

const LOGIN_MAGASINIER_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const setNative = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    setter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const email = document.getElementById("email");
  const pw = document.getElementById("password");
  if (!email || !pw) return { ok: false, step: "champs login absents" };
  setNative(email, "fara.andriam@mtefop.gov.mg");
  setNative(pw, "magasinier123");
  await sleep(100);
  const form = email.closest("form");
  const submit = form
    ? form.querySelector('button[type="submit"]')
    : null;
  if (!submit) return { ok: false, step: "bouton connexion absent" };
  submit.click();
  await sleep(1500);
  const saved = localStorage.getItem("currentUser");
  if (!saved) return { ok: false, step: "currentUser non écrit" };
  const user = JSON.parse(saved);
  return { ok: user.role === "magasinier", role: user.role };
})()`;

const OPEN_ARRIVEE_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const buttons = Array.from(document.querySelectorAll("button"));
  const nav = buttons.find((b) =>
    (b.textContent || "").includes("Arrivée Matériel")
  );
  if (!nav) return { ok: false, step: "bouton Arrivée Matériel introuvable" };
  nav.click();
  await sleep(1200);
  const h1 = document.querySelector("h1");
  return {
    ok: !!h1 && (h1.textContent || "").includes("Réception de Matériel"),
    titre: h1 ? h1.textContent : null,
  };
})()`;

const CHECK_ONGLET_SCRIPT = `(() => {
  const body = document.body.textContent || "";
  return {
    ongletControle: body.includes("Contrôle physique des articles"),
    pasSimulateur: !body.includes("Connecté en tant que"),
    badgeCertifie: body.includes("Certifié") || body.includes("À contrôler"),
  };
})()`;

const ADD_PHOTO_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const jpegB64 = "${TEST_JPEG_B64}";
  const byteChars = atob(jpegB64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const file = new File([bytes], "photo-test.jpg", { type: "image/jpeg" });

  const inputs = Array.from(
    document.querySelectorAll('input[type="file"][accept="image/*"]')
  );
  if (inputs.length === 0) {
    return { ok: false, step: "input photo introuvable" };
  }
  const input = inputs[0];
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(1500);
  const previews = document.querySelectorAll('img[alt="Photo 1"]');
  return { ok: previews.length > 0, apercu: previews.length };
})()`;

const CHECK_PERSISTENCE_SCRIPT = `(() => {
  const raw = localStorage.getItem("receptionEnCours");
  if (!raw) return { ok: false, step: "receptionEnCours absent" };
  const data = JSON.parse(raw);
  const c = (data.controles || [])[0] || {};
  const photos = c.photos || [];
  return {
    ok: photos.length > 0 && photos[0].startsWith("data:image/jpeg"),
    nbPhotos: photos.length,
    format: photos[0] ? photos[0].slice(0, 15) : null,
    largeur: photos[0] ? Math.round(JSON.stringify(photos[0]).length / 1024) + " Ko" : null,
  };
})()`;

const CERTIFY_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cb = document.getElementById("certification-magasinier");
  if (!cb) return { ok: false, step: "checkbox certification absente" };
  if (cb.disabled) return { ok: false, step: "checkbox désactivée" };
  cb.click();
  await sleep(1200);
  const raw = localStorage.getItem("receptionEnCours");
  const data = raw ? JSON.parse(raw) : {};
  return {
    ok: !!data.magasinierCertifie,
    certifie: !!data.magasinierCertifie,
    ecranFin: (document.body.textContent || "").includes("Réception certifiée"),
  };
})()`;

const LOGIN_DEPOSITAIRE_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const buttons = Array.from(document.querySelectorAll("button"));
  const logout = buttons.find((b) => (b.title || "") === "Se déconnecter");
  if (!logout) return { ok: false, step: "bouton déconnexion introuvable" };
  logout.click();
  await sleep(1000);
  const setNative = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    setter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const email = document.getElementById("email");
  const pw = document.getElementById("password");
  if (!email || !pw) return { ok: false, step: "champs login absents" };
  setNative(email, "hery.rakoto@mtefop.gov.mg");
  setNative(pw, "depositaire123");
  await sleep(100);
  const submit = email.closest("form").querySelector('button[type="submit"]');
  submit.click();
  await sleep(1500);
  const saved = localStorage.getItem("currentUser");
  if (!saved) return { ok: false, step: "currentUser non écrit" };
  const user = JSON.parse(saved);
  return { ok: user.role === "depositaire", role: user.role };
})()`;

const OPEN_ARRIVEE_DEPOSITAIRE_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const buttons = Array.from(document.querySelectorAll("button"));
  const nav = buttons.find((b) =>
    (b.textContent || "").includes("Arrivée Matériel")
  );
  if (!nav) return { ok: false, step: "bouton Arrivée Matériel introuvable" };
  nav.click();
  await sleep(1200);
  const body = document.body.textContent || "";
  return {
    ok: body.includes("Synthèse du contrôle physique") || body.includes("À enregistrer"),
    badgeAttente: body.includes("En attente magasinier"),
    synthese: body.includes("Synthèse du contrôle physique"),
  };
})()`;

const GOTO_PV_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const body = document.body.textContent || "";
  // Si déjà au PV, ok.
  if (body.includes("PROCÈS-VERBAL DE RÉCEPTION")) {
    return { ok: true, dejaAuPV: true };
  }
  // Étape 3 : cocher d'abord la certification du dépositaire (sinon le bouton
  // « Valider l'enregistrement » est désactivé).
  const cert = document.getElementById("certification-depositaire");
  if (cert && !cert.checked && !cert.disabled) {
    cert.click();
    await sleep(800);
  }
  const validateBtn = Array.from(document.querySelectorAll("button")).find(
    (b) => (b.textContent || "").includes("Valider l'enregistrement")
  );
  if (validateBtn && !validateBtn.disabled) {
    validateBtn.click();
    await sleep(1800);
  }
  const pvBtn = Array.from(document.querySelectorAll("button")).find(
    (b) => (b.textContent || "").includes("PV de réception")
  );
  if (pvBtn) {
    pvBtn.click();
    await sleep(1200);
  }
  const body2 = document.body.textContent || "";
  return {
    ok: body2.includes("PROCÈS-VERBAL DE RÉCEPTION"),
    auPV: body2.includes("PROCÈS-VERBAL DE RÉCEPTION"),
  };
})()`;

const CHECK_PV_PHOTOS_SCRIPT = `(() => {
  const doc = document.getElementById("pv-reception-document");
  if (!doc) return { ok: false, step: "document PV absent" };
  const imgs = doc.querySelectorAll("img");
  const section = (doc.textContent || "").includes("Preuves photographiques");
  return {
    ok: section && imgs.length > 0,
    sectionPreuves: section,
    nbPhotosPV: imgs.length,
  };
})()`;

// ──────────────────────────────────────────────
// Orchestration
// ──────────────────────────────────────────────

const results = [];
function record(name, ok, detail) {
  const d =
    detail && typeof detail === "object" ? JSON.stringify(detail) : detail;
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${d ? " — " + d : ""}`);
}

// cdp ici = la fonction de session (s) : cdp(method, params)
async function evaluateJson(sessionFn, expression, label) {
  const res = await sessionFn("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    const desc =
      res.exceptionDetails.exception?.description ||
      res.exceptionDetails.text ||
      "exception inconnue";
    throw new Error(`${label}: ${desc}`);
  }
  return res.result.value;
}

async function screenshot(sessionFn, name) {
  const res = await sessionFn("Page.captureScreenshot", { format: "png" });
  const dir = path.resolve(__dirname, "..", "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${name}.png`),
    Buffer.from(res.data, "base64")
  );
  console.log(`   📸 screenshots/${name}.png`);
}

async function main() {
  fs.mkdirSync("frontend/screenshots", { recursive: true });

  // 1) Lancer Chrome headless (profil jetable)
  console.log("🚀 Lancement de Chrome headless…");
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1400,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let cdp = null;
  let exitCode = 0;

  try {
    // 2) Attendre l'endpoint CDP
    let page = null;
    for (let i = 0; i < 60; i++) {
      try {
        const targets = await getJSON(`http://127.0.0.1:${CDP_PORT}/json`);
        page = targets.find((t) => t.type === "page");
        if (page) break;
      } catch {
        /* Chrome pas prêt, retry */
      }
      await sleep(500);
    }
    if (!page) throw new Error("Chrome n'a pas démarré dans les délais");

    cdp = await CdpClient.connect(page.webSocketDebuggerUrl);

    // Attacher une session à la page
    const { sessionId } = await cdp.send("Target.attachToTarget", {
      targetId: page.id,
      flatten: true,
    });
    const s = (method, params) => cdp.send(method, params, sessionId);

    await s("Page.enable");
    await s("Runtime.enable");

    // 3) Seed localStorage à chaque navigation (avant le JS de l'app)
    await s("Page.addScriptToEvaluateOnNewDocument", {
      source: SEED_SCRIPT,
    });

    // 4) Charger l'app
    await s("Page.navigate", { url: BASE });
    await sleep(3500);

    // 5) Login magasinier
    const login = await evaluateJson(
      s,
      LOGIN_MAGASINIER_SCRIPT,
      "login magasinier"
    );
    record("Login magasinier", login.ok, login);
    await screenshot(s, "01-login-magasinier");

    // 6) Ouvrir « Arrivée Matériel »
    const nav = await evaluateJson(
      s,
      OPEN_ARRIVEE_SCRIPT,
      "navigation arrivée"
    );
    record("Onglet Arrivée Matériel ouvert", nav.ok, nav);

    // 7) Vérifier la vue simplifiée (onglet unique)
    const vue = await evaluateJson(
      s,
      CHECK_ONGLET_SCRIPT,
      "vérification onglet"
    );
    record(
      "Vue simplifiée (contrôle seul, sans simulateur)",
      vue.ongletControle && vue.pasSimulateur,
      vue
    );

    // 8) Ajouter une photo via l'input (même pipeline que la caméra)
    const photo = await evaluateJson(s, ADD_PHOTO_SCRIPT, "ajout photo");
    record("Capture photo (pipeline fichier = caméra)", photo.ok, photo);
    await screenshot(s, "02-apercu-photo");

    // 9) Certification du magasinier (déclenche la persistance + notification)
    const cert = await evaluateJson(s, CERTIFY_SCRIPT, "certification");
    record("Certification réception physique", cert.ok, cert);
    await screenshot(s, "03-ecran-fin-magasinier");

    // 10) Persistance : photos + certification dans receptionEnCours
    const persist = await evaluateJson(
      s,
      CHECK_PERSISTENCE_SCRIPT,
      "persistance"
    );
    record("Photo persistée (localStorage, JPEG compressé)", persist.ok, persist);

    // 11) Changer d'utilisateur → dépositaire
    const dep = await evaluateJson(
      s,
      LOGIN_DEPOSITAIRE_SCRIPT,
      "login dépositaire"
    );
    record("Login dépositaire", dep.ok, dep);

    const navDep = await evaluateJson(
      s,
      OPEN_ARRIVEE_DEPOSITAIRE_SCRIPT,
      "navigation dépositaire"
    );
    record(
      "Dépositaire : synthèse contrôle visible",
      navDep.ok,
      navDep
    );

    // 12) Aller au PV (valider l'enregistrement si nécessaire)
    const pv = await evaluateJson(s, GOTO_PV_SCRIPT, "accès PV");
    record("Accès au PV de réception", pv.ok, pv);
    await screenshot(s, "04-pv-reception");

    // 13) Photos dans le PV
    const pvPhotos = await evaluateJson(
      s,
      CHECK_PV_PHOTOS_SCRIPT,
      "photos dans PV"
    );
    record(
      "Section « Preuves photographiques » dans le PV",
      pvPhotos.ok,
      pvPhotos
    );
    await screenshot(s, "05-pv-preuves-photo");
  } catch (err) {
    console.error("💥 Erreur fatale:", err.message);
    exitCode = 1;
  } finally {
    cdp?.close();
    try {
      chrome.kill();
    } catch {
      /* ignore */
    }
  }

  // Bilan
  const okCount = results.filter((r) => r.ok).length;
  console.log("\\n═══ BILAN ═══");
  console.log(`📊 ${okCount}/${results.length} vérifications OK`);
  if (okCount < results.length) exitCode = 1;
  process.exit(exitCode);
}

main();
