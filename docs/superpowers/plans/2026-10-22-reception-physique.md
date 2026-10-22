# Phase A — Audit et proposition : Réception physique du matériel

## En-tête (convention superpowers:writing-plans)

> **Pour les travailleurs agentiques :** REQUIRED SUB-SKILL : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour implémenter ce plan tâche par tâche. Les étapes utilisent la syntaxe de case à cocher (`- [ ]`) pour le suivi.

**Objectif :** Concevoir et spécifier l'ajout d'une étape de "Réception physique du matériel" dans le workflow de sortie existant, où le Dépositaire comptable de la direction destinataire réceptionne physiquement le matériel après que le workflow à 3 signatures est terminé.

**Architecture :** Backend Strapi 5 avec content-types dédiés (reception, reception-ligne, anomalie, journal-action), réutilisation du pattern outbox/SSE existant pour les notifications, transaction Strapi pour l'atomicité, contrôle d'accès par rôle via getRoleCode, verrou optimiste (champ `version`) pour la concurrence, clé d'idempotence pour les soumissions, journal d'actions immuable pour les anomalies. Frontend React/Vite avec composants dédiés à la réception et aux anomalies.

**Stack technique :** Strapi 5, PostgreSQL, React/Vite, node --test (backend), vitest (frontend).

**Spécification :** Ce document est la spécification Phase A. Il sera suivi d'une Phase B d'implémentation après approbation explicite de l'utilisateur.

## Contraintes globales

- Aucune modification de code avant approbation explicite de l'utilisateur (Phase A uniquement : audit + proposition).
- Réutiliser les content-types Strapi 5 existants ; ne pas créer de système de notification parallèle (outbox/SSE existant).
- id et documentId sont distincts en Strapi 5 ; ne pas les confondre.
- dateDuJour utilise le fuseau Madagascar (Indian/Antananarivo), jamais UTC.
- Le stock est débité UNIQUEMENT à signerLogistique ; la réception ne doit PAS toucher le stock.
- Tests avec node --test (backend, strapi simulé via require.cache) et vitest (frontend).
- Contrôle d'accès via getRoleCode qui lit user.role.code ou user.role.type.
- Permissions définies dans backend/src/index.js via des listes d'actions (ex: SORTIE_REMISE_ACTIONS).
- **Plusieurs réceptions partielles peuvent être liées à une même sortie** ; le reliquat se calcule de façon **cumulée, article par article**, sur l'ensemble des réceptions de la sortie.

## Revue de focus

Les six classes d'entrées ou modes de échec les plus susceptibles de poser problème :

