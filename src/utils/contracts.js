import { parseYMD, dayAfter, addMonthsAligned } from "./dates";
import { PERIOD_MONTHS } from "../constants/ui";

export const toMonthKey = (value) => {
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

export const ensureNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const priceAtDate = (contrato, aumentos, targetYMD) => {
  if (!contrato) return 0;
  let price = ensureNumber(contrato.precioMensual);
  const targetDate = parseYMD(targetYMD);
  if (!targetDate) return price;

  if (!Array.isArray(aumentos) || aumentos.length === 0) {
    return price;
  }

  const sorted = [...aumentos].sort((a, b) => {
    const aAplica = parseYMD(dayAfter(a.hasta) || a.aplicaDesde || a.desde);
    const bAplica = parseYMD(dayAfter(b.hasta) || b.aplicaDesde || b.desde);
    if (!aAplica || !bAplica) return 0;
    return aAplica - bAplica;
  });

  for (const aumento of sorted) {
    const aplicaDesdeYMD =
      dayAfter(aumento.hasta) || aumento.aplicaDesde || aumento.desde;
    const aplicaDesde = parseYMD(aplicaDesdeYMD);
    if (!aplicaDesde) continue;
    if (targetDate >= aplicaDesde) {
      price = ensureNumber(aumento.nuevoPrecio, price);
    }
  }

  return price;
};

export const resolveIncreaseStatus = (
  contrato,
  { lastPriceSince, aumentos, referenceDate = new Date() } = {},
) => {
  if (!contrato) return null;

  const periodMonths = PERIOD_MONTHS[contrato.periodicidad] || 0;
  if (periodMonths <= 0) return null;

  const contractStart = parseYMD(contrato.inicio);
  const cycleStart =
    parseYMD(lastPriceSince) || contractStart || parseYMD(contrato.inicio);
  if (!cycleStart) return null;

  const anchorSource = contractStart || cycleStart;
  const anchorDay = anchorSource ? anchorSource.getDate() : 1;

  const refDate =
    referenceDate instanceof Date ? new Date(referenceDate) : parseYMD(referenceDate);
  if (!refDate || Number.isNaN(refDate.getTime())) return null;
  refDate.setHours(0, 0, 0, 0);

  const hasStarted = refDate >= cycleStart;

  const lastMonthOffset = Math.max(periodMonths - 1, 0);
  const lastMonthStart = addMonthsAligned(cycleStart, lastMonthOffset, anchorDay);
  const nextIncreaseDate = addMonthsAligned(cycleStart, periodMonths, anchorDay);
  if (!nextIncreaseDate || Number.isNaN(nextIncreaseDate.getTime())) return null;

  const currentCycleEnd = new Date(nextIncreaseDate);
  currentCycleEnd.setDate(currentCycleEnd.getDate() - 1);
  currentCycleEnd.setHours(0, 0, 0, 0);

  let hasUpcomingIncrease = false;
  if (Array.isArray(aumentos) && aumentos.length) {
    hasUpcomingIncrease = aumentos.some((item) => {
      const appliesFrom =
        dayAfter(item?.hasta) || item?.aplicaDesde || item?.desde;
      const applyDate = parseYMD(appliesFrom);
      if (!applyDate) return false;
      applyDate.setHours(0, 0, 0, 0);
      return (
        nextIncreaseDate &&
        !Number.isNaN(nextIncreaseDate.getTime()) &&
        applyDate.getTime() === nextIncreaseDate.getTime()
      );
    });
  }

  let hasCurrentIncrease = false;
  let nextIncreaseAumento = null;
  if (Array.isArray(aumentos) && aumentos.length) {
    aumentos.forEach((item) => {
      const appliesFrom =
        dayAfter(item?.hasta) || item?.aplicaDesde || item?.desde;
      const applyDate = parseYMD(appliesFrom);
      if (!applyDate) return;
      applyDate.setHours(0, 0, 0, 0);
      if (applyDate.getTime() === cycleStart.getTime()) {
        hasCurrentIncrease = true;
      } else if (
        !nextIncreaseAumento &&
        applyDate.getTime() === nextIncreaseDate.getTime()
      ) {
        nextIncreaseAumento = item;
      }
    });
  }

  const hasPendingNextIncrease =
    Boolean(nextIncreaseDate) && !nextIncreaseAumento;

  const isOverdue =
    !hasUpcomingIncrease && hasPendingNextIncrease && refDate > currentCycleEnd;
  const isLastMonth =
    !hasUpcomingIncrease &&
    hasPendingNextIncrease &&
    !isOverdue &&
    refDate >= lastMonthStart;

  return {
    currentCycleStart: cycleStart,
    currentCycleEnd,
    nextIncreaseDate,
    hasUpcomingIncrease,
    hasCurrentIncrease,
    isLastMonth,
    isOverdue,
    hasStarted,
    referenceDate: refDate,
    hasPendingNextIncrease,
  };
};
