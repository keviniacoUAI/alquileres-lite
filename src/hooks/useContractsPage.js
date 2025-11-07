import { useEffect, useState, useCallback } from "react";
import { paymentDueDate, toYMD } from "../utils/dates";
import { PERIOD_MONTHS } from "../constants/ui";
import { resolveIncreaseStatus } from "../utils/contracts";
import { useToast } from "./useToast";
import { useContractsData } from "./contracts/useContractsData";
import { useContractPayments } from "./contracts/useContractPayments";
import { useContractAumentos } from "./contracts/useContractAumentos";
import { useContractsEditor } from "./contracts/useContractsEditor";
import { useContractsMenu } from "./contracts/useContractsMenu";
import { useContractsDerived } from "./contracts/useContractsDerived";
import { useApiEnv } from "../context/ApiEnvContext";

export function useContractsPage() {
  const { current } = useApiEnv();
  const environmentId = current?.id || "default";

  const { toast, showToast, hideToast } = useToast();
  const data = useContractsData({ showToast });

  const [saving, setSavingFlag] = useState(false);
  const [savingMessage, setSavingMessage] = useState("");
  const setSaving = useCallback((value, meta = {}) => {
    const next = Boolean(value);
    setSavingFlag(next);
    if (next) {
      if (typeof meta === "string") {
        setSavingMessage(meta);
      } else if (meta && typeof meta === "object" && meta.message) {
        setSavingMessage(meta.message);
      } else {
        setSavingMessage("Procesando...");
      }
    } else {
      setSavingMessage("");
    }
  }, []);
  const menu = useContractsMenu();

  const aumentos = useContractAumentos({
    items: data.items,
    lastPrice: data.lastPrice,
    setLastPrice: data.setLastPrice,
    lastPriceSince: data.lastPriceSince,
    setLastPriceSince: data.setLastPriceSince,
    setCurrentPrice: data.setCurrentPrice,
    showToast,
    saving,
    setSaving,
    environmentId,
  });

  const payments = useContractPayments({
    items: data.items,
    currentPeriod: data.currentPeriod,
    aumByContrato: aumentos.aumByContrato,
    currentPrice: data.currentPrice,
    lastPrice: data.lastPrice,
    showToast,
    environmentId,
  });

  const editor = useContractsEditor({
    items: data.items,
    setItems: data.setItems,
    setLastPrice: data.setLastPrice,
    setLastPriceSince: data.setLastPriceSince,
    setCurrentPrice: data.setCurrentPrice,
    aumByContrato: aumentos.aumByContrato,
    resolvePriceStart: aumentos.resolvePriceStart,
    setEditingAum: aumentos.setEditingAum,
    setEditingPago: payments.setEditingPago,
    setOpenMenuId: menu.setOpenMenuId,
    showToast,
    setSaving,
    environmentId,
  });

  const setMenuOpenId = menu.setOpenMenuId;
  const setPagoEditing = payments.setEditingPago;
  const setAumentoEditing = aumentos.setEditingAum;
  const cancelEdit = editor.cancelEdit;

  const derived = useContractsDerived({
    items: data.items,
    query: data.query,
    statusFilter: data.statusFilter,
    paymentFilter: data.paymentFilter,
    paymentStatus: payments.paymentStatus,
    pageSize: data.pageSize,
    currentPage: data.currentPage,
    setCurrentPageState: data.setCurrentPageState,
    setPageSizeState: data.setPageSizeState,
  });

  const { loadPayments } = payments;
  const { loadAumentos } = aumentos;

  useEffect(() => {
    if (!editor.editing?.id) return;
    const contrato = editor.editing;
    loadPayments(contrato);
    loadAumentos(contrato);
  }, [editor.editing, loadPayments, loadAumentos]);

  useEffect(() => {
    if (!Array.isArray(derived.paginated) || !derived.paginated.length) return;
    derived.paginated.forEach((contrato) => {
      if (!contrato?.id) return;
      const periodMonths = PERIOD_MONTHS[contrato.periodicidad] || 0;
      if (periodMonths <= 1) return;
      const since = data.lastPriceSince[contrato.id];
      const status = resolveIncreaseStatus(contrato, { lastPriceSince: since });
      if (status && (status.isLastMonth || status.isOverdue)) {
        loadAumentos(contrato, { silent: true });
      }
    });
  }, [data.lastPriceSince, derived.paginated, loadAumentos]);

  useEffect(() => {
    if (!Array.isArray(derived.paginated) || !derived.paginated.length) return;
    derived.paginated.forEach((contrato) => {
      if (!contrato?.id) return;
      loadAumentos(contrato, { silent: true });
    });
  }, [derived.paginated, loadAumentos]);

  useEffect(() => {
    cancelEdit();
    setMenuOpenId(null);
    setPagoEditing(null);
    setAumentoEditing(null);
  }, [
    cancelEdit,
    environmentId,
    setAumentoEditing,
    setMenuOpenId,
    setPagoEditing,
  ]);

  return {
    items: data.items,
    filtered: derived.filtered,
    paginated: derived.paginated,
    loading: data.loading,
    query: data.query,
    statusFilter: data.statusFilter,
    paymentFilter: data.paymentFilter,
    editing: editor.editing,
    editingMode: editor.editingMode,
    aumByContrato: aumentos.aumByContrato,
    editingAum: aumentos.editingAum,
    deletingAumId: aumentos.deletingAumId,
    aumLoadingList: aumentos.aumLoadingList,
    aumCalculating: aumentos.aumCalculating,
    aumError: aumentos.aumError,
    lastPrice: data.lastPrice,
    lastPriceSince: data.lastPriceSince,
    currentPrice: data.currentPrice,
    paymentsByContrato: payments.paymentsByContrato,
    paymentsLoading: payments.paymentsLoading,
    paymentsError: payments.paymentsError,
    paymentStatus: payments.paymentStatus,
    editingPago: payments.editingPago,
    savingPago: payments.savingPago,
    openMenuId: menu.openMenuId,
    menuRef: menu.menuRef,
    saving,
    savingMessage,
    toast,
    pageSize: data.pageSize,
    currentPage: data.currentPage,
    totalPages: derived.totalPages,
    currentPeriod: data.currentPeriod,
    setQuery: data.setQuery,
    setStatusFilter: data.setStatusFilter,
    setPaymentFilter: data.setPaymentFilter,
    setEditing: editor.setEditing,
    setEditingMode: editor.setEditingMode,
    setOpenMenuId: menu.setOpenMenuId,
    setEditingAum: aumentos.setEditingAum,
    setEditingPago: payments.setEditingPago,
    showToast,
    hideToast,
    setPage: derived.setPage,
    setPageSize: derived.setPageSize,
    startNew: editor.startNew,
    startCopy: editor.startCopy,
    startEdit: editor.startEdit,
    startView: editor.startView,
    startNewPago: payments.startNewPago,
    startEditPago: payments.startEditPago,
    cancelEdit: editor.cancelEdit,
    saveEdit: editor.saveEdit,
    onDelete: editor.onDelete,
    startNewAum: aumentos.startNewAum,
    startEditAum: aumentos.startEditAum,
    cancelAum: aumentos.cancelAum,
    onCalcProximoAumento: aumentos.onCalcProximoAumento,
    handlePorcentajeChange: aumentos.handlePorcentajeChange,
    handleNuevoPrecioChange: aumentos.handleNuevoPrecioChange,
    saveAum: aumentos.saveAum,
    onDeleteAum: aumentos.onDeleteAum,
    cancelPago: payments.cancelPago,
    savePago: payments.savePago,
    onDeletePago: payments.onDeletePago,
    loadPayments: payments.loadPayments,
    loadAumentos: aumentos.loadAumentos,
    resolveMonthlyTotal: payments.resolveMonthlyTotal,
    toYMD,
    paymentDueDate,
  };
}
