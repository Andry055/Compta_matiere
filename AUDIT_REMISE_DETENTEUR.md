# Audit — Séquence « remise au détenteur » (8 étapes)

**Repo** : `D:\projet\Compta-main` (branche `andry`, PRs vers `main`)
**Date** : 2026-10-21
**Objectif** : vérifier, pour chacune des 8 étapes décrites dans le contenu collé (Avis, Préparation, Impression du bon, Rencontre, Signature papier, Enregistrement, Effets automatiques, Archivage), si elle est implémentée côté backend (routes/controllers/services/DB) et frontend (pages/composants), et identifier les écarts.

Légende des statuts : **IMPLÉMENTÉ** | **PARTIEL** | **MANQUANT** | **CONCEPTUEL**

---

## Récapitulatif des rôles et règles métier attendues

| Rôle | Peut faire | Ne peut PAS faire |
|------|-----------|-------------------|
| Magasinier | Préparer (sig 1), Remettre | Chef logistique ne remet PAS |
| Dépositaire comptable | Signer (sig 2), Remettre | — |
| Chef logistique | Signer (sig 3) + valider + débiter stock | Remettre |
| Détenteur | Signer sur papier (pas de compte actif) | — |
| Mandataire | Retirer pour le compte du détenteur | — |

**Règle de stock** : le stock est décrémenté UNIQUEMENT à la signature logistique (étape 4), jamais à la remise (étape 6-7).

---

## Statut par étape

### Étape 1 — Avis (notification à la direction)

**Statut : MANQUANT**

Le contenu collé précise : *« Rien ne prévient la direction aujourd'hui »*. L'audit confirme cet écart.

