import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { ExerciseVideo, Muscle } from '@/domain/types';
import { LEN, type Pose, type Pt } from './kinematics';
import { GROUND, type HandItem as BaseHandItem, type Pattern, type Prop } from './patterns';

type HandItem = BaseHandItem | 'dumbbellSide';
import { getPattern, placeFront, placeSide, placedPoints, poseAt, sampleLoop, workingPose, type PlacedFront } from './scene';
import './figure.css';

export { getPattern, poseAt } from './scene';

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const f1 = (n: number) => Math.round(n * 10) / 10;

/** A limb segment that tapers from radius r1 at `a` to r2 at `b`, with rounded ends. */
function capsule(a: Pt, b: Pt, r1: number, r2: number): string {
  const d = sub(b, a);
  const len = Math.hypot(d[0], d[1]) || 0.001;
  const n: Pt = [-d[1] / len, d[0] / len];
  const a1: Pt = [a[0] + n[0] * r1, a[1] + n[1] * r1];
  const a2: Pt = [a[0] - n[0] * r1, a[1] - n[1] * r1];
  const b1: Pt = [b[0] + n[0] * r2, b[1] + n[1] * r2];
  const b2: Pt = [b[0] - n[0] * r2, b[1] - n[1] * r2];
  return `M${f1(a1[0])} ${f1(a1[1])}L${f1(b1[0])} ${f1(b1[1])}A${r2} ${r2} 0 0 0 ${f1(b2[0])} ${f1(b2[1])}L${f1(a2[0])} ${f1(a2[1])}A${r1} ${r1} 0 0 0 ${f1(a1[0])} ${f1(a1[1])}Z`;
}

function Part({ a, b, r: [r1, r2], focus }: { a: Pt; b: Pt; r: [number, number]; focus?: boolean }) {
  return <path d={capsule(a, b, r1, r2)} className={focus ? 'fig-part is-focus' : 'fig-part'} />;
}

/** Body proportions (radii in figure units): an athletic build, the same in every exercise. */
const R = {
  pelvis: [6.4, 6.6] as [number, number],
  chest: [7.4, 6.4] as [number, number],
  neck: [3.1, 3.1] as [number, number],
  upperArm: [3.7, 2.9] as [number, number],
  forearm: [2.9, 2.2] as [number, number],
  thigh: [5.2, 3.7] as [number, number],
  shin: [3.6, 2.5] as [number, number],
  foot: [2.6, 1.9] as [number, number],
};

/** Which drawn parts light up for each muscle (used on the exercise guide). */
type Region = 'chest' | 'back' | 'core' | 'shoulder' | 'upperArm' | 'forearm' | 'thigh' | 'glute' | 'shin';
const MUSCLE_REGION: Partial<Record<Muscle, Region>> = {
  chest: 'chest', 'upper chest': 'chest', lats: 'back', 'upper back': 'back', traps: 'back',
  'lower back': 'core', abs: 'core', obliques: 'core', 'hip flexors': 'core',
  'front delts': 'shoulder', 'side delts': 'shoulder', 'rear delts': 'shoulder',
  biceps: 'upperArm', triceps: 'upperArm', forearms: 'forearm',
  quads: 'thigh', hamstrings: 'thigh', adductors: 'thigh', glutes: 'glute', calves: 'shin',
};

