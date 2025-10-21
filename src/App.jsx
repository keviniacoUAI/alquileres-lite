import React from "react";
import ContractsHeader from "./components/ContractsHeader";
import StatusLegend from "./components/StatusLegend";
import ContractRow from "./components/ContractRow";
import ContractPanel from "./components/ContractPanel";
import ContractPaymentsTab from "./components/ContractPaymentsTab";
import ContractIncreasesTab from "./components/ContractIncreasesTab";
import AumModal from "./components/AumModal";
import ToastMessage from "./components/ToastMessage";
import LoginScreen from "./components/LoginScreen";
import { useContractsPage } from "./hooks/useContractsPage";
import { useAuth } from "./hooks/useAuth";

function ContractsApp() {
  const {
    filtered,
    paginated,
    loading,
    query,
    statusFilter,
    paymentFilter,
    editing,
    editingMode,
    aumByContrato,
    editingAum,
    deletingAumId,
    aumLoadingList,
    aumCalculating,
    aumError,
    lastPrice,
    lastPriceSince,
    currentPrice: currentPriceMap,
    paymentsByContrato,
    paymentsLoading,
    paymentsError,
    paymentStatus,
    editingPago,
    savingPago,
    openMenuId,
    menuRef,
    saving,
    toast,
    pageSize,
    currentPage,
    totalPages,
    currentPeriod,
    setQuery,
    setStatusFilter,
    setPaymentFilter,
    setEditing,
    setEditingMode,
    setOpenMenuId,
    setEditingAum,
    startNew,
    startEdit,
    startView,
    startNewPago,
    startEditPago,
    cancelEdit,
    saveEdit,
    onDelete,
    startNewAum,
    startEditAum,
    cancelAum,
    onCalcProximoAumento,
    handlePorcentajeChange,
    handleNuevoPrecioChange,
    saveAum,
    onDeleteAum,
    cancelPago,
    savePago,
    onDeletePago,
    loadPayments,
    loadAumentos,
    resolveMonthlyTotal,
    paymentDueDate,
    hideToast,
    setPage,
    setPageSize,
  } = useContractsPage();
  const { logout } = useAuth();

  const currentPayments = editing?.id ? paymentsByContrato[editing.id] : null;
  const paymentsLoadingState = editing?.id ? Boolean(paymentsLoading[editing.id]) : false;
  const paymentsErrorState = editing?.id ? paymentsError[editing.id] : null;

  const lastPriceValue = editing ? Number(lastPrice[editing.id] ?? editing.precioMensual ?? 0) : null;
  const priceEffectiveSince = editing?.id ? lastPriceSince[editing.id] : null;
  const currentPaymentStatus = editing?.id ? paymentStatus[editing.id] : null;
  const currentMonthlyTotal =
    editing?.id != null
      ? (
          currentPriceMap[editing.id] != null
            ? currentPriceMap[editing.id]
            : resolveMonthlyTotal(editing, currentPeriod)
        )
      : null;

  const currentAumentos = editing?.id ? aumByContrato[editing.id] : null;
  const aumLoadingState = editing?.id ? Boolean(aumLoadingList[editing.id]) : false;
  const aumErrorState = editing?.id ? aumError[editing.id] : null;
  const aumCalculatingState = editing?.id ? Boolean(aumCalculating[editing.id]) : false;

  const isViewMode = editingMode === "view";
  const totalRecords = filtered.length;
  const pageStartIndex =
    totalRecords === 0
      ? 0
      : Math.min((currentPage - 1) * pageSize, Math.max(totalRecords - paginated.length, 0));
  const pageEndIndex =
    totalRecords === 0
      ? 0
      : paginated.length
      ? pageStartIndex + paginated.length - 1
      : pageStartIndex;

  const paymentsTab =
    editing && editing.id
      ? (
          <ContractPaymentsTab
            contrato={editing}
            payments={currentPayments}
            loading={paymentsLoadingState}
            error={paymentsErrorState}
            onReload={() => loadPayments(editing, { force: true })}
            onStartNewPago={(periodo) => startNewPago(editing, periodo)}
            onEditPago={(pago) => startEditPago(editing, pago)}
            onCancelPago={cancelPago}
            onSavePago={savePago}
            onDeletePago={(pagoId) => onDeletePago(editing.id, pagoId)}
            editingPago={editingPago && editingPago.contratoId === editing.id ? editingPago : null}
            savingPago={savingPago}
            resolveMonthlyTotal={resolveMonthlyTotal}
            paymentDueDate={paymentDueDate}
            readOnly={isViewMode}
          />
        )
      : null;

  const increasesTab =
    editing && editing.id
      ? (
          <ContractIncreasesTab
            contrato={editing}
            aumentos={currentAumentos}
            loading={aumLoadingState}
            error={aumErrorState}
            calculando={aumCalculatingState}
            deletingId={deletingAumId}
            saving={saving}
            onReload={() => loadAumentos(editing, { force: true })}
            onCalcular={() => onCalcProximoAumento(editing)}
            onNuevo={() => startNewAum(editing)}
            onEdit={startEditAum}
            onDelete={onDeleteAum}
            readOnly={isViewMode}
          />
        )
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <ContractsHeader
        query={query}
        onQueryChange={setQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
        onNewContract={startNew}
        onLogout={logout}
      />

      <main className="max-w-[1320px] mx-auto p-4">
        <StatusLegend />

        <div className="bg-white rounded-2xl shadow-sm border px-4 pr-8 py-2 mt-3 flex flex-col">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-2">
            <p className="text-sm text-gray-600">
              {totalRecords === 1
                ? "1 contrato encontrado"
                : `${totalRecords} contratos encontrados`}
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Mostrar
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1.5 border rounded-lg bg-white"
              >
                {[10, 15, 20, 30].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              por página
            </label>
          </div>

          <table className="w-full text-sm table-auto border-collapse">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
            </colgroup>

            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="text-left p-3">Domicilio</th>
                <th className="text-left p-3">Inquilino</th>
                <th className="text-left p-3">Inicio</th>
                <th className="text-left p-3">Fin</th>
                <th className="text-right p-3">Precio inicial</th>
                <th className="text-right p-3">Precio vigente</th>
                <th className="text-left p-3">Aumento</th>
                <th className="text-left p-3">Period.</th>
                <th className="text-left p-3">Cobro</th>
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
              {!loading && totalRecords === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    Sin registros
                  </td>
                </tr>
              )}
              {!loading &&
                paginated.map((r) => (
                  <ContractRow
                    key={r.id}
                    r={r}
                    startEdit={startEdit}
                    onDelete={onDelete}
                    saving={saving}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    menuRef={menuRef}
                    paymentStatus={paymentStatus[r.id]}
                    currentPrice={
                      currentPriceMap[r.id] != null
                        ? currentPriceMap[r.id]
                        : resolveMonthlyTotal(r, currentPeriod)
                    }
                    onView={startView}
                  />
                ))}
            </tbody>
          </table>

          {totalRecords > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3 text-sm text-gray-600 border-t mt-3">
              <span>
                Mostrando{" "}
                {`${pageStartIndex + 1} - ${pageEndIndex + 1} de ${totalRecords}`}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span>
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-3">* Peluca Approved</p>
      </main>

      <ContractPanel
        editing={editing}
        mode={editingMode}
        saving={saving}
        onCancel={cancelEdit}
        onSubmit={saveEdit}
        setEditing={setEditing}
        setMode={setEditingMode}
        lastPriceValue={lastPriceValue}
        lastPriceSince={priceEffectiveSince}
        currentPaymentStatus={currentPaymentStatus}
        currentMonthlyTotal={currentMonthlyTotal}
        increasesSlot={increasesTab}
        paymentsSlot={paymentsTab}
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

export default function App() {
  const { status, isAuthenticated } = useAuth();

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-600">Verificando acceso...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <ContractsApp />;
}
