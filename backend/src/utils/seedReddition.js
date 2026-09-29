'use strict';

/**
 * Seed « Reddition de compte » — jeu de données de démonstration/référence
 * conforme aux critères d'acceptation :
 *
 *   Ouverture 2017 : 03 = 482 402 372,6 ; 05 = 1 155 101 261 ; 10 = 199 000
 *   Entrées 2017   : 03 = 22 990 000 ; 05 = 116 500 000 ; 10 = 0
 *   → TOTAUX 2017 : existant 1 637 702 633,6 ; entrées 139 490 000 ;
 *     reste 1 777 192 633,6 — le reste devient l'existant 2018.
 *   → 2020 : reste attendu 4 972 237 713,596.
 *   → Bordereau 2017-2020 : 6 + 22 + 4 + 2 ordres d'entrée = mêmes factures.
 *
 * Idempotent : ne s'exécute que si les ouvertures n'existent pas encore.
 * Aucun impact sur les flux existants (n'ajoute que des données de test).
 */

const OUVERTURE_UID = 'api::ouverture-exercice.ouverture-exercice';
const FOURNISSEUR_UID = 'api::fournisseur.fournisseur';
const MATERIEL_UID = 'api::material.material';
const ENTREE_UID = 'api::entree.entree';
const ENTREE_LIGNE_UID = 'api::entree-ligne.entree-ligne';
const SORTIE_UID = 'api::sortie.sortie';
const SORTIE_LIGNE_UID = 'api::sortie-ligne.sortie-ligne';

/* ─────────────────────── Référentiel ─────────────────────── */

const OUVERTURES_2017 = [
  { annee: 2017, nomenclature: '03', montant_existant: 482402372.6 },
  { annee: 2017, nomenclature: '05', montant_existant: 1155101261 },
  { annee: 2017, nomenclature: '10', montant_existant: 199000 },
];

const MATERIELS = [
  { designation: 'Vidéoprojecteur Epson EB-X500', nomenclature: '03', valeur_unitaire: 4500000, unite: 'Unité' },
  { designation: 'Ordinateur portable Dell Latitude', nomenclature: '03', valeur_unitaire: 3200000, unite: 'Unité' },
  { designation: 'Imprimante laser HP LaserJet', nomenclature: '03', valeur_unitaire: 1850000, unite: 'Unité' },
  { designation: 'Onduleur APC 1500VA', nomenclature: '03', valeur_unitaire: 1250000, unite: 'Unité' },
  { designation: 'Routeur Cisco RV340', nomenclature: '05', valeur_unitaire: 2800000, unite: 'Unité' },
  { designation: 'Switch manageable 48 ports', nomenclature: '05', valeur_unitaire: 5200000, unite: 'Unité' },
  { designation: 'Câble réseau Cat6 (rouleau 305m)', nomenclature: '05', valeur_unitaire: 850000, unite: 'Rouleau' },
  { designation: 'Borne WiFi Ubiquiti UniFi', nomenclature: '05', valeur_unitaire: 1600000, unite: 'Unité' },
  { designation: 'Registre comptable grand format', nomenclature: '10', valeur_unitaire: 45000, unite: 'Volume' },
  { designation: 'Registre inventaire cartonné', nomenclature: '10', valeur_unitaire: 38000, unite: 'Volume' },
];

const FOURNISSEURS = [
  { nom: 'SATRAMAD SARL', contact: '+261 34 12 345 67', email: 'contact@satramad.mg' },
  { nom: 'LE QUOTIDIEN HOUSE', contact: '+261 32 07 890 12', email: 'ventes@quotidienhouse.mg' },
  { nom: 'TECHNOMAD EQUIPMENT', contact: '+261 33 22 456 78', email: 'info@technomad.mg' },
];

/* ─────────────── Fabriques d'ordres d'entrée ─────────────── */

function montantsParAnnee() {
  // Calibrage pour atteindre le reste 2020 = 4 972 237 713,596 :
  //   existant 2018 (1 777 192 633,6) + entrées 2018-2020 (3 195 045 079,996)
  // avec sorties en valeur nulles sur nomenclature 05 (sorties qté pures
  // 03/10 couvertes par l'ouverture — cf. ventilations ci-dessous).
  return {
    2018: { total: 1210000000, nb: 22 },
    2019: { total: 975045079.996, nb: 4 },
    2020: { total: 1010000000, nb: 2 },
  };
}

