/**
 * Forward kinematics for the exercise demonstration figure.
 *
 * Angles are absolute, in degrees. In side view, 0 = pointing down, 90 = toward the
 * figure's front (+x), 180 = up, -90/270 = backward. Keyframes are interpolated
 * numerically, so the path between two values is chosen by the numbers themselves
 * (e.g. 175 → 340 swings backward over the head, 175 → -20 swings forward).
 *
 * The spine has two segments: the pelvis/lower back follows `t`, the upper back follows
 * `ub` (defaults to `t`), so crunches and rows can curl or arch instead of moving as a plank.
 *
 * In front view, limb angles are abduction from hanging (0 = down, 90 = straight out
 * to the side, 180 = overhead) and are mirrored for the left side.
 */

export type Joint =
  | 'hip' | 'chest' | 'shoulder' | 'head' | 'elbow' | 'wrist' | 'knee' | 'ankle' | 'toe'
  | 'elbow2' | 'wrist2' | 'knee2' | 'ankle2' | 'toe2';

export interface Pose {
  t: number; // lower torso: hip → mid-back
  ub?: number; // upper torso: mid-back → shoulder, defaults to t
  n?: number; // neck/head direction, defaults to the upper torso
  ua: number; fa: number; // near upper arm / forearm
  ua2?: number; fa2?: number; // far arm (defaults to near)
  th: number; sh: number; ft?: number; // near thigh / shin / foot
  th2?: number; sh2?: number; ft2?: number; // far leg
  /**
   * Side view: how far the upper arms point out of the picture plane (elbows flared out to
   * the sides, as in wide-grip pull-ups, flys and face pulls). 0 = in plane. Foreshortens them.
   */
  uz?: number;
  /** Far arm's out-of-plane angle (defaults to uz). */
  uz2?: number;
  /** Front view: forward flexion of each thigh / upper arm (foreshortens it: squats, reaching forward). */
  tf?: number; tf2?: number; af?: number; af2?: number;
  /** Front view: how far each shin points toward/away from the viewer (kneeling, a leg stepped back). */
  sf?: number; sf2?: number;
  /** Optional animated anchor position (overrides pattern.at). */
  ax?: number; ay?: number;
  /** Internal: tracked hand position, filled from the keyframes (see Pattern.track). */
  tx?: number; ty?: number;
}

export type Pt = [number, number];
export type Skeleton = Record<Joint, Pt>;

export const LEN = { torso: 40, neck: 11, head: 7, ua: 23, fa: 21, th: 31, sh: 30, ft: 9 };
const LOWER_BACK = LEN.torso / 2;
const FRONT_SHOULDER = 13;
const FRONT_HIP = 7;

export const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;
export const step = (p: Pt, angle: number, len: number, mirror = 1): Pt => [
  p[0] + Math.sin(rad(angle)) * len * mirror,
  p[1] + Math.cos(rad(angle)) * len,
];
/** Direction of the segment a → b in this file's angle convention. */
export const angleOf = (a: Pt, b: Pt) => deg(Math.atan2(b[0] - a[0], b[1] - a[1]));

/** Joint positions with the hip at the origin. Side view only. */
export function sideSkeleton(p: Pose): Skeleton {
  const hip: Pt = [0, 0];
  const chest = step(hip, p.t, LOWER_BACK);
  const shoulder = step(chest, p.ub ?? p.t, LEN.torso - LOWER_BACK);
  const head = step(shoulder, p.n ?? p.ub ?? p.t, LEN.neck);
  const elbow = step(shoulder, p.ua, LEN.ua * Math.cos(rad(p.uz ?? 0)));
  const wrist = step(elbow, p.fa, LEN.fa);
  const elbow2 = step(shoulder, p.ua2 ?? p.ua, LEN.ua * Math.cos(rad(p.uz2 ?? p.uz ?? 0)));
  const wrist2 = step(elbow2, p.fa2 ?? p.fa, LEN.fa);
  const knee = step(hip, p.th, LEN.th);
  const ankle = step(knee, p.sh, LEN.sh);
  const toe = step(ankle, p.ft ?? 90, LEN.ft);
  const knee2 = step(hip, p.th2 ?? p.th, LEN.th);
  const ankle2 = step(knee2, p.sh2 ?? p.sh, LEN.sh);
  const toe2 = step(ankle2, p.ft2 ?? p.ft ?? 90, LEN.ft);
  return { hip, chest, shoulder, head, elbow, wrist, elbow2, wrist2, knee, ankle, toe, knee2, ankle2, toe2 };
}

export interface FrontSide {
  shoulder: Pt; elbow: Pt; wrist: Pt; hip: Pt; knee: Pt; ankle: Pt; toe: Pt;
}
export interface FrontSkeleton {
  head: Pt;
  neck: Pt;
  pelvis: Pt;
  right: FrontSide;
  left: FrontSide;
}

