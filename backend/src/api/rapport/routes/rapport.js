'use strict';

/**
 * rapport routes — REDDITION DE COMPTE (lecture seule).
 *
 * ⚠️ Les routes custom sont déclarées explicitement (createCoreRouter ignore
 * toute config non-core) — cf. affectation/routes/affectation.js.
 *
 * L'accès est contrôlé à deux niveaux :
 *   - auth: true exige une session Users & Permissions valide ;
 *   - le contrôleur vérifie le rôle (dépositaire, comptable, logistique,
 *     admin) via utils/rapportsGuard.js.
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/rapports/recapitulation',
      handler: 'rapport.recapitulation',
    },
    {
      method: 'GET',
      path: '/rapports/recapitulations',
      handler: 'rapport.recapitulations',
    },
    {
      method: 'GET',
      path: '/rapports/etat-appreciatif',
      handler: 'rapport.etatAppreciatif',
    },
    {
      method: 'GET',
      path: '/rapports/inventaire',
      handler: 'rapport.inventaire',
    },
    {
      method: 'GET',
      path: '/rapports/grand-livre',
      handler: 'rapport.grandLivre',
    },
    {
      method: 'GET',
      path: '/rapports/bordereau',
      handler: 'rapport.bordereau',
    },
  ],
};
