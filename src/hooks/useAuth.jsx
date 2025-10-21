import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { sha256Hex } from "../utils/crypto";

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = "alquileres-lite:auth";
const DEFAULT_HASHES = Object.freeze([
  "6ee530293b90d9046bec54e328727bfeecf302dbca0b6b02ef16f6073abbe778",
]);

const parseHashes = (value) =>
  value
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

export function AuthProvider({ children }) {
  const rawHashes = import.meta.env.VITE_ALLOWED_PASS_HASHES || "";
  const loginHint = (import.meta.env.VITE_LOGIN_HINT || "").trim();

  const usingFallbackHashes = !rawHashes.trim();

  const allowedHashes = useMemo(() => {
    if (rawHashes.trim()) return parseHashes(rawHashes);
    return DEFAULT_HASHES;
  }, [rawHashes]);

  const [status, setStatus] = useState("checking");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedHash = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const match = savedHash && allowedHashes.includes(savedHash);

    setIsAuthenticated(Boolean(match));
    if (!match && savedHash) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    setStatus("ready");
    setError("");
  }, [allowedHashes]);

  const login = useCallback(
    async (password) => {
      if (!allowedHashes.length) {
        const message =
          "No hay claves configuradas. Define VITE_ALLOWED_PASS_HASHES con hashes SHA-256.";
        setError(message);
        return { ok: false, message };
      }

      let hashedValue;
      try {
        hashedValue = (await sha256Hex(password)).toLowerCase();
      } catch (err) {
        const message = err?.message || "No fue posible validar la clave en este navegador.";
        setError(message);
        return { ok: false, message };
      }

      const match = allowedHashes.includes(hashedValue);
      if (match) {
        setIsAuthenticated(true);
        setError("");
        if (typeof window !== "undefined") {
          window.localStorage.setItem(AUTH_STORAGE_KEY, hashedValue);
        }
        return { ok: true };
      }

      const message = "Clave incorrecta.";
      setError(message);
      return { ok: false, message };
    },
    [allowedHashes]
  );

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    setIsAuthenticated(false);
    setError("");
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      status,
      error,
      login,
      logout,
      usingFallbackHashes,
      loginHint,
      allowedHashesCount: allowedHashes.length,
    }),
    [
      allowedHashes,
      error,
      isAuthenticated,
      login,
      loginHint,
      logout,
      status,
      usingFallbackHashes,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de un AuthProvider.");
  }
  return context;
}
