import React, { useState } from "react";
import {
  Package,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { User as UserType } from "../App";
import { strapiLogin, fetchSessionRole, setStrapiSession } from "../lib/api";
import type { StrapiLoginResult } from "../lib/api";
import { mapStrapiUser } from "../lib/session";

interface LoginScreenProps {
  onLogin: (user: UserType) => void;
}

// NB : les rôles métier reconnus et la transformation Strapi -> profil
// applicatif vivent dans ../lib/session (partagés avec App.tsx, qui les
// applique aussi à la reprise de session).

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDemoCredentials, setShowDemoCredentials] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const applyRememberMe = () => {
      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("savedEmail", email);
      } else {
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("savedEmail");
      }
    };

    // -----------------------------------------------------------------------
    // 1) API Strapi (JWT) : la vraie persistance côté serveur
    // -----------------------------------------------------------------------
    const strapiAuth = await strapiLogin(email, password);

    // Cas 1 : authentification Strapi réussie (JWT reçu).
    if (strapiAuth.ok) {
      // La réponse de /api/auth/local ne contient PAS `role` (le sanitizer
      // Content API retire la relation vers users-permissions.user) : on va
      // le chercher sur /api/session/role, qui lit le rôle réel du jeton.
      // SANS cette étape, le rôle restait indéfini et l'écran basculait sur
      // les comptes de démonstration — affichant parfois « Magasinier » alors
      // que le jeton appartenait à un autre compte, signature refusée en 403.
      const user = await fetchSessionRole();
      // On remplace l'utilisateur stocké (sans rôle) par celui, complet, renvoyé
      // par /api/session/role : la reprise de session repartira de la même donnée.
      if (user) setStrapiSession(strapiAuth.jwt, user);
      const mapped = mapStrapiUser(user ?? strapiAuth.user);
      if (mapped) {
        applyRememberMe();
        setIsLoading(false);
        onLogin(mapped);
        return;
      }
      // Rôle inconnu ou session/role inaccessible : l'utilisateur est bien
      // authentifié chez Strapi mais son rôle n'est pas reconnu. On ne bascule
      // PAS en mode démo : cela masquerait un problème de configuration.
      setError(
        "Authentification Strapi réussie, mais le rôle utilisateur est indisponible."
      );
      setIsLoading(false);
      return;
    }

    // Cas 2 : Strapi a rejeté les identifiants (403 ou 401).
    // On ne bascule PAS en mode démo : cela masquerait l'échec réel.
    if (!strapiAuth.ok && strapiAuth.code === 'auth_echec') {
      setError(
        strapiAuth.status === 403
          ? "Authentification refusée : compte bloqué ou non confirmé."
          : "Identifiants refusés par le serveur."
      );
      setIsLoading(false);
      return;
    }

    // Cas 3 : erreur réseau — Strapi injoignable. Aucun repli vers des comptes
    // fictifs : on affiche une erreur claire et on reste sur l'écran de
    // connexion. L'authentification ne peut avoir lieu que via le vrai backend.
    setError(
      "Serveur indisponible : vérifiez votre connexion ou réessayez plus tard."
    );
    setIsLoading(false);
    return;
  };

  // Load saved email if remember me was checked
  useState(() => {
    const savedEmail = localStorage.getItem("savedEmail");
    const rememberMeValue = localStorage.getItem("rememberMe");
    if (savedEmail && rememberMeValue === "true") {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  });

  const fillDemoCredentials = (userEmail: string, userPassword: string) => {
    setEmail(userEmail);
    setPassword(userPassword);
    setError("");
  };

  return (
    <div className="cm-shell min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8 cm-rise">
          <div className="cm-brand-mark w-16 h-16 mx-auto mb-5 rounded-2xl">
            <Package className="h-7 w-7" />
          </div>
          <p className="cm-eyebrow cm-eyebrow-accent mb-2">Ministère · Gestion Centralisée</p>
          <h1 className="cm-title text-3xl sm:text-4xl mb-2">ComptaMatière</h1>
          <p className="cm-subtitle">
            Système de Gestion d'Équipements
          </p>
        </div>

        {/* Login Form */}
        <div className="cm-panel cm-panel-solid rounded-xl p-6 sm:p-7 cm-rise" style={{ ["--cm-i" as string]: 1 }}>
          <div className="mb-6">
            <h2 className="cm-title text-lg mb-1.5">Connexion</h2>
            <p className="cm-subtitle">
              Accédez à votre espace personnel
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="cm-label">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre.email@entreprise.com"
                required
                className="cm-field w-full px-3 py-2.5 rounded-lg text-sm"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="cm-label">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="cm-field w-full px-3 py-2.5 pr-10 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-border focus:ring-2 focus:ring-ring"
                />
                <span className="text-sm text-card-foreground">
                  Se souvenir de moi
                </span>
              </label>
              <button
                type="button"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isLoading
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "cm-btn-primary"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Se connecter
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6">
            <button
              onClick={() => setShowDemoCredentials(!showDemoCredentials)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDemoCredentials ? "Masquer" : "Afficher"} les comptes
            </button>

            {showDemoCredentials && (
              <div className="cm-panel-flat mt-4 p-4 cm-fade">
                <h4 className="cm-eyebrow mb-3">
                  Comptes pré-configurés (validés par le backend Strapi)
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="grid gap-2">
                    <button
                      onClick={() =>
                        fillDemoCredentials(
                          "m.rakoto@ministere.gov.mg",
                          "admin123"
                        )
                      }
                      className="text-left p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 transition-colors hover:bg-red-500/20"
                    >
                      <div className="text-red-700 dark:text-red-300">
                        👑 <strong>Marie RAKOTO</strong> - Administrateur
                        Système
                      </div>
                      <div className="text-red-600 dark:text-red-400">
                        m.rakoto@ministere.gov.mg / admin123
                      </div>
                    </button>

                    <button
                      onClick={() =>
                        fillDemoCredentials(
                          "hery.rakoto@mtefop.gov.mg",
                          "depositaire123"
                        )
                      }
                      className="text-left p-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 transition-colors hover:bg-blue-500/20"
                    >
                      <div className="text-blue-700 dark:text-blue-300">
                        👤 <strong>Rakotomalala Hery</strong> - Dépositaire
                        par service
                      </div>
                      <div className="text-blue-600 dark:text-blue-400">
                        hery.rakoto@mtefop.gov.mg / depositaire123
                      </div>
                    </button>

                    <button
                      onClick={() =>
                        fillDemoCredentials(
                          "fara.andriam@mtefop.gov.mg",
                          "magasinier123"
                        )
                      }
                      className="text-left p-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 transition-colors hover:bg-blue-500/20"
                    >
                      <div className="text-blue-700 dark:text-blue-300">
                        👤 <strong>Andriamampianina Fara</strong> -
                        Magasinier
                      </div>
                      <div className="text-blue-600 dark:text-blue-400">
                        fara.andriam@mtefop.gov.mg / magasinier123
                      </div>
                    </button>

                    <button
                      onClick={() =>
                        fillDemoCredentials(
                          "tojo.razaf@mtefop.gov.mg",
                          "logistique123"
                        )
                      }
                      className="text-left p-2.5 rounded-lg border border-green-500/30 bg-green-500/10 transition-colors hover:bg-green-500/20"
                    >
                      <div className="text-green-700 dark:text-green-300">
                        📦 <strong>Razafindrakoto Tojo</strong> - Chef
                        logistique
                      </div>
                      <div className="text-green-600 dark:text-green-400">
                        tojo.razaf@mtefop.gov.mg / logistique123
                      </div>
                    </button>

                    <button
                      onClick={() =>
                        fillDemoCredentials(
                          "nirina.ravao@mtefop.gov.mg",
                          "comptable123"
                        )
                      }
                      className="text-left p-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 transition-colors hover:bg-purple-500/20"
                    >
                      <div className="text-purple-700 dark:text-purple-300">
                        👥 <strong>Ravaomanana Nirina</strong> - Comptable
                      </div>
                      <div className="text-purple-600 dark:text-purple-400">
                        nirina.ravao@mtefop.gov.mg / comptable123
                      </div>
                    </button>

                    <button
                      onClick={() =>
                        fillDemoCredentials(
                          "tolotra.randria@mtefop.gov.mg",
                          "demandeur123"
                        )
                      }
                      className="text-left p-2.5 rounded-lg border border-orange-500/30 bg-orange-500/10 transition-colors hover:bg-orange-500/20"
                    >
                      <div className="text-orange-700 dark:text-orange-300">
                        💻 <strong>Randriamampionona Tolotra</strong> -
                        Demandeur (Service)
                      </div>
                      <div className="text-orange-600 dark:text-orange-400">
                        tolotra.randria@mtefop.gov.mg / demandeur123
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 cm-rise" style={{ ["--cm-i" as string]: 2 }}>
          <p className="text-xs text-muted-foreground">
            © 2025 ComptaMatière - Gestion Centralisée d'Équipements
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Version 1.0.0 - Sécurisé et Confidentiel
          </p>
        </div>
      </div>
    </div>
  );
}
