# Déploiement — Pattern Outbox (notifications SSE de validation de sortie)

## Vue d'ensemble

Ce document décrit la procédure de déploiement, de rollback et les risques résiduels du pattern outbox implémenté pour garantir l'idempotence des notifications SSE émises lors de `signerLogistique()` (signature 3, validation + débit de stock).

Le pattern outbox repose sur :
- Une table persistante `notification_outboxes` avec contrainte unique sur `(sortie_document_id, event_type, recipient_id)`.
- Une création transactionnelle des entrées outbox dans `signerLogistique()` (même transaction que le débit de stock et la signature).
- Un distributeur (`distribuerNotifications`) qui revendique atomiquement les entrées `pending`, les envoie via SSE, puis les marque `sent`/`failed`/`pending` (retry).
- Une nouvelle route `GET /api/notification-outbox/notifications` filtrée par destinataire connecté.

## 1. Déploiement

### Prérequis

- Base de données PostgreSQL (production) ou better-sqlite3 (développement).
- Strapi 5.53.0 backend.
- Le module `backend/src/lib/notifications.js` (SSE in-memory Map) doit être déployé et actif sur chaque instance du backend.

### Étapes

1. **Appliquer la migration SQL**
   Exécuter `backend/database/migrations/001_create_notification_outbox.sql` sur la base de production PostgreSQL.
   > ⚠️ Ce fichier est fourni à titre de référence. L'équipe doit l'adapter à son outil de migration (Knex, pg-migrate, etc.) avant exécution en production. Il ne doit **pas** être exécuté directement sur la base de production sans révision.

2. **Déployer le code backend**
   Déployer les nouveaux fichiers et modifications :
   - `backend/src/api/notification-outbox/` (content-type, service, controller, routes)
   - `backend/src/api/sortie/controllers/sortie.js` (modification de `signerLogistique`)
   - `backend/src/index.js` (permissions, constantes `NOTIFICATION_OUTBOX_ACTIONS` / `ROLES_NOTIFICATION_OUTBOX`)
   - `backend/src/utils/destinatairesNotifications.js` (utilitaire `findUtilisateursParRoleEtDirection`)

3. **Vérifier les permissions**
   Le bootstrap dans `backend/src/index.js` accorde l'action `find` sur `notification-outbox` aux rôles métier + `admin applicatif`. Vérifier que ces rôles existent dans Strapi après déploiement.

4. **Vérifier le contenu-type Strapi**
   Le fichier `backend/src/api/notification-outbox/content-types/notification-outbox/schema.json` déclare le content-type. Strapi doit le détecter au démarrage. Vérifier dans l'interface d'administration Strapi que le content-type `notification-outbox` est visible.

5. **Tests de fumée**
   - Valider une sortie complète (magasinier → dépositaire → logistique).
   - Vérifier qu'une entrée `notification-outbox` est créée par destinataire.
   - Vérifier que `GET /api/notification-outbox/notifications` retourne les notifications du destinataire connecté.
   - Vérifier qu'une deuxième validation de la même sortie est refusée (déjà `validee`).

## 2. Rollback

### Rollback technique (code)

Revert du commit qui introduit l'outbox. Le code précédent (`signerLogistique` sans outbox, sans `distribuerNotifications`) est restauré. Les notifications SSE sont émises directement (sans persistance), ce qui rétablit le comportement antérieur (risque de perte de notification si le flux SSE est fermé au moment de l'envoi).

### Rollback base de données

La table `notification_outboxes` peut être conservée (vide) ou supprimée :

```sql
DROP TABLE IF EXISTS notification_outboxes;
```

> ⚠️ Ne pas supprimer la table si des entrées outbox non traitées (`pending`, `processing`) existent : elles seraient perdues. Dans ce cas, vider d'abord la table via le distributeur ou supprimer les entrées manuellement.

### Rollback partiel (uniquement l'outbox, garder le reste)

