'use strict';

/**
 * Tests des calculs de reddition de compte (module pur, sans Strapi).
 *
 * Jeu de test de référence (critères d'acceptation) :
 *   Ouverture 2017 : 03 = 482 402 372,6 ; 05 = 1 155 101 261 ; 10 = 199 000
 *   Entrées 2017   : 03 = 22 990 000 ; 05 = 116 500 000 ; 10 = 0
 *   → Total 03 = 505 392 372,6 ; 05 = 1 271 601 261 ; 10 = 199 000
 *   → TOTAUX : existant 1 637 702 633,6 ; entrées 139 490 000 ;
 *     reste au 31/12 = 1 777 192 633,6 (le reste 2017 devient l'existant 2018)
 *   → 2020 : reste attendu 4 972 237 713,596
 *   → Bordereau 2017-2020 : 6 + 22 + 4 + 2 ordres d'entrée (et autant de
 *     factures).
 *
 * Les entrées/sorties 2018-2020 du jeu de test sont déduites pour atteindre
 * ces montants (report automatique + mouvements).
 */

const test = require('node:test');
const assert = require('node:assert');
const calculs = require('../src/api/rapport/services/redition-calculs');

/* ────────────────────── Fabriques de lignes de test ────────────────────── */

let seq = 0;
function ligneEntree({ date, nomenclature, montant, reference, facture, materiel }) {
  seq += 1;
  return {
    id: seq,
    sens: 'entree',
    date,
    statut: 'validee',
    quantite: 1,
    montant,
    valeur_unitaire: montant,
    nomenclature,
    materielId: materiel || null,
    materiel: materiel ? { documentId: materiel } : null,
    entree: { date_entree: date, reference, statut: 'validee', numero_facture: facture || reference },
    reference,
  };
}

function ligneSortie({ date, nomenclature, montant, reference, materiel }) {
  seq += 1;
  return {
    id: seq,
    sens: 'sortie',
    date,
    statut: 'sortie_effectuee',
    quantite: 1,
    montant,
    valeur_unitaire: montant,
    nomenclature,
    materielId: materiel || null,
    materiel: materiel ? { documentId: materiel } : null,
    sortie: { date_sortie: date, reference, statut: 'sortie_effectuee' },
    reference,
  };
}

/* ─────────────────────── Jeu de données de référence ─────────────────────── */

const OUVERTURES_2017 = [
  { annee: 2017, nomenclature: '03', montant_existant: 482402372.6 },
  { annee: 2017, nomenclature: '05', montant_existant: 1155101261 },
  { annee: 2017, nomenclature: '10', montant_existant: 199000 },
];

function entrees2017() {
  // 6 ordres d'entrée en 2017 (comme le bordereau attendu)
  return [
    ligneEntree({ date: '2017-03-10', nomenclature: '03', montant: 10000000, reference: 'ENT-2017-001', facture: 'FAC-2017-001' }),
    ligneEntree({ date: '2017-05-02', nomenclature: '03', montant: 12990000, reference: 'ENT-2017-002', facture: 'FAC-2017-002' }),
    ligneEntree({ date: '2017-06-15', nomenclature: '05', montant: 50000000, reference: 'ENT-2017-003', facture: 'FAC-2017-003' }),
    ligneEntree({ date: '2017-08-01', nomenclature: '05', montant: 66500000, reference: 'ENT-2017-004', facture: 'FAC-2017-004' }),
    ligneEntree({ date: '2017-09-20', nomenclature: '03', materiel: 'M-03-A', montant: 0, reference: 'ENT-2017-005', facture: 'FAC-2017-005' }),
    ligneEntree({ date: '2017-11-30', nomenclature: '10', montant: 0, reference: 'ENT-2017-006', facture: 'FAC-2017-006' }),
  ];
}

function entrees2018a2020() {
  // Entrées 2018..2020 calibrées pour atteindre le reste 2020 attendu :
  // existant 2018 (1 777 192 633,6) + entrées 2018-2020 (3 195 045 079,996)
  // = 4 972 237 713,596 (sorties nulles en valeur dans le jeu de test).
  const out = [];
  function pousser(annee, i, montant) {
    out.push(
      ligneEntree({
        date: `${annee}-06-15`,
        nomenclature: '05',
        montant,
        reference: `ENT-${annee}-${String(i).padStart(3, '0')}`,
        facture: `FAC-${annee}-${String(i).padStart(3, '0')}`,
      })
    );
  }
  // 2018 : 22 ordres — total 1 210 000 000
  for (let i = 1; i <= 21; i++) pousser(2018, i, 10000000);
  pousser(2018, 22, 1000000000);
  // 2019 : 4 ordres — total 975 045 079,996
  for (let i = 1; i <= 3; i++) pousser(2019, i, 10000000);
  pousser(2019, 4, 945045079.996);
  // 2020 : 2 ordres — total 1 010 000 000
  pousser(2020, 1, 10000000);
  pousser(2020, 2, 1000000000);
  return out;
}

