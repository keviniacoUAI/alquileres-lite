import { useCallback, useEffect, useRef, useState } from "react";

export function useContractsMenu() {
  const menuRef = useRef(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const closeMenu = useCallback(() => setOpenMenuId(null), []);

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) closeMenu();
    }
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [closeMenu]);

  return {
    openMenuId,
    setOpenMenuId,
    menuRef,
    closeMenu,
  };
}
