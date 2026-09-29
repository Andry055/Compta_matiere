/* ═══════════════════════════════════════════════════════════════════════════
   Montants en toutes lettres (français, majuscules) — documents officiels
   « Arrêté à la somme de : … »

   Convention orthographique (traditionnelle) :
   - traits d'union dans les composés dizaines-unités sous 100 :
     SOIXANTE-DIX-SEPT, QUATRE-VINGT-UN, QUATRE-VINGTS ;
   - espaces entre les groupes : SEPT CENT SOIXANTE-DIX-SEPT MILLIONS ;
   - accords : QUATRE-VINGTS et CENTS prennent un S multipliés et en fin de
     groupe (DEUX CENTS, mais DEUX CENT TROIS ; QUATRE-VINGTS mais
     QUATRE-VINGT-UN) ; MILLE invariable ; UN MILLIARD / UN MILLION.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Convertit un entier (0 à 999 999 999 999) en toutes lettres françaises
 * majuscules. Les valeurs non finies renvoient « NÉANT ».
 */
export function nombreEnLettresFr(n: number): string {
  if (!Number.isFinite(n)) return "NÉANT";
  const negatif = n < 0;
  const entier = Math.floor(Math.abs(n));

  if (entier === 0) return negatif ? "MOINS ZÉRO" : "ZÉRO";

  const texte = groupesEnLettres(entier);
  return negatif ? `MOINS ${texte}` : texte;
}

/* ────────────────────────────── Internes ────────────────────────────── */

const UNITES = [
  "ZÉRO",
  "UN",
  "DEUX",
  "TROIS",
  "QUATRE",
  "CINQ",
  "SIX",
  "SEPT",
  "HUIT",
  "NEUF",
  "DIX",
  "ONZE",
  "DOUZE",
  "TREIZE",
  "QUATORZE",
  "QUINZE",
  "SEIZE",
  "DIX-SEPT",
  "DIX-HUIT",
  "DIX-NEUF",
];

/** Convertit 0..19. */
function sousVingt(n: number): string {
  return UNITES[n];
}

/** Convertit 0..99 en lettres. */
function sousCentaine(n: number): string {
  if (n < 20) return sousVingt(n);
  const d = Math.floor(n / 10);
  const u = n % 10;

  if (d === 8) {
    // 80..99 : QUATRE-VINGT(S) + unité
    if (u === 0) return "QUATRE-VINGTS";
    return `QUATRE-VINGT-${UNITES[u]}`; // 81 → QUATRE-VINGT-UN (pas de ET)
  }
  if (d === 7) {
    // 70..79 : SOIXANTE-DIX, SOIXANTE ET ONZE, SOIXANTE-DOUZE … SEIZE,
    // puis SOIXANTE-DIX-SEPT, DIX-HUIT, DIX-NEUF
    if (u === 0) return "SOIXANTE-DIX";
    if (u === 1) return "SOIXANTE ET ONZE";
    const reste = 10 + u;
    return reste <= 16
      ? `SOIXANTE-${UNITES[reste]}`
      : `SOIXANTE-DIX-${UNITES[u]}`;
  }
  if (d === 9) {
    // 90..99 : QUATRE-VINGT-DIX, ONZE … SEIZE, puis DIX-SEPT … DIX-NEUF
    if (u === 0) return "QUATRE-VINGT-DIX";
    const reste = 10 + u;
    return reste <= 16
      ? `QUATRE-VINGT-${UNITES[reste]}`
      : `QUATRE-VINGT-DIX-${UNITES[u]}`;
  }

  const motDizaine = ["", "DIX", "VINGT", "TRENTE", "QUARANTE", "CINQUANTE", "SOIXANTE"][d];
  if (u === 0) return motDizaine; // 20, 30 …
  if (u === 1) return `${motDizaine} ET UN`; // 21, 31, 41, 51, 61
  return `${motDizaine}-${UNITES[u]}`; // 22 → VINGT-DEUX
}

/** Convertit 0..999 en lettres. */
function sousMillier(n: number): string {
  if (n < 100) return sousCentaine(n);
  const c = Math.floor(n / 100);
  const reste = n % 100;
  if (reste === 0) {
    return c === 1 ? "CENT" : `${UNITES[c]} CENTS`; // 100 / 200
  }
  const centaine = c === 1 ? "CENT" : `${UNITES[c]} CENT`; // 101 → CENT UN
  return `${centaine} ${sousCentaine(reste)}`;
}

/** Assemble les tranches milliards / millions / mille / unités. */
function groupesEnLettres(n: number): string {
  const groupes: string[] = [];
  const milliards = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1_000);
  const unites = n % 1_000;

  if (milliards > 0) {
    milliards === 1
      ? groupes.push("UN MILLIARD")
      : groupes.push(`${sousMillier(milliards)} MILLIARDS`);
  }
  if (millions > 0) {
    millions === 1
      ? groupes.push("UN MILLION")
      : groupes.push(`${sousMillier(millions)} MILLIONS`);
  }
  if (milliers > 0) {
    milliers === 1
      ? groupes.push("MILLE") // MILLE invariable
      : groupes.push(`${sousMillier(milliers)} MILLE`);
  }
  if (unites > 0 || groupes.length === 0) {
    groupes.push(sousMillier(unites));
  }
  return groupes.join(" ");
}

/**
 * Variante pour compter des ARTICLES : renvoie le nombre en lettres ;
 * l'accord du nom (« ARTICLE »/« ARTICLES ») est géré par l'appelant.
 */
export function nombreEnLettresArticles(n: number): string {
  return nombreEnLettresFr(n);
}

/**
 * Arrondit un montant à l'Ariary entier (les centimes n'ont pas cours légal
 * à Madagascar ; l'arrondi ne concerne que l'affichage des documents).
 */
export function arrondirAriary(montant: number): number {
  return Math.round(montant);
}
