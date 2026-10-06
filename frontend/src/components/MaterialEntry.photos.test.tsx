// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  DetailEntreeTraitee,
  envoyerPhotosApresSignature,
  receptionDepuisEntree,
} from "./MaterialEntry";
import {
  api,
  dataUrlVersFile,
  LIGNE_ENTREE_UID,
  signerEntree,
  uploadPhotosLigne,
} from "../lib/api";
import type { EntreeLigne, EntreeRecord } from "../lib/movements";

afterEach(cleanup);

/** JPEG 1x1 valide : c'est déjà ce que produit `compressImageFile` côté
 *  client (le fichier est envoyé tel quel, jamais recompressé). */
const PHOTO_1 =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8T/8AAwEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAB/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8Af//Q==";
const PHOTO_2 =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8T/8AAwEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAB/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8Af//Q==";

function lignesServeur(): EntreeLigne[] {
  return [
    {
      numeroOrdre: 1,
      documentId: "doc-ligne-1",
      id: 71,
      designation: "Clavier AZERTY",
      espece: "Info",
      unite: "unité",
      quantite: 10,
      prixUnitaire: 25000,
      montant: 250000,
      nomenclature: "NOM-001",
      pieceJustificative: "",
      observation: "",
      etat: "neuf",
      conforme: true,
      photos: [],
    },
    {
      numeroOrdre: 2,
      documentId: "doc-ligne-2",
      id: 72,
      designation: "Écran 24 pouces",
      espece: "Info",
      unite: "unité",
      quantite: 5,
      prixUnitaire: 120000,
      montant: 600000,
      nomenclature: "NOM-003",
      pieceJustificative: "",
      observation: "",
      etat: "defaillant",
      conforme: false,
      photos: [],
    },
  ];
}

let postSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  postSpy = vi.fn().mockResolvedValue({ data: { data: {}, meta: {} } });
  vi.spyOn(api, "post").mockImplementation(postSpy as never);
});

