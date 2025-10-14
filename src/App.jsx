import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = "https://alquileres-sec.kevinrun12.workers.dev";

/* ================== Helpers ================== */

// Formato moneda
const fmtMoney = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

// Estilos de botones
const BTN = {
  base:
    "inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed",
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-400",
  outline: "border text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-300",
  outlineBlue: "border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 focus:ring-blue-300",
  dangerOutline: "border border-red-600 text-red-600 bg-white hover:bg-red-50 focus:ring-red-300",
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2",
};

// YYYY-MM-DD ➜ Date (local, sin desfase)
function parseYMD(s) {
  if (!s) return null;
  const parts = String(s).slice(0, 10).split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Date/str ➜ YYYY-MM-DD
function toYMD(x) {
  if (!x) return "";
  if (typeof x === "string" && x.length >= 10) return x.slice(0, 10);
  const d = x instanceof Date ? x : parseYMD(x);
  if (!d || isNaN(d)) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// YYYY-MM-DD ➜ dd/MM/yyyy (solo reordena string)
function fmtDateAR(x) {
  if (!x) return "";
  const s = String(x).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

const todayISO = () => toYMD(new Date());
const PERIOD_LABEL = { M: "Mensual", B: "Bimestral", T: "Trimestral", S: "Semestral" };
const PERIOD_MONTHS = { M: 1, B: 2, T: 3, S: 6 };

// Genera una lista de YYYY-MM para [from..to] inclusive
function monthSpan(fromYMD, toYMD) {
  const s = parseYMD(fromYMD);
  const e = parseYMD(toYMD);
  const end = new Date(e.getFullYear(), e.getMonth() + 1, 0);
  const out = [];
  let y = s.getFullYear(),
    m = s.getMonth();
  while (new Date(y, m, 1) <= end) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m++;
    if (m === 12) {
      m = 0;
      y++;
    }
  }
  return out;
}

function monthLabelES(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "short", year: "numeric" });
}

// Periodicidad y ciclos
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
function addMonthsAligned(date, months, anchorDay) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = d.getMonth() + months;
  const first = new Date(y, m, 1);
  const day = Math.min(anchorDay, daysInMonth(first.getFullYear(), first.getMonth()));
  return new Date(first.getFullYear(), first.getMonth(), day);
}
function nextCycleStart(contractStart, periodMonths, afterDate) {
  const start = new Date(contractStart);
  const anchor = start.getDate();
  let candidate = addMonthsAligned(start, periodMonths, anchor);
  while (candidate <= afterDate) {
    candidate = addMonthsAligned(candidate, periodMonths, anchor);
  }
  return candidate;
}
function cycleEnd(fromDate, periodMonths, anchorDay) {
  const nextStart = addMonthsAligned(fromDate, periodMonths, anchorDay);
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  return end;
}

/* ---------- % helpers: evitan NaN y arreglan casos “8/03/2025” ---------- */

