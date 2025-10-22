import { useApiEnv } from "../context/ApiEnvContext";

const SELECT_BASE =
  "border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const join = (...parts) => parts.filter(Boolean).join(" ");

export default function ApiEnvironmentSwitcher({
  label = "Ambiente",
  hideLabel = false,
  size = "md",
  className = "",
  selectClassName = "",
}) {
  const { environments, current, setEnvironment } = useApiEnv();

  if (!environments || environments.length <= 1) {
    return null;
  }

  const sizeClasses =
    size === "sm"
      ? "px-2 py-1.5 text-xs"
      : size === "lg"
      ? "px-4 py-2 text-sm"
      : "px-3 py-2 text-sm";

  const handleChange = (event) => {
    const nextId = event.target.value;
    if (nextId && nextId !== current?.id) {
      setEnvironment(nextId);
    }
  };

  return (
    <div className={join("flex flex-col gap-1", className)}>
      {!hideLabel && (
        <label className="text-xs font-medium text-slate-600">{label}</label>
      )}
      <select
        value={current?.id || ""}
        onChange={handleChange}
        className={join(SELECT_BASE, sizeClasses, selectClassName)}
        aria-label={hideLabel ? label : undefined}
      >
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>
    </div>
  );
}