Si seul le pattern outbox doit être désactivé tout en gardant les autres modifications de `signerLogistique`, commenter l'appel à `distribuerNotifications(app)` dans `sortie.js` (après le commit de la transaction). Les entrées outbox ne seraient plus créées, et le comportement revient à l'envoi SSE direct (si tel était le code avant l'outbox).

## 3. Risques résiduels

| Risque | Description | Atténuation |
|--------|-------------|-------------|
| **Perte de notification si le flux SSE est fermé** | Si aucun flux SSE ouvert n'existe pour le destinataire au moment de `envoyerEntree`, `sseBroadcastToUser` retourne 0 sans erreur. L'entrée est marquée `sent` bien qu'aucun client n'ait reçu l'événement. | Le frontend doit gérer la réconciliation (rechargement des notifications via `GET /api/notification-outbox/notifications` à la connexion). |
| **Double envoi en cas de crash entre envoi et marquage** | Si le worker crash après `sseBroadcastToUser` mais avant `marquerEnvoyee`, l'entrée reste `processing` et pourra être revendiquée par un autre worker, provoquant un double envoi SSE. | Le frontend déduplique les notifications par id (chaque notification SSE a un id unique `realtime-...`). Le risque de double affichage est donc limité côté client. |
| **Entrées bloquées en `processing`** | Si un worker revendique une entrée (`pending` → `processing`) puis crash avant de la traiter, l'entrée reste bloquée en `processing` et ne sera jamais retryée. | Mettre en place un job de nettoyage périodique qui remet en `pending` les entrées `processing` anciennes (ex. > 5 min) sans `last_attempt_at` récent. |
| **Perte des entrées en cas de suppression de la table** | Supprimer `notification_outboxes` en production entraînerait la perte de toutes les notifications en attente ou en échec. | Ne jamais supprimer la table sans avoir d'abord vidé ou archivé les entrées. |
| **Dépendance à la disponibilité de Strapi** | `distribuerNotifications` est appelé depuis `signerLogistique` (synchrone après commit). Si Strapi est surchargé, le distributeur peut ralentir la réponse de validation. | L'appel à `distribuerNotifications` est dans un `try/catch` qui logge l'erreur sans faire échouer la validation. La sortie reste validée même si la distribution échoue. |
| **Conflit de clé unique en cas de reprise manuelle** | Si des entrées outbox sont créées manuellement (en dehors de `creerEntrees`), la contrainte unique sur `(sortie_document_id, event_type, recipient_id)` peut bloquer la création légitime. | Ne créer des entrées outbox que via `creerEntrees` (qui est appelé dans la transaction de `signerLogistique`). |
| **SSE in-memory non partagé entre instances** | Le Map SSE est en mémoire, donc une notification publiée sur l'instance A n'est pas reçue par un client connecté sur l'instance B. | Déployer un sticky session ou un pub/sub inter-instances (Redis) si le backend est horizontalement scalé. Actuellement, le Map SSE est monolithique. |

## 4. Tests

- `backend/tests/notification-outbox.test.js` : 10 cas couvrant l'idempotence, la concurrence, l'isolation de direction, le retry, la reprise des entrées `pending`, etc.
- `backend/tests/sortie-distribution-directions.test.js` : 12 cas couvrant le flux de distribution multi-directions et l'isolation des notifications.
- `backend/tests/sortie-lecture.test.js` : 11 cas de régression sur les lectures de sortie.

## 5. Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `database/migrations/001_create_notification_outbox.sql` | Création de la table outbox (PostgreSQL) |
| `src/api/notification-outbox/content-types/notification-outbox/schema.json` | Déclaration du content-type Strapi |
| `src/api/notification-outbox/services/notification-outbox.js` | Service distributeur (revendication, envoi, marquage) |
| `src/api/notification-outbox/controllers/notification-outbox.js` | Controller `find` (route `GET /notifications`) |
| `src/api/notification-outbox/routes/notification-outbox.js` | Déclaration de la route `GET /notifications` |
| `src/api/sortie/controllers/sortie.js` | `signerLogistique` : crée les entrées outbox dans la transaction |
| `src/index.js` | Permissions bootstrap + constantes rôles |
| `src/utils/destinatairesNotifications.js` | `findUtilisateursParRoleEtDirection` (résolution des destinataires) |
| `src/lib/notifications.js` | SSE in-memory (`sseBroadcastToUser`, `sseRegister`, etc.) |
| `tests/notification-outbox.test.js` | 10 tests outbox |
| `tests/sortie-distribution-directions.test.js` | Tests de distribution multi-directions |
