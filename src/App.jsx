import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = "https://alquileres-sec.kevinrun12.workers.dev";

/* ================== Helpers ================== */

const fmtMoney = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

  const BTN = {
  base:
    "inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed",

  // variantes de color
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-400",
  outline: "border text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-300",
  outlineBlue: "border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 focus:ring-blue-300",
  dangerOutline: "border border-red-600 text-red-600 bg-white hover:bg-red-50 focus:ring-red-300",

  // tamaños
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2",
};


const toYMD = (x) => {
  if (!x) return "";
  if (typeof x === "string" && x.length >= 10) return x.slice(0, 10);
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  const d = new Date(x);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
};

const fmtDateAR = (x) => {
  if (!x) return "";
  const d = new Date(x);
  if (isNaN(d)) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const PERIOD_LABEL = { M: "Mensual", B: "Bimestral", T: "Trimestral", S: "Semestral" };
const PERIOD_MONTHS = { M: 1, B: 2, T: 3, S: 6 };

/* ====== Utilidades para sugerir periodos de aumento ====== */
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
  const [aumLoading, setAumLoading] = useState({}); // { [contratoId]: true|false }
const [aumError, setAumError]     = useState({}); // { [contratoId]: string|null }


  // Último precio por contrato (backend lo devuelve en list)
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

  // ► ACTUALIZACIÓN OPTIMISTA (sin recargar todo)
  async function saveEdit(e) {
    e.preventDefault();
    const i = editing.inicio ? new Date(editing.inicio) : null;
    const f = editing.fin ? new Date(editing.fin) : null;
    if (i && f && i > f) {
      showToast("Inicio no puede ser mayor a fin", "error");
      return;
    }
    const isCreate = !editing.id;
    try {
      setSaving(true);
      const res = await createOrUpdateContrato(editing); // {ok:true, id?:...}

      if (isCreate) {
        const newId = res.id || String(Date.now()); // fallback por si el worker no propagó id
        const nuevo = { ...editing, id: newId };
        // inserto arriba
        setItems((list) => [nuevo, ...list]);
        // último precio = base al crear
        setLastPrice((lp) => ({ ...lp, [newId]: Number(nuevo.precioMensual || 0) }));
      } else {
        // reemplazo en memoria
        setItems((list) => list.map((x) => (x.id === editing.id ? { ...x, ...editing } : x)));
        // si cambió el precio base y todavía no hay aumentos, reflejar en lastPrice
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
      // como fallback podrías hacer load() si querés re-sincronizar
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
    setAumLoading((s) => ({ ...s, [id]: true }));
    setAumError((s) => ({ ...s, [id]: null }));
    try {
      const items = await listAumentos(id);
      setAumByContrato((s) => ({ ...s, [id]: items }));
    } catch (e) {
      console.error(e);
      setAumError((s) => ({ ...s, [id]: "No se pudieron cargar aumentos" }));
      showToast("No se pudieron cargar aumentos", "error");
    } finally {
      setAumLoading((s) => ({ ...s, [id]: false }));
    }
  }
}


  function startNewAum(c) {
    const list = (aumByContrato[c.id] || []).slice();
    const periodMonths = PERIOD_MONTHS[c.periodicidad] || 1;
    const contractStart = new Date(c.inicio);
    const anchorDay = contractStart.getDate();

    // base
    let base = Number(c.precioMensual || 0);
    if (list.length) {
      list.sort((a, b) => new Date(a.hasta) - new Date(b.hasta));
      base = Number(list[list.length - 1].nuevoPrecio || base);
    } else if (lastPrice[c.id] != null) {
      base = Number(lastPrice[c.id]);
    }

    // sugerir fechas según periodicidad
    let after = contractStart;
    if (list.length > 0) after = new Date(list[list.length - 1].hasta);
    const desdeDate = nextCycleStart(contractStart, periodMonths, after);
    const hastaDate = cycleEnd(desdeDate, periodMonths, anchorDay);

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
    });
  }

  function startEditAum(a) {
    setEditingAum({
      ...a,
      basePrecio: a.basePrecio || lastPrice[a.contratoId] || a.nuevoPrecio || 0,
      _lockPrecio: false,
    });
  }
  function cancelAum() { setEditingAum(null); }

  function handlePorcentajeChange(e) {
    const val = e.target.value;
    setEditingAum((s) => {
      const base = Number(s.basePrecio || 0);
      const p = parseFloat(String(val).replace(",", "."));
      if (isFinite(p)) {
        const nuevo = Math.round(base * (1 + p / 100));
        return { ...s, porcentaje: val, nuevoPrecio: nuevo, _lockPrecio: true };
      }
      return { ...s, porcentaje: val, _lockPrecio: false };
    });
  }
  function handleNuevoPrecioChange(e) {
    const val = e.target.value;
    setEditingAum((s) => {
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
      await createOrUpdateAum(editingAum);
      setAumLoading((s) => ({ ...s, [editingAum.contratoId]: true }));
      const items = await listAumentos(editingAum.contratoId);
      setAumByContrato((s) => ({ ...s, [editingAum.contratoId]: items }));
      setAumLoading((s) => ({ ...s, [editingAum.contratoId]: true }));
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
      await deleteAum(a.id);
      setAumLoading((s) => ({ ...s, [a.contratoId]: true }));
      const items = await listAumentos(a.contratoId);
      setAumByContrato((s) => ({ ...s, [a.contratoId]: items }));
      setAumLoading((s) => ({ ...s, [a.contratoId]: false }));
      let ultimo = Number(a.nuevoPrecio || 0);
      if (items.length) {
        items.sort((x, y) => new Date(x.hasta) - new Date(y.hasta));
        ultimo = Number(items[items.length - 1].nuevoPrecio || 0);
      } else {
        ultimo = 0; // si querés, podrías poner el precio base del contrato
      }
      setLastPrice((lp) => ({ ...lp, [a.contratoId]: ultimo }));
      showToast("Aumento eliminado ✅", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Error eliminando aumento", "error");
    } finally {
      setSaving(false);
      setDeletingAumId(null);
    }
  }

  // Cerrar menú “Más” al clickear fuera
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
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
    <col className="w-[15%]" /> {/* Domicilio */}
    <col className="w-[12%]" /> {/* Inquilino */}
    <col className="w-[10%]" /> {/* Contacto */}
    <col className="w-[8%]"  /> {/* Inicio */}
    <col className="w-[8%]"  /> {/* Fin */}
    <col className="w-[10%]" /> {/* Precio base */}
    <col className="w-[12%]" /> {/* Último precio */}
    <col className="w-[6%]"  /> {/* Aumento */}
    <col className="w-[7%]"  /> {/* Period. */}
    <col className="w-[6%]"  /> {/* Acciones */}
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
                  aumLoading={aumLoading}
                  aumError={aumError}
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
                      className="px-4 py-2 rounded-xl border text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60">Cancelar</button>
              <button type="submit" disabled={saving}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-400">
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

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Desde</span>
              <input type="date" required value={toYMD(editingAum.desde)}
                     onChange={(e) => setEditingAum((s) => ({ ...s, desde: e.target.value }))}
                     className="px-3 py-2 border rounded-xl" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Hasta</span>
              <input type="date" required value={toYMD(editingAum.hasta)}
                     onChange={(e) => setEditingAum((s) => ({ ...s, hasta: e.target.value }))}
                     className="px-3 py-2 border rounded-xl" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">% Aumento</span>
              <input type="number" step="0.01" inputMode="decimal" required
                     value={editingAum.porcentaje} onChange={handlePorcentajeChange}
                     className="px-3 py-2 border rounded-xl" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Nuevo precio (ARS)</span>
              <input type="number" min={0} required
                     value={editingAum.nuevoPrecio} onChange={handleNuevoPrecioChange}
                     readOnly={!!editingAum._lockPrecio}
                     className={`px-3 py-2 border rounded-xl ${editingAum._lockPrecio ? "bg-gray-50" : ""}`}
                     title={editingAum._lockPrecio ? "Calculado a partir del porcentaje" : ""} />
              <span className="text-xs text-gray-500">Precio base: {fmtMoney(editingAum.basePrecio || 0)}</span>
            </label>

            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-sm text-gray-600">Nota</span>
              <textarea value={editingAum.nota}
                        onChange={(e) => setEditingAum((s) => ({ ...s, nota: e.target.value }))}
                        className="px-3 py-2 border rounded-xl min-h-[80px]" />
            </label>

            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={cancelAum} disabled={saving}
                      className="px-4 py-2 rounded-xl border disabled:opacity-60">Cancelar</button>
              <button type="submit" disabled={saving}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
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
          <div className={toast.type === "success" ? "text-emerald-600" : "text-red-600"}>{toast.type === "success" ? "✅" : "⚠️"}</div>
          <div className="text-sm">
            <p className="font-medium">{toast.type === "success" ? "Operación exitosa" : "Ocurrió un problema"}</p>
            <p className="text-gray-600">{toast.text}</p>
          </div>
          <button onClick={() => setToast((t) => ({ ...t, show: false }))}
                  className="ml-auto text-gray-400 hover:text-gray-600" aria-label="Cerrar notificación">✖</button>
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
  aumLoading,   // <— nuevo
  aumError      // <— nuevo
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
    "px-2.5 py-1 rounded-lg text-xs transition-colors focus:outline-none focus:ring-2",
    expandedId === r.id
      ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400"
      : "border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 focus:ring-blue-300"
  ].join(" ")}
      title="Ver aumentos"
    >
      {expandedId === r.id ? "Aumentos ▲" : "Aumentos ▼"}
    </button>

    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuId(openMenuId === r.id ? null : r.id);
        }}
        className="px-2 py-1 rounded-lg border text-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
        title="Más acciones"
      >
        Más ▾
      </button>

      {openMenuId === r.id && (
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
              <button onClick={() => startNewAum(r)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                Agregar aumento
              </button>
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
  {aumLoading[r.id] ? (
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
        <td className="p-2 text-right">{Number(a.porcentaje).toFixed(2)}%</td>
        <td className="p-2 text-right">{fmtMoney(a.nuevoPrecio)}</td>
        <td className="p-2 truncate">{a.nota || "-"}</td>
        <td className="p-2 text-right">
          <div className="flex gap-2 justify-end">
            <button onClick={() => startEditAum(a)}  className="px-2 py-1 rounded-lg border text-gray-700 bg-white hover:bg-gray-50">Editar</button>
            <button onClick={() => onDeleteAum(a)} disabled={saving || deletingAumId === a.id}
                    className="px-2 py-1 rounded-lg border border-red-600 text-red-600 bg-white hover:bg-red-50 disabled:opacity-60">
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