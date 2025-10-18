import React from "react";

export default function StatusLegend() {
  return (
    <div className="max-w-[1320px] mx-auto mb-2">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-100">
          <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true"></span>
          Vencido
        </span>
        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
          <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true"></span>
          Proximo a vencer (= 3 meses)
        </span>
        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
          <span className="h-2 w-2 rounded-full bg-gray-400" aria-hidden="true"></span>
          Vigente
        </span>
      </div>
    </div>
  );
}
