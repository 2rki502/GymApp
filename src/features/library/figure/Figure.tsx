import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { easeInOut, frontSkeleton, LEN, lerpPose, normalize, sideSkeleton, type Pose, type Pt } from './kinematics';
import { DEFAULT_PATTERN, GROUND, PATTERNS, type HandItem, type Pattern, type Prop } from './patterns';
import type { ExerciseVideo } from '@/domain/types';
import './figure.css';

/** Treat NaN (normalized "unset") the same as undefined. */
const or = (v: number | undefined, fallback: number) => (v === undefined || Number.isNaN(v) ? fallback : v);
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];

function Seg({ a, b, w, cls }: { a: Pt; b: Pt; w: number; cls: string }) {
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={w} className={cls} />;
}

function HandProp({ at, kind }: { at: Pt; kind: HandItem }) {
  const [x, y] = at;
  switch (kind) {
    case 'barbell':
      return (
        <g className="fig-equip">
          <circle cx={x} cy={y} r={12} className="fig-plate" />
          <circle cx={x} cy={y} r={3} className="fig-hub" />
        </g>
      );
    case 'dumbbell':
      return (
        <g className="fig-equip">
          <circle cx={x} cy={y} r={5.5} className="fig-plate" />
        </g>
      );
    case 'kettlebell':
      return (
        <g className="fig-equip">
          <circle cx={x} cy={y + 6} r={6.5} className="fig-plate" />
        </g>
      );
    case 'plate':
      return <circle cx={x} cy={y} r={8} className="fig-plate fig-equip" />;
    case 'wheel':
      return (
        <g className="fig-equip">
          <circle cx={x} cy={y + 2} r={8} className="fig-plate" />
          <circle cx={x} cy={y + 2} r={2.5} className="fig-hub" />
        </g>
      );
    case 'handle':
      return <rect x={x - 4} y={y - 2.5} width={8} height={5} rx={2.5} className="fig-plate fig-equip" />;
  }
}

function StaticProp({ p }: { p: Prop }) {
  switch (p.type) {
    case 'bench': {
      const a = ((p.angle ?? 0) * Math.PI) / 180;
      const end: Pt = [p.x + Math.cos(a) * p.w, p.y - Math.sin(a) * p.w];
      return (
        <g className="fig-prop">
          <line x1={p.x} y1={p.y + 3} x2={end[0]} y2={end[1] + 3} strokeWidth={6} />
          {p.legs && !p.angle && (
            <>
              <line x1={p.x + 10} y1={p.y + 6} x2={p.x + 10} y2={GROUND} strokeWidth={3} />
              <line x1={p.x + p.w - 10} y1={p.y + 6} x2={p.x + p.w - 10} y2={GROUND} strokeWidth={3} />
            </>
          )}
          {p.legs && p.angle ? <line x1={p.x} y1={p.y + 6} x2={p.x} y2={GROUND} strokeWidth={3} /> : null}
        </g>
      );
    }
    case 'bar':
      return <line x1={p.x} y1={p.y} x2={p.x + p.w} y2={p.y} strokeWidth={4} className="fig-prop" />;
    case 'box':
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={3} className="fig-box" />;
    case 'wall':
      return <line x1={p.x} y1={10} x2={p.x} y2={GROUND} strokeWidth={4} className="fig-prop" />;
    case 'pulley':
      return <circle cx={p.x} cy={p.y} r={4} className="fig-pulley" />;
  }
}

function Tether({ from, to, kind }: { from: Pt; to: Pt; kind: 'cable' | 'band' }) {
  return <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} className={kind === 'band' ? 'fig-band' : 'fig-cable'} />;
}

