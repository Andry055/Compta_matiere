// @vitest-environment jsdom
//
// SESSION STRAPI ABSENTE — la requête Content API ne doit PAS partir.
//
// Contexte : en mode DÉMONSTRATION local (LoginScreen, repli hors ligne),
// l'interface n'a AUCUN jeton. Chaque lecture (/api/sorties, /api/entrees,
// /api/entree-lignes) partait alors sans credential et le serveur répondait
// 403 — un flot de 403 dans la console qui fait croire à une panne alors
// que le serveur répond parfaitement.
//
// Preuves (comportement, pas de recherche de texte) :
//   H1  sans jeton, la requête n'atteint JAMAIS le réseau ;
//   H2  l'échec est classifié « session absente », pas « accès refusé » ;
//   H3  avec jeton, la requête part ET porte l'en-tête Authorization ;
//   H4  la CONNEXION (POST /api/auth/local) part même sans jeton.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  classerEchecApi,
  ErreurSessionAbsente,
  fetchEntreesDetail,
} from "./api";

/** L'ADAPTER est la dernière étape avant le réseau : on l'observe pour
 *  prouver qu'aucune requête n'est émise (ou qu'elle l'est). */
let adapter: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  adapter = vi.fn(async (config: any) => ({
    data: { data: [] },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  }));
  api.defaults.adapter = adapter as any;
});

afterEach(() => {
  api.defaults.adapter = undefined as any;
  vi.restoreAllMocks();
});

describe("api — session Strapi absente", () => {
  it("H1 : sans jeton, la requête n'atteint jamais le réseau", async () => {
    await expect(api.get("/api/sorties")).rejects.toThrow(ErreurSessionAbsente);
    // AUCUNE requête émise : l'adaptateur (dernier pas avant le réseau)
    // n'a pas été appelé — donc pas de 403 à l'écran.
    expect(adapter).not.toHaveBeenCalled();
  });

  it("H1 bis : idem pour les autres familles de routes lues en direct", async () => {
    for (const url of ["/api/entrees", "/api/entree-lignes", "/api/sorties"]) {
      await expect(api.get(url)).rejects.toThrow(ErreurSessionAbsente);
    }
    expect(adapter).not.toHaveBeenCalled();
  });

  it("H2 : l'échec est classifié « session absente », pas « accès refusé »", async () => {
    let echec: unknown = null;
    try {
      await api.get("/api/sorties");
    } catch (e) {
      echec = e;
    }
    expect(echec).toBeInstanceOf(ErreurSessionAbsente);
    expect(classerEchecApi(echec)).toBe("session_absente");
    // Une session absente n'est PAS un droit manquant : la distinction
    // affiché à l'utilisateur (« vous n'avez pas le droit ») serait fausse.
    expect(classerEchecApi(echec)).not.toBe("acces_refuse");
  });

  it("H2 bis : la lecture des entrées renvoie « session_absente »", async () => {
    const resultat = await fetchEntreesDetail();
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.echec).toBe("session_absente");
  });

  it("H3 : avec jeton, la requête part ET porte l'en-tête Authorization", async () => {
    localStorage.setItem("strapi_jwt", "jeton-de-test");
    await api.get("/api/sorties");
    expect(adapter).toHaveBeenCalledTimes(1);
    const config = adapter.mock.calls[0][0];
    expect(config.headers.get("Authorization")).toBe("Bearer jeton-de-test");
  });

  it("H4 : la connexion part même sans jeton", async () => {
    await api.post("/api/auth/local", { identifier: "x", password: "y" });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].url).toContain("/api/auth/local");
  });
});
