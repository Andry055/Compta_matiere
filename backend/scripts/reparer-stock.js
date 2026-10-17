'use strict';

/**
 * Réparation du stock — remet `materials.quantite_stock` en cohérence avec les
 * mouvements RÉELLEMENT enregistrés en base.
 *
 *   1. Restaure les entrées 2017-2020 du seed « Reddition » supprimées de la
 *      base (ENT-2017-001 → ENT-2020-002) avec leurs lignes et leurs liens
 *      vers les fiches matériel — source de vérité : `construireEntrees()` du
 *      seed, inchangé ;
 *   2. Rattache les lignes d'entrée validées orphelines (sans fiche) : fiche
 *      trouvée par correspondance EXACTE insensible à la casse, sinon fiche
 *      créée avec la désignation de la ligne (jamais de rapprochement approché,
 *      même règle que le serveur) ;
 *   3. Recalcule TOUS les `quantite_stock` depuis les mouvements :
 *        stock = Σ lignes d'entrée (entrée validée)
 *              − Σ lignes de sortie (sortie effectuée ou stock_impacte)
 *      Les sorties « en_preparation » ne sont PAS décomptées : par règle
 *      métier le stock ne baisse qu'à la validation finale.
 *
 * Idempotent : les références déjà présentes sont ignorées, les liens déjà
 * posés ne le sont pas deux fois, le recalcul est un écrasement absolu.
 * Exécution : node scripts/reparer-stock.js  (Strapi peut rester lancé —
 * écriture SQLite courte avec busy_timeout, journal en mode delete).
 */

const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { construireEntrees, MATERIELS } = require('../src/utils/seedReddition');

const DB_PATH = path.join(__dirname, '..', '.tmp', 'data.db');
const HORODATAGE_SEED = 1790591040000; // créations du seed (entre materials et sorties)

/** documentId Strapi 5 : 24 chars [a-z0-9] (mêmes fiches que la base). */
function genererDocumentId() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const octets = crypto.randomBytes(24);
  let id = '';
  for (let i = 0; i < 24; i += 1) id += alphabet[octets[i] % alphabet.length];
  return id;
}

function maintenant() {
  return Date.now();
}

