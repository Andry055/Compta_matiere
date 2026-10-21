// @vitest-environment jsdom
//
// (7) et (8) PANNEAU DE REMISE — payload, confirmation, envoi unique, résultat
// incertain, date par défaut, et absence de mise à jour du stock.
//
// Preuves :
//   S1 le payload porte QUATRE champs (mandataire compris) — jamais un statut,
//      jamais le stock ;
//   S2 la case « Le matériel remis correspond à la liste » est obligatoire ;
//   S3 la confirmation « La remise ne peut pas être annulée dans l'application »
//      est obligatoire : rien n'est envoyé avant « Confirmer la remise » ;
//   S4 un double-clic n'envoie QU'UN SEUL enregistrement ;
//   S5 un résultat INCERTAIN (délai dépassé / coupure) ne dit jamais « échec » :
//      on recharge l'ordre et on conclut sur son état RÉEL (remise faite →
//      succès ; remise non faite → échec confirmé ; état illisible → inconnu) ;
//   S6 la date de remise par défaut est la date LOCALE (jamais UTC) ;
//   S7 aucune mise à jour du stock n'est déclenchée par la remise ;
//   S8 le détenteur est proposé quand le référentiel le permet, et les
//      champs restent modifiables dans tous les cas.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RemiseOrdreSortie } from "./RemiseOrdreSortie";
import type { SortieRecord } from "@/lib/movements";

const etat = vi.hoisted(() => ({
  remettre: vi.fn(),
  recharger: vi.fn(),
  signer: vi.fn(),
  rejeter: vi.fn(),
  services: [] as any[],
  directions: [] as any[],
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    remettreSortie: etat.remettre,
    rechargerSortie: etat.recharger,
    // signerSortie est l'appel qui DÉBITE le stock : il ne doit jamais être
    // appelé par une remise.
    signerSortie: etat.signer,
    rejeterSortie: etat.rejeter,
    fetchServices: vi.fn(async () => etat.services),
    fetchDirections: vi.fn(async () => etat.directions),
    fetchAllSortiesOrThrow: vi.fn(async () => []),
  };
});

