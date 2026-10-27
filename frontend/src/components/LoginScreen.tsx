import React, { useState } from "react";
import { Eye, EyeOff, LogIn, Loader2, Users, Sun, Moon } from "lucide-react";
import { User as UserType } from "../App";
import logoMtefop from "../../assets/LogoMETFOP.png";
import logo from "../../assets/logo.png";
import bgPhoto from "../../assets/METFOP.jpg";
import { strapiLogin, fetchSessionRole, setStrapiSession } from "../lib/api";
import { mapStrapiUser } from "../lib/session";

interface LoginScreenProps {
  onLogin: (user: UserType) => void;
}

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
    department: "DRH - Service Gestion Personnel",
    permissions: ["equipment.view"],
    demandeurLevel: "service",
  },
  {
    id: "demandeur-direction-1",
    name: "Rakotoson Jean",
    email: "jean.rakoto@mtefop.gov.mg",
    password: "direction123",
    role: "demandeur",
    department: "Direction Logistique",
    permissions: ["equipment.view"],
    demandeurLevel: "direction",
  },
];

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [bMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDemoCredentials, setShowDemoCredentials] = useState(false);

  // Thème : on applique immédiatement le choix enregistré (même clé « theme »
  // que le bouton du tableau de bord) pour que connexion et application
  // restent en cohérence. Défaut : mode clair si rien n'a encore été choisi.
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved === "dark" || (saved === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", dark);
    return dark;
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const applyRememberMe = () => {
      if (bMe) {
        localStorage.setItem("bMe", "true");
        localStorage.setItem("savedEmail", email);
      } else {
        localStorage.removeItem("bMe");
        localStorage.removeItem("savedEmail");
      }
    };

    const strapiAuth = await strapiLogin(email, password);

    if (strapiAuth.ok) {
      const user = await fetchSessionRole();
      if (user) setStrapiSession(strapiAuth.jwt, user);
      const mapped = mapStrapiUser(user ?? strapiAuth.user);
      if (mapped) {
        applyRememberMe();
        setIsLoading(false);
        onLogin(mapped);
        return;
      }
      setError("Authentification Strapi réussie, mais le rôle utilisateur est indisponible.");
      setIsLoading(false);
      return;
    }

    if (!strapiAuth.ok && strapiAuth.code === "auth_echec") {
      setError(
        strapiAuth.status === 403
          ? "Authentification refusée : compte bloqué ou non confirmé."
          : "Identifiants refusés par le serveur."
      );
      setIsLoading(false);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const user = mockUserDatabase.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      onLogin(userWithoutPassword);
      applyRememberMe();
    } else {
      setError("Email ou mot de passe incorrect");
    }

    setIsLoading(false);
  };

  useState(() => {
    const savedEmail = localStorage.getItem("savedEmail");
    const rememberMeValue = localStorage.getItem("bMe");
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
    <div className="lg-page">
      {/* Styles scoped — Tailwind du projet est figé : CSS maison garanti */}
      <style>{`
        .lg-page { position: relative; min-height: 100vh; background: #f3f8fd; overflow-x: hidden; }
        .lg-bg { position: fixed; top: 0; bottom: 0; height: 100vh; object-fit: cover; pointer-events: none; z-index: 0; }
        .lg-bg-left { left: 0; width: 45%; }
        .lg-bg-right { right: 0; width: 35%; opacity: 0.07; filter: blur(1px); }
        .lg-veil { position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background: linear-gradient(90deg, rgba(243,248,253,0) 0%, rgba(243,248,253,.85) 55%, #f3f8fd 100%); }
        .lg-curve { position: fixed; pointer-events: none; z-index: 0; }
        .lg-curve-tl { top: 0; left: 0; }
        .lg-curve-br { bottom: 0; right: 0; }
        .lg-dots { position: fixed; width: 130px; height: 76px; pointer-events: none; z-index: 0; opacity: .5;
          background-image: radial-gradient(circle, #7ec3f0 1.6px, transparent 1.7px);
          background-size: 22px 22px; }
        .lg-dots-tr { top: 26px; right: 34px; }
        .lg-dots-bl { bottom: 34px; left: 34px; }

        .lg-content { position: relative; z-index: 10; min-height: 100vh; display: flex;
          flex-direction: column; align-items: center; padding: 32px 16px; box-sizing: border-box; }

        /* En-tête logos */
        .lg-header { display: flex; align-items: center; justify-content: center; gap: 20px;
          flex-wrap: wrap; margin-bottom: 32px; }
        .lg-logo-m { height: 64px; width: auto; object-fit: contain; }
        .lg-sep { width: 1px; height: 48px; background: #c9d9ea; flex-shrink: 0; }
        .lg-brand { display: flex; align-items: center; gap: 12px; }
        .lg-brand-icon { height: 56px; width: 56px; border-radius: 12px; object-fit: contain;
          background: #0B2A4A; flex-shrink: 0; }
        .lg-brand-text { display: flex; flex-direction: column; align-items: flex-start; }
        .lg-brand-title { font-size: 32px; font-weight: 800; letter-spacing: -0.02em;
          line-height: 1; white-space: nowrap; color: #0B2A4A; margin: 0; }
        .lg-brand-title .lg-track { color: #1AA39A; }
        .lg-brand-sub { display: block; font-size: 13px; color: #4B5563; margin-top: 5px;
          white-space: nowrap; line-height: 1.4; }

        /* Carte */
        .lg-card { width: 100%; max-width: 560px; background: #fff; border-radius: 22px;
          border: 1px solid #dce9f5; box-shadow: 0 20px 50px rgba(20,60,110,.12);
          padding: 40px; box-sizing: border-box; }
        .lg-card-head { display: flex; align-items: center; gap: 16px; }
        .lg-avatar { width: 60px; height: 60px; border-radius: 50%; background: #eef3f9;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #0f3a6b; }
        /* l'h2 global non-calqué ajoute border-b pb-2 : on neutralise ici */
        .lg-title { font-size: 28px; font-weight: 700; color: #0f3a6b; line-height: 1.25;
          margin: 0; border: none; padding-bottom: 0; letter-spacing: normal; }
        .lg-sub { display: block; font-size: 14px; color: #5b6e87; line-height: 1.375; margin-top: 2px; }
        .lg-bar { height: 4px; width: 96px; border-radius: 4px; margin: 22px auto 34px;
          background: linear-gradient(90deg,#0b78d6,#2fe085); }

        /* Formulaire */
        .lg-form { display: flex; flex-direction: column; gap: 20px; }
        .lg-alert { display: flex; align-items: center; gap: 8px; padding: 12px;
          background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; }
        .lg-alert span { font-size: 14px; color: #b91c1c; }
        .lg-label { display: block; font-size: 14px; font-weight: 600; color: #0f3a6b; margin-bottom: 8px; }
        .lg-field { position: relative; }
        .lg-input { width: 100%; height: 52px; box-sizing: border-box; padding: 0 16px 0 48px;
          border-radius: 12px; border: 1.5px solid #c9d9ea; background: #f6f9fd;
          font-size: 15px; color: #34465f; font-family: inherit; outline: none;
          transition: border-color .2s, box-shadow .2s; }
        .lg-input::placeholder { color: #9aabc0; }
        .lg-input:focus { border-color: #1e88d8; box-shadow: 0 0 0 4px rgba(30,136,216,.15); }
        .lg-input-pw { padding-right: 48px; }
        .lg-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
          color: #0f3a6b; pointer-events: none; display: flex; }
        .lg-eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #5b6e87; padding: 6px;
          border-radius: 6px; display: flex; }
        .lg-eye:hover { color: #1e88d8; }
        .lg-options { display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap; }
        .lg-remember { display: flex; align-items: center; gap: 10px; cursor: pointer;
          user-select: none; }
        .lg-remember input { width: 18px; height: 18px; accent-color: #1273de; cursor: pointer; margin: 0; }
        .lg-remember span { font-size: 14px; color: #5b6e87; }
        .lg-forgot { font-size: 14px; font-weight: 500; color: #1273de; white-space: nowrap;
          text-decoration: none; }
        .lg-forgot:hover { color: #0e5db3; }

        /* Bouton */
        .lg-btn { width: 100%; height: 54px; margin-top: 4px; border: none; border-radius: 12px;
          font-size: 16px; font-weight: 600; color: #fff; font-family: inherit; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          background: linear-gradient(90deg,#0b78d6 0%,#12a58f 55%,#2fe085 100%);
          box-shadow: 0 8px 20px rgba(11,120,214,.3);
          transition: transform .2s, box-shadow .2s; }
        .lg-btn:hover:not(:disabled) { transform: translateY(-1px);
          box-shadow: 0 12px 28px rgba(11,120,214,.4); }
        .lg-btn:active:not(:disabled) { transform: translateY(0); }
        .lg-btn:disabled { background: #d1d5db; cursor: not-allowed; box-shadow: none; }
        .lg-demo { margin-top: 24px; text-align: center; font-size: 12px; color: #9aabc0; }
        .lg-demo-link { background: none; border: none; font-family: inherit; font-size: 13px;
          color: #1273de; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
        .lg-demo-link:hover { color: #0e5db3; text-decoration: underline; }
        .lg-accounts { margin-top: 12px; max-height: 232px; overflow-y: auto; display: flex;
          flex-direction: column; gap: 8px; text-align: left; }
        .lg-account { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px;
          border: 1px solid #e3ecf7; border-radius: 10px; background: #f8fbff; cursor: pointer;
          font-family: inherit; text-align: left; transition: border-color .15s, background .15s; }
        .lg-account:hover { border-color: #1e88d8; background: #eef6ff; }
        .lg-account-name { font-size: 13px; font-weight: 600; color: #0f3a6b; }
        .lg-account-dept { font-size: 11px; color: #5b6e87; }
        .lg-account-creds { font-size: 12px; color: #1273de;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

        /* Pied de page */
        .lg-footer { margin-top: 40px; display: flex; align-items: center; justify-content: center;
          gap: 12px; flex-wrap: wrap; font-size: 13px; color: #5b6e87; text-align: center; }
        .lg-footer-pin { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #1273de; }
        .lg-footer-line { width: 56px; height: 1px; background: rgba(30,136,216,.5); }
        .lg-footer-sep { width: 1px; height: 16px; background: #c9d9ea; }

        /* Bascule de thème clair / sombre */
        .lg-toggle { position: fixed; top: 20px; right: 20px; z-index: 40;
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,.9); border: 1px solid #c9d9ea;
          color: #0f3a6b; cursor: pointer;
          box-shadow: 0 6px 16px rgba(20,60,110,.15);
          transition: transform .2s, background .2s, border-color .2s, color .2s; }
        .lg-toggle:hover { transform: translateY(-1px); border-color: #1e88d8; color: #1e88d8; }
        .lg-toggle:focus-visible { outline: 2px solid #1e88d8; outline-offset: 2px; }

        /* ===== Mode sombre (jetons alignés sur la console « Nébuleuse ») ===== */
        .dark .lg-page { background: #0d1929; }
        .dark .lg-bg-left { filter: brightness(.5) saturate(.85); }
        .dark .lg-bg-right { filter: blur(1px) brightness(.5); }
        .dark .lg-veil { background: linear-gradient(90deg, rgba(13,25,41,0) 0%, rgba(13,25,41,.88) 55%, #0d1929 100%); }
        .dark .lg-dots { opacity: .3; }
        .dark .lg-sep { background: #2c4a6b; }
        .dark .lg-brand-title { color: #eef5fc; }
        .dark .lg-brand-sub { color: #9db3cc; }
        .dark .lg-card { background: #132239; border-color: #27405f;
          box-shadow: 0 20px 50px rgba(0,0,0,.45); }
        .dark .lg-avatar { background: #1b3453; color: #7fc4ff; }
        .dark .lg-title { color: #eef5fc; }
        .dark .lg-sub { color: #9db3cc; }
        .dark .lg-alert { background: #3a1418; border-color: #7f2a30; }
        .dark .lg-alert span { color: #ff9d9d; }
        .dark .lg-label { color: #dcebf9; }
        .dark .lg-input { background: #0e1b2e; border-color: #2c4a6b; color: #e8f1fb; }
        .dark .lg-input::placeholder { color: #5f7b99; }
        .dark .lg-icon { color: #7fc4ff; }
        .dark .lg-eye { color: #9db3cc; }
        .dark .lg-remember span { color: #b6c8dc; }
        .dark .lg-remember input { accent-color: #5aa9f0; }
        .dark .lg-forgot { color: #5aa9f0; }
        .dark .lg-btn:disabled { background: #2a3d55; color: #8fa3bd; }
        .dark .lg-demo { color: #7d93ad; }
        .dark .lg-demo-link { color: #5aa9f0; }
        .dark .lg-account { background: #0f1e33; border-color: #27405f; }
        .dark .lg-account:hover { background: #17304f; border-color: #5aa9f0; }
        .dark .lg-account-name { color: #eef5fc; }
        .dark .lg-account-dept { color: #9db3cc; }
        .dark .lg-account-creds { color: #5aa9f0; }
        .dark .lg-footer { color: #9db3cc; }
        .dark .lg-footer-pin { color: #5aa9f0; }
        .dark .lg-footer-line { background: rgba(90,169,240,.4); }
        .dark .lg-footer-sep { background: #2c4a6b; }
        .dark .lg-toggle { background: rgba(19,34,57,.9); border-color: #2c4a6b; color: #9fd4ff; }
        .dark .lg-toggle:hover { border-color: #5aa9f0; color: #5aa9f0; }

        /* Responsive */
        @media (max-width: 640px) {
          .lg-bg { display: none; }
          .lg-logo-m { height: 48px; }
          .lg-sep { height: 36px; }
          .lg-brand-icon { height: 44px; width: 44px; border-radius: 10px; }
          .lg-brand-title { font-size: 24px; }
          .lg-brand-sub { font-size: 11px; }
          .lg-card { padding: 24px 20px; }
          .lg-title { font-size: 24px; }
          .lg-avatar { width: 52px; height: 52px; }
          .lg-footer-line { display: none; }
          .lg-dots { width: 90px; height: 54px; }
        }
        .lg-spin { animation: lg-rotate 1s linear infinite; }
        @keyframes lg-rotate { to { transform: rotate(360deg); } }
      `}</style>

      {/* Bascule clair / sombre — coin supérieur droit */}
      <button
        type="button"
        className="lg-toggle"
        onClick={toggleTheme}
        aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
        title={isDark ? "Mode clair" : "Mode sombre"}
      >
        {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      </button>

      {/* ===== Arrière-plan ===== */}
      <img src={bgPhoto} alt="Bâtiment du Ministère" className="lg-bg lg-bg-left" />
      <div className="lg-veil" aria-hidden="true" />
      <img src={bgPhoto} alt="" aria-hidden="true" className="lg-bg lg-bg-right" />

      {/* Courbes décoratives */}
      <svg className="lg-curve lg-curve-tl" width="240" height="190" viewBox="0 0 240 190" fill="none" aria-hidden="true">
        <path d="M0 0 H180 C140 45 70 90 0 115 Z" fill="url(#lgGradTL)" />
        <path d="M0 105 C70 80 140 40 180 0" stroke="#ffffff" strokeWidth="2.5" fill="none" opacity="0.75" />
        <defs>
          <linearGradient id="lgGradTL" x1="0" y1="0" x2="180" y2="115" gradientUnits="userSpaceOnUse">
            <stop stopColor="#17A398" 
 />
            <stop offset="1" stopColor="#56C1E8" />
          </linearGradient>
        </defs>
      </svg>
      <svg className="lg-curve lg-curve-br" width="260" height="200" viewBox="0 0 260 200" fill="none" aria-hidden="true">
        <path d="M260 200 H70 C115 155 185 110 260 85 Z" fill="url(#lgGradBR)" />
        <path d="M260 95 C185 120 115 160 70 200" stroke="#ffffff" strokeWidth="2.5" fill="none" opacity="0.6" />
        <defs>
          <linearGradient id="lgGradBR" x1="260" y1="200" x2="70" y2="85" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2FE085" />
            <stop offset="1" stopColor="#0B78D6" />
          </linearGradient>
        </defs>
      </svg>

      {/* Grilles de points */}
      <div className="lg-dots lg-dots-tr" aria-hidden="true" />
      <div className="lg-dots lg-dots-bl" aria-hidden="true" />

      {/* ===== Contenu ===== */}
      <div className="lg-content">
        {/* En-tête : logos côte à côte */}
        <header className="lg-header">
          <img src={logoMtefop} alt="Logo du Ministère MTEFoP" className="lg-logo-m" />
          <div className="lg-sep" aria-hidden="true" />
          <div className="lg-brand">
            <img src={logo} alt="Logo AssetTrack" className="lg-brand-icon" />
            <div className="lg-brand-text">
              <span className="lg-brand-title">
                Asset<span className="lg-track">Track</span>
              </span>
              <span className="lg-brand-sub">Système de Gestion et de Traçabilité des Matériels</span>
            </div>
          </div>
        </header>

        {/* Carte de connexion */}
        <main className="lg-card">
          {/* En-tête de la carte */}
          <div className="lg-card-head">
            <div className="lg-avatar">
              <Users size={26} stroke="currentColor" aria-hidden="true" />
            </div>
            <div>
              <h2 className="lg-title">Connexion</h2>
              <span className="lg-sub">Entrez vos identifiants pour accéder à votre espace</span>
            </div>
          </div>

          {/* Barre dégradée sous l'en-tête */}
          <div className="lg-bar" aria-hidden="true" />

          <form onSubmit={handleSubmit} className="lg-form">
            {error && (
              <div role="alert" className="lg-alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "#dc2626", flexShrink: 0 }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Champ Adresse email */}
            <div>
              <label htmlFor="email" className="lg-label">Adresse email</label>
              <div className="lg-field">
                <span className="lg-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@compta.mg"
                  required
                  autoComplete="email"
                  className="lg-input"
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div>
              <label htmlFor="password" className="lg-label">Mot de passe</label>
              <div className="lg-field">
                <span className="lg-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="lg-input lg-input-pw"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="lg-eye"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Options : remember me + mot de passe oublié */}
            <div className="lg-options">
              <label className="lg-remember">
                <input
                  type="checkbox"
                  checked={bMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Se souvenir de moi</span>
              </label>
              <a href="#" className="lg-forgot">Mot de passe oublié ?</a>
            </div>

            {/* Bouton Se connecter */}
            <button type="submit" disabled={isLoading} className="lg-btn">
              {isLoading ? (
                <>
                  <Loader2 size={20} className="lg-spin" aria-hidden="true" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <LogIn size={20} aria-hidden="true" />
                  Se connecter
                </>
              )}
            </button>
          </form>

          {/* Comptes existants — lien d'affichage */}
          <div className="lg-demo">
            <button
              type="button"
              className="lg-demo-link"
              onClick={() => setShowDemoCredentials((v) => !v)}
            >
              {showDemoCredentials ? "Masquer les comptes" : "Afficher les comptes"}
            </button>
            {showDemoCredentials && (
              <div className="lg-accounts" role="list">
                {mockUserDatabase.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="lg-account"
                    role="listitem"
                    onClick={() => {
                      fillDemoCredentials(u.email, u.password);
                      setShowDemoCredentials(false);
                    }}
                  >
                    <span className="lg-account-name">{u.name}</span>
                    <span className="lg-account-dept">{u.department}</span>
                    <span className="lg-account-creds">{u.email} · {u.password}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Pied de page institutionnel */}
        <footer className="lg-footer">
          <span className="lg-footer-line" aria-hidden="true" />
          <span className="lg-footer-pin">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            MTEFoP
          </span>
          <span className="lg-footer-sep" aria-hidden="true" />
          <span>Une gestion efficace pour un meilleur service</span>
          <span className="lg-footer-line" aria-hidden="true" />
        </footer>
      </div>
    </div>
  );
}
