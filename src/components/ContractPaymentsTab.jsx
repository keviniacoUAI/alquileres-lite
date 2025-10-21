import React, { useEffect, useMemo, useState } from "react";
import { fmtMoney } from "../utils/formatters";
import { fmtDateAR, monthLabelES, toYMD } from "../utils/dates";
import { BUTTON_STYLES } from "../constants/ui";

const PAYMENT_METHODS = ["Transferencia", "Efectivo", "Deposito", "Mercado Pago"];

const toMonthKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const STATUS_COPY = {
  paid: { label: "Pagado", tone: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  partial: { label: "Parcial", tone: "bg-amber-100 text-amber-700 border border-amber-200" },
  pending: { label: "Pendiente", tone: "bg-slate-100 text-slate-600 border border-slate-200" },
  overdue: { label: "Vencido", tone: "bg-red-100 text-red-700 border border-red-200" },
};

const classifyStatus = (month) => {
  if (!month) return STATUS_COPY.pending;
  if (month.saldo <= 0) return STATUS_COPY.paid;
  const due = month.vencimiento ? new Date(month.vencimiento) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due && due < today) return STATUS_COPY.overdue;
  if (month.pagado > 0) return STATUS_COPY.partial;
  return STATUS_COPY.pending;
};

function PaymentForm({
  contrato,
  editingPago,
  saving,
  onCancel,
  onSubmit,
  resolveMonthlyTotal,
  readOnly = false,
}) {
  const [form, setForm] = useState(() => ({
    periodo: editingPago?.periodo || toMonthKey(new Date()),
    fechaPago: editingPago?.fechaPago || toYMD(new Date()),
    monto: editingPago?.monto ?? "",
    metodo: editingPago?.metodo || PAYMENT_METHODS[0],
    nota: editingPago?.nota || "",
  }));

  useEffect(() => {
    if (!editingPago) return;
    setForm({
      periodo: editingPago.periodo || toMonthKey(new Date()),
      fechaPago: editingPago.fechaPago || toYMD(new Date()),
      monto: editingPago.monto ?? "",
      metodo: editingPago.metodo || PAYMENT_METHODS[0],
      nota: editingPago.nota || "",
    });
  }, [editingPago]);

  const formDisabled = saving || readOnly;

  const handleChange = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!editingPago || readOnly) return;
    onSubmit({
      ...form,
      monto: Number(form.monto || 0),
    });
  };

  const handleResetMonto = () => {
    if (!contrato || readOnly) return;
    const total = resolveMonthlyTotal(contrato, form.periodo);
    setForm((prev) => ({ ...prev, monto: total }));
  };

  if (readOnly) {
    return (
      <div className="border border-dashed border-slate-300 rounded-2xl p-5 bg-slate-50 text-sm text-slate-600">
        Activa el modo edicion para registrar o modificar pagos.
      </div>
    );
  }

  if (!editingPago) {
    return (
      <div className="border border-dashed border-slate-300 rounded-2xl p-5 bg-slate-50 text-sm text-slate-600">
        Selecciona "Registrar pago" en un mes para cargar un movimiento parcial o completo.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-2xl p-5 space-y-4 shadow-sm bg-white">
      <header>
        <h3 className="text-base font-semibold text-slate-800">
          {editingPago.id ? "Editar pago" : "Registrar pago"}
        </h3>
        <p className="text-xs text-slate-500">
          Contrato: <span className="font-medium">{contrato?.domicilio || "-"}</span>
        </p>
      </header>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        Mes de referencia
        <input
          type="month"
          required
          value={form.periodo}
          onChange={handleChange("periodo")}
          disabled={formDisabled}
          className="px-3 py-2 border rounded-xl text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        Fecha de pago
        <input
          type="date"
          required
          value={form.fechaPago}
          onChange={handleChange("fechaPago")}
          disabled={formDisabled}
          className="px-3 py-2 border rounded-xl text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        Monto abonado
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            required
            value={form.monto}
            onChange={handleChange("monto")}
            disabled={formDisabled}
            className="flex-1 px-3 py-2 border rounded-xl text-sm"
          />
          <button
            type="button"
            onClick={handleResetMonto}
            disabled={formDisabled}
            className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.sm}`}
          >
            Usar total
          </button>
        </div>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        Metodo
        <select
          value={form.metodo}
          onChange={handleChange("metodo")}
          disabled={formDisabled}
          className="px-3 py-2 border rounded-xl text-sm"
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        Nota (opcional)
        <textarea
          value={form.nota}
          onChange={handleChange("nota")}
          disabled={formDisabled}
          className="px-3 py-2 border rounded-xl text-sm min-h-[80px]"
        />
      </label>

      <footer className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.sm}`}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={formDisabled}
          className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.primary} ${BUTTON_STYLES.sm}`}
        >
          {saving ? "Guardando..." : "Guardar pago"}
        </button>
      </footer>
    </form>
  );
}export default function ContractPaymentsTab({
  contrato,
  payments,
  loading,
  error,
  onReload,
  onStartNewPago,
  onEditPago,
  onCancelPago,
  onSavePago,
  onDeletePago,
  editingPago,
  savingPago,
  resolveMonthlyTotal,
  paymentDueDate,
  readOnly = false,
}) {
  const [expandedPeriodo, setExpandedPeriodo] = useState(null);
  const canEdit = !readOnly;

  const currentPeriodo = useMemo(() => toMonthKey(new Date()), []);

  const months = useMemo(() => {
    if (!contrato) return [];
    if (payments?.months?.length) return payments.months;
    const periodo = currentPeriodo;
    const total = resolveMonthlyTotal(contrato, periodo);
    return [
      {
        contratoId: contrato.id,
        periodo,
        total,
        pagado: 0,
        saldo: total,
        vencimiento: paymentDueDate(periodo),
        pagos: [],
      },
    ];
  }, [contrato, payments, currentPeriodo, resolveMonthlyTotal, paymentDueDate]);

  const summary = useMemo(() => {
    if (!months.length) return null;
    return months.find((m) => m.periodo === currentPeriodo) || months[months.length - 1];
  }, [months, currentPeriodo]);

  useEffect(() => {
    if (!summary) return;
    setExpandedPeriodo(summary.periodo);
  }, [summary]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl">
        Cargando pagos...
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

  return (
    <div className="space-y-6">
      {summary && (
        <section className="border rounded-2xl bg-white shadow-sm p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Estado del mes {monthLabelES(summary.periodo)}
              </h3>
              <p className="text-xs text-slate-500">
                Vencimiento ajustado:{" "}
                <span className="font-medium">{fmtDateAR(summary.vencimiento)}</span>
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
                onClick={() => canEdit && onStartNewPago(summary.periodo)}
                disabled={!canEdit}
                className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.primary} ${BUTTON_STYLES.sm}`}
              >
                Registrar pago
              </button>
            </div>
          </div>

          <dl className="mt-4 grid gap-4 sm:grid-cols-4 text-sm">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500 uppercase tracking-wide">Total del mes</dt>
              <dd className="text-base font-semibold text-slate-700">{fmtMoney(summary.total)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500 uppercase tracking-wide">Pagado</dt>
              <dd className="text-base font-semibold text-emerald-600">
                {fmtMoney(summary.pagado)}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500 uppercase tracking-wide">Saldo</dt>
              <dd className="text-base font-semibold text-red-600">
                {fmtMoney(Math.max(summary.saldo, 0))}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500 uppercase tracking-wide">Estado</dt>
              <dd>
                <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${classifyStatus(summary).tone}`}>
                  {classifyStatus(summary).label}
                </span>
              </dd>
            </div>
          </dl>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-3">
          {months.map((month) => {
            const status = classifyStatus(month);
            const expanded = expandedPeriodo === month.periodo;
            const progress = month.total > 0 ? Math.min(100, (month.pagado / month.total) * 100) : 0;

            return (
              <article key={month.periodo} className="border rounded-2xl bg-white shadow-sm">
                <header className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">
                      {monthLabelES(month.periodo)}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Vence {fmtDateAR(month.vencimiento)} · {fmtMoney(month.total)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${status.tone}`}>
                      {status.label}
                    </span>
                    <button
                      onClick={() => setExpandedPeriodo(expanded ? null : month.periodo)}
                      className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.xs}`}
                    >
                      {expanded ? "Ocultar" : "Ver detalle"}
                    </button>
                    <button
                      onClick={() => canEdit && onStartNewPago(month.periodo)}
                      disabled={!canEdit}
                      className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.success} ${BUTTON_STYLES.xs}`}
                    >
                      Registrar
                    </button>
                  </div>
                </header>

                <div className="px-4 py-3 space-y-3">
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>Cobrado: {fmtMoney(month.pagado)}</span>
                    <span>Saldo: {fmtMoney(Math.max(month.saldo, 0))}</span>
                  </div>

                  {expanded && (
                    <div className="border-t pt-3 space-y-2">
                      {month.pagos.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Sin pagos registrados para este mes.
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-xs uppercase text-slate-400">
                            <tr>
                              <th className="text-left py-1">Fecha</th>
                              <th className="text-right py-1">Monto</th>
                              <th className="text-left py-1">Metodo</th>
                              <th className="text-left py-1">Nota</th>
                              <th className="text-right py-1">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {month.pagos.map((pago) => (
                              <tr key={pago.id} className="border-t text-slate-600">
                                <td className="py-2 text-xs">{fmtDateAR(pago.fechaPago)}</td>
                                <td className="py-2 text-right font-medium">
                                  {fmtMoney(pago.monto)}
                                </td>
                                <td className="py-2 text-xs">{pago.metodo || "-"}</td>
                                <td className="py-2 text-xs whitespace-pre-wrap">
                                  {pago.nota || "-"}
                                </td>
                                <td className="py-2 text-right text-xs">
                                  <div className="inline-flex gap-2">
                                    <button
                                      onClick={() => onEditPago(pago)}
                                      disabled={!canEdit}
                                      className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.outline} ${BUTTON_STYLES.xs}`}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => onDeletePago(pago.id)}
                                      disabled={!canEdit}
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
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <PaymentForm
          contrato={contrato}
          editingPago={editingPago}
          saving={savingPago}
          onCancel={onCancelPago}
          onSubmit={onSavePago}
          resolveMonthlyTotal={resolveMonthlyTotal}
        />
      </div>
    </div>
  );
}












