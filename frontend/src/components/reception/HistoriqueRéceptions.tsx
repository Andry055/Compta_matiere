import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  SortieRecord,
  receptions,
  receptionAnomalies,
  getStatutRéceptionSortie,
  getQuantiteDejaRecue,
} from "@/lib/movements";
import {
  Truck,
  Package,
  Clock,
  User as UserIcon,
  AlertTriangle,
  FileText,
} from "lucide-react";

const STATUT_BADGE: Record<string, string> = {
  "En cours": "bg-blue-50 text-blue-700 border-blue-200",
  Partielle: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Complète: "bg-green-50 text-green-700 border-green-200",
  Annulée: "bg-red-50 text-red-700 border-red-200",
};

interface HistoriqueRéceptionsProps {
  receptionsList: typeof receptions;
}

export function HistoriqueRéceptions({ receptionsList }: HistoriqueRéceptionsProps) {
  const receptionsTriees = useMemo(
    () => [...receptionsList].sort((a, b) => (a.dateRéception < b.dateRéception ? 1 : -1)),
    [receptionsList]
  );

  const anomaliesParSortie = useMemo(() => {
    const map: Record<string, number> = {};
    receptionAnomalies.forEach((a) => {
      map[a.sortieId] = (map[a.sortieId] || 0) + 1;
    });
    return map;
  }, [receptionAnomalies]);

  if (receptionsTriees.length === 0) {
    return (
      <div className="msr-etat">
        <Package className="w-10 h-10 text-muted-foreground mb-2" />
        <h3 className="font-medium text-foreground mb-1">Aucune réception enregistrée</h3>
        <p className="text-sm text-muted-foreground">
          Aucune réception physique n'a encore été effectuée.
        </p>
      </div>
    );
  }

  return (
    <div className="msr-liste">
      <Card className="msr-carte border border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Historique des réceptions physiques ({receptionsTriees.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Consultation des réceptions effectuées et de leurs anomalies associées.
          </p>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border">
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Référence
                  </TableHead>
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Matériel
                  </TableHead>
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Date de réception
                  </TableHead>
                  <TableHead className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Dépositaire
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
                    Anomalies
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receptionsTriees.map((reception) => {
                  const nbAnomalies = anomaliesParSortie[reception.id] || 0;
                  const anomaliesOuvertes = receptionAnomalies.filter(
                    (a) => a.sortieId === reception.id && a.statut === "Ouverte"
                  ).length;
                  return (
                    <TableRow
                      key={reception.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="py-3 px-3 text-sm font-mono text-card-foreground">
                        {reception.reference}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm text-card-foreground max-w-[200px] truncate">
                        {reception.lignes[0]?.designation || "—"}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm text-card-foreground whitespace-nowrap">
                        {new Date(reception.dateRéception).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm text-card-foreground">
                        {reception.depositaireNom}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm text-card-foreground">
                        {reception.direction}
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm text-card-foreground">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs">
                            {reception.lignes.reduce((s, l) => s + l.quantiteRecue, 0)} reçue(s)
                          </span>
                          <span className="text-xs text-muted-foreground">
                            sur {reception.lignes.reduce((s, l) => s + l.quantitePrevue, 0)} prévue(s)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${STATUT_BADGE[reception.statut]}`}
                        >
                          {reception.statut}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-3 text-sm">
                        {nbAnomalies > 0 ? (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className={`h-3 w-3 ${
                              anomaliesOuvertes > 0 ? "text-red-600" : "text-green-600"
                            }`} />
                            <span className={`font-medium ${anomaliesOuvertes > 0 ? "text-red-600" : "text-green-600"}`}>
                              {nbAnomalies} {nbAnomalies > 1 ? "anomalies" : "anomalie"}
                              {anomaliesOuvertes > 0 ? ` (${anomaliesOuvertes} ouverte(s))` : ""}
                            </span>
                          </div>
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