function insererEntree(db, def, reference, fournisseurId) {
  const totalLignes = def.lignes.reduce((t, l) => t + (l.montantZero ? 0 : l.montant), 0);
  const info = db
    .prepare(
      `INSERT INTO entrees (
         document_id, reference, date_entree, numero_facture, responsable, statut,
         depositaire_signed, chef_service_1_signed, chef_service_2_signed,
         signataire_depositaire, signataire_chef_service_1, signataire_chef_service_2,
         date_signature_depositaire, date_signature_chef_service_1, date_signature_chef_service_2,
         budget_general, soa, type_operation, total, numero_ordre_journal,
         piece_justificative, stock_impacte, created_at, updated_at, published_at
       ) VALUES (?, ?, ?, ?, ?, 'validee', 1, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
    )
    .run(
      genererDocumentId(),
      reference,
      def.date,
      def.facture,
      'Rakotomalala Hery',
      'Rakotomalala Hery',
      'Andriamampianina Fara',
      'Razafindrakoto Tojo',
      def.date,
      def.date,
      def.date,
      'BUDGET GENERAL',
      '00-32-0-110-00000',
      'materiel_en_service',
      totalLignes,
      `OJ-${def.annee}-${String(def.seq).padStart(3, '0')}`,
      def.facture,
      HORODATAGE_SEED,
      HORODATAGE_SEED,
      HORODATAGE_SEED
    );
  const entreeId = info.lastInsertRowid;

  if (fournisseurId != null) {
    db.prepare(
      'INSERT INTO entrees_fournisseur_lnk (id, entree_id, fournisseur_id, entree_ord) VALUES (?, ?, ?, ?)'
    ).run(null, entreeId, fournisseurId, 1);
  }
  return entreeId;
}

function insererLigneEntree(db, entreeId, materielId, numeroOrdre, designation, valeur, quantite, nomenclature, piece) {
  const info = db
    .prepare(
      `INSERT INTO entree_lignes (
         document_id, numero_ordre, designation, reference, espece, unite,
         quantite, valeur_unitaire, montant, nomenclature, piece_justificative,
         created_at, updated_at, published_at
       ) VALUES (?, ?, ?, ?, ?, 'Unité', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      genererDocumentId(),
      numeroOrdre,
      designation,
      piece,
      designation,
      quantite,
      valeur,
      valeur * quantite,
      nomenclature,
      piece,
      HORODATAGE_SEED,
      HORODATAGE_SEED,
      HORODATAGE_SEED
    );
  const ligneId = info.lastInsertRowid;

  db.prepare(
    'INSERT INTO entree_lignes_entree_lnk (id, entree_ligne_id, entree_id, entree_ligne_ord) VALUES (?, ?, ?, ?)'
  ).run(null, ligneId, entreeId, numeroOrdre);
  if (materielId != null) {
    db.prepare(
      'INSERT INTO entree_lignes_materiel_lnk (id, entree_ligne_id, material_id, entree_ligne_ord) VALUES (?, ?, ?, ?)'
    ).run(null, ligneId, materielId, numeroOrdre);
  }
  return ligneId;
}

function restaurerEntreesSeed(db) {
  const fournisseurs = db
    .prepare(
      `SELECT id, nom FROM fournisseurs
       WHERE nom IN ('SATRAMAD SARL', 'LE QUOTIDIEN HOUSE', 'TECHNOMAD EQUIPMENT')
       ORDER BY id`
    )
    .all();
  const materiauxParDesignation = new Map(
    db.prepare('SELECT id, designation FROM materials').all().map((m) => [m.designation, m.id])
  );

  let restaurees = 0;
  let lignesCreees = 0;
  let lignesSansFiche = 0;

  for (const def of construireEntrees()) {
    const reference = `ENT-${def.annee}-${String(def.seq).padStart(3, '0')}`;
    const existante = db.prepare('SELECT id FROM entrees WHERE reference = ?').get(reference);
    if (existante) continue;

    // Même répartition de fournisseurs que le seed : fournisseurs[seq % 3].
    const fournisseur = fournisseurs.length
      ? fournisseurs[def.seq % fournisseurs.length].id
      : null;
    const entreeId = insererEntree(db, def, reference, fournisseur);

    def.lignes.forEach((ligne, index) => {
      const materielDef = MATERIELS[ligne.materiel];
      const materielId = materielDef
        ? materiauxParDesignation.get(materielDef.designation) ?? null
        : null;
      if (materielId == null) lignesSansFiche += 1;
      const quantite = ligne.quantiteEntiere || Math.max(1, Math.round(ligne.quantite));
      const valeur = ligne.montantZero ? 0 : ligne.montant / quantite;
      insererLigneEntree(
        db,
        entreeId,
        materielId,
        index + 1,
        materielDef ? materielDef.designation : `Matériel #${ligne.materiel}`,
        valeur,
        quantite,
        materielDef ? materielDef.nomenclature : null,
        def.facture
      );
      lignesCreees += 1;
    });

    restaurees += 1;
  }

  return { restaurees, lignesCreees, lignesSansFiche };
}

function rattacherLignesOrphelines(db) {
  // Lignes validées sans fiche rattachée : correspondance EXACTE (insensible à
  // la casse) sinon création d'une fiche avec la désignation de la ligne.
  const orphelines = db
    .prepare(
      `SELECT el.id, el.designation, el.quantite, el.valeur_unitaire, el.nomenclature
       FROM entree_lignes el
       JOIN entree_lignes_entree_lnk elk ON elk.entree_ligne_id = el.id
       JOIN entrees e ON e.id = elk.entree_id
       LEFT JOIN entree_lignes_materiel_lnk l ON l.entree_ligne_id = el.id
       WHERE l.id IS NULL AND e.statut = 'validee'
         AND el.designation IS NOT NULL AND TRIM(el.designation) != ''`
    )
    .all();

  const selectFiche = db.prepare('SELECT id FROM materials WHERE designation = ? COLLATE NOCASE');
  const insererFiche = db.prepare(
    `INSERT INTO materials (
       document_id, designation, nomenclature, quantite_stock, valeur_unitaire, statut,
       created_at, updated_at, published_at
     ) VALUES (?, ?, ?, 0, ?, 'en_stock', ?, ?, ?)`
  );
  const insererLien = db.prepare(
    'INSERT INTO entree_lignes_materiel_lnk (id, entree_ligne_id, material_id, entree_ligne_ord) VALUES (?, ?, ?, 1)'
  );

  let rattachees = 0;
  let fichesCreees = 0;
  for (const ligne of orphelines) {
    const designation = ligne.designation.trim();
    let fiche = selectFiche.get(designation);
    if (!fiche) {
      const ts = maintenant();
      const info = insererFiche.run(
        genererDocumentId(),
        designation,
        ligne.nomenclature || null,
        ligne.valeur_unitaire != null ? ligne.valeur_unitaire : null,
        ts,
        ts,
        ts
      );
      fiche = { id: info.lastInsertRowid };
      fichesCreees += 1;
    }
    insererLien.run(null, ligne.id, fiche.id);
    rattachees += 1;
  }

  return { rattachees, fichesCreees };
}

function marquerSortiesSortiesEffectuees(db) {
  // Ces sorties sont déjà décomptées par le recalcul (statut final) : le
  // garde-fou stock_impacte passe à true pour empêcher tout double décompte.
  const info = db
    .prepare(
      `UPDATE sorties SET stock_impacte = 1
       WHERE statut = 'sortie_effectuee' AND (stock_impacte IS NULL OR stock_impacte = 0)`
    )
    .run();
  return info.changes;
}

function recalculerStocks(db) {
  const cumulEntrees = db.prepare(
    `SELECT COALESCE(SUM(el.quantite), 0) AS qte
     FROM entree_lignes el
     JOIN entree_lignes_materiel_lnk lm ON lm.entree_ligne_id = el.id
     JOIN entree_lignes_entree_lnk le ON le.entree_ligne_id = el.id
     JOIN entrees e ON e.id = le.entree_id
     WHERE lm.material_id = ? AND e.statut = 'validee'`
  );
  const cumulSorties = db.prepare(
    `SELECT COALESCE(SUM(sl.quantite), 0) AS qte
     FROM sortie_lignes sl
     JOIN sortie_lignes_materiel_lnk lm ON lm.sortie_ligne_id = sl.id
     JOIN sortie_lignes_sortie_lnk ls ON ls.sortie_ligne_id = sl.id
     JOIN sorties s ON s.id = ls.sortie_id
     WHERE lm.material_id = ?
       AND (s.statut = 'sortie_effectuee' OR s.stock_impacte = 1)`
  );
  const maj = db.prepare('UPDATE materials SET quantite_stock = ?, updated_at = ? WHERE id = ?');

  const lignes = db.prepare('SELECT id, designation, quantite_stock FROM materials ORDER BY id').all();
  const rapport = [];
  for (const materiel of lignes) {
    const entrees = cumulEntrees.get(materiel.id).qte;
    const sorties = cumulSorties.get(materiel.id).qte;
    const stock = entrees - sorties;
    if (stock !== materiel.quantite_stock) {
      maj.run(stock, maintenant(), materiel.id);
    }
    rapport.push({
      id: materiel.id,
      designation: materiel.designation,
      avant: materiel.quantite_stock,
      apres: stock,
      entrees,
      sorties,
    });
  }
  return rapport;
}

function main() {
  const db = new Database(DB_PATH);
  db.pragma('busy_timeout = 10000');

  db.exec('BEGIN IMMEDIATE');
  try {
    const seed = restaurerEntreesSeed(db);
    const orphelines = rattacherLignesOrphelines(db);
    const sortiesMajees = marquerSortiesSortiesEffectuees(db);
    const rapport = recalculerStocks(db);
    db.exec('COMMIT');

    console.log('── Restauration des entrées du seed ─────────────────────────');
    console.log(
      `   ${seed.restaurees} entrée(s) restaurée(s), ${seed.lignesCreees} ligne(s)` +
        (seed.lignesSansFiche
          ? ` (${seed.lignesSansFiche} sans fiche correspondante dans materials)`
          : '')
    );
    console.log('── Lignes validées orphelines ───────────────────────────────');
    console.log(
      `   ${orphelines.rattachees} ligne(s) rattachée(s), ${orphelines.fichesCreees} fiche(s) créée(s)`
    );
    console.log('── Garde-fou sorties ────────────────────────────────────────');
    console.log(`   ${sortiesMajees} sortie(s) marquée(s) stock_impacte`);
    console.log('── Recalcul de quantite_stock ───────────────────────────────');
    for (const r of rapport) {
      const fleche = r.avant === r.apres ? '=' : `${r.avant} →`;
      console.log(
        `   #${String(r.id).padStart(2)} ${r.designation.padEnd(36)} ${fleche} ${r.apres}` +
          `  (entrées ${r.entrees} − sorties ${r.sorties})`
      );
    }

    // Vérification finale : tout écart signifierait un bug du recalcul.
    const ecarts = rapport.filter((r) => r.apres !== r.entrees - r.sorties);
    if (ecarts.length > 0) {
      throw new Error(`Recalcul incohérent pour : ${ecarts.map((r) => r.designation).join(', ')}`);
    }
    console.log('OK — quantite_stock est égal aux mouvements enregistrés.');
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('ÉCHEC (rollback effectué) :', e.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
