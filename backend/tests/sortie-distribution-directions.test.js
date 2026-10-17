'use strict';

/**
 * Test du flux de distribution vers les directions avec de vraies données.
 * Ce test vérifie qu'une sortie peut être associée à une direction spécifique
 * et que le flux de sortie complet fonctionne correctement avec cette association.
 *
 * Flux testé :
 * 1. Création d'une sortie associée à une direction spécifique
 * 2. Signature magasinier (étape 1)
 * 3. Signature dépositaire (étape 2)
 * 4. Signature logistique avec validation et baisse atomique du stock (étape 3)
 * 5. Remise au détenteur (étape 4)
 *
 * Vérifications :
 * - La sortie est correctement associée à la direction tout au long du flux
 * - Le stock est correctement débité après la validation logistique
 * - La remise au détenteur fonctionne correctement
 * - Toutes les étapes du flux réussissent comme attendu
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const CONTROLEUR = path.join(RACINE, 'src', 'api', 'sortie', 'controllers', 'sortie.js');
const INDEX = path.join(RACINE, 'src', 'index.js');

const lire = (f) => fs.readFileSync(f, 'utf8');

/* ────────────────────────── Objet `strapi` simulé ────────────────────────── */

const CONTENEURS = {
  'api::sortie.sortie': [],
  'api::sortie-ligne.sortie-ligne': [],
  'api::material.material': [],
  'api::mouvement.mouvement': [],
  'api::direction.direction': [],
  'api::service.service': [],
  'api::employee.employee': [],
  'api::demande.demande': [],
};

let compteur = 0;
let journalAvertissements = [];

/** Utilisateurs de simulation : id → rôle (codé `type`, lu par getRoleCode). */
const UTILISATEURS = [
  { id: 21, roleType: 'magasinier', username: 'Andriamampianina Fara', email: 'fara.andriam@mtefop.gov.mg', documentId: 'u-maga' },
  { id: 22, roleType: 'depositaire', username: 'Rakotomalala Hery', email: 'hery.rakoto@mtefop.gov.mg', documentId: 'u-depo' },
  { id: 23, roleType: 'logistique', username: 'Razafindrakoto Tojo', email: 'tojo.razaf@mtefop.gov.mg', documentId: 'u-log' },
  { id: 24, roleType: 'demandeur', username: 'Randriamampionona Tolotra', email: 'tolotra.randria@mtefop.gov.mg', documentId: 'u-dem' },
  { id: 25, roleType: 'comptable', username: 'Rasoa Naina', email: 'naina.rasoa@mtefop.gov.mg', documentId: 'u-comp' },
];

/** Matcher filtres simplifié : court-circuit $startsWith / $eqi / $in,
 *  descente dans les relations (Demandeur → ses sorties) et égalité stricte. */
function correspond(entite, filtres) {
  if (!filtres) return true;
  return Object.entries(filtres).every(([cle, valeur]) => {
    if (valeur === null || valeur === undefined) return entite[cle] === valeur;
    if (typeof valeur === 'object' && !Array.isArray(valeur)) {
      if ('$startsWith' in valeur) {
        return String(entite[cle] == null ? '' : entite[cle]).startsWith(valeur.$startsWith);
      }
      if ('$eqi' in valeur) {
        return String(entite[cle] == null ? '' : entite[cle]).toLowerCase() ===
          String(valeur.$eqi).toLowerCase();
      }
      if ('$in' in valeur) {
        return valeur.$in.includes(entite[cle]);
      }
      const cible = entite[cle];
      if (cible && typeof cible === 'object') return correspond(cible, valeur);
      return false;
    }
    return entite[cle] === valeur;
  });
}

function materielDe(documentId) {
  const m = CONTENEURS['api::material.material'].find((e) => e.documentId === documentId);
  return m ? { ...m } : null;
}

function directionDe(ref) {
  // Tolère une référence déjà peuplée (objet) comme un documentId (string).
  if (ref && typeof ref === 'object') return { ...ref };
  const d = CONTENEURS['api::direction.direction'].find((e) => e.documentId === ref);
  return d ? { ...d } : null;
}

function serviceDe(ref) {
  // Une lecture « peuplée » d'un service renvoie sa direction RÉSOLUE :
  // en base, la relation stocke le documentId ; l'API (et donc ce test)
  // renvoie l'objet peuplé.
  const id = ref && typeof ref === 'object' ? ref.documentId : ref;
  const s = CONTENEURS['api::service.service'].find((e) => e.documentId === id);
  if (!s) return null;
  const copie = { ...s };
  if (s.direction) copie.direction = directionDe(s.direction);
  return copie;
}

// Test simple pour vérifier que directionDe fonctionne
test('vérification de la fonction directionDe', () => {
  reinitialiser();
  const directionObj = directionDe('dlog');
  assert.strictEqual(directionObj?.nom_direction, 'Direction Logistique');
});

