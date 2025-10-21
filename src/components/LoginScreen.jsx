import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { BUTTON_STYLES } from "../constants/ui";

export default function LoginScreen() {
  const { login, error, status, usingFallbackHashes, loginHint } = useAuth();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          <div className="space-y-2">
            <label htmlFor="passcode" className="block text-sm font-medium text-slate-600">
              Clave de acceso
            </label>
            <input
              id="passcode"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting || status === "checking"}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
            />
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

        {loginHint && (
          <p className="text-xs text-slate-500 text-center border-t border-slate-100 pt-3">
            {loginHint}
          </p>
        )}
      </div>
    </div>
  );
}
