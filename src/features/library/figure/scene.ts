/**
 * Turns a pattern + time into placed joint positions: keyframe timing (tempo, holds,
 * smooth cycles), anchoring, and contact locks solved with two-bone IK so planted hands
 * and feet never slide while the body moves.
 */
import {
  angleOf, easeInOut, easeSine, frontSkeleton, LEN, lerpPose, normalize, sideSkeleton, splinePose, step,
  type FrontSide, type FrontSkeleton, type Pose, type Pt, type Skeleton,
} from './kinematics';
import { DEFAULT_PATTERN, GROUND, PATTERNS, type LockJoint, type Pattern } from './patterns';

const or = (v: number | undefined, fallback: number) => (v === undefined || Number.isNaN(v) ? fallback : v);
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];

export function getPattern(id?: string): Pattern {
  return PATTERNS[id ?? ''] ?? PATTERNS[DEFAULT_PATTERN];
}

// ── Timing ────────────────────────────────────────────────────────────────────

const normCache = new WeakMap<Pattern, Required<Pose>[]>();
const framesOf = (p: Pattern) => {
  let f = normCache.get(p);
  if (!f) {
    f = p.frames.map(normalize);
    // A frame that doesn't move the anchor sits at the pattern's anchor point. Without this,
    // interpolation would carry another frame's jump height into it (floating, then snapping).
    const anyX = f.some((q) => !Number.isNaN(q.ax));
    const anyY = f.some((q) => !Number.isNaN(q.ay));
    f = f.map((q) => ({ ...q, ax: anyX && Number.isNaN(q.ax) ? p.at[0] : q.ax, ay: anyY && Number.isNaN(q.ay) ? p.at[1] : q.ay }));
    // Tracked hands: store each keyframe's hand position so interpolation moves it in a straight line.
    if (p.track) f = f.map((q) => { const w = placeRaw(p, q).wrist; return { ...q, tx: w[0], ty: w[1] }; });
    normCache.set(p, f);
  }
  return f;
};

interface Segment { from: number; to: number; ms: number; hold: number; ease: (k: number) => number }

/** The loop as a list of transitions. Eccentric (lowering) phases run slower than lifts. */
function segments(p: Pattern): Segment[] {
  const ms = p.ms ?? 1100;
  const hold = p.hold ?? 180;
  const n = p.frames.length;
  const cycle = p.loop === 'cycle' || (n > 2 && p.loop !== 'pingpong');
  if (cycle) return [...Array(n).keys()].map((i) => ({ from: i, to: (i + 1) % n, ms, hold, ease: easeInOut }));
  const slow = Math.round(ms * 1.3);
  const fast = Math.round(ms * 0.8);
  const to = { from: 0, to: 1, ms: p.ecc === 'to' ? slow : p.ecc === 'back' ? fast : ms, hold, ease: p.ecc === 'to' ? easeSine : easeInOut };
  const back = { from: 1, to: 0, ms: p.ecc === 'back' ? slow : p.ecc === 'to' ? fast : ms, hold, ease: p.ecc === 'back' ? easeSine : easeInOut };
  return [to, back];
}

export function loopMs(p: Pattern): number {
  if (p.smooth) return (p.ms ?? 1100) * p.frames.length;
  return segments(p).reduce((s, x) => s + x.ms + x.hold, 0);
}

/** Pose at time `t` (ms) along the pattern's loop; seamless at the wrap. */
export function poseAt(p: Pattern, t: number): Pose {
  const frames = framesOf(p);
  const total = loopMs(p);
  const local = ((t % total) + total) % total;
  if (p.smooth) {
    // Continuous movement: a closed spline through every keyframe, no stops.
    const n = frames.length;
    const seg = total / n;
    const i = Math.floor(local / seg);
    const k = (local - i * seg) / seg;
    const at = (j: number) => frames[((j % n) + n) % n];
    return splinePose(at(i - 1), at(i), at(i + 1), at(i + 2), k);
  }
  let acc = 0;
  for (const s of segments(p)) {
    const len = s.ms + s.hold;
    if (local < acc + len) {
      const within = local - acc;
      const k = within < s.hold ? 0 : s.ease((within - s.hold) / s.ms);
      return lerpPose(frames[s.from], frames[s.to], k);
    }
    acc += len;
  }
  return frames[0];
}

/** Evenly spaced poses over one loop (for bounds and the biomechanics audit). */
export function sampleLoop(p: Pattern, n = 48): Pose[] {
  const total = loopMs(p);
  return Array.from({ length: n }, (_, i) => poseAt(p, (total * i) / n));
}

/** The pose shown in thumbnails and under reduced motion: the working position. */
export const workingPose = (p: Pattern): Pose => framesOf(p)[p.show ?? (p.frames.length > 1 ? 1 : 0)];

// ── Placement ─────────────────────────────────────────────────────────────────

function placeRaw(p: Pattern, pose: Pose): Skeleton {
  const sk = sideSkeleton(pose);
  const at: Pt = [or(pose.ax, p.at[0]), or(pose.ay, p.at[1])];
  const off = sub(at, sk[p.anchor]);
  const out = {} as Skeleton;
  for (const k of Object.keys(sk) as (keyof Skeleton)[]) out[k] = add(sk[k], off);
  return out;
}

/**
 * `flex` is the anatomical bend direction: knees flex with the shin rotating back relative
 * to the thigh (+1), elbows with the forearm rotating forward relative to the upper arm (-1),
 * so a solved limb can never bend the wrong way.
 */