// Test de débogage pour voir ce qui se trouve dans la sortie
test('débogage de la récupération de sortie', () => {
  reinitialiser();
  const sortieEntite = CONTENEURS['api::sortie.sortie'].find((s) => s.documentId === 's1');
  assert.ok(sortieEntite, 'la sortie devrait exister');
  if (sortieEntite) {
    console.log('sortieEntite.direction =', JSON.stringify(sortieEntite.direction));
    console.log('type de sortieEntite.direction =', typeof sortieEntite.direction);
  }
  const sortiePeuplee = sortieEnBase('s1');
  assert.ok(sortiePeuplee, 'la sortie peuplée devrait exister');
  if (sortiePeuplee) {
    console.log('sortiePeuplee.direction =', JSON.stringify(sortiePeuplee.direction));
    console.log('type de sortiePeuplee.direction =', typeof sortiePeuplee.direction);
    if (sortiePeuplee.direction) {
      console.log('sortiePeuplee.direction.nom_direction =', sortiePeuplee.direction.nom_direction);
    }
  }
});

// Test pour vérifier ce qui se trouve dans le tableau des directions
test('vérification du tableau des directions après reinitialiser', () => {
  reinitialiser(); // S'assurer que les données sont initialisées
  const directions = CONTENEURS['api::direction.direction'];
  assert.strictEqual(directions.length, 2, 'devrait y avoir 2 directions');

  const directionLogistique = directions.find((d) => d.documentId === 'dlog');
  assert.ok(directionLogistique, 'devrait trouver une direction avec documentId dlog');
  if (directionLogistique) {
    assert.strictEqual(directionLogistique.nom_direction, 'Direction Logistique');
  }

  const directionRH = directions.find((d) => d.documentId === 'drh');
  assert.ok(directionRH, 'devrait trouver une direction avec documentId drh');
  if (directionRH) {
    assert.strictEqual(directionRH.nom_direction, 'Direction des Ressources Humaines');
  }
});

/** Lecture « peuplée » : une sortie renvoie ses lignes (chacune avec son
 *  matériel), une ligne renvoie son matériel. Copie à chaque fois pour que
 *  la MUTATION d'une réponse de test ne pollue jamais le stock simulé. */
function peuple(uid, entite) {
  const copie = { ...entite };
  if (uid === 'api::sortie.sortie') {
    // Peupler la direction et le service si présents
    if (entite.direction) copie.direction = directionDe(entite.direction);
    if (entite.service) copie.service = serviceDe(entite.service);
    // loadSortie renvoie les lignes (chacune avec SON matériel) et les
    // mouvements : la signature magasinier contrôle chaque ligne, la
    // validation logistique débite le matériel de chaque ligne.
    copie.lignes = CONTENEURS['api::sortie-ligne.sortie-ligne']
      .filter((l) => l.sortie === entite.documentId)
      .map((l) => peuple('api::sortie-ligne.sortie-ligne', l));
    copie.mouvements = CONTENEURS['api::mouvement.mouvement']
      .filter((m) => m.sortie === entite.documentId)
      .map((m) => ({ ...m }));
  }
  if (uid === 'api::sortie-ligne.sortie-ligne') {
    if (entite.materiel) copie.materiel = materielDe(entite.materiel);
  }
  if (uid === 'api::direction.direction') {
    // Pour le test, on ne peupler pas les services/employés pour éviter les problèmes d'ordre
    // On retourne juste l'objet direction de base
  }
  if (uid === 'api::service.service') {
    // Peupler la direction si présente (nécessaire pour le test)
    if (entite.direction) copie.direction = directionDe(entite.direction);
  }
  // Pour les autres types, on retourne juste l'objet de base copié
  // api::material.material, api::sortie-ligne.sortie-ligne, api::mouvement.mouvement,
  // api::employee.employee, api::demande.demande n'ont pas besoin de peuplement spécial pour ce test
  return copie;
}

function documents(uid) {
  const stock = CONTENEURS[uid];
  if (!stock) throw new Error(`uid inconnu dans la simulation : ${uid}`);
  return {
    async findOne({ documentId } = {}) {
      const entite = stock.find((e) => e.documentId === documentId);
      return entite ? peuple(uid, entite) : null;
    },
    async findMany({ filters, limit } = {}) {
      const rows = stock.filter((e) => correspond(e, filters));
      const fin = limit === undefined ? rows.length : limit;
      return rows.slice(0, fin).map((e) => peuple(uid, e));
    },
    async create({ data } = {}) {
      compteur += 1;
      const entite = {
        documentId: data.documentId || `document-${compteur}`,
        ...data,
      };
      stock.push(entite);
      if (journalEcritures) journalEcritures.push({ uid, entite, avant: null });
      return peuple(uid, entite);
    },
    async update({ documentId, data } = {}) {
      const entite = stock.find((e) => e.documentId === documentId);
      if (!entite) throw new Error(`Enregistrement introuvable : ${documentId}`);
      Object.assign(entite, data);
      return peuple(uid, entite);
    },
  };
}

/* Journal d'annulation de la transaction COURANTE (voir appSimule.db). */
let journalEcritures = null;

/** Normalise une valeur pour la comparaison SQL simulée : les booléens du
 *  harnais (true/false) doivent s'apparier avec les écritures knex (1/0). */
function versSql(valeur) {
  if (typeof valeur === 'boolean') return valeur ? 1 : 0;
  return valeur;
}

