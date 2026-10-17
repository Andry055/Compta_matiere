'use strict';
/** Contrôle final : la liste (quantite_stock) doit être égale aux mouvements. */
const path = require('path');
const Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));
const db = new Database(path.join(__dirname, '..', '.tmp', 'data.db'), { readonly: true });

console.log('=== Lignes validées orphelines restantes ===');
const orph = db.prepare(`
  SELECT COUNT(*) n
  FROM entree_lignes el
  JOIN entree_lignes_entree_lnk elk ON elk.entree_ligne_id = el.id
  JOIN entrees e ON e.id = elk.entree_id
  LEFT JOIN entree_lignes_materiel_lnk l ON l.entree_ligne_id = el.id
  WHERE l.id IS NULL AND e.statut = 'validee'
`).get().n;
console.log(orph === 0 ? 'AUCUNE (0) — OK' : `${orph} RESTANTES !`);

console.log('\n=== Ce que la liste affichera (stock > 0) ===');
for (const r of db.prepare(
  'SELECT designation, quantite_stock FROM materials WHERE quantite_stock > 0 ORDER BY designation'
).all()) {
  console.log(`  ${r.designation.padEnd(38)} ${r.quantite_stock}`);
}
const total = db.prepare('SELECT COUNT(*) n FROM materials').get().n;
const affiches = db.prepare('SELECT COUNT(*) n FROM materials WHERE quantite_stock > 0').get().n;
console.log(`\nFiches total: ${total} | affichées: ${affiches} | masquées (stock 0): ${total - affiches}`);

const entreesSeed = db.prepare(`
  SELECT COUNT(*) n FROM entrees
  WHERE reference GLOB 'ENT-201[7-9]*' OR reference GLOB 'ENT-2020*'
`).get().n;
console.log(`Entrées 2017-2020 restaurées: ${entreesSeed} (attendu: 34)`);

// Écart stock vs mouvements, pour CHAQUE fiche.
const lignes = db.prepare(`
  SELECT m.id, m.designation, m.quantite_stock,
    (SELECT COALESCE(SUM(el.quantite),0) FROM entree_lignes el
       JOIN entree_lignes_materiel_lnk lm ON lm.entree_ligne_id = el.id
       JOIN entree_lignes_entree_lnk le ON le.entree_ligne_id = el.id
       JOIN entrees e ON e.id = le.entree_id
      WHERE lm.material_id = m.id AND e.statut = 'validee') AS entrees,
    (SELECT COALESCE(SUM(sl.quantite),0) FROM sortie_lignes sl
       JOIN sortie_lignes_materiel_lnk lm ON lm.sortie_ligne_id = sl.id
       JOIN sortie_lignes_sortie_lnk ls ON ls.sortie_ligne_id = sl.id
       JOIN sorties s ON s.id = ls.sortie_id
      WHERE lm.material_id = m.id
        AND (s.statut = 'sortie_effectuee' OR s.stock_impacte = 1)) AS sorties
  FROM materials m ORDER BY m.id
`).all();
const ecarts = lignes.filter((l) => l.quantite_stock !== l.entrees - l.sorties);
if (ecarts.length === 0) {
  console.log('\nÉCARTS: 0 — quantite_stock = entrées validées − sorties effectuées, pour les ' + lignes.length + ' fiches.');
} else {
  console.log(`\nÉCARTS: ${ecarts.length} !`);
  for (const e of ecarts) {
    console.log(`  #${e.id} ${e.designation}: stock=${e.quantite_stock}, mouvements=${e.entrees - e.sorties}`);
  }
  process.exitCode = 1;
}

// Sorties en préparation : ne doivent PAS impacter le stock.
const pending = db.prepare(`
  SELECT COALESCE(SUM(sl.quantite),0) q
  FROM sortie_lignes sl
  JOIN sortie_lignes_sortie_lnk ls ON ls.sortie_ligne_id = sl.id
  JOIN sorties s ON s.id = ls.sortie_id
  WHERE s.statut = 'en_preparation'
`).get().q;
console.log(`Sorties en préparation (non décomptées, règle métier): ${pending} unité(s) réservées`);

db.close();
