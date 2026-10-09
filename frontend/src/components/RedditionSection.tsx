import { useCallback, useEffect, useState } from "react"
import { Calendar, FileSpreadsheet, Loader2, Printer, Scale } from "lucide-react"
import { User } from "../App"
import {
  fetchRecapitulation,
  fetchEtatAppreciatif,
  fetchInventaire,
  fetchGrandLivre,
  fetchBordereau,
  type Recapitulation,
  type EtatAppreciatif,
  type Inventaire,
  type GrandLivre,
  type Bordereau,
} from "../lib/reddition"
import { genererPdfRecapitulation, genererExcelRecapitulation } from "../lib/redditionDocuments"
import {
  genererPdfEtatAppreciatif,
  genererExcelEtatAppreciatif,
} from "../lib/etatAppreciatifDocuments"
import {
  genererPdfInventaire,
  genererExcelInventaire,
} from "../lib/inventaireDocuments"
import {
  genererPdfGrandLivre,
  genererExcelGrandLivre,
} from "../lib/grandLivreDocuments"
import { genererPdfBordereau } from "../lib/bordereauDocuments"
import {
  genererPdfCentralisation,
  genererPdfAttestation,
} from "../lib/bordereauDocuments"
import { genererPdfRecensement } from "../lib/pvRecensementDocuments"
import { arrondirAriary } from "../lib/nombreEnLettres"
import { MaterialPhoto } from "./MaterialPhoto"

/* ─────────────────────── Affichage des montants ─────────────────────── */

function fmt(v: number): string {
  const arrondi = arrondirAriary(v)
  const signe = arrondi < 0 ? "-" : ""
  return `${signe}${Math.abs(arrondi).toLocaleString("fr-FR")}`
}

function dateFr(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("fr-FR")
  } catch {
    return iso || "—"
  }
}

/* ─────────────────────────── Composant ─────────────────────────── */

interface RedditionSectionProps {
  user?: User
}

type Onglet =
  | "recapitulation"
  | "etat-appreciatif"
  | "inventaire"
  | "grand-livre"
  | "pv-recensement"
  | "bordereau"
  | "cloture"

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: "recapitulation", label: "Récapitulation" },
  { id: "etat-appreciatif", label: "État appréciatif" },
  { id: "inventaire", label: "Inventaire annuel" },
  { id: "grand-livre", label: "Fiche de stock" },
  { id: "pv-recensement", label: "PV de recensement" },
  { id: "bordereau", label: "Bordereau d'envoi" },
  { id: "cloture", label: "Clôture" },
]

/**
 * Section « Reddition de compte » de la page Rapports.
 * Documents annuels officiels calculés depuis la base (aucune saisie).
 * Accès : dépositaire et comptable.
 */