vi.mock("@/lib/bonSortieDocument", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bonSortieDocument")>();
  return { ...actual, genererPdfBonSortie: vi.fn(async () => undefined) };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function sortieValidee(overrides: Record<string, unknown> = {}): SortieRecord {
  return {
    id: "sortie-1",
    reference: "SOR-2026-001",
    dateSortie: "2026-10-18",
    materiel: "Tapis rouge",
    categorie: "—",
    quantite: 3,
    serviceDemandeur: "Service Informatique",
    direction: "Direction Informatique",
    beneficiaire: "Ex",
    responsable: "—",
    statut: "Validée",
    magasinier_signed: true,
    depositaire_signed: true,
    logistique_signed: true,
    justificatif: "BL-2026-42",
    documents: [],
    lignes: [
      {
        documentId: "l1",
        designation: "Tapis rouge",
        quantite: 2,
        etat: "bon",
        numeroLogistique: "NL-001",
        materiel: { documentId: "mat-1", designation: "Tapis rouge", nomenclature: "NOM-1" },
      },
    ],
    ...overrides,
  } as unknown as SortieRecord;
}

function sortieRemisee(overrides: Record<string, unknown> = {}): SortieRecord {
  return sortieValidee({
    statut: "Sortie effectuée",
    detenteurNom: "RAKOTOMALALA Hery",
    detenteurFonction: "Dépositaire",
    dateRemise: "2026-10-20",
    ...overrides,
  });
}

/** Remplit la saisie minimale et coche la case du matériel. */
function saisirDetenteur(nom = "RAKOTOMALALA Hery") {
  fireEvent.change(screen.getByLabelText(/Nom du détenteur/), {
    target: { value: nom },
  });
  fireEvent.change(screen.getByLabelText(/Fonction du détenteur/), {
    target: { value: "Dépositaire" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

function monter(sortie = sortieValidee(), props: Record<string, unknown> = {}) {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  const vue = render(
    <RemiseOrdreSortie
      sortie={sortie}
      onSuccess={onSuccess}
      onError={onError}
      rechargerSortie={etat.recharger}
      {...props}
    />
  );
  return { ...vue, onSuccess, onError };
}

beforeEach(() => {
  etat.services = [];
  etat.directions = [];
  etat.remettre.mockReset();
  etat.recharger.mockReset();
  etat.signer.mockReset();
  etat.rejeter.mockReset();
  etat.remettre.mockResolvedValue(sortieRemisee());
  etat.recharger.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("(7) panneau de remise — payload, confirmation et envoi unique", () => {
  it("S1 : le payload porte quatre champs, jamais un statut ni le stock", async () => {
    monter();

    saisirDetenteur();
    fireEvent.change(screen.getByLabelText(/mandataire/i), {
      target: { value: "RASOANAIVO Naina" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer la remise/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmer la remise/ }));
    });

    expect(etat.remettre).toHaveBeenCalledTimes(1);
    const [documentId, payload] = etat.remettre.mock.calls[0];
    expect(documentId).toBe("sortie-1");
    expect(Object.keys(payload).sort()).toEqual([
      "date_remise",
      "detenteur_fonction",
      "detenteur_nom",
      "mandataire_nom",
    ]);
    expect(payload.detenteur_nom).toBe("RAKOTOMALALA Hery");
    expect(payload.detenteur_fonction).toBe("Dépositaire");
    expect(payload.mandataire_nom).toBe("RASOANAIVO Naina");
    expect("statut" in payload).toBe(false);
    expect("stock" in payload).toBe(false);
  });

  it("S1 bis : sans mandataire, le champ n'est pas envoyé", async () => {
    monter();

    saisirDetenteur();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer la remise/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmer la remise/ }));
    });

    const [, payload] = etat.remettre.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual([
      "date_remise",
      "detenteur_fonction",
      "detenteur_nom",
    ]);
    expect("mandataire_nom" in payload).toBe(false);
  });

  it("S2 : sans la case « le matériel remis correspond à la liste », rien n'est envoyé", async () => {
    monter();

    fireEvent.change(screen.getByLabelText(/Nom du détenteur/), {
      target: { value: "RAKOTOMALALA Hery" },
    });
    fireEvent.change(screen.getByLabelText(/Fonction du détenteur/), {
      target: { value: "Dépositaire" },
    });

    const enregistrer = screen.getByRole("button", {
      name: /Enregistrer la remise/,
    }) as HTMLButtonElement;
    expect(enregistrer.disabled, "case du matériel non cochée").toBe(true);

    // Même en forçant le clic : aucune requête.
    fireEvent.click(enregistrer);
    expect(etat.remettre).not.toHaveBeenCalled();
  });

  it("S3 : la confirmation est obligatoire — « Enregistrer » seul n'envoie rien", async () => {
    monter();

    saisirDetenteur();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer la remise/ }));

    expect(
      screen.getByText("La remise ne peut pas être annulée dans l'application")
    ).toBeTruthy();
    expect(etat.remettre, "rien n'est envoyé avant la confirmation").not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmer la remise/ }));
    });
    expect(etat.remettre).toHaveBeenCalledTimes(1);
  });

  it("S4 : un double-clic n'envoie qu'UN SEUL enregistrement", async () => {
    monter();

    saisirDetenteur();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer la remise/ }));

    const confirmer = screen.getByRole("button", { name: /Confirmer la remise/ });
    await act(async () => {
      fireEvent.click(confirmer);
      fireEvent.click(confirmer);
    });

    expect(etat.remettre).toHaveBeenCalledTimes(1);
  });
});

