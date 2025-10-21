import React from "react";
import { fmtDateAR, dayAfter } from "../utils/dates";
import { fmtMoney, fmtPctFromRow } from "../utils/formatters";
import { BUTTON_STYLES } from "../constants/ui";

export default function ContractIncreasesTab({
  contrato,
  aumentos,
  loading,
  error,
  calculando,
  deletingId,
  saving,
  onReload,
  onCalcular,
  onNuevo,
  onEdit,
  onDelete,
  readOnly = false,
}) {
  const canEdit = !readOnly;
  if (!contrato) {
    return (
      <div className="border border-dashed border-slate-300 rounded-2xl p-5 bg-slate-50 text-sm text-slate-600">
        Selecciona un contrato existente para consultar sus aumentos.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl">
        Cargando aumentos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700 space-y-3">
        <p>{error}</p>
        {onReload && (
          <button
            onClick={onReload}
            className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.xs}`}
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  const list = Array.isArray(aumentos) ? aumentos : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Aumentos registrados</h3>
          <p className="text-xs text-slate-500">
            Contrato: <span className="font-medium">{contrato.domicilio}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {onReload && (
            <button
              onClick={onReload}
              className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.xs}`}
            >
              Actualizar
            </button>
          )}
          <button
            onClick={() => canEdit && onCalcular()}
            disabled={!canEdit || calculando}
            className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outlineBlue} ${BUTTON_STYLES.sm}`}
            title="Calcula el proximo aumento en base al IPC disponible"
          >
            {calculando ? "Calculando..." : "Calcular proximo aumento"}
          </button>
          <button
            onClick={() => canEdit && onNuevo()}
            disabled={!canEdit}
            className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.success} ${BUTTON_STYLES.sm}`}
          >
            Nuevo aumento
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-sm text-slate-500 text-center">
          Aun no hay aumentos registrados para este contrato.
        </div>
      ) : (
        <div className="border rounded-2xl bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm table-auto border-collapse">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="text-left p-3">Desde</th>
                <th className="text-left p-3">Hasta</th>
                <th className="text-left p-3">Aplica desde</th>
                <th className="text-right p-3">% Aumento</th>
                <th className="text-right p-3">Nuevo precio</th>
                <th className="text-left p-3">Nota</th>
                <th className="text-right p-3 min-w-[160px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-3">{fmtDateAR(a.desde)}</td>
                  <td className="p-3">{fmtDateAR(a.hasta)}</td>
                  <td className="p-3">{fmtDateAR(dayAfter(a.hasta)) || "-"}</td>
                  <td className="p-3 text-right">{fmtPctFromRow(a)}</td>
                  <td className="p-3 text-right">{fmtMoney(a.nuevoPrecio)}</td>
                  <td className="p-3 whitespace-pre-wrap">{a.nota || "-"}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => onEdit(a)}
                        className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.xs}`}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onDelete(a)}
                        disabled={saving || deletingId === a.id}
                        className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.dangerOutline} ${BUTTON_STYLES.xs}`}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}











