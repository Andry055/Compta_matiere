import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  MapPin,
  Package,
} from "lucide-react";
import { User } from "../App";
import { EntreeRecord } from "../lib/movements";
import { fetchDirections, fetchServices, RefOption } from "../lib/api";
import {
  DIRECTIONS_REPLI,
  SERVICES_REPLI,
  responsablesDuService,
} from "../lib/organigramme";
import {
  AffectationRecord,
  MOTIFS_AFFECTATION,
  calculerStock,
  creerAffectation,
  listerAffectations,
  stockDuService,
} from "../lib/affectations";

// ---------------------------------------------------------------------------
// NOUVELLE AFFECTATION — assistant en 5 étapes
//   1 DIRECTION → 2 SERVICE D'ORIGINE → 3 SERVICE DESTINATAIRE
//   → 4 MATÉRIEL → 5 MOTIF
// Le service destinataire appartient à la MÊME Direction (interdire
// Direction A → Direction B : ce serait un transfert, pas une affectation).
// ---------------------------------------------------------------------------

const ETAPES = [
  { numero: 1, label: "Direction", icon: MapPin },
  { numero: 2, label: "Service d'origine", icon: Package },
  { numero: 3, label: "Service destinataire", icon: ArrowLeftRight },
  { numero: 4, label: "Matériel", icon: Boxes },
  { numero: 5, label: "Motif et création", icon: FileText },
];

interface NewAffectationPageProps {
  user?: User;
  entrees: EntreeRecord[];
  onClose: () => void;
  onCreated: (reference: string) => void;
}

