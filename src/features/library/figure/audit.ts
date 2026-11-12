/**
 * Biomechanics audit for the exercise animations. Samples every pattern through its
 * whole loop (including the in-between frames a viewer actually sees) and checks:
 *
 * - joint ranges a human body can reach (knees and elbows never bend backwards, hips,
 *   ankles, neck, spine and shoulders stay within normal range of motion);
 * - nothing sinks into the floor, and the figure is actually on the floor;
 * - planted hands, feet and knees don't slide;
 * - standing figures keep their centre of mass over their feet (they wouldn't fall);
 * - barbell lifts keep the bar over mid-foot.
 *
 * Used by audit.test.ts so a regression in any animation fails the build.
 */
import { angleOf, type Pt, type Skeleton } from './kinematics';
import { GROUND, PATTERNS, type AuditRule, type Pattern } from './patterns';
import { placeFront, placeSide, sampleLoop } from './scene';

export interface Issue {
  rule: AuditRule;
  detail: string;
}

const wrap180 = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
const mod360 = (x: number) => ((x % 360) + 360) % 360;
const mid = (a: Pt, b: Pt, k = 0.5): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/** Approximate body radius at each joint, to test floor contact against the drawn outline. */
const RADIUS: Record<keyof Skeleton, number> = {
  hip: 6, chest: 7, shoulder: 6.5, head: 7.2, elbow: 3.2, wrist: 2.8, knee: 3.8, ankle: 2.8, toe: 2, elbow2: 3.2, wrist2: 2.8, knee2: 3.8, ankle2: 2.8, toe2: 2,
};

/** Normal adult ranges of motion, in this engine's angle terms (degrees). */
export const RANGES = {
  knee: [-6, 155], // flexion; negative = hyperextension (deeper is blocked by the calf)
  elbow: [-8, 155],
  hip: [-40, 165], // flexion; negative = extension
  ankle: [-5, 145], // 90 = neutral; lower = pointed (kneeling/prone feet lie flat), higher = dorsiflexion
  neck: [-70, 70],
  spine: [-50, 50],
} as const;

/** Segment mass fractions (Dempster/Winter) for the balance check. */
const MASS = { head: 0.081, lowerTrunk: 0.25, upperTrunk: 0.247, upperArm: 0.028, forearm: 0.022, thigh: 0.1, shank: 0.061 };
const LOAD: Record<string, number> = { barbell: 0.4, dumbbell: 0.08, kettlebell: 0.14, plate: 0.06, handle: 0, wheel: 0 };

function comX(sk: Skeleton, p: Pattern): number {
  const parts: [number, Pt][] = [
    [MASS.head, sk.head],
    [MASS.lowerTrunk, mid(sk.hip, sk.chest)],
    [MASS.upperTrunk, mid(sk.chest, sk.shoulder)],
    [MASS.upperArm, mid(sk.shoulder, sk.elbow)],
    [MASS.upperArm, mid(sk.shoulder, sk.elbow2)],
    [MASS.forearm, mid(sk.elbow, sk.wrist)],
    [MASS.forearm, mid(sk.elbow2, sk.wrist2)],
    [MASS.thigh, mid(sk.hip, sk.knee, 0.43)],
    [MASS.thigh, mid(sk.hip, sk.knee2, 0.43)],
    [MASS.shank, mid(sk.knee, sk.ankle, 0.6)],
    [MASS.shank, mid(sk.knee2, sk.ankle2, 0.6)],
  ];
  const load = p.hand ? LOAD[p.hand] : 0;
  if (load) {
    // A barbell is one load held by both hands; dumbbells are one per hand.
    if (p.hand === 'barbell' || p.hand === 'plate' || p.hand === 'kettlebell') parts.push([load, mid(sk.wrist, sk.wrist2)]);
    else parts.push([load, sk.wrist], [load, sk.wrist2]);
  }
  const m = parts.reduce((s, [w]) => s + w, 0);
  return parts.reduce((s, [w, q]) => s + w * q[0], 0) / m;
}

