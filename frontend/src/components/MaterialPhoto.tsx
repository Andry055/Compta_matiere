import { urlMediaAffichable } from "../lib/api";

/**
 * Photo de RÉFÉRENCE d'une fiche matériel (champ media `photos` de `material`).
 *
 * Usage partagé : Équipements (à côté de chaque matériel), Fiche de stock du
 * grand livre et écran de suggestion de rapprochement (comparer visuellement
 * avant de confirmer).
 *
 * Champ OPTIONNEL : sans photo, le composant ne rend rien — un matériel sans
 * photo s'affiche normalement, sans image cassée ni erreur.
 * Plusieurs photos : la PREMIÈRE sert de vignette (pas de galerie ici).
 */
export function MaterialPhoto({
  photo,
  designation,
  alt,
  className = "w-10 h-10 rounded-md object-cover",
}: {
  photo?: string | null;
  designation?: string | null;
  /** Alternatives explicites (sinon « <désignation> — photo de référence »). */
  alt?: string;
  className?: string;
}) {
  const url = urlMediaAffichable(photo);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt || `${designation || "Matériel"} — photo de référence`}
      className={className}
      loading="lazy"
    />
  );
}
