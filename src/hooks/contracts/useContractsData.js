import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadList } from "../../services/api";
import { todayISO, toYMD } from "../../utils/dates";
import { toMonthKey } from "../../utils/contracts";
import { useApiEnv } from "../../context/ApiEnvContext";

const DEFAULT_PAGE_SIZE = 10;

export function useContractsData({ showToast }) {
  const { current } = useApiEnv();
  const environmentId = current?.id || "default";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPageState] = useState(1);

  const [lastPrice, setLastPrice] = useState({});
  const [lastPriceSince, setLastPriceSince] = useState({});
  const [currentPrice, setCurrentPrice] = useState({});
  const environmentRef = useRef(environmentId);

  useEffect(() => {
    environmentRef.current = environmentId;
  }, [environmentId]);

  const currentPeriod = useMemo(() => toMonthKey(todayISO()), []);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadList();
      if (environmentRef.current !== environmentId) return;
      setItems(list);

      const lp = {};
      const cp = {};
      const lpSince = {};

      for (const contrato of list) {
        lp[contrato.id] = Number(
          contrato.lastPrecio ?? contrato.precioMensual ?? 0,
        );
        cp[contrato.id] = Number(
          contrato.currentPrecio ??
            contrato.lastPrecio ??
            contrato.precioMensual ??
            0,
        );
        const fallback =
          contrato.currentPrecioDesde ||
          contrato.ultimaActualizacion ||
          contrato.inicio ||
          "";
        lpSince[contrato.id] = toYMD(fallback);
      }

      if (environmentRef.current !== environmentId) return;
      setLastPrice(lp);
      setCurrentPrice(cp);
      setLastPriceSince(lpSince);
    } catch (err) {
      console.error(err);
      if (environmentRef.current === environmentId && showToast) {
        showToast("Error cargando datos", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [environmentId, showToast]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    setItems([]);
    setLastPrice({});
    setLastPriceSince({});
    setCurrentPrice({});
    setCurrentPageState(1);
  }, [environmentId]);

  useEffect(() => {
    setCurrentPageState(1);
  }, [query, statusFilter, paymentFilter]);

  const updateItems = useCallback((updater) => {
    setItems((prev) => {
      if (typeof updater === "function") return updater(prev);
      return Array.isArray(updater) ? updater : prev;
    });
  }, []);

  return {
    // data
    items,
    setItems: updateItems,
    loadContracts,
    loading,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
    pageSize,
    setPageSizeState,
    currentPage,
    setCurrentPageState,
    currentPeriod,
    lastPrice,
    setLastPrice,
    lastPriceSince,
    setLastPriceSince,
    currentPrice,
    setCurrentPrice,
  };
}
