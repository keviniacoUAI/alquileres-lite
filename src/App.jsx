import React from "react";
import ContractsHeader from "./components/ContractsHeader";
import StatusLegend from "./components/StatusLegend";
import ContractRow from "./components/ContractRow";
import ContractModal from "./components/ContractModal";
import AumModal from "./components/AumModal";
import ToastMessage from "./components/ToastMessage";
import { useContractsPage } from "./hooks/useContractsPage";

export default function App() {
  const {
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
    setQuery,
    setStatusFilter,
    setEditing,
    setOpenMenuId,
    setEditingAum,
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
    hideToast,
  } = useContractsPage();

  return (
    <div className="min-h-screen bg-gray-50">
      <ContractsHeader
        query={query}
        onQueryChange={setQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onNewContract={startNew}
      />

      <main className="max-w-[1320px] mx-auto p-4">
        <StatusLegend />

        <div className="bg-white rounded-2xl shadow-sm border px-4 pr-8 py-2 mt-3">
          <table className="w-full text-sm table-auto border-collapse">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[12%]" />
            </colgroup>

            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="text-left p-3">Domicilio</th>
                <th className="text-left p-3">Inquilino</th>
                <th className="text-left p-3">Contacto</th>
                <th className="text-left p-3">Inicio</th>
                <th className="text-left p-3">Fin</th>
                <th className="text-right p-3">Precio base</th>
                <th className="text-right p-3">Ultimo precio</th>
                <th className="text-left p-3">Aumento</th>
                <th className="text-left p-3">Period.</th>
                <th className="text-right p-3">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    Sin registros
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((r) => (
                  <ContractRow
                    key={r.id}
                    r={r}
                    expandedId={expandedId}
                    toggleExpand={toggleExpand}
                    startEdit={startEdit}
                    onDelete={onDelete}
                    saving={saving}
                    aum={aumByContrato[r.id] || []}
                    startNewAum={startNewAum}
                    startEditAum={startEditAum}
                    onDeleteAum={onDeleteAum}
                    lastPrice={lastPrice}
                    deletingAumId={deletingAumId}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    menuRef={menuRef}
                    aumLoadingList={aumLoadingList}
                    aumCalculating={aumCalculating}
                    aumError={aumError}
                    onCalcProximoAumento={onCalcProximoAumento}
                  />
                ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-3">* Peluca Approved</p>
      </main>

      <ContractModal
        editing={editing}
        saving={saving}
        onCancel={cancelEdit}
        onSubmit={saveEdit}
        setEditing={setEditing}
      />

      <AumModal
        editingAum={editingAum}
        saving={saving}
        onCancel={cancelAum}
        onSubmit={saveAum}
        setEditingAum={setEditingAum}
        handlePorcentajeChange={handlePorcentajeChange}
        handleNuevoPrecioChange={handleNuevoPrecioChange}
      />

      <ToastMessage toast={toast} onClose={hideToast} />

      <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-gray-500">
        <p>&copy; {new Date().getFullYear()} Alquileres Admin - MVP</p>
      </footer>
    </div>
  );
}
