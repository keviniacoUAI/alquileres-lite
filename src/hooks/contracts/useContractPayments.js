import { useCallback, useEffect, useState } from "react";
import {
  listPagos,
  createOrUpdatePago,
  deletePago as deletePagoRequest,
  fetchPaymentStatuses,
} from "../../services/api";
import { ensureNumber, toMonthKey, priceAtDate } from "../../utils/contracts";
import { paymentDueDate, toYMD } from "../../utils/dates";

export function useContractPayments({
  items,
  currentPeriod,
  aumByContrato,
  currentPrice,
  lastPrice,
  showToast,
}) {
  const [paymentsByContrato, setPaymentsByContrato] = useState({});
  const [paymentsLoading, setPaymentsLoading] = useState({});
  const [paymentsError, setPaymentsError] = useState({});
  const [paymentStatus, setPaymentStatus] = useState({});
  const [paymentSummary, setPaymentSummary] = useState({});
  const [editingPago, setEditingPago] = useState(null);
  const [savingPago, setSavingPago] = useState(false);

  const computePaymentStatus = useCallback((total, pagado, saldo) => {
    const effectiveTotal = ensureNumber(total);
    const effectivePagado = ensureNumber(pagado);
    const effectiveSaldo = ensureNumber(
      saldo != null ? saldo : Math.max(effectiveTotal - effectivePagado, 0),
    );
    if (effectiveSaldo <= 0 && effectiveTotal > 0) return "paid";
    if (effectivePagado > 0) return "partial";
    return "pending";
  }, []);

  const resolveMonthlyTotal = useCallback(
    (contrato, periodo) => {
      if (!contrato) return 0;
      const due = paymentDueDate(periodo) || toYMD(contrato.inicio);
      const aumentos = aumByContrato[contrato.id] || [];
      const price = priceAtDate(contrato, aumentos, due);
      if (price > 0) return price;
      if (periodo === currentPeriod) {
        const snapshot = currentPrice[contrato.id];
        if (snapshot != null) return ensureNumber(snapshot);
      }
      return ensureNumber(
        lastPrice[contrato.id] ?? contrato.precioMensual ?? 0,
      );
    },
    [aumByContrato, currentPeriod, currentPrice, lastPrice],
  );

  const updatePaymentStatusFor = useCallback(
    (contrato, months) => {
      if (!contrato) return;
      const match = Array.isArray(months)
        ? months.find((m) => toMonthKey(m.periodo) === currentPeriod)
        : null;

      const prev = paymentSummary[contrato.id];

      const total = ensureNumber(
        match?.total ??
          prev?.total ??
          resolveMonthlyTotal(contrato, currentPeriod),
      );
      const pagado = ensureNumber(match?.pagado ?? prev?.pagado ?? 0);
      const saldo = ensureNumber(
        match?.saldo ?? prev?.saldo ?? Math.max(total - pagado, 0),
      );

      setPaymentSummary((prevMap) => ({
        ...prevMap,
        [contrato.id]: { total, pagado, saldo },
      }));

      setPaymentStatus((prevMap) => ({
        ...prevMap,
        [contrato.id]: computePaymentStatus(total, pagado, saldo),
      }));
    },
    [computePaymentStatus, currentPeriod, paymentSummary, resolveMonthlyTotal],
  );

  const normalizePayments = useCallback(
    (contrato, rawItems) => {
      if (!contrato) return { months: [], raw: [] };
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return { months: [], raw: [] };
      }

      const monthsMap = new Map();

      const getMonthBucket = (periodo) => {
        if (!monthsMap.has(periodo)) {
          monthsMap.set(periodo, {
            contratoId: contrato.id,
            periodo,
            total: resolveMonthlyTotal(contrato, periodo),
            vencimiento: paymentDueDate(periodo),
            pagos: [],
          });
        }
        return monthsMap.get(periodo);
      };

      const pushPartial = (periodo, source) => {
        const bucket = getMonthBucket(periodo);
        bucket.pagos.push({
          id: source.id || `${periodo}-${bucket.pagos.length + 1}`,
          contratoId: source.contratoId || contrato.id,
          periodo,
          fechaPago: toYMD(
            source.fechaPago || source.fecha || source.createdAt || new Date(),
          ),
          monto: ensureNumber(
            source.monto ?? source.importe ?? source.total ?? 0,
          ),
          metodo: source.metodo || source.metodoPago || "",
          nota: source.nota || source.detalle || "",
          origen: source,
        });
      };

      rawItems.forEach((entry) => {
        if (entry?.pagos && Array.isArray(entry.pagos)) {
          const periodo = toMonthKey(
            entry.periodo || entry.mes || entry.period,
          );
          if (!periodo) return;
          const bucket = getMonthBucket(periodo);
          bucket.total = ensureNumber(
            entry.total ?? entry.montoTotal ?? bucket.total,
          );
          bucket.vencimiento = entry.vencimiento
            ? toYMD(entry.vencimiento)
            : bucket.vencimiento;
          entry.pagos.forEach((p) => pushPartial(periodo, p));
        } else {
          const periodo = toMonthKey(
            entry.periodo || entry.mes || entry.fechaPago || entry.fecha,
          );
          if (!periodo) return;
          const bucket = getMonthBucket(periodo);
          const maybeTotal = ensureNumber(entry.total ?? entry.montoTotal);
          if (maybeTotal > 0) bucket.total = maybeTotal;
          if (entry.vencimiento) bucket.vencimiento = toYMD(entry.vencimiento);
          pushPartial(periodo, entry);
        }
      });

      const months = Array.from(monthsMap.values()).map((month) => {
        const pagado = month.pagos.reduce(
          (acc, cur) => acc + ensureNumber(cur.monto),
          0,
        );
        const total = ensureNumber(month.total);
        return {
          ...month,
          total,
          pagado,
          saldo: Number(Math.max(0, total - pagado).toFixed(2)),
        };
      });

      months.sort((a, b) => a.periodo.localeCompare(b.periodo));

      return { months, raw: rawItems };
    },
    [resolveMonthlyTotal],
  );

  const loadPayments = useCallback(
    async (contrato, { force = false } = {}) => {
      if (!contrato?.id) return;
      const id = contrato.id;
      if (!force && paymentsByContrato[id]) return;
      setPaymentsLoading((state) => ({ ...state, [id]: true }));
      setPaymentsError((state) => ({ ...state, [id]: null }));
      try {
        const itemsList = await listPagos(id);
        const normalized = normalizePayments(contrato, itemsList);
        setPaymentsByContrato((state) => ({ ...state, [id]: normalized }));
        updatePaymentStatusFor(contrato, normalized.months);
      } catch (err) {
        console.error(err);
        setPaymentsError((state) => ({
          ...state,
          [id]: err?.message || "No se pudieron cargar pagos",
        }));
        if (showToast)
          showToast(err?.message || "No se pudieron cargar pagos", "error");
      } finally {
        setPaymentsLoading((state) => ({ ...state, [id]: false }));
      }
    },
    [normalizePayments, paymentsByContrato, showToast, updatePaymentStatusFor],
  );

  const startNewPago = useCallback(
    (contrato, periodo) => {
      if (!contrato?.id) return;
      const targetPeriodo = toMonthKey(periodo) || toMonthKey(new Date());
      const total = resolveMonthlyTotal(contrato, targetPeriodo);
      setEditingPago({
        id: "",
        contratoId: contrato.id,
        periodo: targetPeriodo,
        fechaPago: toYMD(new Date()),
        monto: total,
        metodo: "Transferencia",
        nota: "",
      });
    },
    [resolveMonthlyTotal],
  );

  const startEditPago = useCallback((contrato, pago) => {
    if (!contrato?.id || !pago) return;
    setEditingPago({
      id: pago.id,
      contratoId: contrato.id,
      periodo: toMonthKey(pago.periodo),
      fechaPago: toYMD(pago.fechaPago || new Date()),
      monto: ensureNumber(pago.monto),
      metodo: pago.metodo || "",
      nota: pago.nota || "",
      origen: pago,
    });
  }, []);

  const cancelPago = useCallback(() => {
    setEditingPago(null);
  }, []);

  const savePago = useCallback(
    async (override) => {
      if (!editingPago) return;
      const payload = {
        ...editingPago,
        ...override,
        periodo: toMonthKey(override?.periodo || editingPago.periodo),
        fechaPago: toYMD(override?.fechaPago || editingPago.fechaPago),
        monto: ensureNumber(override?.monto ?? editingPago.monto),
      };

      if (!payload.contratoId) return;

      try {
        setSavingPago(true);
        await createOrUpdatePago({
          ...payload,
          monto: payload.monto,
        });
        const contrato = items.find((c) => c.id === payload.contratoId);
        if (contrato) {
          await loadPayments(contrato, { force: true });
        }
        setEditingPago(null);
        if (showToast) showToast("Pago guardado", "success");
      } catch (err) {
        console.error(err);
        if (showToast)
          showToast(err?.message || "Error guardando pago", "error");
      } finally {
        setSavingPago(false);
      }
    },
    [editingPago, items, loadPayments, showToast],
  );

  const onDeletePago = useCallback(
    async (contratoId, pagoId) => {
      if (!contratoId || !pagoId) return;
      const ok = confirm("Eliminar este pago?");
      if (!ok) return;

      try {
        setSavingPago(true);
        await deletePagoRequest(pagoId);
        const contrato = items.find((c) => c.id === contratoId);
        if (contrato) {
          await loadPayments(contrato, { force: true });
        }
        if (showToast) showToast("Pago eliminado", "success");
      } catch (err) {
        console.error(err);
        if (showToast)
          showToast(err?.message || "Error eliminando pago", "error");
      } finally {
        setSavingPago(false);
      }
    },
    [items, loadPayments, showToast],
  );

  useEffect(() => {
    if (!items.length) {
      setPaymentStatus({});
      setPaymentSummary({});
      return;
    }

    const ids = items.map((contrato) => contrato.id).filter(Boolean);
    if (!ids.length) {
      setPaymentStatus({});
      setPaymentSummary({});
      return;
    }

    let cancelled = false;

    const loadingMap = {};
    ids.forEach((id) => {
      loadingMap[id] = "loading";
    });
    setPaymentStatus(loadingMap);

    (async () => {
      try {
        const { items: summaries = {} } = await fetchPaymentStatuses(
          ids,
          currentPeriod,
        );
        if (cancelled) return;

        const nextSummary = {};
        const nextStatus = {};

        ids.forEach((id) => {
          const summary = summaries?.[id];
          if (summary) {
            const total = ensureNumber(summary.total);
            const pagado = ensureNumber(summary.pagado);
            const saldo = ensureNumber(
              summary.saldo != null
                ? summary.saldo
                : Math.max(total - pagado, 0),
            );
            nextSummary[id] = { total, pagado, saldo };
            nextStatus[id] =
              summary.status || computePaymentStatus(total, pagado, saldo);
          } else {
            nextSummary[id] = { total: 0, pagado: 0, saldo: 0 };
            nextStatus[id] = "unknown";
          }
        });

        setPaymentSummary(nextSummary);
        setPaymentStatus(nextStatus);
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        const fallback = {};
        ids.forEach((id) => {
          fallback[id] = "unknown";
        });
        setPaymentStatus(fallback);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [computePaymentStatus, currentPeriod, items]);

  return {
    paymentsByContrato,
    paymentsLoading,
    paymentsError,
    paymentStatus,
    paymentSummary,
    editingPago,
    savingPago,
    setEditingPago,
    loadPayments,
    startNewPago,
    startEditPago,
    cancelPago,
    savePago,
    onDeletePago,
    resolveMonthlyTotal,
    paymentDueDate,
  };
}
