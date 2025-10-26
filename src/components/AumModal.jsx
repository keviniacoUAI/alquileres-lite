import React from "react";
import { fmtMoney } from "../utils/formatters";
import { BUTTON_STYLES } from "../constants/ui";
import { DateInput } from "./DateInput";

export default function AumModal({
  editingAum,
  saving,
  savingMessage = "",
  onCancel,
  onSubmit,
  setEditingAum,
  handlePorcentajeChange,
  handleNuevoPrecioChange,
}) {
  if (!editingAum) return null;

  const busyMessage =
    savingMessage ||
    (editingAum.id ? "Actualizando aumento..." : "Guardando aumento...");

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-40">
      <form
        onSubmit={onSubmit}
        className="relative bg-white w-full max-w-xl rounded-2xl shadow-xl border p-6"
        aria-busy={saving}
      >
        {saving && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm">
            <span className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-gray-600">{busyMessage}</p>
          </div>
        )}
        <div
          className={`grid grid-cols-2 gap-4 ${saving ? "pointer-events-none select-none" : ""}`}
        >
          <h2 className="col-span-2 text-xl font-semibold">
            {editingAum.id ? "Editar aumento" : "Nuevo aumento"}
          </h2>
          {editingAum._auto && (
            <div className="col-span-2 text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2">
              Este aumento fue <b>generado autom�ticamente por API IPC</b>. Los campos est�n en solo
              lectura.
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Desde</span>
            <DateInput
              required
              isClearable={false}
              disabled={editingAum._auto || saving}
              value={editingAum.desde}
              onChange={(next) =>
                setEditingAum((state) => (state ? { ...state, desde: next } : state))
              }
              className="px-3 py-2 border rounded-xl"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Hasta</span>
            <DateInput
              required
              isClearable={false}
              disabled={editingAum._auto || saving}
              value={editingAum.hasta}
              onChange={(next) =>
                setEditingAum((state) => (state ? { ...state, hasta: next } : state))
              }
              className="px-3 py-2 border rounded-xl"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">% Aumento</span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              required
              value={editingAum.porcentaje}
              disabled={editingAum._auto || saving}
              onChange={handlePorcentajeChange}
              className="px-3 py-2 border rounded-xl"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Nuevo precio (ARS)</span>
            <input
              type="number"
              min={0}
              required
              value={editingAum.nuevoPrecio}
              disabled={editingAum._auto || saving}
              onChange={handleNuevoPrecioChange}
              readOnly={!!editingAum._lockPrecio}
              className={`px-3 py-2 border rounded-xl ${
                editingAum._lockPrecio ? "bg-gray-50" : ""
              }`}
              title={editingAum._lockPrecio ? "Calculado a partir del porcentaje" : ""}
            />
            <span className="text-xs text-gray-500">
              Precio base: {fmtMoney(editingAum.basePrecio || 0)}
            </span>
          </label>
          <label className="flex flex-col gap-1 col-span-2">
            <span className="text-sm text-gray-600">Nota</span>
            <textarea
              value={editingAum.nota}
              disabled={editingAum._auto || saving}
              onChange={(e) => setEditingAum((s) => ({ ...s, nota: e.target.value }))}
              className="px-3 py-2 border rounded-xl min-h-[80px]"
            />
          </label>
          <div className="col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.md}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.primary} ${BUTTON_STYLES.md}`}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
