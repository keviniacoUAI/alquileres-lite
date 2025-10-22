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