function SideBody({ pattern, pose }: { pattern: Pattern; pose: Pose }) {
  const sk = sideSkeleton(pose);
  const anchorAt: Pt = [or(pose.ax, pattern.at[0]), or(pose.ay, pattern.at[1])];
  const off = sub(anchorAt, sk[pattern.anchor]);
  const P = (j: keyof typeof sk) => add(sk[j], off);
  const tetherFrom = pattern.tether ? P(pattern.tether.from) : null;
  const tetherTo = pattern.tether ? (pattern.tether.to === 'ankle' ? P('ankle') : pattern.tether.to) : null;
  const footPlate = (() => {
    if (pattern.foot !== 'plate') return null;
    const a = P('ankle');
    const k = P('knee');
    const d = sub(a, k);
    const len = Math.hypot(d[0], d[1]) || 1;
    const nx = -d[1] / len;
    const ny = d[0] / len;
    const c: Pt = [a[0] + (d[0] / len) * 6, a[1] + (d[1] / len) * 6];
    return <line x1={c[0] - nx * 16} y1={c[1] - ny * 16} x2={c[0] + nx * 16} y2={c[1] + ny * 16} strokeWidth={5} className="fig-prop" />;
  })();

  return (
    <>
      {tetherFrom && tetherTo && <Tether from={tetherFrom} to={tetherTo} kind={pattern.tether!.kind} />}
      {/* far limbs */}
      <g className="fig-far">
        <Seg a={P('hip')} b={P('knee2')} w={7} cls="fig-limb" />
        <Seg a={P('knee2')} b={P('ankle2')} w={6} cls="fig-limb" />
        <Seg a={P('ankle2')} b={P('toe2')} w={4.5} cls="fig-limb" />
        <Seg a={P('shoulder')} b={P('elbow2')} w={6} cls="fig-limb" />
        <Seg a={P('elbow2')} b={P('wrist2')} w={5} cls="fig-limb" />
      </g>
      {pattern.hand && pattern.hand !== 'barbell' && pattern.hand !== 'plate' && pattern.hand !== 'wheel' && (
        <g opacity={0.55}>
          <HandProp at={P('wrist2')} kind={pattern.hand} />
        </g>
      )}
      {footPlate}
      {/* torso + head */}
      <Seg a={P('hip')} b={P('shoulder')} w={10} cls="fig-torso" />
      <circle cx={P('head')[0]} cy={P('head')[1]} r={LEN.head} className="fig-head" />
      {/* near limbs */}
      <Seg a={P('hip')} b={P('knee')} w={7.5} cls="fig-limb" />
      <Seg a={P('knee')} b={P('ankle')} w={6.5} cls="fig-limb" />
      <Seg a={P('ankle')} b={P('toe')} w={5} cls="fig-limb" />
      <Seg a={P('shoulder')} b={P('elbow')} w={6.5} cls="fig-limb" />
      <Seg a={P('elbow')} b={P('wrist')} w={5.5} cls="fig-limb" />
      {pattern.hand && <HandProp at={P('wrist')} kind={pattern.hand} />}
    </>
  );
}

function FrontBody({ pattern, pose }: { pattern: Pattern; pose: Pose }) {
  const sk = frontSkeleton(pose);
  const anchorY = pattern.anchor === 'ankle' ? Math.max(sk.right.ankle[1], sk.left.ankle[1]) : 0;
  const off: Pt = [or(pose.ax, pattern.at[0]), or(pose.ay, pattern.at[1]) - anchorY];
  const P = (p: Pt) => add(p, off);
  const sides = [sk.right, sk.left];
  const mirrorTo = (to: Pt, i: number): Pt => (i === 0 ? to : [2 * off[0] - to[0], to[1]]);
  const tether = pattern.tether;
  return (
    <>
      {tether &&
        sides.map((s, i) => (
          <Tether key={i} from={P(s[tether.from])} to={tether.to === 'ankle' ? P(s.ankle) : mirrorTo(tether.to, i)} kind={tether.kind} />
        ))}
      <Seg a={P(sk.left.shoulder)} b={P(sk.right.shoulder)} w={9} cls="fig-torso" />
      <Seg a={P(sk.left.hip)} b={P(sk.right.hip)} w={9} cls="fig-torso" />
      <Seg a={P(sk.neck)} b={P(sk.pelvis)} w={12} cls="fig-torso" />
      <circle cx={P(sk.head)[0]} cy={P(sk.head)[1]} r={LEN.head} className="fig-head" />
      {sides.map((s, i) => (
        <g key={i}>
          <Seg a={P(s.hip)} b={P(s.knee)} w={7.5} cls="fig-limb" />
          <Seg a={P(s.knee)} b={P(s.ankle)} w={6.5} cls="fig-limb" />
          <Seg a={P(s.ankle)} b={P(s.toe)} w={5} cls="fig-limb" />
          <Seg a={P(s.shoulder)} b={P(s.elbow)} w={6.5} cls="fig-limb" />
          <Seg a={P(s.elbow)} b={P(s.wrist)} w={5.5} cls="fig-limb" />
          {pattern.hand && <HandProp at={P(s.wrist)} kind={pattern.hand} />}
        </g>
      ))}
    </>
  );
}

/** Placed joint positions, used to crop thumbnails tightly around the figure. */
function figureBounds(pattern: Pattern, pose: Pose): [number, number, number, number] {
  let pts: Pt[];
  if (pattern.view === 'side') {
    const sk = sideSkeleton(pose);
    const anchorAt: Pt = [or(pose.ax, pattern.at[0]), or(pose.ay, pattern.at[1])];
    const off = sub(anchorAt, sk[pattern.anchor]);
    pts = Object.values(sk).map((p) => add(p, off));
  } else {
    const sk = frontSkeleton(pose);
    const anchorY = pattern.anchor === 'ankle' ? Math.max(sk.right.ankle[1], sk.left.ankle[1]) : 0;
    const off: Pt = [or(pose.ax, pattern.at[0]), or(pose.ay, pattern.at[1]) - anchorY];
    pts = [sk.head, sk.pelvis, ...Object.values(sk.right), ...Object.values(sk.left)].map((p) => add(p, off));
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys) - LEN.head, Math.max(...xs), Math.max(...ys)];
}