function HandProp({ at, kind, angle = 0 }: { at: Pt; kind: HandItem; angle?: number }) {
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
      // Seen end-on (handle across the body): the usual pronated/supinated grip from the side.
      return (
        <g className="fig-equip">
          <circle cx={x} cy={y} r={5.4} className="fig-plate" />
          <circle cx={x} cy={y} r={1.8} className="fig-hub" />
        </g>
      );
    case 'dumbbellSide':
      // Neutral grip: the handle runs front-to-back, perpendicular to the forearm.
      return (
        <g className="fig-equip" transform={`rotate(${-angle} ${x} ${y})`}>
          <rect x={x - 6.5} y={y - 1.5} width={13} height={3} rx={1.4} className="fig-hub" />
          <rect x={x - 8} y={y - 4.5} width={4} height={9} rx={1.6} className="fig-plate" />
          <rect x={x + 4} y={y - 4.5} width={4} height={9} rx={1.6} className="fig-plate" />
        </g>
      );
    case 'kettlebell':
      return (
        <g className="fig-equip">
          <path d={`M${x - 3.5} ${y + 1.5}Q${x} ${y - 5} ${x + 3.5} ${y + 1.5}`} className="fig-handle" />
          <circle cx={x} cy={y + 7} r={6.5} className="fig-plate" />
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

/** The hand sits just past the wrist along the forearm. */
const handAt = (elbow: Pt, wrist: Pt): Pt => {
  const d = sub(wrist, elbow);
  const l = Math.hypot(d[0], d[1]) || 1;
  return [wrist[0] + (d[0] / l) * 2.2, wrist[1] + (d[1] / l) * 2.2];
};

/** A loop band seen from the side: a short strap across the thigh just above the knee. */
function LoopBand({ hip, knee }: { hip: Pt; knee: Pt }) {
  const c: Pt = [hip[0] + (knee[0] - hip[0]) * 0.8, hip[1] + (knee[1] - hip[1]) * 0.8];
  const d = sub(knee, hip);
  const l = Math.hypot(d[0], d[1]) || 1;
  const n: Pt = [(-d[1] / l) * 5.5, (d[0] / l) * 5.5];
  return <line x1={c[0] - n[0]} y1={c[1] - n[1]} x2={c[0] + n[0]} y2={c[1] + n[1]} className="fig-band fig-loopband" />;
}

function SideBody({ pattern, pose, focus }: { pattern: Pattern; pose: Pose; focus: Set<Region> }) {
  const P = placeSide(pattern, pose);
  const tetherTo = pattern.tether ? (pattern.tether.to === 'ankle' ? P.ankle : pattern.tether.to) : null;
  const neckTop: Pt = [P.shoulder[0] + (P.head[0] - P.shoulder[0]) * 0.55, P.shoulder[1] + (P.head[1] - P.shoulder[1]) * 0.55];
  const footPlate = (() => {
    if (pattern.foot !== 'plate') return null;
    const a = P.ankle;
    const d = sub(a, P.knee);
    const len = Math.hypot(d[0], d[1]) || 1;
    const nx = -d[1] / len;
    const ny = d[0] / len;
    const c: Pt = [a[0] + (d[0] / len) * 6, a[1] + (d[1] / len) * 6];
    return <line x1={c[0] - nx * 16} y1={c[1] - ny * 16} x2={c[0] + nx * 16} y2={c[1] + ny * 16} strokeWidth={5} className="fig-prop" />;
  })();
  const hand = pattern.hand === 'dumbbell' && pattern.grip === 'neutral' ? 'dumbbellSide' : pattern.hand;
  // Neutral-grip handle lies perpendicular to the forearm (in screen degrees).
  const gripAngle = (s: '' | '2') => {
    const e = P[`elbow${s}` as 'elbow'];
    const w = P[`wrist${s}` as 'wrist'];
    return (Math.atan2(w[0] - e[0], w[1] - e[1]) * 180) / Math.PI;
  };
  const limbs = (s: '' | '2') => {
    const k = (j: string) => P[`${j}${s}` as keyof typeof P];
    const h = handAt(k('elbow'), k('wrist'));
    return {
      leg: (
        <>
          <Part a={P.hip} b={k('knee')} r={R.thigh} focus={focus.has('thigh')} />
          <Part a={k('knee')} b={k('ankle')} r={R.shin} focus={focus.has('shin')} />
          <Part a={k('ankle')} b={k('toe')} r={R.foot} />
        </>
      ),
      arm: (
        <>
          <Part a={P.shoulder} b={k('elbow')} r={R.upperArm} focus={focus.has('upperArm')} />
          <Part a={k('elbow')} b={k('wrist')} r={R.forearm} focus={focus.has('forearm')} />
          <circle cx={h[0]} cy={h[1]} r={2.7} className="fig-part" />
        </>
      ),
    };
  };
  const near = limbs('');
  const far = limbs('2');

  return (
    <>
      {tetherTo && <Tether from={P[pattern.tether!.from]} to={tetherTo} kind={pattern.tether!.kind} />}
      <g className="fig-far">
        {far.leg}
        {far.arm}
      </g>
      {hand && hand !== 'barbell' && hand !== 'plate' && hand !== 'wheel' && hand !== 'kettlebell' && (
        <g opacity={0.5}>
          <HandProp at={P.wrist2} kind={hand} angle={gripAngle('2')} />
        </g>
      )}
      {footPlate}
      {/* torso: pelvis → lower back, mid-back → shoulders, neck, head */}
      <Part a={P.hip} b={P.chest} r={R.pelvis} focus={focus.has('core')} />
      <Part a={P.chest} b={P.shoulder} r={R.chest} focus={focus.has('chest') || focus.has('back')} />
      {focus.has('glute') && <circle cx={P.hip[0]} cy={P.hip[1]} r={6.8} className="fig-part is-focus" />}
      <Part a={P.shoulder} b={neckTop} r={R.neck} />
      <circle cx={P.head[0]} cy={P.head[1]} r={LEN.head} className="fig-part" />
      {near.leg}
      {pattern.loopBand && <LoopBand hip={P.hip} knee={P.knee} />}
      {focus.has('shoulder') && <circle cx={P.shoulder[0]} cy={P.shoulder[1]} r={5.2} className="fig-part is-focus" />}
      {near.arm}
      {hand && <HandProp at={P.wrist} kind={hand} angle={gripAngle('')} />}
    </>
  );
}

function FrontBody({ pattern, pose, focus }: { pattern: Pattern; pose: Pose; focus: Set<Region> }) {
  const sk: PlacedFront = placeFront(pattern, pose);
  const sides = [sk.right, sk.left];
  const cx = sk.pelvis[0];
  const mirrorTo = (to: Pt, i: number): Pt => (i === 0 ? to : [2 * cx - to[0], to[1]]);
  const tether = pattern.tether;
  const r = sk.right;
  const l = sk.left;
  // Torso: broad shoulders tapering to the waist, then the hips.
  const waist: Pt = [(sk.pelvis[0] + sk.neck[0]) / 2, (sk.pelvis[1] + sk.neck[1]) / 2 + 6];
  const torso = `M${f1(l.shoulder[0] - 3)} ${f1(l.shoulder[1] - 2)}L${f1(r.shoulder[0] + 3)} ${f1(r.shoulder[1] - 2)}Q${f1(waist[0] + 10)} ${f1(waist[1])} ${f1(r.hip[0] + 3)} ${f1(r.hip[1] + 3)}L${f1(l.hip[0] - 3)} ${f1(l.hip[1] + 3)}Q${f1(waist[0] - 10)} ${f1(waist[1])} ${f1(l.shoulder[0] - 3)} ${f1(l.shoulder[1] - 2)}Z`;
  return (
    <>
      {tether &&
        sides.map((s, i) => (
          <Tether key={i} from={s[tether.from]} to={tether.to === 'ankle' ? s.ankle : mirrorTo(tether.to, i)} kind={tether.kind} />
        ))}
      {sides.map((s, i) => (
        <g key={`leg${i}`}>
          <Part a={s.hip} b={s.knee} r={R.thigh} focus={focus.has('thigh')} />
          <Part a={s.knee} b={s.ankle} r={R.shin} focus={focus.has('shin')} />
          <Part a={s.ankle} b={s.toe} r={R.foot} />
        </g>
      ))}
      {pattern.loopBand && (
        <line
          x1={r.hip[0] + (r.knee[0] - r.hip[0]) * 0.85} y1={r.hip[1] + (r.knee[1] - r.hip[1]) * 0.85}
          x2={l.hip[0] + (l.knee[0] - l.hip[0]) * 0.85} y2={l.hip[1] + (l.knee[1] - l.hip[1]) * 0.85}
          className="fig-band fig-loopband"
        />
      )}
      <path d={torso} className={`fig-part${focus.has('chest') || focus.has('back') || focus.has('core') ? ' is-focus' : ''}`} />
      <Part a={sk.neck} b={[(sk.neck[0] + sk.head[0]) / 2, (sk.neck[1] + sk.head[1]) / 2]} r={R.neck} />
      <circle cx={sk.head[0]} cy={sk.head[1]} r={LEN.head} className="fig-part" />
      {sides.map((s, i) => {
        const h = handAt(s.elbow, s.wrist);
        return (
          <g key={`arm${i}`}>
            <Part a={s.shoulder} b={s.elbow} r={R.upperArm} focus={focus.has('upperArm')} />
            {focus.has('shoulder') && <circle cx={s.shoulder[0]} cy={s.shoulder[1]} r={4.8} className="fig-part is-focus" />}
            <Part a={s.elbow} b={s.wrist} r={R.forearm} focus={focus.has('forearm')} />
            <circle cx={h[0]} cy={h[1]} r={2.7} className="fig-part" />
            {pattern.hand && <HandProp at={s.wrist} kind={pattern.hand} />}
          </g>
        );
      })}
    </>
  );
}

const boundsOf = (pts: Pt[]): [number, number, number, number] => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys) - LEN.head, Math.max(...xs), Math.max(...ys)];
};