function construireEntrees() {
  const entrees = [];

  // ── 2017 : 6 ordres (03 = 22 990 000 ; 05 = 116 500 000 ; 10 = 0) ──
  entrees.push(
    { annee: 2017, seq: 1, date: '2017-03-10', facture: 'FAC-2017-001', lignes: [
      { materiel: 0, quantite: 2, montant: 9000000, nomenclature: '03' },
      { materiel: 2, quantite: 2, montant: 3700000, nomenclature: '03' },
    ] },
    { annee: 2017, seq: 2, date: '2017-05-02', facture: 'FAC-2017-002', lignes: [
      { materiel: 1, quantite: 3, montant: 3790000, nomenclature: '03' },
      { materiel: 3, quantite: 3, montant: 3750000, nomenclature: '03' },
    ] },
    { annee: 2017, seq: 3, date: '2017-06-15', facture: 'FAC-2017-003', lignes: [
      { materiel: 4, quantite: 8, montant: 22400000, nomenclature: '05' },
      { materiel: 5, quantite: 8, montant: 41600000, nomenclature: '05' },
    ] },
    { annee: 2017, seq: 4, date: '2017-08-01', facture: 'FAC-2017-004', lignes: [
      { materiel: 6, quantite: 25, montant: 21250000, nomenclature: '05' },
      { materiel: 7, quantite: 30, montant: 31250000, nomenclature: '05' },
    ] },
    { annee: 2017, seq: 5, date: '2017-09-20', facture: 'FAC-2017-005', lignes: [
      { materiel: 2, quantite: 1, montant: 1850000, nomenclature: '03' },
      { materiel: 3, quantite: 1, montant: 900000, nomenclature: '03' },
      { materiel: 1, quantite: 1, montant: 0, montantZero: true, nomenclature: '03' },
    ] },
  // (note) 05 : 22 400 000 + 41 600 000 + 21 250 000 + 30 850 000 = 116 500 000
    { annee: 2017, seq: 6, date: '2017-11-30', facture: 'FAC-2017-006', lignes: [
      { materiel: 8, quantite: 2, montant: 0, montantZero: true, nomenclature: '10' },
      { materiel: 9, quantite: 2, montant: 0, montantZero: true, nomenclature: '10' },
    ] }
  );

  // ── 2018 : 22 ordres — total 1 210 000 000 (21 × 10 M + 1 × 1 000 M) ──
  const cal2018 = montantsParAnnee()['2018'];
  for (let i = 1; i <= 21; i++) {
    entrees.push({
      annee: 2018, seq: i, date: `2018-0${((i % 9) + 1)}-15`, facture: `FAC-2018-${String(i).padStart(3, '0')}`,
      lignes: [{ materiel: 4 + (i % 4), quantite: 2, montant: 10000000, nomenclature: '05' }],
    });
  }
  entrees.push({
    annee: 2018, seq: 22, date: '2018-12-10', facture: 'FAC-2018-022',
    lignes: [
      { materiel: 4, quantite: 100, montant: cal2018.total - 21 * 10000000, nomenclature: '05' },
    ],
  });

  // ── 2019 : 4 ordres — total 975 045 079,996 ──
  entrees.push(
    { annee: 2019, seq: 1, date: '2019-02-20', facture: 'FAC-2019-001', lignes: [{ materiel: 5, quantite: 1, montant: 10000000, nomenclature: '05' }] },
    { annee: 2019, seq: 2, date: '2019-05-14', facture: 'FAC-2019-002', lignes: [{ materiel: 6, quantite: 3, montant: 10000000, nomenclature: '05' }] },
    { annee: 2019, seq: 3, date: '2019-08-30', facture: 'FAC-2019-003', lignes: [{ materiel: 7, quantite: 2, montant: 10000000, nomenclature: '05' }] },
    { annee: 2019, seq: 4, date: '2019-11-05', facture: 'FAC-2019-004', lignes: [{ materiel: 4, quantite: 50, montant: 945045079.996, nomenclature: '05' }] }
  );

  // ── 2020 : 2 ordres — total 1 010 000 000 ──
  entrees.push(
    { annee: 2020, seq: 1, date: '2020-03-12', facture: 'FAC-2020-001', lignes: [{ materiel: 5, quantite: 2, montant: 10000000, nomenclature: '05' }] },
    { annee: 2020, seq: 2, date: '2020-09-25', facture: 'FAC-2020-002', lignes: [{ materiel: 4, quantite: 150, montant: 1000000000, nomenclature: '05' }] }
  );

  return entrees;
}

/* ─────────────── Sorties (matérialisent les flux) ─────────────── */

function construireSorties() {
  return [
    { annee: 2017, seq: 1, date: '2017-07-05', lignes: [{ materiel: 1, quantite: 1, montant: 0 }] },
    { annee: 2019, seq: 1, date: '2019-10-01', lignes: [{ materiel: 0, quantite: 1, montant: 0 }] },
    { annee: 2020, seq: 1, date: '2020-06-18', lignes: [{ materiel: 2, quantite: 1, montant: 0 }] },
  ];
}

/* ─────────────────────────── Seed ─────────────────────────── */

