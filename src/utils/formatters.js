export const fmtMoney = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

export function toNumberPct(v) {
  if (v == null) return NaN;
  const s = String(v).replace("%", "").replace(",", ".").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

export function pctFromRow(a) {
  let n = toNumberPct(a.porcentaje);
  if (!Number.isFinite(n)) {
    const base = Number(a.basePrecio || 0);
    const nuevo = Number(a.nuevoPrecio || 0);
    if (base > 0 && nuevo > 0) n = ((nuevo / base) - 1) * 100;
  }
  return n;
}

export function fmtPctFromRow(a) {
  const n = pctFromRow(a);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "-";
}