function fitViewBox(pattern: Pattern, pose: Pose): string {
  const [x0, y0, x1, y1] = boundsOf(placedPoints(pattern, pose));
  const pad = 14;
  const size = Math.max(x1 - x0, y1 - y0) + pad * 2;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return `${cx - size / 2} ${cy - size / 2} ${size} ${size}`;
}

/**
 * Stable 5:4 viewBox covering the whole loop plus the floor, so animations fill their
 * frame without the camera moving.
 */
const sceneCache = new Map<Pattern, string>();
export function sceneViewBox(pattern: Pattern): string {
  const hit = sceneCache.get(pattern);
  if (hit) return hit;
  const pts = sampleLoop(pattern, 32).flatMap((pose) => placedPoints(pattern, pose));
  const [x0, y0, x1] = boundsOf(pts);
  const pad = 16;
  const top = y0 - pad;
  let h = GROUND + 8 - top;
  let w = x1 - x0 + pad * 2;
  if (w / h > 1.25) h = w / 1.25;
  else w = h * 1.25;
  const cx = (x0 + x1) / 2;
  const vb = `${cx - w / 2} ${GROUND + 8 - h} ${w} ${h}`;
  sceneCache.set(pattern, vb);
  return vb;
}

const NO_FOCUS = new Set<Region>();

