import { useCallback, useEffect, useRef, useState } from "react";
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
  fmtDateAR,
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
  environmentId = "default",
}) {
  const [aumByContrato, setAumByContrato] = useState({});
  const [editingAum, setEditingAum] = useState(null);
  const [deletingAumId, setDeletingAumId] = useState(null);
  const [aumLoadingList, setAumLoadingList] = useState({});
  const [aumCalculating, setAumCalculating] = useState({});
  const [aumError, setAumError] = useState({});
  const environmentRef = useRef(environmentId);
  const loadingRef = useRef(aumLoadingList);

  useEffect(() => {
    environmentRef.current = environmentId;
  }, [environmentId]);

  useEffect(() => {
    setAumByContrato({});
    setEditingAum(null);
    setDeletingAumId(null);
    setAumLoadingList({});
    setAumCalculating({});
    setAumError({});
  }, [environmentId]);

  const resolvePriceStart = useCallback(
    (contrato, aumentos, referenceDate) => {
      if (!contrato) return "";

      const hasReference =
        referenceDate !== undefined && referenceDate !== null;
      let refDate = null;
      if (
        referenceDate instanceof Date ||
        (typeof referenceDate === "string" && referenceDate)
      ) {
        refDate =
          referenceDate instanceof Date
            ? new Date(referenceDate)
            : parseYMD(referenceDate);
      } else if (typeof referenceDate === "number") {
        refDate = new Date(referenceDate);
      }

      if (refDate && !Number.isNaN(refDate.getTime())) {
        refDate.setHours(0, 0, 0, 0);
      } else {
        refDate = null;
      }

      if (Array.isArray(aumentos) && aumentos.length) {
        const candidates = aumentos
          .map((item) => {
            const appliesFrom =
              dayAfter(item?.hasta) || item?.aplicaDesde || item?.desde;
            const applyDate = parseYMD(appliesFrom);
            if (!applyDate) return null;
            applyDate.setHours(0, 0, 0, 0);
            return { applyDate, ymd: toYMD(applyDate) };
          })
          .filter(Boolean)
          .sort((a, b) => a.applyDate - b.applyDate);

        if (candidates.length) {
          if (refDate) {
            for (let idx = candidates.length - 1; idx >= 0; idx -= 1) {
              if (candidates[idx].applyDate <= refDate) {
                return candidates[idx].ymd;
              }
            }
          } else if (!hasReference) {
            return candidates[candidates.length - 1].ymd;
          }

          if (hasReference && !refDate) {
            return candidates[candidates.length - 1].ymd;
          }
        }
      }

      if (contrato.ultimaActualizacion) {
        const normalized = toYMD(contrato.ultimaActualizacion);
        if (normalized) return normalized;
      }

      return toYMD(contrato.inicio);
    },
    [],
  );

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

  useEffect(() => {
    loadingRef.current = aumLoadingList;
  }, [aumLoadingList]);

  const loadAumentos = useCallback(
    async (contrato, { force = false, silent = false } = {}) => {
      if (!contrato?.id) return;
      const id = contrato.id;
      if (!force) {
        if (aumByContrato[id]) return;
        if (loadingRef.current?.[id]) return;
      }
      setAumLoadingList((state) => ({ ...state, [id]: true }));
      setAumError((state) => ({ ...state, [id]: null }));
      try {
        const itemsList = await listAumentos(id);
        if (environmentRef.current !== environmentId) return;
        setAumByContrato((state) => ({ ...state, [id]: itemsList }));
        setLastPriceSince((state) => ({
          ...state,
          [id]: resolvePriceStart(contrato, itemsList),
        }));
        const actualPrice = computeCurrentPrice(contrato, itemsList);
        setCurrentPrice((state) => ({ ...state, [id]: actualPrice }));
      } catch (err) {
        console.error(err);
        if (environmentRef.current !== environmentId) return;
        if (!silent) {
          setAumError((state) => ({
            ...state,
            [id]: "No se pudieron cargar aumentos",
          }));
          if (showToast) showToast("No se pudieron cargar aumentos", "error");
        }
      } finally {
        if (environmentRef.current === environmentId) {
          setAumLoadingList((state) => ({ ...state, [id]: false }));
        }
      }
    },
    [
      aumByContrato,
      computeCurrentPrice,
      environmentId,
      resolvePriceStart,
      setCurrentPrice,
      showToast,
      setLastPriceSince,
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

        const contratoFin = contrato?.fin ? parseYMD(contrato.fin) : null;
        if (contratoFin && (hastaDate > contratoFin || desdeDate > contratoFin)) {
          const msg = `El aumento calculado excede la fecha de fin del contrato (${fmtDateAR(
            contrato.fin,
          )}).`;
          if (typeof alert === "function") alert(msg);
          if (showToast) showToast(msg, "warning");
          return;
        }

        setAumCalculating((state) => ({ ...state, [contrato.id]: true }));

        const ipcMap = await fetchIPC(desdeYMD, hastaYMD);
        if (environmentRef.current !== environmentId) return;
        const meses = monthSpan(desdeYMD, hastaYMD);
        if (!meses.length)
          throw new Error("Rango de meses inválido para el cálculo");

        const detalles = [];
        let ultimoConDato = null;
        const missingLastMonths = [];
        const blockingMissingMonths = [];
        let total = 0;

        meses.forEach((ym, index) => {
          const val = ipcMap[ym];
          const isLastMonth = index === meses.length - 1;

          if (typeof val === "number") {
            total += val;
            ultimoConDato = val;
            detalles.push(`${monthLabelES(ym)}: ${val.toFixed(2)}%`);
            return;
          }

          if (isLastMonth && ultimoConDato != null) {
            total += ultimoConDato;
            detalles.push(
              `${monthLabelES(ym)}: ${ultimoConDato.toFixed(2)}% (estimado)`,
            );
            missingLastMonths.push(ym);
            return;
          }

          blockingMissingMonths.push(ym);
        });

        if (blockingMissingMonths.length) {
          const mesesSinDatos = blockingMissingMonths.map(monthLabelES).join(", ");
          const aviso =
            blockingMissingMonths.length === meses.length
              ? `Todavia no hay informacion de IPC para ${mesesSinDatos}. Debes esperar antes de calcular este aumento.`
              : `Aun falta informacion de IPC para ${mesesSinDatos}. Debes esperar antes de calcular este aumento.`;

          if (typeof alert === "function") alert(aviso);
          if (showToast) showToast(aviso, "warning");
          setAumCalculating((state) => ({ ...state, [contrato.id]: false }));
          return;
        }

        const deseaContinuar =
          missingLastMonths.length === 0 ||
          confirm(
            `Aun no hay IPC para: ${missingLastMonths
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
        if (environmentRef.current === environmentId) {
          setAumCalculating((state) => ({ ...state, [contrato.id]: false }));
        }
      }
    },
    [aumByContrato, environmentId, lastPrice, showToast],
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

      const contratoActual = items.find(
        (c) => c.id === editingAum.contratoId,
      );
      if (!contratoActual) {
        if (showToast) showToast("Contrato no encontrado", "error");
        return;
      }

      const desdeDate = parseYMD(editingAum.desde);
      const hastaDate = parseYMD(editingAum.hasta);
      if (!desdeDate || !hastaDate) {
        if (showToast) showToast("Fechas de aumento invalidas", "error");
        return;
      }

      const inicioContrato = parseYMD(contratoActual.inicio);
      if (inicioContrato && desdeDate < inicioContrato) {
        const msg = `El aumento no puede iniciar antes del contrato (${fmtDateAR(
          contratoActual.inicio,
        )}).`;
        if (showToast) showToast(msg, "error");
        return;
      }

      const finContrato = contratoActual.fin
        ? parseYMD(contratoActual.fin)
        : null;
      if (
        finContrato &&
        (hastaDate > finContrato || desdeDate > finContrato)
      ) {
        const msg = `El aumento no puede superar la fecha de finalizacion del contrato (${fmtDateAR(
          contratoActual.fin,
        )}).`;
        if (showToast) showToast(msg, "error");
        return;
      }

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
        if (environmentRef.current !== environmentId) return;
        setAumLoadingList((state) => ({
          ...state,
          [editingAum.contratoId]: true,
        }));
        const itemsAums = await listAumentos(editingAum.contratoId);
        if (environmentRef.current !== environmentId) return;
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
        setLastPriceSince((state) => ({
          ...state,
          [editingAum.contratoId]: resolvePriceStart(
            contratoActual,
            itemsAums,
          ),
        }));
        const actualPrice = computeCurrentPrice(
          contratoActual,
          itemsAums,
        );
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
        if (environmentRef.current === environmentId) {
          setSaving(false);
        }
      }
    },
    [
      computeCurrentPrice,
      editingAum,
      environmentId,
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
      const aplicaDesdeYMD =
        dayAfter(aumento?.hasta) || aumento?.aplicaDesde || aumento?.desde;
      const aplicaDesdeDate = parseYMD(aplicaDesdeYMD);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (aplicaDesdeDate && aplicaDesdeDate <= today) {
        setDeletingAumId(null);
        if (showToast) {
          showToast(
            "No se puede eliminar un aumento que ya entró en vigencia.",
            "warning",
          );
        } else if (typeof alert === "function") {
          alert("No se puede eliminar un aumento que ya entró en vigencia.");
        }
        return;
      }

      const ok = confirm("Eliminar este aumento?");
      if (!ok) {
        setDeletingAumId(null);
        return;
      }

      try {
        setSaving(true);

        await deleteAum(aumento.id);
        if (environmentRef.current !== environmentId) return;

        setAumLoadingList((state) => ({
          ...state,
          [aumento.contratoId]: true,
        }));
        const itemsAum = await listAumentos(aumento.contratoId);
        if (environmentRef.current !== environmentId) return;
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
        if (environmentRef.current === environmentId) {
          setSaving(false);
          setDeletingAumId(null);
        }
      }
    },
    [
      computeCurrentPrice,
      environmentId,
      showToast,
      items,
      resolvePriceStart,
      setCurrentPrice,
      setLastPrice,
      setLastPriceSince,
      setSaving,
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