const onFloor = (sk: Skeleton, j: keyof Skeleton, slack = 3) => sk[j][1] + RADIUS[j] >= GROUND - slack;

export function auditPattern(p: Pattern, samples = 60): Issue[] {
  const skip = new Set(p.audit?.skip ?? []);
  const worst = new Map<AuditRule, { v: number; detail: string }>();
  const flag = (rule: AuditRule, v: number, detail: string) => {
    if (skip.has(rule)) return;
    const cur = worst.get(rule);
    if (!cur || v > cur.v) worst.set(rule, { v, detail });
  };
  const poses = sampleLoop(p, samples);

  if (p.view === 'front') {
    for (const pose of poses) {
      const f = placeFront(p, pose);
      for (const s of [f.right, f.left])
        for (const [name, q, r] of [['ankle', s.ankle, 2.8], ['toe', s.toe, 2], ['wrist', s.wrist, 2.8], ['knee', s.knee, 3.8]] as const)
          if (q[1] + r > GROUND + 1.5) flag('ground', q[1] + r - GROUND, `${name} ${(q[1] + r - GROUND).toFixed(1)}px below the floor`);
    }
    const lowest = Math.min(...poses.map((pose) => { const f = placeFront(p, pose); return GROUND - Math.max(f.right.toe[1], f.left.toe[1]) - 2; }));
    if (!p.props?.length && lowest > 3) flag('float', lowest, `never touches the floor (${lowest.toFixed(1)}px gap)`);
    return [...worst].map(([rule, { detail }]) => ({ rule, detail }));
  }

  const placed = poses.map((pose) => placeSide(p, pose));
  const contacts: Partial<Record<keyof Skeleton, number[]>> = {};
  let minGap = Infinity;

  for (const [si, sk] of placed.entries()) {
    const pose = poses[si];
    const a = {
      t: angleOf(sk.hip, sk.chest), ub: angleOf(sk.chest, sk.shoulder), n: angleOf(sk.shoulder, sk.head),
      ua: angleOf(sk.shoulder, sk.elbow), fa: angleOf(sk.elbow, sk.wrist), ua2: angleOf(sk.shoulder, sk.elbow2), fa2: angleOf(sk.elbow2, sk.wrist2),
      th: angleOf(sk.hip, sk.knee), sh: angleOf(sk.knee, sk.ankle), ft: angleOf(sk.ankle, sk.toe),
      th2: angleOf(sk.hip, sk.knee2), sh2: angleOf(sk.knee2, sk.ankle2), ft2: angleOf(sk.ankle2, sk.toe2),
    };
    const range = (rule: AuditRule, v: number, [lo, hi]: readonly [number, number], what: string) => {
      if (v < lo) flag(rule, lo - v, `${what} ${v.toFixed(0)}° (min ${lo}°)`);
      if (v > hi) flag(rule, v - hi, `${what} ${v.toFixed(0)}° (max ${hi}°)`);
    };
    range('knee', wrap180(a.th - a.sh), RANGES.knee, 'near knee');
    range('knee', wrap180(a.th2 - a.sh2), RANGES.knee, 'far knee');
    // Elbow angles only mean something when the upper arm is in the picture plane.
    if ((pose.uz ?? 0) < 25) range('elbow', wrap180(a.fa - a.ua), RANGES.elbow, 'near elbow');
    if ((pose.uz2 ?? pose.uz ?? 0) < 25) range('elbow', wrap180(a.fa2 - a.ua2), RANGES.elbow, 'far elbow');
    range('hip', wrap180(180 - a.t + a.th), RANGES.hip, 'near hip');
    range('hip', wrap180(180 - a.t + a.th2), RANGES.hip, 'far hip');
    range('ankle', wrap180(a.ft - a.sh), RANGES.ankle, 'near ankle');
    range('ankle', wrap180(a.ft2 - a.sh2), RANGES.ankle, 'far ankle');
    range('neck', wrap180(a.n - a.ub), RANGES.neck, 'neck');
    range('spine', wrap180(a.ub - a.t), RANGES.spine, 'spine');
    // Shoulder: flexion 0–200° (overhead and a little past), extension to 80°.
    for (const [ua, what, z] of [[a.ua, 'near shoulder', pose.uz ?? 0], [a.ua2, 'far shoulder', pose.uz2 ?? pose.uz ?? 0]] as const) {
      if (z >= 25) continue; // arm out to the side: not a sagittal angle
      const s = mod360(ua - a.ub + 180);
      if (s > 200 && s < 280) flag('shoulder', Math.min(s - 200, 280 - s), `${what} ${s.toFixed(0)}° outside its range`);
    }

    // Floor
    let lowest = -Infinity;
    for (const j of Object.keys(sk) as (keyof Skeleton)[]) {
      const bottom = sk[j][1] + RADIUS[j];
      lowest = Math.max(lowest, bottom);
      if (bottom > GROUND + 1.5) flag('ground', bottom - GROUND, `${j} ${(bottom - GROUND).toFixed(1)}px below the floor`);
    }
    minGap = Math.min(minGap, GROUND - lowest);
    for (const j of ['wrist', 'wrist2', 'ankle', 'ankle2', 'toe', 'toe2', 'knee', 'knee2'] as const) {
      if (onFloor(sk, j)) (contacts[j] ??= []).push(sk[j][0]);
      else contacts[j] = undefined as never;
    }

    // Balance: standing on both feet with nothing else holding you up.
    // Standing = feet down, hips well off the floor, and nothing else touching it.
    const standing =
      onFloor(sk, 'ankle', 5) && onFloor(sk, 'ankle2', 5) && sk.hip[1] < GROUND - 35 &&
      !(['wrist', 'wrist2', 'knee', 'knee2', 'hip', 'chest', 'shoulder', 'elbow', 'elbow2'] as const).some((j) => onFloor(sk, j, 6));
    const supported = (p.props?.length ?? 0) > 0 || (p.tether && p.tether.to !== 'ankle');
    if (standing && !supported) {
      const xs = [sk.ankle[0] - 4, sk.ankle2[0] - 4, sk.toe[0] + 2, sk.toe2[0] + 2];
      const lo = Math.min(...xs) - 3;
      const hi = Math.max(...xs) + 3;
      const c = comX(sk, p);
      if (c < lo || c > hi) flag('balance', Math.max(lo - c, c - hi), `centre of mass ${(c < lo ? lo - c : c - hi).toFixed(1)}px ${c < lo ? 'behind the heels' : 'ahead of the toes'}`);
      if (p.audit?.bar) {
        const footMid = (sk.ankle[0] + sk.toe[0]) / 2;
        const off = Math.abs(sk[p.audit.bar][0] - footMid);
        if (off > 8) flag('balance', off, `bar ${off.toFixed(1)}px from mid-foot`);
      }
    }
  }

  // Contacts that stay on the floor the whole loop must not slide.
  for (const [j, xs] of Object.entries(contacts)) {
    if (!xs || xs.length < samples) continue;
    const drift = Math.max(...xs) - Math.min(...xs);
    if (drift > 2.5) flag('slide', drift, `${j} slides ${drift.toFixed(1)}px while planted`);
  }
  if (!p.props?.length && minGap > 4) flag('float', minGap, `never touches the floor (${minGap.toFixed(1)}px gap)`);

  return [...worst].map(([rule, { detail }]) => ({ rule, detail }));
}

export function auditAll(): Record<string, Issue[]> {
  const out: Record<string, Issue[]> = {};
  for (const [id, p] of Object.entries(PATTERNS)) {
    const issues = auditPattern(p);
    if (issues.length) out[id] = issues;
  }
  return out;
}
