/**
 * Forward kinematics for the exercise demonstration figure.
 *
 * Angles are absolute, in degrees. In side view, 0 = pointing down, 90 = toward the
 * figure's front (+x), 180 = up, -90/270 = backward. Keyframes are interpolated
 * numerically, so the path between two values is chosen by the numbers themselves
 * (e.g. 175 → 340 swings backward over the head, 175 → -20 swings forward).
 *
 * In front view, limb angles are abduction from hanging (0 = down, 90 = straight out
 * to the side, 180 = overhead) and are mirrored for the left side.
 */

export type Joint =
  | 'hip' | 'shoulder' | 'head' | 'elbow' | 'wrist' | 'knee' | 'ankle' | 'toe'
  | 'elbow2' | 'wrist2' | 'knee2' | 'ankle2' | 'toe2';

export interface Pose {
  t: number; // torso: hip → shoulder
  n?: number; // neck/head direction, defaults to torso
  ua: number; fa: number; // near upper arm / forearm
  ua2?: number; fa2?: number; // far arm (defaults to near)
  th: number; sh: number; ft?: number; // near thigh / shin / foot
  th2?: number; sh2?: number; ft2?: number; // far leg
  /** Optional animated anchor position (overrides pattern.at). */
  ax?: number; ay?: number;
}

export type Pt = [number, number];
export type Skeleton = Record<Joint, Pt>;

export const LEN = { torso: 40, neck: 11, head: 7, ua: 23, fa: 21, th: 31, sh: 30, ft: 9 };
const FRONT_SHOULDER = 13;
const FRONT_HIP = 7;

const rad = (d: number) => (d * Math.PI) / 180;
const step = (p: Pt, angle: number, len: number, mirror = 1): Pt => [
  p[0] + Math.sin(rad(angle)) * len * mirror,
  p[1] + Math.cos(rad(angle)) * len,
];

/** Joint positions with the hip at the origin. Side view only. */
export function sideSkeleton(p: Pose): Skeleton {
  const hip: Pt = [0, 0];
  const shoulder = step(hip, p.t, LEN.torso);
  const head = step(shoulder, p.n ?? p.t, LEN.neck);
  const elbow = step(shoulder, p.ua, LEN.ua);
  const wrist = step(elbow, p.fa, LEN.fa);
  const elbow2 = step(shoulder, p.ua2 ?? p.ua, LEN.ua);
  const wrist2 = step(elbow2, p.fa2 ?? p.fa, LEN.fa);
  const knee = step(hip, p.th, LEN.th);
  const ankle = step(knee, p.sh, LEN.sh);
  const toe = step(ankle, p.ft ?? 90, LEN.ft);
  const knee2 = step(hip, p.th2 ?? p.th, LEN.th);
  const ankle2 = step(knee2, p.sh2 ?? p.sh, LEN.sh);
  const toe2 = step(ankle2, p.ft2 ?? p.ft ?? 90, LEN.ft);
  return { hip, shoulder, head, elbow, wrist, elbow2, wrist2, knee, ankle, toe, knee2, ankle2, toe2 };
}

export interface FrontSkeleton {
  head: Pt;
  neck: Pt;
  pelvis: Pt;
  right: { shoulder: Pt; elbow: Pt; wrist: Pt; hip: Pt; knee: Pt; ankle: Pt; toe: Pt };
  left: { shoulder: Pt; elbow: Pt; wrist: Pt; hip: Pt; knee: Pt; ankle: Pt; toe: Pt };
}

/** Front view: symmetric figure, hip centre at origin. */
export function frontSkeleton(p: Pose): FrontSkeleton {
  const pelvis: Pt = [0, 0];
  const neck: Pt = [0, -LEN.torso];
  const head: Pt = [0, -LEN.torso - LEN.neck];
  const side = (m: 1 | -1, ua: number, fa: number, th: number, sh: number) => {
    const shoulder: Pt = [FRONT_SHOULDER * m, neck[1] + 4];
    const elbow = step(shoulder, ua, LEN.ua, m);
    const wrist = step(elbow, fa, LEN.fa, m);
    const hip: Pt = [FRONT_HIP * m, 0];
    const knee = step(hip, th, LEN.th, m);
    const ankle = step(knee, sh, LEN.sh, m);
    const toe: Pt = [ankle[0] + 5 * m, ankle[1] + 2];
    return { shoulder, elbow, wrist, hip, knee, ankle, toe };
  };
  const right = side(1, p.ua, p.fa, p.th, p.sh);
  const left = side(-1, p.ua2 ?? p.ua, p.fa2 ?? p.fa, p.th2 ?? p.th, p.sh2 ?? p.sh);
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

const POSE_KEYS: (keyof Pose)[] = ['t', 'n', 'ua', 'fa', 'ua2', 'fa2', 'th', 'sh', 'ft', 'th2', 'sh2', 'ft2', 'ax', 'ay'];

/** Fill optional fields so two poses can be interpolated key by key. */
export function normalize(p: Pose): Required<Pose> {
  return {
    ...p,
    n: p.n ?? p.t,
    ua2: p.ua2 ?? p.ua,
    fa2: p.fa2 ?? p.fa,
    ft: p.ft ?? 90,
    th2: p.th2 ?? p.th,
    sh2: p.sh2 ?? p.sh,
    ft2: p.ft2 ?? p.ft ?? 90,
    ax: p.ax ?? NaN,
    ay: p.ay ?? NaN,
  };
}

export function lerpPose(a: Required<Pose>, b: Required<Pose>, k: number): Pose {
  const out = {} as Record<keyof Pose, number>;
  for (const key of POSE_KEYS) {
    const va = a[key];
    const vb = b[key];
    out[key] = Number.isNaN(va) || Number.isNaN(vb) ? (Number.isNaN(va) ? vb : va) : va + (vb - va) * k;
  }
  if (Number.isNaN(out.ax)) delete (out as Partial<typeof out>).ax;
  if (Number.isNaN(out.ay)) delete (out as Partial<typeof out>).ay;
  return out as Pose;
}

export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
