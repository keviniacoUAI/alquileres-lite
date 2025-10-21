export const BUTTON_STYLES = Object.freeze({
  base:
    "inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed",
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-400",
  outline: "border text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-300",
  outlineBlue: "border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 focus:ring-blue-300",
  dangerOutline: "border border-red-600 text-red-600 bg-white hover:bg-red-50 focus:ring-red-300",
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2",
});

export const PERIOD_LABELS = Object.freeze({
  M: "Mensual",
  B: "Bimestral",
  T: "Trimestral",
  Q: "Cuatrimestral",
  S: "Semestral",
});

export const PERIOD_MONTHS = Object.freeze({
  M: 1,
  B: 2,
  T: 3,
  Q: 4,
  S: 6,
});
