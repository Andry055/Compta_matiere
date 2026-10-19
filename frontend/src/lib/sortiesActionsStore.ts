// Store LIVE partagé des ordres de sortie — LE SEUL sondage de l'application.
//
// Engagement (phase 2 — preuves) :
//   1. un seul intervalle, partagé par le menu, la cloche et l'onglet
//      Distribution : N composants montés => N requêtes, pas N × requêtes ;
//   2. le sondage tourne AUSSI hors de l'onglet Distribution (menu + cloche),
//      et se met en pause quand l'onglet est masqué (visibilitychange) ;
//   3. le DÉTAIL (populate lignes / matériel) n'est chargé que si un
//      consommateur de l'onglet Distribution l'a demandé ; le badge se
//      contente du compteur filtré serveur, la cloche de la liste légère ;
//   4. les alertes sont dérivées des données serveur (lib/sortieAlertes) :
//      AUCUNE écriture localStorage ici (l'ancien pushNotification cassait
//      les règles « pas d'alerte au premier chargement » et « l'alerte
//      disparaît quand l'ordre est signé »).
import {
  countSortiesPourPreparation,
  countSortiesAAutoriser,
  fetchAllSortiesOrThrow,
  fetchOrdresPourAlertes,
  fetchOrdresAAutoriser,
  SortieRecord,
} from "./api";
import {
  alertesVisibles,
  etatAlertesInitial,
  recalculerAlertes,
  type AlerteSorties,
  type EtatAlertesSorties,
} from "./sortieAlertes";
import { ordresAAutoriser } from "./sortieControle";

export interface SortiesActionsStoreState {
  /** Détail complet — seulement quand un lecteur Distribution est monté. */
  sorties: SortieRecord[] | null;
  /** Total serveur filtré (en_preparation + signature 1 absente), badge. */
  totalEnPreparation: number | null;
  /** Total serveur filtré (signatures 1 et 2 posées, 3 absente) — badge
   *  « Distribution » du chef logistique. Null hors consommateur logistique. */
  totalAAutoriser: number | null;
  /** Alertes encore pertinentes (au moins un ordre non signé). */
  alertes: AlerteSorties[];
  /** Alertes « nouvel ordre à autoriser » (mêmes règles, état distinct). */
  alertesAutorisation: AlerteSorties[];
  loading: boolean;
  error: boolean;
}

type Subscriber = (state: SortiesActionsStoreState) => void;

