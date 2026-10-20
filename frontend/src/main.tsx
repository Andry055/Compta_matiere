import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Toaster } from "./components/ui/sonner";
import "./index.css";
// Système visuel « Console Orbital » : surcharge des jetons de thème + classes
// `.cm-*`. Chargé APRÈS index.css (artefact Tailwind figé) pour primer.
import "./styles/console.css";
// Couche de complétion Tailwind : l'artefact figé (index.css) ne contient
// que les utilitaires compilés à l'époque de sa génération. Ce fichier
// restitue les classes manquantes, utilisées par l'application mais
// silencieusement ignorées par le navigateur.
import "./styles/utilities.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster position="bottom-right" richColors />
  </>
);