/** Tables accessibles depuis le `trx` knex de la validation logistique. */
const TABLES_KNEX = {
  sorties: 'api::sortie.sortie',
  materials: 'api::material.material',
};

/** Mini-moteur knex : where({}) / where(col, op, v) / first / update /
 *  decrement — exactement les appels de signerLogistique. Les écritures passent
 *  par le journal d'annulation pour un rollback réel. */
function builderKnex(nomTable) {
  const uid = TABLES_KNEX[nomTable];
  const stock = CONTENEURS[uid];
  if (!stock) throw new Error(`Table simulée inconnue : ${nomTable}`);
  // Le contrôleur cible les COLONNES SQL (`document_id`) ; le harnais stocke
  // des entités documentService (`documentId`). On traduit ici.
  const col = (c) => (c === 'document_id' ? 'documentId' : c);
  const preds = [];
  const ajouter = (fn) => {
    preds.push(fn);
    return api;
  };
  const api = {
    where(...args) {
      if (args.length === 1 && args[0] && typeof args[0] === 'object') {
        for (const [cle, valeur] of Object.entries(args[0])) {
          const attendu = versSql(valeur);
          const champ = col(cle);
          ajouter((row) => versSql(row[champ]) === attendu);
        }
        return api;
      }
      if (args.length === 2) {
        const [c, valeur] = args;
        const attendu = versSql(valeur);
        const champ = col(c);
        return ajouter((row) => versSql(row[champ]) === attendu);
      }
      const [c, op, valeur] = args;
      const champ = col(c);
      return ajouter((row) => {
        const a = Number(row[champ]);
        const b = Number(valeur);
        if (op === '>=') return a >= b;
        if (op === '<=') return a <= b;
        if (op === '>') return a > b;
        if (op === '<') return a < b;
        return row[col] === valeur;
      });
    },
    update(champs) {
      const modifiees = stock.filter((row) => preds.every((p) => p(row)));
      for (const row of modifiees) {
        const avant = {};
        for (const cle of Object.keys(champs)) avant[cle] = row[cle];
        if (journalEcritures) journalEcritures.push({ uid, entite: row, avant });
        for (const [cle, valeur] of Object.entries(champs)) row[cle] = versSql(valeur);
      }
      return Promise.resolve(modifiees.length);
    },
    decrement(colonne, pas = 1) {
      const champ = col(colonne);
      const modifiees = stock.filter((row) => preds.every((p) => p(row)));
      for (const row of modifiees) {
        if (journalEcritures) journalEcritures.push({ uid, entite: row, avant: { [champ]: row[champ] } });
        row[champ] = Number(row[champ]) - pas;
      }
      return Promise.resolve(modifiees.length);
    },
    first(...cols) {
      const ligne = stock.find((row) => preds.every((p) => p(row)));
      if (!ligne) return Promise.resolve(undefined);
      if (cols.length > 0) {
        const extrait = {};
        for (const c of cols) extrait[c] = ligne[col(c)];
        return Promise.resolve(extrait);
      }
      return Promise.resolve({ ...ligne });
    },
  };
  return api;
}

const appSimule = {
  documents,
  db: {
    // Transaction SÉRIELLE avec rollback réel (journal d'écritures) : si le
    // callback lève (pénurie, verrou, échec de traçage), les décrémentations
    // de stock et les écritures sont restaurées dans l'ordre inverse.
    async transaction(cb) {
      const precedent = journalEcritures;
      journalEcritures = [];
      try {
        const resultat = await cb({ trx: (table) => builderKnex(table) });
        journalEcritures = precedent;
        return resultat;
      } catch (e) {
        for (let i = journalEcritures.length - 1; i >= 0; i -= 1) {
          const ecriture = journalEcritures[i];
          if (ecriture.avant === null) {
            const idx = CONTENEURS[ecriture.uid].indexOf(ecriture.entite);
            if (idx !== -1) CONTENEURS[ecriture.uid].splice(idx, 1);
          } else {
            Object.assign(ecriture.entite, ecriture.avant);
          }
        }
        journalEcritures = precedent;
        throw e;
      }
    },
    query(uid) {
      if (uid !== 'plugin::users-permissions.user') {
        throw new Error(`db.query non simulé pour : ${uid}`);
      }
      return {
        async findOne({ where } = {}) {
          const user = UTILISATEURS.find((u) => u.id === where.id);
          if (!user) return null;
          // getRoleCode lit `role.code || role.type`.
          return { id: user.id, role: { code: user.roleType, type: user.roleType } };
        },
      };
    },
  },
  log: {
    warn(message) {
      journalAvertissements.push(message);
    },
  },
};

/* ─── Injection du @strapi/strapi FACTICE avant de charger le contrôleur ─── */

function fauxCreateCoreController(uid, setup) {
  const base = {
    find(ctx) {
      return { core: 'find' };
    },
    findOne(ctx) {
      return { core: 'findOne' };
    },
  };
  const customs = setup({ strapi: appSimule });
  const objet = Object.create(base);
  Object.assign(objet, customs);
  return objet;
}