/** Front view: symmetric figure, hip centre at origin. */
export function frontSkeleton(p: Pose): FrontSkeleton {
  const pelvis: Pt = [0, 0];
  const neck: Pt = [0, -LEN.torso];
  const head: Pt = [0, -LEN.torso - LEN.neck];
  const side = (m: 1 | -1, ua: number, fa: number, th: number, sh: number, af: number, tf: number, sf: number): FrontSide => {
    const shoulder: Pt = [FRONT_SHOULDER * m, neck[1] + 4];
    const elbow = step(shoulder, ua, LEN.ua * Math.cos(rad(af)), m);
    const wrist = step(elbow, fa, LEN.fa, m);
    const hip: Pt = [FRONT_HIP * m, 0];
    const knee = step(hip, th, LEN.th * Math.cos(rad(tf)), m);
    const ankle = step(knee, sh, LEN.sh * Math.cos(rad(sf)), m);
    const toe: Pt = [ankle[0] + 5 * m, ankle[1] + 2];
    return { shoulder, elbow, wrist, hip, knee, ankle, toe };
  };
  const right = side(1, p.ua, p.fa, p.th, p.sh, p.af ?? 0, p.tf ?? 0, p.sf ?? 0);
  const left = side(-1, p.ua2 ?? p.ua, p.fa2 ?? p.fa, p.th2 ?? p.th, p.sh2 ?? p.sh, p.af2 ?? p.af ?? 0, p.tf2 ?? p.tf ?? 0, p.sf2 ?? p.sf ?? 0);
  // `t` below 180 leans the upper body toward the figure's right (side bends, chops).
  const lean = rad(180 - p.t);
  if (lean) {
    const rot = (q: Pt): Pt => [q[0] * Math.cos(lean) - q[1] * Math.sin(lean), q[0] * Math.sin(lean) + q[1] * Math.cos(lean)];
    for (const s of [right, left]) {
      s.shoulder = rot(s.shoulder);
      s.elbow = rot(s.elbow);
      s.wrist = rot(s.wrist);
    }
    return { head: rot(head), neck: rot(neck), pelvis, right, left };
  }
  return { head, neck, pelvis, right, left };
}

const POSE_KEYS: (keyof Pose)[] = ['t', 'ub', 'n', 'ua', 'fa', 'ua2', 'fa2', 'th', 'sh', 'ft', 'th2', 'sh2', 'ft2', 'uz', 'uz2', 'tf', 'tf2', 'af', 'af2', 'sf', 'sf2', 'ax', 'ay', 'tx', 'ty'];

/** Fill optional fields so two poses can be interpolated key by key. */
export function normalize(p: Pose): Required<Pose> {
  const ub = p.ub ?? p.t;
  return {
    ...p,
    ub,
    n: p.n ?? ub,
    ua2: p.ua2 ?? p.ua,
    fa2: p.fa2 ?? p.fa,
    ft: p.ft ?? 90,
    th2: p.th2 ?? p.th,
    sh2: p.sh2 ?? p.sh,
    ft2: p.ft2 ?? p.ft ?? 90,
    uz: p.uz ?? 0,
    uz2: p.uz2 ?? p.uz ?? 0,
    sf: p.sf ?? 0,
    sf2: p.sf2 ?? p.sf ?? 0,
    tf: p.tf ?? 0,
    tf2: p.tf2 ?? p.tf ?? 0,
    af: p.af ?? 0,
    af2: p.af2 ?? p.af ?? 0,
    ax: p.ax ?? NaN,
    ay: p.ay ?? NaN,
    tx: p.tx ?? NaN,
    ty: p.ty ?? NaN,
  };
}

const clean = (out: Record<keyof Pose, number>): Pose => {
  if (Number.isNaN(out.ax)) delete (out as Partial<typeof out>).ax;
  if (Number.isNaN(out.ay)) delete (out as Partial<typeof out>).ay;
  if (Number.isNaN(out.tx)) delete (out as Partial<typeof out>).tx;
  if (Number.isNaN(out.ty)) delete (out as Partial<typeof out>).ty;
  return out as Pose;
};

export function lerpPose(a: Required<Pose>, b: Required<Pose>, k: number): Pose {
  const out = {} as Record<keyof Pose, number>;
  for (const key of POSE_KEYS) {
    const va = a[key];
    const vb = b[key];
    out[key] = Number.isNaN(va) || Number.isNaN(vb) ? (Number.isNaN(va) ? vb : va) : va + (vb - va) * k;
  }
  return clean(out);
}

/**
 * Centripetal-free uniform Catmull-Rom through four poses (p1 → p2 at k), used for
 * continuous cyclic movements (running, jumping jacks) so they flow instead of stopping
 * at every keyframe.
 */
export function splinePose(p0: Required<Pose>, p1: Required<Pose>, p2: Required<Pose>, p3: Required<Pose>, k: number): Pose {
  const out = {} as Record<keyof Pose, number>;
  const k2 = k * k;
  const k3 = k2 * k;
  for (const key of POSE_KEYS) {
    const [a, b, c, d] = [p0[key], p1[key], p2[key], p3[key]];
    if ([a, b, c, d].some(Number.isNaN)) {
      out[key] = Number.isNaN(b) || Number.isNaN(c) ? (Number.isNaN(b) ? c : b) : b + (c - b) * k;
      continue;
    }
    out[key] = 0.5 * (2 * b + (-a + c) * k + (2 * a - 5 * b + 4 * c - d) * k2 + (-a + 3 * b - 3 * c + d) * k3);
  }
  return clean(out);
}

/** Smooth start and stop, like a controlled rep. */
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
/** Gentler ease for slow eccentric phases (sine). */
export const easeSine = (k: number) => -(Math.cos(Math.PI * k) - 1) / 2;
