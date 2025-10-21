import { useCallback, useState } from "react";
import {
  listAumentos,
  createOrUpdateAum,
  deleteAum,
  fetchIPC,
} from "../../services/api";
import {
  parseYMD,
  nextCycleStart,
  cycleEnd,
  dayAfter,
  monthSpan,
  monthLabelES,
  toYMD,
} from "../../utils/dates";
import { toNumberPct } from "../../utils/formatters";
import { ensureNumber, priceAtDate } from "../../utils/contracts";
import { PERIOD_MONTHS } from "../../constants/ui";

export function useContractAumentos({
  items,
  lastPrice,
  setLastPrice,
  setLastPriceSince,
  setCurrentPrice,
  showToast,
  saving,
  setSaving,
}) {
  const [aumByContrato, setAumByContrato] = useState({});
  const [editingAum, setEditingAum] = useState(null);
  const [deletingAumId, setDeletingAumId] = useState(null);
  const [aumLoadingList, setAumLoadingList] = useState({});
  const [aumCalculating, setAumCalculating] = useState({});
  const [aumError, setAumError] = useState({});

  const resolvePriceStart = useCallback((contrato, aumentos) => {
    if (!contrato) return "";

    if (Array.isArray(aumentos) && aumentos.length) {
      const sorted = [...aumentos].sort(
        (a, b) => parseYMD(a.hasta) - parseYMD(b.hasta),
      );
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

  const computeCurrentPrice = useCallback(
    (contrato, aumentosLista) => {
      if (!contrato) return 0;
      const todayYMD = toYMD(new Date());
      const computed = priceAtDate(contrato, aumentosLista, todayYMD);
      if (computed > 0) return computed;
      return ensureNumber(
        lastPrice[contrato.id] ?? contrato.precioMensual ?? 0,
      );
    },
    [lastPrice],
  );

  const loadAumentos = useCallback(
    async (contrato, { force = false } = {}) => {
      if (!contrato?.id) return;
      const id = contrato.id;
      if (!force && aumByContrato[id]) return;
      setAumLoadingList((state) => ({ ...state, [id]: true }));
      setAumError((state) => ({ ...state, [id]: null }));
      try {
        const itemsList = await listAumentos(id);
        setAumByContrato((state) => ({ ...state, [id]: itemsList }));
        setLastPriceSince((state) => ({
          ...state,
          [id]: resolvePriceStart(contrato, itemsList),
        }));
        const actualPrice = computeCurrentPrice(contrato, itemsList);
        setCurrentPrice((state) => ({ ...state, [id]: actualPrice }));
      } catch (err) {
        console.error(err);
        setAumError((state) => ({
          ...state,
          [id]: "No se pudieron cargar aumentos",
        }));
        if (showToast) showToast("No se pudieron cargar aumentos", "error");
      } finally {
        setAumLoadingList((state) => ({ ...state, [id]: false }));
      }
    },
    [
      aumByContrato,
      computeCurrentPrice,
      resolvePriceStart,
      setCurrentPrice,
      setLastPriceSince,
      showToast,
    ],
  );

  const startNewAum = useCallback(
    (contrato) => {
      const list = (aumByContrato[contrato.id] || []).slice();
      const periodMonths = PERIOD_MONTHS[contrato.periodicidad] || 1;
      const contractStart = parseYMD(contrato.inicio);
      const anchorDay = contractStart.getDate();

      let base = Number(contrato.precioMensual || 0);
      if (list.length) {
        list.sort((a, b) => parseYMD(a.hasta) - parseYMD(b.hasta));
        base = Number(list[list.length - 1].nuevoPrecio || base);
      } else if (lastPrice[contrato.id] != null) {
        base = Number(lastPrice[contrato.id]);
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
        contratoId: contrato.id,
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
    [aumByContrato, lastPrice],
  );

  const startEditAum = useCallback(
    (aumento) => {
      setEditingAum({
        ...aumento,
        basePrecio:
          aumento.basePrecio ||
          lastPrice[aumento.contratoId] ||
          aumento.nuevoPrecio ||
          0,
        _lockPrecio: false,
        _auto: false,
      });
    },
    [lastPrice],
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
        if (list.length)
          base = Number(list[list.length - 1].nuevoPrecio || base);
        else if (lastPrice[contrato.id] != null)
          base = Number(lastPrice[contrato.id]);

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

        setAumCalculating((state) => ({ ...state, [contrato.id]: true }));

        const ipcMap = await fetchIPC(desdeYMD, hastaYMD);
        const meses = monthSpan(desdeYMD, hastaYMD);
        if (!meses.length)
          throw new Error("Rango de meses inválido para el cálculo");

        const detalles = [];
        let ultimoConDato = null;
        const faltantes = [];
        let total = 0;

        for (const ym of meses) {
          const val = ipcMap[ym];
          if (typeof val === "number") {
            total += val;
            ultimoConDato = val;
            detalles.push(`${monthLabelES(ym)}: ${val.toFixed(2)}%`);
          } else if (ultimoConDato != null) {
            total += ultimoConDato;
            detalles.push(
              `${monthLabelES(ym)}: ${ultimoConDato.toFixed(2)}% (estimado)`,
            );
            faltantes.push(ym);
          } else {
            faltantes.push(ym);
          }
        }

        const deseaContinuar =
          faltantes.length === 0 ||
          confirm(
            `Aun no hay IPC para: ${faltantes
              .map(monthLabelES)
              .join(
                ", ",
              )}. Deseas continuar usando estimacion del ultimo mes disponible?`,
          );

        if (!deseaContinuar) {
          setAumCalculating((state) => ({ ...state, [contrato.id]: false }));
          return;
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
          nota: `Aumento generado automaticamente por API IPC.\n${detalles.join(" | ")}`,
          _lockPrecio: true,
          _auto: true,
        });
      } catch (err) {
        console.error(err);
        if (showToast)
          showToast(err.message || "No se pudo calcular el IPC", "error");
      } finally {
        setAumCalculating((state) => ({ ...state, [contrato.id]: false }));
      }
    },
    [aumByContrato, lastPrice, showToast],
  );

  const handlePorcentajeChange = useCallback((event) => {
    const val = event.target.value;
    setEditingAum((state) => {
      if (!state || state._auto) return state;
      const base = Number(state.basePrecio || 0);
      const p = toNumberPct(val);
      if (Number.isFinite(p)) {
        const nuevo = Math.round(base * (1 + p / 100));
        return {
          ...state,
          porcentaje: val,
          nuevoPrecio: nuevo,
          _lockPrecio: true,
        };
      }
      return { ...state, porcentaje: val, _lockPrecio: false };
    });
  }, []);

  const handleNuevoPrecioChange = useCallback((event) => {
    const val = event.target.value;
    setEditingAum((state) => {
      if (!state || state._auto) return state;
      const base = Number(state.basePrecio || 0);
      const np = parseFloat(val);
      if (Number.isFinite(np) && base > 0) {
        const p = (np / base - 1) * 100;
        const pct = Number.isFinite(p)
          ? (Math.round(p * 100) / 100).toString()
          : state.porcentaje;
        return {
          ...state,
          nuevoPrecio: val,
          porcentaje: pct,
          _lockPrecio: false,
        };
      }
      return { ...state, nuevoPrecio: val, _lockPrecio: false };
    });
  }, []);

  const saveAum = useCallback(
    async (event) => {
      event.preventDefault();
      if (!editingAum) return;
      const base = Number(editingAum.basePrecio || 0);
      if (!(base > 0)) {
        if (showToast) showToast("Precio base invalido", "error");
        return;
      }

      try {
        setSaving(true);

        const pctNum = toNumberPct(editingAum.porcentaje);
        const payload = {
          ...editingAum,
          porcentaje: Number.isFinite(pctNum)
            ? (Math.round(pctNum * 100) / 100).toString()
            : "",
          nuevoPrecio: Number(editingAum.nuevoPrecio || 0),
          basePrecio: Number(editingAum.basePrecio || 0),
        };

        await createOrUpdateAum(payload);
        setAumLoadingList((state) => ({
          ...state,
          [editingAum.contratoId]: true,
        }));
        const itemsAums = await listAumentos(editingAum.contratoId);
        setAumByContrato((state) => ({
          ...state,
          [editingAum.contratoId]: itemsAums,
        }));
        setAumLoadingList((state) => ({
          ...state,
          [editingAum.contratoId]: false,
        }));
        setLastPrice((state) => ({
          ...state,
          [editingAum.contratoId]: Number(editingAum.nuevoPrecio || 0),
        }));
        const contrato = items.find((c) => c.id === editingAum.contratoId);
        setLastPriceSince((state) => ({
          ...state,
          [editingAum.contratoId]: resolvePriceStart(contrato, itemsAums),
        }));
        const actualPrice = computeCurrentPrice(contrato, itemsAums);
        setCurrentPrice((state) => ({
          ...state,
          [editingAum.contratoId]: actualPrice,
        }));
        setEditingAum(null);
        if (showToast) showToast("Aumento guardado", "success");
      } catch (err) {
        console.error(err);
        if (showToast)
          showToast(err.message || "Error guardando aumento", "error");
      } finally {
        setSaving(false);
      }
    },
    [
      computeCurrentPrice,
      editingAum,
      items,
      resolvePriceStart,
      setCurrentPrice,
      setLastPrice,
      setLastPriceSince,
      setSaving,
      showToast,
    ],
  );

  const onDeleteAum = useCallback(
    async (aumento) => {
      setDeletingAumId(aumento.id);
      const ok = confirm("Eliminar este aumento?");
      if (!ok) {
        setDeletingAumId(null);
        return;
      }

      try {
        setSaving(true);

        await deleteAum(aumento.id);

        setAumLoadingList((state) => ({
          ...state,
          [aumento.contratoId]: true,
        }));
        const itemsAum = await listAumentos(aumento.contratoId);
        setAumByContrato((state) => ({
          ...state,
          [aumento.contratoId]: itemsAum,
        }));
        setAumLoadingList((state) => ({
          ...state,
          [aumento.contratoId]: false,
        }));

        let ultimoPrecio;
        const contrato = items.find((c) => c.id === aumento.contratoId);
        if (itemsAum.length) {
          itemsAum.sort((x, y) => parseYMD(x.hasta) - parseYMD(y.hasta));
          ultimoPrecio = Number(itemsAum[itemsAum.length - 1].nuevoPrecio || 0);
        } else {
          ultimoPrecio = Number(contrato?.precioMensual || 0);
        }

        setLastPrice((state) => ({
          ...state,
          [aumento.contratoId]: ultimoPrecio,
        }));
        setLastPriceSince((state) => ({
          ...state,
          [aumento.contratoId]: resolvePriceStart(contrato, itemsAum),
        }));
        const actualPrice = computeCurrentPrice(contrato, itemsAum);
        setCurrentPrice((state) => ({
          ...state,
          [aumento.contratoId]: actualPrice,
        }));
        if (showToast) showToast("Aumento eliminado", "success");
      } catch (err) {
        console.error(err);
        if (showToast)
          showToast(err.message || "Error eliminando aumento", "error");
      } finally {
        setSaving(false);
        setDeletingAumId(null);
      }
    },
    [
      computeCurrentPrice,
      items,
      resolvePriceStart,
      setCurrentPrice,
      setLastPrice,
      setLastPriceSince,
      setSaving,
      showToast,
    ],
  );

  return {
    aumByContrato,
    setAumByContrato,
    editingAum,
    setEditingAum,
    deletingAumId,
    aumLoadingList,
    aumCalculating,
    aumError,
    loadAumentos,
    startNewAum,
    startEditAum,
    cancelAum,
    onCalcProximoAumento,
    handlePorcentajeChange,
    handleNuevoPrecioChange,
    saveAum,
    onDeleteAum,
    resolvePriceStart,
    saving,
  };
}