- **Backend** : le contrôleur `remise` émet un événement SSE `demande_aboutie` à destination du **demandeur** uniquement (pas de notification vers la direction à l'étape 1). Aucune route/notification n'avise la direction qu'un ordre est prêt à être distribué.
- **Frontend** : `App.tsx` écoute les événements SSE `demande_aboutie` uniquement pour le rôle `demandeur` (toast + cloche). Aucun écran ni alerte pour la direction à l'étape 1.
- **Écart** : il manque une notification « avis » vers la direction (ou le responsable de service) lorsqu'un ordre de sortie est créé / prêt à être préparé.

### Étape 2 — Préparation (création de l'ordre de sortie)

**Statut : IMPLÉMENTÉ**

- **Backend** : `createComplete` (`POST /sorties/create-complete`) crée l'ordre avec statut `en_preparation`, réservé au dépositaire/admin.
- **Frontend** : `NouvelOrdreSortie.tsx` (réservé dépositaire) — création d'ordre (date, justificatif, direction, service, bénéficiaire, lignes, demande liée) avec préremplissage depuis une demande approuvée.
- **Route** : `POST /sorties/create-composite` déclarée dans `routes/sortie.js`.

### Étape 3 — Impression du bon de sortie

**Statut : PARTIEL**

- **Backend** : aucun endpoint dédié d'impression/PDF dans `routes/sortie.js`. Le PDF est généré intégralement côté frontend.
- **Frontend** : `bonSortieDocument.ts` (`genererPdfBonSortie` via jsPDF + jspdf-autotable, A4 portrait, tableau matériel, bloc garde-réception, clause responsabilité) existe et est utilisé.
- **Usage** : le bouton « Imprimer le bon de sortie » (avant) / « Imprimer le bon de sortie signé » (après) se trouve dans `RemiseOrdreSortie.tsx`, c'est-à-dire à l'**étape 6**, pas à l'étape 3 proprement dite.
- **Écart** : pas de traçabilité d'impression (qui a imprimé, quand), pas d'étape d'impression dédiée à l'étape 3 ; le PDF existe mais n'est pas déclenché au bon moment de la séquence.

### Étape 4 — Rencontre (magasinier / dépositaire rencontrent le détenteur)

**Statut : CONCEPTUEL**

La rencontre est un événement physique ; elle n'est pas directement modélisable en code. Le circuit la prépare via les signatures 1 (magasinier) et 2 (dépositaire) qui l'encadrent.

- **Backend** : aucune fonctionnalité dédiée « rencontre » (ce qui est cohérent : c'est un événement hors-système).
- **Frontend** : aucun écran dédié « rencontre ». Les signatures 1/2 dans `PreparationOrdreSortie.tsx` et `DepositaireOrdreSortie.tsx` constituent la trace système de cet événement.

### Étape 5 — Signature papier (3 signatures)

**Statut : IMPLÉMENTÉ**

| Signature | Frontend | Backend | Statut |
|-----------|----------|---------|--------|
| 1 — Magasinier | `PreparationOrdreSortie.tsx` | `sign` (order=1) | ✅ |
| 2 — Dépositaire | `DepositaireOrdreSortie.tsx` | `sign` (order=2) | ✅ |
| 3 — Chef logistique | `AutorisationOrdreSortie.tsx` | `signerLogistique` (validation + débit stock atomique) | ✅ |

- **Contrôles backend** : ordre strict des signatures, 409 en cas de double signature, stock vérifié à la signature 3, transaction `strapi.db.transaction` (validation + baisse stock), statut `validee`.
- **Contrôles frontend** : chaque ligne doit avoir un état renseigné, être cochée « présent et quantité vérifiée », et une remarque est obligatoire si état « défaillant ».
- **Espace logistique** : `EspaceLogistiqueSorties.tsx` avec onglets « À autoriser » / « En préparation chez les autres » / « Autorisées ».

### Étape 6 — Enregistrement (remise au détenteur)

**Statut : IMPLÉMENTÉ**

- **Backend** : `remise` (`POST /sorties/:documentId/remise`) — `detenteur_nom` + `detenteur_fonction` obligatoires (150 max), `mandataire_nom` optionnel, `date_remise` validée (YYYY-MM-DD, pas future, pas antérieure à la validation logistique), transaction : mise à jour sortie + demande liée (statut `sortie_effectuee`), création du mouvement « Remise au détenteur », **aucun impact stock**, SSE `demande_aboutie` au demandeur.
- **Autorisation** : réservé `magasinier` / `depositaire` (403 sinon). **Chef logistique explicitement EXCLU** (`ROLES_REMISE_SORTIE = ['magasinier', 'depositaire']`), conforme à l'exigence « Ne remet pas : chef logistique ».
- **Frontend** : `RemiseOrdreSortie.tsx` — formulaire complet (détenteur nom/fonction obligatoires, mandataire optionnel, date avec max=aujourd'hui, checkbox « matériel confirmé »), verrou anti double-clic, gestion du résultat incertain (rechargement + conclusion sur état réel), bouton impression bon signé, modal d'avertissement irréversible.
- **Accès** : onglet `a_remettre` dans `EspaceMagasinierSorties.tsx` (magasinier) et `ListeOrdresSortie.tsx` (dépositaire), bouton « Remettre ».

### Étape 7 — Effets automatiques (serveur)

**Statut : IMPLÉMENTÉ**

- Statut passe à `sortie_effectuee` (sortie) et la demande liée est mise à jour.
- Mouvement d'audit « Remise au détenteur » créé (statut `sortie_effectuee`), consultable via `GET /sorties/:documentId/mouvements` (`findMouvements`, ordonné par `date_mouvement` asc).
- SSE `demande_aboutie` poussée au demandeur (toast + cloche + `notificationVersion`).
- **Stock non touché** à la remise (déjà débité à l'étape 4) — conforme à la règle métier.

### Étape 8 — Archivage (archivage / réimpression)

**Statut : MANQUANT**

- Aucun statut « archivé », aucun flag d'archivage, aucune route d'archivage dans `routes/sortie.js`.
- `findDistributions` liste les sorties `validee` / `sortie_effectuee` mais il n'existe pas de fonctionnalité d'archivage explicite ni de réimpression du bon signé après archivage.
- **Écart** : il manque un mécanisme d'archivage des sorties effectuées et une possibilité de réimpression du bon de sortie signé a posteriori.

---

## Tableau récapitulatif

| Étape | Nom | Statut | Preuve principale | Écart |
|-------|-----|--------|-------------------|-------|
| 1 | Avis | **MANQUANT** | Aucune notification direction | Notifier la direction à la création/préparation |
| 2 | Préparation | **IMPLÉMENTÉ** | `createComplete`, `NouvelOrdreSortie.tsx` | — |
| 3 | Impression du bon | **PARTIEL** | `bonSortieDocument.ts`, bouton dans `RemiseOrdreSortie.tsx` | Pas d'étape dédiée à l'étape 3, pas de traçabilité d'impression |
| 4 | Rencontre | **CONCEPTUEL** | Signatures 1/2 encadrent la rencontre physique | Aucun écran dédié (événement hors-système) |
| 5 | Signature papier | **IMPLÉMENTÉ** | 3 signatures backend + frontend | — |
| 6 | Enregistrement | **IMPLÉMENTÉ** | `remise` controller + route + `RemiseOrdreSortie.tsx` | — |
| 7 | Effets automatiques | **IMPLÉMENTÉ** | Statut `sortie_effectuee`, mouvement audit, SSE `demande_aboutie` | — |
| 8 | Archivage | **MANQUANT** | Aucun statut/flag d'archivage | Archivage + réimpression du bon signé |

---

## Points de conformité vérifiés (conformes au contenu collé)

1. **Remettent : magasinier ou dépositaire comptable** — confirmé : `ROLES_REMISE_SORTIE = ['magasinier', 'depositaire']` dans `index.js`, contrôle 403 dans le contrôleur `remise`.
2. **Ne remet pas : chef logistique** — confirmé : `chef logistique` exclu de `ROLES_REMISE_SORTIE`.
3. **Détenteur : pas de compte actif, signe sur papier** — confirmé : `detenteur_nom` / `detenteur_fonction` sont des champs texte saisis à la remise, aucun compte utilisateur détenteur n'est créé.
4. **Mandataire possible** — confirmé : `mandataire_nom` optionnel dans le payload de remise et dans `StrapiEntity`.
5. **Stock débité uniquement à l'étape 4 (logistique)** — confirmé : `signerLogistique` décrémente le stock dans une transaction ; `remise` n'y touche pas.
6. **Séparation des signatures avec ordre strict** — confirmé : `sign` applique l'ordre magasinier(1) → dépositaire(2) → logistique(3), 409 en cas de double signature.

---

## Recommandations (priorité)

1. **Étape 1 — Avis** : ajouter une notification SSE (ou une entrée dans la cloche) vers la direction/le responsable de service lorsqu'un ordre de sortie passe en `en_preparation`.
2. **Étape 3 — Impression** : déplacer/exposer le bouton d'impression du bon à l'étape 3 (après préparation, avant rencontre) et ajouter une traçabilité d'impression (qui, quand).
3. **Étape 8 — Archivage** : ajouter un statut/drapeau `archivé` sur les sorties `sortie_effectuee`, une route d'archivage, et une fonction de réimpression du bon signé depuis l'historique.
