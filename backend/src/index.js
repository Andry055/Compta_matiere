'use strict';

// ---------------------------------------------------------------------------
// Jeu de données de démarrage (repris du mock frontend src/components/Departments.tsx)
// Structure : Directions -> Services -> Employés
// ---------------------------------------------------------------------------
const SEED_DIRECTIONS = [
  {
    nom_direction: 'Direction Logistique',
    abreviation: 'DLOG',
    description:
      'Direction en charge de la gestion des équipements et de la comptabilité matière',
    directeur: 'Dr. RAZAFY Jean Pierre',
    directeur_email: 'jp.razafy@ministere.gov.mg',
    localisation: 'Bâtiment Principal - 2ème étage',
    services: [
      {
        nom_service: 'Service Comptabilité Matière',
        description: 'Gestion des entrées, sorties et inventaires',
        responsable: 'Mme RAKOTO Marie (Admin Système)',
        responsable_email: 'm.rakoto@ministere.gov.mg',
        localisation: 'Bureau 201',
        employees: [
          { im: 'MIN.001', CIN: '101234567890', nom: 'RAKOTO', prenom: 'Marie', sexe: 'féminin', fonction: 'Responsable Comptabilité Matière (Admin)', email: 'm.rakoto@ministere.gov.mg', phone: '+261 20 22 123 45' },
          { im: 'MIN.002', CIN: '101234567891', nom: 'RAMAROSON', prenom: 'Jean', sexe: 'masculin', fonction: 'Gestionnaire Matériel', email: 'j.ramaroson@ministere.gov.mg', phone: '+261 20 22 123 46' },
          { im: 'MIN.003', CIN: '101234567892', nom: 'RANDRIAMAMPIONONA', prenom: 'Sophie', sexe: 'féminin', fonction: 'Agent Comptable', email: 's.randriamampionona@ministere.gov.mg', phone: '+261 20 22 123 47' },
        ],
      },
      {
        nom_service: 'Service Approvisionnement',
        description: 'Gestion des achats et approvisionnements',
        responsable: 'M. ANDRY Paul',
        responsable_email: 'p.andry@ministere.gov.mg',
        localisation: 'Bureau 202',
        employees: [
          { im: 'MIN.004', CIN: '101234567893', nom: 'ANDRY', prenom: 'Paul', sexe: 'masculin', fonction: 'Chef Service Approvisionnement', email: 'p.andry@ministere.gov.mg', phone: '+261 20 22 123 48' },
          { im: 'MIN.005', CIN: '101234567894', nom: 'RATSIMBAZAFY', prenom: 'Hery', sexe: 'masculin', fonction: 'Agent Approvisionnement', email: 'h.ratsimbazafy@ministere.gov.mg', phone: '+261 20 22 123 49' },
        ],
      },
      {
        nom_service: 'Service Maintenance',
        description: 'Maintenance préventive et curative des équipements',
        responsable: 'M. RABE Michel',
        responsable_email: 'm.rabe@ministere.gov.mg',
        localisation: 'Bureau 203',
        employees: [
          { im: 'MIN.006', CIN: '101234567895', nom: 'RABE', prenom: 'Michel', sexe: 'masculin', fonction: 'Responsable Maintenance', email: 'm.rabe@ministere.gov.mg', phone: '+261 20 22 123 50' },
          { im: 'MIN.007', CIN: '101234567896', nom: 'RAKOTONIRINA', prenom: 'Lova', sexe: 'féminin', fonction: 'Technicien Maintenance', email: 'l.rakotonirina@ministere.gov.mg', phone: '+261 20 22 123 51' },
        ],
      },
    ],
  },
  {
    nom_direction: 'Direction des Ressources Humaines',
    abreviation: 'DRH',
    description: 'Direction en charge de la gestion du personnel et des carrières',
    directeur: 'Dr. RANAIVO Claudine',
    directeur_email: 'c.ranaivo@ministere.gov.mg',
    localisation: 'Bâtiment RH - 1er étage',
    services: [
      {
        nom_service: 'Service Gestion Personnel',
        description: 'Gestion administrative du personnel',
        responsable: 'Mme RAZANADRA Voahangy',
        responsable_email: 'v.razanadra@ministere.gov.mg',
        localisation: 'Bureau 101',
        employees: [
          { im: 'MIN.008', CIN: '201234567890', nom: 'RAZANADRA', prenom: 'Voahangy', sexe: 'féminin', fonction: 'Chef Service Personnel', email: 'v.razanadra@ministere.gov.mg', phone: '+261 20 22 234 45' },
          { im: 'MIN.009', CIN: '201234567891', nom: 'RASOLOFONIAINA', prenom: 'Fidy', sexe: 'masculin', fonction: 'Gestionnaire RH', email: 'f.rasolofoniaina@ministere.gov.mg', phone: '+261 20 22 234 46' },
        ],
      },
      {
        nom_service: 'Service Formation',
        description: 'Formation et développement des compétences',
        responsable: 'M. RAJAONARISON Hery',
        responsable_email: 'h.rajaonarison@ministere.gov.mg',
        localisation: 'Bureau 102',
        employees: [
          { im: 'MIN.010', CIN: '201234567892', nom: 'RAJAONARISON', prenom: 'Hery', sexe: 'masculin', fonction: 'Responsable Formation', email: 'h.rajaonarison@ministere.gov.mg', phone: '+261 20 22 234 47' },
        ],
      },
    ],
  },
  {
    nom_direction: 'Direction Informatique',
    abreviation: 'DI',
    description: 'Direction en charge des systèmes informatiques et technologies',
    directeur: 'Ing. RAKOTOMANGA Andry',
    directeur_email: 'a.rakotomanga@ministere.gov.mg',
    localisation: 'Bâtiment IT - Rez-de-chaussée',
    services: [
      {
        nom_service: 'Service Développement',
        description: "Développement d'applications métier",
        responsable: 'M. RAZAFINDRAKOTO Lala',
        responsable_email: 'l.razafindrakoto@ministere.gov.mg',
        localisation: 'Bureau IT-01',
        employees: [
          { im: 'MIN.011', CIN: '301234567890', nom: 'RAZAFINDRAKOTO', prenom: 'Lala', sexe: 'masculin', fonction: 'Chef Service Développement', email: 'l.razafindrakoto@ministere.gov.mg', phone: '+261 20 22 345 45' },
          { im: 'MIN.012', CIN: '301234567891', nom: 'RANDRIANARISON', prenom: 'Mino', sexe: 'masculin', fonction: 'Développeur Senior', email: 'm.randrianarison@ministere.gov.mg', phone: '+261 20 22 345 46' },
        ],
      },
      {
        nom_service: 'Service Infrastructure',
        description: 'Gestion infrastructure réseau et serveurs',
        responsable: 'M. RALISON Thierry',
        responsable_email: 't.ralison@ministere.gov.mg',
        localisation: 'Bureau IT-02',
        employees: [
          { im: 'MIN.013', CIN: '301234567892', nom: 'RALISON', prenom: 'Thierry', sexe: 'masculin', fonction: 'Administrateur Système', email: 't.ralison@ministere.gov.mg', phone: '+261 20 22 345 47' },
        ],
      },
      {
        nom_service: 'Service Support Utilisateur',
        description: 'Support technique aux utilisateurs',
        responsable: 'Mme RAHARISOA Noro',
        responsable_email: 'n.raharisoa@ministere.gov.mg',
        localisation: 'Bâtiment IT-03',
        employees: [
          { im: 'MIN.014', CIN: '301234567893', nom: 'RAHARISOA', prenom: 'Noro', sexe: 'féminin', fonction: 'Responsable Support', email: 'n.raharisoa@ministere.gov.mg', phone: '+261 20 22 345 48' },
          { im: 'MIN.015', CIN: '301234567894', nom: 'RAZANAMPARANY', prenom: 'Ravo', sexe: 'masculin', fonction: 'Technicien Support', email: 'r.razanamarany@ministere.gov.mg', phone: '+261 20 22 345 49' },
        ],
      },
    ],
  },
  {
    nom_direction: 'Direction Financière',
    abreviation: 'DF',
    description: 'Direction en charge de la gestion financière et budgétaire',
    directeur: 'Dr. RANDRIAMALALA Miangaly',
    directeur_email: 'm.randriamalala@ministere.gov.mg',
    localisation: 'Bâtiment Finance - 3ème étage',
    services: [
      {
        nom_service: 'Service Budget',
        description: 'Élaboration et suivi budgétaire',
        responsable: 'M. RAZANATSEHENO Patrick',
        responsable_email: 'p.razanatseheno@ministere.gov.mg',
        localisation: 'Bureau F-301',
        employees: [
          { im: 'MIN.016', CIN: '401234567890', nom: 'RAZANATSEHENO', prenom: 'Patrick', sexe: 'masculin', fonction: 'Chef Service Budget', email: 'p.razanatseheno@ministere.gov.mg', phone: '+261 20 22 456 45' },
          { im: 'MIN.017', CIN: '401234567891', nom: 'RASOANAIVO', prenom: 'Fara', sexe: 'féminin', fonction: 'Analyste Budget', email: 'f.rasoanaivo@ministere.gov.mg', phone: '+261 20 22 456 46' },
        ],
      },
      {
        nom_service: 'Service Comptabilité',
        description: 'Comptabilité générale et analytique',
        responsable: 'Mme RAKOTONIRINA Aina',
        responsable_email: 'a.rakotonirina@ministere.gov.mg',
        localisation: 'Bureau F-302',
        employees: [
          { im: 'MIN.018', CIN: '401234567892', nom: 'RAKOTONIRINA', prenom: 'Aina', sexe: 'féminin', fonction: 'Chef Comptable', email: 'a.rakotonirina@ministere.gov.mg', phone: '+261 20 22 456 47' },
          { im: 'MIN.019', CIN: '401234567893', nom: 'ANDRIANTSOA', prenom: 'Hasina', sexe: 'masculin', fonction: 'Comptable Adjoint', email: 'h.andriantsoa@ministere.gov.mg', phone: '+261 20 22 456 48' },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Authentification Content API (JWT) pour l'espace Demandeur
//
// - crée les rôles métier manquants (demandeur, depositaire, ...) ;
// - accorde à ces rôles (et au rôle « authenticated ») les permissions
//   nécessaires aux demandes : find / findOne / create / update
//   (la suppression et la validation restent réservées aux responsables) ;
// - crée un compte de démonstration Demandeur connectable via /api/auth/local.
// ---------------------------------------------------------------------------
const APP_ROLES = [
  {
    type: 'demandeur',
    name: 'Demandeur',
    description:
      'Exprime les besoins en matériel, consulte et suit ses demandes (aucun droit de validation ni de signature).',
  },
  {
    type: 'depositaire',
    name: 'Dépositaire par service',
    description: 'Dépositaire du service : réceptionne, vérifie et valide les entrées (validation Dépositaire par service).',
  },
  {
    type: 'magasinier',
    name: 'Magasinier',
    description: 'Contrôle le matériel au magasin et suit les sorties.',
  },
  {
    type: 'logistique',
    name: 'Chef logistique',
    description: "Supervise l'approvisionnement et les sorties.",
  },
  {
    type: 'comptable',
    name: 'Comptable',
    description: 'Audite le journal de comptabilité matière et produit les rapports.',
  },
];

// Rôle réel de l'utilisateur connecté (GET /api/session/role). Accordé à TOUS
// les rôles métiers + au rôle `authenticated` : c'est la seule donnée dont
// l'interface a besoin pour ne plus afficher une identité codé en dur qui
// contredirait le jeton. Sans elle, la route répond 403 et le frontend retombe
// sur son repli de démonstration.
//*
// ⚠️ Le périmètre d'une route Content API est construit par Strapi à partir
// du NOM DU DOSSIER de l'API, pas de l'uid du content type
// (`createRouteScopeGenerator('api:' + apiName)`) : le dossier doit donc
// s'appeler `session-role` pour que l'action soit bien
// `api::session-role.session-role.role`. Un dossier `session` produirait
// `api::session.session-role.role` — et un 403 pour tout le monde.
// */
const SESSION_ROLE_ACTION = 'api::session-role.session-role.role';

const DEMAND_ACTIONS = [
  'api::demande.demande.find',
  'api::demande.demande.findOne',
  'api::demande.demande.create',
  'api::demande.demande.update',
  'plugin::users-permissions.user.me',
  SESSION_ROLE_ACTION,
];

// ---------------------------------------------------------------------------
// Entrées : permissions des endpoints de la validation à 3 signatures.
// La signature proprement dite est de toute façon contrôlée par rôle dans le
// contrôleur (un Demandeur ne peut jamais signer) ; ici on accorde seulement
// l'accès aux routes custom et à la lecture des fournisseurs / matériaux.
// ---------------------------------------------------------------------------
const ENTREE_SIGN_ACTIONS = [
  // Lecture des entrées : find/findOne sont désormais authentifiés (routes
  // déclarées sans `auth: false` pour que le sanitizer préserve les
  // relations lignes/fournisseur) -> il faut accorder la permission.
  'api::entree.entree.find',
  'api::entree.entree.findOne',
  // Lecture des lignes : le sanitizer Content-API ne peuplerait la relation
  // `lignes` que si le rôle peut lire le content-type cible.
  'api::entree-ligne.entree-ligne.find',
  'api::entree-ligne.entree-ligne.findOne',
  'api::entree.entree.createComplete',
  'api::entree.entree.sign',
  'api::entree.entree.reject',
  'api::fournisseur.fournisseur.find',
  'api::fournisseur.fournisseur.findOne',
  'api::material.material.find',
  'api::material.material.findOne',
  // Saisie d'une entrée : quand l'utilisateur déclare « c'est un nouvel
  // article », la fiche material est créée SUR-LE-CHAMP depuis le frontend
  // (POST /api/materials) — sinon la ligne resterait en désignation libre.
  // Jamais automatique : l'appel n'a lieu qu'après confirmation explicite.
  'api::material.material.create',
  'api::category.category.find',
  'api::direction.direction.find',
  'api::service.service.find',
  'api::mouvement.mouvement.find',
];

// ---------------------------------------------------------------------------
// Affectations : permissions des endpoints de la validation à 4 signatures.
// La signature proprement dite est contrôlée par rôle dans le contrôleur
// (1/4 réservée au créateur, 2/4 dépositaire, 3/4 magasinier, 4/4 logistique).
// ---------------------------------------------------------------------------
const AFFECTATION_ACTIONS = [
  'api::affectation.affectation.createComplete',
  'api::affectation.affectation.sign',
];

// Rôles habilités à créer / signer / rejeter une entrée (jamais le Demandeur).
const ROLES_SIGNATAIRES = ['depositaire', 'magasinier', 'logistique', 'comptable'];

// ---------------------------------------------------------------------------
// Téléversement des photos des pièces jointes d'une entrée.
// `POST /api/upload` est la route content-api du plugin upload ; l'uid de la
// permission est dérivé du NOM DU CONTRÔLEUR, pas du content-type : le
// contrôleur s'appelle `content-api` et son action `upload`, d'où
// `plugin::upload.content-api.upload` (`registerAPIsActions` de @strapi/core
// construit `plugin::<nom>.content-api.<action>`).
// `plugin::upload.content-api.find` est nécessaire en plus pour que le
// sanitizer puisse peupler le champ média `photos` à la relecture des lignes.
// ATTENTION : `syncPermissions()` du plugin users-permissions SUPPRIME au boot
// toute permission absente de la liste des actions des contrôleurs ; il faut
// donc les créer ici (dans le bootstrap), toute insertion manuelle en base
// disparaît au redémarrage.
// ---------------------------------------------------------------------------
const UPLOAD_ACTIONS = [
  'plugin::upload.content-api.upload',
  'plugin::upload.content-api.find',
];

// ---------------------------------------------------------------------------
// Reddition de compte : lecture seule des rapports (recapitulation, etat
// appreciatif, inventaire, grand-livre, bordereau) + CRUD de l'ouverture
// d'exercice (stock initial par nomenclature). Réservé aux profils
// dépositaire / comptable / logistique (contrôle aussi dans le contrôleur
// via utils/rapportsGuard.js).
// ---------------------------------------------------------------------------
const RAPPORT_ACTIONS = [
  'api::rapport.rapport.recapitulation',
  'api::rapport.rapport.recapitulations',
  'api::rapport.rapport.etatAppreciatif',
  'api::rapport.rapport.inventaire',
  'api::rapport.rapport.grandLivre',
  'api::rapport.rapport.bordereau',
];

const OUVERTURE_ACTIONS = [
  'api::ouverture-exercice.ouverture-exercice.find',
  'api::ouverture-exercice.ouverture-exercice.findOne',
  'api::ouverture-exercice.ouverture-exercice.create',
  'api::ouverture-exercice.ouverture-exercice.update',
  'api::ouverture-exercice.ouverture-exercice.delete',
];

const ROLES_RAPPORTS = ['depositaire', 'comptable', 'logistique'];
const ROLES_SORTIE_DISTRIBUTION = ['depositaire', 'magasinier', 'logistique', 'comptable'];

// ---------------------------------------------------------------------------
// Demandeur : il peut ENREGISTRER une entrée (elle démarre « En attente »,
// 0/3 signatures) et consulter les données de référence du formulaire,
// mais JAMAIS signer ni rejeter (contrôlé aussi dans le contrôleur).
//
// La lecture des entrées (`find` / `findOne`) lui est accordée pour qu'il
// puisse suivre la validation de SES entrées — sans quoi l'écran « Arrivée
// matériel » (qui recharge l'état au montage) répond 403. Ces routes étant
// volontairement authentifiées (le sanitizer Content-API ne peuplerait
// `lignes` / `fournisseur` que si l'utilisateur est résolu), l'absence de
// permission se traduisait par un 403 pour tout profil Demandeur.
// L'ISOLATION EST ASSURÉE CÔTÉ CONTRÔLEUR : `entree.find` / `entree.findOne`
// sont surchargés pour ne renvoyer que les entrées créées par l'utilisateur
// connecté (voir api/entree/controllers/entree.js).
// ---------------------------------------------------------------------------
const DEMANDEUR_ENTREE_ACTIONS = [
  'api::entree.entree.createComplete',
  'api::entree.entree.find',
  'api::entree.entree.findOne',
  // Lecture des lignes : sans ces permissions le sanitizer ne peuplerait pas
  // la relation `lignes` (les entrées seraient affichées sans articles).
  'api::entree-ligne.entree-ligne.find',
  'api::entree-ligne.entree-ligne.findOne',
  'api::fournisseur.fournisseur.find',
  'api::fournisseur.fournisseur.findOne',
  'api::material.material.find',
  'api::material.material.findOne',
  'api::category.category.find',
  'api::direction.direction.find',
  'api::service.service.find',
  'api::mouvement.mouvement.find',
];

// ---------------------------------------------------------------------------
// Sorties : permissions de LECTURE du circuit (étape 1 : lecture seule).
//
// Les routes find / findOne de /api/sorties sont désormais AUTHENTIFIÉES
// (elles ne déclarent plus `auth: false`) : sans permission, tout profil
// recevrait 403. Les listes des ENTRÉES (ENTREE_SIGN_ACTIONS /
// DEMANDEUR_ENTREE_ACTIONS) restent inchangées — voici leur équivalent
// dédié aux sorties.
//
// Les lectures de `sortie-ligne`, `material`, `category`, `direction`,
// `service` et `demande` sont nécessaires pour que le sanitizer Content-API
// conserve les relations de la réponse (`lignes`, `direction`, `service`,
// `demande`) demandées par fetchSorties(). Seules les permissions MANQUANTES
// sont réellement créées : l'accordement est recalculé à chaque exécution du
// bloc (voir 2septies) pour ne jamais dupliquer une permission déjà ouverte
// par DEMAND_ACTIONS ou les listes d'entrées.
//
// ⚠️ `demande.demandeur` N'EST PAS ouvert ici : le sanitizer ne conserverait
// ce champ (utilisateur) que si le rôle pouvait lire
// `plugin::users-permissions.user`, ce qui ouvrirait la liste de TOUS les
// utilisateurs. La relation `demandeur` sera donc retirée des réponses —
// signalé dans le rapport d'étape. Le filtrage « demandeur », lui, ne passe
// PAS par le sanitizer (il est appliqué via le document service).
// ---------------------------------------------------------------------------
const SORTIE_READ_ACTIONS = [
  'api::sortie.sortie.find',
  'api::sortie.sortie.findOne',
  // Distribution (GET /sorties/distributions) : la liste des sorties dont le
  // stock est DÉJÀ débité (statut validee / sortie_effectuee) qui alimente
  // l'écran Distribution. Sans cette action, la route existante renvoyait
  // 403 à TOUS les rôles (route morte) — accordée en lecture seule, comme le
  // reste de la liste.
  'api::sortie.sortie.findDistributions',
  // Lecture des lignes : sans elles le sanitizer ne peuplerait pas `lignes`
  // (les sorties seraient affichées sans articles).
  'api::sortie-ligne.sortie-ligne.find',
  'api::sortie-ligne.sortie-ligne.findOne',
  // Données de référence peuplées par fetchSorties().
  'api::material.material.find',
  'api::material.material.findOne',
  'api::category.category.find',
  'api::direction.direction.find',
  'api::service.service.find',
  'api::demande.demande.find',
  'api::demande.demande.findOne',
];

// Tous les profils métier lisent aujourd'hui les sorties (les routes étaient
// publiques) : le Demandeur, lui, ne voit plus que SES sorties — isolation
// assuré côté contrôleur (api/sortie/controllers/sortie.js).
const ROLES_LECTURE_SORTIE = [
  'demandeur',
  'depositaire',
  'magasinier',
  'logistique',
  'comptable',
];

// ---------------------------------------------------------------------------
// Organigramme (lecture seule) : employés.
//
// L'écran Distribution (formulaire « Distribuer un équipement ») doit
// afficher les VRAIS employés de la base pour choisir le bénéficiaire, et
// l'écran Départements peuple `services.employees` via
// GET /api/directions?populate[services][populate]=employees. Le sanitizer
// Content-API retire ce peuplement tant que le rôle ne possède pas
// `api::employee.employee.find` : sans cette permission, la liste des
// employés était vide (403) pour tous les profils métier.
// Lecture STRICTE : aucune action d'écriture sur les employés.
// ---------------------------------------------------------------------------
const ORGANIGRAMME_READ_ACTIONS = [
  'api::employee.employee.find',
  'api::employee.employee.findOne',
];

// ---------------------------------------------------------------------------
// Sorties (étape 2) : création d'un ordre de sortie via POST
// /api/sorties/create-complete.
//
// Le contrôleur le restreint SEUL au profil « dépositaire » (getRoleCode).
// L'accordement ne concerne donc QUE les rôles qui voyagent sur les routes de
// signature des entrées (qui sont eux-mêmes les seuls à se connecter sur ces
// opérations) : dépositaire, magasinier, logistique et comptable. Le Demandeur
// ne reçoit JAMAIS `createComplete`. Les listes d'ENTRÉES (ENTREE_SIGN_ACTIONS
// / DEMANDEUR_ENTREE_ACTIONS) sont conservées telles quelles : voici leur
// équivalent dédié aux sorties.
//
// `createComplete` est ajouté aux rôles qui possèdent déjà l'accès aux routes
// de signature (ENTREE_SIGN_ACTIONS) — les mêmes, pas de nouveau périmètre.
// ---------------------------------------------------------------------------
const SORTIE_CREATE_ACTIONS = [
  'api::sortie.sortie.createComplete',
];

// ---------------------------------------------------------------------------
// Sorties (étape 3) : signatures (magasinier, dépositaire) et rejet —
// POST /api/sorties/:documentId/sign et /api/sorties/:documentId/reject.
//
// Accordées UNIQUEMENT aux rôles du circuit de signature : magasinier,
// dépositaire et logistique — ni le Demandeur (qui n'a jamais le droit de
// valider ni de rejeter), ni le Comptable. La signature proprement dite est
// de toute façon contrôlée par rôle dans le contrôleur ; ici on n'accorde
// que l'accès aux routes. À l'étape 4, la signature logistique et la baisse
// atomique du stock sont en place — sans toucher aux listes d'ENTRÉES.
// ---------------------------------------------------------------------------
const SORTIE_SIGN_ACTIONS = [
  'api::sortie.sortie.sign',
  'api::sortie.sortie.reject',
];

const ROLES_SIGNATURE_SORTIE = ['magasinier', 'depositaire', 'logistique'];

// ---------------------------------------------------------------------------
// Sorties (étape 5) : remise au détenteur —
// POST /api/sorties/:documentId/remise.
//
// Accordée UNIQUEMENT aux rôles magasinier et dépositaire — ni le
// Demandeur, ni le Comptable, ni le logistique. La remise proprement dite est
// contrôlée par rôle dans le contrôleur ; ici on n'accorde que l'accès à la route.
// ---------------------------------------------------------------------------
const SORTIE_REMISE_ACTIONS = [
  'api::sortie.sortie.remise',
];

const ROLES_REMISE_SORTIE = ['magasinier', 'depositaire'];


const DEMO_DEMANDEUR = {
  username: 'Randriamampionona Tolotra',
  email: 'tolotra.randria@mtefop.gov.mg',
  password: 'demandeur123',
  provider: 'local',
  confirmed: true,
  blocked: false,
  department: 'DRH - Service du Personnel',
  fonction: 'Chargé du personnel',
};

// Comptes de démonstration des signataires de la validation à 3 signatures
const DEMO_SIGNATAIRES = [
  {
    username: 'Rakotomalala Hery',
    email: 'hery.rakoto@mtefop.gov.mg',
    password: 'depositaire123',
    department: 'DAF - Service Comptabilité Matière',
    fonction: 'Dépositaire par service',
    roleType: 'depositaire',
  },
  {
    username: 'Andriamampianina Fara',
    email: 'fara.andriam@mtefop.gov.mg',
    password: 'magasinier123',
    department: 'DAF - Magasin & Entrepôt',
    fonction: 'Magasinier (Chef de service 1)',
    roleType: 'magasinier',
  },
  {
    username: 'Razafindrakoto Tojo',
    email: 'tojo.razaf@mtefop.gov.mg',
    password: 'logistique123',
    department: 'DAF - Direction Logistique',
    fonction: 'Chef logistique (Chef de service 2)',
    roleType: 'logistique',
  },
];

async function ensureAuthSetup(strapi) {
  const roleQuery = strapi.db.query('plugin::users-permissions.role');
  const permQuery = strapi.db.query('plugin::users-permissions.permission');
  const userQuery = strapi.db.query('plugin::users-permissions.user');

  // 1) Rôles métier
  const roles = {};
  for (const def of APP_ROLES) {
    let role = await roleQuery.findOne({ where: { type: def.type } });
    if (!role) {
      role = await roleQuery.create({ data: def });
      strapi.log.info(`[auth] Rôle « ${def.type} » créé.`);
    }
    roles[def.type] = role;
  }
  const authenticated = await roleQuery.findOne({ where: { type: 'authenticated' } });

  // 2) Permissions Content API (une ligne = une permission accordée)
  const targetRoles = [
    ...Object.values(roles),
    ...(authenticated ? [authenticated] : []),
  ];
  const existing = await permQuery.findMany({ populate: ['role'] });
  const accordees = new Set(
    existing.map(
      (p) => `${p.role ? p.role.type || p.role.code : ''}:${p.action}`
    )
  );
  for (const role of targetRoles) {
    for (const action of DEMAND_ACTIONS) {
      const cle = `${role.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: role.id } });
      accordees.add(cle);
    }
  }

  // 2bis) Permissions « Entrées » : routes custom + lecture des données
  // de référence, accordées uniquement aux rôles signataires.
  for (const type of ROLES_SIGNATAIRES) {
    const role = roles[type];
    if (!role) continue;
    for (const action of ENTREE_SIGN_ACTIONS) {
      const cle = `${role.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: role.id } });
      accordees.add(cle);
    }
  }
  // 2ter) Le Demandeur peut enregistrer une entrée (statut « En attente »
  // initial, 0/3 signatures) mais ne reçoit JAMAIS les permissions
  // `sign` ni `reject` : la validation reste réservée aux responsables.
  const roleDemandeur = roles['demandeur'];
  if (roleDemandeur) {
    for (const action of DEMANDEUR_ENTREE_ACTIONS) {
      const cle = `${roleDemandeur.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: roleDemandeur.id } });
      accordees.add(cle);
    }
  }
  // 2quater) Permissions « Affectations » : routes custom de la validation à
  // 4 signatures, accordées aux rôles signataires. Le Demandeur peut créer
  // une affectation (dont il sera le Responsable du transfert 1/4) mais ne
  // reçoit JAMAIS `sign` : les validations responsables sont contrôlées dans
  // le contrôleur (un Demandeur ne signe que la 1/4 sur SA création).
  const DEMANDEUR_AFFECTATION_ACTIONS = [
    'api::affectation.affectation.createComplete',
  ];
  for (const type of ROLES_SIGNATAIRES) {
    const role = roles[type];
    if (!role) continue;
    for (const action of AFFECTATION_ACTIONS) {
      const cle = `${role.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: role.id } });
      accordees.add(cle);
    }
  }
  if (roleDemandeur) {
    for (const action of DEMANDEUR_AFFECTATION_ACTIONS) {
      const cle = `${roleDemandeur.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: roleDemandeur.id } });
      accordees.add(cle);
    }
  }

  // 2quinquies) Permissions « Téléversement des photos » :POST /api/upload
  // (pièces jointes des lignes d'entrée) et lecture des fichiers, accordées
  // aux rôles signataires — sans quoi la certification magasinier se termine
  // par un 403 et les photos ne sont jamais enregistrées.
  for (const type of ROLES_SIGNATAIRES) {
    const role = roles[type];
    if (!role) continue;
    for (const action of UPLOAD_ACTIONS) {
      const cle = `${role.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: role.id } });
      accordees.add(cle);
    }
  }
  if (authenticated) {
    for (const action of UPLOAD_ACTIONS) {
      const cle = `authenticated:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: authenticated.id } });
      accordees.add(cle);
    }
  }
  // Lecture SEULE des fichiers téléversés pour TOUS les rôles métier (y
  // compris Demandeur) : sans `plugin::upload.content-api.find`, le sanitizer
  // Content-API retire le champ media `photos` des réponses et la photo de
  // référence d'une fiche matériel n'apparaît jamais (Équipements, Fiche de
  // stock) pour les profils non signataires. L'écriture (`content-api.upload`)
  // reste réservée ci-dessus aux rôles habilités.
  for (const def of APP_ROLES) {
    const role = roles[def.type];
    if (!role) continue;
    const action = 'plugin::upload.content-api.find';
    const cle = `${def.type}:${action}`;
    if (accordees.has(cle)) continue;
    await permQuery.create({ data: { action, role: role.id } });
    accordees.add(cle);
  }

  // 2sexies) Permissions « Reddition de compte » : rapports (lecture) et
  // ouverture d'exercice (CRUD du stock initial), accordées aux rôles
  // dépositaire / comptable / logistique. Le Demandeur n'y a jamais accès.
  for (const type of ROLES_RAPPORTS) {
    const role = roles[type];
    if (!role) continue;
    for (const action of [...RAPPORT_ACTIONS, ...OUVERTURE_ACTIONS]) {
      const cle = `${role.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: role.id } });
      accordees.add(cle);
    }
  }
  if (authenticated) {
    for (const action of [...RAPPORT_ACTIONS, ...OUVERTURE_ACTIONS]) {
      const cle = `authenticated:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: authenticated.id } });
      accordees.add(cle);
    }
  }

  // L'admin (rôle authenticated créé par Strapi) garde un accès complet via
  // l'interface d'administration ; on lui accorde aussi les routes custom.
  if (authenticated) {
    for (const action of [...ENTREE_SIGN_ACTIONS, ...AFFECTATION_ACTIONS]) {
      const cle = `authenticated:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: authenticated.id } });
      accordees.add(cle);
    }
  }

  // 2septies) Permissions « Sorties » (étape 1 : LECTURE SEULE). Accordées
  // à tous les rôles métier — dont le Demandeur, dont la vue est restreinte à
  // SES sorties côté contrôleur (api/sortie/controllers/sortie.js). La liste
  // ne contient AUCUNE action d'écriture.
  for (const type of ROLES_LECTURE_SORTIE) {
    const role = roles[type];
    if (!role) continue;
    for (const action of SORTIE_READ_ACTIONS) {
      const cle = `${role.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: role.id } });
      accordees.add(cle);
    }
  }

  // 2septies bis) Permissions « Sorties distributions » (liste de distribution) :
  // Accordées aux rôles dépositaire, magasinier, logistique et comptable.
  // Le Demandeur n'a pas accès (retourne 403, géré dans le contrôleur).
  for (const type of ROLES_SORTIE_DISTRIBUTION) {
    const role = roles[type];
    if (!role) continue;
    for (const action of ['api::sortie.sortie.findDistributions']) {
      const cle = `${role.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: role.id } });
      accordees.add(cle);
    }
  }

  // 2septies bis) Organigramme en LECTURE (employés) : mêmes rôles que la
  // lecture des sorties + le rôle « authenticated ». Indispensable au
  // formulaire de distribution (choix du bénéficiaire réel) et au peuplement
  // `services.employees` de l'écran Départements.
  for (const type of ROLES_LECTURE_SORTIE) {
    const role = roles[type];
    if (!role) continue;
    for (const action of ORGANIGRAMME_READ_ACTIONS) {
      const cle = `${role.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: role.id } });
      accordees.add(cle);
    }
  }
  if (authenticated) {
    for (const action of ORGANIGRAMME_READ_ACTIONS) {
      const cle = `authenticated:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: authenticated.id } });
      accordees.add(cle);
    }
  }

  // 2octies) Création d'un ordre de sortie (étape 2) : les rôles qui
  // possèdent déjà l'accès aux routes de signature des entrées — même
  // périmètre, aucune nouvelle liste de rôles.
  for (const type of ROLES_SIGNATAIRES) {
    const role = roles[type];
    if (!role) continue;
    for (const action of SORTIE_CREATE_ACTIONS) {
      const cle = `${role.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: role.id } });
      accordees.add(cle);
    }
  }

  // 2nonies) Signatures et rejet d'une sortie (étape 3) : accordées
  // UNIQUEMENT aux rôles magasinier / dépositaire / logistique — ni le
  // Demandeur, ni le Comptable (le Demandeur ne peut jamais signer ni
  // rejeter ; c'est en outre vérifié dans le contrôleur).
  for (const type of ROLES_SIGNATURE_SORTIE) {
    const role = roles[type];
    if (!role) continue;
    for (const action of SORTIE_SIGN_ACTIONS) {
      const cle = `${role.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: role.id } });
      accordees.add(cle);
    }
  }

  // 2douzaines) Remise d'une sortie (étape 5) : accordée
  // UNIQUEMENT aux rôles magasinier / dépositaire — ni le Demandeur,
  // ni le Comptable, ni le logistique (le Demandeur ne peut jamais effectuer
  // de remise ; c'est en outre vérifié dans le contrôleur).
  for (const type of ROLES_REMISE_SORTIE) {
    const role = roles[type];
    if (!role) continue;
    for (const action of SORTIE_REMISE_ACTIONS) {
      const cle = `${role.type}:${action}`;
      if (accordees.has(cle)) continue;
      await permQuery.create({ data: { action, role: role.id } });
      accordees.add(cle);
    }
  }

  // 3) Comptes de démonstration (connexion JWT /api/auth/local) :
  //    Demandeur + les 3 signataires de la validation à 3 signatures.
  const demoUsers = [
    { ...DEMO_DEMANDEUR, roleType: 'demandeur' },
    ...DEMO_SIGNATAIRES,
  ];
  for (const demo of demoUsers) {
    const existingUser = await userQuery.findOne({
      where: { email: demo.email },
    });
    if (existingUser) continue;
    const { roleType, ...data } = demo;
    await strapi
      .plugin('users-permissions')
      .service('user')
      .add({ ...data, provider: 'local', confirmed: true, blocked: false, role: roles[roleType].id });
    strapi.log.info(`[auth] Compte ${roleType} créé : ${demo.email} / ${demo.password}`);
  }
}

