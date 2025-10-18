import React from "react";
import { BUTTON_STYLES } from "../constants/ui";

export default function ContractsHeader({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  onNewContract,
}) {
  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Alquileres <span className="text-blue-600">Admin</span>
        </h1>
        <div className="flex gap-2 items-center">
          <input
            type="search"
            placeholder="Buscar por domicilio o inquilino"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Filtrar por estado del contrato"
          >
            <option value="all">Todos</option>
            <option value="expired">Vencidos</option>
            <option value="soon">Por vencer (= 3 meses)</option>
            <option value="active_or_soon">Vigentes y por vencer</option>
          </select>

          <button
            onClick={onNewContract}
            className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.success} ${BUTTON_STYLES.md}`}
          >
            Nuevo
          </button>
        </div>
      </div>
    </header>
  );
}
