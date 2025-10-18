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
} from "../services/api";
import { PERIOD_MONTHS } from "../constants/ui";
import { useToast } from "./useToast";

export function useContractsPage() {
  const menuRef = useRef(null);
  const { toast, showToast, hideToast } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [aumByContrato, setAumByContrato] = useState({});
  const [editingAum, setEditingAum] = useState(null);
  const [deletingAumId, setDeletingAumId] = useState(null);

  const [aumLoadingList, setAumLoadingList] = useState({});
  const [aumCalculating, setAumCalculating] = useState({});
  const [aumError, setAumError] = useState({});

  const [lastPrice, setLastPrice] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);

  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadList();
      setItems(list);
      const lp = {};
      for (const c of list) lp[c.id] = Number(c.lastPrecio ?? c.precioMensual ?? 0);
      setLastPrice(lp);
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

  const filtered = useMemo(() => {
    const q = query.toLowerCase();

    const byText = items.filter((r) =>
      String(r.domicilio || "").toLowerCase().includes(q) ||
      String(r.inquilino || "").toLowerCase().includes(q)
    );

    if (statusFilter === "all") return byText;

    return byText.filter((c) => {
      const st = contractStatus(c);
      if (statusFilter === "expired") return st === "expired";
      if (statusFilter === "soon") return st === "soon";
      if (statusFilter === "active_or_soon") return st === "soon" || st === "ok";
      return true;
    });
  }, [items, query, statusFilter]);

  const startNew = useCallback(() => {
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
    setOpenMenuId(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(null);
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
        } else {
          setItems((list) => list.map((x) => (x.id === editing.id ? { ...x, ...editing } : x)));
          setLastPrice((lp) => {
            const prev = lp[editing.id];
            const nuevoBase = Number(editing.precioMensual || 0);
            return { ...lp, [editing.id]: prev ?? nuevoBase };
          });
        }

        setEditing(null);
        showToast("Guardado ✅", "success");
      } catch (err) {
        console.error(err);
        showToast(err.message || "Error guardando", "error");
      } finally {
        setSaving(false);
      }
    },
    [editing, showToast]
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

  const toggleExpand = useCallback(
    async (c) => {
      const id = c.id;
      if (expandedId === id) {
        setExpandedId(null);
        return;
      }

      setExpandedId(id);

      if (!aumByContrato[id]) {
        setAumLoadingList((s) => ({ ...s, [id]: true }));
        setAumError((s) => ({ ...s, [id]: null }));
        try {
          const items = await listAumentos(id);
          setAumByContrato((s) => ({ ...s, [id]: items }));
        } catch (e) {
          console.error(e);
          setAumError((s) => ({ ...s, [id]: "No se pudieron cargar aumentos" }));
          showToast("No se pudieron cargar aumentos", "error");
        } finally {
          setAumLoadingList((s) => ({ ...s, [id]: false }));
        }
      }
    },
    [aumByContrato, expandedId, showToast]
  );

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
        const items = await listAumentos(editingAum.contratoId);
        setAumByContrato((s) => ({ ...s, [editingAum.contratoId]: items }));
        setAumLoadingList((s) => ({ ...s, [editingAum.contratoId]: false }));
        setLastPrice((lp) => ({
          ...lp,
          [editingAum.contratoId]: Number(editingAum.nuevoPrecio || 0),
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
    [editingAum, showToast]
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
        if (itemsAum.length) {
          itemsAum.sort((x, y) => parseYMD(x.hasta) - parseYMD(y.hasta));
          ultimoPrecio = Number(itemsAum[itemsAum.length - 1].nuevoPrecio || 0);
        } else {
          const contrato = items.find((c) => c.id === a.contratoId);
          ultimoPrecio = Number(contrato?.precioMensual || 0);
        }

        setLastPrice((lp) => ({ ...lp, [a.contratoId]: ultimoPrecio }));
        showToast("Aumento eliminado ✅", "success");
      } catch (err) {
        console.error(err);
        showToast(err.message || "Error eliminando aumento", "error");
      } finally {
        setSaving(false);
        setDeletingAumId(null);
      }
    },
    [items, showToast]
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
    loading,
    query,
    statusFilter,
    editing,
    expandedId,
    aumByContrato,
    editingAum,
    deletingAumId,
    aumLoadingList,
    aumCalculating,
    aumError,
    lastPrice,
    openMenuId,
    menuRef,
    saving,
    toast,
    // constants & helpers
    // setters / actions
    setQuery,
    setStatusFilter,
    setEditing,
    setOpenMenuId,
    setEditingAum,
    showToast,
    hideToast,
    startNew,
    startEdit,
    cancelEdit,
    saveEdit,
    onDelete,
    toggleExpand,
    startNewAum,
    startEditAum,
    cancelAum,
    onCalcProximoAumento,
    handlePorcentajeChange,
    handleNuevoPrecioChange,
    saveAum,
    onDeleteAum,
    toYMD,
  };
}