describe("Upload réel et persistant des photos de la réception", () => {
  it("1. la photo est envoyée à Strapi via /api/upload et rattachée à SA ligne", async () => {
    postSpy.mockResolvedValue({
      data: [{ id: 1, url: "/uploads/clavier.jpg" }],
    });

    const urls = await uploadPhotosLigne(71, [PHOTO_1]);

    // La cible exacte du champ media de la ligne visée.
    expect(postSpy).toHaveBeenCalledTimes(1);
    const [chemin, forme, options] = postSpy.mock.calls[0];
    expect(chemin).toBe("/api/upload");
    expect(forme).toBeInstanceOf(FormData);
    expect(forme.get("ref")).toBe(LIGNE_ENTREE_UID);
    // `refId` = id NUMÉRIQUE de la ligne : le plugin upload rattache le
    // fichier via files_related_mph.related_id, comparé à la clé primaire.
    // Un documentId y serait stocké sans jamais être relu (populate vide).
    expect(forme.get("refId")).toBe("71");
    expect(forme.get("field")).toBe("photos");
    const fichiers = forme.getAll("files");
    expect(fichiers).toHaveLength(1);
    expect((fichiers[0] as File).type).toBe("image/jpeg");
    // multipart : axios doit poser lui-même la boundary.
    expect(options?.headers?.["Content-Type"]).toBeUndefined();
    expect(urls).toEqual(["/uploads/clavier.jpg"]);
  });

  it("2. après rechargement, la photo persistée est toujours affichée", () => {
    const lignes = lignesServeur();
    lignes[0].photos = ["http://localhost:1337/uploads/clavier.jpg"];

    // 1) L'hydratation de l'écran reprend les URL SERVEUR (pas les Data URLs).
    const { data } = receptionDepuisEntree({
      id: "doc-entree-1",
      reference: "ENT-2026-004",
      dateEntree: "2026-10-01",
      lignes,
    } as unknown as EntreeRecord);

    const controleLigne1 = data.controles.find((c) => c.articleId === "ligne-1")!;
    expect(controleLigne1.photos).toEqual([
      "http://localhost:1337/uploads/clavier.jpg",
    ]);

    // 2) Le détail d'une entrée traitée affiche ces photos.
    render(
      <DetailEntreeTraitee
        entree={
          {
            id: "doc-entree-1",
            reference: "ENT-2026-004",
            dateEntree: "2026-10-01",
            fournisseur: "Société Ravit SARL",
            statut: "Validée",
            documents: [],
            lignes,
          } as unknown as EntreeRecord
        }
        onRetour={() => {}}
      />
    );

    // La photo est dans la LIGNE de son article du tableau « Articles traités ».
    const img = screen.getByAltText("Clavier AZERTY — photo 1");
    expect(img.getAttribute("src")).toBe(
      "http://localhost:1337/uploads/clavier.jpg"
    );
    const ligneClavier = screen.getByText("Clavier AZERTY").closest("tr")!;
    expect(ligneClavier.contains(img)).toBe(true);
    // Ligne sans photo : pas d'image, un tiret.
    const ligneEcran = screen.getByText("Écran 24 pouces").closest("tr")!;
    expect(within(ligneEcran).queryByRole("img")).toBeNull();
    // L'ancien bloc séparé sous le tableau a disparu (source unique).
    expect(screen.queryByText(/Photos jointes au contrôle/i)).toBeNull();
  });

  it("3. la signature reste valide si l'envoi des photos échoue, avec réessai possible", async () => {
    // Réseau coupé juste après la signature : l'upload échoue.
    const upload = vi.fn().mockRejectedValue(new Error("Network Error"));

    const resultat = await envoyerPhotosApresSignature(
      [{ numero_ordre: 1, photos: [PHOTO_1] }],
      lignesServeur(),
      upload
    );

    // L'erreur est collectée, jamais propagée : la signature (déjà actée) tient.
    expect(resultat.envoyees).toBe(0);
    expect(resultat.echecs).toHaveLength(1);
    expect(resultat.echecs[0].designation).toBe("Clavier AZERTY");
    expect(resultat.echecs[0].raison).toBe("Network Error");
    // Les Data URLs sont conservées : le réessai n'a besoin que d'elles.
    expect(resultat.echecs[0].dataUrls).toEqual([PHOTO_1]);

    // Réessai : photos SEULES, aucun nouvel appel de signature.
    postSpy.mockResolvedValue({ data: [{ id: 2, url: "/uploads/clavier.jpg" }] });
    const uploadOk = vi.fn().mockResolvedValue(["/uploads/clavier.jpg"]);
    const reessai = await envoyerPhotosApresSignature(
      [{ numero_ordre: 1, photos: resultat.echecs[0].dataUrls }],
      lignesServeur(),
      uploadOk
    );
    expect(reessai.echecs).toHaveLength(0);
    expect(reessai.envoyees).toBe(1);
    expect(uploadOk).toHaveBeenCalledWith("71", [PHOTO_1]);
  });

  it("4. plusieurs photos et plusieurs articles vont à la bonne ligne, sans mélange", async () => {
    // Le serveur renvoie une URL par fichier reçu.
    const upload = vi
      .fn()
      .mockImplementation(async (_id: string, dataUrls: string[]) =>
        dataUrls.map((_, i) => `/uploads/l${i}.jpg`)
      );
    const resultat = await envoyerPhotosApresSignature(
      [
        { numero_ordre: 1, photos: [PHOTO_1, PHOTO_2] },
        { numero_ordre: 2, photos: [PHOTO_1] },
      ],
      lignesServeur(),
      upload
    );

    expect(resultat.echecs).toHaveLength(0);
    expect(upload).toHaveBeenCalledTimes(2);
    // 2 photos → ligne 1, 1 photo → ligne 2 : jamais de mélange.
    expect(upload.mock.calls[0]).toEqual(["71", [PHOTO_1, PHOTO_2]]);
    expect(upload.mock.calls[1]).toEqual(["72", [PHOTO_1]]);
    expect(resultat.envoyees).toBe(3);
  });

  it("5. une entrée sans photo ne déclenche aucun envoi et ne produit aucune erreur", async () => {
    const upload = vi.fn();
    const resultat = await envoyerPhotosApresSignature(
      [
        { numero_ordre: 1, photos: [] },
        { numero_ordre: 2 },
        { numero_ordre: 3, photos: [] },
      ],
      lignesServeur(),
      upload as never
    );

    expect(upload).not.toHaveBeenCalled();
    expect(resultat).toEqual({ envoyees: 0, echecs: [] });
    // Aucun message d'erreur : la signature se pose normalement.
    expect(resultat.echecs).toHaveLength(0);
  });

  it("6. repli sur le documentId quand l'id numérique est absent", async () => {
    const lignes = lignesServeur().map((l) => ({ ...l, id: undefined }));
    const upload = vi.fn().mockResolvedValue(["/uploads/clavier.jpg"]);

    await envoyerPhotosApresSignature(
      [{ numero_ordre: 2, photos: [PHOTO_1] }],
      lignes,
      upload
    );

    expect(upload).toHaveBeenCalledWith("doc-ligne-2", [PHOTO_1]);
  });

  it("7. non-régression : le contrat de signature reste inchangé (étapes 1, 3, 4)", async () => {
    await signerEntree("doc-entree-1", "chef_service_1", [
      { numero_ordre: 1, etat: "neuf" as never, conforme: true },
    ]);

    const [chemin, corps] = postSpy.mock.calls[0];
    expect(chemin).toBe("/api/entrees/doc-entree-1/sign");
    expect(corps).toEqual({
      data: {
        role: "chef_service_1",
        controles: [{ numero_ordre: 1, etat: "neuf", conforme: true }],
      },
    });
    // Aucun fichier n'est joint à la signature : les photos partent à part,
    // après coup, via /api/upload.
    expect(String(chemin)).not.toContain("upload");

    // Conversion Data URL → File : le binaire est décodé tel quel.
    const fichier = dataUrlVersFile(PHOTO_1, "photo.jpg")!;
    expect(fichier.name).toBe("photo.jpg");
    expect(fichier.type).toBe("image/jpeg");
    expect(fichier.size).toBeGreaterThan(0);
    expect(dataUrlVersFile("pas-une-data-url", "x.jpg")).toBeNull();
  });
});