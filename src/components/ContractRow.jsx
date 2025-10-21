import React from "react";
import { contractStatus, fmtDateAR } from "../utils/dates";
import { fmtMoney } from "../utils/formatters";
import { BUTTON_STYLES, PERIOD_LABELS } from "../constants/ui";

const PAYMENT_STATUS_META = Object.freeze({
  paid: {
    label: "Cobrado",
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500",
  },
  partial: {
    label: "Parcial",
    badge: "bg-amber-100 text-amber-700 border border-amber-200",
    dot: "bg-amber-500",
  },
  pending: {
    label: "Pendiente",
    badge: "bg-slate-100 text-slate-600 border border-slate-200",
    dot: "bg-slate-400",
  },
  loading: {
    label: "Calculando...",
    badge: "bg-gray-50 text-gray-500 border border-dashed border-gray-200",
    dot: "bg-gray-300",
  },
  unknown: {
    label: "Sin datos",
    badge: "bg-gray-50 text-gray-500 border border-gray-200",
    dot: "bg-gray-300",
  },
});

export default function ContractRow({
  r,
  startEdit,
  onDelete,
  saving,
  paymentStatus,
  currentPrice,
  openMenuId,
  setOpenMenuId,
  menuRef,
  onView,
}) {
  const isMenuOpen = openMenuId === r.id;
  const status = contractStatus(r);
  const rowBg =
    status === "expired"
      ? "bg-red-50 border-l-4 border-l-red-200"
      : status === "soon"
      ? "bg-yellow-50 border-l-4 border-l-yellow-200"
      : "";

  const paymentMeta = PAYMENT_STATUS_META[paymentStatus] || PAYMENT_STATUS_META.unknown;

  return (
    <tr
      className={`border-t ${rowBg} cursor-pointer`}
      onDoubleClick={() => onView && onView(r)}
      title="Doble clic para ver detalles"
    >
      <td className="p-2 truncate">{r.domicilio}</td>
      <td className="p-2 truncate">{r.inquilino}</td>
      <td className="p-2">{fmtDateAR(r.inicio) || "-"}</td>
      <td className="p-2">{fmtDateAR(r.fin) || "-"}</td>
      <td className="p-2 text-right font-medium">{fmtMoney(r.precioMensual)}</td>
      <td className="p-2 text-right font-semibold">{fmtMoney(currentPrice ?? 0)}</td>
      <td className="p-2">{r.aumento || "-"}</td>
      <td className="p-2">{PERIOD_LABELS[r.periodicidad] || "-"}</td>
      <td className="p-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${paymentMeta.badge}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${paymentMeta.dot}`} />
          {paymentMeta.label}
        </span>
      </td>
      <td className="p-3 pr-4 text-right min-w-[120px] whitespace-nowrap align-middle">
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(isMenuOpen ? null : r.id);
            }}
            className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.xs}`}
            title="Más acciones"
          >
            Más
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
                disabled={saving}
                className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-red-600"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
