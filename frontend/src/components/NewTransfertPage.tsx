import { useEffect, useMemo, useState } from "react";
import {
  X,
  ChevronRight,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  ArrowRightLeft,
  ArrowLeft,
  Info,
  ClipboardCheck,
  Send,
} from "lucide-react";
import { User } from "../App";
import {
  MOTIFS_TRANSFERT,
  creerTransfert,
  verifierTransfertValide,
  TransfertRecord,
} from "../lib/transferts";
import { EntreeRecord } from "../lib/movements";
import {
  fetchDirections,
  fetchMaterials,
  fetchServices,
  MaterialOption,
  RefOption,
} from "../lib/api";
import {
  DIRECTIONS_REPLI,
  SERVICES_REPLI,
  filtrerServicesParDirection,
  responsablesDuService,
} from "../lib/organigramme";

// NOUVEAU TRANSFERT ENTRE DIRECTIONS — assistant en 4 étapes
//   1. Origine (Direction / Service / matériel / quantité)
//   2. Destination (Direction ≠ origine, responsables automatiques)
//   3. Motif et observation
//   4. Vérification et création (référence TRF-AAAA-NNN)
const ETAPES = [
  { numero: 1, label: "Direction et service d'origine", icon: MapPin },
  { numero: 2, label: "Direction et service destinataires", icon: ArrowRightLeft },
  { numero: 3, label: "Motif du transfert", icon: ClipboardCheck },
  { numero: 4, label: "Vérification et création", icon: Check },
];

interface NewTransfertPageProps {
  user?: User;
  entrees: EntreeRecord[];
  onClose: () => void;
  onCreated: (reference: string) => void;
}

