/**
 * Dependency-free SVG charts tuned for touch:
 * - LineChart: single series, monotone curve, soft area, optional goal line,
 *   press-and-drag crosshair with tooltip.
 * - BarChart: rounded-top bars with a 2px surface gap and per-bar tooltip.
 * - Sparkline, Ring: compact glanceable marks for cards.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { t } from '@/i18n';
import { capture } from './controls';

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Monotone cubic (Fritsch–Carlson) path: smooth without overshooting data. */
function monotonePath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push(dx[i] === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/** "Nice" axis ticks covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => span / s <= count) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1e6) / 1e6);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

export interface Point {
  x: number; // timestamp
  y: number;
}

interface LineProps {
  data: Point[];
  height?: number;
  color?: string;
  formatY: (v: number) => string;
  formatX: (x: number) => string;
  /** reference line, e.g. goal weight */
  goal?: { y: number; label: string };
  emptyText?: string;
  ariaLabel: string;
}

export function LineChart({ data, height = 200, color = 'var(--chart)', formatY, formatX, goal, emptyText = t('common.notEnoughData'), ariaLabel }: LineProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  const padL = 4;
  const padR = 40;
  const padT = 14;
  const padB = 24;

  const geom = useMemo(() => {
    if (data.length === 0 || width === 0) return null;
    const ys = data.map((d) => d.y);
    if (goal) ys.push(goal.y);
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys), 3);
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    const x0 = data[0].x;
    const x1 = data[data.length - 1].x;
    const iw = width - padL - padR;
    const ih = height - padT - padB;
    const sx = (x: number) => padL + (x1 === x0 ? iw / 2 : ((x - x0) / (x1 - x0)) * iw);
    const sy = (y: number) => padT + ih - ((y - y0) / (y1 - y0 || 1)) * ih;
    const pts = data.map((d) => [sx(d.x), sy(d.y)] as [number, number]);
    const line = monotonePath(pts);
    const area = `${line}L${pts[pts.length - 1][0]},${padT + ih}L${pts[0][0]},${padT + ih}Z`;
    const xLabels = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0];
    return { ticks, sy, pts, line, area, xLabels: [...new Set(xLabels)], ih };
  }, [data, width, height, goal]);

  const pick = (clientX: number) => {
    if (!geom || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < geom.pts.length; i++) if (Math.abs(geom.pts[i][0] - x) < Math.abs(geom.pts[best][0] - x)) best = i;
    setHover(best);
  };

  const h = hover !== null && geom ? geom.pts[hover] : null;
  const last = geom ? geom.pts[geom.pts.length - 1] : null;

  return (
    <div
      ref={ref}
      className="chart"
      dir="ltr"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        capture(e);
        pick(e.clientX);
      }}
      onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons ? pick(e.clientX) : undefined)}
      onPointerUp={(e) => e.pointerType !== 'mouse' && setHover(null)}
      onPointerLeave={() => setHover(null)}
      onPointerCancel={() => setHover(null)}
    >
      {!geom && width > 0 && <div className="chart-empty">{emptyText}</div>}
      {geom && (
        <svg width={width} height={height}>
          <defs>
            <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={0.22} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {geom.ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR + 4} y1={geom.sy(t)} y2={geom.sy(t)} className="chart-grid" />
              <text x={width - padR + 8} y={geom.sy(t) + 4} className="chart-axis">
                {formatY(t)}
              </text>
            </g>
          ))}
          {goal && (
            <g>
              <line x1={padL} x2={width - padR + 4} y1={geom.sy(goal.y)} y2={geom.sy(goal.y)} className="chart-goal" />
              <text x={padL + 2} y={geom.sy(goal.y) - 6} className="chart-goal-label">
                {goal.label}
              </text>
            </g>
          )}
          <path d={geom.area} fill={`url(#g${gid})`} />
          <path d={geom.line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {geom.pts.length <= 24 &&
            geom.pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} fill={color} opacity={0.55} />)}
          {last && !h && <circle cx={last[0]} cy={last[1]} r={5} fill={color} stroke="var(--surface)" strokeWidth={2.5} />}
          {geom.xLabels.map((i) => (
            <text
              key={i}
              x={geom.pts[i][0]}
              y={height - 6}
              textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
              className="chart-axis"
            >
              {formatX(data[i].x)}
            </text>
          ))}
          {h && (
            <g>
              <line x1={h[0]} x2={h[0]} y1={padT - 6} y2={padT + geom.ih} className="chart-crosshair" />
              <circle cx={h[0]} cy={h[1]} r={6} fill={color} stroke="var(--surface)" strokeWidth={3} />
            </g>
          )}
        </svg>
      )}
      {h && hover !== null && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(h[0], 56), width - 56), top: Math.max(0, h[1] - 54) }}>
          <strong className="num">{formatY(data[hover].y)}</strong>
          <span>{formatX(data[hover].x)}</span>
        </div>
      )}
    </div>
  );
}