async function seedReddition(strapi) {
  // Idempotence : on ne sème qu'une fois (présence d'une ouverture 2017)
  const existante = await strapi.db.query(OUVERTURE_UID).findOne({ where: { annee: 2017 } });
  if (existante) {
    strapi.log.info('[seed-reddition] Ouvertures déjà présentes : seed ignoré.');
    return;
  }

  strapi.log.info('[seed-reddition] Insertion du jeu de données de reddition 2017-2020...');

  // 1) Ouvertures 2017
  for (const o of OUVERTURES_2017) {
    await strapi.db.query(OUVERTURE_UID).create({ data: o });
  }

  // 2) Fournisseurs
  const fournisseurs = [];
  for (const f of FOURNISSEURS) {
    const existant = await strapi.db.query(FOURNISSEUR_UID).findOne({ where: { nom: f.nom } });
    fournisseurs.push(existant || (await strapi.db.query(FOURNISSEUR_UID).create({ data: f })));
  }

  // 3) Matériels (réutilise ceux qui existent par désignation)
  const materiels = [];
  for (const m of MATERIELS) {
    let materiel = await strapi.db.query(MATERIEL_UID).findOne({ where: { designation: m.designation } });
    if (!materiel) {
      materiel = await strapi.db.query(MATERIEL_UID).create({
        data: {
          designation: m.designation,
          nomenclature: m.nomenclature,
          valeur_unitaire: m.valeur_unitaire,
          quantite_stock: 0,
          statut: 'en_stock',
        },
      });
    }
    materiels.push(materiel);
  }

  // 4) Entrées validées + lignes
  const definitions = construireEntrees();
  for (const def of definitions) {
    const reference = `ENT-${def.annee}-${String(def.seq).padStart(3, '0')}`;
    const existe = await strapi.db.query(ENTREE_UID).findOne({ where: { reference } });
    if (existe) continue;

    const totalLignes = def.lignes.reduce((t, l) => t + (l.montantZero ? 0 : l.montant), 0);
    const fournisseur = fournisseurs[def.seq % fournisseurs.length];

    await strapi.db.query(ENTREE_UID).create({
      data: {
        reference,
        date_entree: def.date,
        statut: 'validee',
        numero_facture: def.facture,
        date_facture: def.date,
        piece_justificative: def.facture,
        fournisseur: fournisseurs.indexOf(fournisseur) >= 0 ? fournisseur.id : null,
        responsable: 'Rakotomalala Hery',
        depositaire_signed: true,
        chef_service_1_signed: true,
        chef_service_2_signed: true,
        signataire_depositaire: 'Rakotomalala Hery',
        signataire_chef_service_1: 'Andriamampianina Fara',
        signataire_chef_service_2: 'Razafindrakoto Tojo',
        date_signature_depositaire: def.date,
        date_signature_chef_service_1: def.date,
        date_signature_chef_service_2: def.date,
        budget_general: 'BUDGET GENERAL',
        soa: '00-32-0-110-00000',
        type_operation: 'materiel_en_service',
        total: totalLignes,
        numero_ordre_journal: `OJ-${def.annee}-${String(def.seq).padStart(3, '0')}`,
      },
    });

    const entreeCreee = await strapi.db.query(ENTREE_UID).findOne({ where: { reference } });
    for (const l of def.lignes) {
      const materiel = materiels[l.materiel];
      await strapi.db.query(ENTREE_LIGNE_UID).create({
        data: {
          entree: entreeCreee.id,
          materiel: materiel.id,
          designation: materiel.designation,
          reference: def.facture,
          espece: materiel.designation,
          unite: 'Unité',
          quantite: l.quantiteEntiere || Math.max(1, Math.round(l.quantite)),
          valeur_unitaire: l.montantZero ? 0 : l.montant / Math.max(1, Math.round(l.quantite)),
          montant: l.montantZero ? 0 : l.montant,
          nomenclature: l.nomenclature,
          piece_justificative: def.facture,
        },
      });
      // Impact stock (matérialise le flux)
      await strapi.db.query(MATERIEL_UID).update({
        where: { id: materiel.id },
        data: { quantite_stock: (materiel.quantite_stock || 0) + Math.max(1, Math.round(l.quantite)) },
      });
    }
  }

  // 5) Sorties effectuées + lignes
  const sorties = construireSorties();
  for (const s of sorties) {
    const reference = `SORT-${s.annee}-${String(s.seq).padStart(3, '0')}`;
    const existe = await strapi.db.query(SORTIE_UID).findOne({ where: { reference } });
    if (existe) continue;

    await strapi.db.query(SORTIE_UID).create({
      data: {
        reference,
        date_sortie: s.date,
        statut: 'sortie_effectuee',
        beneficiaire: 'Direction Informatique',
        responsable: 'Rakotomalala Hery',
        justificatif: 'Affectation de service',
      },
    });
    const sortieCreee = await strapi.db.query(SORTIE_UID).findOne({ where: { reference } });
    for (const l of s.lignes) {
      const materiel = materiels[l.materiel];
      await strapi.db.query(SORTIE_LIGNE_UID).create({
        data: {
          sortie: sortieCreee.id,
          materiel: materiel.id,
          quantite: l.quantite,
          valeur_unitaire: 0,
        },
      });
    }
  }

  strapi.log.info(
    '[seed-reddition] Terminé : 3 ouvertures, ' +
      `${definitions.length} ordres d'entrée (2017-2020), 3 sorties.`
  );
}

module.exports = { seedReddition, construireEntrees, construireSorties, OUVERTURES_2017, MATERIELS };