1. Tentative de réception sur une sortie non validée (statut != 'validee') → doit être rejeté avec 400.
2. ~~Tentative de double réception sur une même sortie → doit être rejeté (contrainte d'unicité).~~ **[SUPPRIMÉ — plusieurs réceptions partielles sont désormais autorisées par sortie.]**
3. Réception par un utilisateur n'étant pas dépositaire de la direction destinataire → doit être rejeté avec 403.
4. Quantité reçue supérieure à la quantité commandée sur une ligne → doit être rejeté avec 400.
5. Échec de création d'un mouvement de traçage → rollback complet de la transaction.
6. Double soumission ou concurrence sur la création d'une réception ou sur la résolution d'une anomalie → rejet 409 (verrou optimiste + clé d'idempotence).

---

## 1. Contexte et faits vérifiés

### Faits vérifiés (lu dans le codebase)

- **Workflow actuel à 3 signatures** : magasinier (ordre 1) → dépositaire (ordre 2) → logistique (ordre 3). Après la signature logistique : statut='validee', stock_impacte=true, stock débité atomiquement.
- **Étape 5 existante (remise)** : POST /sorties/:documentId/remise, réservée aux rôles magasinier et dépositaire. Passe le statut à 'sortie_effectuee', enregistre detenteur_nom, detenteur_fonction, date_remise. Ne touche PAS au stock. Trace un mouvement.
- **Stock** : débité UNIQUEMENT à signerLogistique (étape 3). Verrou stock_impacte (conditionnel UPDATE false→true) empêche le double débit.
- **Outbox pattern** : table notification_outboxes avec machine à états pending→processing→sent/failed. Revendication atomique via UPDATE sur status='pending'. Contrainte unique sur (sortie, eventType, recipientId). Idempotent.
- **SSE** : backend in-memory stream map (sseRegister/sseBroadcastToUser/sseCount). Frontend EventSource client avec JWT en query param, auto-reconnect après 3s.
- **destinatairesNotifications** : findUtilisateursParRoleEtDirection(app, roleCode, directionId) résout les utilisateurs via la relation explicite user→direction (champ direction du schéma users-permissions), jamais sur department.
- **dateDuJour** : fuseau Indian/Antananarivo (Madagascar), jamais UTC. Fonction comparerDates disponible.
- **Strapi 5** : id (numérique) et documentId (string) sont distincts. API document service via strapi.documents(UID).findOne/findMany/create/update.
- **Transactions** : strapi.db.transaction pour opérations atomiques. Knex via trx pour UPDATE conditionnel et décrément atomique de stock.
- **Contrôle d'accès** : getRoleCode lit user.role.code ou user.role.type. guardedCoreController pour protéger les contrôleurs.
- **Bootstrap index.js** : ensureAuthSetup crée rôles/permissions/démo utilisateurs au démarrage. Permissions sont des chaînes d'action (ex: 'api::sortie.sortie.sign').
- **Matériel** : entité material avec quantite_stock. Lignes de sortie (sortie-ligne) liées à une sortie avec quantite, etat, observations.
- **Mouvement** : entité mouvement pour l'audit trail (action, quantite, statut, relations sortie/entree/demande).
- **Tests existants** : backend/tests/sortie-remise.test.js avec node --test, strapi simulé, données en mémoire. Frontend : remiseSortie.test.ts (vitest) et RemiseOrdres.roles.test.tsx.

### Vérification des schémas lus (ajoutée)

- Le schéma `sortie` contient bien une relation `direction` (manyToOne → api::direction.direction).
- Le schéma `users-permissions user` contient bien une relation `direction` (manyToOne → api::direction.direction) et une relation `role`.
- Le service `notification-outbox.js` expose `creerEntrees`, `distribuerNotifications`, `EVENT_TYPE_PAR_ROLE` et une contrainte unique sur (sortie, eventType, recipientId).

---

## 2. Hypothèses

Les hypothèses suivantes ne sont pas toutes vérifiées dans le codebase et doivent être confirmées par l'utilisateur avant la Phase B :

1. **Champ `direction` sur users-permissions** : **CONFIRMÉ** — présent dans le schéma users-permissions (relation manyToOne vers api::direction.direction), utilisé par destinatairesNotifications.js.
2. **Direction de la sortie** : **CONFIRMÉE** — présente dans le schéma sortie (relation manyToOne vers api::direction.direction).
3. **Rôle "depositaire" distinct du "depositaire comptable"** : Le code utilise le code de rôle 'depositaire'. Il est supposé que c'est le dépositaire comptable de la direction destinataire qui réceptionne. **(à confirmer par l'utilisateur)**
4. **Statuts de sortie existants** : Les statuts incluent 'en_preparation', 'validee', 'sortie_effectuee', 'annulee'. Aucun statut 'en_reception' n'existe encore.
5. **Partialité de réception** : Une réception partielle (certaines lignes reçues, d'autres non) est autorisée et ne bloque pas la suite du workflow.
6. **Anomalie bloquante** : Une anomalie ouverte sur une ligne de réception est supposée ne pas bloquer le passage en statut 'complete' des autres lignes (à confirmer).
7. **Frontend routage** : Il est supposé qu'une nouvelle route frontend sera ajoutée pour la réception (ex: /reception).

---

## 3. Recommandations

1. **Créer trois nouveaux content-types Strapi** : reception, reception-ligne, anomalie. Ne pas surcharger le content-type sortie existant.
2. **Lier réception à sortie par relation manyToOne** : une réception référence exactement une sortie. **Plusieurs réceptions peuvent être liées à une même sortie** (suppression de l'unicité reception→sortie). Les réceptions sont ordonnées par date de création.
3. **Réutiliser l'outbox existant** : ajouter des EVENT_TYPE pour la réception (ex: 'reception_complete', 'reception_partielle', 'anomalie_ouverte', 'anomalie_resolue') dans EVENT_TYPE_PAR_ROLE ou une nouvelle map dédiée.
4. **Réutiliser findUtilisateursParRoleEtDirection** pour notifier les dépositaires de la direction destinataire.
5. **Ne pas modifier le contrôleur de remise existant** : la réception et la remise sont deux étapes indépendantes. La réception n'empêche pas la remise et vice versa.
6. **Utiliser dateDuJour pour date_reception** : cohérence avec le fuseau Madagascar déjà utilisé.
7. **Traquer les mouvements de réception** : créer des entités mouvement avec action 'Réception physique' (ou 'Réception partielle' / 'Réception complète') à chaque changement de statut de réception.
8. **Séparer réception partielle et complète** : statut 'partielle' quand au moins un article a un reliquat cumulé > 0, 'complete' quand tous les reliquats cumulés par article sont à 0.
9. **Ajouter un champ `reception_statut` ou relation sur sortie** : pour permettre au frontend de filtrer les sorties en attente de réception.
10. **Documenter l'ordre d'exécution** : réception après validation logistique (statut 'validee'), indépendamment de la remise.
11. **Verrou optimiste et idempotence** : ajouter un champ `version` sur reception et anomalie (rejet 409 en cas de modification concurrente) ; ajouter une clé d'idempotence côté client pour les soumissions de réception et de résolution d'anomalie.
12. **Historique immuable des actions d'anomalie** : journaliser de façon immuable chaque action sur une anomalie (ouverture, prise en charge, résolution, rejet) avec auteur, date, ancien et nouveau statut.

---

## 4. Les 11 points requis

### 4.1 Workflow actuel

**Workflow existant (faits vérifiés) :**

1. Création de la sortie (createComplete) : statut 'en_preparation'.
2. Signature 1 (magasinier) : statut passe à 'preparée' (ou reste en préparation selon implémentation).
3. Signature 2 (dépositaire) : intermédiaire.
4. Signature 3 (logistique) : statut='validee', stock_impacte=true, stock débité atomiquement via transaction, outbox notifie 'ordre_sortie_autorise' (magasinier) et 'demande_aboutie' (demandeur).
5. Étape 5 (remise) : magasinier ou dépositaire enregistre detenteur_nom, detenteur_fonction, date_remise. Statut='sortie_effectuee'. Pas d'impact stock.

**Nouvelle étape : Réception physique**

Insérée après l'étape 4 (validation logistique) et indépendamment de l'étape 5 (remise) :

6. **Réception physique** : le Dépositaire comptable de la direction destinataire réceptionne le matériel. Crée une entité réception liée à la sortie, avec lignes de réception (quantite_recue par ligne), calcul des reliquats, et éventuellement des anomalies. Statut 'en_cours' → 'partielle' ou 'complete'. Pas d'impact sur le stock. **Plusieurs réceptions partielles peuvent être liées à une même sortie.**

### 4.2 Fichiers à réutiliser, créer et modifier

#### À créer (11 fichiers)

| Fichier | Responsabilité |
|---------|---------------|
| backend/src/api/reception/content-types/reception/schema.json | Entité réception : relation sortie, date_reception, statut, depositaire_nom, depositaire_fonction, observations, direction_id, version (verrou optimiste), createdBy, updatedBy |
| backend/src/api/reception-ligne/content-types/reception-ligne/schema.json | Entité ligne de réception : relation réception, materiel, quantite_commandee, quantite_recue, quantite_reliquat (calculé), etat, observations |
| backend/src/api/anomalie/content-types/anomalie/schema.json | Entité anomalie : relation réception (ou ligne), type_anomalie, description, statut (ouverte/en_cours/résolue/rejetee), date_ouverture, date_resolution, responsable, version |
| backend/src/api/journal-action/content-types/journal-action/schema.json | **Nouveau** : journal immuable des actions sur une anomalie (auteur, date, action, ancien_statut, nouveau_statut) |
| backend/src/api/reception/controllers/reception.js | Contrôleur : find, findOne, create, validate (vérifier statut sortie, rôle, doublon, idempotence, version) |
| backend/src/api/reception/routes/reception.js | Routes : GET /receptions, GET /receptions/:documentId, POST /receptions, POST /receptions/:documentId/lignes |
| backend/src/api/anomalie/controllers/anomalie.js | Contrôleur : find, findOne, create, update (changer statut anomalie), resolve |
| backend/src/api/anomalie/routes/anomalie.js | Routes : GET /anomalies, GET /anomalies/:documentId, POST /anomalies, PATCH /anomalies/:documentId/resolve |
| backend/src/api/journal-action/controllers/journal-action.js | Contrôleur : find (lecture seule, immuable) |
| backend/src/api/journal-action/routes/journal-action.js | Routes : GET /journal-actions (lecture seule, immuable) |
| frontend/src/lib/reception.ts | Logique pure : estARecevoir, construirePayloadReception, calculerReliquat, calculerReliquatCumule, dateReceptionLocale |

#### À modifier (6 fichiers)

| Fichier | Modification |
|---------|-------------|
| backend/src/api/sortie/content-types/sortie/schema.json | **Ne pas ajouter de relation reception unique** ; plusieurs réceptions par sortie autorisées. Optionnel : champ reception_count pour filtrer les sorties en attente de réception. |
| backend/src/index.js | Ajouter RECEPTION_ACTIONS (ex: 'api::reception.reception.create', 'api::reception.reception.validate') et ROLES_RECEPTION = ['depositaire']. Ajouter ANOMALIE_ACTIONS. Ajouter JOURNAL_ACTION_ACTIONS. Appeler ensureAuthSetup pour les nouveaux rôles/permissions. |
| backend/src/api/notification-outbox/services/notification-outbox.js | Ajouter EVENT_TYPE pour réception : 'reception_complete', 'reception_partielle', 'anomalie_ouverte', 'anomalie_resolue' |
| frontend/src/lib/api.ts | Ajouter fetchReceptionsPourDepositaire, creerReception, creerAnomalie, mapReception |
| frontend/src/lib/movements.ts | Ajouter STATUT_RECEPTION et libellés d'actions pour la réception dans SORTIE_ACTIONS / nouvelle constante RECEPTION_ACTIONS |
| backend/src/api/anomalie/content-types/anomalie/schema.json | Intégrer le lien vers le journal d'actions immuable (journal-action) |

#### À réutiliser (sans modification)

| Fichier | Usage |
|---------|-------|
| backend/src/api/notification-outbox/services/notification-outbox.js | creerEntrees, distribuerNotifications (réutilisé tel quel) |
| backend/src/lib/notifications.js | sseBroadcastToUser (réutilisé tel quel) |
| backend/src/utils/horloge.js | dateDuJour (réutilisé tel quel) |
| backend/src/utils/destinatairesNotifications.js | findUtilisateursParRoleEtDirection (réutilisé tel quel) |
| backend/src/api/sortie/controllers/sortie.js | Modèle de référence pour le pattern contrôleur + transaction + rollback |
| backend/src/api/sortie/routes/sortie.js | Modèle de référence pour déclaration de routes |
| backend/src/api/mouvement/content-types/mouvement/schema.json | Modèle de référence pour l'audit trail |
| frontend/src/lib/remiseSortie.ts | Modèle de référence pour logique pure (payload, date) |
| frontend/src/components/distribution/RemiseOrdreSortie.tsx | Modèle de référence pour composant avec verrou envoiEnCours |

### 4.3 Modèle de données

#### Entité `reception` (nouveau content-type)

| Attribut | Type | Requis | Description |
|----------|------|--------|-------------|
| sortie | relation manyToOne → api::sortie.sortie | oui | Sortie associée (plusieurs réceptions possibles par sortie) |
| numero | integer | oui | Numéro de réception pour la sortie (1, 2, 3...) |
| date_reception | date | oui | Date de réception physique (défaut : dateDuJour) |
| statut | enum ['en_cours', 'partielle', 'complete', 'annulee'] | oui | Statut de la réception |
| version | integer | oui | Verrou optimiste (incrémenté à chaque modification) |
| depositaire_nom | text | oui | Nom du dépositaire qui réceptionne |
| depositaire_fonction | text | oui | Fonction du dépositaire |
| direction_id | relation → direction | oui | Direction destinataire |
| observations | text | non | Observations générales sur la réception |
| createdBy | relation → user-permissions | oui | Utilisateur qui a créé |
| updatedBy | relation → user-permissions | non | Dernier modificateur |
| createdAt, updatedAt | datetime | auto | Timestamps Strapi |

Contrainte : **aucune unicité sur sortie** (plusieurs réceptions partielles autorisées par sortie). Un champ `version` sert de verrou optimiste.

#### Entité `reception-ligne` (nouveau content-type)

| Attribut | Type | Requis | Description |
|----------|------|--------|-------------|
| reception | relation manyToOne → api::reception.reception | oui | Réception parente |
| sortie_ligne | relation manyToOne → api::sortie-ligne.sortie-ligne | oui | Ligne de sortie d'origine |
| materiel | relation manyToOne → api::material.material | oui | Matériel concerné |
| quantite_commandee | integer | oui | Quantité commandée sur la ligne de sortie |
| quantite_recue | integer | oui | Quantité physiquement reçue |
| quantite_reliquat | integer | calculé | quantite_commandee - quantite_recue |
| etat | enum ['neuf','bon','moyen','defaillant'] | non | État constaté à la réception |
| observations | text | non | Observations sur cette ligne |

Contrainte : quantite_recue <= quantite_commandee.

#### Entité `anomalie` (nouveau content-type)

| Attribut | Type | Requis | Description |
|----------|------|--------|-------------|
| reception | relation manyToOne → api::reception.reception | oui | Réception concernée |
| reception_ligne | relation manyToOne → api::reception-ligne.reception-ligne | non | Ligne concernée (si anomalie sur une ligne spécifique) |
| type_anomalie | enum ['manquant','endommage','non_conforme','autre'] | oui | Type d'anomalie |
| description | text | oui | Description de l'anomalie |
| statut | enum ['ouverte','en_cours','resolue','rejetee'] | oui | Statut de l'anomalie |
| version | integer | oui | Verrou optimiste |
| date_ouverture | date | oui | Date d'ouverture (défaut : dateDuJour) |
| date_resolution | date | non | Date de résolution |
| responsable | relation → user-permissions | non | Utilisateur responsable de la résolution |

#### Entité `journal-action` (nouveau content-type — historique immuable)

| Attribut | Type | Requis | Description |
|----------|------|--------|-------------|
| anomalie | relation manyToOne → api::anomalie.anomalie | oui | Anomalie concernée |
| action | enum ['ouverte','prise_en_charge','resolue','rejetee'] | oui | Action réalisée |
| auteur | relation → user-permissions | oui | Utilisateur qui a réalisé l'action |
| date | date | oui | Date de l'action (défaut : dateDuJour) |
| ancien_statut | enum ['ouverte','en_cours','resolue','rejetee'] | non | Statut avant l'action |
| nouveau_statut | enum ['ouverte','en_cours','resolue','rejetee'] | oui | Statut après l'action |
| commentaire | text | non | Commentaire optionnel |

Contrainte : **immuable** — une fois insérée, une entrée de journal ne peut être ni modifiée ni supprimée.

### 4.4 Statuts et transitions — Réception

```
en_cours  →  partielle  →  complete
   │          │           │
   └──────────┴───────────┴──→ annulee (seulement si en_cours ou partielle)
```

- **en_cours** : réception créée, aucune ligne n'a encore de quantite_recue > 0 (ou toutes les lignes en cours de saisie).
- **partielle** : au moins une ligne a quantite_recue > 0 et au moins une ligne a quantite_reliquat > 0.
- **complete** : pour **tous les articles** de la sortie, le reliquat cumulé est à 0 (quantite_recue totale == quantite_commandee totale par article sur l'ensemble des réceptions).
- **annulee** : réception annulée (seulement depuis en_cours ou partielle, pas depuis complete).

Transitions autorisées :
- en_cours → partielle (quand une ligne reçoit une quantité partielle)
- en_cours → complete (quand toutes les lignes sont reçues en totalité dès la création)
- partielle → complete (quand les reliquats restants sont reçus)
- en_cours → annulee
- partielle → annulee
- complete → (aucune transition possible, état final)

### 4.5 Statuts et transitions — Anomalies

```
ouverte  →  en_cours  →  resolue
   │          │           │
   └──────────┴───────────┴──→ rejetee (seulement depuis ouverte ou en_cours)
```

- **ouverte** : anomalie déclarée, pas encore prise en charge.
- **en_cours** : anomalie en cours de traitement par le dépositaire.
- **resolue** : anomalie résolue (matériel remplacé, avoir émis, etc.).
- **rejetee** : anomalie rejetée (non fondée).

Transitions autorisées :
- ouverte → en_cours (prise en charge)
- ouverte → rejetee (rejet)
- en_cours → resolue (résolution)
- en_cours → rejetee (rejet après examen)

Une fois résolue ou rejetée, aucune transition retour n'est possible. **Chaque transition est journalisée de façon immuable dans l'entité journal-action.**

### 4.6 Calculs : quantités cumulés et reliquats

#### Par ligne de réception

```
quantite_reliquat = quantite_commandee - quantite_recue
```

Contraintes :
- quantite_recue >= 0
- quantite_recue <= quantite_commandee
- quantite_reliquat >= 0 (dérivé automatiquement)

#### Par réception et par article (cumulé sur l'ensemble des réceptions de la sortie)

Pour un matériel donné sur une sortie :

```
quantite_recue_cumulee = SUM(quantite_recue) sur toutes les réception-lignes de ce matériel pour cette sortie
reliquat_cumule = quantite_commandee - quantite_recue_cumulee
```

Ou, de façon équivalente sur toutes les réceptions de la sortie pour ce matériel :

```
reliquat_cumule = SUM(quantite_commandee) - SUM(quantite_recue)
```

#### Statut de la réception

- **complete** : pour **tous les articles** de la sortie, reliquat_cumule = 0.
- **partielle** : pour au moins un article, reliquat_cumule > 0 ET au moins une ligne a quantite_recue > 0.
- **en_cours** : aucune ligne n'a quantite_recue > 0.

### 4.7 Stratégie sécurité et concurrence

#### Contrôle d'accès (RBAC)

- **Rôle autorisé** : uniquement 'depositaire' (Dépositaire comptable).
- **Contrainte direction** : le dépositaire ne peut réceptionner que les sorties de sa propre direction (résolution via findUtilisateursParRoleEtDirection avec la direction de l'utilisateur connecté).
- **Autres rôles** : magasinier, logistique, demandeur, comptable → 403 sur toutes les routes de réception.
- **Vérification** : getRoleCode (lit user.role.code ou user.role.type) dans le contrôleur, avant toute opération.

#### Concurrence et doublons

- **Plusieurs réceptions par sortie** : autorisées, ordonnées par date de création. Pas de contrainte d'unicité reception→sortie.
- **Transaction atomique** : création de la réception + lignes de réception + mouvements dans une seule strapi.db.transaction. Rollback en cas d'échec quelconque.
- **Verrou de statut sortie** : la réception n'est autorisée que si le statut de la sortie est 'validee' (après la 3e signature). Sinon → 400.
- **Pas de double débit stock** : la réception ne modifie jamais quantite_stock du matériel (le stock a déjà été débité à la signature logistique).
- **Verrou optimiste** : champ `version` sur `reception` et `anomalie`. Toute modification doit fournir la version attendue ; si la version en base a changé entre-temps → rejet 409 (conflit de concurrence).
- **Clé d'idempotence** : chaque soumission de création de réception ou de résolution d'anomalie porte une clé d'idempotence (nonce client). Une même clé soumise deux fois ne produit qu'une seule opération.
- **Idempotence notifications** : réutilisation de l'outbox existant avec contrainte unique (sortie, eventType, recipientId).

#### Validation des données

- date_reception ne peut pas être antérieure à la date de signature logistique (date_signature_logistique sur la sortie).
- quantite_recue par ligne ne peut pas dépasser quantite_commandee de la ligne de sortie liée.
- detenteur_nom et detenteur_fonction obligatoires (si applicable selon règles métier).

### 4.8 Stratégie notifications et historique

#### Notifications (réutilisation outbox/SSE)

| Événement | EVENT_TYPE | Destinataires | Moment |
|-----------|-----------|---------------|--------|
| Réception créée (partielle) | 'reception_partielle' | Dépositaires de la direction | Après création réception |
| Réception complète | 'reception_complete' | Dépositaires de la direction + Logistique | Quand statut → complete |
| Anomalie ouverte | 'anomalie_ouverte' | Dépositaires de la direction | À la création d'anomalie |
| Anomalie résolue | 'anomalie_resolue' | Dépositaires de la direction + Demandeur de la sortie | Quand anomalie → resolue |

- Utiliser creerEntrees depuis le contrôleur de réception, à l'intérieur de la transaction.
- distribuerNotifications appelé après commit de la transaction (ou via le distributeur périodique existant).
- SSE via sseBroadcastToUser pour notification temps réel.

#### Historique et traçabilité

- **Entité mouvement** : créer un mouvement avec action 'Réception physique' (ou 'Réception partielle' / 'Réception complète') à chaque changement de statut de réception.
- **Entité journal-action** : journaliser de façon immuable chaque action sur une anomalie (ouverture, prise en charge, résolution, rejet) avec auteur, date, ancien et nouveau statut.
- **Entité anomalie** : traçage complet des anomalies avec dates d'ouverture et résolution.
- **dateDuJour** : toutes les dates posées par le serveur utilisent dateDuJour (fuseau Madagascar).
- **createdBy / updatedBy** : traçage de qui a créé ou modifié chaque réception/anomalie.
- **Immuabilité** : une entrée de journal-action, une fois insérée, ne peut être ni modifiée ni supprimée.

### 4.9 Tests à ajouter

#### Backend (node --test, strapi simulé) — 24 tests

| # | Test | Ce qui est vérifié |
|---|------|-------------------|
| R1 | Réception valide : statut en_cours, lignes créées, reliquat calculé | Création réussie avec statut correct |
| R2 | Réception : refus (403) hors rôle dépositaire | Contrôle d'accès rôle |
| R3 | Réception : refus (403) si dépositaire d'une autre direction | Contrôle d'accès direction |
| R4 | Réception : statut obligatoire — jamais sur sortie non 'validee' | Vérification statut sortie |
| R5 | **Plusieurs réceptions partielles sur une même sortie** : création de N réceptions autorisée | Multi-réception par sortie |
| R6 | Réception : validation quantite_recue <= quantite_commandee | Cohérence quantités |
| R7 | Réception : date_reception par défaut à aujourd'hui (fuseau Madagascar) | Horloge |
| R8 | Réception : date_reception ne peut pas être antérieure à date_signature_logistique | Cohérence dates |
| R9 | Réception partielle : statut partielle quand au moins une ligne a reliquat > 0 | Calcul reliquat |
| R10 | Réception complète : statut complete quand tous reliquats cumulés = 0 par article | Calcul reliquat cumulé |
| R11 | **Cumulé par article** : reliquat_cumule = SUM(quantite_commandee) - SUM(quantite_recue) sur toutes les réceptions | Reliquat cumulé article par article |
| R12 | Anomalie : création avec statut 'ouverte' | Création anomalie |
| R13 | Anomalie : transition ouverte → en_cours → resolue | Transitions anomalie |
| R14 | Anomalie : pas de retour depuis resolue vers ouverte | État final anomalie |
| R15 | **Historique immuable** : chaque action d'anomalie journalisée (auteur, date, ancien→nouveau statut) | Journal-action |
| R16 | Réception : pas d'impact sur quantite_stock du matériel | Cohérence stock |
| R17 | Rollback : échec de création mouvement → annulation complète | Atomicité transaction |
| R18 | Notification outbox : entrée créée pour 'reception_complete' | Intégration outbox |
| R19 | Notification outbox : idempotence (pas de doublon sur même sortie/eventType/recipient) | Idempotence outbox |
| R20 | **Concurrency** : deux requêtes simultanées de création sur une même sortie → une succès, l'autre 409 (version/conflit) | Concurrence |
| R21 | **Idempotence client** : même clé d'idempotence soumise deux fois → une seule opération | Idempotence |
| R22 | Mouvement : création d'un mouvement 'Réception physique' lié à la sortie | Audit trail |
| R23 | Schéma : reception expose statut, date_reception, depositaire_nom, depositaire_fonction, version | Validation schéma |
| R24 | Clôture : réception avec reliquat non reçu reste partielle (pas de complete forcée) | Règle de clôture |

#### Frontend (vitest)

| # | Test | Ce qui est vérifié |
|---|------|-------------------|
| F1 | Composant ReceptionPhysique : affichage réservé au rôle dépositaire | Contrôle d'accès UI |
| F2 | Composant ReceptionPhysique : saisie quantite_recue <= quantite_commandee | Validation UI |
| F3 | Calcul reliquat : quantite_commandee - quantite_recue | Logique pure |
| F4 | **Calcul reliquat cumulé** par article sur plusieurs réceptions | Logique pure |
| F5 | Statut réception : partielle vs complete selon reliquats cumulés | Logique pure |
| F6 | Date réception : défaut à dateDuJour locale (Madagascar) | Horloge frontend |
| F7 | Formulaire anomalie : création avec statut 'ouverte' | UI anomalie |
| F8 | Bouton résolution anomalie : réservé au dépositaire de la direction | Contrôle d'accès UI |
| F9 | **Historique immuable** : affichage du journal d'actions d'une anomalie | UI journal-action |

### 4.10 Risques et points de décision

| Risque | Gravité | Probabilité | Atténuation |
|--------|---------|-------------|-------------|
| Conflit entre réception et remise (qui vient en premier ?) | Moyenne | Moyenne | Déclarer que réception et remise sont indépendantes ; aucune n'empêche l'autre |
| Double réception sur une sortie | Haute | Basse | **Plusieurs réceptions partielles autorisées** ; pas d'unicité ; vérification du reliquat cumulé |
| Réception par mauvais dépositaire (autre direction) | Haute | Basse | Vérification direction via findUtilisateursParRoleEtDirection |
| Quantité reçue > quantité commandée | Moyenne | Moyenne | Validation serveur + UI |
| Stock impacté deux fois | Haute | Très basse | La réception ne touche pas le stock (déjà débité à logistique) |
| Anomalie non résolue bloquant la réception complète | Basse | Moyenne | Déclarer que l'anomalie ne bloque pas le statut complete (décision métier à confirmer) |
| Concurrence sur création de réception | Moyenne | Basse | Transaction atomique + verrou optimiste (version) + clé d'idempotence |
| **Migration des nouveaux content-types Strapi** | Moyenne | Moyenne | Sauvegarde base avant déploiement ; création idempotente des content-types ; tests sur staging |
| **Régression sur le workflow existant** | Moyenne | Basse | Les tests existants (sortie-remise, remiseSortie) doivent continuer à passer |
| **Perte de données lors de la migration** | Haute | Basse | Rollback transactionnel + sauvegarde + procédure de restauration |

**Points de décision (à valider par l'utilisateur) :**

1. Une anomalie ouverte empêche-t-elle le passage en statut 'complete' de la réception ? (Recommandation : non, l'anomalie est traitée séparément.)
2. La réception est-elle obligatoire avant la remise, ou les deux sont-elles indépendantes ? (Recommandation : indépendantes.)
3. Qui peut résoudre une anomalie : seul le dépositaire qui l'a créée, ou tout dépositaire de la direction ? (Recommandation : tout dépositaire de la direction.)
4. Une réception peut-elle être modifiée après création (ajout de quantités) ? (Recommandation : oui, tant que le statut n'est pas 'complete'.)
5. Que faire des reliquats non reçus (article manquant) ? (Recommandation : la réception reste 'partielle' ; clôture partielle constatée avec justification possible.)

### 4.11 Plan d'implémentation ordonné

**Phase B — après approbation de la Phase A**

| Ordre | Tâche | Livrable | Testable indépendamment |
|-------|-------|----------|------------------------|
| 1 | Créer les 3 schémas content-types (reception, reception-ligne, anomalie) + journal-action | Fichiers schema.json | Oui (validation Strapi) |
| 2 | Créer les contrôleurs et routes (reception + anomalie + journal-action) | Contrôleurs + routes | Oui (tests backend) |
| 3 | Ajouter permissions dans index.js (RECEPTION_ACTIONS, ANOMALIE_ACTIONS, JOURNAL_ACTION_ACTIONS, ROLES) | index.js modifié | Oui (tests permissions) |
| 4 | Ajouter EVENT_TYPE réception dans notification-outbox | Service outbox modifié | Oui (tests outbox) |
| 5 | Implémenter la logique de création réception + lignes + mouvements (transaction + version + idempotence) | Contrôleur réception | Oui (tests R1-R11, R16-R22) |
| 6 | Implémenter la gestion des anomalies (création, transitions, résolution, journal-action immuable) | Contrôleur anomalie | Oui (tests R12-R15) |
| 7 | Créer les composants frontend (ReceptionPhysique, AnomalieForm) | Composants React | Oui (tests F1-F9) |
| 8 | Ajouter les appels API dans api.ts et la logique pure dans reception.ts (incl. calcul reliquat cumulé) | Lib frontend | Oui (tests F3-F5) |
| 9 | Écrire les 24 tests backend + tests frontend | Fichiers de test | Oui (tous les tests passent) |
| 10 | Intégration et recette (tests bout en bout) | Application complète | Oui (recette utilisateur) |
| 11 | Migration et sauvegarde : script de migration Strapi, sauvegarde base avant déploiement, tests de régression sur workflow existant | Scripts de migration + sauvegarde | Oui (tests de régression) |

---

## 5. Les 19 règles métier obligatoires (mises à jour)

### Préservation du workflow existant

**R1** : Le workflow à 3 signatures existant (magasinier → dépositaire → logistique) est préservé sans modification. Aucune étape existante n'est supprimée ou altérée.

**R2** : La réception physique intervient uniquement après la 3e signature, c'est-à-dire quand le statut de la sortie est 'validee' et stock_impacte = true.

**R3** : La réception ne doit jamais déclencher un nouveau débit de stock. Le stock a déjà été débité à la signature logistique (étape 3). La réception ne touche pas à quantite_stock.

**R4** : L'étape de remise au détenteur (étape 5, statut 'sortie_effectuee') existe déjà et n'est pas modifiée par l'ajout de la réception. Réception et remise sont indépendantes.

### Autorisation des acteurs

**R5** : Seul le Dépositaire comptable (rôle 'depositaire') rattaché à la direction destinataire de la sortie peut initier une réception.

**R6** : Les rôles magasinier, logistique, demandeur et comptable ne peuvent pas effectuer de réception (403).

**R7** : Seul un utilisateur avec le rôle 'depositaire' et la direction correspondant à celle de la sortie peut consulter et modifier les réceptions de sa direction.

**R8** : La résolution d'une anomalie (passage en 'resolue' ou 'rejetee') est réservée au dépositaire de la direction concernée.

### Modèle de données

**R9** : Une entité 'reception' est liée à une sortie par relation manyToOne. **Plusieurs réceptions peuvent être liées à une même sortie** (pas d'unicité reception→sortie).

**R10** : Une entité 'reception-ligne' détient quantite_commandee, quantite_recue, quantite_reliquat (calculé = quantite_commandee - quantite_recue), etat, observations.

**R11** : Une entité 'anomalie' est liée à une réception (et optionnellement à une ligne de réception), avec type_anomalie, description, statut (ouverte/en_cours/resolue/rejetee), date_ouverture, date_resolution.

**R12** : Les champs id (numérique, Strapi 5) et documentId (string) sont distincts et ne doivent pas être confondus dans le code.

**R13** : **Verrou optimiste** : un champ `version` sur reception et anomalie garantit l'absence de perte de modification concurrente (rejet 409 si version obsolète).

**R14** : **Idempotence** : une clé d'idempotence côté client empêche les doubles soumissions (même clé → une seule opération).

### Cohérence stock

**R15** : La réception ne modifie jamais quantite_stock du matériel (pas de débit ni de crédit).

**R16** : Le verrou stock_impacte (false→true) posé à la signature logistique empêche tout double débit de stock.

**R17** : La quantité reçue par ligne (quantite_recue) ne peut pas dépasser la quantité commandée sur la ligne de sortie liée (quantite_commandee).

### Anomalies

**R18** : Une réception peut être partielle (au moins un article avec reliquat cumulé > 0) ou complète (tous les articles avec reliquat cumulé = 0).

**R19** : Une anomalie ouverte ne bloque pas le passage en 'complete' (recommandation : l'anomalie est traitée séparément). Chaque action sur une anomalie est journalisée de façon immuable (journal-action : auteur, date, ancien→nouveau statut).

**R20** : Statut anomalie : ouverte → en_cours → resolue (ou rejetee). Pas de retour arrière possible une fois résolue ou rejetée.

### Notifications

**R21** : Les notifications utilisent le système outbox/SSE existant (pas de nouveau système parallèle), avec des EVENT_TYPE dédiés pour la réception ('reception_partielle', 'reception_complete', 'anomalie_ouverte', 'anomalie_resolue').

### Migration et régression

**R22** : Les nouveaux content-types sont créés de façon idempotente ; une sauvegarde de la base est effectuée avant déploiement ; les tests de régression sur le workflow existant doivent continuer à passer.

---

## 6. Conclusion et prochaines étapes

Ce document de Phase A présente l'audit et la proposition détaillée pour l'implémentation de la "Réception physique du matériel", corrigé selon les recommandations de l'analyse des 11 points. Aucun code n'a été modifié, conformément à la contrainte utilisateur.

**Prochaine étape** : L'utilisateur doit examiner ce document corrigé et donner son approbation explicite avant que la Phase B (implémentation) ne commence. Une fois approuvé, le plan d'implémentation ordonné (section 4.11) servira de feuille de route pour les 11 tâches d'implémentation.

**Documents associés** :
- Code source existant : backend/src/api/sortie/, backend/src/api/mouvement/, backend/src/index.js, backend/src/utils/, backend/src/lib/, backend/src/api/notification-outbox/
- Frontend existant : frontend/src/lib/api.ts, frontend/src/lib/remiseSortie.ts, frontend/src/components/distribution/
- Tests existants : backend/tests/sortie-remise.test.js, frontend/src/lib/remiseSortie.test.ts, frontend/src/components/distribution/RemiseOrdres.roles.test.tsx

---

## 7. Plan d'exécution détaillé (Tâches 1 à 11)

Chaque tâche ci-dessous est découpée en étapes **RED → GREEN** : on écrit d'abord le test qui échoue, puis on implémente, puis on vérifie que le test passe. Le script `task-brief PLAN_FILE N` extrait chaque section `### Task N` pour produire le brief du jour. Les étapes respectent les contraintes globales (pas de débit stock à la réception, fuseau Madagascar, rôle `depositaire` uniquement, verrou optimiste `version`, clé d'idempotence, transaction atomique, outbox/SSE existant réutilisé tel quel).

### Task 1 — Créer les schémas content-types (reception, reception-ligne, anomalie, journal-action)

**Description :** Créer les quatre nouveaux content-types Strapi 5 qui portent le modèle de données de la réception physique, sans toucher au content-type `sortie` existant (aucune unicité reception→sortie, plusieurs réceptions partielles autorisées par sortie).

**Étapes :**
1. [RED] Créer le fichier `backend/tests/reception-schemas.test.js` qui vérifie l'existence et la structure de chaque schéma (champs requis, relations, énumérations, champ `version`). Le test doit échouer car les fichiers n'existent pas encore.
2. Créer `backend/src/api/reception/content-types/reception/schema.json` : `sortie` (manyToOne → api::sortie.sortie, requis), `numero` (integer, requis), `date_reception` (date, requis), `statut` (enum ['en_cours','partielle','complete','annulee'], requis), `version` (integer, requis), `depositaire_nom` (text, requis), `depositaire_fonction` (text, requis), `direction` (manyToOne → api::direction.direction, requis), `observations` (text), `createdBy` / `updatedBy`.
3. Créer `backend/src/api/reception-ligne/content-types/reception-ligne/schema.json` : `reception` (manyToOne → api::reception.reception, requis), `sortie_ligne` (manyToOne → api::sortie-ligne.sortie-ligne, requis), `materiel` (manyToOne → api::material.material, requis), `quantite_commandee` (integer, requis), `quantite_recue` (integer, requis), `quantite_reliquat` (integer, calculé), `etat` (enum), `observations` (text). Contrainte : `quantite_recue <= quantite_commandee`.
4. Créer `backend/src/api/anomalie/content-types/anomalie/schema.json` : `reception` (manyToOne, requis), `reception_ligne` (manyToOne, optionnel), `type_anomalie` (enum, requis), `description` (text, requis), `statut` (enum ['ouverte','en_cours','resolue','rejetee'], requis), `version` (integer, requis), `date_ouverture` (date), `date_resolution` (date), `responsable` (relation user-permissions).
5. Créer `backend/src/api/journal-action/content-types/journal-action/schema.json` : `anomalie` (manyToOne, requis), `action` (enum, requis), `auteur` (relation user-permissions, requis), `date` (date, requis), `ancien_statut` (enum), `nouveau_statut` (enum, requis), `commentaire` (text). Contrainte : immuable (pas de modification/suppression après insertion).
6. [GREEN] Relancer le test de schéma : il doit passer (quatre fichiers présents, structure conforme).
7. Commiter.

**Résultat attendu :** Quatre fichiers `schema.json` valides Strapi 5 ; le test de schéma passe (existence + structure).

**Commande de test :** `node --test backend/tests/reception-schemas.test.js`

---

### Task 2 — Créer les contrôleurs et routes (reception, anomalie, journal-action)

**Description :** Créer les contrôleurs et routes des trois nouveaux content-types, sur le modèle du contrôleur `sortie.js` (guardedCoreController, getRoleCode, réponses 400/403/404/409, traçage par mouvement).

**Étapes :**
1. [RED] Créer le fichier `backend/tests/reception-routes.test.js` qui déclare l'existence des routes (GET/POST /receptions, POST /receptions/:id/lignes, GET/POST/PATCH /anomalies, GET /journal-actions) et que chaque fichier de contrôleur exporte les handlers attendus. Le test doit échouer.
2. Créer `backend/src/api/reception/controllers/reception.js` : handlers `find`, `findOne`, `create`, `createLigne`. Contrôle : statut sortie = 'validee' (sinon 400), rôle 'depositaire' (sinon 403), direction de l'utilisateur = direction de la sortie (sinon 403), `quantite_recue <= quantite_commandee` (sinon 400), clé d'idempotence, verrou `version`.
3. Créer `backend/src/api/reception/routes/reception.js` : déclarer `GET /receptions`, `GET /receptions/:documentId`, `POST /receptions`, `POST /receptions/:documentId/lignes`.
4. Créer `backend/src/api/anomalie/controllers/anomalie.js` : handlers `find`, `findOne`, `create`, `resolve` (changement de statut vers 'resolue'/'rejetee' avec verrou version + journalisation immuable).
5. Créer `backend/src/api/anomalie/routes/anomalie.js` : déclarer `GET /anomalies`, `GET /anomalies/:documentId`, `POST /anomalies`, `PATCH /anomalies/:documentId/resolve`.
6. Créer `backend/src/api/journal-action/controllers/journal-action.js` : handler `find` uniquement (lecture seule, immuable).
7. Créer `backend/src/api/journal-action/routes/journal-action.js` : déclarer `GET /journal-actions` uniquement.
8. [GREEN] Le test de routes passe : tous les fichiers existent et exportent les handlers attendus.
9. Commiter.

**Résultat attendu :** Contrôleurs et routes créés pour reception, anomalie, journal-action ; le test de routes passe.

**Commande de test :** `node --test backend/tests/reception-routes.test.js`

---

### Task 3 — Ajouter les permissions dans index.js (RECEPTION_ACTIONS, ANOMALIE_ACTIONS, JOURNAL_ACTION_ACTIONS)

**Description :** Ajouter dans `backend/src/index.js` les listes d'actions et de rôles pour la réception, l'anomalie et le journal-action, sur le modèle des listes existantes (SORTIE_REMISE_ACTIONS / ROLES_REMISE_SORTIE, NOTIFICATION_OUTBOX_ACTIONS / ROLES_NOTIFICATION_OUTBOX). Appeler ensureAuthSetup pour créer les permissions au boot.

**Étapes :**
1. [RED] Créer le fichier `backend/tests/reception-permissions.test.js` qui vérifie la présence dans `src/index.js` de `RECEPTION_ACTIONS`, `ANOMALIE_ACTIONS`, `JOURNAL_ACTION_ACTIONS`, `ROLES_RECEPTION = ['depositaire']`, et que ces actions sont accordées au rôle 'depositaire' dans le bootstrap. Le test doit échouer.
2. Ajouter `const RECEPTION_ACTIONS = ['api::reception.reception.create', 'api::reception.reception.find', 'api::reception.reception.findOne', 'api::reception-ligne.reception-ligne.create']`.
3. Ajouter `const ROLES_RECEPTION = ['depositaire']`.
4. Ajouter `const ANOMALIE_ACTIONS = ['api::anomalie.anomalie.create', 'api::anomalie.anomalie.find', 'api::anomalie.anomalie.findOne', 'api::anomalie.anomalie.resolve']`.
5. Ajouter `const ROLES_ANOMALIE = ['depositaire']`.
6. Ajouter `const JOURNAL_ACTION_ACTIONS = ['api::journal-action.journal-action.find']`.
7. Ajouter `const ROLES_JOURNAL_ACTION = ['depositaire']`.
8. Dans `ensureAuthSetup`, accorder ces actions aux rôles 'depositaire' (et admin applicatif), sur le modèle du bloc `2douzaines) Remise d'une sortie`.
9. [GREEN] Le test de permissions passe : toutes les listes existent et sont accordées.
10. Commiter.

**Résultat attendu :** index.js contient les nouvelles listes d'actions et de rôles ; le bootstrap les crée au démarrage ; le test de permissions passe.

**Commande de test :** `node --test backend/tests/reception-permissions.test.js`

---

### Task 4 — Ajouter EVENT_TYPE réception dans notification-outbox

**Description :** Ajouter dans `backend/src/api/notification-outbox/services/notification-outbox.js` les EVENT_TYPE dédiés à la réception ('reception_partielle', 'reception_complete', 'anomalie_ouverte', 'anomalie_resolue') et la résolution des destinataires par rôle/direction pour ces types.

**Étapes :**
1. [RED] Créer le fichier `backend/tests/reception-outbox.test.js` qui vérifie que `EVENT_TYPE_PAR_ROLE` (ou une map dédiée) contient les quatre nouveaux EVENT_TYPE et que `creerEntrees` accepte un rôle de réception sans lever "Rôle de destinataire inconnu". Le test doit échouer.
2. Ajouter EVENT_TYPE reception dans la map (ou une map `EVENT_TYPE_RECEPTION` dédiée) : 'reception_partielle', 'reception_complete', 'anomalie_ouverte', 'anomalie_resolue' → rôle 'depositaire'.
3. S'assurer que `creerEntrees` accepte ces rôles (lever une erreur claire si inconnu).
4. [GREEN] Le test outbox passe : les quatre EVENT_TYPE existent et sont utilisables par creerEntrees.
5. Commiter.

**Résultat attendu :** notification-outbox.js expose les EVENT_TYPE de réception ; `creerEntrees` les accepte ; le test passe.

**Commande de test :** `node --test backend/tests/reception-outbox.test.js`

---

### Task 5 — Implémenter la création de réception + lignes + mouvements (transaction + version + idempotence)

**Description :** Implémenter le contrôleur `create` de réception : création atomique (réception + lignes de réception + mouvements + entrées outbox) dans une `strapi.db.transaction`, verrou optimiste `version`, clé d'idempotence, pas d'impact stock, calcul des reliquats.

**Étapes :**
1. [RED] Créer/compléter `backend/tests/reception-creation.test.js` avec les tests R1-R11, R16-R22 (réception valide, refus 403 hors dépositaire, refus 403 autre direction, refus 400 si sortie non 'validee', plusieurs réceptions partielles, quantite_recue <= quantite_commandee, date_reception défaut aujourd'hui fuseau Madagascar, date_reception >= date_signature_logistique, statut partielle/complete selon reliquats, reliquat cumulé par article, pas d'impact stock, rollback si échec mouvement, mouvement 'Réception physique', outbox 'reception_complete', idempotence outbox, concurrence 409, idempotence client, schéma exposé). Les tests doivent échouer (contrôleur create absent).
2. Implémenter `reception.controllers/reception.js` handler `create` :
   - Vérifier authentification, rôle 'depositaire' (403 sinon), direction de l'utilisateur = direction de la sortie (403 sinon).
   - Vérifier statut sortie = 'validee' (400 sinon).
   - Dans `strapi.db.transaction` : créer la réception (version=1), créer les réception-lignes (quantite_reliquat = quantite_commandee - quantite_recue), créer les mouvements ('Réception physique'), créer les entrées outbox ('reception_partielle' ou 'reception_complete' selon reliquat cumulé).
   - Vérifier `quantite_recue <= quantite_commandee` par ligne (400 sinon).
   - Pas de modification de `quantite_stock` du matériel.
   - Clé d'idempotence : même clé → une seule opération (vérifier dans une table/idempotence-key en mémoire ou via documentId).
   - Rollback complet si échec de création de mouvement.
3. Déterminer le statut : 'complete' si tous les reliquats cumulés = 0 par article, sinon 'partielle', sinon 'en_cours'.
4. Après commit : `distribuerNotifications(app)`.
5. [GREEN] Tous les tests R1-R11, R16-R22 passent.
6. Commiter.

**Résultat attendu :** Création de réception fonctionnelle, transactionnelle, avec version, idempotence, reliquats cumulés, pas d'impact stock, outbox ; tous les tests de création passent.

**Commande de test :** `node --test backend/tests/reception-creation.test.js`

---

### Task 6 — Implémenter la gestion des anomalies (création, transitions, résolution, journal-action immuable)

**Description :** Implémenter le contrôleur `anomalie.js` : création d'anomalie (statut 'ouverte'), transitions ouverte→en_cours→resolue/rejetee, verrou `version` (409 si obsolète), pas de retour arrière depuis resolue/rejetee, journalisation immuable dans journal-action à chaque transition.

**Étapes :**
1. [RED] Créer/compléter `backend/tests/reception-anomalie.test.js` avec les tests R12-R15 (création anomalie 'ouverte', transitions ouverte→en_cours→resolue, pas de retour depuis resolue, historique immuable journalisé auteur/date/ancien→nouveau statut). Les tests doivent échouer.
2. Implémenter `anomalie.controllers/anomalie.js` handlers `create`, `resolve` :
   - `create` : statut 'ouverte', date_ouverture = dateDuJour, version=1, création d'une entrée journal-action ('ouverte').
   - `resolve` : vérifier la version fournie (409 si obsolète), transition autorisée seulement ouverte→en_cours→resolue/rejetee (pas de retour depuis resolue/rejetee → 400/409), incrémenter version, créer entrée journal-action immuable (auteur, date=dateDuJour, ancien→nouveau statut).
   - Seul le dépositaire de la direction peut résoudre (403 sinon).
3. Le journal-action est immuable : une fois insérée, une entrée ne peut être modifiée ni supprimée (aucune route update/delete sur journal-action).
4. [GREEN] Tous les tests R12-R15 passent.
5. Commiter.

**Résultat attendu :** Gestion des anomalies fonctionnelle avec transitions contrôlées, verrou version, journal-action immuable ; tous les tests d'anomalie passent.

**Commande de test :** `node --test backend/tests/reception-anomalie.test.js`

---

### Task 7 — Créer les composants frontend (ReceptionPhysique, AnomalieForm)

**Description :** Créer les composants React frontend pour la réception physique et la déclaration/résolution d'anomalies, avec contrôle d'accès UI réservé au rôle dépositaire et verrou de soumission (éviter les doubles envois).

**Étapes :**
1. [RED] Créer `frontend/src/components/reception/ReceptionPhysique.test.tsx` (vitest) et `frontend/src/components/reception/AnomalieForm.test.tsx` qui vérifient : affichage réservé au rôle dépositaire, saisie quantite_recue <= quantite_commandee, formulaire anomalie avec statut 'ouverte', bouton résolution réservé au dépositaire de la direction. Les tests doivent échouer (composants absents).
2. Créer `frontend/src/components/reception/ReceptionPhysique.tsx` : liste des sorties à recevoir (statut 'validee', direction de l'utilisateur), formulaire de saisie quantite_recue par ligne, calcul du reliquat, bouton soumettre avec clé d'idempotence et verrou `envoiEnCours`.
3. Créer `frontend/src/components/reception/AnomalieForm.tsx` : formulaire de déclaration d'anomalie (type_anomalie, description), statut 'ouverte' par défaut, bouton résolution réservé au dépositaire.
4. Contrôle d'accès UI : seuls les utilisateurs avec rôle 'depositaire' voient les composants (403/accès refusé sinon).
5. [GREEN] Les tests frontend F1-F2, F7-F8 passent.
6. Commiter.

**Résultat attendu :** Composants ReceptionPhysique et AnomalieForm créés, contrôle d'accès UI par rôle, verrou de soumission ; les tests frontend correspondants passent.

**Commande de test :** `npx vitest run frontend/src/components/reception/`

---

### Task 8 — Appels API dans api.ts + logique pure dans reception.ts (calcul reliquat cumulé)

**Description :** Ajouter dans `frontend/src/lib/api.ts` les appels API (fetchReceptionsPourDepositaire, creerReception, creerAnomalie, mapReception) et dans `frontend/src/lib/reception.ts` la logique pure (estARecevoir, construirePayloadReception, calculerReliquat, calculerReliquatCumule, dateReceptionLocale).

**Étapes :**
1. [RED] Créer `frontend/src/lib/reception.test.ts` (vitest) avec les tests F3-F6 (calcul reliquat, reliquat cumulé par article sur plusieurs réceptions, statut partielle vs complete, date défaut aujourd'hui fuseau Madagascar). Les tests doivent échouer (fonctions absentes).
2. Créer `frontend/src/lib/reception.ts` :
   - `estARecevoir(sortie)` : vrai si statut 'validee' et reliquat cumulé > 0 pour au moins un article.
   - `construirePayloadReception(sortie, lignesRecues, idempotenceKey)` : construit le corps de requête.
   - `calculerReliquat(quantite_commandee, quantite_recue)` : quantite_commandee - quantite_recue.
   - `calculerReliquatCumule(receptions, materielId)` : SUM(quantite_commandee) - SUM(quantite_recue) sur toutes les réceptions.
   - `dateReceptionLocale()` : dateDuJour côté frontend (fuseau Madagascar).
   - `statutReception(reliquatsCumules)` : 'complete' si tous à 0, 'partielle' si au moins un > 0 et au moins une ligne reçue, 'en_cours' sinon.
3. Dans `frontend/src/lib/api.ts` : ajouter `fetchReceptionsPourDepositaire`, `creerReception`, `creerAnomalie`, `mapReception`.
4. [GREEN] Les tests F3-F6 passent.
5. Commiter.

**Résultat attendu :** Logique pure de réception (reliquats, statuts, dates) et appels API créés ; les tests de logique pure passent.

**Commande de test :** `npx vitest run frontend/src/lib/reception.test.ts`

---

### Task 9 — Consolidation : tous les 24 tests backend + 9 tests frontend existent et passent

**Description :** Vérifier que l'ensemble des 24 tests backend (R1-R24) et 9 tests frontend (F1-F9) sont écrits, passent, et que les tests existants (sortie-remise, remiseSortie) ne régressent pas.

**Étapes :**
1. Recenser tous les fichiers de test créés (reception-schemas, reception-routes, reception-permissions, reception-outbox, reception-creation, reception-anomalie, reception.test.ts).
2. S'assurer que R1-R24 et F1-F9 sont tous couverts par un test existant et passant.
3. Lancer l'ensemble des tests backend : `node --test backend/tests/*.test.js` — tous doivent passer.
4. Lancer l'ensemble des tests frontend : `npx vitest run` — tous doivent passer (y compris remiseSortie.test.ts et RemiseOrdres.roles.test.tsx existants).
5. Commiter.

**Résultat attendu :** 24 tests backend + 9 tests frontend écrits et verts ; aucune régression sur les tests existants.

**Commande de test :** `node --test backend/tests/*.test.js && npx vitest run`

---

### Task 10 — Intégration et recette (tests bout en bout)

**Description :** Valider le flux complet bout en bout : création de sortie → validation logistique (stock débité) → réception physique par le dépositaire → calcul des reliquats cumulés → déclaration d'anomalie → résolution avec journal immuable → notifications outbox/SSE.

**Étapes :**
1. Écrire un test d'intégration `backend/tests/reception-integration.test.js` qui simule le flux complet avec l'objet strapi simulé (comme sortie-remise.test.js).
2. Vérifier : sortie 'validee' → création réception par dépositaire de la même direction (200) → réception partielle → deuxième réception partielle complétant le reliquat → statut 'complete' → pas d'impact stock → outbox 'reception_complete' créée → anomalie déclarée → résolue avec journal-action.
3. Vérifier les refus : réception par dépositaire d'une autre direction (403), réception sur sortie non 'validee' (400), quantite_recue > quantite_commandee (400).
4. Lancer le test d'intégration : doit passer.
5. Commiter.

**Résultat attendu :** Flux bout en bout valide, tous les cas de refus gérés, pas de régression.

**Commande de test :** `node --test backend/tests/reception-integration.test.js`

---

### Task 11 — Migration et sauvegarde (content-types Strapi, sauvegarde base, régression)

**Description :** Préparer le déploiement : création idempotente des nouveaux content-types Strapi, procédure de sauvegarde de la base avant déploiement, tests de régression sur le workflow existant (3 signatures, remise) qui doivent continuer à passer.

**Étapes :**
1. Vérifier que les nouveaux content-types sont créés de façon idempotente (Strapi les crée s'ils n'existent pas, ne les duplique pas s'ils existent déjà).
2. Documenter la procédure de sauvegarde de la base PostgreSQL avant déploiement (pg_dump) et de restauration.
3. Lancer les tests de régression : `node --test backend/tests/sortie-remise.test.js` et `npx vitest run frontend/src/lib/remiseSortie.test.ts frontend/src/components/distribution/RemiseOrdres.roles.test.tsx` — tous doivent passer.
4. Vérifier qu'aucun fichier existant n'a été modifié (seuls des ajouts).
5. Commiter.

**Résultat attendu :** Procédure de migration/sauvegarde documentée ; tests de régression verts ; aucune modification de code existant.

**Commande de test :** `node --test backend/tests/sortie-remise.test.js && npx vitest run frontend/src/lib/remiseSortie.test.ts frontend/src/components/distribution/RemiseOrdres.roles.test.tsx`

