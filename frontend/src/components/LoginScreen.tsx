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
import { AppRole } from "../types/roles";
import { strapiLogin, StrapiAuthUser } from "../lib/api";

interface LoginScreenProps {
  onLogin: (user: UserType) => void;
}

// Mock user database with credentials - 5 rôles réglementaires MTEFoP
const mockUserDatabase: Array<UserType & { password: string }> = [
  {
    id: "admin-1",
    name: "Marie RAKOTO",
    email: "m.rakoto@ministere.gov.mg",
    password: "admin123",
    role: "admin",
    department: "Administration Centrale",
    permissions: ["all"],
  },
  {
    id: "depositaire-1",
    name: "Rakotomalala Hery",
    email: "hery.rakoto@mtefop.gov.mg",
    password: "depositaire123",
    role: "depositaire",
    department: "DAF - Service Comptabilité Matière",
    permissions: ["equipment.view", "equipment.edit", "equipment.delete", "equipment.create"],
  },
  {
    id: "magasinier-1",
    name: "Andriamampianina Fara",
    email: "fara.andriam@mtefop.gov.mg",
    password: "magasinier123",
    role: "magasinier",
    department: "DAF - Magasin & Entrepôt",
    permissions: ["equipment.view"],
  },
  {
    id: "logistique-1",
    name: "Razafindrakoto Tojo",
    email: "tojo.razaf@mtefop.gov.mg",
    password: "logistique123",
    role: "logistique",
    department: "DAF - Direction Logistique",
    permissions: ["equipment.view"],
  },
  {
    id: "comptable-1",
    name: "Ravaomanana Nirina",
    email: "nirina.ravao@mtefop.gov.mg",
    password: "comptable123",
    role: "comptable",
    department: "DAF - Service Budget",
    permissions: ["equipment.view"],
  },
  {
    id: "demandeur-service-1",
    name: "Randriamampionona Tolotra",
    email: "tolotra.randria@mtefop.gov.mg",
    password: "demandeur123",
    role: "demandeur",
    department: "DRH - Service du Personnel",
    permissions: ["equipment.view"],
    demandeurLevel: "service",
  },
  {
    id: "demandeur-direction-1",
    name: "Rakotoson Jean",
    email: "jean.rakoto@mtefop.gov.mg",
    password: "direction123",
    role: "demandeur",
    department: "Direction du Travail (DT)",
    permissions: ["equipment.view"],
    demandeurLevel: "direction",
  },
];

// Rôles métier reconnus par l'application (rôle Strapi -> rôle applicatif)
const KNOWN_APP_ROLES: AppRole[] = [
  "depositaire",
  "magasinier",
  "logistique",
  "comptable",
  "demandeur",
];

/** Transforme un utilisateur Strapi (JWT) en profil applicatif */
function mapStrapiUser(user: StrapiAuthUser): UserType | null {
  const role = (user.role?.type || user.role?.code || "").toLowerCase();
  const isKnown =
    role === "admin" ||
    (KNOWN_APP_ROLES as string[]).includes(role);
  if (!isKnown) return null;

  return {
    id: user.documentId || String(user.id),
    name: user.username,
    email: user.email,
    role: role as UserType["role"],
    department: user.department || "",
    permissions: ["equipment.view"],
    ...(role === "demandeur" ? { demandeurLevel: "service" as const } : {}),
  };
}

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
    if (strapiAuth) {
      const mapped = mapStrapiUser(strapiAuth.user);
      if (mapped) {
        applyRememberMe();
        setIsLoading(false);
        onLogin(mapped);
        return;
      }
      // Rôle inconnu : on retombe sur les comptes de démonstration locaux
    }

    // -----------------------------------------------------------------------
    // 2) Repli hors ligne : comptes de démonstration de l'application
    // -----------------------------------------------------------------------
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Find user in mock database
    const user = mockUserDatabase.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (user) {
      // Remove password from user object before passing to parent
      const { password: _, ...userWithoutPassword } = user;
      onLogin(userWithoutPassword);

      // Store remember me preference
      applyRememberMe();
    } else {
      setError("Email ou mot de passe incorrect");
    }

    setIsLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <Package className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl text-foreground mb-2">ComptaMatière</h1>
          <p className="text-muted-foreground text-sm">
            Système de Gestion d'Équipements
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-card border border-border rounded-lg shadow-lg p-6">
          <div className="mb-6">
            <h2 className="text-lg text-card-foreground mb-2">Connexion</h2>
            <p className="text-sm text-muted-foreground">
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
              <label
                htmlFor="email"
                className="block text-sm text-card-foreground mb-2"
              >
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre.email@entreprise.com"
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-ring transition-colors text-sm"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm text-card-foreground mb-2"
              >
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
                  className="w-full px-3 py-2 pr-10 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-ring transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
            <div className="flex items-center justify-between">
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
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                isLoading
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
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
              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <h4 className="text-sm text-card-foreground mb-3">
                  Comptes de test disponibles :
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
                      className="text-left p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
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
                      className="text-left p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
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
                      className="text-left p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
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
                      className="text-left p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
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
                      className="text-left p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
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
                      className="text-left p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
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
        <div className="text-center mt-6">
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