export class SortiesActionsStore {
  private state: SortiesActionsStoreState = {
    sorties: null,
    totalEnPreparation: null,
    totalAAutoriser: null,
    alertes: [],
    alertesAutorisation: [],
    loading: false,
    error: false,
  };
  private subscribers = new Set<Subscriber>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  readonly POLL_INTERVAL_MS = 20000;
  private lecteurs = 0;
  private lecteursDetail = 0;
  /** Consommateurs du compteur/alerte logistique (badge menu, cloche, espace). */
  private lecteursAutorisation = 0;
  private enPause = false;
  private releveEnCours = false;
  private alertes: EtatAlertesSorties = etatAlertesInitial();
  private alertesAutorisation: EtatAlertesSorties = etatAlertesInitial();

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () =>
        this.setEnPause(document.visibilityState !== "visible")
      );
    }
  }

  private setState(partiel: Partial<SortiesActionsStoreState>) {
    this.state = { ...this.state, ...partiel };
    this.subscribers.forEach((abonne) => abonne(this.state));
  }

  /** S'abonne à l'état partagé ; l'état courant est envoyé immédiatement. */
  subscribe(abonne: Subscriber): () => void {
    this.subscribers.add(abonne);
    abonne(this.state);
    return () => {
      this.subscribers.delete(abonne);
    };
  }

  /**
   * Rejoint le sondage partagé. `detail: true` (onglet Distribution) exige en
   * plus le chargement du détail des ordres. Retourne la fonction de libération.
   */
  acquire(options: { detail?: boolean; autorisation?: boolean } = {}): () => void {
    const detailManquant = options.detail && this.state.sorties === null;
    const autorisationManquante =
      options.autorisation && this.state.totalAAutoriser === null;
    this.lecteurs += 1;
    if (options.detail) this.lecteursDetail += 1;
    // AVANT démarrer : le premier relevé inclut déjà les requêtes logistique.
    if (options.autorisation) this.lecteursAutorisation += 1;
    this.demarrer();
    // L'onglet Distribution vient de s'ouvrir : le détail lui est nécessaire
    // tout de suite, sans attendre le prochain tic. Le garde `releveEnCours`
    // empêche tout doublon si plusieurs composants montent ensemble.
    if (detailManquant && this.pollInterval) void this.relever();
    // Badge hors onglet : le total à autoriser est lu immédiatement aussi.
    else if (autorisationManquante && this.pollInterval) void this.relever();
    let libere = false;
    return () => {
      if (libere) return;
      libere = true;
      this.lecteurs = Math.max(0, this.lecteurs - 1);
      if (options.detail) this.lecteursDetail = Math.max(0, this.lecteursDetail - 1);
      if (options.autorisation) {
        this.lecteursAutorisation = Math.max(0, this.lecteursAutorisation - 1);
        if (this.lecteursAutorisation === 0 && this.state.totalAAutoriser !== null) {
          // Plus aucun lecteur logistique : le total n'a plus de sens.
          this.setState({ totalAAutoriser: null });
        }
      }
      if (this.lecteurs === 0) this.arreter();
    };
  }

  /** Onglet masqué : le sondage se met en pause (aucune requête). */
  setEnPause(enPause: boolean) {
    this.enPause = enPause;
    if (enPause) this.arreter();
    else if (this.lecteurs > 0) this.demarrer();
  }

  private demarrer() {
    if (this.pollInterval || this.enPause) return;
    void this.relever();
    this.pollInterval = setInterval(() => void this.relever(), this.POLL_INTERVAL_MS);
  }

  private arreter() {
    if (!this.pollInterval) return;
    clearInterval(this.pollInterval);
    this.pollInterval = null;
  }

  /** Un seul relevé à la fois : deux déclenchements ne doublent pas les requêtes. */
  private async relever(): Promise<void> {
    if (this.releveEnCours) return;
    this.releveEnCours = true;
    this.setState({ loading: true });
    let echec = false;
    try {
      const demandeAutorisation = this.lecteursAutorisation > 0;
      const [total, ordres, totalA, ordresA] = await Promise.all([
        countSortiesPourPreparation(),
        fetchOrdresPourAlertes(),
        // Requêtes logistique : UNIQUEMENT si un consommateur est monté
        // (badge menu, cloche, espace) — toujours dans le MÊME relevé, donc
        // un seul intervalle : aucun second sondage.
        demandeAutorisation
          ? countSortiesAAutoriser()
          : Promise.resolve(undefined),
        demandeAutorisation
          ? fetchOrdresAAutoriser()
          : Promise.resolve(undefined),
      ]);
      if (total === null || ordres === null) echec = true;
      // Alertes recalculées seulement sur un relevé complet : une panne ne
      // doit jamais fabriquer de « nouvel ordre ».
      if (ordres) this.alertes = recalculerAlertes(this.alertes, ordres);
      if (demandeAutorisation) {
        if (totalA === null || ordresA === null) echec = true;
        if (ordresA) {
          // Éligibilité DU RÔLE : signatures 1 et 2 posées, 3 absente
          // (ordresAAutoriser attend un TABLEAU — un ordre à la fois).
          this.alertesAutorisation = recalculerAlertes(
            this.alertesAutorisation,
            ordresA,
            (sortie) => ordresAAutoriser([sortie]).length === 1
          );
        }
      }

      let sorties = this.state.sorties;
      if (this.lecteursDetail > 0) {
        try {
          sorties = await fetchAllSortiesOrThrow();
        } catch {
          echec = true;
        }
      }

      this.setState({
        sorties,
        totalEnPreparation: total,
        totalAAutoriser: demandeAutorisation ? (totalA ?? null) : null,
        alertes: alertesVisibles(this.alertes),
        alertesAutorisation: alertesVisibles(this.alertesAutorisation),
        loading: false,
        error: echec,
      });
    } finally {
      this.releveEnCours = false;
    }
  }

  /** Relevé manuel (bouton « Rafraîchir »). */
  async refresh(): Promise<void> {
    await this.relever();
  }

  getState(): SortiesActionsStoreState {
    return this.state;
  }
}

export const sortiesActionsStore = new SortiesActionsStore();
