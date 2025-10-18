import React from "react";

export default function ToastMessage({ toast, onClose }) {
  if (!toast) return null;

  const { show, type = "success", text } = toast;
  const icon = type === "success" ? "OK" : "!!";

  return (
    <div
      className={[
        "fixed right-4 bottom-4 z-50 transition-all duration-300",
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div
        className={[
          "min-w-[240px] max-w-[360px] rounded-xl shadow-lg border px-4 py-3 flex items-start gap-3 bg-white",
          type === "success" ? "border-emerald-200" : "border-red-200",
        ].join(" ")}
      >
        <div className={type === "success" ? "text-emerald-600" : "text-red-600"} aria-hidden="true">
          {icon}
        </div>
        <div className="text-sm">
          <p className="font-medium">
            {type === "success" ? "Operacion exitosa" : "Ocurrio un problema"}
          </p>
          <p className="text-gray-600">{text}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-auto text-gray-400 hover:text-gray-600"
          aria-label="Cerrar notificación"
          type="button"
        >
          x
        </button>
      </div>
    </div>
  );
}