const cheminStrapi = require.resolve('@strapi/strapi');
require.cache[cheminStrapi] = {
  id: cheminStrapi,
  filename: cheminStrapi,
  loaded: true,
  exports: { factories: { createCoreController: fauxCreateCoreController } },
};

// Le contrôleur accède à `strapi` comme identifiant GLOB (global.strapi) :
// c'est ce que fait Strapi en production, on reproduit ici.
global.strapi = appSimule;
const controleur = require(CONTROLEUR);

/* ─────────────────────── Données de test réutilisables ──────────────────── */

function utilisateurParRole(type) {
  const { roleType, ...reste } = UTILISATEURS.find((u) => u.roleType === type);
  return reste;
}

function reinitialiser() {
  compteur = 0;
  journalAvertissements = [];
  for (const stock of Object.values(CONTENEURS)) stock.length = 0;

  // Matériel de base
  CONTENEURS['api::material.material'].push(
    { documentId: 'm1', designation: 'Tapis de souris', quantite_stock: 10 },
    { documentId: 'm2', designation: 'Clavier compact', quantite_stock: 5 }
  );

  // Directions de base (extrait de SEED_DIRECTIONS dans index.js)
  CONTENEURS['api::direction.direction'].push(
    {
      documentId: 'dlog',
      nom_direction: 'Direction Logistique',
      abreviation: 'DLOG',
      description: 'Direction en charge de la gestion des équipements et de la comptabilité matière',
      directeur: 'Dr. RAZAFY Jean Pierre',
      directeur_email: 'jp.razafy@ministere.gov.mg',
      localisation: 'Bâtiment Principal - 2ème étage',
    },
    {
      documentId: 'drh',
      nom_direction: 'Direction des Ressources Humaines',
      abreviation: 'DRH',
      description: 'Direction en charge de la gestion du personnel et des carrières',
      directeur: 'Dr. RANAIVO Claudine',
      directeur_email: 'c.ranaivo@ministere.gov.mg',
      localisation: 'Bâtiment RH - 1er étage',
    }
  );

  // Services de base (extrait de SEED_DIRECTIONS dans index.js)
  CONTENEURS['api::service.service'].push(
    {
      documentId: 'scompta',
      nom_service: 'Service Comptabilité Matière',
      description: 'Gestion des entrées, sorties et inventaires',
      responsable: 'Mme RAKOTO Marie (Admin Système)',
      responsable_email: 'm.rakoto@ministere.gov.mg',
      localisation: 'Bureau 201',
      direction: 'dlog', // Direction Logistique
    },
    {
      documentId: 'sappro',
      nom_service: 'Service Approvisionnement',
      description: 'Gestion des achats et approvisionnements',
      responsable: 'M. ANDRY Paul',
      responsable_email: 'p.andry@ministere.gov.mg',
      localisation: 'Bureau 202',
      direction: 'dlog', // Direction Logistique
    },
    {
      documentId: 'smaint',
      nom_service: 'Service Maintenance',
      description: 'Maintenance préventive et curative des équipements',
      responsable: 'M. RABE Michel',
      responsable_email: 'm.rabe@ministere.gov.mg',
      localisation: 'Bureau 203',
      direction: 'dlog', // Direction Logistique
    },
    {
      documentId: 'srh',
      nom_service: 'Service Gestion Personnel',
      description: 'Gestion administrative du personnel',
      responsable: 'Mme RAZANADRA Voahangy',
      responsable_email: 'v.razanadra@ministere.gov.mg',
      localisation: 'Bureau 101',
      direction: 'drh', // Direction des Ressources Humaines
    }
  );

  // Employés de base (extrait de SEED_DIRECTIONS dans index.js)
  CONTENEURS['api::employee.employee'].push(
    // Service Comptabilité Matière (Direction Logistique)
    {
      documentId: 'e1',
      im: 'MIN.001',
      CIN: '101234567890',
      nom: 'RAKOTO',
      prenom: 'Marie',
      sexe: 'féminin',
      fonction: 'Responsable Comptabilité Matière (Admin)',
      email: 'm.rakoto@ministere.gov.mg',
      phone: '+261 20 22 123 45',
      service: 'scompta'
    },
    {
      documentId: 'e2',
      im: 'MIN.002',
      CIN: '101234567891',
      nom: 'RAMAROSON',
      prenom: 'Jean',
      sexe: 'masculin',
      fonction: 'Gestionnaire Matériel',
      email: 'j.ramaroson@ministere.gov.mg',
      phone: '+261 20 22 123 46',
      service: 'scompta'
    },
    {
      documentId: 'e3',
      im: 'MIN.003',
      CIN: '101234567892',
      nom: 'RANDRIAMAMPIONONA',
      prenom: 'Sophie',
      sexe: 'féminin',
      fonction: 'Agent Comptable',
      email: 's.randriamampionona@ministere.gov.mg',
      phone: '+261 20 22 123 47',
      service: 'scompta'
    },
    // Service Approvisionnement (Direction Logistique)
    {
      documentId: 'e4',
      im: 'MIN.004',
      CIN: '101234567893',
      nom: 'ANDRY',
      prenom: 'Paul',
      sexe: 'masculin',
      fonction: 'Chef Service Approvisionnement',
      email: 'p.andry@ministere.gov.mg',
      phone: '+261 20 22 123 48',
      service: 'sappro'
    },
    {
      documentId: 'e5',
      im: 'MIN.005',
      CIN: '101234567894',
      nom: 'RATSIMBAZAFY',
      prenom: 'Hery',
      sexe: 'masculin',
      fonction: 'Agent Approvisionnement',
      email: 'h.ratsimbazafy@ministere.gov.mg',
      phone: '+261 20 22 123 49',
      service: 'sappro'
    },
    // Service Maintenance (Direction Logistique)
    {
      documentId: 'e6',
      im: 'MIN.006',
      CIN: '101234567895',
      nom: 'RABE',
      prenom: 'Michel',
      sexe: 'masculin',
      fonction: 'Responsable Maintenance',
      email: 'm.rabe@ministere.gov.mg',
      phone: '+261 20 22 123 50',
      service: 'smaint'
    },
    {
      documentId: 'e7',
      im: 'MIN.007',
      CIN: '101234567896',
      nom: 'RAKOTONIRINA',
      prenom: 'Lova',
      sexe: 'féminin',
      fonction: 'Technicien Maintenance',
      email: 'l.rakotonirina@ministere.gov.mg',
      phone: '+261 20 22 123 51',
      service: 'smaint'
    },
    // Service Gestion Personnel (Direction des Ressources Humaines)
    {
      documentId: 'e8',
      im: 'MIN.008',
      CIN: '201234567890',
      nom: 'RAZANADRA',
      prenom: 'Voahangy',
      sexe: 'féminin',
      fonction: 'Chef Service Personnel',
      email: 'v.razanadra@ministere.gov.mg',
      phone: '+261 20 22 234 45',
      service: 'srh'
    },
    {
      documentId: 'e9',
      im: 'MIN.009',
      CIN: '201234567891',
      nom: 'RASOLOFONIAINA',
      prenom: 'Fidy',
      sexe: 'masculin',
      fonction: 'Gestionnaire RH',
      email: 'f.rasolofoniaina@ministere.gov.mg',
      phone: '+261 20 22 234 46',
      service: 'srh'
    }
  );

  // Lignes de sortie
  CONTENEURS['api::sortie-ligne.sortie-ligne'].push(
    { documentId: 'l1', sortie: 's1', materiel: 'm1', designation: 'Tapis de souris', quantite: 2 },
    { documentId: 'l2', sortie: 's1', materiel: 'm2', designation: 'Clavier compact', quantite: 3 },
  );

  // Sortie de base associée à la Direction Logistique (pour tester le flux de distribution)
  CONTENEURS['api::sortie.sortie'].push({
    documentId: 's1',
    reference: 'SOR-2026-001',
    date_sortie: '2026-10-13',
    statut: 'en_preparation',
    magasinier_signed: false,
    depositaire_signed: false,
    logistique_signed: false,
    stock_impacte: false,
    direction: 'dlog', // Direction Logistique - C'est ce que nous voulons tester
    service: 'scompta', // Service Comptabilité Matière (appartient à la Direction Logistique)
  });

  // Demande liée à la sortie
  CONTENEURS['api::demande.demande'].push({
    documentId: 'd1',
    reference: 'DEM-2026-001',
    type: 'sortie',
    designation_materiel: 'Tapis de souris',
    quantite: 5,
    statut: 'approuvee',
    date_demande: '2026-10-01',
    demandeur: 'u-dem',
  });
}

