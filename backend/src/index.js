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
          { im: 'MIN.007', CIN: '101234567896', nom: 'RAKOTONIRINA', prenom: 'Lova', sexe: 'masculin', fonction: 'Technicien Maintenance', email: 'l.rakotonirina@ministere.gov.mg', phone: '+261 20 22 123 51' },
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
        localisation: 'Bureau IT-03',
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

const DEMAND_ACTIONS = [
  'api::demande.demande.find',
  'api::demande.demande.findOne',
  'api::demande.demande.create',
  'api::demande.demande.update',
  'plugin::users-permissions.user.me',
];

// ---------------------------------------------------------------------------
// Entrées : permissions des endpoints de la validation à 3 signatures.
// La signature proprement dite est de toute façon contrôlée par rôle dans le
// contrôleur (un Demandeur ne peut jamais signer) ; ici on accorde seulement
// l'accès aux routes custom et à la lecture des fournisseurs / matériaux.
// ---------------------------------------------------------------------------
const ENTREE_SIGN_ACTIONS = [
  'api::entree.entree.createComplete',
  'api::entree.entree.sign',
  'api::entree.entree.reject',
  'api::fournisseur.fournisseur.find',
  'api::fournisseur.fournisseur.findOne',
  'api::material.material.find',
  'api::material.material.findOne',
  'api::category.category.find',
  'api::direction.direction.find',
  'api::service.service.find',
  'api::mouvement.mouvement.find',
];

// Rôles habilités à créer / signer / rejeter une entrée (jamais le Demandeur).
const ROLES_SIGNATAIRES = ['depositaire', 'magasinier', 'logistique', 'comptable'];

// ---------------------------------------------------------------------------
// Demandeur : il peut ENREGISTRER une entrée (elle démarre « En attente »,
// 0/3 signatures) et consulter les données de référence du formulaire,
// mais JAMAIS signer ni rejeter (contrôlé aussi dans le contrôleur).
// ---------------------------------------------------------------------------
const DEMANDEUR_ENTREE_ACTIONS = [
  'api::entree.entree.createComplete',
  'api::fournisseur.fournisseur.find',
  'api::fournisseur.fournisseur.findOne',
  'api::material.material.find',
  'api::material.material.findOne',
  'api::category.category.find',
  'api::direction.direction.find',
  'api::service.service.find',
  'api::mouvement.mouvement.find',
];

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
  const granted = new Set(
    existing.map(
      (p) => `${p.role ? p.role.type || p.role.code : ''}:${p.action}`
    )
  );
  for (const role of targetRoles) {
    for (const action of DEMAND_ACTIONS) {
      if (granted.has(`${role.type}:${action}`)) continue;
      await permQuery.create({ data: { action, role: role.id } });
    }
  }

  // 2bis) Permissions « Entrées » : routes custom + lecture des données
  // de référence, accordées uniquement aux rôles signataires.
  for (const type of ROLES_SIGNATAIRES) {
    const role = roles[type];
    if (!role) continue;
    for (const action of ENTREE_SIGN_ACTIONS) {
      if (granted.has(`${role.type}:${action}`)) continue;
      await permQuery.create({ data: { action, role: role.id } });
    }
  }
  // 2ter) Le Demandeur peut enregistrer une entrée (statut « En attente »
  // initial, 0/3 signatures) mais ne reçoit JAMAIS les permissions
  // `sign` ni `reject` : la validation reste réservée aux responsables.
  const roleDemandeur = roles['demandeur'];
  if (roleDemandeur) {
    for (const action of DEMANDEUR_ENTREE_ACTIONS) {
      if (granted.has(`${roleDemandeur.type}:${action}`)) continue;
      await permQuery.create({ data: { action, role: roleDemandeur.id } });
    }
  }
  // L'admin (rôle authenticated créé par Strapi) garde un accès complet via
  // l'interface d'administration ; on lui accorde aussi les routes custom.
  if (authenticated) {
    for (const action of ENTREE_SIGN_ACTIONS) {
      if (granted.has(`authenticated:${action}`)) continue;
      await permQuery.create({ data: { action, role: authenticated.id } });
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
  },
};
