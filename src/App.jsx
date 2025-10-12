import { useEffect, useMemo, useState } from "react";

const GAS_URL = "https://script.google.com/macros/s/AKfycbyL6EAZFs6l9_w6Reo1XBOkt7vfKr9I_yiHOGE8Z5ACobL28uaVZtEh-THo7deapYkITg/exec";

/* --- Utilidades generales --- */
const fmtMoney = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const todayISO = () => new Date().toISOString().slice(0, 10);

// JSONP simple (para evitar CORS)
function jsonp(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const s = document.createElement("script");
    const sep = url.includes("?") ? "&" : "?";
    // cache-buster para móviles y CDNs
    s.src = `${url}${sep}callback=${cb}&t=${Date.now()}`;
    s.async = true;

    let done = false;
    const cleanup = () => {
      if (window[cb]) delete window[cb];
      if (s && s.parentNode) s.parentNode.removeChild(s);
    };

    const to = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("JSONP timeout"));
    }, timeout);

    window[cb] = (data) => {
      if (done) return;
      done = true;
      clearTimeout(to);
      cleanup();
      resolve(data);
    };

    s.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(to);
      cleanup();
      reject(new Error("JSONP error"));
    };

    document.body.appendChild(s);
  });
}


// Normaliza valores de fecha a YYYY-MM-DD para inputs type="date"
const toYMD = (x) => {
  if (!x) return "";
  if (typeof x === "string" && x.length >= 10) return x.slice(0, 10);
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  const d = new Date(x);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
};

export default function App() {
  /* --- State --- */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "success", text: "" });

  /* --- Toast helper --- */
  function showToast(text, type = "success", ms = 2500) {
    setToast({ show: true, type, text });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      setToast((t) => ({ ...t, show: false }));
    }, ms);
  }

  /* --- API --- */
