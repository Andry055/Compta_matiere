import { useEffect, useMemo, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  FileText,
  Building2,
  Package,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { User } from "../App";
import {
  EntreeLigne,
  EntreeAdmin,
  ENTREE_ADMIN_VIDE,
  TYPE_OPERATION_LABELS,
  formatMontant,
} from "../lib/movements";
import {
  creerEntree,
  fetchDirections,
  fetchFournisseurs,
  fetchMaterials,
  fetchServices,
  MaterialOption,
  RefOption,
} from "../lib/api";

const ETAPES = [
  { numero: 1, label: "Administratif", icon: FileText },
  { numero: 2, label: "Fournisseur", icon: Building2 },
  { numero: 3, label: "Matériels", icon: Package },
  { numero: 4, label: "Vérification", icon: CheckCircle2 },
];

const UNITES = ["unité", "pièce", "lot", "kg", "litre", "mètre", "boîte"];

interface NewEntryModalProps {
  open: boolean;
  user?: User;
  onClose: () => void;
  onCreated: (reference: string) => void;
}

const ligneVide = (index: number): EntreeLigne => ({
  numeroOrdre: index + 1,
  designation: "",
  espece: "",
  unite: "unité",
  quantite: 1,
  prixUnitaire: 0,
  montant: 0,
  nomenclature: "",
  pieceJustificative: "",
  observation: "",
});

export function NewEntryModal({ open, user, onClose, onCreated }: NewEntryModalProps) {
  const [etape, setEtape] = useState(1);
  const [erreur, setErreur] = useState("");
  const [saving, setSaving] = useState(false);

  // Section A — informations administratives
  const [reference, setReference] = useState("");
  const [dateEntree, setDateEntree] = useState(new Date().toISOString().slice(0, 10));
  const [admin, setAdmin] = useState<EntreeAdmin>(ENTREE_ADMIN_VIDE);
  const [directionId, setDirectionId] = useState("");
  const [serviceId, setServiceId] = useState("");

  // Section B — fournisseur et documents
  const [fournisseurId, setFournisseurId] = useState("");
  const [numeroFacture, setNumeroFacture] = useState("");

  // Section C — matériels
  const [lignes, setLignes] = useState<EntreeLigne[]>([ligneVide(0)]);

  // Données de référence
  const [fournisseurs, setFournisseurs] = useState<RefOption[]>([]);
  const [directions, setDirections] = useState<RefOption[]>([]);
  const [services, setServices] = useState<RefOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);

  useEffect(() => {
    if (!open) return;
    setEtape(1);
    setErreur("");
    setReference("");
    setDateEntree(new Date().toISOString().slice(0, 10));
    setAdmin(ENTREE_ADMIN_VIDE);
    setFournisseurId("");
    setNumeroFacture("");
    setDirectionId("");
    setServiceId("");
    setLignes([ligneVide(0)]);
    fetchFournisseurs().then(setFournisseurs);
    fetchDirections().then(setDirections);
    fetchServices().then(setServices);
    fetchMaterials().then(setMaterials);
  }, [open]);

  const total = useMemo(
    () => lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0),
    [lignes]
  );

  const majLigne = (index: number, patch: Partial<EntreeLigne>) => {
    setLignes((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const merged = { ...l, ...patch };
        // Montant toujours recalculé : aucune incohérence possible
        merged.montant = Math.round(
          (Number(merged.quantite) || 0) * (Number(merged.prixUnitaire) || 0) * 100
        ) / 100;
        return merged;
      })
    );
  };

  const ajouterLigne = () => setLignes((prev) => [...prev, ligneVide(prev.length)]);
  const supprimerLigne = (index: number) =>
    setLignes((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, numeroOrdre: i + 1 })) : prev
    );

  const selectionnerMateriel = (index: number, documentId: string) => {
    const mat = materials.find((m) => m.documentId === documentId);
    if (!mat) {
      majLigne(index, { designation: "" });
      return;
    }
    majLigne(index, {
      designation: mat.designation,
      espece: mat.categorie || "",
      prixUnitaire: mat.valeurUnitaire ?? 0,
    });
  };

  /** Validation étape par étape avant de passer à la suivante */
  const validerEtape = (): string => {
    if (etape === 1 && !dateEntree) return "La date d'entrée est obligatoire.";
    if (etape === 2 && !fournisseurId) return "Le fournisseur est obligatoire.";
    if (etape === 3) {
      if (lignes.length === 0) return "Au moins un matériel est requis.";
      for (const l of lignes) {
        if (!l.designation.trim()) return "Chaque matériel doit avoir une désignation.";
        if (!(Number(l.quantite) > 0)) return `Quantité invalide pour « ${l.designation} » : elle doit être supérieure à 0.`;
        if (!(Number(l.prixUnitaire) >= 0)) return `Prix unitaire invalide pour « ${l.designation} ».`;
      }
    }
    return "";
  };

  const suivant = () => {
    const err = validerEtape();
    setErreur(err);
    if (!err) setEtape((e) => Math.min(4, e + 1));
  };

  const enregistrer = async () => {
    setErreur("");
    setSaving(true);
    try {
      await creerEntree({
        date_entree: dateEntree,
        numero_facture: numeroFacture || undefined,
        fournisseur_id: fournisseurId,
        direction_id: directionId || undefined,
        service_id: serviceId || undefined,
        responsable: user?.name,
        lignes: lignes.map((l) => ({
          designation: l.designation.trim(),
          espece: l.espece || undefined,
          unite: l.unite || undefined,
          quantite: Number(l.quantite),
          valeur_unitaire: Number(l.prixUnitaire),
          nomenclature: l.nomenclature || undefined,
          piece_justificative: l.pieceJustificative || undefined,
          observations: l.observation || undefined,
        })),
        numero_chapitre: admin.numeroChapitre || undefined,
        libelle_chapitre: admin.libelleChapitre || undefined,
        subdivision_chapitre: admin.subdivisionChapitre || undefined,
        numero_ordre_journal: admin.numeroOrdreJournal || undefined,
        budget_general: admin.budgetGeneral || undefined,
        soa: admin.soa || undefined,
        type_operation: admin.typeOperation || undefined,
        adresse_fournisseur: admin.adresseFournisseur || undefined,
        date_facture: admin.dateFacture || undefined,
        bon_livraison: admin.bonLivraison || undefined,
        reference_marche: admin.referenceMarche || undefined,
        piece_justificative: admin.pieceJustificative || undefined,
        declaration_nom: admin.declarationNom || undefined,
        declaration_fonction: admin.declarationFonction || undefined,
        declaration_date: admin.declarationDate || undefined,
      });
      onCreated(reference || "nouvelle entrée");
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { error?: { message?: string } } } };
      setErreur(
        axiosErr.response?.data?.error?.message ||
          "Création impossible : vérifiez que le serveur est démarré."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputClass =
    "w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring focus:border-transparent";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg text-card-foreground flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Nouvelle entrée
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Modèle « Ordre d'entrée » — la validation requiert 3 signatures
              (Dépositaire, Chef de service 1, Chef de service 2).
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Barre de progression */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {ETAPES.map((e, i) => {
              const Icon = e.icon;
              const active = etape === e.numero;
              const done = etape > e.numero;
              return (
                <div key={e.numero} className="flex items-center gap-2 flex-1">
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs flex-1 justify-center ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : done
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {e.numero}. {e.label}
                    </span>
                    <span className="sm:hidden">{e.numero}</span>
                  </div>
                  {i < ETAPES.length - 1 && (
                    <div className="h-px bg-border w-4 hidden sm:block" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(etape / ETAPES.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {erreur && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {erreur}
            </div>
          )}

          {/* ÉTAPE 1 — Informations administratives (Section A) */}
          {etape === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Numéro du chapitre</label>
                  <input className={inputClass} value={admin.numeroChapitre} onChange={(e) => setAdmin({ ...admin, numeroChapitre: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Libellé du chapitre</label>
                  <input className={inputClass} value={admin.libelleChapitre} onChange={(e) => setAdmin({ ...admin, libelleChapitre: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Subdivision du chapitre</label>
                  <input className={inputClass} value={admin.subdivisionChapitre} onChange={(e) => setAdmin({ ...admin, subdivisionChapitre: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">N° d'ordre du journal</label>
                  <input className={inputClass} value={admin.numeroOrdreJournal} onChange={(e) => setAdmin({ ...admin, numeroOrdreJournal: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Date *</label>
                  <input type="date" required className={inputClass} value={dateEntree} onChange={(e) => setDateEntree(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Budget général</label>
                  <input className={inputClass} value={admin.budgetGeneral} onChange={(e) => setAdmin({ ...admin, budgetGeneral: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">SOA</label>
                  <input className={inputClass} value={admin.soa} onChange={(e) => setAdmin({ ...admin, soa: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Type d'opération</label>
                  <select
                    className={inputClass}
                    value={admin.typeOperation}
                    onChange={(e) => setAdmin({ ...admin, typeOperation: e.target.value as EntreeAdmin["typeOperation"] })}
                  >
                    <option value="">— Sélectionner —</option>
                    {Object.entries(TYPE_OPERATION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Référence (auto : ENT-AAAA-NNN)</label>
                  <input className={inputClass} placeholder="Générée automatiquement" disabled value="Automatique" />
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 — Fournisseur et documents (Section B) */}
          {etape === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Fournisseur *</label>
                  <select className={inputClass} value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)}>
                    <option value="">— Sélectionner —</option>
                    {fournisseurs.map((f) => (
                      <option key={f.documentId} value={f.documentId}>{f.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Adresse du fournisseur</label>
                  <input className={inputClass} value={admin.adresseFournisseur} onChange={(e) => setAdmin({ ...admin, adresseFournisseur: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">N° facture</label>
                  <input className={inputClass} value={numeroFacture} onChange={(e) => setNumeroFacture(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Date de facture</label>
                  <input type="date" className={inputClass} value={admin.dateFacture} onChange={(e) => setAdmin({ ...admin, dateFacture: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Bon de livraison</label>
                  <input className={inputClass} value={admin.bonLivraison} onChange={(e) => setAdmin({ ...admin, bonLivraison: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Référence marché / convention</label>
                  <input className={inputClass} value={admin.referenceMarche} onChange={(e) => setAdmin({ ...admin, referenceMarche: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Pièce justificative</label>
                  <input className={inputClass} value={admin.pieceJustificative} onChange={(e) => setAdmin({ ...admin, pieceJustificative: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Direction</label>
                  <select className={inputClass} value={directionId} onChange={(e) => setDirectionId(e.target.value)}>
                    <option value="">— Sélectionner —</option>
                    {directions.map((d) => (
                      <option key={d.documentId} value={d.documentId}>{d.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Service</label>
                  <select className={inputClass} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                    <option value="">— Sélectionner —</option>
                    {services.map((s) => (
                      <option key={s.documentId} value={s.documentId}>{s.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Les documents (facture, bon de livraison, marché) seront
                consultables depuis la fiche de l'entrée.
              </p>
            </div>
          )}

          {/* ÉTAPE 3 — Matériels (Section C) */}
          {etape === 3 && (
            <div className="space-y-3">
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground w-10">N°</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground min-w-[180px]">Désignation *</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground w-28">Espèce</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground w-24">Unité</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground w-20">Qté *</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground w-28">Prix unitaire *</th>
                      <th className="text-left py-2 px-2 text-xs text-muted-foreground w-32">Montant</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((ligne, index) => (
                      <tr key={index} className="border-b border-border last:border-b-0">
                        <td className="py-2 px-2 text-xs text-muted-foreground">{ligne.numeroOrdre}</td>
                        <td className="py-2 px-2">
                          <input
                            list="materiaux-list"
                            className="w-full px-2 py-1 border border-border rounded bg-background text-sm"
                            value={ligne.designation}
                            onChange={(e) => majLigne(index, { designation: e.target.value })}
                            placeholder="Désignation du matériel"
                          />
                          {index === 0 && (
                            <datalist id="materiaux-list">
                              {materials.map((m) => (
                                <option key={m.documentId} value={m.designation} />
                              ))}
                            </datalist>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <input
                            className="w-full px-2 py-1 border border-border rounded bg-background text-sm"
                            value={ligne.espece}
                            onChange={(e) => majLigne(index, { espece: e.target.value })}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            className="w-full px-2 py-1 border border-border rounded bg-background text-sm"
                            value={ligne.unite}
                            onChange={(e) => majLigne(index, { unite: e.target.value })}
                          >
                            {UNITES.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min={1}
                            className="w-full px-2 py-1 border border-border rounded bg-background text-sm"
                            value={ligne.quantite}
                            onChange={(e) => majLigne(index, { quantite: Number(e.target.value) })}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-full px-2 py-1 border border-border rounded bg-background text-sm"
                            value={ligne.prixUnitaire}
                            onChange={(e) => majLigne(index, { prixUnitaire: Number(e.target.value) })}
                          />
                        </td>
                        <td className="py-2 px-2 text-sm text-card-foreground font-mono">
                          {formatMontant(ligne.montant)}
                        </td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => supprimerLigne(index)}
                            disabled={lignes.length === 1}
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                            title="Supprimer la ligne"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={ajouterLigne}
                className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
                Ajouter un matériel
              </button>
              <div className="flex items-center justify-end gap-2 pt-2">
                <span className="text-sm text-muted-foreground">TOTAL :</span>
                <span className="text-lg text-card-foreground font-semibold font-mono">
                  {formatMontant(total)}
                </span>
              </div>
              {/* Section D — Déclaration de prise en charge */}
              <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-3">
                <h4 className="text-sm text-card-foreground">Déclaration de prise en charge</h4>
                <p className="text-xs text-muted-foreground">
                  Je soussigné(e), dépositaire, déclare avoir pris en charge le
                  matériel désigné ci-dessus, conformément au modèle « Ordre
                  d'entrée ».
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Date</label>
                    <input type="date" className={inputClass} value={admin.declarationDate} onChange={(e) => setAdmin({ ...admin, declarationDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Nom du responsable</label>
                    <input className={inputClass} value={admin.declarationNom} onChange={(e) => setAdmin({ ...admin, declarationNom: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Fonction</label>
                    <input className={inputClass} value={admin.declarationFonction} onChange={(e) => setAdmin({ ...admin, declarationFonction: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 4 — Vérification */}
          {etape === 4 && (
            <div className="space-y-4">
              <div className="border border-border rounded-lg divide-y divide-border">
                {[
                  { label: "Date d'entrée", value: new Date(dateEntree).toLocaleDateString("fr-FR") },
                  { label: "Type d'opération", value: admin.typeOperation ? TYPE_OPERATION_LABELS[admin.typeOperation] : "—" },
                  { label: "Fournisseur", value: fournisseurs.find((f) => f.documentId === fournisseurId)?.nom || "—" },
                  { label: "N° facture", value: numeroFacture || "—" },
                  { label: "Direction", value: directions.find((d) => d.documentId === directionId)?.nom || "—" },
                  { label: "Service", value: services.find((s) => s.documentId === serviceId)?.nom || "—" },
                  { label: "Nombre de matériels", value: String(lignes.length) },
                  { label: "TOTAL", value: formatMontant(total) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="text-card-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-2 px-3 text-xs text-muted-foreground">Désignation</th>
                      <th className="text-left py-2 px-3 text-xs text-muted-foreground">Qté</th>
                      <th className="text-left py-2 px-3 text-xs text-muted-foreground">P.U.</th>
                      <th className="text-left py-2 px-3 text-xs text-muted-foreground">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0">
                        <td className="py-2 px-3 text-card-foreground">{l.designation}</td>
                        <td className="py-2 px-3 text-card-foreground">{l.quantite}</td>
                        <td className="py-2 px-3 text-card-foreground font-mono">{formatMontant(l.prixUnitaire)}</td>
                        <td className="py-2 px-3 text-card-foreground font-mono">{formatMontant(l.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                L'entrée sera enregistrée avec le statut « En attente » (0/3
                signatures). Elle ne sera VALIDÉE qu'après les 3 signatures
                obligatoires : Dépositaire, Chef de service 1, Chef de service 2.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <button
            onClick={() => setEtape((e) => Math.max(1, e - 1))}
            disabled={etape === 1}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </button>
          <div className="text-xs text-muted-foreground">
            Étape {etape} / {ETAPES.length}
          </div>
          {etape < ETAPES.length ? (
            <button
              onClick={suivant}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={enregistrer}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Enregistrer l'entrée
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
