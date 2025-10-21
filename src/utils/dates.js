// Helpers de fecha y periodos usados por la app
export function parseYMD(s) {
  if (!s) return null;
  const parts = String(s).slice(0, 10).split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function toYMD(x) {
  if (!x) return "";
  if (typeof x === "string" && x.length >= 10) return x.slice(0, 10);
  const d = x instanceof Date ? x : parseYMD(x);
  if (!d || isNaN(d)) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function fmtDateAR(x) {
  if (!x) return "";
  const s = String(x).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

export const todayISO = () => toYMD(new Date());

export function monthSpan(fromYMD, toYMD) {
  const s = parseYMD(fromYMD);
  const e = parseYMD(toYMD);
  const end = new Date(e.getFullYear(), e.getMonth() + 1, 0);
  const out = [];
  let y = s.getFullYear(),
    m = s.getMonth();
  while (new Date(y, m, 1) <= end) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m++;
    if (m === 12) {
      m = 0;
      y++;
    }
  }
  return out;
}

export function monthLabelES(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "short", year: "numeric" });
}

export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

export function addDays(value, amount) {
  const base = value instanceof Date ? new Date(value) : parseYMD(value);
  if (!base || Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + amount);
  return base;
}

export function dayAfter(ymd) {
  const next = addDays(ymd, 1);
  return next ? toYMD(next) : "";
}

export function nextBusinessDay(date) {
  const base = date instanceof Date ? new Date(date) : parseYMD(date);
  if (!base || Number.isNaN(base.getTime())) return null;
  const adjusted = new Date(base);
  let day = adjusted.getDay();
  while (day === 0 || day === 6) {
    adjusted.setDate(adjusted.getDate() + 1);
    day = adjusted.getDay();
  }
  return adjusted;
}

export function paymentDueDate(periodo, day = 10) {
  if (!periodo) return "";
  const [yStr, mStr] = String(periodo).slice(0, 7).split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return "";
  const base = new Date(y, m - 1, day);
  const adjusted = nextBusinessDay(base);
  return adjusted ? toYMD(adjusted) : "";
}

export function addMonthsAligned(date, months, anchorDay) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = d.getMonth() + months;
  const first = new Date(y, m, 1);
  const day = Math.min(anchorDay, daysInMonth(first.getFullYear(), first.getMonth()));
  return new Date(first.getFullYear(), first.getMonth(), day);
}

export function nextCycleStart(contractStart, periodMonths, afterDate) {
  const start = new Date(contractStart);
  const anchor = start.getDate();
  let candidate = addMonthsAligned(start, periodMonths, anchor);
  while (candidate <= afterDate) {
    candidate = addMonthsAligned(candidate, periodMonths, anchor);
  }
  return candidate;
}

export function cycleEnd(fromDate, periodMonths, anchorDay) {
  const nextStart = addMonthsAligned(fromDate, periodMonths, anchorDay);
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  return end;
}

// Estado del contrato según la fecha de fin
export function contractStatus(c) {
  const f = parseYMD(c.fin);
  if (!f) return 'ok';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((f - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 92) return 'soon';
  return 'ok';
}
