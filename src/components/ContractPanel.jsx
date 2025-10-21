import React, { useEffect, useMemo, useState } from "react";
import { fmtDateAR, toYMD } from "../utils/dates";
import { fmtMoney } from "../utils/formatters";
import { BUTTON_STYLES } from "../constants/ui";

const TAB_LABELS = Object.freeze({
  info: "Informacion",
  increases: "Aumentos",
  payments: "Pagos",
});

const TABS_ORDER = ["info", "increases", "payments"];
const PANEL_HEIGHT = "min(640px, calc(100vh - 2rem))";

export default function ContractPanel({
  editing,
  mode = "edit",
  saving,
  onCancel,
  onSubmit,
  setEditing,
  setMode,
  increasesSlot,
  paymentsSlot,
  lastPriceValue,
  lastPriceSince,
  currentPaymentStatus,
  currentMonthlyTotal,
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

  if (!editing) return null;

  const isCreate = mode === "create";
  const isView = mode === "view";
  const formDisabled = saving || isView;

  const title = isCreate
    ? "Nuevo contrato"
    : isView
      ? "Detalle del contrato"
      : "Editar contrato";

  const handleTabSelect = (nextTab) => {
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

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-black/30 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center p-4 md:items-center">
        <div
          className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border overflow-hidden flex h-full flex-col"
          style={{ height: PANEL_HEIGHT }}
        >
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
                  disabled={saving}
                >
                  Editar
                </button>
              )}
              <button
                onClick={onCancel}
                className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.sm}`}
                disabled={saving}
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
                  className={`pb-3 border-b-2 text-sm font-medium transition-colors ${
                    isActive(tab)
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  disabled={!canShowTabs && tab !== "info"}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-h-0 px-6 py-4 overflow-hidden">
            <div className="h-full overflow-y-auto pr-2">
              {isActive("info") && (
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-6 pb-10"
                  autoComplete="off"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Datos generales
                    </h3>
                    {editing.id && (
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs uppercase font-semibold ${paymentBadge}`}
                      >
                        Estado cobro: {paymentLabel}
                      </span>
                    )}
                  </div>

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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <input
                          type="date"
                          disabled={formDisabled}
                          value={toYMD(editing.inicio)}
                          onChange={(e) =>
                            setEditing((s) => ({
                              ...s,
                              inicio: e.target.value,
                            }))
                          }
                          className="px-3 py-2 border rounded-xl"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">Fin</span>
                        <input
                          type="date"
                          disabled={formDisabled}
                          value={toYMD(editing.fin)}
                          onChange={(e) =>
                            setEditing((s) => ({ ...s, fin: e.target.value }))
                          }
                          className="px-3 py-2 border rounded-xl"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-gray-600">
                          Precio inicial (ARS)
                        </span>
                        <input
                          type="number"
                          min={0}
                          required
                          disabled={formDisabled}
                          value={editing.precioMensual}
                          onChange={(e) =>
                            setEditing((s) => ({
                              ...s,
                              precioMensual: e.target.value,
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
  );
}
