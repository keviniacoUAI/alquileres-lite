import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AuthProvider } from "./hooks/useAuth";
import App from "./App.jsx";
import { ApiEnvProvider } from "./context/ApiEnvContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ApiEnvProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ApiEnvProvider>
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  import("virtual:pwa-register")
    .then(({ registerSW }) =>
      registerSW({
        immediate: true,
        onRegistered(swReg) {
          if (import.meta.env.DEV) {
            console.log("Service Worker registrado", swReg);
          }
        },
        onRegisterError(error) {
          console.error("Error registrando el Service Worker", error);
        },
      }),
    )
    .catch((error) => {
      console.error("virtual:pwa-register import failed", error);
    });
}