interface Chain { root: keyof Skeleton; mid: keyof Skeleton; end: keyof Skeleton; b: number; flex: 1 | -1; r: number; arm: boolean; foot?: keyof Skeleton; toe?: boolean }
const CHAINS: Record<LockJoint, Chain> = {
  wrist: { root: 'shoulder', mid: 'elbow', end: 'wrist', b: LEN.fa, flex: -1, r: 2.8, arm: true },
  wrist2: { root: 'shoulder', mid: 'elbow2', end: 'wrist2', b: LEN.fa, flex: -1, r: 2.8, arm: true },
  ankle: { root: 'hip', mid: 'knee', end: 'ankle', b: LEN.sh, flex: 1, r: 2.8, arm: false, foot: 'toe' },
  ankle2: { root: 'hip', mid: 'knee2', end: 'ankle2', b: LEN.sh, flex: 1, r: 2.8, arm: false, foot: 'toe2' },
  toe: { root: 'hip', mid: 'knee', end: 'ankle', b: LEN.sh, flex: 1, r: 4, arm: false, foot: 'toe', toe: true },
  toe2: { root: 'hip', mid: 'knee2', end: 'ankle2', b: LEN.sh, flex: 1, r: 4, arm: false, foot: 'toe2', toe: true },
};
const lockedJoint = (c: Chain) => (c.toe ? c.foot! : c.end);

const lockCache = new WeakMap<Pattern, [LockJoint, Pt][]>();
/** Where each locked contact stays: an explicit point, or where it is in frame 0 (resting on the floor if near it). */
function lockTargets(p: Pattern): [LockJoint, Pt][] {
  let hit = lockCache.get(p);
  if (hit) return hit;
  const spec = p.lock ?? [];
  if (Array.isArray(spec)) {
    const sk = placeRaw(p, framesOf(p)[0]);
    hit = spec.map((j) => {
      const c = CHAINS[j];
      const at: Pt = [...sk[lockedJoint(c)]];
      if (Math.abs(at[1] + c.r - GROUND) < 8) at[1] = GROUND - c.r;
      return [j, at];
    });
  } else hit = Object.entries(spec) as [LockJoint, Pt][];
  lockCache.set(p, hit);
  return hit;
}

/** Two-bone IK: place the middle joint so the chain reaches `target` (or points straight at it). */
export function solveTwoBone(root: Pt, target: Pt, a: number, b: number, flex: 1 | -1): [Pt, Pt] {
  const d = Math.hypot(target[0] - root[0], target[1] - root[1]);
  const dc = Math.min(Math.max(d, Math.abs(a - b) + 0.01), a + b - 0.001);
  const base = angleOf(root, target);
  const cosA = (a * a + dc * dc - b * b) / (2 * a * dc);
  const alpha = (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI;
  const mid = step(root, base + flex * alpha, a);
  const end = step(mid, angleOf(mid, target), b);
  return [mid, end];
}

/** World joint positions for a side-view pattern, with contact locks applied. */
export function placeSide(p: Pattern, pose: Pose): Skeleton {
  const sk = placeRaw(p, pose);
  if (p.track && pose.tx !== undefined && pose.ty !== undefined) {
    const target: Pt = [pose.tx, pose.ty];
    for (const s of ['', '2'] as const) {
      const len = LEN.ua * Math.cos((Math.PI * (s ? or(pose.uz2, or(pose.uz, 0)) : or(pose.uz, 0))) / 180);
      const [mid, end] = solveTwoBone(sk.shoulder, target, len, LEN.fa, -1);
      sk[`elbow${s}`] = mid;
      sk[`wrist${s}`] = end;
    }
  }
  if (!p.lock) return sk;
  const upperLen = (j: LockJoint) => LEN.ua * Math.cos((Math.PI * (j === 'wrist2' ? or(pose.uz2, or(pose.uz, 0)) : or(pose.uz, 0))) / 180);
  for (const [j, at] of lockTargets(p)) {
    const c = CHAINS[j];
    const footVec = c.foot ? sub(sk[c.foot], sk[c.end]) : ([0, 0] as Pt);
    // A toe lock pins the ball of the foot; the ankle goes wherever the foot angle puts it.
    const target = c.toe ? sub(at, footVec) : at;
    const [mid, end] = solveTwoBone(sk[c.root], target, c.arm ? upperLen(j) : LEN.th, c.b, c.flex);
    if (c.foot) sk[c.foot] = add(end, footVec);
    sk[c.mid] = mid;
    sk[c.end] = end;
  }
  return sk;
}

export interface PlacedFront extends FrontSkeleton {}

/** World joint positions for a front-view pattern (anchored at the lowest ankle). */
export function placeFront(p: Pattern, pose: Pose): PlacedFront {
  const sk = frontSkeleton(pose);
  const anchorY = p.anchor === 'ankle' ? Math.max(sk.right.ankle[1], sk.left.ankle[1]) : 0;
  const off: Pt = [or(pose.ax, p.at[0]), or(pose.ay, p.at[1]) - anchorY];
  const mv = (s: FrontSide): FrontSide => ({
    shoulder: add(s.shoulder, off), elbow: add(s.elbow, off), wrist: add(s.wrist, off),
    hip: add(s.hip, off), knee: add(s.knee, off), ankle: add(s.ankle, off), toe: add(s.toe, off),
  });
  return { head: add(sk.head, off), neck: add(sk.neck, off), pelvis: add(sk.pelvis, off), right: mv(sk.right), left: mv(sk.left) };
}

/** Every placed point (for bounds). */
export function placedPoints(p: Pattern, pose: Pose): Pt[] {
  if (p.view === 'side') return Object.values(placeSide(p, pose));
  const f = placeFront(p, pose);
  return [f.head, f.pelvis, ...Object.values(f.right), ...Object.values(f.left)];
}