// Convierte "7,3", "7.3", "7.3%", " 7 " a número (7.3). Devuelve NaN si no es válido.
function toNumberPct(v) {
  if (v == null) return NaN;
  const s = String(v).replace("%", "").replace(",", ".").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

// Si el porcentaje viene raro (p. ej. “8/03/2025”), lo recalculamos desde base/nuevo.
function pctFromRow(a) {
  let n = toNumberPct(a.porcentaje);
  if (!Number.isFinite(n)) {
    const base = Number(a.basePrecio || 0);
    const nuevo = Number(a.nuevoPrecio || 0);
    if (base > 0 && nuevo > 0) n = ((nuevo / base) - 1) * 100;
  }
  return n;
}

function fmtPctFromRow(a) {
  const n = pctFromRow(a);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "-";
}

/* ================== App ================== */

export default function App() {
  // Contratos
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);

  // Aumentos
  const [expandedId, setExpandedId] = useState(null);
  const [aumByContrato, setAumByContrato] = useState({});
  const [editingAum, setEditingAum] = useState(null);
  const [deletingAumId, setDeletingAumId] = useState(null);

  // Loading separado
  const [aumLoadingList, setAumLoadingList] = useState({});
  const [aumCalculating, setAumCalculating] = useState({});
  const [aumError, setAumError] = useState({});

  // Último precio por contrato
  const [lastPrice, setLastPrice] = useState({});

  // Menú “Más”
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  // UX
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "success", text: "" });

  function showToast(text, type = "success", ms = 2000) {
    setToast({ show: true, type, text });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast((t) => ({ ...t, show: false })), ms);
  }

  /* -------- API base -------- */
  async function apiJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.error || data.ok === false) throw new Error(data.error || "Error");
    return data;
  }

  async function load() {
    setLoading(true);
    try {
      const data = await apiJSON(`${API_URL}?action=list`);
      const list = data.items || [];
      setItems(list);
      const lp = {};
      for (const c of list) lp[c.id] = Number(c.lastPrecio ?? c.precioMensual ?? 0);
      setLastPrice(lp);
    } catch (e) {
      console.error(e);
      showToast("Error cargando datos", "error");
    } finally {
      setLoading(false);
    }
  }

  async function createOrUpdateContrato(payload) {
    const action = payload.id ? "update" : "create";
    return apiJSON(`${API_URL}?action=${action}&item=${encodeURIComponent(JSON.stringify(payload))}`);
  }
  async function deleteContrato(id) {
    return apiJSON(`${API_URL}?action=delete&id=${encodeURIComponent(id)}`);
  }

  async function listAumentos(contratoId) {
    const { items } = await apiJSON(
      `${API_URL}?action=listAum&contratoId=${encodeURIComponent(contratoId)}`
    );
    return items || [];
  }
  async function createOrUpdateAum(payload) {
    const action = payload.id ? "updateAum" : "createAum";
    return apiJSON(`${API_URL}?action=${action}&item=${encodeURIComponent(JSON.stringify(payload))}`);
  }
  async function deleteAum(id) {
    return apiJSON(`${API_URL}?action=deleteAum&id=${encodeURIComponent(id)}`);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(
      (r) =>
        String(r.domicilio || "").toLowerCase().includes(q) ||
        String(r.inquilino || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  /* -------- Contratos UI -------- */
  function startNew() {
    setEditing({
      id: "",
      domicilio: "",
      inquilino: "",
      contacto: "",
      inicio: todayISO(),
      fin: "",
      precioMensual: 0,
      aumento: "IPC",
      periodicidad: "M",
      notas: "",
    });
  }
  function startEdit(it) { setEditing({ ...it }); setOpenMenuId(null); }
  function cancelEdit() { setEditing(null); }

  // Guardar contrato
  async function saveEdit(e) {
    e.preventDefault();
    const i = editing.inicio ? parseYMD(editing.inicio) : null;
    const f = editing.fin ? parseYMD(editing.fin) : null;
    if (i && f && i > f) {
      showToast("Inicio no puede ser mayor a fin", "error");
      return;
    }
    const isCreate = !editing.id;
    try {
      setSaving(true);
      const res = await createOrUpdateContrato(editing);

      if (isCreate) {
        const newId = res.id || String(Date.now());
        const nuevo = { ...editing, id: newId };
        setItems((list) => [nuevo, ...list]);
        setLastPrice((lp) => ({ ...lp, [newId]: Number(nuevo.precioMensual || 0) }));
      } else {
        setItems((list) => list.map((x) => (x.id === editing.id ? { ...x, ...editing } : x)));
        setLastPrice((lp) => {
          const prev = lp[editing.id];
          const nuevoBase = Number(editing.precioMensual || 0);
          return { ...lp, [editing.id]: prev ?? nuevoBase };
        });
      }

      setEditing(null);
      showToast("Guardado ✅", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Error guardando", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(r) {
    setOpenMenuId(null);
    if (!confirm(`¿Eliminar el contrato de ${r.inquilino} en "${r.domicilio}"?`)) return;
    try {
      setSaving(true);
      await deleteContrato(r.id);
      setItems((list) => list.filter((x) => x.id !== r.id));
      setLastPrice((lp) => { const c = { ...lp }; delete c[r.id]; return c; });
      showToast("Eliminado ✅", "success");
    } catch (e) {
      console.error(e);
      showToast(e.message || "Error eliminando", "error");
    } finally {
      setSaving(false);
    }
  }

  /* -------- Aumentos UI -------- */
  async function toggleExpand(c) {
    const id = c.id;
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);

    if (!aumByContrato[id]) {
      setAumLoadingList((s) => ({ ...s, [id]: true }));
      setAumError((s) => ({ ...s, [id]: null }));
      try {
        const items = await listAumentos(id);
        setAumByContrato((s) => ({ ...s, [id]: items }));
      } catch (e) {
        console.error(e);
        setAumError((s) => ({ ...s, [id]: "No se pudieron cargar aumentos" }));
        showToast("No se pudieron cargar aumentos", "error");
      } finally {
        setAumLoadingList((s) => ({ ...s, [id]: false }));
      }
    }
  }

  function startNewAum(c) {
    const list = (aumByContrato[c.id] || []).slice();
    const periodMonths = PERIOD_MONTHS[c.periodicidad] || 1;
    const contractStart = parseYMD(c.inicio);
    const anchorDay = contractStart.getDate();

    // base
    let base = Number(c.precioMensual || 0);
    if (list.length) {
      list.sort((a, b) => parseYMD(a.hasta) - parseYMD(b.hasta));
      base = Number(list[list.length - 1].nuevoPrecio || base);
    } else if (lastPrice[c.id] != null) {
      base = Number(lastPrice[c.id]);
    }

    // Sugerir fechas:
    let desdeDate, hastaDate;
    if (list.length === 0) {
      desdeDate = contractStart; // primer ciclo desde inicio
      hastaDate = cycleEnd(desdeDate, periodMonths, anchorDay);
    } else {
      const after = parseYMD(list[list.length - 1].hasta);
      desdeDate = nextCycleStart(contractStart, periodMonths, after);
      hastaDate = cycleEnd(desdeDate, periodMonths, anchorDay);
    }

    setEditingAum({
      id: "",
      contratoId: c.id,
      desde: toYMD(desdeDate),
      hasta: toYMD(hastaDate),
      porcentaje: "",
      nuevoPrecio: base,
      basePrecio: base,
      nota: "",
      _lockPrecio: false,
      _auto: false, // manual => editable
    });
  }

  function startEditAum(a) {
    setEditingAum({
      ...a,
      basePrecio: a.basePrecio || lastPrice[a.contratoId] || a.nuevoPrecio || 0,
      _lockPrecio: false,
      _auto: false, // edición manual
    });
  }
  function cancelAum() { setEditingAum(null); }

  // Worker: action=ipc
  async function fetchIPC(fromYMD, toYMD) {
    const url = `${API_URL}?action=ipc&from=${encodeURIComponent(fromYMD)}&to=${encodeURIComponent(toYMD)}`;
    const res = await fetch(url, { cache: "no-store" });

    let payload = null;
    try { payload = await res.json(); } catch {}

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

  // Calcular próximo aumento por IPC (abre modal en SOLO LECTURA)
  async function onCalcProximoAumento(contrato) {
    try {
      const periodMonths = PERIOD_MONTHS[contrato.periodicidad] || 1;
      const contractStart = parseYMD(contrato.inicio);
      const anchorDay = contractStart.getDate();

      const list = (aumByContrato[contrato.id] || [])
        .slice()
        .sort((a, b) => parseYMD(a.hasta) - parseYMD(b.hasta));

      let base = Number(contrato.precioMensual || 0);
      if (list.length) base = Number(list[list.length - 1].nuevoPrecio || base);
      else if (lastPrice[contrato.id] != null) base = Number(lastPrice[contrato.id]);

      // Período
      let desdeDate, hastaDate;
      if (list.length === 0) {
        desdeDate = contractStart; // primer ciclo desde inicio
        hastaDate = cycleEnd(desdeDate, periodMonths, anchorDay);
      } else {
        const after = parseYMD(list[list.length - 1].hasta);
        desdeDate = nextCycleStart(contractStart, periodMonths, after);
        hastaDate = cycleEnd(desdeDate, periodMonths, anchorDay);
      }
      const desdeYMD = toYMD(desdeDate);
      const hastaYMD = toYMD(hastaDate);

      // spinner del botón
      setAumCalculating((s) => ({ ...s, [contrato.id]: true }));

      // IPC
      const ipcMap = await fetchIPC(desdeYMD, hastaYMD);
      const meses = monthSpan(desdeYMD, hastaYMD);
      if (!meses.length) throw new Error("Rango de meses inválido para el cálculo");

      const detalles = [];
      let ultimoConDato = null;
      let faltantes = [];
      let total = 0;

      for (const ym of meses) {
        const val = ipcMap[ym];
        if (typeof val === "number") {
          ultimoConDato = val;
          detalles.push(`${monthLabelES(ym)}: ${val.toFixed(2)}%`);
          total += val;
        } else if (ultimoConDato != null) {
          detalles.push(`${monthLabelES(ym)}: ${ultimoConDato.toFixed(2)}% (estimado)`);
          total += ultimoConDato;
          faltantes.push(ym);
        } else {
          throw new Error("No hay datos suficientes para estimar el primer mes del período.");
        }
      }

      if (faltantes.length) {
        const ok = confirm(
          "Aún no hay IPC para: " +
          faltantes.map(monthLabelES).join(", ") +
          ". ¿Deseás continuar usando estimación del último mes disponible?"
        );
        if (!ok) return;
      }

      const porcentajeTotal = Math.round(total * 100) / 100;
      const nuevoPrecio = Math.round(base * (1 + porcentajeTotal / 100));

      // Modal prellenado (SOLO LECTURA)
      setEditingAum({
        id: "",
        contratoId: contrato.id,
        desde: desdeYMD,
        hasta: hastaYMD,
        porcentaje: String(porcentajeTotal),
        nuevoPrecio,
        basePrecio: base,
        nota: `Aumento generado automáticamente por API IPC.\n${detalles.join(" | ")}`,
        _lockPrecio: true,
        _auto: true, // ← bandera: modal de solo lectura
      });
    } catch (err) {
      console.error(err);
      showToast(err.message || "No se pudo calcular el IPC", "error");
    } finally {
      setAumCalculating((s) => ({ ...s, [contrato.id]: false }));
    }
  }

  function handlePorcentajeChange(e) {
    const val = e.target.value;
    setEditingAum((s) => {
      if (!s || s._auto) return s; // ignorar si es auto (read-only)
      const base = Number(s.basePrecio || 0);
      const p = toNumberPct(val);
      if (Number.isFinite(p)) {
        const nuevo = Math.round(base * (1 + p / 100));
        return { ...s, porcentaje: val, nuevoPrecio: nuevo, _lockPrecio: true };
      }
      return { ...s, porcentaje: val, _lockPrecio: false };
    });
  }
  function handleNuevoPrecioChange(e) {
    const val = e.target.value;
    setEditingAum((s) => {
      if (!s || s._auto) return s; // ignorar si es auto (read-only)
      const base = Number(s.basePrecio || 0);
      const np = parseFloat(val);
      if (isFinite(np) && base > 0) {
        const p = ((np / base) - 1) * 100;
        const pct = Number.isFinite(p) ? (Math.round(p * 100) / 100).toString() : s.porcentaje;
        return { ...s, nuevoPrecio: val, porcentaje: pct, _lockPrecio: false };
      }
      return { ...s, nuevoPrecio: val, _lockPrecio: false };
    });
  }

  async function saveAum(e) {
    e.preventDefault();
    if (!editingAum) return;
    const base = Number(editingAum.basePrecio || 0);
    if (!(base > 0)) { showToast("Precio base inválido", "error"); return; }
    try {
      setSaving(true);

      // Normalizar porcentaje y números ANTES de guardar
      const pctNum = toNumberPct(editingAum.porcentaje);
      const payload = {
        ...editingAum,
        porcentaje: Number.isFinite(pctNum) ? (Math.round(pctNum * 100) / 100).toString() : "",
        nuevoPrecio: Number(editingAum.nuevoPrecio || 0),
        basePrecio: Number(editingAum.basePrecio || 0),
      };

      await createOrUpdateAum(payload);
      setAumLoadingList((s) => ({ ...s, [editingAum.contratoId]: true }));
      const items = await listAumentos(editingAum.contratoId);
      setAumByContrato((s) => ({ ...s, [editingAum.contratoId]: items }));
      setAumLoadingList((s) => ({ ...s, [editingAum.contratoId]: false }));
      setLastPrice((lp) => ({ ...lp, [editingAum.contratoId]: Number(editingAum.nuevoPrecio || 0) }));
      setEditingAum(null);
      showToast("Aumento guardado ✅", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Error guardando aumento", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteAum(a) {
  setDeletingAumId(a.id);
  const ok = confirm("¿Eliminar este aumento?");
  if (!ok) { setDeletingAumId(null); return; }

  try {
    setSaving(true);

    // 1) Ejecutar borrado
    await deleteAum(a.id);

    // 2) Refrescar lista de aumentos del contrato
    setAumLoadingList((s) => ({ ...s, [a.contratoId]: true }));
    const itemsAum = await listAumentos(a.contratoId);
    setAumByContrato((s) => ({ ...s, [a.contratoId]: itemsAum }));
    setAumLoadingList((s) => ({ ...s, [a.contratoId]: false }));

    // 3) Calcular "último precio" correcto:
    //    - si quedan aumentos: precio del último aumento
    //    - si no quedan: vuelve al precio base del contrato
    let ultimoPrecio;
    if (itemsAum.length) {
      itemsAum.sort((x, y) => parseYMD(x.hasta) - parseYMD(y.hasta));
      ultimoPrecio = Number(itemsAum[itemsAum.length - 1].nuevoPrecio || 0);
    } else {
      // Buscar el contrato para recuperar su precio base
      const contrato = items.find((c) => c.id === a.contratoId);
      ultimoPrecio = Number(contrato?.precioMensual || 0);
    }

    setLastPrice((lp) => ({ ...lp, [a.contratoId]: ultimoPrecio }));
    showToast("Aumento eliminado ✅", "success");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Error eliminando aumento", "error");
  } finally {
    setSaving(false);
    setDeletingAumId(null);
  }
}

  // Cerrar menú “Más” al click afuera
  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpenMenuId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  /* -------- Render -------- */
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            Alquileres <span className="text-blue-600">Admin</span>
          </h1>
          <div className="flex gap-2">
            <input
              type="search"
              placeholder="Buscar por domicilio o inquilino"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="px-3 py-2 border rounded-xl text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={startNew}
              className={`${BTN.base} ${BTN.success} ${BTN.md}`}
            >
              Nuevo
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1320px] mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-sm border px-4 pr-8 py-2">
          <table className="w-full text-sm table-auto border-collapse">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[12%]" />
            </colgroup>

            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="text-left p-3">Domicilio</th>
                <th className="text-left p-3">Inquilino</th>
                <th className="text-left p-3">Contacto</th>
                <th className="text-left p-3">Inicio</th>
                <th className="text-left p-3">Fin</th>
                <th className="text-right p-3">Precio base</th>
                <th className="text-right p-3">Último precio</th>
                <th className="text-left p-3">Aumento</th>
                <th className="text-left p-3">Period.</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">Cargando...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">Sin registros</td>
                </tr>
              )}
              {!loading && filtered.map((r) => (
                <RowWithExpand
                  key={r.id}
                  r={r}
                  expandedId={expandedId}
                  toggleExpand={toggleExpand}
                  startEdit={startEdit}
                  onDelete={onDelete}
                  saving={saving}
                  aum={aumByContrato[r.id] || []}
                  startNewAum={startNewAum}
                  startEditAum={startEditAum}
                  onDeleteAum={onDeleteAum}
                  fmtMoney={fmtMoney}
                  lastPrice={lastPrice}
                  deletingAumId={deletingAumId}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  menuRef={menuRef}
                  aumLoadingList={aumLoadingList}
                  aumCalculating={aumCalculating}
                  aumError={aumError}
                  onCalcProximoAumento={onCalcProximoAumento}
                />
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          * Desarrollado por Kevin Iacovantuono
        </p>
      </main>

      {/* Modal Contrato */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={saveEdit} className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border p-6 grid grid-cols-2 gap-4">
            <h2 className="col-span-2 text-xl font-semibold">
              {editing.id ? "Editar" : "Nuevo"} contrato
            </h2>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Domicilio</span>
              <input required disabled={saving} value={editing.domicilio}
                     onChange={(e) => setEditing((s) => ({ ...s, domicilio: e.target.value }))}
                     className="px-3 py-2 border rounded-xl" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Inquilino</span>
              <input required disabled={saving} value={editing.inquilino}
                     onChange={(e) => setEditing((s) => ({ ...s, inquilino: e.target.value }))}
                     className="px-3 py-2 border rounded-xl" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Contacto</span>
              <input disabled={saving} value={editing.contacto}
                     onChange={(e) => setEditing((s) => ({ ...s, contacto: e.target.value }))}
                     className="px-3 py-2 border rounded-xl" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Inicio</span>
              <input type="date" disabled={saving} value={toYMD(editing.inicio)}
                     onChange={(e) => setEditing((s) => ({ ...s, inicio: e.target.value }))}
                     className="px-3 py-2 border rounded-xl" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Fin</span>
              <input type="date" disabled={saving} value={toYMD(editing.fin)}
                     onChange={(e) => setEditing((s) => ({ ...s, fin: e.target.value }))}
                     className="px-3 py-2 border rounded-xl" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Precio mensual (ARS)</span>
              <input type="number" min={0} required disabled={saving} value={editing.precioMensual}
                     onChange={(e) => setEditing((s) => ({ ...s, precioMensual: e.target.value }))}
                     className="px-3 py-2 border rounded-xl" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Aumento</span>
              <select disabled={saving} value={editing.aumento}
                      onChange={(e) => setEditing((s) => ({ ...s, aumento: e.target.value }))}
                      className="px-3 py-2 border rounded-xl">
                <option>IPC</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Periodicidad</span>
              <select disabled={saving} value={editing.periodicidad}
                      onChange={(e) => setEditing((s) => ({ ...s, periodicidad: e.target.value }))}
                      className="px-3 py-2 border rounded-xl">
                <option value="M">Mensual</option>
                <option value="B">Bimestral</option>
                <option value="T">Trimestral</option>
                <option value="S">Semestral</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-sm text-gray-600">Notas</span>
              <textarea disabled={saving} value={editing.notas}
                        onChange={(e) => setEditing((s) => ({ ...s, notas: e.target.value }))}
                        className="px-3 py-2 border rounded-xl min-h-[80px]" />
            </label>

            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={cancelEdit} disabled={saving}
                      className={`${BTN.base} ${BTN.outline} ${BTN.md}`}>Cancelar</button>
              <button type="submit" disabled={saving}
                      className={`${BTN.base} ${BTN.primary} ${BTN.md}`}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Aumento */}
      {editingAum && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={saveAum} className="bg-white w-full max-w-xl rounded-2xl shadow-xl border p-6 grid grid-cols-2 gap-4">
            <h2 className="col-span-2 text-xl font-semibold">
              {editingAum.id ? "Editar aumento" : "Nuevo aumento"}
            </h2>

            {/* Banner si es auto */}
            {editingAum._auto && (
              <div className="col-span-2 text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2">
                Este aumento fue <b>generado automáticamente por API IPC</b>. Los campos están en solo lectura.
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Desde</span>
              <input type="date" required value={toYMD(editingAum.desde)}
                     disabled={editingAum._auto || saving}
                     onChange={(e) => setEditingAum((s) => ({ ...s, desde: e.target.value }))}
                     className="px-3 py-2 border rounded-xl" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Hasta</span>
              <input type="date" required value={toYMD(editingAum.hasta)}
                     disabled={editingAum._auto || saving}
                     onChange={(e) => setEditingAum((s) => ({ ...s, hasta: e.target.value }))}
                     className="px-3 py-2 border rounded-xl" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">% Aumento</span>
              <input type="number" step="0.01" inputMode="decimal" required
                     value={editingAum.porcentaje}
                     disabled={editingAum._auto || saving}
                     onChange={handlePorcentajeChange}
                     className="px-3 py-2 border rounded-xl" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Nuevo precio (ARS)</span>
              <input type="number" min={0} required
                     value={editingAum.nuevoPrecio}
                     disabled={editingAum._auto || saving}
                     onChange={handleNuevoPrecioChange}
                     readOnly={!!editingAum._lockPrecio}
                     className={`px-3 py-2 border rounded-xl ${editingAum._lockPrecio ? "bg-gray-50" : ""}`}
                     title={editingAum._lockPrecio ? "Calculado a partir del porcentaje" : ""} />
              <span className="text-xs text-gray-500">Precio base: {fmtMoney(editingAum.basePrecio || 0)}</span>
            </label>

            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-sm text-gray-600">Nota</span>
              <textarea value={editingAum.nota}
                        disabled={editingAum._auto || saving}
                        onChange={(e) => setEditingAum((s) => ({ ...s, nota: e.target.value }))}
                        className="px-3 py-2 border rounded-xl min-h-[80px]" />
            </label>

            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={cancelAum} disabled={saving}
                      className={`${BTN.base} ${BTN.outline} ${BTN.md}`}>Cancelar</button>
              <button type="submit" disabled={saving}
                      className={`${BTN.base} ${BTN.primary} ${BTN.md}`}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast */}
      <div
        className={[
          "fixed right-4 bottom-4 z-50 transition-all duration-300",
          toast.show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none",
        ].join(" ")}
        role="status"
        aria-live="polite"
      >
        <div
          className={[
            "min-w-[240px] max-w-[360px] rounded-xl shadow-lg border px-4 py-3 flex items-start gap-3",
            toast.type === "success" ? "bg-white border-emerald-200" : "bg-white border-red-200",
          ].join(" ")}
        >
          <div className={toast.type === "success" ? "text-emerald-600" : "text-red-600"}>
            {toast.type === "success" ? "✅" : "⚠️"}
          </div>
          <div className="text-sm">
            <p className="font-medium">{toast.type === "success" ? "Operación exitosa" : "Ocurrió un problema"}</p>
            <p className="text-gray-600">{toast.text}</p>
          </div>
          <button
            onClick={() => setToast((t) => ({ ...t, show: false }))}
            className="ml-auto text-gray-400 hover:text-gray-600"
            aria-label="Cerrar notificación"
          >
            ✖
          </button>
        </div>
      </div>

      <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-gray-500">
        <p>© {new Date().getFullYear()} Alquileres Admin — MVP</p>
      </footer>
    </div>
  );
}

/* =========== Fila de contrato + expandible de aumentos =========== */
function RowWithExpand({
  r,
  expandedId,
  toggleExpand,
  startEdit,
  onDelete,
  saving,
  aum,
  startNewAum,
  startEditAum,
  onDeleteAum,
  fmtMoney,
  lastPrice,
  deletingAumId,
  openMenuId,
  setOpenMenuId,
  menuRef,
  aumLoadingList,
  aumCalculating,
  aumError,
  onCalcProximoAumento
}) {
  const isMenuOpen = openMenuId === r.id;

  return (
    <>
      <tr className="border-t">
        <td className="p-2 truncate">{r.domicilio}</td>
        <td className="p-2 truncate">{r.inquilino}</td>
        <td className="p-2 truncate">{r.contacto || "-"}</td>
        <td className="p-2">{fmtDateAR(r.inicio) || "-"}</td>
        <td className="p-2">{fmtDateAR(r.fin) || "-"}</td>
        <td className="p-2 text-right font-medium">{fmtMoney(r.precioMensual)}</td>
        <td className="p-2 text-right font-medium">{fmtMoney(lastPrice[r.id] ?? r.precioMensual)}</td>
        <td className="p-2">{r.aumento || "-"}</td>
        <td className="p-2">{PERIOD_LABEL[r.periodicidad] || "-"}</td>

        <td className="p-3 pr-4 text-right min-w-[180px] whitespace-nowrap align-middle">
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => toggleExpand(r)}
              className={[
                BTN.base,
                aumLoadingList[r.id] ? BTN.primary : BTN.outlineBlue,
                BTN.xs,
              ].join(" ")}
              title="Ver aumentos"
            >
              {expandedId === r.id ? "Aumentos ▲" : "Aumentos ▼"}
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(isMenuOpen ? null : r.id);
                }}
                className={`${BTN.base} ${BTN.outline} ${BTN.xs}`}
                title="Más acciones"
              >
                Más ▾
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-1 w-40 bg-white border rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => startEdit(r)}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDelete(r)}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>

      {expandedId === r.id && (
        <tr className="bg-gray-50/60">
          <td colSpan={10} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Aumentos de este contrato</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => onCalcProximoAumento(r)}
                  disabled={!!aumCalculating[r.id]}
                  className={`${BTN.base} ${BTN.outlineBlue} ${BTN.sm}`}
                  title="Calcula el aumento según IPC del período próximo"
                >
                  {aumCalculating[r.id] ? "Calculando…" : "Calcular próximo aumento"}
                </button>

                <button
                  onClick={() => startNewAum(r)}
                  className={`${BTN.base} ${BTN.success} ${BTN.sm}`}
                >
                  Agregar aumento
                </button>
              </div>
            </div>

            <div className="border rounded-xl bg-white">
              <table className="w-full text-sm table-auto border-collapse">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                  <col className="w-[30%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="text-left p-2">Desde</th>
                    <th className="text-left p-2">Hasta</th>
                    <th className="text-right p-2">% Aumento</th>
                    <th className="text-right p-2">Nuevo precio</th>
                    <th className="text-left p-2">Nota</th>
                    <th className="text-right p-3 min-w-[180px]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {aumLoadingList[r.id] ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-gray-500">
                        Aguarde, recuperando aumentos…
                      </td>
                    </tr>
                  ) : aumError[r.id] ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-red-600">
                        {aumError[r.id]}
                      </td>
                    </tr>
                  ) : (!aum || aum.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-gray-500">
                        Sin aumentos
                      </td>
                    </tr>
                  ) : (
                    aum.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="p-2">{fmtDateAR(a.desde)}</td>
                        <td className="p-2">{fmtDateAR(a.hasta)}</td>
                        <td className="p-2 text-right">{fmtPctFromRow(a)}</td>
                        <td className="p-2 text-right">{fmtMoney(a.nuevoPrecio)}</td>
                        <td className="p-2 whitespace-pre-wrap">{a.nota || "-"}</td>
                        <td className="p-2 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => startEditAum(a)}
                              className={`${BTN.base} ${BTN.outline} ${BTN.xs}`}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => onDeleteAum(a)}
                              disabled={saving || deletingAumId === a.id}
                              className={`${BTN.base} ${BTN.dangerOutline} ${BTN.xs}`}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
