import { useCallback, useEffect, useRef, useState } from "react";

const INITIAL_TOAST = { show: false, type: "success", text: "" };

export function useToast(defaultDuration = 2000) {
  const [toast, setToast] = useState(INITIAL_TOAST);
  const timeoutRef = useRef(null);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  const showToast = useCallback(
    (text, type = "success", duration = defaultDuration) => {
      setToast({ show: true, type, text });

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, duration);
    },
    [defaultDuration]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { toast, showToast, hideToast };
}
