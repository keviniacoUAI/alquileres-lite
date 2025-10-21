import { useCallback, useState } from "react";
import { createOrUpdateContrato, deleteContrato } from "../../services/api";
import { parseYMD, toYMD, todayISO } from "../../utils/dates";

export function useContractsEditor({
  items,
  setItems,
  lastPrice,
  setLastPrice,
  setLastPriceSince,
  setCurrentPrice,
  aumByContrato,
  resolvePriceStart,
  setEditingAum,
  setEditingPago,
  setOpenMenuId,
  showToast,
  setSaving,
}) {
  const [editing, setEditing] = useState(null);
  const [editingMode, setEditingMode] = useState(null);

  const startNew = useCallback(() => {
    setEditingMode("create");
    setEditing({
      id: "",
      domicilio: "",
      inquilino: "",
      contacto: "",
      inicio: todayISO(),
      fin: "",
      precioMensual: 0,
      aumento: "IPC",
      periodicidad: "M",
      notas: "",
    });
  }, []);

  const startEdit = useCallback(
    (contrato) => {
      setEditing({ ...contrato });
      setEditingMode("edit");
      if (setOpenMenuId) setOpenMenuId(null);
    },
    [setOpenMenuId],
  );

  const startView = useCallback(
    (contrato) => {
      setEditing({ ...contrato });
      setEditingMode("view");
      if (setEditingAum) setEditingAum(null);
      if (setEditingPago) setEditingPago(null);
      if (setOpenMenuId) setOpenMenuId(null);
    },
    [setEditingAum, setEditingPago, setOpenMenuId],
  );

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setEditingMode(null);
  }, []);

  const saveEdit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!editing) return;

      const inicio = editing.inicio ? parseYMD(editing.inicio) : null;
      const fin = editing.fin ? parseYMD(editing.fin) : null;
      if (inicio && fin && inicio > fin) {
        if (showToast) showToast("Inicio no puede ser mayor a fin", "error");
        return;
      }

      const isCreate = !editing.id;
      try {
        setSaving(true);
        const response = await createOrUpdateContrato(editing);

        if (isCreate) {
          const newId = response.id || String(Date.now());
          const nuevo = { ...editing, id: newId };
          setItems((list) => [nuevo, ...list]);
          setLastPrice((state) => ({
            ...state,
            [newId]: Number(nuevo.precioMensual || 0),
          }));
          setCurrentPrice((state) => ({
            ...state,
            [newId]: Number(nuevo.precioMensual || 0),
          }));
          setLastPriceSince((state) => ({
            ...state,
            [newId]: toYMD(nuevo.inicio),
          }));
        } else {
          setItems((list) =>
            list.map((item) =>
              item.id === editing.id ? { ...item, ...editing } : item,
            ),
          );
          setLastPrice((state) => {
            const prev = state[editing.id];
            const nuevoBase = Number(editing.precioMensual || 0);
            return { ...state, [editing.id]: prev ?? nuevoBase };
          });
          setCurrentPrice((state) => ({
            ...state,
            [editing.id]: Number(editing.precioMensual || 0),
          }));
          const contratoBase = items.find((item) => item.id === editing.id);
          const since = resolvePriceStart(
            { ...contratoBase, ...editing },
            aumByContrato[editing.id],
          );
          setLastPriceSince((state) => ({ ...state, [editing.id]: since }));
        }

        setEditing(null);
        setEditingMode(null);
        if (showToast) showToast("Guardado", "success");
      } catch (err) {
        console.error(err);
        if (showToast) showToast(err.message || "Error guardando", "error");
      } finally {
        setSaving(false);
      }
    },
    [
      editing,
      items,
      setItems,
      setLastPrice,
      setLastPriceSince,
      setCurrentPrice,
      resolvePriceStart,
      aumByContrato,
      setSaving,
      showToast,
    ],
  );

  const onDelete = useCallback(
    async (contrato) => {
      if (setOpenMenuId) setOpenMenuId(null);
      if (
        !confirm(
          `Eliminar el contrato de ${contrato.inquilino} en "${contrato.domicilio}"?`,
        )
      ) {
        return;
      }
      try {
        setSaving(true);
        await deleteContrato(contrato.id);
        setItems((list) => list.filter((item) => item.id !== contrato.id));
        setLastPrice((state) => {
          const copy = { ...state };
          delete copy[contrato.id];
          return copy;
        });
        setCurrentPrice((state) => {
          const copy = { ...state };
          delete copy[contrato.id];
          return copy;
        });
        setLastPriceSince((state) => {
          const copy = { ...state };
          delete copy[contrato.id];
          return copy;
        });
        if (showToast) showToast("Eliminado", "success");
      } catch (err) {
        console.error(err);
        if (showToast) showToast(err.message || "Error eliminando", "error");
      } finally {
        setSaving(false);
      }
    },
    [
      setOpenMenuId,
      setSaving,
      setItems,
      setLastPrice,
      setCurrentPrice,
      setLastPriceSince,
      showToast,
    ],
  );

  return {
    editing,
    setEditing,
    editingMode,
    setEditingMode,
    startNew,
    startEdit,
    startView,
    cancelEdit,
    saveEdit,
    onDelete,
  };
}
