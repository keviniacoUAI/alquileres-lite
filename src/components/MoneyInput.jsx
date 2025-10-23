import { forwardRef, useMemo } from "react";

const formatDigits = (digits) => {
  if (!digits) return "";
  const cleaned = digits.replace(/\D/g, "");
  if (!cleaned) return "";
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const MoneyInput = forwardRef(function MoneyInput(
  {
    value,
    onChange,
    className = "",
    placeholder = "0",
    disabled = false,
    required = false,
    name,
    ...rest
  },
  ref,
) {
  const digits = useMemo(() => {
    if (value == null) return "";
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
    if (typeof value === "string") return value.replace(/\D/g, "");
    return "";
  }, [value]);

  const formatted = formatDigits(digits);

  const handleChange = (event) => {
    const nextDigits = event.target.value.replace(/\D/g, "");
    if (onChange) onChange(nextDigits);
  };

  const handleFocus = (event) => {
    if (!digits) {
      requestAnimationFrame(() => {
        event.target.setSelectionRange(0, 0);
      });
    } else {
      event.target.setSelectionRange(event.target.value.length, event.target.value.length);
    }
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      name={name}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      value={formatted}
      onChange={handleChange}
      onFocus={handleFocus}
      className={className}
      {...rest}
    />
  );
});
