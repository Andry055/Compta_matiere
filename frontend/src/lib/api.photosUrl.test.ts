import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL, api, fetchEntreesDetail, urlMediaAffichable } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("Photos des lignes — URL réellement affichable", () => {
  it("convertit le chemin relatif renvoyé par Strapi en URL absolue", () => {
    expect(urlMediaAffichable("/uploads/ligne_96_1_abc.jpg")).toBe(
      `${API_URL}/uploads/ligne_96_1_abc.jpg`
    );
    // Sans barre initiale, Strapi reste tolérant : on normalise aussi.
    expect(urlMediaAffichable("uploads/x.jpg")).toBe(`${API_URL}/uploads/x.jpg`);
  });

  it("laisse intactes les URL absolues et les Data URLs de saisie", () => {
    expect(urlMediaAffichable("http://localhost:1337/uploads/a.jpg")).toBe(
      "http://localhost:1337/uploads/a.jpg"
    );
    expect(urlMediaAffichable("https://cdn.exemple.mg/a.jpg")).toBe(
      "https://cdn.exemple.mg/a.jpg"
    );
    const dataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    expect(urlMediaAffichable(dataUrl)).toBe(dataUrl);
    expect(urlMediaAffichable(null)).toBe("");
    expect(urlMediaAffichable(undefined)).toBe("");
  });

  it("l'hydratation d'écran sert la photo depuis l'API, pas depuis le front", async () => {
    // Charge utile réelle de Strapi : `url` est un CHEMIN RELATIF. Rendue tel
    // quel dans une page servie par Vite (autre port, aucun proxy), l'image
    // partait sur le front — qui répondait par la SPA (200 text/html) et
    // affichait une image cassée au chef logistique et au dépositaire.
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        data: [
          {
            id: 73,
            documentId: "doc-entree-18",
            reference: "ENT-2026-018",
            statut: "en_attente",
            lignes: [
              {
                id: 96,
                documentId: "doc-ligne-96",
                numero_ordre: 1,
                designation: "Casque RM",
                quantite: 1,
                photos: [{ url: "/uploads/ligne_96_1_abc.jpg" }],
              },
            ],
          },
        ],
      },
    } as never);

    const resultat = await fetchEntreesDetail();
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    const photos = resultat.entrees[0].lignes[0].photos ?? [];
    expect(photos).toEqual([`${API_URL}/uploads/ligne_96_1_abc.jpg`]);
    // L'URL pointe bien le backendStrapi (baseURL des appels API).
    expect(photos[0].startsWith(API_URL)).toBe(true);
  });
});