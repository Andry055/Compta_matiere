import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { User } from "../App";
import { Message } from "./ui/message";
import { EntreeRecord } from "../lib/movements";
import { fetchDirections, fetchServices, RefOption } from "../lib/api";
import {
  DIRECTIONS_REPLI,
  SERVICES_REPLI,
  responsablesDuService,
} from "../lib/organigramme";
import {
  AFFECTATION_VALIDATIONS,
  AffectationRecord,
  calculerStock,
  creerAffectation,
  listerAffectations,
  stockDuService,
} from "../lib/affectations";

// ---------------------------------------------------------------------------
// NOUVEAU TRANSFERT — assistant en 3 étapes
//   1 DIRECTION DESTINATAIRE → 2 MATÉRIEL → 3 MOTIF ET CRÉATION
// L'origine (Direction + service) n'est PAS à saisir : elle est déduite du
// compte connecté et affichée en lecture seule. Le matériel quitte donc la
// Direction du compte pour rejoindre la Direction destinataire choisie.
// ---------------------------------------------------------------------------

const ETAPES = [
  { numero: 1, label: "Direction destinataire", icon: MapPin },
  { numero: 2, label: "Matériel", icon: Boxes },
  { numero: 3, label: "Motif et création", icon: FileText },
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

  // Origine — Direction du compte (les enregistrements stockent le NOM de la
  // Direction) : pré-remplie automatiquement, cf. l'effet « Direction d'origine ».
  const [direction, setDirection] = useState("");

  // Étape 1 — Direction destinataire. Le service d'origine n'est plus choisi :
  // il est DÉDUIT DU COMPTE (cf. `serviceSource`, dérivé plus bas).
  const [directionDestinataire, setDirectionDestinataire] = useState("");

  // Étape 2 — Matériel
  const [materielCle, setMaterielCle] = useState("");
  const [quantite, setQuantite] = useState(1);

  // Étape 3 — Motif (donnée SAISIE, plus une liste déroulante)
  const [motif, setMotif] = useState("");
  const [observation, setObservation] = useState("");

  // Responsables (récupérés automatiquement, restent modifiables)
  const [responsableTransfert, setResponsableTransfert] = useState("");
  const [depositaire, setDepotParService] = useState("");

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

  // ---------------------------------------------------------------------
  // Direction d'origine : DÉDUITE DU COMPTE CONNECTÉ
  // ---------------------------------------------------------------------
  // Le département du profil porte « Direction - Service » (ex. "DAF -
  // Service Comptabilité Matière") ou le seul nom d'une Direction. On
  // rapproche la 1ère composante de l'abréviation / du nom du référentiel —
  // même correspondance que celle utilisée par l'écran Réception physique.
  // Aucune correspondance ⇒ le champ reste à choisir manuellement ; le choix
  // déjà fait par l'utilisateur n'est jamais écrasé (remplissage unique).
  const directionInitialisee = useRef(false);
  useEffect(() => {
    if (directionInitialisee.current) return;
    if (!directions.length) return; // référentiel pas encore chargé
    directionInitialisee.current = true;

    const departement = (user?.department || "").trim();
    if (!departement) return;
    const cle = departement.split(" - ")[0].trim().toLowerCase();  // Aucune correspondance ⇒ on garde la Direction brute du département :
  // le sélecteur d'origine n'existe plus, le champ doit toujours avoir une
  // valeur pour que la suite de l'assistant reste utilisable.
  const trouve = directions.find(
    (d) =>
      (d.abbreviation && d.abbreviation.trim().toLowerCase() === cle) ||
      (d.nom && d.nom.trim().toLowerCase() === cle) ||
      (d.nom && d.nom.trim().toLowerCase() === departement.toLowerCase())
  );
  setDirection(trouve?.nom || departement.split(" - ")[0].trim());
  }, [directions, user?.department]);

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

  // ---------------------------------------------------------------------
  // Service d'origine : DÉDUIT DU COMPTE, jamais choisi
  // ---------------------------------------------------------------------
  // Département « Direction - Service » du profil → nom du service, rapproché
  // du référentiel (casse/« Service » indifférents) puis du stock réel de la
  // Direction. Replis successifs : service du compte → premier service doté
  // d'un stock → 1er service du référentiel. Il est affiché en lecture seule.
  const serviceSource = useMemo(() => {
    if (!direction) return "";
    const departement = (user?.department || "").trim();
    const serviceCompte = departement.includes(" - ")
      ? departement.split(" - ").slice(1).join(" - ").trim()
      : "";
    const norm = (v: string) => v.trim().toLowerCase().replace(/^service\s+/, "");
    const cible = norm(serviceCompte);
    const correspondance = cible
      ? servicesOptions.find((c) => norm(c) === cible) ||
        servicesOptions.find((c) => norm(c).includes(cible) || cible.includes(norm(c)))
      : undefined;
    if (correspondance) return correspondance;

    const avecStock = stock
      .filter(
        (l) =>
          l.direction.trim().toLowerCase() === direction.trim().toLowerCase() &&
          l.quantite > 0
      )
      .map((l) => l.service);
    if (serviceCompte && avecStock.includes(serviceCompte)) return serviceCompte;
    return avecStock[0] || serviceCompte || servicesOptions[0] || "";
  }, [direction, servicesOptions, stock, user?.department]);

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
    if (numeroEtape === 1) {
      if (!directionDestinataire)
        return "Veuillez sélectionner la Direction destinataire.";
      if (
        directionDestinataire.trim().toLowerCase() ===
        direction.trim().toLowerCase()
      )
        return "La Direction destinataire doit être différente de la Direction d'origine.";
    }
    if (numeroEtape === 2) {
      if (!serviceSource)
        return "Aucun service d'origine n'est rattaché à votre compte.";
      if (materielsSource.length === 0)
        return `Aucun matériel disponible dans « ${serviceSource} » : le stock de votre service est vide.`;
      if (!materielSelectionne)
        return "Veuillez sélectionner le matériel à transférer.";
      const q = Number(quantite);
      if (!Number.isFinite(q) || q < 1 || q > materielSelectionne.quantite)
        return `Quantité invalide : disponible = ${materielSelectionne.quantite}.`;
    }
    if (numeroEtape === 3) {
      if (!motif.trim()) return "Veuillez saisir le motif du transfert.";
      if (!responsableTransfert.trim())
        return "Responsable du transfert requis (fiche du service à compléter).";
      if (!depositaire.trim()) return "Le Dépositaire du service est requis.";
    }
    return "";
  };

  const suivant = () => {
    const err = validerEtape();
    setErreur(err);
    if (!err) setEtape((e) => Math.min(ETAPES.length, e + 1));
  };

  const creer = () => {
    for (let e = 1; e <= ETAPES.length; e += 1) {
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
        directionDestinataire,
        serviceSource,
        materiel: materielSelectionne!.materiel,
        materielReference: materielSelectionne!.reference,
        quantite: Number(quantite),
        motif,
        observation,
        responsables: {
          responsableTransfert,
          depositaire,
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
          Transferts
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">Nouveau transfert</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-primary/10 rounded-lg flex-shrink-0">
          <ArrowLeftRight className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight text-foreground">
            NOUVEAU TRANSFERT
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Transfert d'un matériel vers une autre Direction : l'origine
            (Direction et service) vient de votre compte — sans création de
            sortie ni d'entrée.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Colonne formulaire */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Origine — issue du COMPTE : aucun sélecteur, lecture seule */}
          <div className="cm-panel cm-panel-solid rounded-lg p-4">
            <div className="text-xs font-medium text-muted-foreground mb-3">
              ORIGINE — ISSUE DE VOTRE COMPTE
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">
                  Direction d'origine
                </div>
                <div className="text-sm text-card-foreground">
                  {direction || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">
                  Service d'origine
                </div>
                <div className="text-sm text-card-foreground">
                  {serviceSource || "—"}
                </div>
              </div>
            </div>
          </div>

          {erreur && (
            <Message variant="danger">
              {erreur}
            </Message>
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
                  {/* ÉTAPE 1 — DIRECTION DESTINATAIRE */}
                  {etapeDef.numero === 1 && (
                    <div>
                      <label className={labelClass}>
                        Direction destinataire <span className="text-red-500">*</span>
                      </label>
                      <select
                        className={inputClass}
                        value={directionDestinataire}
                        onChange={(e) => setDirectionDestinataire(e.target.value)}
                      >
                        <option value="">Sélectionner une Direction</option>
                        {directionsOptions
                          .filter(
                            (nom) =>
                              nom.trim().toLowerCase() !==
                              direction.trim().toLowerCase()
                          )
                          .map((nom) => (
                            <option key={nom} value={nom}>
                              {nom}
                            </option>
                          ))}
                      </select>
                      <Message variant="success" size="sm" className="mt-3">
                        Le matériel quitte votre Direction « {direction || "—"} »
                        (origine issue de votre compte, non modifiable) pour
                        rejoindre la Direction choisie ci-dessus.
                      </Message>
                      {directionDestinataire && (
                        <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 text-sm text-card-foreground">
                          {direction} / {serviceSource || "—"} →{" "}
                          {directionDestinataire}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ÉTAPE 4 — MATÉRIEL */}
                  {etapeDef.numero === 2 && (
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
                  {etapeDef.numero === 3 && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>
                            Motif <span className="text-red-500">*</span>
                          </label>
                          <input
                            className={inputClass}
                            placeholder="Motif du transfert…"
                            value={motif}
                            onChange={(e) => setMotif(e.target.value)}
                          />
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
                      <div className="msg msg--info msg--lg">
                        <div className="msg-body">
                          <div className="flex items-center gap-2 mb-3">
                            <Info className="msg-icon h-4 w-4" />
                            <span className="msg-title text-sm">
                              Responsables du transfert (automatiques)
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
                        </div>
                        </div>
                      </div>

                      <Message variant="info" size="sm" icon={Info}>
                        Le transfert démarre « En attente » (0/2) : Responsable du
                        transfert (créateur) → Dépositaire. À 2/2, le stock est mis
                        à jour (−source / +Direction destinataire) et le transfert
                        est verrouillé.
                      </Message>
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
            <div className="cm-panel cm-panel-solid rounded-lg p-4">
              <h3 className="text-sm font-medium text-card-foreground mb-3">
                RÉSUMÉ DU TRANSFERT
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Direction", direction],
                  ["Service d'origine", serviceSource],
                  ["Direction destinataire", directionDestinataire],
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

            <div className="cm-panel cm-panel-solid rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-card-foreground">
                  VALIDATION
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                  {`0 / ${AFFECTATION_VALIDATIONS.length}`}
                </span>
              </div>
              <ul className="space-y-2 text-sm">
                {AFFECTATION_VALIDATIONS.map((v, i) => (
                  <li key={v.key} className="text-card-foreground">
                    {i + 1}. {v.label}
                  </li>
                ))}
              </ul>
              <div className="flex items-start gap-2 mt-3 px-3 py-2 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Aucune sortie, aucune nouvelle entrée : seul le stock change de
                Direction, avec traçabilité complète.
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
              Créer le transfert
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
