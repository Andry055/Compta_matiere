import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { toast } from "sonner";
import {
  BookOpen,
  List,
  AlertTriangle,
} from "lucide-react";

import { fetchAllSortiesOrThrow } from "../lib/api";
import { sortiesPerimetre, splitDepartement } from "../lib/movements";
import { estRemise } from "../lib/remiseSortie";
import type { User } from "../App";
import type { SortieRecord } from "../lib/movements";

interface MiniJournalDirectionProps {
  user: User;
}

/** Formate un montant entier avec des séparateurs de milliers (espaces). */
function formaterEntier(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formaterMontant(valeur: number | undefined | null): string {
  if (valeur == null) return "—";
  return formaterEntier(valeur) + " Ar";
}

/** Quantité totale d'une sortie (somme des lignes, ou champ quantite si pas de lignes). */
function quantiteSortie(s: SortieRecord): number {
  if (!s.lignes || s.lignes.length === 0) return s.quantite;
  return s.lignes.reduce((acc, l) => acc + Number(l.quantite || 0), 0);
}

/** Montant total d'une sortie (somme des lignes). */
function montantSortie(s: SortieRecord): number {
  if (!s.lignes || s.lignes.length === 0) return 0;
  return s.lignes.reduce((acc, l) => acc + Number(l.montant || 0), 0);
}

export function MiniJournalDirection({ user }: MiniJournalDirectionProps) {
  const [sorties, setSorties] = useState<SortieRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    async function charger() {
      try {
        setLoading(true);
        setError(null);
        const records = await fetchAllSortiesOrThrow();
        if (!annule) {
          // Scoping direction via sortiesPerimetre (splitDepartement + memesOrga)
          const perimetre = sortiesPerimetre(records, {
            role: user.role,
            name: user.name,
            department: user.department,
          });
          // Ne garder que les sorties effectivement remises au dépositaire
          const remises = perimetre.filter((s) => estRemise(s));
          setSorties(remises);
        }
      } catch (e) {
        if (!annule) {
          setError(e instanceof Error ? e.message : "Erreur inconnue");
          toast.error("Impossible de charger le mini-journal");
        }
      } finally {
        if (!annule) setLoading(false);
      }
    }
    charger();
    return () => { annule = true; };
  }, [user.role, user.name, user.department]);

  const { direction: directionUtilisateur } = splitDepartement(user.department || "");

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-8 text-center">
          <List className="mx-auto h-8 w-8 text-muted-foreground animate-spin" />
          <p className="mt-2 text-sm text-muted-foreground">
            Chargement du mini-journal…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <h3 className="mt-2 text-sm font-medium">{error}</h3>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (sorties.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            <BookOpen className="mr-2 h-4 w-4" />
            Mini-journal — {directionUtilisateur}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun matériel remis pour votre direction pour le moment.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalGeneral = sorties.reduce((acc, s) => acc + montantSortie(s), 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          <BookOpen className="mr-2 h-4 w-4" />
          Mini-journal — {directionUtilisateur}
        </CardTitle>
        <CardDescription>
          Registre des sorties effectuées de votre direction (remises au dépositaire)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableCaption>
              {sorties.length} entrée{sorties.length > 1 ? "s" : ""} — total :
              {formaterMontant(totalGeneral)}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date sortie</TableHead>
                <TableHead>Date remise</TableHead>
                <TableHead>Détenteur</TableHead>
                <TableHead>Fonction</TableHead>
                <TableHead>Matériel</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead>État</TableHead>
                <TableHead className="text-right">Valeur un.</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>N° logistique</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorties.map((s) => {
                const premiereLigne = s.lignes?.[0];
                return (
                  <TableRow key={s.documentId || s.id}>
                    <TableCell>{s.reference}</TableCell>
                    <TableCell>{s.dateSortie}</TableCell>
                    <TableCell>{s.dateRemise || "—"}</TableCell>
                    <TableCell>{s.detenteurNom || "—"}</TableCell>
                    <TableCell>{s.detenteurFonction || "—"}</TableCell>
                    <TableCell>
                      {premiereLigne?.designation || s.materiel}
                      {s.lignes && s.lignes.length > 1
                        ? ` (+${s.lignes.length - 1})`
                        : ""}
                    </TableCell>
                    <TableCell className="text-right">{quantiteSortie(s)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {premiereLigne?.etat || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {premiereLigne?.valeurUnitaire != null
                        ? formaterMontant(premiereLigne.valeurUnitaire)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {montantSortie(s) > 0
                        ? formaterMontant(montantSortie(s))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {premiereLigne?.numeroLogistique || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="font-medium text-right"
                >
                  Total général : {formaterMontant(totalGeneral)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * LIMITATION CONNUE (documentée) :
 *
 * Le backend `/api/sorties` filtre le demandeur à ses seules sorties
 * (`demande.demandeur == user.documentId`, voir
 * backend/src/api/sortie/controllers/sortie.js:464-474). Le demandeur de
 * direction ne verra donc que ses propres sorties effectuées, pas
 * l'intégralité des sorties de sa direction, tant qu'un filtre côté serveur
 * par direction n'est pas ajouté. Ce composant fonctionne avec les données
 * disponibles et remonte l'erreur si l'API est indisponible.
 */
