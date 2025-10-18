import React from "react";
import { toYMD } from "../utils/dates";
import { fmtMoney } from "../utils/formatters";
import { BUTTON_STYLES } from "../constants/ui";

export default function AumModal({
  editingAum,
  saving,
  onCancel,
  onSubmit,
  setEditingAum,
  handlePorcentajeChange,
  handleNuevoPrecioChange,
}) {
  if (!editingAum) return null;
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="bg-white w-full max-w-xl rounded-2xl shadow-xl border p-6 grid grid-cols-2 gap-4">
        <h2 className="col-span-2 text-xl font-semibold">
          {editingAum.id ? "Editar aumento" : "Nuevo aumento"}
        </h2>
        {editingAum._auto && (
          <div className="col-span-2 text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2">
            Este aumento fue <b>generado automáticamente por API IPC</b>. Los campos están en solo lectura.
          </div>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Desde</span>
          <input type="date" required value={toYMD(editingAum.desde)}
                 disabled={editingAum._auto || saving}
                 onChange={e => setEditingAum(s => ({ ...s, desde: e.target.value }))}
                 className="px-3 py-2 border rounded-xl" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Hasta</span>
          <input type="date" required value={toYMD(editingAum.hasta)}
                 disabled={editingAum._auto || saving}
                 onChange={e => setEditingAum(s => ({ ...s, hasta: e.target.value }))}
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
                    onChange={e => setEditingAum(s => ({ ...s, nota: e.target.value }))}
                    className="px-3 py-2 border rounded-xl min-h-[80px]" />
        </label>
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving}
                  className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.md}`}>Cancelar</button>
          <button type="submit" disabled={saving}
                  className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.primary} ${BUTTON_STYLES.md}`}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