function sorties2017a2020() {
  // Sorties d'appoint (ne changent pas les résultats attendus du jeu :
  // les totaux officiels ne sont fournis que pour 2017 ; on garde des
  // sorties faibles et déterministes).
  return [
    ligneSortie({ date: '2017-07-05', nomenclature: '05', montant: 0, reference: 'SORT-2017-001' }),
    ligneSortie({ date: '2019-10-01', nomenclature: '03', montant: 0, reference: 'SORT-2019-001' }),
  ];
}

/* ──────────────────────────────── Tests ──────────────────────────────── */

test('anneeDe extrait l’année d’une date ISO', () => {
  assert.strictEqual(calculs.anneeDe('2017-06-05'), 2017);
  assert.strictEqual(calculs.anneeDe(null), null);
  assert.strictEqual(calculs.anneeDe('n/a'), null);
});

test('lignesDeLAnnee filtre par année et statut final', () => {
  const entrees = entrees2017();
  const rejete = ligneEntree({ date: '2017-04-01', nomenclature: '03', montant: 999, reference: 'ENT-REJET' });
  rejete.statut = 'rejetee';

  const lignes = calculs.lignesDeLAnnee([...entrees, rejete], 2017, 'entree');
  assert.strictEqual(lignes.length, 6);
  // 2018 : aucune
  assert.strictEqual(calculs.lignesDeLAnnee(entrees, 2018, 'entree').length, 0);
});

test('Récapitulation 2017 — jeu de test officiel', () => {
  const recap = calculs.calculerRecapitulation({
    annee: 2017,
    entrees: entrees2017(),
    sorties: sorties2017a2020(),
    ouvertures: OUVERTURES_2017,
  });

  const parNom = Object.fromEntries(recap.lignes.map((l) => [l.nomenclature, l]));

  // Totaux par nomenclature
  assert.strictEqual(parNom['03'].existant, 482402372.6);
  assert.strictEqual(parNom['03'].entrees, 22990000);
  assert.strictEqual(parNom['03'].total, 505392372.6);

  assert.strictEqual(parNom['05'].existant, 1155101261);
  assert.strictEqual(parNom['05'].entrees, 116500000);
  assert.strictEqual(parNom['05'].total, 1271601261);

  assert.strictEqual(parNom['10'].existant, 199000);
  assert.strictEqual(parNom['10'].entrees, 0);
  assert.strictEqual(parNom['10'].total, 199000);

  // Ligne TOTAUX (sorties 2017 nulles dans le jeu)
  assert.ok(Math.abs(recap.totaux.existant - 1637702633.6) < 1e-6);
  assert.strictEqual(recap.totaux.entrees, 139490000);
  assert.ok(Math.abs(recap.totaux.total - 1777192633.6) < 1e-6);
  assert.strictEqual(recap.totaux.sorties, 0);
  assert.ok(Math.abs(recap.totaux.reste - 1777192633.6) < 1e-6);
});

test('Le reste 2017 devient l’existant 2018 (report automatique)', () => {
  const recaps = calculs.calculerRecapitulationsChainees({
    anneeDebut: 2017,
    anneeFin: 2018,
    entrees: [...entrees2017(), ...entrees2018a2020()],
    sorties: sorties2017a2020(),
    ouvertures: OUVERTURES_2017,
  });

  const r2017 = recaps[0];
  const r2018 = recaps[1];

  // Aucune ouverture explicite en 2018 : le report s'applique
  const p2018 = Object.fromEntries(r2018.lignes.map((l) => [l.nomenclature, l]));
  assert.ok(Math.abs(p2018['03'].existant - r2017.lignes.find((l) => l.nomenclature === '03').reste) < 1e-6);
  assert.ok(Math.abs(p2018['05'].existant - r2017.lignes.find((l) => l.nomenclature === '05').reste) < 1e-6);
});

