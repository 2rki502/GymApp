import { useRef, useState, type ReactNode } from 'react';
import { isRTL, t } from '@/i18n';
import { Icon, type IconName } from './Icon';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`segmented ${className ?? ''}`} role="tablist" style={{ ['--n' as string]: options.length, ['--i' as string]: idx }}>
      <div className="segmented-thumb" />
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="chips" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={`chip ${o.value === value ? 'is-active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** iOS inset-grouped list */
export function Group({ title, footer, children }: { title?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="group">
      {title && <div className="group-title">{title}</div>}
      <div className="group-body">{children}</div>
      {footer && <div className="group-footer">{footer}</div>}
    </section>
  );
}

export function Row({
  icon,
  iconColor,
  label,
  detail,
  value,
  onClick,
  chevron,
  destructive,
  children,
}: {
  icon?: IconName;
  iconColor?: string;
  label: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  children?: ReactNode;
}) {
  const content = (
    <>
      {icon && (
        <span className="row-icon" style={{ background: iconColor ?? 'var(--surface-3)' }}>
          <Icon name={icon} size={17} stroke={2.2} />
        </span>
      )}
      <span className="row-main">
        <span className={`row-label ${destructive ? 'is-destructive' : ''}`}>{label}</span>
        {detail && <span className="row-detail">{detail}</span>}
      </span>
      {value !== undefined && <span className="row-value">{value}</span>}
      {children}
      {chevron && <Icon name="chevronRight" size={16} stroke={2.4} className="row-chevron" />}
    </>
  );
  return onClick ? (
    <button className="row is-tappable" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="row">{content}</div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  format = (v: number) => String(v),
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  label: string;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button aria-label={t('common.decrease', { label })} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        <Icon name="minus" size={18} stroke={2.4} />
      </button>
      <span className="num">{format(value)}</span>
      <button aria-label={t('common.increase', { label })} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        <Icon name="plus" size={18} stroke={2.4} />
      </button>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/** Pointer capture throws if the pointer is no longer active; never let that break a gesture. */
export function capture(e: React.PointerEvent) {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* pointer already released */
  }
}

/**
 * Swipe toward the start edge to reveal a destructive action (iOS list behaviour):
 * left in LTR, right in RTL. Uses axis locking so vertical scrolling is never hijacked.
 * `x` is a logical offset (negative = revealed) mapped to screen direction.
 */
export function SwipeRow({ children, onDelete, label }: { children: ReactNode; onDelete: () => void; label?: string }) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const g = useRef<{ x0: number; y0: number; base: number; axis: 'x' | 'y' | null } | null>(null);
  const OPEN = -84;
  const dir = isRTL() ? -1 : 1;

  return (
    <div className="swipe">
      {(x !== 0 || dragging) && (
        <button className="swipe-action" onClick={onDelete}>
          {label ?? t('common.delete')}
        </button>
      )}
      <div
        className="swipe-content"
        style={{ transform: `translateX(${x * dir}px)`, transition: dragging ? 'none' : undefined }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          g.current = { x0: e.clientX, y0: e.clientY, base: x, axis: null };
        }}
        onPointerMove={(e) => {
          const s = g.current;
          if (!s) return;
          const dx = (e.clientX - s.x0) * dir;
          const dy = e.clientY - s.y0;
          if (!s.axis) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            if (s.axis === 'x') {
              capture(e);
              setDragging(true);
            }
          }
          if (s.axis === 'x') setX(Math.min(0, Math.max(OPEN * 1.6, s.base + dx)));
        }}
        onPointerUp={() => {
          const s = g.current;
          g.current = null;
          if (s?.axis !== 'x') return;
          setDragging(false);
          setX((v) => (v < OPEN / 2 ? OPEN : 0));
        }}
        onPointerCancel={() => {
          g.current = null;
          setDragging(false);
          setX(0);
        }}
        onClickCapture={(e) => {
          if (x !== 0) {
            e.stopPropagation();
            e.preventDefault();
            setX(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
