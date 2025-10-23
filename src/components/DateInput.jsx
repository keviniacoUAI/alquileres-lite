
import { useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { parseYMD, toYMD } from "../utils/dates";
import "./date-input.css";

const toDigits = (value) =>
  value == null ? "" : String(value).replace(/\D/g, "");

const formatDigits = (digits) => {
  if (!digits) return "";
  const only = digits.slice(0, 8);
  const parts = [];
  if (only.length <= 2) parts.push(only);
  else if (only.length <= 4) {
    parts.push(only.slice(0, 2));
    parts.push(only.slice(2));
  } else {
    parts.push(only.slice(0, 2));
    parts.push(only.slice(2, 4));
    parts.push(only.slice(4));
  }
  return parts.filter(Boolean).join("/");
};

const parseDigitsToDate = (digits) => {
  if (!digits || digits.length !== 8) return null;
  const dd = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const yyyy = Number(digits.slice(4));
  if (!dd || !mm || !yyyy) return null;
  const candidate = new Date(yyyy, mm - 1, dd);
  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getFullYear() !== yyyy ||
    candidate.getMonth() + 1 !== mm ||
    candidate.getDate() !== dd
  ) {
    return null;
  }
  return candidate;
};

const formatDisplay = (value) => {
  if (!value) return "";
  const date =
    value instanceof Date
      ? value
      : parseYMD(typeof value === "string" ? value : String(value));
  if (!date || Number.isNaN(date.getTime())) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export function DateInput({
  value,
  onChange,
  className = "",
  required = false,
  disabled = false,
  placeholder = "dd/mm/aaaa",
  minDate,
  maxDate,
  isClearable = true,
  ...rest
}) {
  const formattedValue = useMemo(() => formatDisplay(value), [value]);
  const [displayValue, setDisplayValue] = useState(formattedValue);
  const typingRef = useRef(false);

  useEffect(() => {
    if (!typingRef.current) {
      setDisplayValue(formattedValue);
    }
  }, [formattedValue]);

  const selectedDate = useMemo(() => {
    if (!value) return null;
    if (typingRef.current && displayValue !== formattedValue) return null;
    if (value instanceof Date) return value;
    return parseYMD(value);
  }, [displayValue, formattedValue, value]);

  const emitChange = (next) => {
    if (onChange) onChange(next);
  };

  const applyBounds = (date) => {
    if (!date) return date;
    let result = date;
    if (minDate && result < minDate) result = minDate;
    if (maxDate && result > maxDate) result = maxDate;
    return result;
  };

  const handleCalendarChange = (date, event) => {
    // Ignore programmatic onChange fired while the user is typing manually;
    // react-datepicker passes the originating event when the change comes from raw input.
    if (event) return;
    typingRef.current = false;
    const bounded = applyBounds(date);
    setDisplayValue(formatDisplay(bounded));
    emitChange(bounded ? toYMD(bounded) : "");
  };

  const handleInputChange = (event) => {
    typingRef.current = true;
    const digits = toDigits(event.target.value).slice(0, 8);
    const formatted = formatDigits(digits);
    setDisplayValue(formatted);
    if (!digits) {
      emitChange("");
      return;
    }
    if (digits.length === 8) {
      const parsed = parseDigitsToDate(digits);
      if (parsed) {
        const bounded = applyBounds(parsed);
        setDisplayValue(formatDisplay(bounded));
        emitChange(toYMD(bounded));
        typingRef.current = false;
      }
    }
  };

  const handleBlur = () => {
    typingRef.current = false;
    const digits = toDigits(displayValue);
    if (!digits) {
      emitChange("");
      setDisplayValue("");
      return;
    }
    if (digits.length !== 8) {
      emitChange("");
      setDisplayValue("");
      return;
    }
    const parsed = parseDigitsToDate(digits);
    if (!parsed) {
      emitChange("");
      setDisplayValue("");
      return;
    }
    const bounded = applyBounds(parsed);
    setDisplayValue(formatDisplay(bounded));
    emitChange(toYMD(bounded));
  };

  const handleFocus = (event) => {
    typingRef.current = true;
    if (!displayValue) return;
    const digits = toDigits(displayValue);
    if (digits.length !== 8) return;
    const target = event?.target;
    if (target && typeof target.select === "function") {
      setTimeout(() => {
        target.select();
      }, 0);
    }
  };

  const handleClear = (event) => {
    event.stopPropagation();
    typingRef.current = false;
    setDisplayValue("");
    emitChange("");
  };

  return (
    <div className="date-input-wrapper">
      <DatePicker
        selected={selectedDate}
        onChange={handleCalendarChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChangeRaw={handleInputChange}
        value={displayValue}
        dateFormat="dd/MM/yyyy"
        placeholderText={placeholder}
        disabled={disabled}
        className={`date-input-field ${className}`.trim()}
        minDate={minDate}
        maxDate={maxDate}
        isClearable={false}
        {...rest}
      />
      {!required && isClearable && displayValue && !disabled && (
        <button
          type="button"
          className="date-input-clear"
          onClick={handleClear}
          aria-label="Limpiar fecha"
        >
          ×
        </button>
      )}
    </div>
  );
}
