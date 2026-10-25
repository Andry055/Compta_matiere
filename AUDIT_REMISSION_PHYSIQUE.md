# AUDIT CIBLÉ — REMISE PHYSIQUE DU MATÉRIEL

## Rapport d'audit technique et fonctionnel

**Dépôt** : `D:\projet\Compta-main`  
**Branche** : `andry`  
**Mode** : Lecture seule (read-only) — aucun fichier modifié, aucune donnée métier touchée  
**Date** : 2026-10-25  
**Stack** : Strapi 5 (backend, Node.js, SQLite/Knex), React + Vite (frontend), axios (API client)

---

## 1. VERDICT GÉNÉRAL

**Statut global : IMPLÉMENTÉ MAIS PARTIEL**

La remise physique du matériel (étape 5 du circuit de sortie) est implémentée au niveau backend via l'API `reception-physique`, mais le **frontend ne l'utilise pas** : la réception reste en mémoire locale uniquement et n'est jamais persistée en base de données. Il n'existe **aucun test de réception-physique sur la branche `andry`**.

L'implémentation complète (réception par lignes avec reliquat, statut en_cours/partielle/complète, idempotence, rollback transactionnel, notifications outbox, anomalie avec workflow, journal immuable) existe uniquement dans un **worktree séparé** (`.claude/worktrees/reception-physique`) non fusionné sur `andry`.

**Risque principal** : perte de données — toute réception saisie dans l'interface est perdue au rafraîchissement de la page.

**Pas de double déduction de stock** : confirmé par le code — le débit intervient une seule fois à la signature logistique (3ème signature), protégé par le verrou `stock_impacte`. Ni `remise` ni `reception-physique.create` ne modifient `quantite_stock`.

---

## 2. TABLEAU D'AUDIT

Statuts utilisés : `IMPLÉMENTÉ ET VÉRIFIÉ` | `IMPLÉMENTÉ MAIS PARTIEL` | `PRÉSENT MAIS NON PROUVÉ` | `ABSENT` | `BLOQUÉ POUR VÉRIFICATION`