function sortieEnBase(documentId) {
  const entite = CONTENEURS['api::sortie.sortie'].find((s) => s.documentId === documentId);
  return entite ? peuple('api::sortie.sortie', entite) : null;
}

function ligneEnBase(documentId) {
  const entite = CONTENEURS['api::sortie-ligne.sortie-ligne'].find((l) => l.documentId === documentId);
  return entite ? peuple('api::sortie-ligne.sortie-ligne', entite) : null;
}

function materielEnBase(documentId) {
  const entite = CONTENEURS['api::material.material'].find((m) => m.documentId === documentId);
  return entite ? peuple('api::material.material', entite) : null;
}

function directionEnBase(documentId) {
  const entite = CONTENEURS['api::direction.direction'].find((d) => d.documentId === documentId);
  return entite ? peuple('api::direction.direction', entite) : null;
}

function serviceEnBase(documentId) {
  const entite = CONTENEURS['api::service.service'].find((s) => s.documentId === documentId);
  return entite ? peuple('api::service.service', entite) : null;
}

function demandeEnBase(documentId) {
  const entite = CONTENEURS['api::demande.demande'].find((d) => d.documentId === documentId);
  return entite ? peuple('api::demande.demande', entite) : null;
}

function mouvementEnBase(documentId) {
  const entite = CONTENEURS['api::mouvement.mouvement'].find((m) => m.documentId === documentId);
  return entite ? peuple('api::mouvement.mouvement', entite) : null;
}

/** Date du jour (AAAA-MM-JJ) : la remise refuse une date postérieure à
 *  aujourd'hui — une date figée dans le test finirait par devenir future. */
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

