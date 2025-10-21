const API_URL = "https://alquileres-sec.kevinrun12.workers.dev";

export async function apiJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (data.error || data.ok === false) throw new Error(data.error || "Error");
  return data;
}

export async function loadList() {
  const data = await apiJSON(`${API_URL}?action=list`);
  return data.items || [];
}

export async function createOrUpdateContrato(payload) {
  const action = payload.id ? "update" : "create";
  return apiJSON(`${API_URL}?action=${action}&item=${encodeURIComponent(JSON.stringify(payload))}`);
}

export async function deleteContrato(id) {
  return apiJSON(`${API_URL}?action=delete&id=${encodeURIComponent(id)}`);
}

export async function listAumentos(contratoId) {
  const { items } = await apiJSON(
    `${API_URL}?action=listAum&contratoId=${encodeURIComponent(contratoId)}`
  );
  return items || [];
}

export async function createOrUpdateAum(payload) {
  const action = payload.id ? "updateAum" : "createAum";
  return apiJSON(`${API_URL}?action=${action}&item=${encodeURIComponent(JSON.stringify(payload))}`);
}

export async function deleteAum(id) {
  return apiJSON(`${API_URL}?action=deleteAum&id=${encodeURIComponent(id)}`);
}

export async function listPagos(contratoId) {
  const { items } = await apiJSON(
    `${API_URL}?action=listPagos&contratoId=${encodeURIComponent(contratoId)}`
  );
  return items || [];
}

export async function createOrUpdatePago(payload) {
  const action = payload.id ? "updatePago" : "createPago";
  return apiJSON(`${API_URL}?action=${action}&item=${encodeURIComponent(JSON.stringify(payload))}`);
}

export async function deletePago(id) {
  return apiJSON(`${API_URL}?action=deletePago&id=${encodeURIComponent(id)}`);
}

export async function fetchPaymentStatuses(contratoIds, periodo) {
  const ids = Array.isArray(contratoIds) ? contratoIds.filter(Boolean) : [];
  const params = new URLSearchParams({ action: "statuspagos" });
  if (ids.length) params.set("ids", ids.join(","));
  if (periodo) params.set("periodo", periodo);
  return apiJSON(`${API_URL}?${params.toString()}`);
}

export async function fetchPaymentStatus(contratoId, periodo) {
  if (!contratoId) return null;
  const { items } = await fetchPaymentStatuses([contratoId], periodo);
  return items ? items[String(contratoId)] : null;
}

export async function fetchIPC(fromYMD, toYMD) {
  const url = `${API_URL}?action=ipc&from=${encodeURIComponent(fromYMD)}&to=${encodeURIComponent(toYMD)}`;
  const res = await fetch(url, { cache: "no-store" });

  let payload = null;
  try { payload = await res.json(); } catch {
    // Las respuestas vacías o no JSON se ignoran silenciosamente.
  }

  const toMsg = (p, fallback) => {
    if (!p) return fallback;
    const cand = p.error ?? p.message ?? p.detail ?? p.reason ?? p.errors;
    if (cand == null) return fallback;
    if (typeof cand === "string") return cand;
    try { return JSON.stringify(cand); } catch { return fallback; }
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
