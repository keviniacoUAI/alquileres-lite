import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  parseYMD,
  toYMD,
  monthSpan,
  monthLabelES,
  nextCycleStart,
  cycleEnd,
  todayISO,
  contractStatus,
  dayAfter,
  paymentDueDate,
} from "../utils/dates";
import { toNumberPct } from "../utils/formatters";
import {
  loadList,
  createOrUpdateContrato,
  deleteContrato,
  listAumentos,
  createOrUpdateAum,
  deleteAum,
  fetchIPC,
  listPagos,
  createOrUpdatePago,
  deletePago as deletePagoRequest,
  fetchPaymentStatuses,
} from "../services/api";
import { PERIOD_MONTHS } from "../constants/ui";
import { useToast } from "./useToast";

const toMonthKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = parseYMD(value);
    if (parsed) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
    }
    return "";
  }
  const date = value instanceof Date ? value : parseYMD(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const ensureNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function useContractsPage() {
  const menuRef = useRef(null);
  const { toast, showToast, hideToast } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [editing, setEditing] = useState(null);

  const [aumByContrato, setAumByContrato] = useState({});
  const [editingAum, setEditingAum] = useState(null);
  const [deletingAumId, setDeletingAumId] = useState(null);

  const [aumLoadingList, setAumLoadingList] = useState({});
  const [aumCalculating, setAumCalculating] = useState({});
  const [aumError, setAumError] = useState({});

  const [lastPrice, setLastPrice] = useState({});
  const [lastPriceSince, setLastPriceSince] = useState({});
  const [currentPrice, setCurrentPrice] = useState({});
  const [paymentsByContrato, setPaymentsByContrato] = useState({});
  const [paymentsLoading, setPaymentsLoading] = useState({});
  const [paymentsError, setPaymentsError] = useState({});
  const [editingPago, setEditingPago] = useState(null);
  const [savingPago, setSavingPago] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [saving, setSaving] = useState(false);
  const [editingMode, setEditingMode] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState({});
  const [paymentSummary, setPaymentSummary] = useState({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const currentPeriod = useMemo(() => toMonthKey(todayISO()), []);

  const computePaymentStatus = useCallback((total, pagado, saldo) => {
    const effectiveTotal = ensureNumber(total);
    const effectivePagado = ensureNumber(pagado);
    const effectiveSaldo = ensureNumber(
      saldo != null ? saldo : Math.max(effectiveTotal - effectivePagado, 0)
    );
    if (effectiveSaldo <= 0 && effectiveTotal > 0) return "paid";
    if (effectivePagado > 0) return "partial";
    return "pending";
  }, []);


  const priceAtDate = useCallback((contrato, aumentos, targetYMD) => {
    if (!contrato) return 0;
    let price = ensureNumber(contrato.precioMensual);
    const date = parseYMD(targetYMD);
    if (!date) return price;

    if (Array.isArray(aumentos) && aumentos.length) {
      const sorted = [...aumentos].sort((a, b) => {
        const da = parseYMD(a.desde);
        const db = parseYMD(b.desde);
        if (!da || !db) return 0;
        return da - db;
      });

      for (const a of sorted) {
        const d = parseYMD(a.desde);
        const h = parseYMD(a.hasta);
        if (!d) continue;
        if (date >= d && (!h || date <= h)) {
          price = ensureNumber(a.nuevoPrecio, price);
        }
      }
    }

    return price;
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
      return ensureNumber(lastPrice[contrato.id] ?? contrato.precioMensual ?? 0);
    },
    [aumByContrato, lastPrice, currentPrice, currentPeriod, priceAtDate]
  );

  const updatePaymentStatusFor = useCallback(
    (contrato, months) => {
      if (!contrato) return;
      const match = Array.isArray(months)
        ? months.find((m) => toMonthKey(m.periodo) === currentPeriod)
        : null;

      const prev = paymentSummary[contrato.id];

      const total = ensureNumber(
        match?.total ?? prev?.total ?? resolveMonthlyTotal(contrato, currentPeriod)
      );
      const pagado = ensureNumber(match?.pagado ?? prev?.pagado ?? 0);
      const saldo = ensureNumber(
        match?.saldo ?? prev?.saldo ?? Math.max(total - pagado, 0)
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
    [currentPeriod, paymentSummary, resolveMonthlyTotal, computePaymentStatus]
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
          fechaPago: toYMD(source.fechaPago || source.fecha || source.createdAt || new Date()),
          monto: ensureNumber(source.monto ?? source.importe ?? source.total ?? 0),
          metodo: source.metodo || source.metodoPago || "",
          nota: source.nota || source.detalle || "",
          origen: source,
        });
      };

      rawItems.forEach((entry) => {
        if (entry?.pagos && Array.isArray(entry.pagos)) {
          const periodo = toMonthKey(entry.periodo || entry.mes || entry.period);
          if (!periodo) return;
          const bucket = getMonthBucket(periodo);
          bucket.total = ensureNumber(entry.total ?? entry.montoTotal ?? bucket.total);
          bucket.vencimiento = entry.vencimiento ? toYMD(entry.vencimiento) : bucket.vencimiento;
          entry.pagos.forEach((p) => pushPartial(periodo, p));
        } else {
          const periodo = toMonthKey(entry.periodo || entry.mes || entry.fechaPago || entry.fecha);
          if (!periodo) return;
          const bucket = getMonthBucket(periodo);
          const maybeTotal = ensureNumber(entry.total ?? entry.montoTotal);
          if (maybeTotal > 0) bucket.total = maybeTotal;
          if (entry.vencimiento) bucket.vencimiento = toYMD(entry.vencimiento);
          pushPartial(periodo, entry);
        }
      });

      const months = Array.from(monthsMap.values()).map((month) => {
        const pagado = month.pagos.reduce((acc, cur) => acc + ensureNumber(cur.monto), 0);
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
    [resolveMonthlyTotal]
  );

  const loadPayments = useCallback(
    async (contrato, { force = false } = {}) => {
      if (!contrato?.id) return;
      const id = contrato.id;
      if (!force && paymentsByContrato[id]) return;
      setPaymentsLoading((s) => ({ ...s, [id]: true }));
      setPaymentsError((s) => ({ ...s, [id]: null }));
      try {
        const items = await listPagos(id);
        const normalized = normalizePayments(contrato, items);
        setPaymentsByContrato((s) => ({ ...s, [id]: normalized }));
        updatePaymentStatusFor(contrato, normalized.months);
      } catch (err) {
        console.error(err);
        setPaymentsError((s) => ({
          ...s,
          [id]: err?.message || "No se pudieron cargar pagos",
        }));
        showToast(err?.message || "No se pudieron cargar pagos", "error");
      } finally {
        setPaymentsLoading((s) => ({ ...s, [id]: false }));
      }
    },
    [normalizePayments, paymentsByContrato, showToast, updatePaymentStatusFor]
  );

  const resolvePriceStart = useCallback((contrato, aumentos) => {
    if (!contrato) return "";

    if (Array.isArray(aumentos) && aumentos.length) {
      const sorted = [...aumentos].sort((a, b) => parseYMD(a.hasta) - parseYMD(b.hasta));
      for (let idx = sorted.length - 1; idx >= 0; idx -= 1) {
        const candidate = dayAfter(sorted[idx]?.hasta);
        if (candidate) return candidate;
      }
    }

    if (contrato.ultimaActualizacion) {
      const normalized = toYMD(contrato.ultimaActualizacion);
      if (normalized) return normalized;
    }

    return toYMD(contrato.inicio);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadList();
      setItems(list);
      const lp = {};
      const cp = {};
      const lpSince = {};
      for (const c of list) {
        lp[c.id] = Number(c.lastPrecio ?? c.precioMensual ?? 0);
        cp[c.id] = Number(c.currentPrecio ?? c.lastPrecio ?? c.precioMensual ?? 0);
        const fallback = c.currentPrecioDesde || c.ultimaActualizacion || c.inicio || "";
        lpSince[c.id] = toYMD(fallback);
      }
      setLastPrice(lp);
      setCurrentPrice(cp);
      setLastPriceSince(lpSince);
    } catch (e) {
      console.error(e);
      showToast("Error cargando datos", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, paymentFilter]);

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
        const { items: summaries = {} } = await fetchPaymentStatuses(ids, currentPeriod);
        if (cancelled) return;

        const nextSummary = {};
        const nextStatus = {};

        ids.forEach((id) => {
          const summary = summaries?.[id];
          if (summary) {
            const total = ensureNumber(summary.total);
            const pagado = ensureNumber(summary.pagado);
            const saldo = ensureNumber(
              summary.saldo != null ? summary.saldo : Math.max(total - pagado, 0)
            );
            nextSummary[id] = { total, pagado, saldo };
            nextStatus[id] = summary.status || computePaymentStatus(total, pagado, saldo);
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
  }, [items, currentPeriod, computePaymentStatus]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();

    const byText = items.filter((r) =>
      String(r.domicilio || "").toLowerCase().includes(q) ||
      String(r.inquilino || "").toLowerCase().includes(q)
    );

    const byContractStatus = statusFilter === "all"
      ? byText
      : byText.filter((c) => {
        const st = contractStatus(c);
        if (statusFilter === "expired") return st === "expired";
        if (statusFilter === "soon") return st === "soon";
        if (statusFilter === "active_or_soon") return st === "soon" || st === "ok";
        return true;
      });

    if (paymentFilter === "all") return byContractStatus;

    return byContractStatus.filter((c) => {
      const st = paymentStatus[c.id] || "unknown";
      if (paymentFilter === "paid") return st === "paid";
      if (paymentFilter === "partial") return st === "partial";
      if (paymentFilter === "pending") return st === "pending";
      if (paymentFilter === "unknown") return st === "unknown" || st === "loading";
      return true;
    });
  }, [items, query, statusFilter, paymentFilter, paymentStatus]);

  const totalPages = useMemo(() => {
    const total = filtered.length;
    if (total <= 0) return 1;
    const size = Math.max(1, Number(pageSize) || 1);
    return Math.max(1, Math.ceil(total / size));
  }, [filtered.length, pageSize]);

  useEffect(() => {
    setCurrentPage((prev) => {
      const max = totalPages || 1;
      if (prev < 1) return 1;
      if (prev > max) return max;
      return prev;
    });
  }, [totalPages]);

  const paginated = useMemo(() => {
    if (!filtered.length) return [];
    const size = Math.max(1, Number(pageSize) || 1);
    const total = filtered.length;
    const start = (currentPage - 1) * size;
    const maxStart = Math.max(0, Math.min(start, Math.max(total - size, 0)));
    return filtered.slice(maxStart, maxStart + size);
  }, [filtered, currentPage, pageSize]);

  const setPage = useCallback(
    (page) => {
      if (page == null) return;
      const numeric = Number(page);
      if (!Number.isFinite(numeric)) return;
      setCurrentPage((prev) => {
        const floored = Math.floor(numeric);
        const max = totalPages || 1;
        const bounded = Math.min(Math.max(floored || 1, 1), max);
        return bounded;
      });
    },
    [totalPages]
  );

  const changePageSize = useCallback((size) => {
    const numeric = Number(size);
    const next = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 10;
    setPageSize(next);
    setCurrentPage(1);
  }, []);

  const startNew = useCallback(() => {
    setEditingMode("create");
    setEditing({
      id: "",
      domicilio: "",
      inquilino: "",
      contacto: "",
      inicio: todayISO(),
      fin: "",
      precioMensual: 0,
      aumento: "IPC",
      periodicidad: "M",
      notas: "",
    });
  }, []);

  const startEdit = useCallback((it) => {
    setEditing({ ...it });
    setEditingMode("edit");
    setOpenMenuId(null);
  }, []);

  const startView = useCallback((it) => {
    setEditing({ ...it });
    setEditingMode("view");
    setEditingAum(null);
    setEditingPago(null);
    setOpenMenuId(null);
  }, []);

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
    [resolveMonthlyTotal]
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
        showToast("Pago guardado ✅", "success");
      } catch (err) {
        console.error(err);
        showToast(err?.message || "Error guardando pago", "error");
      } finally {
        setSavingPago(false);
      }
    },
    [editingPago, items, loadPayments, showToast]
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
        showToast("Pago eliminado ✅", "success");
      } catch (err) {
        console.error(err);
        showToast(err?.message || "Error eliminando pago", "error");
      } finally {
        setSavingPago(false);
      }
    },
    [items, loadPayments, showToast]
  );

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setEditingMode(null);
  }, []);

  const saveEdit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!editing) return;

      const i = editing.inicio ? parseYMD(editing.inicio) : null;
      const f = editing.fin ? parseYMD(editing.fin) : null;
      if (i && f && i > f) {
        showToast("Inicio no puede ser mayor a fin", "error");
        return;
      }

      const isCreate = !editing.id;
      try {
        setSaving(true);
        const res = await createOrUpdateContrato(editing);

        if (isCreate) {
          const newId = res.id || String(Date.now());
          const nuevo = { ...editing, id: newId };
          setItems((list) => [nuevo, ...list]);
          setLastPrice((lp) => ({ ...lp, [newId]: Number(nuevo.precioMensual || 0) }));
          setLastPriceSince((lp) => ({ ...lp, [newId]: toYMD(nuevo.inicio) }));
        } else {
          setItems((list) => list.map((x) => (x.id === editing.id ? { ...x, ...editing } : x)));
          setLastPrice((lp) => {
            const prev = lp[editing.id];
            const nuevoBase = Number(editing.precioMensual || 0);
            return { ...lp, [editing.id]: prev ?? nuevoBase };
          });
          const contratoBase = items.find((x) => x.id === editing.id);
          const since = resolvePriceStart({ ...contratoBase, ...editing }, aumByContrato[editing.id]);
          setLastPriceSince((lp) => ({ ...lp, [editing.id]: since }));
        }

        setEditing(null);
        setEditingMode(null);
        showToast("Guardado ✅", "success");
      } catch (err) {
        console.error(err);
        showToast(err.message || "Error guardando", "error");
      } finally {
        setSaving(false);
      }
    },
    [editing, showToast, items, resolvePriceStart, aumByContrato]
  );

  const onDelete = useCallback(
    async (r) => {
      setOpenMenuId(null);
      if (!confirm(`¿Eliminar el contrato de ${r.inquilino} en "${r.domicilio}"?`)) return;
      try {
        setSaving(true);
        await deleteContrato(r.id);
        setItems((list) => list.filter((x) => x.id !== r.id));
        setLastPrice((lp) => {
          const copy = { ...lp };
          delete copy[r.id];
          return copy;
        });
        setLastPriceSince((lp) => {
          const copy = { ...lp };
          delete copy[r.id];
          return copy;
        });
        showToast("Eliminado ✅", "success");
      } catch (e) {
        console.error(e);
        showToast(e.message || "Error eliminando", "error");
      } finally {
        setSaving(false);
      }
    },
    [showToast]
  );

  const loadAumentos = useCallback(
    async (contrato, { force = false } = {}) => {
      if (!contrato?.id) return;
      const id = contrato.id;
      if (!force && aumByContrato[id]) return;
      setAumLoadingList((s) => ({ ...s, [id]: true }));
      setAumError((s) => ({ ...s, [id]: null }));
      try {
        const items = await listAumentos(id);
        setAumByContrato((s) => ({ ...s, [id]: items }));
        setLastPriceSince((lp) => ({ ...lp, [id]: resolvePriceStart(contrato, items) }));
      } catch (e) {
        console.error(e);
        setAumError((s) => ({ ...s, [id]: "No se pudieron cargar aumentos" }));
        showToast("No se pudieron cargar aumentos", "error");
      } finally {
        setAumLoadingList((s) => ({ ...s, [id]: false }));
      }
    },
    [aumByContrato, resolvePriceStart, showToast]
  );

  useEffect(() => {
    if (!editing?.id) return;
    loadPayments(editing);
    loadAumentos(editing);
  }, [editing, loadPayments, loadAumentos]);

  const startNewAum = useCallback(
    (c) => {
      const list = (aumByContrato[c.id] || []).slice();
      const periodMonths = PERIOD_MONTHS[c.periodicidad] || 1;
      const contractStart = parseYMD(c.inicio);
      const anchorDay = contractStart.getDate();

      let base = Number(c.precioMensual || 0);
      if (list.length) {
        list.sort((a, b) => parseYMD(a.hasta) - parseYMD(b.hasta));
        base = Number(list[list.length - 1].nuevoPrecio || base);
      } else if (lastPrice[c.id] != null) {
        base = Number(lastPrice[c.id]);
      }

      let desdeDate;
      let hastaDate;
      if (list.length === 0) {
        desdeDate = contractStart;
        hastaDate = cycleEnd(desdeDate, periodMonths, anchorDay);
      } else {
        const after = parseYMD(list[list.length - 1].hasta);
        desdeDate = nextCycleStart(contractStart, periodMonths, after);
        hastaDate = cycleEnd(desdeDate, periodMonths, anchorDay);
      }

      setEditingAum({
        id: "",
        contratoId: c.id,
        desde: toYMD(desdeDate),
        hasta: toYMD(hastaDate),
        porcentaje: "",
        nuevoPrecio: base,
        basePrecio: base,
        nota: "",
        _lockPrecio: false,
        _auto: false,
      });
    },
    [aumByContrato, lastPrice]
  );

  const startEditAum = useCallback(
    (a) => {
      setEditingAum({
        ...a,
        basePrecio: a.basePrecio || lastPrice[a.contratoId] || a.nuevoPrecio || 0,
        _lockPrecio: false,
        _auto: false,
      });
    },
    [lastPrice]
  );

  const cancelAum = useCallback(() => {
    setEditingAum(null);
  }, []);

  const onCalcProximoAumento = useCallback(
    async (contrato) => {
      try {
        const periodMonths = PERIOD_MONTHS[contrato.periodicidad] || 1;
        const contractStart = parseYMD(contrato.inicio);
        const anchorDay = contractStart.getDate();

        const list = (aumByContrato[contrato.id] || [])
          .slice()
          .sort((a, b) => parseYMD(a.hasta) - parseYMD(b.hasta));

        let base = Number(contrato.precioMensual || 0);
        if (list.length) base = Number(list[list.length - 1].nuevoPrecio || base);
        else if (lastPrice[contrato.id] != null) base = Number(lastPrice[contrato.id]);

        let desdeDate;
        let hastaDate;
        if (list.length === 0) {
          desdeDate = contractStart;
          hastaDate = cycleEnd(desdeDate, periodMonths, anchorDay);
        } else {
          const after = parseYMD(list[list.length - 1].hasta);
          desdeDate = nextCycleStart(contractStart, periodMonths, after);
          hastaDate = cycleEnd(desdeDate, periodMonths, anchorDay);
        }
        const desdeYMD = toYMD(desdeDate);
        const hastaYMD = toYMD(hastaDate);

        setAumCalculating((s) => ({ ...s, [contrato.id]: true }));

        const ipcMap = await fetchIPC(desdeYMD, hastaYMD);
        const meses = monthSpan(desdeYMD, hastaYMD);
        if (!meses.length) throw new Error("Rango de meses inválido para el cálculo");

        const detalles = [];
        let ultimoConDato = null;
        const faltantes = [];
        let total = 0;

        for (const ym of meses) {
          const val = ipcMap[ym];
          if (typeof val === "number") {
            ultimoConDato = val;
            detalles.push(`${monthLabelES(ym)}: ${val.toFixed(2)}%`);
            total += val;
          } else if (ultimoConDato != null) {
            detalles.push(`${monthLabelES(ym)}: ${ultimoConDato.toFixed(2)}% (estimado)`);
            total += ultimoConDato;
            faltantes.push(ym);
          } else {
            throw new Error("No hay datos suficientes para estimar el primer mes del período.");
          }
        }

        if (faltantes.length) {
          const ok = confirm(
            "Aún no hay IPC para: " +
              faltantes.map(monthLabelES).join(", ") +
              ". ¿Deseás continuar usando estimación del último mes disponible?"
          );
          if (!ok) return;
        }

        const porcentajeTotal = Math.round(total * 100) / 100;
        const nuevoPrecio = Math.round(base * (1 + porcentajeTotal / 100));

        setEditingAum({
          id: "",
          contratoId: contrato.id,
          desde: desdeYMD,
          hasta: hastaYMD,
          porcentaje: String(porcentajeTotal),
          nuevoPrecio,
          basePrecio: base,
          nota: `Aumento generado automáticamente por API IPC.\n${detalles.join(" | ")}`,
          _lockPrecio: true,
          _auto: true,
        });
      } catch (err) {
        console.error(err);
        showToast(err.message || "No se pudo calcular el IPC", "error");
      } finally {
        setAumCalculating((s) => ({ ...s, [contrato.id]: false }));
      }
    },
    [aumByContrato, lastPrice, showToast]
  );

  const handlePorcentajeChange = useCallback((e) => {
    const val = e.target.value;
    setEditingAum((s) => {
      if (!s || s._auto) return s;
      const base = Number(s.basePrecio || 0);
      const p = toNumberPct(val);
      if (Number.isFinite(p)) {
        const nuevo = Math.round(base * (1 + p / 100));
        return { ...s, porcentaje: val, nuevoPrecio: nuevo, _lockPrecio: true };
      }
      return { ...s, porcentaje: val, _lockPrecio: false };
    });
  }, []);

  const handleNuevoPrecioChange = useCallback((e) => {
    const val = e.target.value;
    setEditingAum((s) => {
      if (!s || s._auto) return s;
      const base = Number(s.basePrecio || 0);
      const np = parseFloat(val);
      if (isFinite(np) && base > 0) {
        const p = (np / base - 1) * 100;
        const pct = Number.isFinite(p) ? (Math.round(p * 100) / 100).toString() : s.porcentaje;
        return { ...s, nuevoPrecio: val, porcentaje: pct, _lockPrecio: false };
      }
      return { ...s, nuevoPrecio: val, _lockPrecio: false };
    });
  }, []);

  const saveAum = useCallback(
    async (e) => {
      e.preventDefault();
      if (!editingAum) return;
      const base = Number(editingAum.basePrecio || 0);
      if (!(base > 0)) {
        showToast("Precio base inválido", "error");
        return;
      }
      try {
        setSaving(true);

        const pctNum = toNumberPct(editingAum.porcentaje);
        const payload = {
          ...editingAum,
          porcentaje: Number.isFinite(pctNum) ? (Math.round(pctNum * 100) / 100).toString() : "",
          nuevoPrecio: Number(editingAum.nuevoPrecio || 0),
          basePrecio: Number(editingAum.basePrecio || 0),
        };

        await createOrUpdateAum(payload);
        setAumLoadingList((s) => ({ ...s, [editingAum.contratoId]: true }));
        const itemsAums = await listAumentos(editingAum.contratoId);
        setAumByContrato((s) => ({ ...s, [editingAum.contratoId]: itemsAums }));
        setAumLoadingList((s) => ({ ...s, [editingAum.contratoId]: false }));
        setLastPrice((lp) => ({
          ...lp,
          [editingAum.contratoId]: Number(editingAum.nuevoPrecio || 0),
        }));
        const contrato = items.find((c) => c.id === editingAum.contratoId);
        setLastPriceSince((lp) => ({
          ...lp,
          [editingAum.contratoId]: resolvePriceStart(contrato, itemsAums),
        }));
        setEditingAum(null);
        showToast("Aumento guardado ✅", "success");
      } catch (err) {
        console.error(err);
        showToast(err.message || "Error guardando aumento", "error");
      } finally {
        setSaving(false);
      }
    },
    [editingAum, showToast, items, resolvePriceStart]
  );

  const onDeleteAum = useCallback(
    async (a) => {
      setDeletingAumId(a.id);
      const ok = confirm("¿Eliminar este aumento?");
      if (!ok) {
        setDeletingAumId(null);
        return;
      }

      try {
        setSaving(true);

        await deleteAum(a.id);

        setAumLoadingList((s) => ({ ...s, [a.contratoId]: true }));
        const itemsAum = await listAumentos(a.contratoId);
        setAumByContrato((s) => ({ ...s, [a.contratoId]: itemsAum }));
        setAumLoadingList((s) => ({ ...s, [a.contratoId]: false }));

        let ultimoPrecio;
        const contrato = items.find((c) => c.id === a.contratoId);
        if (itemsAum.length) {
          itemsAum.sort((x, y) => parseYMD(x.hasta) - parseYMD(y.hasta));
          ultimoPrecio = Number(itemsAum[itemsAum.length - 1].nuevoPrecio || 0);
        } else {
          ultimoPrecio = Number(contrato?.precioMensual || 0);
        }

        setLastPrice((lp) => ({ ...lp, [a.contratoId]: ultimoPrecio }));
        setLastPriceSince((lp) => ({
          ...lp,
          [a.contratoId]: resolvePriceStart(contrato, itemsAum),
        }));
        showToast("Aumento eliminado ✅", "success");
      } catch (err) {
        console.error(err);
        showToast(err.message || "Error eliminando aumento", "error");
      } finally {
        setSaving(false);
        setDeletingAumId(null);
      }
    },
    [items, showToast, resolvePriceStart]
  );

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpenMenuId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return {
    // data
    items,
    filtered,
    paginated,
    loading,
    query,
    statusFilter,
    paymentFilter,
    editing,
    editingMode,
    aumByContrato,
    editingAum,
    deletingAumId,
    aumLoadingList,
    aumCalculating,
    aumError,
    lastPrice,
    lastPriceSince,
    currentPrice,
    paymentsByContrato,
    paymentsLoading,
    paymentsError,
    paymentStatus,
    editingPago,
    savingPago,
    openMenuId,
    menuRef,
    saving,
    toast,
    pageSize,
    currentPage,
    totalPages,
    currentPeriod,
    // constants & helpers
    // setters / actions
    setQuery,
    setStatusFilter,
    setPaymentFilter,
    setEditing,
    setEditingMode,
    setOpenMenuId,
    setEditingAum,
    setEditingPago,
    showToast,
    hideToast,
    setPage,
    setPageSize: changePageSize,
    startNew,
    startEdit,
    startView,
    startNewPago,
    startEditPago,
    cancelEdit,
    saveEdit,
    onDelete,
    startNewAum,
    startEditAum,
    cancelAum,
    onCalcProximoAumento,
    handlePorcentajeChange,
    handleNuevoPrecioChange,
    saveAum,
    onDeleteAum,
    cancelPago,
    savePago,
    onDeletePago,
    loadPayments,
    loadAumentos,
    resolveMonthlyTotal,
    toYMD,
    paymentDueDate,
  };
}