function contexteAppel(documentId, corps, role) {
  return {
    params: { documentId },
    request: { body: corps === undefined ? undefined : { data: corps } },
    state: { user: utilisateurParRole(role) },
    status: 200,
    body: null,
    query: {},
  };
}

/* ────────────────────────────── Tests du flux de distribution ────────────────────────────── */

test('flux de distribution complet : sortie associée à une direction suit tout le circuit avec succès', async () => {
  reinitialiser();

  // Vérifier que la sortie initiale est bien associée à la Direction Logistique
  const sortieInitiale = sortieEnBase('s1');
  console.log('Valeur réelle de sortieInitiale.direction.nom_direction:', sortieInitiale.direction.nom_direction);
  assert.strictEqual(sortieInitiale.direction.nom_direction, 'Direction Logistique', `Expected 'Direction Logistique' but got ${JSON.stringify(sortieInitiale.direction.nom_direction)}`);
  assert.strictEqual(sortieInitiale.direction.abreviation, 'DLOG');
  assert.strictEqual(sortieInitiale.service.nom_service, 'Service Comptabilité Matière');
  assert.strictEqual(sortieInitiale.service.direction.nom_direction, 'Direction Logistique');

  // --- ÉTAPE 1 : Signature magasinier -------------------------
  const controlesMagasinier = [
    { ligne: 'l1', etat: 'neuf' },
    { ligne: 'l2', etat: 'bon', observations: 'Étiquette refaite' }
  ];

  const ctx1 = contexteAppel('s1', { role: 'magasinier', controles: controlesMagasinier }, 'magasinier');
  const reponse1 = await controleur.sign(ctx1);

  assert.strictEqual(ctx1.status, 200, 'signature magasinier acceptée');
  const sortieApresMagasinier = reponse1.data;
  assert.strictEqual(sortieApresMagasinier.magasinier_signed, true);
  assert.strictEqual(sortieApresMagasinier.signataire_magasinier, 'Andriamampianina Fara');
  assert.strictEqual(sortieApresMagasinier.statut, 'en_preparation');

  // Vérifier que la direction est toujours associée après la signature magasinier
  assert.strictEqual(sortieApresMagasinier.direction.nom_direction, 'Direction Logistique');

  // Vérifier que les contrôles ont été enregistrés
  const ligne1Apres = ligneEnBase('l1');
  const ligne2Apres = ligneEnBase('l2');
  assert.strictEqual(ligne1Apres.etat, 'neuf');
  assert.strictEqual(ligne2Apres.etat, 'bon');
  assert.strictEqual(ligne2Apres.observations, 'Étiquette refaite');

  // --- ÉTAPE 2 : Signature dépositaire ------------------------
  const ctx2 = contexteAppel('s1', { role: 'depositaire' }, 'depositaire');
  const reponse2 = await controleur.sign(ctx2);

  assert.strictEqual(ctx2.status, 200, 'signature dépositaire acceptée');
  const sortieApresDepositaire = reponse2.data;
  assert.strictEqual(sortieApresDepositaire.depositaire_signed, true);
  assert.strictEqual(sortieApresDepositaire.signataire_depositaire, 'Rakotomalala Hery');
  assert.strictEqual(sortieApresDepositaire.statut, 'en_preparation');

  // Vérifier que la direction est toujours associée après la signature dépositaire
  assert.strictEqual(sortieApresDepositaire.direction.nom_direction, 'Direction Logistique');

  // --- ÉTAPE 3 : Signature logistique (validation et baisse du stock) ---
  const ctx3 = contexteAppel('s1', { role: 'logistique' }, 'logistique');
  const reponse3 = await controleur.sign(ctx3);

  assert.strictEqual(ctx3.status, 200, 'signature logistique acceptée');
  const sortieApresLogistique = reponse3.data;
  assert.strictEqual(sortieApresLogistique.logistique_signed, true);
  assert.strictEqual(sortieApresLogistique.signataire_logistique, 'Razafindrakoto Tojo');
  assert.strictEqual(sortieApresLogistique.statut, 'validee');
  assert.strictEqual(sortieApresLogistique.stock_impacte, true);

  // Vérifier que la direction est toujours associée après la signature logistique
  assert.strictEqual(sortieApresLogistique.direction.nom_direction, 'Direction Logistique');

  // Vérifier que le stock a été correctement débité (baisse atomique du stock)
  assert.strictEqual(materielEnBase('m1').quantite_stock, 8, 'stock m1 : 10 - 2 = 8');
  assert.strictEqual(materielEnBase('m2').quantite_stock, 2, 'stock m2 : 5 - 3 = 2');

  // Vérifier les mouvements de traçage créés lors de la validation
  const mouvementsApresValidation = CONTENEURS['api::mouvement.mouvement']
    .filter((m) => m.sortie === 's1');

  // Devrait y avoir : 2 mouvements de signature (magasinier, dépositaire) +
  // 2 mouvements de validation (un par ligne) + 1 mouvement de signature logistique = 5 mouvements
  assert.strictEqual(mouvementsApresValidation.length, 5);

  // Vérifier les mouvements de validation (sortie validée, stock débité)
  const mouvementsValidation = mouvementsApresValidation
    .filter((m) => m.action === 'Sortie validée, stock débité');
  assert.strictEqual(mouvementsValidation.length, 2);

  // Vérifier les détails des mouvements de validation
  const mouvementM1 = mouvementsValidation.find((m) =>
    m.materiel === 'Tapis de souris' && m.quantite === 2);
  const mouvementM2 = mouvementsValidation.find((m) =>
    m.materiel === 'Clavier compact' && m.quantite === 3);

  assert.ok(mouvementM1, 'mouvement de validation pour le tapis de souris trouvé');
  assert.ok(mouvementM2, 'mouvement de validation pour le clavier compact trouvé');
  assert.strictEqual(mouvementM1.statut, 'validee');
  assert.strictEqual(mouvementM2.statut, 'validee');

  // Vérifier le mouvement de signature logistique
  const mouvementSignatureLogistique = mouvementsApresValidation
    .find((m) => m.action === 'Signature logistique');
  assert.ok(mouvementSignatureLogistique, 'mouvement de signature logistique trouvé');
  assert.strictEqual(mouvementSignatureLogistique.quantite, 5, 'quantité totale : 2 + 3 = 5');
  assert.strictEqual(mouvementSignatureLogistique.statut, 'validee');

  // --- ÉTAPE 4 : Remise au détenteur -------------------------
  const ctx4 = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur',
      date_remise: AUJOURDHUI
    }
  }, 'magasinier');

  const reponse4 = await controleur.remise(ctx4);

  assert.strictEqual(ctx4.status, 200, 'remise acceptée');
  const sortieApresRemise = reponse4.data;
  assert.strictEqual(sortieApresRemise.statut, 'sortie_effectuee');
  assert.strictEqual(sortieApresRemise.detenteur_nom, 'Jean Martin');
  assert.strictEqual(sortieApresRemise.detenteur_fonction, 'Ingénieur');
  assert.strictEqual(sortieApresRemise.date_remise, AUJOURDHUI);

  // Vérifier que la direction est toujours associée après la remise
  assert.strictEqual(sortieApresRemise.direction.nom_direction, 'Direction Logistique');

  // Vérifier que le stock n'a pas été modifié lors de la remise (pas d'impact sur le stock)
  assert.strictEqual(materielEnBase('m1').quantite_stock, 8, 'stock m1 inchangé après remise');
  assert.strictEqual(materielEnBase('m2').quantite_stock, 2, 'stock m2 inchangé après remise');
  assert.strictEqual(sortieApresRemise.stock_impacte, true, 'stock_impacte reste true');

  // Vérifier le mouvement de traçage de la remise
  const mouvementsApresRemise = CONTENEURS['api::mouvement.mouvement']
    .filter((m) => m.sortie === 's1');
  assert.strictEqual(mouvementsApresRemise.length, 6, 'un mouvement de remise ajouté (total : 6)');

  const mouvementRemise = mouvementsApresRemise
    .find((m) => m.action === 'Remise au détenteur');
  assert.ok(mouvementRemise, 'mouvement de remise trouvé');
  assert.strictEqual(mouvementRemise.statut, 'sortie_effectuee');
  assert.match(mouvementRemise.observations, /Jean Martin/);
  assert.match(mouvementRemise.observations, /Ingénieur/);

  // Vérifier que la demande liée a été mise à jour si nécessaire
  const demandeApres = demandeEnBase('d1');
  // Dans ce cas, la demande devrait rester approuvee car nous n'avons pas spécifié
  // que nous voulions tester la mise à jour de la demande, mais nous pourrions
  // ajouter ce test si nécessaire
});