| # | Domaine | Élément vérifié | Statut | Preuve backend | Preuve frontend | Test | Problème identifié |
|---|---------|----------------|--------|----------------|-----------------|------|-------------------|
| A1 | Circuit de sortie | 3 signatures (magasinier → dépositaire → logistique) | IMPLÉMENTÉ ET VÉRIFIÉ | `signerLogistique` (étape 4), `sign` (étapes 1-3), booléens `magasinier_signed`/`depositaire_signed`/`logistique_signed` | `ListeSortiesARéceptionner.tsx` affiche "3 signatures OK" | `sortie-signatures.test.js`, `sortie-logistique.test.js` | Aucun |
| A2 | Débit de stock | Débit central à la 3ème signature, verrou `stock_impacte` | IMPLÉMENTÉ ET VÉRIFIÉ | `UPDATE materials SET quantite_stock = quantite_stock - X WHERE quantite_stock >= X` dans transaction atomique, condition `stock_impacte = false → true` | N/A (backend uniquement) | `sortie-logistique.test.js` | Aucun |
| B1 | Remise physique | Étape 5 — statut `sortie_effectuee`, détenteur, date_remise, mandataire | IMPLÉMENTÉ ET VÉRIFIÉ | `remise` controller (lignes 964-1209), aucun `UPDATE materials` | Route `POST /sorties/:id/remise` déclarée | `sortie-remise.test.js`, `remise-mandataire-fuseau.test.js` | Aucun |
| B2 | Pas de débit à la remise | La remise ne doit pas impacter le stock | IMPLÉMENTÉ ET VÉRIFIÉ | `remise` crée un mouvement "Remise au détenteur" sans modifier `quantite_stock` | N/A | `sortie-remise.test.js` | Aucun |
| C1 | API réception physique | `POST/GET /api/receptions-physiques` existe | PRÉSENT MAIS NON PROUVÉ | Contrôleur `create`/`find`/`findOne`, schéma `quantite_prevue`/`quantite_recue`/`statut`/`type_anomalie` | Aucune (frontend ne l'appelle pas) | Aucun test réception-physique sur `andry` | Frontend non connecté |
| C2 | Pas de double débit à la réception | La réception ne doit pas impacter le stock | IMPLÉMENTÉ ET VÉRIFIÉ | `create` → `super.create`, aucun `UPDATE materials`, service `createCoreService` sans custom | N/A | Aucun test spécifique | Non couvert par tests |
| D1 | Persistance réception | Sauvegarde en base depuis le frontend | ABSENT | API backend existe | `receptions.push(nouvelleReception)` — local only, comment "l'API n'est pas encore connectée" | Aucun | Données perdues au refresh |
| D2 | Historique des réceptions | Affichage des réceptions passées | ABSENT | `find`/`findOne` existent côté backend | `HistoriqueRéceptions.tsx` lit le tableau local vide `receptions: []` | Aucun | Toujours vide |
| D3 | Déclaration anomalie | Saisie d'anomalie à la réception | ABSENT (andry) | Pas d'API `anomalie` sur branche `andry` | `receptionAnomalies.push(nouvelleAnomalie)` — local only | Aucun | Non persisté, pas de workflow |
| E1 | Notifications 3ème signature | Outbox `ordre_pret_distribution` / `ordre_sortie_autorise` | IMPLÉMENTÉ ET VÉRIFIÉ | `notification-outbox.js` `EVENT_TYPE_PAR_ROLE`, `distribuerNotifications` avec SSE + retry + idempotence | N/A | `notification-outbox.test.js` | Livraison SSE conditionnelle (aucun flux ouvert = retry) |
| E2 | Notifications après réception | Outbox après réception physique | ABSENT (andry) | Pas d'entrée outbox créée par `reception-physique.create` | N/A | Aucun | Worktree non fusionné |
| F1 | Anomalies réception | Suivi des anomalies (ouvertes/en cours/résolues) | PRÉSENT MAIS NON PROUVÉ | Champs `type_anomalie`/`description_anomalie` sur réception-physique (simple, pas de workflow dédié) | `DéclarationAnomalie.tsx` — local only | Aucun | Pas de contrôleur anomalie dédié sur `andry` |
| G1 | Journal d'audit réceptions | Trace immuable des réceptions | ABSENT (andry) | Pas d'API `journal-action` sur branche `andry` | N/A | Aucun | Worktree non fusionné |

---

## 3. PARCOURS RÉEL ACTUEL

### Flux de sortie (implémenté et vérifié)

1. **Demande** : le demandeur crée une sortie (`statut: demandee`)
2. **Signature magasinier (étape 1)** : `POST /sorties/:id/sign` par magasinier
3. **Signature dépositaire (étape 2)** : `POST /sorties/:id/sign` par dépositaire
4. **Signature logistique (étape 3)** : `POST /sorties/:id/sign` par logistique → `signerLogistique` débite le stock central de manière atomique (verrou `stock_impacte`), crée les mouvements, passe le statut à `validee`, notifie l'outbox (`ordre_pret_distribution` / `ordre_sortie_autorise`)
5. **Remise physique (étape 5)** : `POST /sorties/:id/remise` par magasinier ou dépositaire → statut `sortie_effectuee`, enregistre détenteur/fonction/date_remise/mandataire, crée mouvement "Remise au détenteur", **sans toucher le stock**

### Flux de réception physique (état actuel sur `andry`)

Le backend expose `POST /api/receptions-physiques` (contrôleur `reception-physique`, rôle `demandeur`, sortie doit être `sortie_effectuee`, même direction), mais :

- **Le frontend n'appelle jamais cette API.** Dans `FormulaireRéception.tsx` (ligne 99), le commentaire indique `// Ajout local uniquement — l'API n'est pas encore connectée.` puis `receptions.push(nouvelleReception)`.
- Les anomalies sont également locales : `DéclarationAnomalie.tsx` (ligne 62) fait `receptionAnomalies.push(nouvelleAnomalie)` sans appel API.
- `HistoriqueRéceptions.tsx` lit le tableau local `receptions: []` (toujours vide, voir `frontend/src/lib/movements.ts` lignes 742 et 744).
- `frontend/src/lib/api.ts` ne contient aucune fonction pour `/api/receptions-physiques` (ni `creerReceptionPhysique`, ni `listerReceptionsPhysiques`, ni `getReceptionPhysique`).
- **Conséquence** : toute réception saisie est perdue au rechargement de la page. Il n'existe aucune persistance côté frontend.

### Preuve de l'absence de double déduction de stock

| Étape | Action sur le stock | Preuve |
|-------|--------------------|--------|
| 3ème signature (logistique) | Débit atomique `quantite_stock - X WHERE quantite_stock >= X` | `signerLogistique`, `backend/src/api/sortie/controllers/sortie.js:273-541` |
| Remise (étape 5) | Aucun `UPDATE materials` | `remise`, `backend/src/api/sortie/controllers/sortie.js:964-1209` |
| Réception physique | `create` → `super.create`, aucun UPDATE stock | `reception-physique.js`, service `createCoreService` sans custom |

**Verdict : pas de double déduction de stock.** Cette absence de débit n'est cependant pas couverte par un test dédié sur `andry`.

---

## 4. ÉCARTS ET RISQUES

| # | Écart | Risque | Gravité | Preuve |
|---|-------|--------|---------|--------|
| 1 | Frontend réception non connecté à l'API backend | Données de réception perdues au refresh ; pas de traçabilité persistente ; pas de récupération après incident | **Critique** | `receptions.push` local (`FormulaireRéception.tsx:99`), `HistoriqueRéceptions` vide |
| 2 | Aucun test réception-physique sur `andry` | Régressions non détectées ; comportement non prouvé ; pas de contrat de test | **Élevé** | Aucun fichier `*reception*.test.js` dans `backend/tests/` ni `frontend/src/` |
| 3 | Pas de workflow anomalie dédié sur `andry` | Anomalies déclarées localement, pas de suivi, pas de résolution, pas de traçabilité | **Moyen** | Champs `type_anomalie`/`description_anomalie` sur réception-physique uniquement |
| 4 | Pas de journal d'audit des réceptions sur `andry` | Pas de trace immuable des réceptions physiques ni des anomalies | **Moyen** | Pas d'API `journal-action` sur branche `andry` |
| 5 | Notifications outbox absentes après réception | Le dépositaire n'est pas notifié de la réception complète/partielle | **Moyen** | Pas d'entrée `reception_complete`/`reception_partielle` créée par `reception-physique.create` |
| 6 | Worktree non fusionné | L'implémentation complète (réception par lignes, idempotence, rollback, anomalie, journal) n'est pas sur `andry` | **Élevé** | Fichiers dans `.claude/worktrees/reception-physique/` non intégrés |

---

## 5. FLUX CIBLE

Le flux cible pour la remise physique complète doit être :

1. **Saisie de réception** : le dépositaire (ou magasinier) saisit la réception via l'interface, ligne par ligne (quantité reçue, état, observations), avec référence à la sortie et aux lignes de sortie.
2. **Validation métier** : quantité reçue ≤ quantité commandée, date de réception ≥ date de signature logistique, même direction que la sortie, rôle habilité (dépositaire).
3. **Statut de réception** : `en_cours` / `partielle` / `complète` (calculé par reliquat cumulé par article sur plusieurs réceptions partielles).
4. **Pas de débit de stock** : le stock a déjà été déduit à la 3ème signature. La réception ne doit **jamais** modifier `quantite_stock`.
5. **Mouvement de traçabilité** : création d'un mouvement "Réception physique" lié à la sortie.
6. **Notifications outbox** : `reception_partielle` ou `reception_complete` envoyée au destinataire via SSE avec retry et backoff.
7. **Idempotence** : même clé d'idempotence (`idem_key`) = même opération, pas de doublon (contrainte unique sur sortie + eventType + recipientId).
8. **Rollback transactionnel** : en cas d'échec (ex. création de mouvement), rollback complet de la réception et de ses lignes.
9. **Anomalies** : déclaration d'anomalie (manquant, endommagé, non conforme, autre) liée à une ligne de réception, avec workflow (ouverte → en cours → résolue / rejetée) et journal immuable.
10. **Journal d'audit** : trace immuable de toutes les actions sur les réceptions et anomalies (auteur, ancien statut, nouveau statut, date, commentaire).

---

## 6. PLAN DE CORRECTION

### Phase 1 — Connecter le frontend à l'API réception-physique (priorité critique)

1. Remplacer `receptions.push(nouvelleReception)` dans `frontend/src/components/reception/FormulaireRéception.tsx` par un appel `POST /api/receptions-physiques` via `api.ts`.
2. Remplacer `receptionAnomalies.push(nouvelleAnomalie)` dans `frontend/src/components/reception/DéclarationAnomalie.tsx` par un appel API vers une anomalie (à créer si nécessaire sur `andry`).
3. Relier `frontend/src/components/reception/HistoriqueRéceptions.tsx` à `GET /api/receptions-physiques` pour afficher les réceptions persistées.
4. Ajouter dans `frontend/src/lib/api.ts` : fonctions `creerReceptionPhysique`, `listerReceptionsPhysiques`, `getReceptionPhysique`.
5. Vérifier que le contrôleur `reception-physique` sur `andry` accepte l'appel frontend (rôle, CORS, authentification).

### Phase 2 — Ajouter les tests (priorité élevée)

1. Créer `backend/tests/reception-physique.test.js` :
   - Création de réception (sortie `sortie_effectuee`, même direction, rôle demandeur)
   - Refus 403 si rôle non autorisé
   - Refus 400 si sortie n'est pas `sortie_effectuee`
   - Refus 403 si direction différente
   - Vérification qu'aucun `UPDATE materials` n'est émis (pas de double débit)
2. Créer `frontend/src/components/reception/FormulaireRéception.test.tsx` : soumission, appel API, persistance.
3. Créer `frontend/src/components/reception/DéclarationAnomalie.test.tsx` : déclaration, appel API.
4. Vérifier l'absence de régression sur les tests existants (`sortie-logistique.test.js`, `sortie-remise.test.js`, `notification-outbox.test.js`).

### Phase 3 — Fusionner le worktree (priorité élevée)

1. Fusionner les API `reception`, `reception-ligne`, `anomalie`, `journal-action` du worktree `.claude/worktrees/reception-physique` vers `andry`.
2. Fusionner les tests : `reception-creation.test.js`, `reception-outbox.test.js`, `reception-permissions.test.js`, `reception-routes.test.js`.
3. Mettre à jour `backend/src/index.js` avec `RECEPTION_ACTIONS`, `ANOMALIE_ACTIONS`, `JOURNAL_ACTION_ACTIONS` et les rôles `depositaire`.
4. Ajouter les EVENT_TYPE `reception_partielle`, `reception_complete`, `anomalie_ouverte`, `anomalie_resolue` à `backend/src/api/notification-outbox/services/notification-outbox.js`.

### Phase 4 — Notifications et journal (priorité moyenne)

1. Ajouter la création d'entrées outbox `reception_complete` / `reception_partielle` après création de réception (dans le contrôleur ou service).
2. Vérifier la livraison SSE et le retry/backoff via `distribuerNotifications`.

---

## 7. CONCLUSION

Sur la branche `andry`, le circuit de sortie (3 signatures, débit de stock à la 3ème signature, remise physique sans impact sur le stock) est **implémenté et vérifié** par le code et les tests existants. Il n'y a **pas de double déduction de stock** : le débit intervient une seule fois à la signature logistique, protégé par le verrou `stock_impacte`, et ni `remise` ni `reception-physique.create` ne touchent à `quantite_stock`.

Cependant, la **réception physique n'est pas fonctionnelle en pratique** : le backend expose une API `reception-physique` (création, lecture, filtrage par direction, rôle `demandeur`), mais le frontend ne l'appelle pas — toutes les saisies de réception et d'anomalie restent en mémoire locale (`push` sur tableaux vides) et sont perdues au rafraîchissement de la page. Aucun test ne couvre la réception-physique sur `andry`.

L'implémentation complète (réception par lignes avec reliquat cumulé, statut en_cours/partielle/complète, idempotence par clé client, rollback transactionnel, notifications outbox `reception_complete`/`reception_partielle`, anomalie avec workflow et journal immuable) existe uniquement dans le **worktree** `.claude/worktrees/reception-physique`, non fusionné sur `andry`.

**Recommandation** : connecter d'urgence le frontend à l'API `reception-physique` existante, ajouter des tests de réception (notamment pour prouver l'absence de double débit), puis fusionner le worktree pour disposer du flux complet avec anomalies, journal et notifications.

---

### Preuves annexes (références de code)

| Référence | Fichier | Lignes | Élément |
|-----------|---------|--------|---------|
| Débits stock | `backend/src/api/sortie/controllers/sortie.js` | 273-541 | `signerLogistique` — débit atomique, verrou `stock_impacte`, mouvements, outbox |
| Remise sans stock | `backend/src/api/sortie/controllers/sortie.js` | 964-1209 | `remise` — `sortie_effectuee`, aucun `UPDATE materials`, mouvement "Remise au détenteur" |
| Route remise | `backend/src/api/sortie/routes/sortie.js` | 50-53 | `POST /sorties/:id/remise` → `sortie.remise` |
| API réception | `backend/src/api/reception-physique/controllers/reception-physique.js` | — | `create`/`find`/`findOne`, rôle `demandeur`, `sortie_effectuee`, même direction |
| Schéma réception | `backend/src/api/reception-physique/content-types/reception-physique/schema.json` | — | `quantite_prevue`, `quantite_recue`, `statut` [conforme/anomalie], `type_anomalie`, `description_anomalie` |
| Permissions réception | `backend/src/index.js` | 503-507 | `RECEPTION_PHYSIQUE_ACTIONS` — find/findOne/create, rôle `demandeur` uniquement |
| Service outbox | `backend/src/api/notification-outbox/services/notification-outbox.js` | — | `EVENT_TYPE_PAR_ROLE`, `distribuerNotifications`, SSE + retry, idempotence |
| Réception local-only | `frontend/src/components/reception/FormulaireRéception.tsx` | 99 | `receptions.push(nouvelleReception)` — "l'API n'est pas encore connectée" |
| Anomalie local-only | `frontend/src/components/reception/DéclarationAnomalie.tsx` | 62 | `receptionAnomalies.push(nouvelleAnomalie)` — "l'API n'est pas encore connectée" |
| Tableaux vides | `frontend/src/lib/movements.ts` | 742, 744 | `receptions: []`, `receptionAnomalies: []` |
| API client | `frontend/src/lib/api.ts` | — | Aucune fonction pour `/api/receptions-physiques` |
| Tests worktree | `.claude/worktrees/reception-physique/backend/tests/` | — | `reception-creation.test.js` (R1-R22), `reception-outbox.test.js`, `reception-permissions.test.js`, `reception-routes.test.js` |
