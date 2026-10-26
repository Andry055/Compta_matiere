# Rapport d'audit — Module réception physique

**Projet :** D:\projet\Compta-main — branche `andry`  
**Date :** 2026-10-25  
**Auteur :** Claude Code (assistant)  
**Statut :** Correctifs appliqués, tests frontend 395/395 OK, tests backend réception 22/22 OK

---

## 1. Résumé exécutif

Deux problèmes étaient signalés par l'utilisateur :

| Problème | Symptôme | Cause racine | Statut |
|----------|----------|--------------|--------|
| **P1** : Notifications non reçues | Le panneau notifications affiche des dates sans messages ; le magasinier et le dépositaire n'ont pas leurs notifications après enregistrement d'une réception physique | Le backend tourne encore avec l'ancien contrôleur (non redémarré avec le code corrigé). L'ancien contrôleur ne crée aucune entrée outbox pour le magasinier et notifie le dépositaire via un `user.id` hardcodé au lieu de l'annuaire rôle→direction. | Frontend corrigé. Backend corrigé mais **non redémarré**. |
| **P2** : Articles qui reviennent dans « À réceptionner » | Une réception confirmée disparaît de « À réceptionner », puis réapparaît après redémarrage du backend | `listerReceptionsPhysiques()` dans `frontend/src/lib/api.ts` ne mappe pas le champ `sortieId` depuis la réponse Strapi. Strapi 5 retourne la relation `sortie` comme un objet peuplé (`{ documentId, id }`), jamais comme un champ plat `sortieId`. Résultat : `getQuantiteDejaRecue()` ne trouve aucune correspondance, le reliquat reste égal à la quantité totale, et la sortie reste affichée dans « À réceptionner ». | **Corrigé et testé.** |

---

## 2. Problème 1 — Notifications non affichées

### 2.1 Flux de données (avec le code corrigé)

1. **Backend — `reception-physique.js` (contrôleur)** : à la création d'une réception, le contrôleur appelle `creerEntrees()` pour deux listes de destinataires :
   - **Dépositaires** (rôle `demandeur` de la direction de la sortie) → `eventType: 'demande_aboutie'`, message : *« Votre réception physique de la sortie X a été enregistrée avec succès. »*
   - **Magasiniers** (rôle `magasinier` de la direction de la sortie) → `eventType: 'ordre_sortie_autorise'`, message : *« La réception physique de la sortie X a été confirmée par le dépositaire. »*

2. **Backend — `notification-outbox/services/notification-outbox.js`** : `distribuerNotifications()` revendique atomiquement les entrées `pending` et appelle `sseBroadcastToUser(recipientId, eventType, payload)` avec un `userId` **numérique** (`Number(entree.recipientId)`).

3. **Backend — `lib/notifications.js`** : `sseBroadcastToUser(userId, event, data)` regarde `streams.get(userId)` et écrit sur tous les flux SSE enregistrés pour cet utilisateur.

4. **Frontend — `App.tsx`** : `connectSSE(currentUser.strapiId, jwt)` où `currentUser.strapiId = user.id` (id numérique Strapi, via `mapStrapiUser` dans `session.ts`). Les trois gestionnaires d'événements SSE écoutent `demande_aboutie`, `ordre_pret_distribution` et `ordre_sortie_autorise`, et appellent `pushRealtimeNotification(..., currentUser.role)` avec `targetRole` = rôle de l'utilisateur connecté.

5. **Frontend — `notifications.ts`** : `getNotifications(user)` pour magasinier/dépositaire fusionne `getNotificationsGeneriques()` + `readAll().filter((n) => n.targetRole === user.role)`. Les notifications temps réel sont stockées avec `targetRole` égal au rôle du destinataire.

### 2.2 Pourquoi les notifications ne s'affichent pas

**Cause racine : le backend n'a pas été redémarré avec le nouveau contrôleur.**

