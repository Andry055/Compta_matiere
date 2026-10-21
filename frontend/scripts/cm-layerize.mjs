// Replie les règles `.cm-*` de console.css dans la couche « components »
// (convention Tailwind v4) : les utilitaires Tailwind, déclarés dans la
// couche « utilities », reprennent la priorité — condition pour que
// `hidden`, `lg:flex`, `absolute`… fonctionnent sur un élément portant
// aussi une classe `.cm-*`.
//
// Les `@keyframes` restent hors couche (portée globale).
import fs from "node:fs";

const FILE = "D:/projet/Compta-main/frontend/src/styles/console.css";
const src = fs.readFileSync(FILE, "utf8");
const lines = src.split("\n");

const idxOf = (pred, from = 0) => {
  const i = lines.findIndex(pred, from);
  if (i < 0) throw new Error("introuvable");
  return i;
};

// 1. Extraire les @keyframes (ils doivent rester hors couche).
const kStart = idxOf((l) => l.startsWith("@keyframes cm-ping {"));
const kEnd = idxOf((l) => l.startsWith("/* Entrée en scène"), kStart);
const keyframes = lines.slice(kStart, kEnd);
while (keyframes.length && keyframes[keyframes.length - 1].trim() === "") keyframes.pop();

// 2. Repérer le début de la section « 2. BASE ».
const sec2 = idxOf((l) => l.includes("2. BASE — Typographie"));
// remonter au début du bloc de commentaire qui précède.
let sec2Start = sec2;
while (sec2Start > 0 && lines[sec2Start - 1].startsWith("/* ====")) sec2Start--;
if (sec2Start > 0 && lines[sec2Start - 1].startsWith("   2. BASE")) sec2Start--;
while (sec2Start > 0 && lines[sec2Start - 1].trim() === "") sec2Start--;

// 3. Reconstruire.
const out = [
  ...lines.slice(0, sec2Start),
  "",
  "/* ==========================================================================",
  "   ANIMATIONS — Images clés globales (hors couche : portée universelle)",
  "   ========================================================================== */",
  "",
  ...keyframes,
  "",
  "/* ==========================================================================",
  "   CLASSES `.cm-*` — SYSTÈME VISUEL",
  "   ------------------------------------------------------------------------",
  "   Ces règles sont empilées dans la couche « components » : les utilitaires",
  "   Tailwind (couche « utilities », déclarée après) gardent la priorité. Sans",
  "   cela, `hidden`, `lg:flex` ou `absolute` seraient ignorés sur un élément",
  "   portant aussi une classe `.cm-*`.",
  "   ========================================================================== */",
  "",
  "@layer components {",
  ...lines.slice(sec2Start, kStart),
  ...lines.slice(kEnd),
  "}",
  "",
].join("\n");

fs.writeFileSync(FILE, out, "utf8");
console.log(`console.css restructuré : ${out.split("\n").length} lignes`);