function fitViewBox(pattern: Pattern, pose: Pose): string {
  const [x0, y0, x1, y1] = figureBounds(pattern, pose);
  const pad = 14;
  const size = Math.max(x1 - x0, y1 - y0) + pad * 2;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return `${cx - size / 2} ${cy - size / 2} ${size} ${size}`;
}

/**
 * Stable 5:4 viewBox covering every keyframe plus the floor, so animations fill
 * their frame without the camera moving between frames.
 */
const sceneCache = new Map<Pattern, string>();
export function sceneViewBox(pattern: Pattern): string {
  const hit = sceneCache.get(pattern);
  if (hit) return hit;
  let [x0, y0, x1] = [Infinity, Infinity, -Infinity];
  for (const f of pattern.frames) {
    const [a, b, c] = figureBounds(pattern, normalize(f));
    x0 = Math.min(x0, a);
    y0 = Math.min(y0, b);
    x1 = Math.max(x1, c);
  }
  const pad = 16;
  const top = Math.max(0, y0 - pad);
  let h = GROUND + 8 - top;
  let w = x1 - x0 + pad * 2;
  // enforce 5:4, growing whichever side is short
  if (w / h > 1.25) h = w / 1.25;
  else w = h * 1.25;
  const cx = (x0 + x1) / 2;
  const vb = `${cx - w / 2} ${GROUND + 8 - h} ${w} ${h}`;
  sceneCache.set(pattern, vb);
  return vb;
}

export const FigureFrame = memo(function FigureFrame({ pattern, pose, fit }: { pattern: Pattern; pose: Pose; fit?: boolean | 'scene' }) {
  const viewBox = fit === 'scene' ? sceneViewBox(pattern) : fit ? fitViewBox(pattern, pose) : '0 0 200 160';
  return (
    <svg viewBox={viewBox} className="fig" role="img" aria-hidden="true">
      <line x1={-200} y1={GROUND} x2={400} y2={GROUND} className="fig-ground" />
      {pattern.props?.map((p, i) => <StaticProp key={i} p={p} />)}
      {pattern.view === 'side' ? <SideBody pattern={pattern} pose={pose} /> : <FrontBody pattern={pattern} pose={pose} />}
    </svg>
  );
});

export function getPattern(id?: string): Pattern {
  return PATTERNS[id ?? ''] ?? PATTERNS[DEFAULT_PATTERN];
}

/** Pose at time `t` (ms) along the pattern's loop. */
export function poseAt(pattern: Pattern, t: number): Pose {
  const frames = pattern.frames.map(normalize);
  const ms = pattern.ms ?? 1100;
  const hold = pattern.hold ?? 180;
  const cycle = pattern.loop === 'cycle' || (frames.length > 2 && pattern.loop !== 'pingpong');
  const seq = cycle ? [...frames.keys()].map((i) => [i, (i + 1) % frames.length]) : [[0, 1], [1, 0]];
  const segLen = ms + hold;
  const total = seq.length * segLen;
  const local = ((t % total) + total) % total;
  const idx = Math.floor(local / segLen);
  const within = local - idx * segLen;
  const k = within < hold ? 0 : easeInOut((within - hold) / ms);
  const [a, b] = seq[idx];
  return lerpPose(frames[a], frames[b], k);
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Animated demonstration. Pauses when offscreen and under reduced-motion, where it
 * shows the working (end) position instead.
 */
export function ExerciseAnimation({ anim, className }: { anim?: string; className?: string }) {
  const pattern = getPattern(anim);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [t, setT] = useState(0);
  const reduced = useMemo(prefersReducedMotion, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reduced) return;
    let raf = 0;
    const start = performance.now() - t;
    const tick = (now: number) => {
      setT(now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced, anim]);

  const pose = reduced ? normalize(pattern.frames[1] ?? pattern.frames[0]) : poseAt(pattern, t);
  return (
    <div ref={ref} className={className}>
      <FigureFrame pattern={pattern} pose={pose} fit="scene" />
    </div>
  );
}

/** Static thumbnail at the "working" keyframe, cropped to the figure (or the scene). */
export const ExerciseThumb = memo(function ExerciseThumb({ anim, fit = true, video }: { anim?: string; fit?: boolean | 'scene'; video?: ExerciseVideo }) {
  // A real demo video's still frame replaces the figure.
  if (video) return <img className="ex-thumb-img" src={video.poster} alt="" loading="lazy" decoding="async" />;
  const pattern = getPattern(anim);
  return <FigureFrame pattern={pattern} pose={normalize(pattern.frames[1] ?? pattern.frames[0])} fit={fit} />;
});
