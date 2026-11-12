import { useEffect, useRef, useState } from 'react';

const fmt = (v: number | null) => (v === null ? '' : String(Math.round(v * 100) / 100));

/**
 * Numeric text input that keeps the user's raw text while typing ("62." / "62,5")
 * and commits parsed numbers upward. Uses the iOS decimal/numeric keypad.
 */
export function NumInput({
  value,
  onCommit,
  placeholder,
  integer,
  ariaLabel,
  className,
  id,
  max = 99999,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  placeholder?: string;
  integer?: boolean;
  ariaLabel: string;
  className?: string;
  id?: string;
  max?: number;
}) {
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value]);

  return (
    <input
      className={className}
      id={id}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      inputMode={integer ? 'numeric' : 'decimal'}
      pattern={integer ? '[0-9]*' : undefined}
      enterKeyHint="done"
      autoComplete="off"
      onFocus={(e) => {
        focused.current = true;
        // Select on focus so a new value replaces the old one in one go.
        const el = e.currentTarget;
        requestAnimationFrame(() => el.select());
      }}
      onBlur={() => {
        focused.current = false;
        setText(fmt(value));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
      }}
      onChange={(e) => {
        let t = e.target.value.replace(',', '.').replace(/[^\d.]/g, '');
        if (integer) t = t.replace(/\./g, '');
        const parts = t.split('.');
        if (parts.length > 2) t = `${parts[0]}.${parts.slice(1).join('')}`;
        setText(t);
        if (t === '' || t === '.') return onCommit(null);
        const n = Number(t);
        if (Number.isFinite(n)) onCommit(Math.min(n, max));
      }}
    />
  );
}