export function NewAffectationPage({
  user,
  entrees,
  onClose,
  onCreated,
}: NewAffectationPageProps) {
  const [etape, setEtape] = useState(1);
  const [erreur, setErreur] = useState("");
  const [saving, setSaving] = useState(false);

  // Étape 1 — Direction (les enregistrements stockent le NOM de la Direction)
  const [direction, setDirection] = useState("");

  // Étape 2 — Service d'origine
  const [serviceSource, setServiceSource] = useState("");

  // Étape 3 — Service destinataire
  const [serviceDestinataire, setServiceDestinataire] = useState("");

  // Étape 4 — Matériel
  const [materielCle, setMaterielCle] = useState("");
  const [quantite, setQuantite] = useState(1);

  // Étape 5 — Motif
  const [motif, setMotif] = useState(MOTIFS_AFFECTATION[0]);
  const [observation, setObservation] = useState("");

  // Responsables (récupérés automatiquement, restent modifiables)
  const [responsableTransfert, setResponsableTransfert] = useState("");
  const [depositaire, setDepotParService] = useState("");
  const [chefService1, setChefService1] = useState("");
  const [chefService2, setChefService2] = useState("");

  // Référentiels
  const [directions, setDirections] = useState<RefOption[]>([]);
  const [services, setServices] = useState<RefOption[]>([]);
  const [affectations, setAffectations] = useState<AffectationRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDirections(), fetchServices()]).then(([dirs, svcs]) => {
      if (cancelled) return;
      setDirections(dirs && dirs.length ? dirs : DIRECTIONS_REPLI);
      setServices(svcs && svcs.length ? svcs : SERVICES_REPLI);
    });
    setAffectations(listerAffectations());
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------
  // Stock consolidé (entrées validées + affectations validées)
  // ---------------------------------------------------------------------
  const stock = useMemo(
    () => calculerStock(entrees, affectations),
    [entrees, affectations]
  );

  const nomDirectionDeService = (s: RefOption): string =>
    directions.find((d) => d.documentId === s.directionId)?.nom || "";

  /** Directions proposées : référentiel ∪ Directions ayant un stock */
  const directionsOptions = useMemo(() => {
    const noms = new Map<string, string>();
    directions.forEach((d) => noms.set(d.nom.toLowerCase(), d.nom));
    stock.forEach((l) => {
      if (!noms.has(l.direction.toLowerCase())) {
        noms.set(l.direction.toLowerCase(), l.direction);
      }
    });
    return Array.from(noms.values());
  }, [directions, stock]);

  /** Services de la Direction sélectionnée (∪ services détenant un stock) */
  const servicesOptions = useMemo(() => {
    if (!direction) return [];
    const noms = new Map<string, string>();
    services.forEach((s) => {
      const dirDeService = s.directionId
        ? nomDirectionDeService(s)
        : ""; // API non peuplée : on garde le service sans filtre (see API)
      if (!dirDeService || dirDeService.toLowerCase() === direction.toLowerCase()) {
        noms.set(s.nom.toLowerCase(), s.nom);
      }
    });
    stock.forEach((l) => {
      if (l.direction.toLowerCase() === direction.toLowerCase()) {
        noms.set(l.service.toLowerCase(), l.service);
      }
    });
    return Array.from(noms.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, services, stock, directions]);

  const materielsSource = useMemo(
    () => stockDuService(stock, direction, serviceSource),
    [stock, direction, serviceSource]
  );

  const materielSelectionne = materielsSource.find(
    (l) => l.materiel === materielCle
  );

  // Responsables automatiques du service source
  useEffect(() => {
    if (!serviceSource) return;
    const svc = services.find(
      (s) =>
        s.nom === serviceSource &&
        (!s.directionId ||
          nomDirectionDeService(s).toLowerCase() === direction.toLowerCase())
    );
    const dir = directions.find((d) => d.nom === direction);
    const r = responsablesDuService(svc, dir);
    setResponsableTransfert(svc?.responsable || r.depositaire || "");
    setDepotParService(r.depositaire);
    setChefService1(r.chefService1);
    setChefService2(r.chefService2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceSource, direction, services, directions]);

  // Le matériel et la quantité sont réinitialisés quand le source change
  useEffect(() => {
    setMaterielCle("");
    setQuantite(1);
  }, [serviceSource]);

  // ---------------------------------------------------------------------
  // Validation par étape
  // ---------------------------------------------------------------------
  const validerEtape = (numeroEtape = etape): string => {
    if (numeroEtape === 1 && !direction)
      return "Veuillez sélectionner la Direction.";
    if (numeroEtape === 2) {
      if (!serviceSource) return "Veuillez sélectionner le service d'origine.";
      if (materielsSource.length === 0)
        return `Aucun matériel disponible dans « ${serviceSource} » : choisissez un autre service d'origine.`;
    }
    if (numeroEtape === 3) {
      if (!serviceDestinataire)
        return "Veuillez sélectionner le service destinataire.";
      if (serviceDestinataire === serviceSource)
        return "Le service destinataire doit être différent du service d'origine.";
    }
    if (numeroEtape === 4) {
      if (!materielSelectionne)
        return "Veuillez sélectionner le matériel à affecter.";
      const q = Number(quantite);
      if (!Number.isFinite(q) || q < 1 || q > materielSelectionne.quantite)
        return `Quantité invalide : disponible = ${materielSelectionne.quantite}.`;
    }
    if (numeroEtape === 5) {
      if (!motif) return "Veuillez choisir le motif de l'affectation.";
      if (!responsableTransfert.trim())
        return "Responsable du transfert requis (fiche du service à compléter).";
      if (!depositaire.trim()) return "Le Dépositaire du service est requis.";
      if (!chefService1.trim()) return "Le Chef de service 1 est requis.";
      if (!chefService2.trim()) return "Le Chef de service 2 est requis.";
    }
    return "";
  };

  const suivant = () => {
    const err = validerEtape();
    setErreur(err);
    if (!err) setEtape((e) => Math.min(5, e + 1));
  };

  const creer = () => {
    for (let e = 1; e <= 5; e += 1) {
      const err = validerEtape(e);
      if (err) {
        setErreur(err);
        setEtape(e);
        return;
      }
    }
    setErreur("");
    setSaving(true);
    try {
      const record = creerAffectation({
        direction,
        serviceSource,
        serviceDestinataire,
        materiel: materielSelectionne!.materiel,
        materielReference: materielSelectionne!.reference,
        quantite: Number(quantite),
        motif,
        observation,
        responsables: {
          responsableTransfert,
          depositaire,
          chefService1,
          chefService2,
        },
        createur: user?.name || "—",
        createurEmail: user?.email || "",
      });
      onCreated(record.reference);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring focus:border-transparent";
  const labelClass = "block text-xs sm:text-sm text-muted-foreground mb-1.5";

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 pb-24 sm:pb-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Affectations
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">Nouvelle affectation</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-primary/10 rounded-lg flex-shrink-0">
          <ArrowLeftRight className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight text-foreground">
            NOUVELLE AFFECTATION
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Réaffectation interne d'un matériel entre deux services d'une même
            Direction — sans sortie, sans nouvelle entrée.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Colonne formulaire */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {erreur && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              {erreur}
            </div>
          )}

          {ETAPES.map((etapeDef) => {
            const Icon = etapeDef.icon;
            const active = etape === etapeDef.numero;
            const terminee = etape > etapeDef.numero;
            return (
              <div
                key={etapeDef.numero}
                className={`bg-card border rounded-lg shadow-sm overflow-hidden ${
                  active
                    ? "border-primary/50 ring-1 ring-primary/20"
                    : "border-border"
                }`}
              >
                <button
                  onClick={() => setEtape(etapeDef.numero)}
                  className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
                    active ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold flex-shrink-0 ${
                      terminee
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {terminee ? <CheckCircle2 className="h-4 w-4" /> : etapeDef.numero}
                  </span>
                  <Icon
                    className={`h-4 w-4 flex-shrink-0 ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`flex-1 text-sm sm:text-base ${
                      active
                        ? "text-card-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {etapeDef.label}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      active ? "rotate-90" : ""
                    }`}
                  />
                </button>

                <div
                  className={`${active ? "block" : "hidden"} p-4 sm:p-6 pt-0`}
                >
                  {/* ÉTAPE 1 — DIRECTION */}
                  {etapeDef.numero === 1 && (
                    <div>
                      <label className={labelClass}>
                        Direction <span className="text-red-500">*</span>
                      </label>
                      <select
                        className={inputClass}
                        value={direction}
                        onChange={(e) => {
                          setDirection(e.target.value);
                          setServiceSource("");
                          setServiceDestinataire("");
                        }}
                      >
                        <option value="">Sélectionner une Direction</option>
                        {directionsOptions.map((nom) => (
                          <option key={nom} value={nom}>
                            {nom}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-muted-foreground">
                        L'affectation reste à l'intérieur de cette Direction
                        (Direction A → Direction B = transfert, opération
                        distincte avec sortie puis entrée).
                      </p>
                    </div>
                  )}

                  {/* ÉTAPE 2 — SERVICE D'ORIGINE */}
                  {etapeDef.numero === 2 && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>
                          Service d'origine <span className="text-red-500">*</span>
                        </label>
                        <select
                          className={inputClass}
                          value={serviceSource}
                          onChange={(e) => setServiceSource(e.target.value)}
                          disabled={!direction}
                        >
                          <option value="">Sélectionner</option>
                          {servicesOptions.map((nom) => (
                            <option key={nom} value={nom}>
                              {nom}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Seuls les matériels actuellement affectés à ce service
                          seront proposés à l'étape 4.
                        </p>
                      </div>

                      {serviceSource && materielsSource.length > 0 && (
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            MATÉRIAUX DISPONIBLES — {serviceSource}
                          </div>
                          <ul className="space-y-1 text-sm text-card-foreground">
                            {materielsSource.map((l) => (
                              <li
                                key={`${l.materiel}`}
                                className="flex justify-between gap-2"
                              >
                                <span className="truncate">
                                  {l.reference ? `${l.reference} — ` : ""}
                                  {l.materiel}
                                </span>
                                <span className="font-mono text-muted-foreground whitespace-nowrap">
                                  {l.quantite}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ÉTAPE 3 — SERVICE DESTINATAIRE */}
                  {etapeDef.numero === 3 && (
                    <div>
                      <label className={labelClass}>
                        Service destinataire <span className="text-red-500">*</span>
                      </label>
                      <select
                        className={inputClass}
                        value={serviceDestinataire}
                        onChange={(e) => setServiceDestinataire(e.target.value)}
                        disabled={!serviceSource}
                      >
                        <option value="">Sélectionner</option>
                        {servicesOptions
                          .filter((nom) => nom !== serviceSource)
                          .map((nom) => (
                            <option key={nom} value={nom}>
                              {nom}
                            </option>
                          ))}
                      </select>
                      <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-700 dark:text-green-300">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        Le service destinataire appartient obligatoirement à la
                        Direction « {direction || "—"} » : Direction A → Direction B
                        est automatiquement bloquée (ce serait un transfert).
                      </div>
                      {serviceSource && serviceDestinataire && (
                        <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 text-sm text-card-foreground">
                          {direction} / {serviceSource} → {serviceDestinataire}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ÉTAPE 4 — MATÉRIEL */}
                  {etapeDef.numero === 4 && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>
                          Matériel <span className="text-red-500">*</span>
                        </label>
                        <select
                          className={inputClass}
                          value={materielCle}
                          onChange={(e) => {
                            setMaterielCle(e.target.value);
                            const ligne = materielsSource.find(
                              (l) => l.materiel === e.target.value
                            );
                            setQuantite(ligne ? Math.min(1, ligne.quantite) : 1);
                          }}
                          disabled={materielsSource.length === 0}
                        >
                          <option value="">Sélectionner un matériel</option>
                          {materielsSource.map((l) => (
                            <option key={l.materiel} value={l.materiel}>
                              {l.materiel}
                              {l.reference ? ` (${l.reference})` : ""} —
                              disponible : {l.quantite}
                            </option>
                          ))}
                        </select>
                      </div>

                      {materielSelectionne && (
                        <div className="rounded-lg border border-border bg-muted/20 p-3 grid gap-2 sm:grid-cols-3 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Matériel
                            </div>
                            <div className="text-card-foreground">
                              {materielSelectionne.materiel}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Référence
                            </div>
                            <div className="text-card-foreground font-mono">
                              {materielSelectionne.reference || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Quantité disponible
                            </div>
                            <div className="text-card-foreground font-mono">
                              {materielSelectionne.quantite}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="max-w-xs">
                        <label className={labelClass}>
                          Quantité à affecter <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={materielSelectionne?.quantite || 1}
                          className={inputClass}
                          value={quantite}
                          onChange={(e) => setQuantite(Number(e.target.value))}
                          disabled={!materielSelectionne}
                        />
                      </div>
                    </div>
                  )}

                  {/* ÉTAPE 5 — MOTIF */}
                  {etapeDef.numero === 5 && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>
                            Motif <span className="text-red-500">*</span>
                          </label>
                          <select
                            className={inputClass}
                            value={motif}
                            onChange={(e) => setMotif(e.target.value)}
                          >
                            {MOTIFS_AFFECTATION.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Observation</label>
                          <input
                            className={inputClass}
                            placeholder="Précisions complémentaires…"
                            value={observation}
                            onChange={(e) => setObservation(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Responsables automatiques */}
                      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Responsables de l'affectation (automatiques)
                          </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className={labelClass}>
                              Responsable du transfert
                            </label>
                            <input
                              className={inputClass}
                              value={responsableTransfert}
                              onChange={(e) =>
                                setResponsableTransfert(e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Dépositaire</label>
                            <input
                              className={inputClass}
                              value={depositaire}
                              onChange={(e) => setDepotParService(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>
                              Chef de service 1
                            </label>
                            <input
                              className={inputClass}
                              value={chefService1}
                              onChange={(e) => setChefService1(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>
                              Chef de service 2
                            </label>
                            <input
                              className={inputClass}
                              value={chefService2}
                              onChange={(e) => setChefService2(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 px-4 py-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        L'affectation démarre « En attente » (0/4) : Responsable
                        du transfert (créateur) → Dépositaire → Chef de service 1
                        → Chef de service 2. À 4/4, le stock est mis à jour
                        (−source / +destinataire) et l'affectation est verrouillée.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Colonne droite — Résumé */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-4">
            <div className="bg-card border border-border rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-card-foreground mb-3">
                RÉSUMÉ DE L'AFFECTATION
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Direction", direction],
                  ["Service d'origine", serviceSource],
                  ["Service destinataire", serviceDestinataire],
                  ["Matériel", materielSelectionne?.materiel || ""],
                  [
                    "Référence",
                    materielSelectionne?.reference || "",
                  ],
                  ["Quantité", quantite ? String(quantite) : ""],
                  ["Motif", motif],
                  ["Créateur", user?.name || "—"],
                ].map(([label, valeur]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-card-foreground text-right truncate">
                      {valeur || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-card-foreground">
                  VALIDATION
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                  0 / 4
                </span>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="text-card-foreground">1. Responsable du transfert</li>
                <li className="text-card-foreground">2. Dépositaire</li>
                <li className="text-card-foreground">3. Chef de service 1</li>
                <li className="text-card-foreground">4. Chef de service 2</li>
              </ul>
              <div className="flex items-start gap-2 mt-3 px-3 py-2 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Aucune sortie, aucune nouvelle entrée : seul le service de
                destination change, avec traçabilité complète.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barre d'actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:relative sm:z-auto border-t border-border bg-card/95 backdrop-blur p-3 sm:p-0 sm:bg-transparent sm:border-0 sm:backdrop-blur-none">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-card-foreground"
          >
            Annuler
          </button>
          {etape > 1 && (
            <button
              onClick={() => setEtape((e) => Math.max(1, e - 1))}
              className="px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-card-foreground inline-flex items-center justify-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </button>
          )}
          {etape < ETAPES.length ? (
            <button
              onClick={suivant}
              className="px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={creer}
              disabled={saving}
              className="px-4 py-2.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Créer l'affectation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