export function RedditionSection({ user }: RedditionSectionProps) {
  const anneeCourante = new Date().getFullYear()
  const annees = Array.from({ length: 10 }, (_, i) => anneeCourante - i)

  const [onglet, setOnglet] = useState<Onglet>("recapitulation")
  const [annee, setAnnee] = useState(anneeCourante)

  const [recap, setRecap] = useState<Recapitulation | null>(null)
  const [etat, setEtat] = useState<EtatAppreciatif | null>(null)
  const [inventaire, setInventaire] = useState<Inventaire | null>(null)
  const [grandLivre, setGrandLivre] = useState<GrandLivre | null>(null)
  const [bordereau, setBordereau] = useState<Bordereau | null>(null)
  const [materielChoisi, setMaterielChoisi] = useState("")
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    setLoading(true)
    setErreur(null)
    if (onglet === "recapitulation") {
      const data = await fetchRecapitulation(annee)
      setRecap(data)
    } else if (onglet === "etat-appreciatif") {
      const data = await fetchEtatAppreciatif(annee)
      setEtat(data)
    } else if (onglet === "grand-livre") {
      const inv = inventaire ?? (await fetchInventaire(annee))
      if (!inventaire && inv) setInventaire(inv)
      const premier = inv?.sections.flatMap((s) => s.articles)[0]
      const cible = materielChoisi || premier?.materielId || ""
      if (cible) {
        const data = await fetchGrandLivre(cible, annee)
        setGrandLivre(data)
        if (!materielChoisi && cible) setMaterielChoisi(cible)
      } else {
        setGrandLivre(null)
      }
    } else if (onglet === "bordereau") {
      const data = await fetchBordereau(annee)
      setBordereau(data)
    }
    setLoading(false)
  }, [onglet, annee, materielChoisi, inventaire])

  useEffect(() => {
    charger()
  }, [charger])

  const peutVoir = user?.role === "depositaire" || user?.role === "comptable"
  if (!peutVoir) return null

  const articlesDisponibles =
    inventaire?.sections.flatMap((s) =>
      s.articles.map((a) => ({ id: a.materielId || a.designation, label: `${a.designation} (${a.nomenclature})` }))
    ) ?? []

  const donneesVides =
    onglet === "recapitulation"
      ? !recap || recap.lignes.length === 0
      : onglet === "etat-appreciatif"
      ? !etat || (etat.mouvementsEntree.length === 0 && etat.mouvementsSortie.length === 0)
      : onglet === "inventaire"
      ? !inventaire || inventaire.sections.length === 0
      : onglet === "grand-livre"
      ? !grandLivre || grandLivre.mouvements.length === 0
      : onglet === "bordereau"
      ? !bordereau
      : false

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm">
      {/* En-tête */}
      <div className="p-4 sm:p-6 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Scale className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-base sm:text-lg text-card-foreground">
                Reddition de compte
              </h3>
              <p className="text-xs text-muted-foreground">
                Documents annuels officiels calculés depuis la base
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={annee}
              onChange={(e) => setAnnee(Number(e.target.value))}
              className="px-3 py-2 border border-border rounded-lg bg-background text-sm"
              aria-label="Choix de l'année de gestion"
            >
              {annees.map((a) => (
                <option key={a} value={a}>
                  Exercice {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex flex-wrap gap-2 mt-4">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              onClick={() => setOnglet(o.id)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                onglet === o.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Chargement des données…</span>
          </div>
        ) : donneesVides ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Aucune donnée pour cette année.
          </div>
        ) : onglet === "recapitulation" && recap ? (
          <>
            {/* Aperçu Récapitulation */}
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground">Nomenclature</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Existant au 1er janvier</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Entrées</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Total de l'existant</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Sorties</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Reste au 31 décembre</th>
                  </tr>
                </thead>
                <tbody>
                  {recap.lignes.map((l) => (
                    <tr key={l.nomenclature} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 text-sm font-medium text-card-foreground">{l.nomenclature}</td>
                      <td className="py-2 px-3 text-sm text-right text-card-foreground">{fmt(l.existant)}</td>
                      <td className="py-2 px-3 text-sm text-right text-card-foreground">{fmt(l.entrees)}</td>
                      <td className="py-2 px-3 text-sm text-right text-card-foreground">{fmt(l.total)}</td>
                      <td className="py-2 px-3 text-sm text-right text-card-foreground">{fmt(l.sorties)}</td>
                      <td className="py-2 px-3 text-sm text-right font-medium text-card-foreground">{fmt(l.reste)}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 border-b border-border">
                    <td className="py-2 px-3 text-sm font-bold text-card-foreground">TOTAUX</td>
                    <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{fmt(recap.totaux.existant)}</td>
                    <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{fmt(recap.totaux.entrees)}</td>
                    <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{fmt(recap.totaux.total)}</td>
                    <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{fmt(recap.totaux.sorties)}</td>
                    <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{fmt(recap.totaux.reste)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                onClick={() => genererPdfRecapitulation(recap)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <Printer className="h-4 w-4" />
                Exporter PDF
              </button>
              <button
                onClick={() => genererExcelRecapitulation(recap)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exporter Excel
              </button>
            </div>
          </>
        ) : onglet === "inventaire" && inventaire ? (
          <>
            {/* Aperçu Inventaire : une section par nomenclature */}
            <div className="space-y-4">
              {inventaire.sections.map((section) => (
                <div key={section.nomenclature} className="border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-muted/30 border-b border-border text-sm font-medium text-card-foreground">
                    Nomenclature {section.nomenclature} — {section.articles.length} article(s)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left py-2 px-3 text-xs text-muted-foreground">Désignation</th>
                          <th className="text-left py-2 px-3 text-xs text-muted-foreground">Unité</th>
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground">Prix unitaire</th>
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground">Qté entrées</th>
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground">Qté sorties</th>
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground">Qté reste</th>
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground">Valeur entrées</th>
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground">Valeur sorties</th>
                          <th className="text-right py-2 px-3 text-xs text-muted-foreground">Valeur reste</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.articles.map((a) => (
                          <tr key={a.materielId ?? a.designation} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2 px-3 text-sm text-card-foreground">{a.designation}</td>
                            <td className="py-2 px-3 text-sm text-card-foreground">{a.unite}</td>
                            <td className="py-2 px-3 text-sm text-right text-card-foreground">{fmt(a.prixUnitaire)}</td>
                            <td className="py-2 px-3 text-sm text-right text-card-foreground">{a.quantites.entrees}</td>
                            <td className="py-2 px-3 text-sm text-right text-card-foreground">{a.quantites.sorties}</td>
                            <td className="py-2 px-3 text-sm text-right text-card-foreground">{a.quantites.reste}</td>
                            <td className="py-2 px-3 text-sm text-right text-card-foreground">{fmt(a.valeurs.entrees)}</td>
                            <td className="py-2 px-3 text-sm text-right text-card-foreground">{fmt(a.valeurs.sorties)}</td>
                            <td className="py-2 px-3 text-sm text-right text-card-foreground">{fmt(a.valeurs.reste)}</td>
                          </tr>
                        ))}
                        <tr className="bg-muted/30">
                          <td className="py-2 px-3 text-sm font-bold text-card-foreground" colSpan={3}>TOTAUX</td>
                          <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{section.totaux.quantites.entrees}</td>
                          <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{section.totaux.quantites.sorties}</td>
                          <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{section.totaux.quantites.reste}</td>
                          <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{fmt(section.totaux.valeurs.entrees)}</td>
                          <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{fmt(section.totaux.valeurs.sorties)}</td>
                          <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{fmt(section.totaux.valeurs.reste)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                onClick={() => genererPdfInventaire(inventaire)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <Printer className="h-4 w-4" />
                Exporter PDF
              </button>
              <button
                onClick={() => genererExcelInventaire(inventaire)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exporter Excel
              </button>
            </div>
          </>
        ) : onglet === "etat-appreciatif" && etat ? (
          <>
            {/* Aperçu État appréciatif */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="p-4 border border-border rounded-lg bg-muted/20">
                <div className="text-xs text-muted-foreground">Pièces justificatives</div>
                <div className="text-lg text-card-foreground">{etat.nombrePieces}</div>
              </div>
              <div className="p-4 border border-border rounded-lg bg-muted/20">
                <div className="text-xs text-muted-foreground">Total des entrées</div>
                <div className="text-lg text-card-foreground">{fmt(etat.totalEntrees)}</div>
              </div>
              <div className="p-4 border border-border rounded-lg bg-muted/20">
                <div className="text-xs text-muted-foreground">Total des sorties</div>
                <div className="text-lg text-card-foreground">{fmt(etat.totalSorties)}</div>
              </div>
            </div>

            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground">Mouvement</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground">Référence</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground">Désignation</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Qté</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...etat.mouvementsEntree.map((m) => ({ ...m, sens: "Entrée" as const })),
                    ...etat.mouvementsSortie.map((m) => ({ ...m, sens: "Sortie" as const })),
                  ].flatMap((m) =>
                    m.lignes.map((l, i) => (
                      <tr key={`${m.reference}-${i}`} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                            m.sens === "Entrée"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}>
                            {m.sens}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-sm text-card-foreground whitespace-nowrap">{dateFr(m.date)}</td>
                        <td className="py-2 px-3 text-sm font-mono text-muted-foreground">{l.pieceJustificative || m.reference || "—"}</td>
                        <td className="py-2 px-3 text-sm text-card-foreground">{l.designation || "—"}</td>
                        <td className="py-2 px-3 text-sm text-right text-card-foreground">{l.quantite}</td>
                        <td className="py-2 px-3 text-sm text-right text-card-foreground">{fmt(l.montant)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                onClick={() => genererPdfEtatAppreciatif(etat)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <Printer className="h-4 w-4" />
                Exporter PDF
              </button>
              <button
                onClick={() => genererExcelEtatAppreciatif(etat)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exporter Excel
              </button>
            </div>
          </>
        ) : onglet === "grand-livre" && grandLivre ? (
          <>
            {/* Sélecteur d'article */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Article :</label>
              <select
                value={materielChoisi}
                onChange={(e) => setMaterielChoisi(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg bg-background text-sm min-w-[280px]"
              >
                {articlesDisponibles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Fiche matérielle : photo de RÉFÉRENCE du matériel suivi.
                Champ optionnel — sans photo, la fiche s'affiche normalement. */}
            {grandLivre.materiel && (
              <div className="flex items-center gap-3 border border-border rounded-lg p-3 bg-muted/20">
                <MaterialPhoto
                  photo={grandLivre.materiel.photo}
                  designation={grandLivre.materiel.designation}
                  className="h-14 w-14 rounded-md object-cover flex-shrink-0"
                />
                <div>
                  <div className="text-sm font-medium text-card-foreground">
                    {grandLivre.materiel.designation || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Nomenclature {grandLivre.materiel.nomenclature || "—"} ·
                    {grandLivre.materiel.photo
                      ? " photo de référence de la fiche"
                      : " aucune photo de référence sur la fiche"}
                  </div>
                </div>
              </div>
            )}

            {/* Aperçu grand-livre */}
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground">Référence</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Qté entrée</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Qté sortie</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Qté cumulée</th>
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground">Pièce justificative</th>
                  </tr>
                </thead>
                <tbody>
                  {grandLivre.mouvements.map((m, i) => (
                    <tr key={i} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 text-sm text-card-foreground whitespace-nowrap">{dateFr(m.date)}</td>
                      <td className="py-2 px-3 text-sm font-mono text-muted-foreground">{m.reference || "—"}</td>
                      <td className="py-2 px-3 text-sm text-right text-card-foreground">{m.quantiteEntree || ""}</td>
                      <td className="py-2 px-3 text-sm text-right text-card-foreground">{m.quantiteSortie || ""}</td>
                      <td className="py-2 px-3 text-sm text-right font-medium text-card-foreground">{m.quantiteCumulee}</td>
                      <td className="py-2 px-3 text-sm text-card-foreground">{m.pieceJustificative || ""}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30">
                    <td className="py-2 px-3 text-sm font-bold text-card-foreground">TOTAUX</td>
                    <td />
                    <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{grandLivre.totalEntreesQ}</td>
                    <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{grandLivre.totalSortiesQ}</td>
                    <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{grandLivre.quantiteFinale}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3 justify-end">
              <button
                onClick={() => genererPdfGrandLivre(grandLivre)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <Printer className="h-4 w-4" />
                Exporter PDF
              </button>
              <button
                onClick={() => genererExcelGrandLivre(grandLivre)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exporter Excel
              </button>
            </div>
          </>
        ) : onglet === "pv-recensement" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Le procès-verbal de recensement reprend les articles et la valeur
              totale de l'inventaire {annee}. Renseignez les membres de la
              commission dans le document généré.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-4 border border-border rounded-lg bg-muted/20">
                <div className="text-xs text-muted-foreground">Articles recensés</div>
                <div className="text-lg text-card-foreground">
                  {inventaire?.sections.reduce((t, s) => t + s.articles.length, 0) ?? "—"}
                </div>
              </div>
              <div className="p-4 border border-border rounded-lg bg-muted/20">
                <div className="text-xs text-muted-foreground">Valeur totale (reste)</div>
                <div className="text-lg text-card-foreground">
                  {inventaire
                    ? fmt(inventaire.sections.reduce((t, s) => t + s.totaux.valeurs.reste, 0))
                    : "—"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                onClick={async () => {
                  const inv = inventaire ?? (await fetchInventaire(annee))
                  if (inv) {
                    if (!inventaire) setInventaire(inv)
                    genererPdfRecensement(inv)
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Printer className="h-4 w-4" />
                Générer le PDF
              </button>
            </div>
          </>
        ) : onglet === "bordereau" && bordereau ? (
          <>
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left py-2 px-3 text-xs text-muted-foreground">Année</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Ordres d'entrée</th>
                    <th className="text-right py-2 px-3 text-xs text-muted-foreground">Factures</th>
                  </tr>
                </thead>
                <tbody>
                  {bordereau.parAnnee.map((a) => (
                    <tr key={a.annee} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 text-sm text-card-foreground">{a.annee}</td>
                      <td className="py-2 px-3 text-sm text-right text-card-foreground">{a.ordresEntree}</td>
                      <td className="py-2 px-3 text-sm text-right text-card-foreground">{a.factures}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30">
                    <td className="py-2 px-3 text-sm font-bold text-card-foreground">TOTAL</td>
                    <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{bordereau.totalOrdres}</td>
                    <td className="py-2 px-3 text-sm text-right font-bold text-card-foreground">{bordereau.totalFactures}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                onClick={() => genererPdfBordereau(bordereau, { anneeDebut: annee, anneeFin: annee })}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Printer className="h-4 w-4" />
                Générer le PDF
              </button>
            </div>
          </>
        ) : onglet === "cloture" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Modèles pré-remplis pour la clôture du dossier de reddition
              {inventaire
                ? ` — exercice ${annee} : ${inventaire.sections.reduce((t, s) => t + s.articles.length, 0)} article(s), ${fmt(
                    inventaire.sections.reduce((t, s) => t + s.totaux.valeurs.reste, 0)
                  )} Ariary`
                : ` — exercice ${annee}`}
              .
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <button
                onClick={() =>
                  genererPdfCentralisation({
                    annee,
                    totalArticles: inventaire?.sections.reduce((t, s) => t + s.articles.length, 0),
                    valeurReste: inventaire
                      ? arrondirAriary(inventaire.sections.reduce((t, s) => t + s.totaux.valeurs.reste, 0))
                      : undefined,
                  })
                }
                className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors text-left"
              >
                <Printer className="h-5 w-5 text-primary mb-2" />
                <div className="text-sm text-card-foreground">Fiche de centralisation comptable</div>
                <div className="text-xs text-muted-foreground">Tableau à compléter + totaux de l'exercice</div>
              </button>
              <button
                onClick={() => genererPdfAttestation({ annee })}
                className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors text-left"
              >
                <Printer className="h-5 w-5 text-primary mb-2" />
                <div className="text-sm text-card-foreground">Attestation</div>
                <div className="text-xs text-muted-foreground">Déclaration sur l'honneur du dépositaire</div>
              </button>
              <button
                onClick={async () => {
                  const b = bordereau ?? (await fetchBordereau(annee))
                  if (b) {
                    if (!bordereau) setBordereau(b)
                    genererPdfBordereau(b, { anneeDebut: annee, anneeFin: annee })
                  }
                }}
                className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors text-left"
              >
                <Printer className="h-5 w-5 text-primary mb-2" />
                <div className="text-sm text-card-foreground">Bordereau d'envoi</div>
                <div className="text-xs text-muted-foreground">Liste des pièces du dossier + TOTAL</div>
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