test('flux de distribution avec une autre direction : vérification de l\'isolation des directions', async () => {
  reinitialiser();

  // Créer une sortie associée à la Direction des Ressources Humaines
  CONTENEURS['api::sortie.sortie'].push({
    documentId: 's2',
    reference: 'SOR-2026-002',
    date_sortie: '2026-10-14',
    statut: 'en_preparation',
    magasinier_signed: false,
    depositaire_signed: false,
    logistique_signed: false,
    stock_impacte: false,
    direction: 'drh', // Direction des Ressources Humaines
    service: 'srh', // Service Gestion Personnel (appartient à la Direction des Ressources Humaines)
  });

  // Ajouter des lignes pour cette sortie
  CONTENEURS['api::sortie-ligne.sortie-ligne'].push(
    { documentId: 'l3', sortie: 's2', materiel: 'm1', designation: 'Tapis de souris', quantite: 1 },
    { documentId: 'l4', sortie: 's2', materiel: 'm2', designation: 'Clavier compact', quantite: 2 }
  );

  // Vérifier que la sortie initiale est bien associée à la Direction des Ressources Humaines
  const sortieInitialeS2 = sortieEnBase('s2');
  assert.strictEqual(sortieInitialeS2.direction.nom_direction, 'Direction des Ressources Humaines');
  assert.strictEqual(sortieInitialeS2.direction.abreviation, 'DRH');
  assert.strictEqual(sortieInitialeS2.service.nom_service, 'Service Gestion Personnel');
  assert.strictEqual(sortieInitialeS2.service.direction.nom_direction, 'Direction des Ressources Humaines');

  // Faire suivre le circuit de signature complet pour cette sortie
  const controlesMagasinierS2 = [
    { ligne: 'l3', etat: 'neuf' },
    { ligne: 'l4', etat: 'bon' }
  ];

  // Signature magasinier
  const ctx1S2 = contexteAppel('s2', { role: 'magasinier', controles: controlesMagasinierS2 }, 'magasinier');
  await controleur.sign(ctx1S2);
  assert.strictEqual(ctx1S2.status, 200);

  // Signature dépositaire
  const ctx2S2 = contexteAppel('s2', { role: 'depositaire' }, 'depositaire');
  await controleur.sign(ctx2S2);
  assert.strictEqual(ctx2S2.status, 200);

  // Signature logistique (validation et baisse du stock)
  const ctx3S2 = contexteAppel('s2', { role: 'logistique' }, 'logistique');
  const reponse3S2 = await controleur.sign(ctx3S2);
  assert.strictEqual(ctx3S2.status, 200, 'signature logistique acceptée pour s2');

  // Vérifier que la direction est toujours associée après la signature logistique
  const sortieApresLogistiqueS2 = reponse3S2.data;
  assert.strictEqual(sortieApresLogistiqueS2.direction.nom_direction, 'Direction des Ressources Humaines');

  // Vérifier que le stock a été correctement débité
  assert.strictEqual(materielEnBase('m1').quantite_stock, 7, 'stock m1 : 8 (après s1) - 1 (pour s2) = 7');
  assert.strictEqual(materielEnBase('m2').quantite_stock, 0, 'stock m2 : 2 (après s1) - 2 (pour s2) = 0');

  // Faire la remise pour cette sortie
  const ctx4S2 = contexteAppel('s2', {
    data: {
      detenteur_nom: 'Sophie Dubois',
      detenteur_fonction: 'Chargée de RH',
      date_remise: '2026-10-16'
    }
  }, 'magasinier');

  const reponse4S2 = await controleur.remise(ctx4S2);
  assert.strictEqual(ctx4S2.status, 200, 'remise acceptée pour s2');

  // Vérifier que la direction est toujours associée après la remise
  const sortieApresRemiseS2 = reponse4S2.data;
  assert.strictEqual(sortieApresRemiseS2.direction.nom_direction, 'Direction des Ressources Humaines');

  // Vérifier que le stock n'a pas été modifié lors de la remise
  assert.strictEqual(materielEnBase('m1').quantite_stock, 7, 'stock m1 inchangé après remise pour s2');
  assert.strictEqual(materielEnBase('m2').quantite_stock, 0, 'stock m2 inchangé après remise pour s2');
});