export interface Bar {
  label: string;
  value: number;
  tip?: string;
  highlight?: boolean;
}

export function BarChart({
  data,
  height = 160,
  formatY,
  ariaLabel,
  color = 'var(--chart)',
}: {
  data: Bar[];
  height?: number;
  formatY: (v: number) => string;
  ariaLabel: string;
  color?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padT = 16;
  const padB = 22;
  const padR = 36;
  const max = Math.max(...data.map((d) => d.value), 0);
  const ticks = max > 0 ? niceTicks(0, max, 2) : [0, 1];
  const top = ticks[ticks.length - 1];
  const iw = Math.max(0, width - padR);
  const ih = height - padT - padB;
  const slot = data.length ? iw / data.length : 0;
  const bw = Math.max(4, Math.min(28, slot - 6));
  const sy = (v: number) => padT + ih - (v / (top || 1)) * ih;
  const labelEvery = data.length > 8 ? Math.ceil(data.length / 6) : 1;

  return (
    <div ref={ref} className="chart" dir="ltr" style={{ height }} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={iw} y1={sy(t)} y2={sy(t)} className="chart-grid" />
              <text x={iw + 6} y={sy(t) + 4} className="chart-axis">
                {formatY(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = i * slot + (slot - bw) / 2;
            const y = sy(d.value);
            const hgt = Math.max(0, padT + ih - y);
            const r = Math.min(4, bw / 2, hgt);
            const path =
              hgt <= 0
                ? ''
                : `M${x},${padT + ih}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${padT + ih}Z`;
            const active = hover === i;
            return (
              <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
                {hgt <= 0 ? (
                  <rect x={x} y={padT + ih - 2} width={bw} height={2} rx={1} fill="var(--surface-3)" />
                ) : (
                  <path d={path} fill={color} opacity={hover === null ? (d.highlight ? 1 : 0.55) : active ? 1 : 0.35} />
                )}
                {i % labelEvery === 0 || i === data.length - 1 ? (
                  <text x={x + bw / 2} y={height - 5} textAnchor="middle" className={`chart-axis ${d.highlight ? 'is-strong' : ''}`}>
                    {d.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(hover * slot + slot / 2, 56), width - 56), top: Math.max(0, sy(data[hover].value) - 52) }}
        >
          <strong className="num">{formatY(data[hover].value)}</strong>
          <span>{data[hover].tip ?? data[hover].label}</span>
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, color = 'var(--chart)', height = 36 }: { values: number[]; color?: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const d = useMemo(() => {
    if (values.length < 2 || width === 0) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = 3;
    const pts = values.map(
      (v, i) => [pad + (i / (values.length - 1)) * (width - pad * 2), pad + (1 - (v - min) / (max - min || 1)) * (height - pad * 2)] as [number, number],
    );
    return monotonePath(pts);
  }, [values, width, height]);
  return (
    <div ref={ref} style={{ height }} aria-hidden="true">
      {d && (
        <svg width={width} height={height}>
          <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export function Ring({
  value,
  size = 64,
  stroke = 7,
  color = 'var(--chart)',
  children,
  label,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-arc"
        />
      </svg>
      {children && <div className="ring-center">{children}</div>}
    </div>
  );
}