test('Reste 2020 attendu : 4 972 237 713,596', () => {
  const recaps = calculs.calculerRecapitulationsChainees({
    anneeDebut: 2017,
    anneeFin: 2020,
    entrees: [...entrees2017(), ...entrees2018a2020()],
    sorties: sorties2017a2020(),
    ouvertures: OUVERTURES_2017,
  });

  const r2020 = recaps[recaps.length - 1];
  assert.strictEqual(r2020.annee, 2020);
  assert.ok(
    Math.abs(r2020.totaux.reste - 4972237713.596) < 1e-3,
    `reste 2020 = ${r2020.totaux.reste}`
  );
});

test('État appréciatif 2017 : 6 pièces, totaux par mouvement', () => {
  const etat = calculs.calculerEtatAppreciatif({
    annee: 2017,
    entrees: entrees2017(),
    sorties: sorties2017a2020(),
  });

  assert.strictEqual(etat.nombrePieces, 6);
  assert.strictEqual(etat.mouvementsEntree.length, 6);
  assert.strictEqual(etat.totalEntrees, 139490000);
  assert.strictEqual(etat.totalSorties, 0);
});

test('Bordereau 2017-2020 : 6 + 22 + 4 + 2 ordres (et autant de factures)', () => {
  const bordereau = calculs.calculerBordereau({
    annees: [2017, 2018, 2019, 2020],
    entrees: [...entrees2017(), ...entrees2018a2020()],
  });

  assert.deepStrictEqual(
    bordereau.parAnnee.map((a) => a.ordresEntree),
    [6, 22, 4, 2]
  );
  assert.strictEqual(bordereau.totalOrdres, 34);
  assert.strictEqual(bordereau.totalFactures, 34);
});

test('Grand-livre : cumul chronologique', () => {
  const entrees = [
    ligneEntree({ date: '2017-01-10', nomenclature: '03', montant: 1000, reference: 'E1', materiel: 'M1' }),
    ligneEntree({ date: '2017-03-01', nomenclature: '03', montant: 1000, reference: 'E2', materiel: 'M1' }),
  ];
  const sorties = [
    ligneSortie({ date: '2017-02-01', nomenclature: '03', montant: 500, reference: 'S1', materiel: 'M1' }),
  ];

  const gl = calculs.calculerGrandLivre({ materielId: 'M1', entrees, sorties });
  assert.strictEqual(gl.mouvements.length, 3);
  assert.strictEqual(gl.mouvements[0].quantiteCumulee, 1);
  assert.strictEqual(gl.mouvements[1].quantiteCumulee, 0);
  assert.strictEqual(gl.mouvements[2].quantiteCumulee, 1);
  assert.strictEqual(gl.quantiteFinale, 1);
});

test('Inventaire : sections par nomenclature avec totaux', () => {
  const entrees = [
    ligneEntree({ date: '2017-02-01', nomenclature: '03', montant: 30000, reference: 'E1', materiel: 'MA', facture: 'F1' }),
    ligneEntree({ date: '2017-03-01', nomenclature: '05', montant: 20000, reference: 'E2', materiel: 'MB', facture: 'F2' }),
  ];
  const inventaire = calculs.calculerInventaire({
    annee: 2017,
    entrees,
    sorties: [],
    materiaux: [
      { documentId: 'MA', designation: 'Matériel A', nomenclature: '03', valeur_unitaire: 30000, unite: 'Unité' },
      { documentId: 'MB', designation: 'Matériel B', nomenclature: '05', valeur_unitaire: 20000, unite: 'Unité' },
    ],
    ouvertures: OUVERTURES_2017,
  });

  assert.strictEqual(inventaire.sections.length, 2);
  const s03 = inventaire.sections.find((s) => s.nomenclature === '03');
  assert.strictEqual(s03.articles.length, 1);
  assert.strictEqual(s03.totaux.valeurs.entrees, 30000);
  assert.strictEqual(s03.totaux.quantites.entrees, 1);
  assert.strictEqual(s03.totaux.quantites.reste, 1);
});

test('Aucune donnée : recapitulation vide (zéro partout, pas d’erreur)', () => {
  const recap = calculs.calculerRecapitulation({
    annee: 2030,
    entrees: [],
    sorties: [],
    ouvertures: [],
  });
  assert.deepStrictEqual(recap.lignes, []);
  assert.deepStrictEqual(recap.totaux, { existant: 0, entrees: 0, total: 0, sorties: 0, reste: 0 });
});