async function seedOrganisation(strapi) {
  const existing = await strapi
    .documents('api::direction.direction')
    .findMany({ limit: 1 });

  if (existing.length > 0) {
    strapi.log.info('[seed] Directions déjà présentes : seed ignoré.');
    return;
  }

  strapi.log.info('[seed] Base vide -> insertion des directions/services/employés...');
  let nbServices = 0;
  let nbEmployees = 0;

  for (const dir of SEED_DIRECTIONS) {
    const direction = await strapi.documents('api::direction.direction').create({
      data: {
        nom_direction: dir.nom_direction,
        abreviation: dir.abreviation,
        description: dir.description,
        directeur: dir.directeur,
        directeur_email: dir.directeur_email,
        localisation: dir.localisation,
      },
      status: 'published',
    });

    for (const svc of dir.services) {
      const service = await strapi.documents('api::service.service').create({
        data: {
          nom_service: svc.nom_service,
          description: svc.description,
          responsable: svc.responsable,
          responsable_email: svc.responsable_email,
          localisation: svc.localisation,
          direction: direction.documentId,
        },
        status: 'published',
      });
      nbServices += 1;

      for (const emp of svc.employees) {
        await strapi.documents('api::employee.employee').create({
          data: {
            ...emp,
            corps: 'Fonctionnaire',
            statut: 'actif',
            service: service.documentId,
          },
          status: 'published',
        });
        nbEmployees += 1;
      }
    }
  }

  strapi.log.info(
    `[seed] Terminé : ${SEED_DIRECTIONS.length} directions, ${nbServices} services, ${nbEmployees} employés.`
  );
}