describe("(7) panneau de remise — résultat incertain et date par défaut", () => {
  /** Erreur réseau : aucune réponse du serveur. */
  const erreurReseau = Object.assign(new Error("Network Error"), {});

  it("S5 : résultat incertain + ordre rechargé déjà remis → on confirme la remise", async () => {
    etat.remettre.mockRejectedValue(erreurReseau);
    etat.recharger.mockResolvedValue(sortieRemisee());
    const { onSuccess, onError } = monter();

    saisirDetenteur();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer la remise/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmer la remise/ }));
    });

    // L'ordre a été RELU, et son état réel dit « remise effectuée ».
    expect(etat.recharger).toHaveBeenCalledWith("sortie-1");
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(screen.getByText("Remise enregistrée")).toBeTruthy();
    // Jamais de message d'échec.
    expect(screen.queryByText(/échec/i)).toBeNull();
    // Aucune relance automatique de l'envoi.
    expect(etat.remettre).toHaveBeenCalledTimes(1);
  });

  it("S5 bis : résultat incertain + ordre rechargé TOUJOURS en attente → échec CONFIRMÉ, saisie conservée", async () => {
    etat.remettre.mockRejectedValue(erreurReseau);
    etat.recharger.mockResolvedValue(sortieValidee());
    const { onSuccess, onError } = monter();

    saisirDetenteur("RAKOTOMALALA Hery");
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer la remise/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmer la remise/ }));
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(/n'a pas été enregistrée/i);
    // La saisie est conservée.
    expect((screen.getByLabelText(/Nom du détenteur/) as HTMLInputElement).value).toBe(
      "RAKOTOMALALA Hery"
    );
    expect(etat.remettre, "aucune relance automatique").toHaveBeenCalledTimes(1);
  });

  it("S5 ter : résultat incertain ET relecture impossible → état INCONNU, jamais « échec »", async () => {
    etat.remettre.mockRejectedValue(erreurReseau);
    etat.recharger.mockRejectedValue(new Error("serveur injoignable"));
    const { onSuccess, onError } = monter();

    saisirDetenteur();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer la remise/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmer la remise/ }));
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(/statut inconnu/i);
    expect(screen.queryByText(/échec/i)).toBeNull();
  });

  it("S6 : la date par défaut est la date LOCALE (jamais UTC)", async () => {
    // 20 octobre 23 h 30 UTC = 21 octobre 02 h 30 à Madagascar (UTC+3).
    vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-20T23:30:00Z"));

    monter();

    const champ = screen.getByLabelText(/Date de la remise/) as HTMLInputElement;
    expect(champ.value).toBe("2026-10-21");
    expect(champ.value, "le jour UTC ne doit pas être utilisé").not.toBe("2026-10-20");
  });

  it("S6 bis : la date de remise ne peut pas être postérieure à aujourd'hui", async () => {
    vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));

    monter();

    const champ = screen.getByLabelText(/Date de la remise/) as HTMLInputElement;
    expect(champ.max).toBe("2026-10-20");
  });
});

describe("(8) remise et stock — aucune mise à jour du stock", () => {
  it("S7 : la remise n'appelle NI la signature (débit du stock) NI le rejet", async () => {
    monter();

    saisirDetenteur();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer la remise/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmer la remise/ }));
    });

    expect(etat.remettre).toHaveBeenCalledTimes(1);
    expect(etat.signer, "aucun débit de stock").not.toHaveBeenCalled();
    expect(etat.rejeter, "aucun rejet").not.toHaveBeenCalled();
  });

  it("S7 bis : le stock n'est pas modifié par la remise (champ absent du payload)", async () => {
    monter();

    saisirDetenteur();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer la remise/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Confirmer la remise/ }));
    });

    const [, payload] = etat.remettre.mock.calls[0];
    for (const cle of Object.keys(payload)) {
      expect(
        ["detenteur_nom", "detenteur_fonction", "mandataire_nom", "date_remise"],
        `champ inattendu dans le payload : ${cle}`
      ).toContain(cle);
    }
  });
});

describe("(7) panneau de remise — détenteur proposé et saisie modifiable", () => {
  it("S8 : le détenteur du service destinataire est proposé, et reste modifiable", async () => {
    etat.services = [
      {
        documentId: "svc-1",
        nom: "Service Informatique",
        directionId: "dir-1",
        depositaire: "RAKOTOMALALA Hery",
      },
    ];
    etat.directions = [
      { documentId: "dir-1", nom: "Direction Informatique", directeur: "ANDRIANARISOA Hanta" },
    ];

    monter();
    await act(async () => {
      await Promise.resolve();
    });

    const nom = screen.getByLabelText(/Nom du détenteur/) as HTMLInputElement;
    const fonction = screen.getByLabelText(/Fonction du détenteur/) as HTMLInputElement;
    expect(nom.value).toBe("RAKOTOMALALA Hery");
    expect(fonction.value).toBe("Dépositaire");

    // Modifiable : la saisie de l'utilisateur prime.
    fireEvent.change(nom, { target: { value: "AUTRE PERSONNE" } });
    expect((screen.getByLabelText(/Nom du détenteur/) as HTMLInputElement).value).toBe(
      "AUTRE PERSONNE"
    );
  });

  it("S8 bis : sans donnée dans le référentiel, l'aide « Saisissez le détenteur » est affichée", async () => {
    monter();
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Saisissez le détenteur")).toBeTruthy();
    expect((screen.getByLabelText(/Nom du détenteur/) as HTMLInputElement).value).toBe("");
  });
});
