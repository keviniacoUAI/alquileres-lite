import { parseYMD, dayAfter } from "./dates";

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
