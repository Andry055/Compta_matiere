import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  Package,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { listerReceptionsPhysiques, type ReceptionPhysiqueRecord } from "@/lib/api";
import { toast } from "sonner";

const STATUT_BADGE: Record<string, string> = {
  conforme: "bg-green-50 text-green-700 border-green-200",
  anomalie: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const STATUT_LABEL: Record<string, string> = {
  conforme: "Conforme",
  anomalie: "Anomalie",
};

interface HistoriqueRéceptionsProps {
  // Données serveur réelles déjà chargées par le parent (EcranReception via
  // listerReceptionsPhysiques). Ce ne sont PAS des entrées locales fabriquées
  // à partir de l'état React : c'est le même jeu de données que celui affiché
  // dans « À réceptionner », simplement présenté sous forme d'historique.
  receptionsServeur?: ReceptionPhysiqueRecord[];
  // Rétrocompatibilité : une liste locale peut encore être fournie, mais
  // les données affichées proviennent de l'API backend.
  receptionsList?: Array<{
    id: string;
    reference: string;
    dateRéception: string;
    depositaireNom: string;
    direction: string;
    statut: string;
    quantite_recue?: number;
    quantite_prevue?: number;
  }>;
}

export function HistoriqueRéceptions({ receptionsServeur, receptionsList }: HistoriqueRéceptionsProps) {
  const [receptions, setReceptions] = useState<ReceptionPhysiqueRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const fetchReceptions = useCallback(async () => {
    setIsLoading(true);
    setErreur(null);
    try {
      const result = await listerReceptionsPhysiques();
      setReceptions(result ?? []);
    } catch {
      setErreur("Impossible de charger l'historique des réceptions depuis le serveur.");
      setReceptions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceptions();
  }, [fetchReceptions]);

  // Source de vérité : les données serveur transmises par le parent (fraîches,
  // rechargées après chaque confirmation de réception via chargerDonnées()),
  // sinon les données chargées par l'API dans ce composant, enfin la prop
  // receptionsList en rétrocompatibilité. Jamais d'entrée fabriquée à partir
  // du seul état React local.
  const receptionsAffiches =
    (receptionsServeur && receptionsServeur.length > 0)
      ? receptionsServeur
      : (receptions.length > 0 ? receptions : (receptionsList ?? []));

  const receptionsTriees = useMemo(
    () =>
      [...receptionsAffiches].sort(
        (a, b) =>
          new Date(b.date_reception).getTime() - new Date(a.date_reception).getTime()
      ),
    [receptionsAffiches]
  );

  if (isLoading) {
    return (
      <div className="msc-empty">
        <Clock className="msc-empty__icon animate-spin" aria-hidden="true" />
        <h3 className="msc-empty__title">Chargement de l'historique…</h3>
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="msc-alert msc-alert--error" role="alert">
        <AlertTriangle className="msc-alert__icon" aria-hidden="true" />
        <div className="msc-alert__content">
          <div className="msc-alert__title">Erreur de chargement</div>
          <div className="msc-alert__description">{erreur}</div>
        </div>
      </div>
    );
  }

  if (receptionsTriees.length === 0) {
    return (
      <div className="msc-empty">
        <Package className="msc-empty__icon" aria-hidden="true" />
        <h3 className="msc-empty__title">Aucune réception enregistrée</h3>
        <p className="msc-empty__description">
          Aucune réception physique n'a encore été effectuée.
        </p>
      </div>
    );
  }

  return (
    <div className="msc-list">
      <Card className="msc-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Historique des réceptions physiques ({receptionsTriees.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Consultation des réceptions effectuées et de leurs anomalies associées.
          </p>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="msc-table-container" style={{ overflowX: 'auto' }}>
            <Table className="msc-table">
              <TableHeader>
                <TableRow className="border-b border-border">
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Référence
                  </TableHead>
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Matériel / Sortie
                  </TableHead>
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Date de réception
                  </TableHead>
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Utilisateur
                  </TableHead>
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Direction
                  </TableHead>
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Quantités
                  </TableHead>
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Statut
                  </TableHead>
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Anomalie
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receptionsTriees.map((reception) => {
                  // La relation sortie est peuplée via l'API (populate sortie.direction)
                  const sortie = (reception as any).sortie;
                  const reference =
                    sortie?.reference || `RCP-${reception.id}`;
                  const materiel = sortie?.materiel || "—";
                  const directionNom =
                    sortie?.direction?.nom_direction || "—";
                  const statutBrute = reception.statut;
                  const statutAffiche =
                    STATUT_LABEL[statutBrute] ?? statutBrute;
                  const estAnomalie = statutBrute === "anomalie";
                  return (
                    <TableRow
                      key={reception.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="py-3 px-3 text-sm font-mono text-card-foreground">
                        {reference}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm text-card-foreground max-w-[200px] truncate">
                        {materiel}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm text-card-foreground whitespace-nowrap">
                        {new Date(reception.date_reception).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm text-card-foreground">
                        {reception.utilisateur || "—"}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm text-card-foreground">
                        {directionNom}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm text-card-foreground">
                        <div className="msc-table__quantities">
                          <span className="msc-table__quantity-main">
                            {reception.quantite_recue} reçue(s)
                          </span>
                          <span className="msc-table__quantity-sub">
                            sur {reception.quantite_prevue} prévue(s)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <span
                          className={`msc-table__status ${estAnomalie ? "msc-table__status--anomalie" : "msc-table__status--conforme"}`}
                        >
                          {statutAffiche}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm">
                        {estAnomalie && reception.description_anomalie ? (
                          <span className="text-xs text-destructive truncate max-w-[150px]">
                            {reception.type_anomalie || "—"}:{" "}
                            {reception.description_anomalie}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
