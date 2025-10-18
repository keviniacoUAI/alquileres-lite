import React from "react";
import { contractStatus, fmtDateAR } from "../utils/dates";
import { fmtMoney, fmtPctFromRow } from "../utils/formatters";
import { BUTTON_STYLES, PERIOD_LABELS } from "../constants/ui";

export default function ContractRow({
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
  lastPrice,
  deletingAumId,
  openMenuId,
  setOpenMenuId,
  menuRef,
  aumLoadingList,
  aumCalculating,
  aumError,
  onCalcProximoAumento,
}) {
  const isMenuOpen = openMenuId === r.id;
  const status = contractStatus(r);
  const rowBg =
    status === "expired"
      ? "bg-red-50 border-l-4 border-l-red-200"
      : status === "soon"
      ? "bg-yellow-50 border-l-4 border-l-yellow-200"
      : "";

  return (
    <>
      <tr className={`border-t ${rowBg}`}>
        <td className="p-2 truncate">{r.domicilio}</td>
        <td className="p-2 truncate">{r.inquilino}</td>
        <td className="p-2 truncate">{r.contacto || "-"}</td>
        <td className="p-2">{fmtDateAR(r.inicio) || "-"}</td>
        <td className="p-2">{fmtDateAR(r.fin) || "-"}</td>
        <td className="p-2 text-right font-medium">{fmtMoney(r.precioMensual)}</td>
        <td className="p-2 text-right font-medium">{fmtMoney(lastPrice[r.id] ?? r.precioMensual)}</td>
        <td className="p-2">{r.aumento || "-"}</td>
        <td className="p-2">{PERIOD_LABELS[r.periodicidad] || "-"}</td>
        <td className="p-3 pr-4 text-right min-w-[180px] whitespace-nowrap align-middle">
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => toggleExpand(r)}
              className={[
                BUTTON_STYLES.base,
                aumLoadingList[r.id] ? BUTTON_STYLES.primary : BUTTON_STYLES.outlineBlue,
                BUTTON_STYLES.xs,
              ].join(" ")}
              title="Ver aumentos"
            >
              {expandedId === r.id ? "Aumentos ^" : "Aumentos v"}
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(isMenuOpen ? null : r.id);
                }}
                className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.xs}`}
                title="Mas acciones"
              >
                Mas
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
                  className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outlineBlue} ${BUTTON_STYLES.sm}`}
                  title="Calcula el aumento segun IPC del periodo proximo"
                >
                  {aumCalculating[r.id] ? "Calculando..." : "Calcular proximo aumento"}
                </button>
                <button
                  onClick={() => startNewAum(r)}
                  className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.success} ${BUTTON_STYLES.sm}`}
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
                        Aguarde, recuperando aumentos.
                      </td>
                    </tr>
                  ) : aumError[r.id] ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-red-600">
                        {aumError[r.id]}
                      </td>
                    </tr>
                  ) : !aum || aum.length === 0 ? (
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
                              className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.xs}`}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => onDeleteAum(a)}
                              disabled={saving || deletingAumId === a.id}
                              className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.dangerOutline} ${BUTTON_STYLES.xs}`}
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
