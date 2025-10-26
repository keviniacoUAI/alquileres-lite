import React, { useEffect, useMemo, useState } from "react";
import { fmtDateAR, toYMD } from "../utils/dates";
import { fmtMoney } from "../utils/formatters";
import { BUTTON_STYLES, PERIOD_MONTHS } from "../constants/ui";
import { DateInput } from "./DateInput";
import { MoneyInput } from "./MoneyInput";
import { resolveIncreaseStatus } from "../utils/contracts";

const TAB_LABELS = Object.freeze({
  info: "Informacion",
  increases: "Aumentos",
  payments: "Pagos",
});

const TABS_ORDER = ["info", "increases", "payments"];
const PANEL_HEIGHT = "min(640px, calc(100vh - 2rem))";

const WarningIcon = ({ className = "h-5 w-5 text-amber-500" }) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fillRule="evenodd"
      d="M8.257 3.099c.765-1.36 2.721-1.36 3.486 0l6.518 11.59c.75 1.334-.213 3.01-1.743 3.01H3.482c-1.53 0-2.493-1.676-1.744-3.01l6.519-11.59zM9 7a1 1 0 112 0v4a1 1 0 11-2 0V7zm1 8a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 15z"
      clipRule="evenodd"
    />
  </svg>
);

export default function ContractPanel({
  editing,
  mode = "edit",
  saving,
  onCancel,
  onSubmit,
  setEditing,
  setMode,
  aumentos,
  increasesSlot,
  paymentsSlot,
  lastPriceValue,
  lastPriceSince,
  currentPaymentStatus,
  currentMonthlyTotal,
  paymentsSaving = false,
  savingMessage = "",
}) {
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    setActiveTab("info");
  }, [editing?.id]);

  const canShowTabs = Boolean(editing?.id);

  const tabs = useMemo(() => {
    if (!canShowTabs) return ["info"];
    return TABS_ORDER;
  }, [canShowTabs]);

  const hasAumentosData = Array.isArray(aumentos);
  const increaseStatus = useMemo(() => {
    if (!editing || !hasAumentosData) return null;
    return resolveIncreaseStatus(editing, { lastPriceSince, aumentos });
  }, [aumentos, editing, hasAumentosData, lastPriceSince]);

  if (!editing) return null;

  const isCreate = mode === "create";
  const isView = mode === "view";
  const panelBusy = Boolean(saving || paymentsSaving);
  const busyMessage = saving
    ? savingMessage || "Guardando..."
    : paymentsSaving
      ? "Guardando pago..."
      : "Procesando...";
  const formDisabled = panelBusy || isView;
  const panelInnerClass = panelBusy
    ? "flex h-full flex-col pointer-events-none select-none"
    : "flex h-full flex-col";

  const title = isCreate
    ? "Nuevo contrato"
    : isView
      ? "Detalle del contrato"
      : "Editar contrato";

  const handleTabSelect = (nextTab) => {
    if (panelBusy) return;
    setActiveTab(nextTab);
  };

  const isActive = (tab) =>
    activeTab === tab || (!canShowTabs && tab === "info");

  const handleSubmit = (event) => {
    if (isView) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  };

  const handleStartEdit = () => {
    if (!isCreate && setMode) setMode("edit");
  };

  const paymentBadge =
    currentPaymentStatus === "paid"
      ? "text-emerald-700 bg-emerald-100 border border-emerald-200"
      : currentPaymentStatus === "partial"
        ? "text-amber-700 bg-amber-100 border border-amber-200"
        : currentPaymentStatus === "pending"
          ? "text-red-700 bg-red-100 border border-red-200"
          : "text-gray-600 bg-gray-100 border border-gray-200";

  const paymentLabel =
    {
      paid: "Cobrado",
      partial: "Parcial",
      pending: "Pendiente",
    }[currentPaymentStatus] || "Sin datos";

  const periodMonths = editing ? PERIOD_MONTHS[editing.periodicidad] || 0 : 0;
  const hasUpcomingIncrease = Boolean(increaseStatus?.hasUpcomingIncrease);
  const hasCurrentIncrease = Boolean(increaseStatus?.hasCurrentIncrease);
  const hasStarted = Boolean(increaseStatus?.hasStarted);
  const hasPendingNextIncrease = Boolean(increaseStatus?.hasPendingNextIncrease);
  const isOverdue = Boolean(increaseStatus?.isOverdue);
  const isMonthlyPending =
    hasStarted && hasPendingNextIncrease && periodMonths <= 1;
  const isFinalMonth = Boolean(
    increaseStatus?.isLastMonth && periodMonths > 1,
  );
  const showIncreaseAlert =
    increaseStatus && hasPendingNextIncrease && (isOverdue || isFinalMonth || isMonthlyPending);

  const nextIncreaseLabel = increaseStatus?.nextIncreaseDate
    ? fmtDateAR(toYMD(increaseStatus.nextIncreaseDate))
    : "";

  const alertTone = isOverdue || isMonthlyPending
    ? {
        container: "border-red-200 bg-red-50 text-red-800",
        icon: "text-red-500",
        subtitle: "text-red-700",
      }
    : {
        container: "border-amber-200 bg-amber-50 text-amber-800",
        icon: "text-amber-500",
        subtitle: "text-amber-700",
      };

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-black/30 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center p-4 md:items-center">
        <div
          className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border overflow-hidden flex h-full flex-col relative"
          style={{ height: PANEL_HEIGHT }}
          aria-busy={panelBusy}
        >
          {panelBusy && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm"
              role="status"
              aria-live="polite"
            >
              <span className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-gray-600">{busyMessage}</p>
            </div>
          )}
          <div className={panelInnerClass}>
            <header className="px-6 py-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{title}</h2>
                {editing.id && (
                  <p className="text-sm text-gray-500 break-all">
                    ID: {editing.id}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isCreate && isView && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.primary} ${BUTTON_STYLES.sm}`}
                    disabled={panelBusy}
                  >
                    Editar
                  </button>
                )}
                <button
                  onClick={onCancel}
                  className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.sm}`}
                  disabled={panelBusy}
                >
                  Cerrar
                </button>
              </div>
            </header>

            <nav className="px-6 pt-4">
              <div className="flex gap-3 border-b">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleTabSelect(tab)}
                    disabled={panelBusy}
                    className={`px-3 pb-3 text-sm font-medium transition ${
                      isActive(tab)
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                    } ${panelBusy ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>
            </nav>

            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-6 space-y-6">
                {isActive("info") && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm text-gray-600">Domicilio</span>
                      <input
                        required
                        disabled={formDisabled}
                        value={editing.domicilio}
                        onChange={(e) =>
                          setEditing((s) => ({
                            ...s,
                            domicilio: e.target.value,
                          }))
                        }
                        className="px-3 py-2 border rounded-xl"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm text-gray-600">Inquilino</span>
                      <input
                        required
                        disabled={formDisabled}
                        value={editing.inquilino}
                        onChange={(e) =>
                          setEditing((s) => ({
                            ...s,
                            inquilino: e.target.value,
                          }))
                        }
                        className="px-3 py-2 border rounded-xl"
                      />
                    </label>
                    <label className="flex flex-col gap-1 md:col-span-2">
                      <span className="text-sm text-gray-600">Contacto</span>
                      <input
                        disabled={formDisabled}
                        value={editing.contacto}
                        onChange={(e) =>
                          setEditing((s) => ({
                            ...s,
                            contacto: e.target.value,
                          }))
                        }
                        className="px-3 py-2 border rounded-xl"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Datos del contrato
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">Inicio</span>
                        <DateInput
                          required
                          isClearable={false}
                          disabled={formDisabled}
                          value={editing.inicio}
                          onChange={(next) =>
                            setEditing((s) => ({
                              ...s,
                              inicio: next,
                            }))
                          }
                          className="px-3 py-2 border rounded-xl"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">Fin</span>
                        <DateInput
                          disabled={formDisabled}
                          value={editing.fin}
                          onChange={(next) =>
                            setEditing((s) => ({
                              ...s,
                              fin: next,
                            }))
                          }
                          className="px-3 py-2 border rounded-xl"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">
                          Precio inicial (ARS)
                        </span>
                        <MoneyInput
                          required
                          disabled={formDisabled}
                          value={editing.precioMensual}
                          onChange={(nextDigits) =>
                            setEditing((s) => ({
                              ...s,
                              precioMensual: nextDigits,
                            }))
                          }
                          className="px-3 py-2 border rounded-xl"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">
                          Tipo de aumento
                        </span>
                        <select
                          disabled={formDisabled}
                          value={editing.aumento}
                          onChange={(e) =>
                            setEditing((s) => ({
                              ...s,
                              aumento: e.target.value,
                            }))
                          }
                          className="px-3 py-2 border rounded-xl"
                        >
                          <option>IPC</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">
                          Periodicidad
                        </span>
                        <select
                          disabled={formDisabled}
                          value={editing.periodicidad}
                          onChange={(e) =>
                            setEditing((s) => ({
                              ...s,
                              periodicidad: e.target.value,
                            }))
                          }
                          className="px-3 py-2 border rounded-xl"
                        >
                          <option value="M">Mensual</option>
                          <option value="B">Bimestral</option>
                          <option value="T">Trimestral</option>
                          <option value="Q">Cuatrimestral</option>
                          <option value="S">Semestral</option>
                        </select>
                      </label>
                    </div>
                    {showIncreaseAlert && (
                      <div
                        className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${alertTone.container}`}
                      >
                        <WarningIcon className={`h-5 w-5 shrink-0 ${alertTone.icon}`} />
                        <div className="space-y-1">
                          <p className="font-semibold">
                            {isOverdue
                              ? "Aumento vencido"
                              : isMonthlyPending
                                ? "Aumento pendiente"
                                : "Ultimo mes sin aumento"}
                          </p>
                          <p className={`text-xs ${alertTone.subtitle}`}>
                            {isOverdue
                              ? nextIncreaseLabel
                                ? `El siguiente mes ya deberia cobrarse con aumento (desde ${nextIncreaseLabel}). Genera el ajuste para actualizar los importes.`
                                : "El siguiente mes ya deberia cobrarse con aumento. Genera el ajuste para actualizar los importes."
                              : isMonthlyPending
                                ? nextIncreaseLabel
                                  ? `Genera el aumento para cobrar desde ${nextIncreaseLabel}.`
                                  : "Genera el aumento para el proximo mes para mantener el cronograma."
                                : nextIncreaseLabel
                                  ? `Este es el ultimo mes antes del proximo aumento. Calcula el ajuste para cobrar desde ${nextIncreaseLabel}.`
                                  : "Este es el ultimo mes antes del proximo aumento. Calcula el ajuste para el siguiente mes."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {editing.id && (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Precios
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="flex flex-col gap-1">
                          <span className="text-sm text-gray-600">
                            Precio vigente (mes actual)
                          </span>
                          <input
                            readOnly
                            value={
                              currentMonthlyTotal != null
                                ? fmtMoney(currentMonthlyTotal)
                                : "-"
                            }
                            className="px-3 py-2 border rounded-xl bg-white text-gray-700 font-semibold"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-sm text-gray-600">
                            Último precio calculado
                          </span>
                          <input
                            readOnly
                            value={
                              lastPriceValue != null
                                ? fmtMoney(lastPriceValue)
                                : "-"
                            }
                            className="px-3 py-2 border rounded-xl bg-white text-gray-700"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-sm text-gray-600">
                            Ultimo precio desde
                          </span>
                          <input
                            readOnly
                            value={
                              lastPriceSince ? fmtDateAR(lastPriceSince) : "-"
                            }
                            className="px-3 py-2 border rounded-xl bg-white text-gray-700"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-gray-600">Notas</span>
                    <textarea
                      disabled={formDisabled}
                      value={editing.notas}
                      onChange={(e) =>
                        setEditing((s) => ({ ...s, notas: e.target.value }))
                      }
                      className="px-3 py-2 border rounded-xl min-h-[80px]"
                    />
                  </label>

                  {!isView && (
                    <div className="flex justify-end gap-2 border-t pt-4 mt-2">
                      <button
                        type="button"
                        onClick={onCancel}
                        disabled={panelBusy}
                        className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.md}`}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={panelBusy}
                        className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.primary} ${BUTTON_STYLES.md}`}
                      >
                        {panelBusy
                          ? saving
                            ? "Guardando..."
                            : "Procesando..."
                          : "Guardar"}
                      </button>
                    </div>
                  )}
                </form>
              )}

              {canShowTabs && isActive("increases") && (
                <div className="pr-1">
                  {increasesSlot || (
                    <p className="text-sm text-gray-500">
                      Selecciona un contrato con aumentos cargados para ver el
                      detalle.
                    </p>
                  )}
                </div>
              )}

              {canShowTabs && isActive("payments") && (
                <div className="pr-1">
                  {paymentsSlot || (
                    <p className="text-sm text-gray-500">
                      Selecciona un contrato con pagos cargados para ver el
                      detalle.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