export const FigureFrame = memo(function FigureFrame({
  pattern, pose, fit, focus,
}: { pattern: Pattern; pose: Pose; fit?: boolean | 'scene'; focus?: Muscle[] }) {
  const viewBox = fit === 'scene' ? sceneViewBox(pattern) : fit ? fitViewBox(pattern, pose) : '0 0 200 160';
  const regions = useMemo(() => (focus?.length ? new Set(focus.map((m) => MUSCLE_REGION[m]).filter((r): r is Region => !!r)) : NO_FOCUS), [focus]);
  return (
    <svg viewBox={viewBox} className="fig" role="img" aria-hidden="true">
      <line x1={-200} y1={GROUND} x2={400} y2={GROUND} className="fig-ground" />
      {pattern.props?.map((p, i) => <StaticProp key={i} p={p} />)}
      {pattern.view === 'side' ? <SideBody pattern={pattern} pose={pose} focus={regions} /> : <FrontBody pattern={pattern} pose={pose} focus={regions} />}
    </svg>
  );
});

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Animated demonstration. Pauses when offscreen and under reduced motion, where it shows
 * the working position instead. `focus` tints the target muscles.
 */
export function ExerciseAnimation({ anim, className, focus }: { anim?: string; className?: string; focus?: Muscle[] }) {
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

  const pose = reduced ? workingPose(pattern) : poseAt(pattern, t);
  return (
    <div ref={ref} className={className}>
      <FigureFrame pattern={pattern} pose={pose} fit="scene" focus={focus} />
    </div>
  );
}

/** Static thumbnail at the working position, cropped to the figure (or the scene). */
export const ExerciseThumb = memo(function ExerciseThumb({ anim, fit = true, video }: { anim?: string; fit?: boolean | 'scene'; video?: ExerciseVideo }) {
  // A real demo video's still frame replaces the figure.
  if (video) return <img className="ex-thumb-img" src={video.poster} alt="" loading="lazy" decoding="async" />;
  const pattern = getPattern(anim);
  return <FigureFrame pattern={pattern} pose={workingPose(pattern)} fit={fit} />;
});
