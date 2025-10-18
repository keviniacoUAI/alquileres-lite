import React from "react";
import { toYMD } from "../utils/dates";
import { BUTTON_STYLES } from "../constants/ui";

export default function ContractModal({
  editing,
  saving,
  onCancel,
  onSubmit,
  setEditing
}) {
  if (!editing) return null;
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border p-6 grid grid-cols-2 gap-4">
        <h2 className="col-span-2 text-xl font-semibold">
          {editing.id ? "Editar" : "Nuevo"} contrato
        </h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Domicilio</span>
          <input required disabled={saving} value={editing.domicilio}
                 onChange={e => setEditing(s => ({ ...s, domicilio: e.target.value }))}
                 className="px-3 py-2 border rounded-xl" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Inquilino</span>
          <input required disabled={saving} value={editing.inquilino}
                 onChange={e => setEditing(s => ({ ...s, inquilino: e.target.value }))}
                 className="px-3 py-2 border rounded-xl" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Contacto</span>
          <input disabled={saving} value={editing.contacto}
                 onChange={e => setEditing(s => ({ ...s, contacto: e.target.value }))}
                 className="px-3 py-2 border rounded-xl" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Inicio</span>
          <input type="date" disabled={saving} value={toYMD(editing.inicio)}
                 onChange={e => setEditing(s => ({ ...s, inicio: e.target.value }))}
                 className="px-3 py-2 border rounded-xl" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Fin</span>
          <input type="date" disabled={saving} value={toYMD(editing.fin)}
                 onChange={e => setEditing(s => ({ ...s, fin: e.target.value }))}
                 className="px-3 py-2 border rounded-xl" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Precio mensual (ARS)</span>
          <input type="number" min={0} required disabled={saving} value={editing.precioMensual}
                 onChange={e => setEditing(s => ({ ...s, precioMensual: e.target.value }))}
                 className="px-3 py-2 border rounded-xl" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Aumento</span>
          <select disabled={saving} value={editing.aumento}
                  onChange={e => setEditing(s => ({ ...s, aumento: e.target.value }))}
                  className="px-3 py-2 border rounded-xl">
            <option>IPC</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Periodicidad</span>
          <select disabled={saving} value={editing.periodicidad}
                  onChange={e => setEditing(s => ({ ...s, periodicidad: e.target.value }))}
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
                    onChange={e => setEditing(s => ({ ...s, notas: e.target.value }))}
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
