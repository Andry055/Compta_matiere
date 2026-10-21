// Sonde HTTP de la route de remise, sur le serveur Strapi en cours.
//   node scripts/cm-backend-remise-check.mjs [http://localhost:1337]
//
// On observe les CODES et les MESSAGES, sans jamais modifier l'état.
// Aucun mot de passe ni jeton n'est journalisé.
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:1337";

const LOGIN = fs.readFileSync(
  new URL("../src/components/LoginScreen.tsx", import.meta.url),
  "utf8",
);
function identifiants(email) {
  const i = LOGIN.indexOf(email);
  if (i < 0) return null;
  const apres = LOGIN.slice(i, i + 400);
  const m = apres.match(/password:\s*"([^"]+)"/);
  return m ? { identifier: email, password: m[1] } : null;
}

async function jeton(email) {
  const creds = identifiants(email);
  if (!creds) throw new Error(`compte ${email} introuvable`);
  const r = await fetch(`${BASE}/api/auth/local`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(creds),
  });
  const corps = await r.json().catch(() => ({}));
  if (!corps.jwt) throw new Error(`connexion ${email} : HTTP ${r.status}`);
  return corps.jwt;
}

async function api(method, url, jwt, corps) {
  const r = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(corps ? { "content-type": "application/json" } : {}),
      ...(jwt ? { authorization: `Bearer ${jwt}` } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await r.text();
  let out;
  try { out = JSON.parse(texte); } catch { out = { brut: texte.slice(0, 160) }; }
  return { status: r.status, corps: out };
}

const jetons = {
  magasinier: await jeton("fara.andriam@mtefop.gov.mg"),
  depositaire: await jeton("hery.rakoto@mtefop.gov.mg"),
  logistique: await jeton("tojo.razaf@mtefop.gov.mg"),
  demandeur: await jeton("tolotra.randria@mtefop.gov.mg"),
};

// Une sortie « validee » (sans la modifier).
const liste = await api("GET", "/api/sorties?pagination[pageSize]=100&filters[statut][$eq]=validee", jetons.depositaire);
const sorties = Array.isArray(liste.corps?.data) ? liste.corps.data : [];
console.log(`sorties « validee » trouvées : ${sorties.length}`);

if (!sorties.length) {
  console.log("aucune sortie eligible — sonde limitee aux cas d'erreur de role");
}

const rapport = [];

// 1) Rôle interdit : le chef logistique ne doit jamais pouvoir remettre.
if (sorties.length) {
  const cible = sorties[0];
  const r = await api("POST", `/api/sorties/${cible.documentId}/remise`, jetons.logistique, {
    detenteur_nom: "Sonde",
    detenteur_fonction: "Sonde",
    date_remise: "2026-10-20",
  });
  rapport.push({
    cas: "chef logistique sur sortie validee (attendu 403)",
    statut: r.status,
    message: r.corps?.error?.message ?? r.corps?.message ?? "",
  });
}

// 2) Sortie non « validee » : refus attendu (400).
const listeEffectuee = await api("GET", "/api/sorties?pagination[pageSize]=100&filters[statut][$eq]=sortie_effectuee", jetons.depositaire);
const effectuees = Array.isArray(listeEffectuee.corps?.data) ? listeEffectuee.corps.data : [];
if (effectuees.length) {
  const r = await api("POST", `/api/sorties/${effectuees[0].documentId}/remise`, jetons.depositaire, {
    detenteur_nom: "Sonde",
    detenteur_fonction: "Sonde",
    date_remise: "2026-10-20",
  });
  rapport.push({
    cas: "remise sur sortie deja sortie_effectuee (attendu 400/409)",
    statut: r.status,
    message: r.corps?.error?.message ?? r.corps?.message ?? "",
  });
}

// 3) Champs obligatoires manquants (attendu 400) — sur une sortie validee.
if (sorties.length) {
  const cible = sorties[0];
  const r = await api("POST", `/api/sorties/${cible.documentId}/remise`, jetons.depositaire, {
    date_remise: "2026-10-20",
  });
  rapport.push({
    cas: "champs obligatoires manquants (attendu 400)",
    statut: r.status,
    message: r.corps?.error?.message ?? r.corps?.message ?? "",
  });
}

// 4) Date « aujourd'hui » : le point de contrôle du correctif de fuseau horaire.
if (sorties.length) {
  const cible = sorties[0];
  const aujourdhui = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Indian/Antananarivo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const r = await api("POST", `/api/sorties/${cible.documentId}/remise`, jetons.depositaire, {
    detenteur_nom: "Sonde",
    detenteur_fonction: "Sonde",
    date_remise: aujourdhui,
  });
  rapport.push({
    cas: `remise datee d'aujourd'hui (${aujourdhui}) — attendu 200`,
    statut: r.status,
    message: r.corps?.error?.message ?? r.corps?.message ?? "",
  });
}

console.log(JSON.stringify(rapport, null, 1));
