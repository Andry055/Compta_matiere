import { ControleSortieLignePayload, SortieRecord } from "./api";

/**
 * Valide le contrôle de sortie pour la signature magasinier.
 * Vérifie que chaque ligne de contrôle a un état et des observations éventuelles.
 */
export function validerControleSortie(
  controles: ControleSortieLignePayload[]
): { isValid: boolean; error?: string } {
  if (!controles || controles.length === 0) {
    return {
      isValid: false,
      error: "Aucun contrôle de ligne fourni",
    };
  }

  for (const controle of controles) {
    if (!controle.ligne) {
      return {
        isValid: false,
        error: "ID de ligne manquant",
      };
    }
    if (!controle.etat) {
      return {
        isValid: false,
        error: `État manquant pour la ligne ${controle.ligne}`,
      };
    }
    // observations est optionnel, donc pas de validation requise
  }

  return { isValid: true };
}

/**
 * Construit le payload pour la signature d'une sortie.
 * @param documentId - ID de la sortie à signer
 * @param role - rôle de l'utilisateur (magasinier, depositaire, logistique)
 * @param controles - contrôles optionnels des lignes (pour le magasinier)
 */
export function construirePayloadSignatureSortie(
  documentId: string,
  role: 'magasinier' | 'depositaire' | 'logistique',
  controles?: ControleSortieLignePayload[]
) {
  return {
    documentId,
    role,
    ...(controles ? { controles } : {}),
  };
}

/**
 * Construit le payload pour le rejet d'une sortie.
 * @param documentId - ID de la sortie à rejeter
 * @param motif - motif du rejet
 */
export function construirePayloadRejetSortie(
  documentId: string,
  motif: string
) {
  return {
    documentId,
    motif,
  };
}

/**
 * Détermine si une sortie est prête à être préparée par le magasinier.
 * Une sortie est prête à être préparée si son statut est 'demandee' (ou équivalent).
 * @param sortie - enregistrement de sortie
 * @returns true si la sortie peut être préparée
 */
export function estPreprable(sortie: SortieRecord): boolean {
  // Selon le statut API, 'demandee' correspond à "Demandée"
  return sortie.statut === "Demandée";
}

/**
 * Détermine si une sortie est prête à être signée par le magasinier.
 * Une sortie est prête à être signée si son statut est 'en_preparation' (ou équivalent).
 * @param sortie - enregistrement de sortie
 * @returns true si la sortie peut être signée
 */
export function estSignable(sortie: SortieRecord): boolean {
  return sortie.statut === "En préparation";
}

/**
 * Détermine si une sortie peut être rejetée par le magasinier.
 * Une sortie peut être rejetée si son statut est 'en_preparation' (ou équivalent).
 * @param sortie - enregistrement de sortie
 * @returns true si la sortie peut être rejetée
 */
export function estRejettable(sortie: SortieRecord): boolean {
  return sortie.statut === "En préparation";
}

/**
 * Détermine quels ordres sont prêts pour l'autorisation du chef logistique.
 * Une commande est prête si elle est en statut "En préparation" et que les
 * deux premières signatures (magasinier et dépositaire) sont présentes.
 * @param commandes - liste des commandes de sortie
 * @returns les commandes prêtes pour l'autorisation du chef logistique
 */
export function ordresAAutoriser(commandes: SortieRecord[]): SortieRecord[] {
  return commandes.filter(commande =>
    commande.statut === "En préparation" &&
    commande.magasinier_signed === true &&
    commande.depositaire_signed === true &&
    commande.logistique_signed !== true
  );
}

/**
 * Calcule le stock restant après une sortie pour une ligne donnée.
 * @param ligne - ligne de la sortie
 * @param stockActuel - stock actuel du matériel
 * @returns le stock restant après la sortie (ne peut pas être négatif)
 */
export function stockApres(ligne: { quantite: number }, stockActuel: number): number {
  const stockRestant = stockActuel - ligne.quantite;
  return Math.max(0, stockRestant);
}

/**
 * Détermine lesquelles des lignes d'une commande ont un stock insuffisant.
 * @param commande - commande de sortie
 * @param stocks - dictionnaire des stocks actuels par documentId de matériel
 * @returns liste des lignes avec stock insuffisant (chaque élément contient le matériel demandé et disponible)
 */
export function lignesInsuffisantes(
  commande: SortieRecord,
  stocks: Record<string, number>
): Array<{ materiel: string; demande: number; disponible: number }> {
  const resultat: Array<{ materiel: string; demande: number; disponible: number }> = [];

  for (const ligne of commande.lignes || []) {
    const materielId = ligne.materiel?.documentId || "";
    const stockDisponible = stocks[materielId] || 0;
    const quantiteDemandee = ligne.quantite || 0;

    if (quantiteDemandee > stockDisponible) {
      resultat.push({
        materiel: ligne.materiel?.designation || ligne.designation || `Matériel #${materielId}`,
        demande: quantiteDemandee,
        disponible: stockDisponible
      });
    }
  }

  return resultat;
}

/**
 * Calcule le total financier d'une commande de sortie.
 * @param commande - commande de sortie
 * @returns le total en FCFA
 */
export function calculerTotal(commande: SortieRecord): number {
  return (commande.lignes || []).reduce((total, ligne) => {
    const valeurUnitaire = ligne.materiel?.valeurUnitaire || 0;
    return total + (ligne.quantite * valeurUnitaire);
  }, 0);
}

/**
 * Construit le payload pour la signature du chef logistique.
 * Nettoie les N° logistiques (retire les espaces, ignore les vides) et limite à 100 caractères.
 * Ne comprend jamais le statut ou la date (ceux-ci sont définis par le serveur).
 * @param sortie - enregistrement de sortie
 * @param numerosLogistiques - dictionnaire des N° logistiques par ligne (documentId -> valeur)
 * @returns le payload à envoyer au serveur pour la signature 3
 */
export function construirePayloadSignatureLogistique(
  sortie: SortieRecord,
  numerosLogistiques: Record<string, string>
): { role: 'logistique'; numeros_logistiques: Array<{ ligne: string; numero_logistique: string }> } {
  // Filtrer et nettoyer les N° logistiques
  const numerosValides: Array<{ ligne: string; numero_logistique: string }> = [];

  for (const [ligneId, numero] of Object.entries(numerosLogistiques)) {
    // Ignorer si la ligne n'existe pas dans la sortie
    if (!sortie.lignes?.some(l => l.documentId === ligneId)) {
      continue;
    }

    // Nettoyer le numéro (retirer les espaces en début et fin)
    const numeroNettoye = numero.trim();

    // Ignorer si le numéro est vide après nettoyage
    if (numeroNettoye.length === 0) {
      continue;
    }

    // Limiter à 100 caractères maximum
    const numeroLimite = numeroNettoye.slice(0, 100);

    numerosValides.push({
      ligne: ligneId,
      numero_logistique: numeroLimite
    });
  }

  return {
    role: 'logistique',
    numeros_logistiques: numerosValides
  };
}