const { seedReddition } = require('./utils/seedReddition');

// Simple materials for distribution functionality
const SEED_MATERIELS = [
  { designation: 'Tapis de souris', nomenclature: '03', valeur_unitaire: 5000, quantite_stock: 10, statut: 'en_stock' },
  { designation: 'Clavier compact', nomenclature: '03', valeur_unitaire: 25000, quantite_stock: 5, statut: 'en_stock' },
  { designation: 'Casque audio', nomenclature: '03', valeur_unitaire: 15000, quantite_stock: 8, statut: 'en_stock' },
  { designation: 'Webcam HD', nomenclature: '03', valeur_unitaire: 30000, quantite_stock: 12, statut: 'en_stock' },
];

async function seedMaterials(strapi) {
  const existing = await strapi
    .documents('api::material.material')
    .count();

  if (existing > 0) {
    strapi.log.info('[seed-materiels] Matériels déjà présents : seed ignoré.');
    return;
  }

  strapi.log.info('[seed-materiels] Insertion des matériels de base...');
  let count = 0;

  for (const materielData of SEED_MATERIELS) {
    await strapi.documents('api::material.material').create({
      data: materielData,
      status: 'published',
    });
    count++;
  }

  strapi.log.info(`[seed-materiels] Terminé : ${count} matériels insérés.`);
}

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // [Supprimé] Une tentative de réinjecter la relation « role » dans la
    // réponse de POST /api/auth/local en enveloppant
    // `userService.sanitizeUser` : SANS EFFET. Le contrôleur `auth` du plugin
    // users-permissions utilise un `sanitizeUser` LOCAL (closure) qui appelle
    // directement `strapi.contentAPI.sanitize.output` — la méthode du service
    // n'est jamais appelée sur ce chemin (vérifié : la réponse de connexion
    // ne contenait toujours pas `role`, ni sur GET /api/users/me).
    // Le rôle réel est désormais servi par GET /api/session/role, calculé en
    // base : voir api/session-role/controllers/session-role.js et
    // SESSION_ROLE_ACTION (déclaré plus haut dans ce fichier).
    try {
      await ensureAuthSetup(strapi);
    } catch (err) {
      strapi.log.error(`[auth] Échec de la configuration d'authentification : ${err.message}`);
    }
    try {
      await seedOrganisation(strapi);
    } catch (err) {
      strapi.log.error(`[seed] Échec du seed : ${err.message}`);
    }
    try {
      await seedReddition(strapi);
    } catch (err) {
      strapi.log.error(`[seed-reddition] Échec : ${err.message}`);
    }
    try {
      await seedMaterials(strapi);
    } catch (err) {
      strapi.log.error(`[seed-materiels] Échec : ${err.message}`);
    }
  },
};
