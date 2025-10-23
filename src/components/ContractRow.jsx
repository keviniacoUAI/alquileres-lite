import React from "react";
import { contractStatus, fmtDateAR, toYMD } from "../utils/dates";
import { fmtMoney } from "../utils/formatters";
import { BUTTON_STYLES, PERIOD_LABELS, PERIOD_MONTHS } from "../constants/ui";
import { resolveIncreaseStatus } from "../utils/contracts";

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
  priceEffectiveSince,
  aumentos,
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
  const periodMonths = PERIOD_MONTHS[r.periodicidad] || 0;
  const isMonthlyPeriod = periodMonths <= 1;
  const previewStatus = resolveIncreaseStatus(r, {
    lastPriceSince: priceEffectiveSince,
  });
  const previewHasStarted = Boolean(previewStatus?.hasStarted);
  const needsIncreaseCheck =
    previewHasStarted &&
    (previewStatus.isLastMonth || previewStatus.isOverdue || isMonthlyPeriod);

  const hasAumentosData = Array.isArray(aumentos);
  const increaseStatus = hasAumentosData
    ? resolveIncreaseStatus(r, {
        lastPriceSince: priceEffectiveSince,
        aumentos,
      })
    : null;
  const nextIncreaseLabel = increaseStatus?.nextIncreaseDate
    ? fmtDateAR(toYMD(increaseStatus.nextIncreaseDate))
    : null;
  const hasStarted = Boolean(increaseStatus?.hasStarted);
  const hasPendingNextIncrease = Boolean(increaseStatus?.hasPendingNextIncrease);

  let increaseDisplay = "-";
  if (!hasAumentosData && needsIncreaseCheck) {
    increaseDisplay = "...";
  } else if (increaseStatus) {
    const {
      hasUpcomingIncrease,
      hasCurrentIncrease,
      hasPendingNextIncrease,
      isOverdue,
      isLastMonth,
    } = increaseStatus;

    if (!hasStarted) {
      increaseDisplay = nextIncreaseLabel || "-";
    } else if (hasUpcomingIncrease && !hasPendingNextIncrease) {
      const labelText = nextIncreaseLabel
        ? `Programado ${nextIncreaseLabel}`
        : "Aumento programado";
      increaseDisplay = (
        <span
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700"
          title={
            nextIncreaseLabel
              ? `Proximo aumento programado desde ${nextIncreaseLabel}`
              : "Existe un aumento programado para el proximo periodo"
          }
        >
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          {labelText}
        </span>
      );
    } else if (isOverdue || (isMonthlyPeriod && hasStarted && hasPendingNextIncrease)) {
      increaseDisplay = (
        <span
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-red-200 bg-red-50 text-red-700"
          title={
            nextIncreaseLabel
              ? `El aumento deberia aplicarse desde ${nextIncreaseLabel}`
              : "El aumento deberia aplicarse desde el proximo periodo"
          }
        >
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Pendiente
        </span>
      );
    } else if (isLastMonth && !isMonthlyPeriod && hasPendingNextIncrease) {
      increaseDisplay = (
        <span
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700"
          title={
            nextIncreaseLabel
              ? `Calcular aumento para cobrar desde ${nextIncreaseLabel}`
              : "Calcular el proximo aumento para el siguiente periodo"
          }
        >
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Ultimo mes
        </span>
      );
    } else {
      const okTitle = nextIncreaseLabel
        ? `Proximo aumento estimado: ${nextIncreaseLabel}`
        : "Sin acciones pendientes";
      increaseDisplay = (
        <span
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"
          title={okTitle}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Ok
        </span>
      );
    }
  }
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
      <td className="p-2">{increaseDisplay}</td>
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
