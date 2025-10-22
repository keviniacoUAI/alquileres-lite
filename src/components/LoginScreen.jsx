import { useEffect, useState } from "react";
import { BUTTON_STYLES } from "../constants/ui";
import { useAuth } from "../hooks/useAuth";
import ApiEnvironmentSwitcher from "./ApiEnvironmentSwitcher";

export default function LoginScreen() {
  const { login, error, status, usingFallbackHashes, loginHint } = useAuth();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEnvOptions, setShowEnvOptions] = useState(false);

  useEffect(() => {
    setMessage(error);
  }, [error]);

  useEffect(() => {
    if (status === "checking") {
      setPassword("");
      setMessage("");
    }
  }, [status]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage("");

    const result = await login(password);
    if (!result.ok && result.message) {
      setMessage(result.message);
    }
    if (result.ok) {
      setPassword("");
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    }

    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-white shadow-xl rounded-2xl p-6 space-y-5 border border-slate-200">
        <header className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-slate-800">Acceso privado</h1>
          <p className="text-sm text-slate-500">
            Ingresá la clave de administración para continuar.
          </p>
        </header>

        {usingFallbackHashes && (
          <div className="text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-xl px-3 py-2">
            Actualmente se usa la clave de ejemplo. Cambiala en <code>.env</code> con tus propios
            hashes SHA-256.
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2 text-sm">
            <label htmlFor="passcode" className="block text-sm font-medium text-slate-600">
              Clave de acceso
            </label>
            <div className="relative">
              <input
                id="passcode"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting || status === "checking"}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded-full"
              >
                <span className="sr-only">
                  {showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M1.5 12s3.5-6 10.5-6 10.5 6 10.5 6-3.5 6-10.5 6S1.5 12 1.5 12z" />
                  <circle cx="12" cy="12" r={3.2} />
                  {showPassword && (
                    <line x1="4" y1="4" x2="20" y2="20" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {message && <p className="text-sm text-red-600">{message}</p>}

          <button
            type="submit"
            disabled={submitting || status === "checking"}
            className={`${BUTTON_STYLES.base} ${BUTTON_STYLES.primary} ${BUTTON_STYLES.md} w-full`}
          >
            {submitting ? "Validando..." : "Ingresar"}
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-2 text-[11px] text-slate-500">
          <button
            type="button"
            onClick={() => setShowEnvOptions((prev) => !prev)}
            className="flex w-full items-center justify-between font-semibold text-slate-600 hover:text-slate-800 focus:outline-none"
          >
            <span>Opciones avanzadas</span>
            <span aria-hidden="true">{showEnvOptions ? "▾" : "▸"}</span>
          </button>
          {showEnvOptions && (
            <div className="pt-2 border-t border-slate-200">
              <ApiEnvironmentSwitcher selectClassName="w-full text-xs" size="sm" />
            </div>
          )}
        </div>

        {loginHint && (
          <p className="text-xs text-slate-500 text-center border-t border-slate-100 pt-3">
            {loginHint}
          </p>
        )}
      </div>
    </div>
  );
}
