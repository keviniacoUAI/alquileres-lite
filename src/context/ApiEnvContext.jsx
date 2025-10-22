import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getDefaultApiBaseUrl, setApiBaseUrl } from "../services/api";

const STORAGE_KEY = "alquileres-lite:api-env";

function parseEnvConfig() {
  const raw = import.meta.env.VITE_API_ENVIRONMENTS;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const id = String(entry.id || entry.key || "").trim();
        const name = String(entry.name || entry.label || id || "").trim();
        const apiUrl = String(entry.apiUrl || entry.url || "").trim();
        if (!id || !name || !apiUrl) return null;
        return { id, name, apiUrl };
      })
      .filter(Boolean);
  } catch {
    console.warn("No se pudo parsear VITE_API_ENVIRONMENTS. Se usa la configuracion por defecto.");
    return null;
  }
}

function buildDefaultEnvironments() {
  const prodUrl = String(
    import.meta.env.VITE_API_URL_PROD ||
      import.meta.env.VITE_API_URL ||
      getDefaultApiBaseUrl()
  ).trim();
  const uatUrl = String(import.meta.env.VITE_API_URL_UAT || "").trim();

  const list = [];
  if (prodUrl) {
    list.push({ id: "prod", name: "Producción", apiUrl: prodUrl });
  }
  if (uatUrl) {
    const already = list.some((env) => env.apiUrl === uatUrl);
    list.push({
      id: already ? "uat_alt" : "uat",
      name: "UAT",
      apiUrl: uatUrl,
    });
  }
  if (!list.length) {
    list.push({ id: "default", name: "Default", apiUrl: getDefaultApiBaseUrl() });
  }
  return list;
}

const ApiEnvContext = createContext(null);

export function ApiEnvProvider({ children }) {
  const environments = useMemo(() => {
    const parsed = parseEnvConfig();
    if (parsed && parsed.length) return parsed;
    return buildDefaultEnvironments();
  }, []);

  const [currentId, setCurrentId] = useState(() => {
    if (!environments.length) return null;
    let initialId = environments[0].id;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const match = environments.find((env) => env.id === stored);
      if (match?.id) initialId = match.id;
    }
    const active =
      environments.find((env) => env.id === initialId) || environments[0];
    if (active?.apiUrl) {
      setApiBaseUrl(active.apiUrl);
    }
    if (typeof window !== "undefined" && active?.id) {
      window.localStorage.setItem(STORAGE_KEY, active.id);
    }
    return active?.id || null;
  });

  useEffect(() => {
    if (!environments.length) return;
    const exists = environments.some((env) => env.id === currentId);
    if (!exists) {
      setCurrentId(environments[0].id);
    }
  }, [currentId, environments]);

  useEffect(() => {
    const active =
      environments.find((env) => env.id === currentId) || environments[0];
    if (active?.apiUrl) {
      setApiBaseUrl(active.apiUrl);
    }
    if (typeof window !== "undefined" && active?.id) {
      window.localStorage.setItem(STORAGE_KEY, active.id);
    }
  }, [currentId, environments]);

  const value = useMemo(() => {
    const active =
      environments.find((env) => env.id === currentId) || environments[0] || null;
    return {
      environments,
      current: active,
      setEnvironment: setCurrentId,
    };
  }, [currentId, environments]);

  return (
    <ApiEnvContext.Provider value={value}>{children}</ApiEnvContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApiEnv() {
  const ctx = useContext(ApiEnvContext);
  if (!ctx) {
    throw new Error("useApiEnv debe utilizarse dentro de un ApiEnvProvider.");
  }
  return ctx;
}
