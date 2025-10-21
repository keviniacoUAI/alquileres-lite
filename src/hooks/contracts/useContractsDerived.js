import { useCallback, useMemo } from "react";
import { contractStatus } from "../../utils/dates";

export function useContractsDerived({
  items,
  query,
  statusFilter,
  paymentFilter,
  paymentStatus,
  pageSize,
  currentPage,
  setCurrentPageState,
  setPageSizeState,
}) {
  const filtered = useMemo(() => {
    const normalizedQuery = query.toLowerCase();

    const byText = items.filter(
      (contrato) =>
        String(contrato.domicilio || "")
          .toLowerCase()
          .includes(normalizedQuery) ||
        String(contrato.inquilino || "")
          .toLowerCase()
          .includes(normalizedQuery),
    );

    const byContractStatus =
      statusFilter === "all"
        ? byText
        : byText.filter((contrato) => {
            const st = contractStatus(contrato);
            if (statusFilter === "expired") return st === "expired";
            if (statusFilter === "soon") return st === "soon";
            if (statusFilter === "active_or_soon")
              return st === "soon" || st === "ok";
            return true;
          });

    if (paymentFilter === "all") return byContractStatus;

    return byContractStatus.filter((contrato) => {
      const st = paymentStatus[contrato.id] || "unknown";
      if (paymentFilter === "paid") return st === "paid";
      if (paymentFilter === "partial") return st === "partial";
      if (paymentFilter === "pending") return st === "pending";
      if (paymentFilter === "unknown")
        return st === "unknown" || st === "loading";
      return true;
    });
  }, [items, paymentFilter, paymentStatus, query, statusFilter]);

  const totalPages = useMemo(() => {
    const total = filtered.length;
    if (total <= 0) return 1;
    const size = Math.max(1, Number(pageSize) || 1);
    return Math.max(1, Math.ceil(total / size));
  }, [filtered.length, pageSize]);

  const paginated = useMemo(() => {
    if (!filtered.length) return [];
    const size = Math.max(1, Number(pageSize) || 1);
    const total = filtered.length;
    const start = (currentPage - 1) * size;
    const normalizedStart = Math.max(0, Math.floor(start));
    if (normalizedStart >= total) return [];
    return filtered.slice(normalizedStart, normalizedStart + size);
  }, [filtered, currentPage, pageSize]);

  const setPage = useCallback(
    (page) => {
      if (page == null) return;
      const numeric = Number(page);
      if (!Number.isFinite(numeric)) return;
      const floored = Math.floor(numeric);
      const bounded = Math.min(Math.max(floored || 1, 1), totalPages || 1);
      setCurrentPageState(bounded);
    },
    [setCurrentPageState, totalPages],
  );

  const setPageSize = useCallback(
    (size) => {
      const numeric = Number(size);
      const next =
        Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 10;
      setPageSizeState(next);
      setCurrentPageState(1);
    },
    [setCurrentPageState, setPageSizeState],
  );

  return {
    filtered,
    paginated,
    totalPages,
    setPage,
    setPageSize,
  };
}
