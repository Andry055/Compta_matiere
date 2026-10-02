// Horodatage RÉEL de la dernière synchronisation réussie avec le serveur.

import { useEffect, useState } from "react";
//
// Le pied de page affichait « Dernière sync : il y a 2 min » en dur : cette
// valeur ne reflétait rien. Elle est désormais alimentée par l'écran qui
// recharge effectivement les entrées (Réception de Matériel) et lue par
// l'interface qui l'affiche.
//
// Le CustomEvent ne traverse pas les onglets : la valeur reste donc propre à
// l'onglet courant (sessionStorage), ce qui est le bon niveau — chaque poste a
// sa propre session de lecture.

const CLE = "derniere-sync";

let dernier: Date | null = null;
try {
  const brut = sessionStorage.getItem(CLE);
  if (brut) {
    const date = new Date(brut);
    if (!Number.isNaN(date.getTime())) dernier = date;
  }
} catch {
  /* mode privé : on repart sans historique */
}

type Abonne = () => void;
const abonnes = new Set<Abonne>();

function emettre() {
  for (const abonne of abonnes) abonne();
  window.dispatchEvent(new CustomEvent("derniere-sync-change"));
}

/** Date de la dernière synchronisation réussie, ou null si l'écran n'a jamais
 *  réussi à joindre le serveur depuis l'ouverture de cet onglet. */
export function getDerniereSync(): Date | null {
  return dernier;
}

/** À appeler après chaque lecture serveur RÉUSSIE (jamais sur un échec). */
export function marquerSync(date: Date = new Date()): void {
  dernier = date;
  try {
    sessionStorage.setItem(CLE, date.toISOString());
  } catch {
    /* non critique */
  }
  emettre();
}

/** S'abonner aux changements d'horodatage. Retourne la fonction de retrait. */
export function abonnerSync(abonne: Abonne): () => void {
  abonnes.add(abonne);
  return () => {
    abonnes.delete(abonne);
  };
}

/** Écart lisible : « à l'instant », « il y a 2 min », « il y a 1 h 05 ». */
export function formatDelaiSync(
  depuis: Date | null,
  maintenant: Date = new Date()
): string {
  if (!depuis) return "—";
  const secondes = Math.max(
    0,
    Math.round((maintenant.getTime() - depuis.getTime()) / 1000)
  );
  if (secondes < 45) return "à l'instant";
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures < 24) {
    return reste > 0
      ? `il y a ${heures} h ${String(reste).padStart(2, "0")}`
      : `il y a ${heures} h`;
  }
  const jours = Math.round(heures / 24);
  return `il y a ${jours} j`;
}

/** Abonnement React à l'horodatage. Se ré-abonne à chaque changement ET
 *  rafraîchit périodiquement : le libellé doit vieillir même en l'absence de
 *  nouvelle synchronisation (sinon « il y a 0 min » resterait figé). */
export function useDerniereSync(): Date | null {
  const [date, setDate] = useState<Date | null>(dernier);
  useEffect(() => abonnerSync(() => setDate(getDerniereSync())), []);
  useEffect(() => {
    const minuteur = setInterval(
      () => setDate((precedent) => (precedent ? new Date(precedent) : precedent)),
      30000
    );
    return () => clearInterval(minuteur);
  }, []);
  return date;
}
