// Test HTTP de bout en bout du backend Strapi en cours d'exécution.
//   node scripts/cm-backend-check.mjs [http://localhost:1337]
// Aucun mot de passe ni jeton n'est affiché : seuls les statuts HTTP et
// des extraits de structure (clés) sont journalisés.
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:1337";

// Les identifiants de démonstration sont écrits en clair dans l'écran de
// connexion du frontend (mode hors ligne). On les lit depuis la source pour
// ne rien recopier ici, et on ne journalise jamais le mot de passe ni le jeton.
const LOGIN = fs.readFileSync(
  new URL("../src/components/LoginScreen.tsx", import.meta.url),
  "utf8",
);
const motDePasseDe = (email) => {
  const i = LOGIN.indexOf(email);
  if (i < 0) return null;
  const apres = LOGIN.slice(i, i + 400);
  const m = apres.match(/password:\s*"([^"]+)"/);
  return m ? m[1] : null;
};

const COMPTES = [
  { cle: "magasinier", email: "fara.andriam@mtefop.gov.mg" },
  { cle: "depositaire", email: "hery.rakoto@mtefop.gov.mg" },
  { cle: "logistique", email: "tojo.razaf@mtefop.gov.mg" },
  { cle: "admin", email: "m.rakoto@ministere.gov.mg" },
];

async function jeton(email) {
  const password = motDePasseDe(email);
  if (!password) return null;
  const r = await fetch(`${BASE}/api/auth/local`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: email, password }),
  });
  if (r.status !== 200) return { statut: r.status };
  const corps = await r.json();
  return { statut: 200, jwt: corps.jwt, user: corps.user };
}

const resultats = [];

for (const c of COMPTES) {
  const j = await jeton(c.email);
  if (!j || j.statut !== 200) {
    resultats.push({ ...c, connexion: j?.statut ?? "identifiant introuvable" });
    continue;
  }
  const r = await fetch(`${BASE}/api/sorties?pagination[pageSize]=3`, {
    headers: { authorization: `Bearer ${j.jwt}` },
  });
  const corps = await r.json().catch(() => ({}));
  const items = Array.isArray(corps.data) ? corps.data.length : 0;
  const statuts = Array.isArray(corps.data)
    ? corps.data.map((s) => s?.statut ?? "?").join(",")
    : "";
  resultats.push({
    cle: c.cle,
    connexion: 200,
    role: j.user?.role?.type ?? "?",
    lectures: r.status,
    items,
    statuts,
  });
}

console.log(JSON.stringify(resultats, null, 1));
