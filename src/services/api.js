const FALLBACK_API_BASE_URL = (
  import.meta.env.VITE_API_URL_PROD ||
  import.meta.env.VITE_API_URL ||
  "https://alquileres-sec.kevinrun12.workers.dev"
).trim();

let apiBaseUrl = FALLBACK_API_BASE_URL;

export function getDefaultApiBaseUrl() {
  return FALLBACK_API_BASE_URL;
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export function setApiBaseUrl(url) {
  if (typeof url === "string" && url.trim()) {
    apiBaseUrl = url.trim();
  } else {
    apiBaseUrl = FALLBACK_API_BASE_URL;
  }
  return apiBaseUrl;
}

function buildUrl(params) {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("API base URL no disponible");
  }

  let url;
  try {
    url = new URL(base);
  } catch {
    throw new Error(`API base URL inválida: ${base}`);
  }

  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  } else if (typeof params === "string") {
    const trimmed = params.startsWith("?") ? params.slice(1) : params;
    if (trimmed) {
      const parsed = new URLSearchParams(trimmed);
      parsed.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
    }
  } else if (params && typeof params === "object") {
    Object.entries(params).forEach(([key, value]) => {
      if (value != null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

export async function apiJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (data.error || data.ok === false) throw new Error(data.error || "Error");
  return data;
}

function request(action, extra) {
  const params = new URLSearchParams({ action });
  if (extra && typeof extra === "object") {
    Object.entries(extra).forEach(([key, value]) => {
      if (value != null) params.set(key, String(value));
    });
  }
  return apiJSON(buildUrl(params));
}

export async function loadList() {
  const data = await request("list");
  return data.items || [];
}

export function createOrUpdateContrato(payload) {
  const action = payload?.id ? "update" : "create";
  return request(action, { item: JSON.stringify(payload) });
}

export function deleteContrato(id) {
  return request("delete", { id });
}

export async function listAumentos(contratoId) {
  const { items } = await request("listAum", { contratoId });
  return items || [];
}

export function createOrUpdateAum(payload) {
  const action = payload?.id ? "updateAum" : "createAum";
  return request(action, { item: JSON.stringify(payload) });
}

export function deleteAum(id) {
  return request("deleteAum", { id });
}

export async function listPagos(contratoId) {
  const { items } = await request("listPagos", { contratoId });
  return items || [];
}

export function createOrUpdatePago(payload) {
  const action = payload?.id ? "updatePago" : "createPago";
  return request(action, { item: JSON.stringify(payload) });
}

export function deletePago(id) {
  return request("deletePago", { id });
}

export async function fetchPaymentStatuses(contratoIds, periodo) {
  const ids = Array.isArray(contratoIds) ? contratoIds.filter(Boolean) : [];
  const params = new URLSearchParams({ action: "statuspagos" });
  if (ids.length) params.set("ids", ids.join(","));
  if (periodo) params.set("periodo", periodo);
  return apiJSON(buildUrl(params));
}

export async function fetchPaymentStatus(contratoId, periodo) {
  if (!contratoId) return null;
  const { items } = await fetchPaymentStatuses([contratoId], periodo);
  return items ? items[String(contratoId)] : null;
}

export async function fetchIPC(fromYMD, toYMD) {
  const url = buildUrl({
    action: "ipc",
    from: fromYMD,
    to: toYMD,
  });
  const res = await fetch(url, { cache: "no-store" });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // Las respuestas vacías o no JSON se ignoran silenciosamente.
  }

  const toMsg = (p, fallback) => {
    if (!p) return fallback;
    const cand = p.error ?? p.message ?? p.detail ?? p.reason ?? p.errors;
    if (cand == null) return fallback;
    if (typeof cand === "string") return cand;
    try {
      return JSON.stringify(cand);
    } catch {
      return fallback;
    }
  };

  const friendlyNoData = "No existe información en el IPC para el período consultado.";

  if (!res.ok) {
    if (payload?.code === "NO_DATA" || /no data/i.test(toMsg(payload, ""))) {
      throw new Error(friendlyNoData);
    }
    const detail = toMsg(payload, "");
    if (res.status === 401) throw new Error(detail || "No autorizado (API key inválida)");
    if (res.status === 429) throw new Error(detail || "Demasiadas solicitudes (rate limit)");
    if (res.status === 400) throw new Error(detail || "Parámetros inválidos (400)");
    throw new Error(`Error IPC (${res.status})${detail ? ` - ${detail}` : ""}`);
  }

  const count = Array.isArray(payload?.data) ? payload.data.length : 0;
  if (payload?.code === "NO_DATA" || count === 0) {
    throw new Error(friendlyNoData);
  }

  if (payload?.success === false) {
    throw new Error(toMsg(payload, "Respuesta inválida de IPC"));
  }

  const map = {};
  (payload.data || []).forEach((d) => {
    const dt = new Date(d.date);
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const val = d?.values?.monthly;
    if (typeof val === "number") map[ym] = val;
  });
  return map;
}
