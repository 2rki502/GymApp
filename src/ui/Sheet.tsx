import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { capture } from './controls';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** left / right header actions (iOS "Cancel" / "Save") */
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  /** full-height sheet (pickers, editors) vs content-height */
  full?: boolean;
  className?: string;
}

const EXIT_MS = 280;

/**
 * iOS-style bottom sheet. Stays mounted during its exit animation, supports
 * drag-to-dismiss from the grabber/header, and closes on Escape.
 */
export function Sheet({ open, onClose, title, left, right, children, full, className }: Props) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setDrag(0);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, EXIT_MS);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, select')) return;
    start.current = e.clientY;
    capture(e);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (start.current === null) return;
    setDrag(Math.max(0, e.clientY - start.current));
  };
  const onPointerUp = () => {
    if (start.current === null) return;
    start.current = null;
    const h = panel.current?.offsetHeight ?? 600;
    if (drag > Math.min(140, h * 0.25)) onClose();
    else setDrag(0);
  };

  return createPortal(
    <div className={`sheet-root ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={panel}
        className={`sheet ${full ? 'sheet-full' : ''} ${className ?? ''}`}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      >
        <div className="sheet-head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div className="sheet-grabber" />
          {(title || left || right) && (
            <div className="sheet-bar">
              <div className="sheet-bar-side">{left}</div>
              <div className="sheet-title">{title}</div>
              <div className="sheet-bar-side sheet-bar-right">{right}</div>
            </div>
          )}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