test('vérification que les directions du seed sont bien présentes dans la simulation', () => {
  reinitialiser();
  // Vérifier que nous avons bien chargé les directions du seed
  const directions = CONTENEURS['api::direction.direction'];
  assert.strictEqual(directions.length, 2, 'deux directions présentes dans la simulation');

  const directionLogistique = directions.find((d) => d.nom_direction === 'Direction Logistique');
  const directionRH = directions.find((d) => d.nom_direction === 'Direction des Ressources Humaines');

  assert.ok(directionLogistique, 'Direction Logistique trouvée');
  assert.strictEqual(directionLogistique.abreviation, 'DLOG');
  assert.strictEqual(directionLogistique.directeur, 'Dr. RAZAFY Jean Pierre');

  assert.ok(directionRH, 'Direction des Ressources Humaines trouvée');
  assert.strictEqual(directionRH.abreviation, 'DRH');
  assert.strictEqual(directionRH.directeur, 'Dr. RANAIVO Claudine');

  // Vérifier que les services sont bien associés aux directions
  const services = CONTENEURS['api::service.service'];
  assert.strictEqual(services.length, 4, 'quatre services présents dans la simulation');

  const servicesLogistique = services.filter(
    (s) => directionDe(s.direction)?.nom_direction === 'Direction Logistique'
  );
  assert.strictEqual(servicesLogistique.length, 3, 'trois services associés à la Direction Logistique');

  const servicesRH = services.filter(
    (s) => directionDe(s.direction)?.nom_direction === 'Direction des Ressources Humaines'
  );
  assert.strictEqual(servicesRH.length, 1, 'un service associé à la Direction des Ressources Humaines');

  // Vérifier que les employés sont bien associés aux services
  const employes = CONTENEURS['api::employee.employee'];
  assert.strictEqual(employes.length, 9, 'neuf employés présents dans la simulation');

  const employesComptabiliteMatiere = employes.filter(
    (e) => serviceDe(e.service)?.nom_service === 'Service Comptabilité Matière'
  );
  assert.strictEqual(employesComptabiliteMatiere.length, 3, 'trois employés dans le Service Comptabilité Matière');

  const employesRH = employes.filter(
    (e) => serviceDe(e.service)?.nom_service === 'Service Gestion Personnel'
  );
  assert.strictEqual(employesRH.length, 2, 'deux employés dans le Service Gestion Personnel');
});

// Test : l'API de la page de distribution retourne les bonnes données pour les sorties validées