async function load() {
  setLoading(true);
  try {
    const data = await jsonp(`${GAS_URL}?action=list`);
    setItems(data.items || []);
  } catch (e) {
    console.error("Error list JSONP:", e);
    showToast("Error cargando datos", "error");
  } finally {
    setLoading(false);
  }
}


  async function createOrUpdate(payload) {
    const action = payload.id ? "update" : "create";
    const url = `${GAS_URL}?action=${action}&item=${encodeURIComponent(
      JSON.stringify(payload)
    )}`;
    const data = await jsonp(url);
    if (data.ok === false) throw new Error(data.error || "Error en el backend");
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(
      (r) =>
        String(r.domicilio || "").toLowerCase().includes(q) ||
        String(r.inquilino || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  /* --- UI helpers --- */
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
      ultimaActualizacion: "",
      notas: "",
    });
  }
  function startEdit(it) {
    setEditing({ ...it });
  }
  function cancelEdit() {
    setEditing(null);
  }

  async function saveEdit(e) {
    e.preventDefault();
    const i = editing.inicio ? new Date(editing.inicio) : null;
    const f = editing.fin ? new Date(editing.fin) : null;
    if (i && f && i > f) {
      showToast("La fecha de inicio no puede ser mayor a la fecha de fin.", "error");
      return;
    }
    try {
      setSaving(true);
      await createOrUpdate(editing);
      await load();
      setEditing(null);
      showToast("Guardado con éxito ✅", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Error guardando", "error");
    } finally {
      setSaving(false);
    }
  }

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
              className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              Nuevo
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="text-left p-3">Domicilio</th>
                <th className="text-left p-3">Inquilino</th>
                <th className="text-left p-3">Contacto</th>
                <th className="text-left p-3">Inicio</th>
                <th className="text-left p-3">Fin</th>
                <th className="text-right p-3">Precio</th>
                <th className="text-left p-3">Aumento</th>
                <th className="text-left p-3">Periodicidad</th>
                <th className="text-left p-3">Últ. actualiz.</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    Sin registros
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.domicilio}</td>
                  <td className="p-3">{r.inquilino}</td>
                  <td className="p-3">{r.contacto || "-"}</td>
                  <td className="p-3">{toYMD(r.inicio) || "-"}</td>
                  <td className="p-3">{toYMD(r.fin) || "-"}</td>
                  <td className="p-3 text-right font-medium">
                    {fmtMoney(r.precioMensual)}
                  </td>
                  <td className="p-3">{r.aumento}</td>
                  <td className="p-3">
                    {({ M: "Mensual", B: "Bimestral", T: "Trimestral", S: "Semestral" }[r.periodicidad] || "-")}
                  </td>
                  <td className="p-3">{toYMD(r.ultimaActualizacion) || "-"}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => startEdit(r)}
                      className="px-3 py-1 rounded-lg border hover:bg-gray-50"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          * Datos servidos desde Google Sheets vía Apps Script.
        </p>
      </main>

      {/* Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={saveEdit}
            className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border p-6 grid grid-cols-2 gap-4"
          >
            <h2 className="col-span-2 text-xl font-semibold">
              {editing.id ? "Editar" : "Nuevo"} contrato
            </h2>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Domicilio</span>
              <input
                required
                disabled={saving}
                value={editing.domicilio}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, domicilio: e.target.value }))
                }
                className="px-3 py-2 border rounded-xl"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Inquilino</span>
              <input
                required
                disabled={saving}
                value={editing.inquilino}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, inquilino: e.target.value }))
                }
                className="px-3 py-2 border rounded-xl"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Contacto</span>
              <input
                disabled={saving}
                value={editing.contacto}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, contacto: e.target.value }))
                }
                className="px-3 py-2 border rounded-xl"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Inicio</span>
              <input
                type="date"
                disabled={saving}
                value={toYMD(editing.inicio)}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, inicio: e.target.value }))
                }
                className="px-3 py-2 border rounded-xl"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Fin</span>
              <input
                type="date"
                disabled={saving}
                value={toYMD(editing.fin)}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, fin: e.target.value }))
                }
                className="px-3 py-2 border rounded-xl"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Precio mensual (ARS)</span>
              <input
                type="number"
                min={0}
                required
                disabled={saving}
                value={editing.precioMensual}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, precioMensual: e.target.value }))
                }
                className="px-3 py-2 border rounded-xl"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Tipo de aumento</span>
              <select
                disabled={saving}
                value={editing.aumento}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, aumento: e.target.value }))
                }
                className="px-3 py-2 border rounded-xl"
              >
                <option>IPC</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Periodicidad</span>
              <select
                disabled={saving}
                value={editing.periodicidad}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, periodicidad: e.target.value }))
                }
                className="px-3 py-2 border rounded-xl"
              >
                <option value="M">Mensual</option>
                <option value="B">Bimestral</option>
                <option value="T">Trimestral</option>
                <option value="S">Semestral</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-sm text-gray-600">Notas</span>
              <textarea
                disabled={saving}
                value={editing.notas}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, notas: e.target.value }))
                }
                className="px-3 py-2 border rounded-xl min-h-[80px]"
              />
            </label>

            <div className="col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="px-4 py-2 rounded-xl border disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                aria-busy={saving}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4A4 4 0 108 12H4z"
                    />
                  </svg>
                )}
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
          toast.show
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3 pointer-events-none",
        ].join(" ")}
        role="status"
        aria-live="polite"
      >
        <div
          className={[
            "min-w-[240px] max-w-[360px] rounded-xl shadow-lg border px-4 py-3 flex items-start gap-3",
            toast.type === "success"
              ? "bg-white border-emerald-200"
              : "bg-white border-red-200",
          ].join(" ")}
        >
          <div
            className={
              toast.type === "success" ? "text-emerald-600" : "text-red-600"
            }
          >
            {toast.type === "success" ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a10 10 0 1010 10A10.011 10.011 0 0012 2zm1 15h-2v-2h2zm0-4h-2V7h2z"
                />
              </svg>
            )}
          </div>

          <div className="text-sm">
            <p className="font-medium">
              {toast.type === "success" ? "Operación exitosa" : "Ocurrió un problema"}
            </p>
            <p className="text-gray-600">{toast.text}</p>
          </div>

          <button
            onClick={() => setToast((t) => ({ ...t, show: false }))}
            className="ml-auto text-gray-400 hover:text-gray-600"
            aria-label="Cerrar notificación"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M18.3 5.71L12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.7 2.88 18.3 9.17 12 2.88 5.71 4.29 4.3 10.59 10.6l6.3-6.3z"
              />
            </svg>
          </button>
        </div>
      </div>

      <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-gray-500">
        <p>© {new Date().getFullYear()} Alquileres Lite — MVP</p>
      </footer>
    </div>
  );
}
// bump 