export function NewTransfertPage({
  user,
  entrees,
  onClose,
  onCreated,
}: NewTransfertPageProps) {
  const [etape, setEtape] = useState(1);
  const [erreur, setErreur] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingReferences, setLoadingReferences] = useState(true);

  // Données de référence
  const [directions, setDirections] = useState<RefOption[]>([]);
  const [services, setServices] = useState<RefOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const charger = async () => {
      setLoadingReferences(true);
      try {
        const [dirs, svcs, mats] = await Promise.all([
          fetchDirections(),
          fetchServices(),
          fetchMaterials(),
        ]);
        if (cancelled) return;
        setDirections(dirs && dirs.length ? dirs : DIRECTIONS_REPLI);
        setServices(svcs && svcs.length ? svcs : SERVICES_REPLI);
        setMaterials(mats ?? []);
      } catch {
        if (!cancelled) {
          setDirections(DIRECTIONS_REPLI);
          setServices(SERVICES_REPLI);
        }
      } finally {
        if (!cancelled) setLoadingReferences(false);
      }
    };
    charger();
    return () => {
      cancelled = true;
    };
  }, []);

  // Étape 1 — origine
  const [directionOrigineId, setDirectionOrigineId] = useState("");
  const [serviceOrigineId, setServiceOrigineId] = useState("");
  const [materielChoisi, setMaterielChoisi] = useState("");
  const [quantite, setQuantite] = useState(1);

  // Étape 2 — destination
  const [directionDestId, setDirectionDestId] = useState("");
  const [serviceDestId, setServiceDestId] = useState("");

  // Étape 3 — motif
  const [motif, setMotif] = useState(MOTIFS_TRANSFERT[0]);
  const [observation, setObservation] = useState("");

  const servicesOrigineVisibles = filtrerServicesParDirection(
    services,
    directionOrigineId
  );
  const servicesDestVisibles = filtrerServicesParDirection(
    services,
    directionDestId
  );

  const directionOrigine = directions.find(
    (d) => d.documentId === directionOrigineId
  );
  const serviceOrigine = services.find((s) => s.documentId === serviceOrigineId);
  const directionDest = directions.find((d) => d.documentId === directionDestId);
  const serviceDest = services.find((s) => s.documentId === serviceDestId);

  const nomDirectionOrigine = directionOrigine?.nom || "—";
  const nomServiceOrigine = serviceOrigine?.nom || "—";
  const nomDirectionDest = directionDest?.nom || "—";
  const nomServiceDest = serviceDest?.nom || "—";

  // Responsables automatiques de chaque côté (jamais de « Dépositaire général »)
  const responsablesOrigine = useMemo(
    () => responsablesDuService(serviceOrigine, directionOrigine),
    [serviceOrigine, directionOrigine]
  );
  const responsablesDestination = useMemo(
    () => responsablesDuService(serviceDest, directionDest),
    [serviceDest, directionDest]
  );

  // Matériels disponibles dans le stock du service d'origine (entrées validées)
  const materielsDisponibles = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entrees) {
      if (e.direction !== nomDirectionOrigine || e.service !== nomServiceOrigine) {
        continue;
      }
      if (e.lignes && e.lignes.length > 0) {
        for (const l of e.lignes) {
          if (!l.designation) continue;
          map.set(
            l.designation,
            (map.get(l.designation) || 0) + (Number(l.quantite) || 0)
          );
        }
      } else if (e.materiel && e.materiel !== "—") {
        map.set(e.materiel, (map.get(e.materiel) || 0) + (Number(e.quantite) || 0));
      }
    }
    return map;
  }, [entrees, nomDirectionOrigine, nomServiceOrigine]);

  const stockDisponible = materielsDisponibles.get(materielChoisi) || 0;

  const changerDirectionOrigine = (id: string) => {
    setDirectionOrigineId(id);
    setServiceOrigineId("");
    setMaterielChoisi("");
    setQuantite(1);
  };

  const validerEtape = (n: number): string => {
    if (n === 1) {
      if (!directionOrigineId) return "Veuillez sélectionner la Direction d'origine.";
      if (!serviceOrigineId) return "Veuillez sélectionner le Service d'origine.";
      if (!materielChoisi) return "Veuillez sélectionner le matériel à transférer.";
      if (!(Number(quantite) > 0)) return "La quantité doit être supérieure à 0.";
      if (stockDisponible > 0 && Number(quantite) > stockDisponible) {
        return `Stock insuffisant : ${stockDisponible} unité(s) disponible(s) dans ${nomServiceOrigine}.`;
      }
      if (!responsablesOrigine.depositaire.trim()) {
        return "Le Dépositaire du service d'origine est requis (fiche du service à compléter).";
      }
    }
    if (n === 2) {
      const err = verifierTransfertValide(
        nomDirectionOrigine,
        nomDirectionDest
      );
      if (err) return err;
      if (!serviceDestId) return "Veuillez sélectionner le Service destinataire.";
      if (
        nomDirectionOrigine === nomDirectionDest &&
        nomServiceOrigine === nomServiceDest
      ) {
        return "Le service destinataire doit être différent du service d'origine.";
      }
      if (!responsablesDestination.depositaire.trim()) {
        return "Le Dépositaire du service destinataire est requis (fiche du service à compléter).";
      }
    }
    if (n === 3) {
      if (!motif) return "Veuillez choisir le motif du transfert.";
    }
    return "";
  };

  const suivant = () => {
    const err = validerEtape(etape);
    setErreur(err);
    if (!err) setEtape((e) => Math.min(4, e + 1));
  };

  const creer = () => {
    for (let n = 1; n <= 3; n += 1) {
      const err = validerEtape(n);
      if (err) {
        setErreur(err);
        setEtape(n);
        return;
      }
    }
    setErreur("");
    setSaving(true);
    try {
      const record: TransfertRecord = creerTransfert({
        directionOrigine: nomDirectionOrigine,
        serviceOrigine: nomServiceOrigine,
        directionDestination: nomDirectionDest,
        serviceDestination: nomServiceDest,
        materiel: materielChoisi,
        quantite: Number(quantite),
        motif,
        observation,
        createur: user?.name || "—",
        createurEmail: user?.email || "",
        responsablesOrigine: {
          depositaire: responsablesOrigine.depositaire,
          chefService1: responsablesOrigine.chefService1,
          chefService2: responsablesOrigine.chefService2,
        },
        responsablesDestination: {
          depositaire: responsablesDestination.depositaire,
          chefService1: responsablesDestination.chefService1,
          chefService2: responsablesDestination.chefService2,
        },
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

  if (loadingReferences) {
    return (
      <div className="p-3 sm:p-6 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="mb-3 h-6 w-2/3 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded-xl bg-muted/80" />
            <div className="h-24 animate-pulse rounded-xl bg-muted/80" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 pb-24 sm:pb-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Transferts
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">Nouveau transfert</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-primary/10 rounded-lg flex-shrink-0">
          <ArrowRightLeft className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight text-foreground">
            NOUVEAU TRANSFERT ENTRE DIRECTIONS
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Déplacement réel d'un matériel : SORTIE du stock de la Direction
            d'origine → TRANSFERT → ENTRÉE dans le stock de la Direction
            destinataire.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {erreur && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              <X className="h-4 w-4 shrink-0 mt-0.5" />
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
                  active ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
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
                    {terminee ? <Check className="h-4 w-4" /> : etapeDef.numero}
                  </span>
                  <Icon
                    className={`h-4 w-4 flex-shrink-0 ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`flex-1 text-sm sm:text-base ${
                      active ? "text-card-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {etapeDef.label}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 text-muted-foreground transition-transform lg:hidden ${
                      active ? "rotate-90" : ""
                    }`}
                  />
                </button>

                <div className={`${active ? "block" : "hidden"} p-4 sm:p-6 pt-0`}>
                  {/* ------------- ÉTAPE 1 — ORIGINE ------------- */}
                  {etapeDef.numero === 1 && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>
                            Direction d'origine <span className="text-red-500">*</span>
                          </label>
                          <select
                            className={inputClass}
                            value={directionOrigineId}
                            onChange={(e) => changerDirectionOrigine(e.target.value)}
                          >
                            <option value="">Sélectionner la Direction d'origine</option>
                            {directions.map((d) => (
                              <option key={d.documentId} value={d.documentId}>
                                {d.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>
                            Service d'origine <span className="text-red-500">*</span>
                          </label>
                          <select
                            className={inputClass}
                            value={serviceOrigineId}
                            onChange={(e) => {
                              setServiceOrigineId(e.target.value);
                              setMaterielChoisi("");
                            }}
                            disabled={!directionOrigineId}
                          >
                            <option value="">
                              {directionOrigineId
                                ? "Sélectionner le Service d'origine"
                                : "Choisissez d'abord une Direction"}
                            </option>
                            {servicesOrigineVisibles.map((s) => (
                              <option key={s.documentId} value={s.documentId}>
                                {s.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>
                            Matériel à transférer <span className="text-red-500">*</span>
                          </label>
                          {materielsDisponibles.size > 0 ? (
                            <select
                              className={inputClass}
                              value={materielChoisi}
                              onChange={(e) => setMaterielChoisi(e.target.value)}
                              disabled={!serviceOrigineId}
                            >
                              <option value="">
                                {serviceOrigineId
                                  ? "Sélectionner le matériel"
                                  : "Choisissez d'abord un Service"}
                              </option>
                              {Array.from(materielsDisponibles.keys()).map((m) => (
                                <option key={m} value={m}>
                                  {m} (stock : {materielsDisponibles.get(m)})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className={inputClass}
                              placeholder="Désignation du matériel"
                              value={materielChoisi}
                              onChange={(e) => setMaterielChoisi(e.target.value)}
                              disabled={!serviceOrigineId}
                            />
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {materielsDisponibles.size > 0
                              ? "Le stock affiché provient des entrées validées du service."
                              : "Aucun stock enregistré pour ce service : saisie libre."}
                          </p>
                        </div>
                        <div>
                          <label className={labelClass}>
                            Quantité <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            className={inputClass}
                            value={quantite}
                            onChange={(e) => setQuantite(Number(e.target.value))}
                          />
                          {materielChoisi && stockDisponible > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Disponible : {stockDisponible} unité(s)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Responsables du service d'origine — automatiques */}
                      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Responsables de la Direction d'origine (automatiques)
                          </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <label className={labelClass}>Dépositaire du service</label>
                            <input className={inputClass} value={responsablesOrigine.depositaire} readOnly />
                          </div>
                          <div>
                            <label className={labelClass}>Chef de service 1</label>
                            <input className={inputClass} value={responsablesOrigine.chefService1} readOnly />
                          </div>
                          <div>
                            <label className={labelClass}>Chef de service 2</label>
                            <input className={inputClass} value={responsablesOrigine.chefService2} readOnly />
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-blue-700 dark:text-blue-300">
                          Ils valideront la SORTIE (3 signatures) avant l'envoi du
                          matériel. Aucun « Dépositaire général » : les
                          responsables sont ceux du service concerné.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ------------- ÉTAPE 2 — DESTINATION ------------- */}
                  {etapeDef.numero === 2 && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>
                            Direction destinataire <span className="text-red-500">*</span>
                          </label>
                          <select
                            className={inputClass}
                            value={directionDestId}
                            onChange={(e) => {
                              setDirectionDestId(e.target.value);
                              setServiceDestId("");
                            }}
                          >
                            <option value="">Sélectionner la Direction destinataire</option>
                            {directions
                              .filter((d) => d.documentId !== directionOrigineId)
                              .map((d) => (
                                <option key={d.documentId} value={d.documentId}>
                                  {d.nom}
                                </option>
                              ))}
                          </select>
                          <p className="mt-1 text-xs text-muted-foreground">
                            La Direction d'origine ({nomDirectionOrigine}) est
                            exclue : même Direction = affectation interne.
                          </p>
                        </div>
                        <div>
                          <label className={labelClass}>
                            Service destinataire <span className="text-red-500">*</span>
                          </label>
                          <select
                            className={inputClass}
                            value={serviceDestId}
                            onChange={(e) => setServiceDestId(e.target.value)}
                            disabled={!directionDestId}
                          >
                            <option value="">
                              {directionDestId
                                ? "Sélectionner le Service destinataire"
                                : "Choisissez d'abord une Direction"}
                            </option>
                            {servicesDestVisibles.map((s) => (
                              <option key={s.documentId} value={s.documentId}>
                                {s.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Responsables du service destinataire — automatiques */}
                      <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-900/20 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Info className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">
                            Responsables de la Direction destinataire (automatiques)
                          </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <label className={labelClass}>Dépositaire du service</label>
                            <input className={inputClass} value={responsablesDestination.depositaire} readOnly />
                          </div>
                          <div>
                            <label className={labelClass}>Chef de service 1</label>
                            <input className={inputClass} value={responsablesDestination.chefService1} readOnly />
                          </div>
                          <div>
                            <label className={labelClass}>Chef de service 2</label>
                            <input className={inputClass} value={responsablesDestination.chefService2} readOnly />
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-green-700 dark:text-green-300">
                          Ils valideront la RÉCEPTION (0/3 → 3/3) à l'arrivée du
                          matériel : entrée en stock validée à 3/3.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ------------- ÉTAPE 3 — MOTIF ------------- */}
                  {etapeDef.numero === 3 && (
                    <div className="space-y-4">
                      <div>
                        <label className={labelClass}>
                          Motif du transfert <span className="text-red-500">*</span>
                        </label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {MOTIFS_TRANSFERT.map((m) => (
                            <label
                              key={m}
                              className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg cursor-pointer text-sm transition-colors ${
                                motif === m
                                  ? "border-primary bg-primary/5 text-card-foreground"
                                  : "border-border hover:bg-muted/30"
                              }`}
                            >
                              <input
                                type="radio"
                                name="motifTransfert"
                                checked={motif === m}
                                onChange={() => setMotif(m)}
                                className="accent-primary"
                              />
                              {m}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Observation</label>
                        <textarea
                          className={inputClass}
                          rows={3}
                          placeholder="Précisions éventuelles sur le transfert…"
                          value={observation}
                          onChange={(e) => setObservation(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* ------------- ÉTAPE 4 — VÉRIFICATION ------------- */}
                  {etapeDef.numero === 4 && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-border bg-muted/20 p-4">
                        <h4 className="text-sm font-medium text-card-foreground mb-3">
                          RÉSUMÉ DU TRANSFERT
                        </h4>
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <span className="text-xs text-muted-foreground">Direction d'origine</span>
                            <div className="text-card-foreground">{nomDirectionOrigine}</div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Direction destinataire</span>
                            <div className="text-card-foreground">{nomDirectionDest}</div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Service d'origine</span>
                            <div className="text-card-foreground">{nomServiceOrigine}</div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Service destinataire</span>
                            <div className="text-card-foreground">{nomServiceDest}</div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Matériel</span>
                            <div className="text-card-foreground">{materielChoisi}</div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Quantité</span>
                            <div className="text-card-foreground">{quantite} unité(s)</div>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-xs text-muted-foreground">Motif</span>
                            <div className="text-card-foreground">{motif}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        Processus : SORTIE VALIDÉE (3 signatures origine) → EN
                        TRANSFERT → RÉCEPTION EN COURS (3 signatures
                        destination) → ENTRÉE EN STOCK VALIDÉE. Un numéro de
                        transfert TRF-AAAA-NNN et un QR Code seront générés.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------------- Colonne latérale — processus ---------------- */}
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6">
            <h3 className="text-sm font-medium text-card-foreground mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Processus du transfert
            </h3>
            <ol className="space-y-3 text-sm">
              {[
                "Direction d'origine : validation de la sortie par le Dépositaire, le Chef de service 1 et le Chef de service 2",
                "SORTIE du stock : le matériel quitte la Direction d'origine (statut « En transfert »)",
                "Direction destinataire : réception, vérification puis validation par ses 3 responsables",
                "ENTRÉE EN STOCK VALIDÉE : le matériel rejoint le stock de la Direction destinataire",
                "Traçabilité complète : référence TRF, QR Code, historique, PDF / Excel",
              ].map((texte, i) => (
                <li key={i} className="flex items-start gap-2 text-muted-foreground">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {texte}
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm p-4 sm:p-6">
            <h3 className="text-sm font-medium text-card-foreground mb-2">
              Affectation ou transfert ?
            </h3>
            <p className="text-xs text-muted-foreground">
              <strong className="text-card-foreground">Affectation interne</strong>{" "}
              : même Direction, pas de sortie, pas d'entrée (rubrique
              Affectations).{" "}
              <strong className="text-card-foreground">Transfert</strong> :
              Directions différentes, vraie sortie + vraie entrée (cette
              rubrique).
            </p>
          </div>
        </div>
      </div>

      {/* Barre d'actions */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-72 border-t border-border bg-background/95 backdrop-blur p-3 sm:p-4 flex items-center justify-between gap-3 z-40">
        <button
          type="button"
          onClick={() => setEtape((e) => Math.max(1, e - 1))}
          disabled={etape === 1 || saving}
          className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Précédent
        </button>
        {etape < 4 ? (
          <button
            type="button"
            onClick={suivant}
            className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={creer}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Créer le transfert
          </button>
        )}
      </div>
    </div>
  );
}