Les modifications du contrôleur `reception-physique.js` (notification du magasinier via `findUtilisateursParRoleEtDirection(app, 'magasinier', directionId)`, notification du dépositaire via l'annuaire rôle→direction au lieu du `user.id` hardcodé) sont présentes sur disque mais le serveur Strapi tourne encore avec l'ancien code. Tant que l'ancien contrôleur est actif :

- Aucune entrée outbox n'est créée pour le **magasinier** (l'ancien code n'appelait pas `findUtilisateursParRoleEtDirection` avec le rôle `magasinier`).
- La notification du **dépositaire** est envoyée à l'utilisateur connecté (`user.id`) plutôt qu'au dépositaire de direction (qui peut être une personne différente).

### 2.3 Preuves

- `backend/src/api/reception-physique/controllers/reception-physique.js` (version corrigée) : lignes 159-196 créent les deux entrées outbox (dépositaire puis magasinier). L'ancien code n'en créait qu'une pour le dépositaire avec un tableau hardcodé.
- `backend/src/api/notification-outbox/services/notification-outbox.js` : `EVENT_TYPE_PAR_ROLE` définit `magasinier → 'ordre_sortie_autorise'` et `demandeur → 'demande_aboutie'`.
- `backend/src/lib/notifications.js` : `sseBroadcastToUser(userId, ...)` utilise un id numérique, concordant avec `currentUser.strapiId` côté frontend.
- `backend/tests/reception-physique.test.js` : **22/22 passent** (dont Test 12 : notification magasinier, Test 10 : pas de second débit stock).

### 2.4 Action requise

Redémarrer le serveur Strapi avec le nouveau contrôleur déjà déployé sur disque. Aucun autre changement backend n'est nécessaire.

---

## 3. Problème 2 — Articles qui reviennent dans « À réceptionner »

### 3.1 Flux de données

1. **Frontend — `FormulaireRéception.tsx`** : envoie `sortieId: sortie.id` (le `documentId` Strapi de la sortie) à `creerReceptionPhysique()`.
2. **Backend — `reception-physique.js`** : transforme `sortieId` en relation `sortie` et enregistre la réception dans Strapi (SQLite). La réception est bien **persistée** et survit au redémarrage.
3. **Frontend — `api.ts` — `listerReceptionsPhysiques()`** : lit les réceptions depuis Strapi avec `populate: { sortie: { populate: { direction: true } } }`. Strapi 5 retourne la relation comme un **objet peuplé** (`{ documentId: "...", id: 123, ... }`), pas comme un champ plat `sortieId`.
4. **Frontend — `movements.ts` — `getQuantiteDejaRecue()`** : filtre les réceptions par `r.sortieId === sortieId`. Comme `r.sortieId` est `undefined` pour toutes les réceptions serveur, le filtre ne matche jamais.
5. **Frontend — `movements.ts` — `getReliquat()`** : retourne `sortie.quantite - 0 = sortie.quantite > 0`.
6. **Frontend — `movements.ts` — `sortiesRéceptionnables()`** : exclut une sortie seulement si `getReliquat(s, receptionsServeur) <= 0`. Comme le reliquat est toujours > 0, la sortie reste dans « À réceptionner ».

### 3.2 Pourquoi le problème apparaît après redémarrage

Avant le redémarrage, le tableau local `receptions` (rempli par `FormulaireRéception` à la ligne 143 de `FormulaireRéception.tsx`) masquait partiellement le bug : les receptions créées localement étaient trouvées par `getQuantiteDejaRecue` car elles ont un `sortieId` défini. Après redémarrage, seule `receptionsServeur` (chargée depuis Strapi via `listerReceptionsPhysiques()`) est utilisée, et comme `sortieId` est `undefined` pour toutes ces réceptions, le reliquat ne peut jamais être calculé correctement. Toutes les sorties réapparaissent donc dans « À réceptionner ».

### 3.3 Preuves

- `frontend/src/lib/api.ts` (ligne 1805-1824, avant correction) : `listerReceptionsPhysiques()` retourne `rows` tel quel, sans mapping de `sortieId`.
- `frontend/src/lib/movements.ts` (lignes 758-769) : `getQuantiteDejaRecue()` filtre par `r.sortieId === sortieId` — jamais vrai si `sortieId` est `undefined`.
- `frontend/src/lib/movements.ts` (lignes 823-842) : `sortiesRéceptionnables()` exclut seulement si `getReliquat <= 0`.

### 3.4 Correctif appliqué

**`frontend/src/lib/api.ts`** — `listerReceptionsPhysiques()` mappe désormais chaque ligne pour extraire `sortieId` depuis la relation `sortie` :

```ts
const rows: Array<ReceptionPhysiqueRecord> = (data?.data ?? []).map((row: any) => ({
  ...row,
  sortieId: row.sortie?.documentId || row.sortieId || undefined,
}));
```

Avec ce correctif, `getQuantiteDejaRecue()` trouve bien les réceptions serveur par correspondance `sortieId === sortieId`, le reliquat descend à 0 quand la réception est complète, et la sortie est définitivement exclue de « À réceptionner ».

### 3.5 Test ajouté

**`frontend/src/lib/api.receptionPhysique.test.ts`** — nouveau test : « listerReceptionsPhysiques extrait sortieId depuis la relation sortie (populate) ». Vérifie qu'une réponse Strapi avec `sortie: { documentId: "sortie-doc-1" }` produit une réception avec `sortieId === "sortie-doc-1"`.

---

## 4. État des tests

### Frontend (Vitest)

| Fichier | Tests | Résultat |
|---------|-------|----------|
| Tous les fichiers | 395 | ✅ Tous passent |
| `src/lib/api.receptionPhysique.test.ts` | 6 | ✅ (dont le nouveau test sortieId) |
| `src/components/reception/App.test.tsx` | 4 | ✅ (SSE, toasts, outbox réconciliation) |
| `src/components/reception/FormulaireRéception.test.tsx` | 3 | ✅ (callback, payload, échec) |
| `src/lib/movements.test.ts` | ~40 | ✅ (sortiesRéceptionnables, getReliquat, getQuantiteDejaRecue) |

### Backend (node:test)

| Fichier | Tests | Résultat | Note |
|---------|-------|----------|------|
| `tests/reception-physique.test.js` | 22 | ✅ Tous passent | Contrôleur modifié — inclut Test 12 (notification magasinier), Test 10 (pas de second débit) |
| `tests/reception-creation.test.js` | 0 | ❌ Échec | Importe `reception.js` (fichier différent, non modifié) — échec pré-existant |
| `tests/notification-outbox.test.js` | 12/17 | ⚠️ 5 échecs | Tests attendent `EVENT_TYPE_RECEPTION` qui n'existe pas — échec pré-existant |
| `tests/reception-outbox.test.js` | — | ⚠️ Même cause | Idem ci-dessus |

Les échecs backend (`reception-creation.test.js`, `notification-outbox.test.js`, `reception-outbox.test.js`, `reception-permissions.test.js`, `reception-routes.test.js`, `reception-schemas.test.js`) sont **pré-existants** : ils importent soit d'un fichier contrôleur différent (`reception.js` au lieu de `reception-physique.js`), soit testent des fonctionnalités non implémentées (`EVENT_TYPE_RECEPTION`). Aucun n'est lié à mes modifications.

---

## 5. Modifications apportées

### Fichiers modifiés (cette session)

| Fichier | Modification | Problème adressé |
|---------|-------------|------------------|
| `frontend/src/lib/api.ts` | `listerReceptionsPhysiques()` mappe `sortieId` depuis `row.sortie.documentId` | P2 (reliquat / « À réceptionner ») |
| `frontend/src/lib/api.receptionPhysique.test.ts` | Ajout d'un test pour l'extraction `sortieId` | P2 (validation) |

### Fichiers modifiés (sessions antérieures, déjà sur disque)

| Fichier | Modification | Problème adressé |
|---------|-------------|------------------|
| `backend/src/api/reception-physique/controllers/reception-physique.js` | Notification dépositaire via `findUtilisateursParRoleEtDirection(app, 'demandeur', directionId)` ; notification magasinier ajoutée ; try/catch sur les notifications | P1 (destinataires notifications) |
| `frontend/src/lib/notifications.ts` | `pushRealtimeNotification` accepte 5e paramètre `targetRole` ; `getNotifications` filtre par `targetRole` pour magasinier/dépositaire | P1 (affichage notifications par rôle) |
| `frontend/src/lib/session.ts` | `mapStrapiUser` retourne `strapiId: user.id` (id numérique) | P1 (connexion SSE) |
| `frontend/src/App.tsx` | `connectSSE` utilise `currentUser.strapiId` avec garde `!= null` ; tous les `pushRealtimeNotification` passent `currentUser.role` comme `targetRole` | P1 (SSE + affichage) |
| `frontend/src/components/reception/HistoriqueRéceptions.tsx` | Tri sur `date_reception` (snake_case) au lieu de `dateRéception` | P2 (historique) |
| `frontend/src/components/reception/App.test.tsx` | Mock `strapiId: 1` ; attente du 5e argument `targetRole` | P1 (tests) |

---

## 6. Recommandations de déploiement

1. **Redémarrer Strapi** avec le contrôleur `reception-physique.js` déjà corrigé sur disque. C'est l'action critique pour activer les notifications (P1).
2. **Redémarrer le frontend** pour prendre en compte le correctif `listerReceptionsPhysiques` (P2).
3. **Vider localStorage** (ou au moins la clé `appNotifications`) pour supprimer d'éventuelles notifications orphelines stockées avec l'ancien format `targetRole: 'demandeur'`.
4. **Vérifier** que les utilisateurs magasinier et dépositaire existent dans Strapi avec le rôle et la direction correctement renseignés (champ `direction` du schéma users-permissions), sinon `findUtilisateursParRoleEtDirection` retournera une liste vide et aucune notification ne sera créée.
5. **Vérifier** que le frontend se connecte au bon backend Strapi (URL dans `.env` `VITE_API_URL`) et que le JWT est valide.

---

## 7. Conclusion

Les deux problèmes ont des causes racines distinctes et indépendantes :

- **P1 (notifications)** : bloqué par le non-redémarrage du backend. Le code frontend et backend est corrigé ; il suffit de redémarrer Strapi.
- **P2 (reliquat / « À réceptionner ») : causé par l'absence de mapping `sortieId` dans `listerReceptionsPhysiques()`. Corrigé, testé, et tous les tests frontend (395/395) et backend réception (22/22) passent.

Aucune règle métier n'a été modifiée. Aucun second débit de stock n'est introduit. Les données existantes sont préservées.