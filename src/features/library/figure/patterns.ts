import type { Joint, Pose, Pt } from './kinematics';

export type Prop =
  | { type: 'bench'; x: number; y: number; w: number; angle?: number; legs?: boolean }
  | { type: 'bar'; x: number; y: number; w: number }
  | { type: 'box'; x: number; y: number; w: number; h: number }
  | { type: 'wall'; x: number }
  | { type: 'pulley'; x: number; y: number };

export type HandItem = 'barbell' | 'dumbbell' | 'kettlebell' | 'plate' | 'handle' | 'wheel';

export interface Pattern {
  view: 'side' | 'front';
  anchor: Joint;
  at: Pt;
  frames: Pose[];
  /** ms per transition */
  ms?: number;
  /** ms pause on each keyframe */
  hold?: number;
  /** pingpong: A→B→A… ; cycle: A→B→C→A… */
  loop?: 'pingpong' | 'cycle';
  hand?: HandItem;
  foot?: 'plate';
  tether?: { from: 'wrist' | 'ankle'; to: Pt | 'ankle'; kind: 'cable' | 'band' };
  props?: Prop[];
  /**
   * Hands/feet that stay planted (solved with IK, so they never slide): a list keeps each
   * where it is in frame 0; a map pins it to an exact point. A toe lock lets the heel rise.
   */
  lock?: LockJoint[] | Partial<Record<LockJoint, Pt>>;
  /** Dumbbell grip: 'neutral' (palms facing, handle seen side-on) instead of the usual end-on view. */
  grip?: 'neutral';
  /** Hands move in a straight line between keyframes (presses: the bar goes straight up), arms solved by IK. */
  track?: boolean;
  /** A loop band around the knees (banded bridges, lateral walks). */
  loopBand?: boolean;
  /** Which transition of a two-frame rep is the lowering (eccentric) phase; it runs slower. */
  ecc?: 'to' | 'back';
  /** Continuous cyclic movement (running, jacks): spline through the frames without stopping. */
  smooth?: boolean;
  /** Keyframe used for thumbnails and reduced motion (default: frame 1, the working position). */
  show?: number;
  /** Biomechanics audit settings (see audit.ts). */
  audit?: {
    /** Rules that don't apply, e.g. 'elbow' for 3D shoulder rotation seen from the side. */
    skip?: AuditRule[];
    /** This joint carries the load and must stay over mid-foot (barbell lifts). */
    bar?: 'wrist' | 'shoulder';
  };
}

export type LockJoint = 'wrist' | 'wrist2' | 'ankle' | 'ankle2' | 'toe' | 'toe2';
export type AuditRule = 'ground' | 'knee' | 'elbow' | 'hip' | 'ankle' | 'neck' | 'shoulder' | 'spine' | 'slide' | 'balance' | 'float';

export const GROUND = 152;
const FOOT_Y = 148;
const STAND: Pt = [92, FOOT_Y];
/** Hip height when standing tall (leg length 61). */
const HIP_Y = FOOT_Y - 61;

// Reusable poses ---------------------------------------------------------------
const stand: Pose = { t: 180, ua: 3, fa: 6, th: 0, sh: 0 };
const overhead: Pose = { ...stand, ua: 176, fa: 180 };
const plankHigh: Pose = { t: 112, ua: 2, fa: 2, th: -68, sh: -68, ft: 8 };
const plankLow: Pose = { t: 97, ua: -78, fa: 6, th: -84, sh: -84, ft: 8 };
const lieBack = (o: Partial<Pose>): Pose => ({ t: -90, ua: 180, fa: 180, th: 68, sh: -4, ft: 90, ...o });
const seated = (o: Partial<Pose>): Pose => ({ t: 182, ua: 3, fa: 6, th: 90, sh: 2, ft: 90, ...o });
const kneelHinge = (o: Partial<Pose>): Pose => ({ t: 95, ua: 0, fa: 0, th: 0, sh: -90, ft: -90, ...o });
/** Hands on hips, seen from the side. */
const handsOnHips = { ua: -30, fa: 60 };

/** Both feet planted flat at x (legs are solved by IK, so the knees track naturally). */
const feet = (x: number, x2 = x): Partial<Record<LockJoint, Pt>> => ({ ankle: [x, FOOT_Y], ankle2: [x2, FOOT_Y] });

const flatBench = (y = 108): Prop => ({ type: 'bench', x: 34, y, w: 104, legs: true });

export const PATTERNS: Record<string, Pattern> = {
  // ── Squat family ──────────────────────────────────────────────────────────
  // Hips back and down to at least parallel, knees track over the toes, the load stays over mid-foot.
  squat_back: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell', ecc: 'to', ms: 1000,
    // Gripping a bar behind the neck rotates the shoulders outward; the side view can't show that.
    audit: { skip: ['elbow'], bar: 'shoulder' },
    frames: [
      { ...stand, n: 182, ua: -42, fa: 160 },
      { t: 146, n: 156, ua: -74, fa: 126, th: 88, sh: -38 },
    ],
  },
  squat_front: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell', ecc: 'to', ms: 1000, audit: { bar: 'wrist' },
    // Elbows high, bar resting on the front of the shoulders, torso stays tall.
    frames: [
      { ...stand, n: 182, ua: 92, fa: 246 },
      { t: 160, n: 168, ua: 72, fa: 226, th: 92, sh: -38 },
    ],
  },
  squat_goblet: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'kettlebell', ecc: 'to',
    frames: [
      { ...stand, ua: 18, fa: 166 },
      { t: 154, ua: 4, fa: 150, th: 90, sh: -38 },
    ],
  },
  squat_bw: {
    view: 'side', anchor: 'ankle', at: STAND, ecc: 'to',
    frames: [
      { ...stand, ua: 10, fa: 14 },
      { t: 145, ua: 86, fa: 90, th: 88, sh: -38 },
    ],
  },
  squat_band: {
    view: 'side', anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: 'ankle', kind: 'band' }, ecc: 'to',
    frames: [
      { ...stand, ua: 18, fa: 150 },
      { t: 148, ua: -6, fa: 136, th: 88, sh: -38 },
    ],
  },
  squat_jump: {
    view: 'side', anchor: 'ankle', at: STAND, ms: 480, hold: 60, loop: 'cycle',
    frames: [
      { t: 145, ua: -40, fa: -30, th: 84, sh: -38 },
      { ...stand, ua: 170, fa: 175, ft: 40, ay: FOOT_Y - 24 },
      { t: 166, ua: 40, fa: 50, th: 40, sh: -22 },
    ],
  },
  wall_sit: {
    view: 'side', anchor: 'ankle', at: [100, FOOT_Y], ms: 1600, props: [{ type: 'wall', x: 54 }],
    frames: [
      { t: 180, ua: 80, fa: 88, th: 90, sh: 0 },
      { t: 181, ua: 82, fa: 90, th: 90, sh: 0 },
    ],
  },
  leg_press: {
    view: 'side', anchor: 'hip', at: [72, 118], foot: 'plate', ecc: 'back', show: 0,
    props: [{ type: 'box', x: 56, y: 124, w: 34, h: 28 }, { type: 'bench', x: 82, y: 122, w: 62, angle: 146 }],
    frames: [
      { t: -122, ua: 70, fa: 90, th: 150, sh: 102, ft: 160 },
      { t: -122, ua: 70, fa: 90, th: 124, sh: 124, ft: 200 },
    ],
  },

  // ── Lunge family ──────────────────────────────────────────────────────────
  // Front shin near vertical, back knee drops toward the floor, torso tall.
  // Walking lunge: step forward into the lunge, then bring the back foot through.
  lunge: {
    view: 'side', anchor: 'hip', at: [70, HIP_Y], hand: 'dumbbell', loop: 'cycle', ms: 560, hold: 140, show: 2,
    lock: { toe2: [79, FOOT_Y] },
    frames: [
      { t: 180, ua: 2, fa: 2, th: 0, sh: 0, ft: 90, ft2: 90, ax: 70, ay: HIP_Y },
      { t: 179, ua: 2, fa: 2, th: 48, sh: -20, ft: 84, ft2: 74, ax: 80, ay: 90 },
      { t: 178, ua: 2, fa: 2, th: 84, sh: -4, ft: 90, ft2: 40, ax: 98, ay: 114 },
      { t: 179, ua: 2, fa: 2, th: 48, sh: -20, ft: 84, ft2: 74, ax: 80, ay: 90 },
    ],
  },
  // Reverse lunge: the front foot stays planted, the other steps back.
  lunge_bw: {
    view: 'side', anchor: 'hip', at: [110, HIP_Y], loop: 'cycle', ms: 560, hold: 140, show: 2,
    lock: { ankle: [110, FOOT_Y] },
    frames: [
      { t: 180, ...handsOnHips, th: 0, sh: 0, th2: 0, sh2: 0, ft2: 90, ax: 110, ay: HIP_Y },
      { t: 179, ...handsOnHips, th: 6, sh: 0, th2: -24, sh2: -70, ft2: 20, ax: 104, ay: 92 },
      { t: 177, ...handsOnHips, th: 70, sh: -4, th2: -12, sh2: -100, ft2: 40, ax: 82, ay: 115 },
      { t: 179, ...handsOnHips, th: 6, sh: 0, th2: -24, sh2: -70, ft2: 20, ax: 104, ay: 92 },
    ],
  },
  // Split squat: both feet stay planted; straight down and up.
  split_squat_bw: {
    view: 'side', anchor: 'hip', at: [92, 96], ecc: 'to', ms: 1000,
    lock: { ankle: [120, FOOT_Y], toe2: [58, FOOT_Y] },
    frames: [
      { t: 180, ...handsOnHips, th: 20, sh: 0, th2: -20, sh2: -40, ft2: 40, ax: 92, ay: 96 },
      { t: 178, ...handsOnHips, th: 80, sh: 0, th2: -10, sh2: -100, ft2: 40, ax: 89, ay: 117 },
    ],
  },
  // Bulgarian split squat: rear foot laces-down on a bench.
  // Bulgarian split squat: rear foot laces-down on a bench.
  split_squat: {
    view: 'side', anchor: 'hip', at: [98, 95], hand: 'dumbbell', ecc: 'to', ms: 1000,
    props: [{ type: 'box', x: 30, y: 122, w: 34, h: 30 }],
    lock: { ankle: [126, FOOT_Y], toe2: [46, 119] },
    frames: [
      { t: 180, ua: 2, fa: 2, th: 20, sh: 0, th2: -40, sh2: -60, ft2: -80, ax: 98, ay: 95 },
      { t: 174, ua: 2, fa: 2, th: 80, sh: 0, th2: -40, sh2: -110, ft2: -80, ax: 97, ay: 116 },
    ],
  },
  // Curtsy lunge, seen from the front: the left leg steps behind and across.
  curtsy_lunge: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], ecc: 'to', ms: 900,
    frames: [
      { t: 180, ua: 30, fa: -60, th: 6, sh: 0 },
      { t: 178, ua: 30, fa: -60, th: 8, sh: -4, tf: 70, th2: -24, sh2: -10, tf2: 25, sf2: 75 },
    ],
  },
  calf_raise: {
    view: 'side', anchor: 'toe', at: [101, FOOT_Y], hand: 'dumbbell', ms: 700, hold: 300, ecc: 'back',
    frames: [
      { ...stand, ua: 1, fa: 1, ft: 90 },
      { ...stand, ua: 1, fa: 1, ft: 36 },
    ],
  },
  leg_ext: {
    view: 'side', anchor: 'hip', at: [74, 108], ecc: 'back',
    props: [{ type: 'box', x: 50, y: 110, w: 50, h: 42 }],
    frames: [
      seated({ ua: 30, fa: 40, sh: -8, ft: 80 }),
      seated({ ua: 30, fa: 40, sh: 84, ft: 170 }),
    ],
  },
  leg_curl: {
    view: 'side', anchor: 'hip', at: [100, 104], props: [flatBench(110)], ecc: 'back',
    frames: [
      { t: 90, n: 100, ua: 2, fa: 30, th: -90, sh: -92, ft: 0 },
      { t: 90, n: 100, ua: 2, fa: 30, th: -90, sh: -178, ft: -90 },
    ],
  },

  // ── Hinge family ──────────────────────────────────────────────────────────
  // Hips drive back, spine stays neutral, the bar travels in a straight line over mid-foot.
  deadlift: {
    view: 'side', anchor: 'hip', at: [92, HIP_Y], hand: 'barbell', ecc: 'back', show: 0, ms: 1000,
    lock: feet(92), audit: { bar: 'wrist' },
    frames: [
      { t: 115, n: 122, ua: 0, fa: 0, th: 80, sh: 0, ax: 61, ay: 113 },
      { t: 180, n: 182, ua: -2, fa: -2, th: 0, sh: 0, ax: 92, ay: HIP_Y },
    ],
  },
  rdl: {
    view: 'side', anchor: 'hip', at: [92, HIP_Y], hand: 'barbell', ecc: 'to', ms: 1000,
    lock: feet(92), audit: { bar: 'wrist' },
    frames: [
      { t: 180, n: 182, ua: -2, fa: -2, th: 0, sh: 0, ax: 92, ay: HIP_Y },
      { t: 113, n: 120, ua: 0, fa: 0, th: 30, sh: 0, ax: 60, ay: 97 },
    ],
  },
  rdl_db: {
    view: 'side', anchor: 'hip', at: [92, HIP_Y], hand: 'dumbbell', ecc: 'to', ms: 1000,
    lock: feet(92),
    frames: [
      { t: 180, n: 182, ua: -1, fa: -1, th: 0, sh: 0, ax: 92, ay: HIP_Y },
      { t: 112, n: 120, ua: 2, fa: 2, th: 30, sh: 0, ax: 62, ay: 98 },
    ],
  },
  kb_swing: {
    view: 'side', anchor: 'hip', at: [92, HIP_Y], hand: 'kettlebell', ms: 620, hold: 40,
    lock: feet(92),
    frames: [
      { t: 120, n: 127, ua: -30, fa: -30, ax: 67, ay: 99, th: 30, sh: 0 },
      { t: 182, n: 184, ua: 90, fa: 92, ax: 92, ay: HIP_Y, th: 0, sh: 0 },
    ],
  },
  hip_thrust: {
    view: 'side', anchor: 'ankle', at: [128, FOOT_Y], hand: 'barbell', ecc: 'back',
    props: [{ type: 'box', x: 22, y: 112, w: 36, h: 40 }],
    frames: [
      { t: -116, n: -110, ua: 70, fa: 140, th: 150, sh: 14 },
      { t: -82, n: -110, ua: 120, fa: 175, th: 98, sh: 0 },
    ],
  },
  glute_bridge: {
    view: 'side', anchor: 'ankle', at: [124, FOOT_Y], ecc: 'back',
    frames: [
      { t: -90, n: -90, ua: 90, fa: 90, th: 142, sh: 20 },
      { t: -70, n: -80, ua: 72, fa: 88, th: 108, sh: 2 },
    ],
  },
  glute_bridge_band: {
    view: 'side', anchor: 'ankle', at: [124, FOOT_Y], ecc: 'back', loopBand: true, hold: 360,
    frames: [
      { t: -90, n: -90, ua: 90, fa: 90, th: 142, sh: 20 },
      { t: -68, n: -80, ua: 72, fa: 88, th: 106, sh: 2 },
    ],
  },
  superman: {
    view: 'side', anchor: 'hip', at: [92, 144], hold: 400,
    frames: [
      { t: 90, n: 90, ua: 90, fa: 90, th: -90, sh: -90, ft: -90 },
      { t: 102, ub: 108, n: 114, ua: 112, fa: 114, th: -102, sh: -104, ft: -100 },
    ],
  },
  glute_kickback: {
    view: 'side', anchor: 'wrist', at: [132, FOOT_Y + 1], tether: { from: 'ankle', to: [140, 150], kind: 'band' }, ecc: 'back',
    frames: [
      kneelHinge({ th: 6, sh: -88, th2: 0, sh2: -90, ft2: -90 }),
      kneelHinge({ th: -104, sh: -110, ft: -60, th2: 0, sh2: -90, ft2: -90 }),
    ],
  },

  // ── Push family ───────────────────────────────────────────────────────────
  bench_press: {
    view: 'side', track: true, anchor: 'hip', at: [118, 102], hand: 'barbell', props: [flatBench()], ecc: 'to',
    frames: [
      lieBack({ ua: 180, fa: 180 }),
      lieBack({ ua: 50, fa: 176, uz: 40 }),
    ],
  },
  incline_press: {
    view: 'side', track: true, anchor: 'hip', at: [116, 104], hand: 'dumbbell', ecc: 'to',
    props: [{ type: 'bench', x: 66, y: 110, w: 70, legs: true }, { type: 'bench', x: 116, y: 108, w: 54, angle: 145 }],
    frames: [
      lieBack({ t: -128, ua: 182, fa: 182, th: 84, sh: -4 }),
      lieBack({ t: -128, ua: 60, fa: 178, uz: 40, th: 84, sh: -4 }),
    ],
  },
  // Fly: arms open wide in an arc with a fixed soft bend, out to the sides (foreshortened).
  fly: {
    view: 'side', anchor: 'hip', at: [118, 102], hand: 'dumbbell', props: [flatBench()], ecc: 'to',
    frames: [
      lieBack({ ua: 176, fa: 186 }),
      lieBack({ ua: 160, fa: 196, uz: 74 }),
    ],
  },
  floor_press: {
    view: 'side', track: true, anchor: 'hip', at: [104, 146], hand: 'dumbbell', ecc: 'to',
    frames: [
      lieBack({ ua: 180, fa: 180, th: 140, sh: 20 }),
      lieBack({ ua: 96, fa: 178, uz: 40, th: 140, sh: 20 }),
    ],
  },
  skull_crusher: {
    view: 'side', anchor: 'hip', at: [118, 102], hand: 'barbell', props: [flatBench()], ecc: 'to',
    frames: [
      lieBack({ ua: 172, fa: 176 }),
      lieBack({ ua: 166, fa: 300 }),
    ],
  },
  machine_press: {
    view: 'side', anchor: 'hip', at: [74, 110], hand: 'handle', ecc: 'back', show: 0,
    props: [{ type: 'box', x: 50, y: 112, w: 44, h: 40 }, { type: 'bench', x: 50, y: 112, w: 56, angle: 100 }],
    frames: [
      seated({ t: 186, ua: -40, fa: 92, uz: 30 }),
      seated({ t: 186, ua: 88, fa: 90 }),
    ],
  },
  ohp: {
    view: 'side', track: true, anchor: 'ankle', at: STAND, hand: 'barbell', ecc: 'back', audit: { bar: 'wrist' },
    frames: [{ ...stand, n: 184, ua: 20, fa: 180, uz: 45 }, { ...overhead, uz: 10 }],
  },
  // Elbows out to the sides at the bottom (foreshortened), stacked under the wrists.
  db_press_standing: {
    view: 'side', track: true, anchor: 'ankle', at: STAND, hand: 'dumbbell', ecc: 'back',
    frames: [
      { ...stand, ua: 14, fa: 180, uz: 62 },
      { ...overhead, uz: 12 },
    ],
  },
  seated_press: {
    view: 'side', track: true, anchor: 'hip', at: [86, 110], hand: 'dumbbell', ecc: 'back',
    props: [{ type: 'box', x: 62, y: 112, w: 42, h: 40 }, { type: 'bench', x: 64, y: 112, w: 60, angle: 172 }],
    frames: [
      seated({ ua: 14, fa: 180, uz: 62 }),
      seated({ ua: 178, fa: 180, uz: 12 }),
    ],
  },
  // Arnold press: start with elbows in front and palms facing you, rotate the elbows out, press.
  arnold_press: {
    view: 'side', anchor: 'hip', at: [86, 110], hand: 'dumbbell', loop: 'cycle', ms: 650, hold: 160,
    props: [{ type: 'box', x: 62, y: 112, w: 42, h: 40 }, { type: 'bench', x: 64, y: 112, w: 60, angle: 172 }],
    frames: [
      seated({ ua: 28, fa: 174 }),
      seated({ ua: 40, fa: 180, uz: 62 }),
      seated({ ua: 178, fa: 180, uz: 12 }),
      seated({ ua: 40, fa: 180, uz: 62 }),
    ],
  },
  // Push-ups: hands stay planted (IK), body moves as one rigid plank, elbows ~45°.
  pushup: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2], lock: ['wrist', 'wrist2'], ecc: 'to',
    frames: [plankHigh, { ...plankLow, uz: 32 }],
  },
  pushup_wide: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2], lock: ['wrist', 'wrist2'], ecc: 'to',
    frames: [{ ...plankHigh, ua: 8, fa: 8 }, { ...plankLow, t: 98, th: -83, sh: -83, uz: 64 }],
  },
  pushup_diamond: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2], lock: ['wrist', 'wrist2'], ecc: 'to',
    frames: [{ ...plankHigh, ua: -6, fa: -6 }, { ...plankLow, t: 99, th: -82, sh: -82, uz: 0 }],
  },
  // Pike push-up: inverted V, arms in line with the torso; lower the head toward the floor.
  pike_pushup: {
    view: 'side', anchor: 'toe', at: [50, FOOT_Y + 2], lock: ['wrist', 'wrist2'], ecc: 'to',
    frames: [
      { t: 45, n: 40, ua: 45, fa: 45, th: -32, sh: -32, ft: 20 },
      { t: 60, n: 50, ua: -40, fa: 40, th: -32, sh: -32, ft: 20, uz: 22 },
    ],
  },
  dip: {
    view: 'side', anchor: 'wrist', at: [96, 82], props: [{ type: 'bar', x: 78, y: 84, w: 36 }], ecc: 'to',
    frames: [
      { t: 172, ua: 4, fa: 2, th: 12, sh: -62, ft: 30 },
      { t: 158, ua: -70, fa: 8, th: 24, sh: -52, ft: 30 },
    ],
  },
  // Chair dip: hands on the seat edge, feet flat, lower until the elbows reach ~90°.
  chair_dip: {
    view: 'side', anchor: 'hip', at: [68, 110], ecc: 'to', props: [{ type: 'box', x: 30, y: 110, w: 30, h: 42 }],
    lock: { wrist: [58, 107], wrist2: [58, 107], ankle: [114, FOOT_Y], ankle2: [114, FOOT_Y] },
    frames: [
      { t: 182, n: 184, ua: 0, fa: 0, th: 70, sh: 0, ax: 68, ay: 110 },
      { t: 182, n: 184, ua: 0, fa: 0, th: 80, sh: 0, ax: 68, ay: 123 },
    ],
  },
  pushdown: {
    view: 'side', anchor: 'ankle', at: [86, FOOT_Y], hand: 'handle', ecc: 'back',
    tether: { from: 'wrist', to: [150, 18], kind: 'cable' }, props: [{ type: 'pulley', x: 150, y: 18 }],
    frames: [
      { t: 172, ua: 8, fa: 150, th: 4, sh: -4 },
      { t: 172, ua: 6, fa: 4, th: 4, sh: -4 },
    ],
  },
  overhead_ext: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', grip: 'neutral', ecc: 'to',
    frames: [
      { ...stand, ua: 170, fa: 178 },
      { ...stand, ua: 164, fa: 314 },
    ],
  },
  band_overhead_ext: {
    view: 'side', anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: 'ankle', kind: 'band' }, ecc: 'to',
    frames: [
      { ...stand, ua: 170, fa: 178 },
      { ...stand, ua: 162, fa: 312 },
    ],
  },
  band_press: {
    view: 'side', anchor: 'ankle', at: [100, FOOT_Y], tether: { from: 'wrist', to: [44, 76], kind: 'band' }, ecc: 'back',
    props: [{ type: 'pulley', x: 44, y: 76 }],
    frames: [
      { t: 176, ua: -50, fa: 94, uz: 30, th: 4, sh: -4 },
      { t: 176, ua: 86, fa: 90, th: 4, sh: -4 },
    ],
  },

  // ── Pull family ───────────────────────────────────────────────────────────
  // Pull-up: wide overhand grip, elbows drive down and out to the sides.
  pullup: {
    view: 'side', anchor: 'wrist', at: [100, -6], props: [{ type: 'bar', x: 60, y: -6, w: 80 }], ecc: 'back',
    frames: [
      { t: 180, ua: 174, fa: 178, uz: 28, th: 8, sh: -34, ft: 40 },
      { t: 186, ub: 192, n: 194, ua: 16, fa: 172, uz: 60, th: 14, sh: -38, ft: 40 },
    ],
  },
  // Chin-up: palms facing you, elbows travel down in front of the body.
  chin_up: {
    view: 'side', anchor: 'wrist', at: [100, -6], props: [{ type: 'bar', x: 72, y: -6, w: 56 }], ecc: 'back',
    frames: [
      { t: 180, ua: 178, fa: 180, th: 8, sh: -30, ft: 40 },
      { t: 186, ub: 190, n: 192, ua: 22, fa: 168, th: 14, sh: -34, ft: 40 },
    ],
  },
  hanging_leg_raise: {
    view: 'side', anchor: 'wrist', at: [100, -6], props: [{ type: 'bar', x: 70, y: -6, w: 60 }], ecc: 'back',
    frames: [
      { t: 180, ua: 178, fa: 180, th: 2, sh: 0, ft: 40 },
      { t: 176, ub: 182, ua: 176, fa: 180, th: 96, sh: 96, ft: 160 },
    ],
  },
  pulldown: {
    view: 'side', anchor: 'hip', at: [92, 110], hand: 'handle', ecc: 'back',
    tether: { from: 'wrist', to: [104, 4], kind: 'cable' }, props: [{ type: 'box', x: 70, y: 112, w: 40, h: 40 }],
    frames: [
      seated({ t: 186, ua: 172, fa: 176, uz: 24 }),
      seated({ t: 194, ub: 198, ua: 14, fa: 166, uz: 52 }),
    ],
  },
  // Bent-over rows: hinged ~40°, soft knees, pull to the lower ribs.
  row_barbell: {
    view: 'side', anchor: 'hip', at: [69, 97], hand: 'barbell', ecc: 'back', lock: feet(92),
    frames: [
      { t: 120, th: 0, sh: 0, n: 128, ua: 0, fa: 0, ax: 69, ay: 97 },
      { t: 122, th: 0, sh: 0, n: 130, ua: -58, fa: 4, uz: 32, ax: 69, ay: 97 },
    ],
  },
  db_bent_row: {
    view: 'side', anchor: 'hip', at: [66, 97], hand: 'dumbbell', grip: 'neutral', ecc: 'back', lock: feet(92),
    frames: [
      { t: 120, th: 0, sh: 0, n: 128, ua: 2, fa: 2, ax: 70, ay: 97 },
      { t: 121, th: 0, sh: 0, n: 129, ua: -70, fa: 2, ax: 70, ay: 97 },
    ],
  },
  row_db: {
    view: 'side', anchor: 'ankle', at: [118, FOOT_Y], hand: 'dumbbell', grip: 'neutral', ecc: 'back',
    props: [{ type: 'bench', x: 120, y: 108, w: 60, legs: true }],
    frames: [
      { t: 104, ua: 0, fa: 0, ua2: 14, fa2: 14, th: 6, sh: -6 },
      { t: 106, ua: -74, fa: 4, ua2: 14, fa2: 14, th: 6, sh: -6 },
    ],
  },
  seated_row: {
    view: 'side', anchor: 'hip', at: [66, 120], hand: 'handle', ecc: 'back',
    tether: { from: 'wrist', to: [178, 116], kind: 'cable' },
    props: [{ type: 'box', x: 40, y: 122, w: 60, h: 30 }, { type: 'pulley', x: 178, y: 116 }],
    frames: [
      { t: 164, ua: 92, fa: 92, th: 84, sh: 78, ft: 170 },
      { t: 186, ua: -64, fa: 88, th: 84, sh: 78, ft: 170 },
    ],
  },
  band_row: {
    view: 'side', anchor: 'ankle', at: [86, FOOT_Y], tether: { from: 'wrist', to: [176, 82], kind: 'band' }, ecc: 'back',
    props: [{ type: 'pulley', x: 176, y: 82 }],
    frames: [
      { t: 176, ua: 92, fa: 92, th: 4, sh: -4 },
      { t: 182, ua: -60, fa: 92, th: 4, sh: -4 },
    ],
  },
  // Face pull: elbows high and out to the sides, hands finish beside the ears.
  face_pull: {
    view: 'side', anchor: 'ankle', at: [80, FOOT_Y], hand: 'handle', ecc: 'back',
    tether: { from: 'wrist', to: [176, 46], kind: 'cable' }, props: [{ type: 'pulley', x: 176, y: 46 }],
    frames: [
      { t: 176, ua: 100, fa: 100, th: 4, sh: -4 },
      { t: 182, ua: 168, fa: 176, uz: 72, th: 4, sh: -4 },
    ],
  },
  // Rear-delt fly: hinged, arms rise out to the sides (foreshortened) with soft elbows.
  reverse_fly: {
    view: 'side', anchor: 'hip', at: [66, 98], hand: 'dumbbell', ecc: 'back', lock: feet(92),
    frames: [
      { t: 120, th: 0, sh: 0, n: 128, ua: 2, fa: 8, ax: 66, ay: 98 },
      { t: 120, th: 0, sh: 0, n: 128, ua: 30, fa: 40, uz: 76, ax: 66, ay: 98 },
    ],
  },
  renegade_row: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2], hand: 'dumbbell', grip: 'neutral', lock: ['wrist2'], ecc: 'back',
    frames: [plankHigh, { ...plankHigh, ua: -80, fa: 2, ua2: 2, fa2: 2 }],
  },

  // ── Arms ─────────────────────────────────────────────────────────────────
  curl: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', ecc: 'back',
    frames: [{ ...stand, ua: 4, fa: 6 }, { ...stand, ua: 10, fa: 150 }],
  },
  hammer_curl: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', grip: 'neutral', ecc: 'back',
    frames: [{ ...stand, ua: 3, fa: 4 }, { ...stand, ua: 8, fa: 146 }],
  },
  curl_barbell: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell', ecc: 'back',
    frames: [{ ...stand, ua: 4, fa: 6 }, { ...stand, ua: 10, fa: 150 }],
  },
  curl_band: {
    view: 'side', anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: 'ankle', kind: 'band' }, ecc: 'back',
    frames: [{ ...stand, ua: 4, fa: 6 }, { ...stand, ua: 10, fa: 150 }],
  },
  front_raise: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', ecc: 'back',
    frames: [{ ...stand, ua: 10, fa: 14 }, { ...stand, ua: 94, fa: 98 }],
  },

  // ── Front-view patterns ──────────────────────────────────────────────────
  lateral_raise: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], hand: 'dumbbell', ecc: 'back',
    frames: [
      { t: 180, ua: 10, fa: 14, th: 4, sh: 0 },
      { t: 180, ua: 86, fa: 92, th: 4, sh: 0 },
    ],
  },
  cable_fly: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], hand: 'handle', ecc: 'back',
    tether: { from: 'wrist', to: [186, 12], kind: 'cable' },
    frames: [
      { t: 180, ua: 112, fa: 104, th: 10, sh: 2 },
      { t: 180, ua: 34, fa: -20, af: 30, th: 10, sh: 2 },
    ],
  },
  band_pull_apart: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], ecc: 'back',
    frames: [
      { t: 180, ua: 76, fa: -40, af: 40, th: 4, sh: 0 },
      { t: 180, ua: 92, fa: 92, th: 4, sh: 0 },
    ],
  },
  jumping_jack: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], ms: 380, smooth: true,
    frames: [
      { t: 180, ua: 14, fa: 10, th: 2, sh: 0 },
      { t: 180, ua: 164, fa: 170, th: 18, sh: 16 },
    ],
  },

  // ── Core ─────────────────────────────────────────────────────────────────
  plank: {
    view: 'side', anchor: 'toe', at: [40, FOOT_Y + 2], ms: 1800,
    frames: [
      { t: 103, ua: 2, fa: 90, th: -77, sh: -77, ft: 8 },
      { t: 104, ua: 2, fa: 90, th: -76, sh: -76, ft: 8 },
    ],
  },
  // Crunch: only the upper back curls; the lower back stays on the floor.
  crunch: {
    view: 'side', anchor: 'hip', at: [104, 146], ecc: 'back',
    frames: [
      { t: -90, ub: -92, n: -96, ua: 150, fa: 150, th: 140, sh: 20 },
      { t: -90, ub: -128, n: -140, ua: 128, fa: 128, th: 140, sh: 20 },
    ],
  },
  bicycle_crunch: {
    view: 'side', anchor: 'hip', at: [100, 146], ms: 620, smooth: true,
    frames: [
      { t: -92, ub: -124, n: -134, ua: 166, fa: 250, th: 150, sh: 72, th2: 100, sh2: 98, ft: 160, ft2: 180 },
      { t: -92, ub: -124, n: -134, ua: 166, fa: 250, th: 100, sh: 98, th2: 150, sh2: 72, ft: 180, ft2: 160 },
    ],
  },
  // Cable crunch: kneeling, hips still, the spine curls the elbows toward the knees.
  cable_crunch: {
    view: 'side', anchor: 'knee', at: [100, FOOT_Y], hand: 'handle', ecc: 'back',
    tether: { from: 'wrist', to: [116, 6], kind: 'cable' },
    frames: [
      { t: 170, ub: 166, n: 160, ua: 28, fa: 168, th: 8, sh: -90, ft: -92 },
      { t: 146, ub: 100, n: 82, ua: -30, fa: 108, th: 8, sh: -90, ft: -92 },
    ],
  },
  ab_wheel: {
    view: 'side', anchor: 'knee', at: [70, FOOT_Y], hand: 'wheel', ms: 1300, ecc: 'to',
    frames: [
      { t: 130, ub: 122, n: 116, ua: 4, fa: 4, th: 10, sh: -90, ft: -90 },
      { t: 100, ub: 97, n: 96, ua: 104, fa: 104, th: -54, sh: -90, ft: -90 },
    ],
  },
  russian_twist: {
    view: 'side', anchor: 'hip', at: [86, 146], hand: 'plate', ms: 700,
    frames: [
      { t: 214, n: 204, ua: 104, fa: 150, th: 128, sh: 70, ft: 140 },
      { t: 214, n: 204, ua: 60, fa: 110, th: 128, sh: 70, ft: 140 },
    ],
  },
  // Mountain climber: hands planted, hips level, knees drive in with the foot off the floor.
  // Mountain climber: hands planted, hips level, knees drive in with the foot off the floor.
  mountain_climber: {
    view: 'side', anchor: 'shoulder', at: [140, 102], lock: ['wrist', 'wrist2'], ms: 200, smooth: true, show: 0,
    frames: [
      { ...plankHigh, th: 64, sh: -82, ft: 30, th2: -68, sh2: -68, ft2: 8 },
      { ...plankHigh, t: 96, th: 10, sh: -100, ft: 0, th2: 10, sh2: -95, ft2: 45 },
      { ...plankHigh, th: -68, sh: -68, ft: 8, th2: 64, sh2: -82, ft2: 30 },
      { ...plankHigh, t: 96, th: 10, sh: -95, ft: 45, th2: 10, sh2: -100, ft2: 0 },
    ],
  },
  // Burpee: squat down with hands planted, jump back to a plank, jump in, jump up.
  // Burpee: squat with hips back, hands down, hips pop up as the feet jump back to a plank,
  // jump the feet in, then jump up.
  burpee: {
    view: 'side', anchor: 'ankle', at: [100, FOOT_Y], loop: 'cycle', ms: 300, hold: 50, show: 4,
    frames: [
      { ...stand, ua: 6, fa: 10 },
      { t: 145, n: 160, ua: 70, fa: 76, th: 86, sh: -38, ft: 90 },
      { t: 125, n: 140, ua: 20, fa: 20, th: 100, sh: -40, ft: 90 },
      { t: 86, n: 90, ua: 2, fa: 2, th: -40, sh: -60, ft: 20, ax: 49, ay: 134 },
      { ...plankHigh, ax: 41.5, ay: 141 },
      { t: 86, n: 90, ua: 2, fa: 2, th: -40, sh: -60, ft: 20, ax: 49, ay: 134 },
      { t: 125, n: 140, ua: 20, fa: 20, th: 100, sh: -40, ft: 90 },
      { ...stand, ua: 172, fa: 176, ft: 40, ay: 128 },
    ],
  },
  high_knees: {
    view: 'side', anchor: 'hip', at: [96, HIP_Y], ms: 280, smooth: true,
    frames: [
      { t: 182, ua: -40, fa: 60, ua2: 50, fa2: 150, th: 0, sh: 0, ft: 70, th2: 92, sh2: 4, ft2: 60 },
      { t: 182, ua: 50, fa: 150, ua2: -40, fa2: 60, th: 92, sh: 4, ft: 60, th2: 0, sh2: 0, ft2: 70 },
    ],
  },
  // Farmer's carry: a walking cycle, shoulders level, neutral grip.
  farmer_carry: {
    view: 'side', anchor: 'hip', at: [96, HIP_Y], hand: 'dumbbell', grip: 'neutral', ms: 420, smooth: true,
    frames: [
      { t: 180, ua: 2, fa: 2, th: 22, sh: 8, ft: 100, th2: -18, sh2: -26, ft2: 60, ay: 89.6 },
      { t: 180, ua: 2, fa: 2, th: 0, sh: 0, ft: 90, th2: 30, sh2: -40, ft2: 70, ay: HIP_Y },
      { t: 180, ua: 2, fa: 2, th: -18, sh: -26, ft: 60, th2: 22, sh2: 8, ft2: 100, ay: 89.6 },
      { t: 180, ua: 2, fa: 2, th: 30, sh: -40, ft: 70, th2: 0, sh2: 0, ft2: 90, ay: HIP_Y },
    ],
  },
  // Power clean: pull from the floor, triple extension onto the toes, catch in the front rack.
  power_clean: {
    view: 'side', anchor: 'hip', at: [92, HIP_Y], hand: 'barbell', loop: 'cycle', ms: 420, hold: 160, show: 3,
    // The catch whips the elbows around the bar (shoulder rotation a side view can't show), and the
    // bar loops slightly forward off the hips: both are correct technique, so those checks are off.
    lock: { toe: [101, FOOT_Y], toe2: [101, FOOT_Y] }, audit: { skip: ['elbow'] },
    frames: [
      { t: 115, th: 0, sh: 0, n: 122, ua: 0, fa: 0, ft: 90, ax: 61, ay: 113 },
      { t: 186, th: 0, sh: 0, n: 190, ua: 2, fa: 2, ft: 58, ax: 92, ay: 83 },
      { t: 184, th: 0, sh: 0, n: 186, ua: 110, fa: 10, uz: 60, ft: 70, ax: 92, ay: 85 },
      { t: 172, th: 0, sh: 0, n: 178, ua: 92, fa: -114, ft: 90, ax: 88, ay: 98 },
      { t: 180, th: 0, sh: 0, n: 182, ua: 92, fa: -114, ft: 90, ax: 92, ay: HIP_Y },
    ],
  },
  thruster: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell', ms: 760, loop: 'cycle', hold: 120,
    frames: [
      { t: 160, n: 168, ua: 72, fa: 226, th: 90, sh: -38 },
      { ...stand, ua: 92, fa: 246 },
      { ...overhead },
      { ...stand, ua: 92, fa: 246 },
    ],
  },

  // ── Home: bodyweight push ────────────────────────────────────────────────
  pushup_knee: {
    view: 'side', anchor: 'knee', at: [70, FOOT_Y], lock: ['wrist', 'wrist2'], ecc: 'to',
    frames: [
      { t: 130, ua: 2, fa: 2, th: -50, sh: -90, ft: -90 },
      { t: 106, ua: -84, fa: 6, th: -74, sh: -90, ft: -90, uz: 32 },
    ],
  },
  pushup_incline: {
    view: 'side', anchor: 'wrist', at: [134, 110], lock: ['toe', 'toe2'], ecc: 'to',
    props: [{ type: 'box', x: 118, y: 112, w: 34, h: 40 }],
    frames: [
      { t: 140, ua: 2, fa: 2, th: -40, sh: -40, ft: 20 },
      { t: 128, ua: -70, fa: 10, th: -52, sh: -52, ft: 20, uz: 30 },
    ],
  },
  pushup_decline: {
    view: 'side', anchor: 'toe', at: [36, 96], lock: ['wrist', 'wrist2'], ecc: 'to',
    props: [{ type: 'box', x: 14, y: 98, w: 34, h: 54 }],
    frames: [
      { t: 82, n: 76, ua: 2, fa: 2, th: -98, sh: -98, ft: 8 },
      { t: 74, n: 66, ua: -70, fa: 14, th: -106, sh: -106, ft: 8, uz: 32 },
    ],
  },
  // Archer: one arm bends, the other stays straight out to the side.
  pushup_archer: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2], lock: ['wrist', 'wrist2'], ecc: 'to',
    frames: [{ ...plankHigh, uz2: 50 }, { ...plankLow, t: 99, th: -82, sh: -82, uz: 22, uz2: 74 }],
  },
  pushup_clap: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2], loop: 'cycle', ms: 340, hold: 60, show: 2, track: true,
    frames: [{ ...plankLow, ua: -73, fa: 53 }, plankHigh, { ...plankHigh, t: 126, n: 120, ua: 10, fa: 22 }, plankHigh],
  },
  // Pseudo planche: shoulders lean past the hands, which sit by the lower ribs.
  pushup_planche: {
    view: 'side', anchor: 'toe', at: [36, FOOT_Y + 2], lock: ['wrist', 'wrist2'], ecc: 'to',
    frames: [
      { ...plankHigh, t: 106, ua: -24, fa: -24, ft: 0 },
      { ...plankLow, t: 94, ua: -104, fa: -14, th: -84, sh: -84, ft: 0 },
    ],
  },
  // Inverted row: lying face up under a table, heels down, chest pulled to the edge.
  inverted_row: {
    view: 'side', anchor: 'ankle', at: [150, FOOT_Y], ecc: 'back',
    props: [{ type: 'bar', x: 30, y: 88, w: 44 }],
    lock: { wrist: [52, 90], wrist2: [52, 90] },
    frames: [
      { t: -98, n: -98, ua: 180, fa: 180, th: 82, sh: 82, ft: 176 },
      { t: -122, n: -118, ua: 120, fa: 200, th: 58, sh: 58, ft: 150 },
    ],
  },
  prone_y_raise: {
    view: 'side', anchor: 'hip', at: [92, 144], hold: 400, ecc: 'back',
    frames: [
      { t: 90, n: 90, ua: 90, fa: 90, th: -90, sh: -90, ft: -90 },
      { t: 94, ub: 98, n: 104, ua: 108, fa: 110, th: -90, sh: -90, ft: -90 },
    ],
  },
  pike_elevated: {
    view: 'side', anchor: 'toe', at: [38, 90], lock: ['wrist', 'wrist2'], ecc: 'to',
    props: [{ type: 'box', x: 14, y: 92, w: 34, h: 60 }],
    frames: [
      { t: 45, n: 30, ua: 20, fa: 20, th: -80, sh: -80, ft: 0 },
      { t: 30, n: 10, ua: -50, fa: 40, th: -80, sh: -80, ft: 0, uz: 20 },
    ],
  },
  handstand_wall: {
    view: 'side', anchor: 'wrist', at: [104, FOOT_Y + 1], ms: 1800, props: [{ type: 'wall', x: 92 }],
    frames: [
      { t: 2, n: 0, ua: 0, fa: 0, th: 178, sh: 178, ft: 210 },
      { t: 0, n: -2, ua: 0, fa: 0, th: 180, sh: 182, ft: 212 },
    ],
  },
  // Bodyweight tricep extension: hands on a bench, body rigid and pivoting on the toes; only the
  // elbows bend, lowering the forearms flat onto the bench.
  // Bodyweight tricep extension: hands on a bench, body rigid and pivoting on the toes; only the
  // elbows bend, until the forearms lie flat on the bench with the shoulders over the elbows.
  tricep_ext_bw: {
    view: 'side', anchor: 'toe', at: [31, FOOT_Y + 2], lock: { wrist: [136, 110], wrist2: [136, 110] }, ecc: 'to',
    props: [{ type: 'box', x: 100, y: 112, w: 42, h: 40 }],
    frames: [
      { t: 134, n: 130, ua: 30, fa: 30, th: -46, sh: -46, ft: 20 },
      { t: 125.5, n: 120, ua: -10, fa: 90, th: -54.5, sh: -54.5, ft: 20 },
    ],
  },

  // ── Home: bodyweight legs ────────────────────────────────────────────────
  lateral_lunge: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], ecc: 'to',
    frames: [
      { t: 180, ua: 14, fa: 10, th: 33, sh: 33 },
      { t: 172, ua: 20, fa: 40, af: 50, th: 70, sh: -20, tf: 40, th2: 50, sh2: 50, ax: 114 },
    ],
  },
  step_up: {
    view: 'side', anchor: 'ankle', at: [116, 130], ecc: 'back', props: [{ type: 'box', x: 100, y: 133, w: 40, h: 19 }],
    frames: [
      { t: 172, ua: 20, fa: 30, ua2: -16, fa2: 0, th: 60, sh: -20, th2: -8, sh2: -8, ft2: 60 },
      { t: 180, ua: -10, fa: 10, ua2: 14, fa2: 30, th: 0, sh: 0, th2: 80, sh2: 0, ft2: 90 },
    ],
  },
  glute_bridge_single: {
    view: 'side', anchor: 'ankle', at: [124, FOOT_Y], ecc: 'back',
    frames: [
      { t: -90, n: -90, ua: 90, fa: 90, th: 142, sh: 20, th2: 120, sh2: 120, ft2: 150 },
      { t: -70, n: -80, ua: 72, fa: 88, th: 108, sh: 2, th2: 108, sh2: 108, ft2: 150 },
    ],
  },
  pistol_squat: {
    view: 'side', anchor: 'ankle', at: [100, FOOT_Y], ecc: 'to', ms: 1100,
    frames: [
      { t: 180, ua: 80, fa: 85, th: 0, sh: 0, th2: 40, sh2: 40, ft2: 150 },
      { t: 140, ua: 92, fa: 92, th: 90, sh: -40, th2: 88, sh2: 88, ft2: 180 },
    ],
  },
  nordic_curl: {
    view: 'side', anchor: 'knee', at: [60, FOOT_Y], ms: 1500, hold: 300, ecc: 'to',
    frames: [
      { t: 180, ua: 30, fa: 160, th: 0, sh: -90, ft: -90 },
      { t: 128, n: 118, ua: 100, fa: 100, th: -52, sh: -90, ft: -90 },
    ],
  },
  single_leg_rdl: {
    view: 'side', anchor: 'ankle', at: STAND, ecc: 'to',
    frames: [
      { ...stand, ua: 3, fa: 6 },
      { t: 96, n: 100, ua: 2, fa: 2, th: 10, sh: -4, th2: -84, sh2: -86, ft2: 0 },
    ],
  },
  calf_raise_bw: {
    view: 'side', anchor: 'toe', at: [101, FOOT_Y], ms: 700, hold: 300, ecc: 'back',
    frames: [
      { ...stand, ua: 40, fa: 50, ft: 90, th2: -30, sh2: -100, ft2: -10 },
      { ...stand, ua: 40, fa: 50, ft: 36, th2: -30, sh2: -100, ft2: -10 },
    ],
  },
  donkey_kick: {
    view: 'side', anchor: 'wrist', at: [132, FOOT_Y + 1], ecc: 'back',
    frames: [
      kneelHinge({ t: 100, th: 4, sh: -88, th2: 0, sh2: -90 }),
      kneelHinge({ t: 100, th: -100, sh: -176, ft: -90, th2: 0, sh2: -90 }),
    ],
  },
  sumo_squat: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], ecc: 'to',
    frames: [
      { t: 180, ua: 20, fa: -60, af: 30, th: 30, sh: 30 },
      { t: 180, ua: 24, fa: -64, af: 40, th: 70, sh: 5, tf: 40 },
    ],
  },

  // ── Home: core ───────────────────────────────────────────────────────────
  side_plank: {
    view: 'side', anchor: 'toe', at: [40, FOOT_Y + 2], ms: 1800,
    // The top arm is raised out to the side (abduction), which a side view can't show.
    audit: { skip: ['shoulder'] },
    frames: [
      { t: 98, ua: 0, fa: 90, ua2: 180, fa2: 180, th: -82, sh: -82, ft: 0 },
      { t: 99, ua: 0, fa: 90, ua2: 178, fa2: 178, th: -81, sh: -81, ft: 0 },
    ],
  },
  dead_bug: {
    view: 'side', anchor: 'hip', at: [104, 146], loop: 'cycle', ms: 760, hold: 160,
    frames: [
      { t: -90, n: -90, ua: 180, fa: 180, th: 180, sh: 90, ft: 180 },
      { t: -90, n: -90, ua: 264, fa: 264, ua2: 180, fa2: 180, th: 180, sh: 90, th2: 98, sh2: 98, ft: 180, ft2: 180 },
      { t: -90, n: -90, ua: 180, fa: 180, th: 180, sh: 90, ft: 180 },
      { t: -90, n: -90, ua: 180, fa: 180, ua2: 264, fa2: 264, th: 98, sh: 98, th2: 180, sh2: 90, ft: 180, ft2: 180 },
    ],
  },
  bird_dog: {
    view: 'side', anchor: 'knee', at: [80, FOOT_Y], hold: 400, ms: 900, lock: ['wrist2'],
    frames: [
      kneelHinge({ t: 108 }),
      kneelHinge({ t: 108, ua: 96, fa: 96, ua2: 0, fa2: 0, th2: -96, sh2: -96, ft2: -90 }),
    ],
  },
  leg_raise: {
    view: 'side', anchor: 'hip', at: [100, 146], ecc: 'back',
    frames: [
      { t: -90, n: -90, ua: 90, fa: 90, th: 94, sh: 94, ft: 180 },
      { t: -90, n: -90, ua: 90, fa: 90, th: 176, sh: 176, ft: 250 },
    ],
  },
  flutter_kick: {
    view: 'side', anchor: 'hip', at: [100, 144], ms: 280, smooth: true,
    frames: [
      { t: -100, ub: -104, n: -114, ua: 90, fa: 90, th: 100, sh: 100, th2: 118, sh2: 118, ft: 160, ft2: 160 },
      { t: -100, ub: -104, n: -114, ua: 90, fa: 90, th: 118, sh: 118, th2: 100, sh2: 100, ft: 160, ft2: 160 },
    ],
  },
  hollow_hold: {
    view: 'side', anchor: 'hip', at: [100, 144], ms: 1800,
    frames: [
      { t: -100, ub: -112, n: -122, ua: -112, fa: -112, th: 102, sh: 102, ft: 150 },
      { t: -101, ub: -114, n: -124, ua: -110, fa: -110, th: 103, sh: 103, ft: 150 },
    ],
  },
  // V-up: arms sweep overhead → up → to the toes (never through the floor).
  v_up: {
    view: 'side', anchor: 'hip', at: [100, 144], hold: 160, ecc: 'back',
    frames: [
      { t: -96, ub: -98, n: -100, ua: -100, fa: -100, th: 96, sh: 96, ft: 160 },
      { t: -112, ub: -146, n: -156, ua: -224, fa: -224, th: 136, sh: 136, ft: 200 },
    ],
  },
  reverse_crunch: {
    view: 'side', anchor: 'shoulder', at: [70, 142], ecc: 'back',
    frames: [
      { t: -90, n: -90, ua: 90, fa: 90, th: 178, sh: 92, ft: 180 },
      { t: -76, ub: -86, n: -90, ua: 90, fa: 90, th: 214, sh: 150, ft: 230 },
    ],
  },
  shoulder_tap: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2], loop: 'cycle', ms: 420, hold: 140, lock: ['wrist2'],
    frames: [plankHigh, { ...plankHigh, ua: 40, fa: 186 }, plankHigh, { ...plankHigh, ua: 40, fa: 186 }],
  },

  // ── Home: conditioning ───────────────────────────────────────────────────
  squat_thrust: {
    view: 'side', anchor: 'ankle', at: [100, FOOT_Y], loop: 'cycle', ms: 320, hold: 50, show: 4,
    frames: [
      { ...stand, ua: 6, fa: 10 },
      { t: 145, n: 160, ua: 70, fa: 76, th: 86, sh: -38, ft: 90 },
      { t: 125, n: 140, ua: 20, fa: 20, th: 100, sh: -40, ft: 90 },
      { t: 86, n: 90, ua: 2, fa: 2, th: -40, sh: -60, ft: 20, ax: 49, ay: 134 },
      { ...plankHigh, ax: 41.5, ay: 141 },
      { t: 86, n: 90, ua: 2, fa: 2, th: -40, sh: -60, ft: 20, ax: 49, ay: 134 },
      { t: 125, n: 140, ua: 20, fa: 20, th: 100, sh: -40, ft: 90 },
      { t: 145, n: 160, ua: 70, fa: 76, th: 86, sh: -38, ft: 90 },
    ],
  },
  // Inchworm: hinge with soft knees until the hands reach the floor, walk out to a plank and back.
  // Inchworm: hips back as you fold, hands to the floor, walk out to a plank and back.
  inchworm: {
    view: 'side', anchor: 'toe', at: [60, FOOT_Y + 2], loop: 'cycle', ms: 620, hold: 160, show: 3,
    frames: [
      { ...stand, ua: 3, fa: 6, ft: 90 },
      { t: 92, n: 96, ua: 0, fa: 0, th: 20, sh: 20, ft: 80 },
      { t: 38, n: 24, ua: 48, fa: 48, th: 10, sh: 10, ft: 80 },
      { t: 72, n: 80, ua: 10, fa: 10, th: -36, sh: -36, ft: 30 },
      { ...plankHigh },
      { t: 72, n: 80, ua: 10, fa: 10, th: -36, sh: -36, ft: 30 },
      { t: 38, n: 24, ua: 48, fa: 48, th: 10, sh: 10, ft: 80 },
      { t: 92, n: 96, ua: 0, fa: 0, th: 20, sh: 20, ft: 80 },
    ],
  },
  // Bear crawl: back flat, knees hovering; opposite hand and foot step together.
  bear_crawl: {
    view: 'side', anchor: 'hip', at: [100, 105], ms: 420, smooth: true,
    frames: [
      { t: 90, n: 96, ua: 0, fa: 0, ua2: 18, fa2: 30, th: 4, sh: -78, ft: 30, th2: 22, sh2: -90, ft2: 30 },
      { t: 90, n: 96, ua: 18, fa: 30, ua2: 0, fa2: 0, th: 22, sh: -90, ft: 30, th2: 4, sh2: -78, ft2: 30 },
    ],
  },
  skater_jump: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], loop: 'cycle', ms: 360, hold: 80, show: 0,
    frames: [
      { t: 172, ua: 60, fa: 40, ua2: 20, fa2: 0, th: 30, sh: -10, tf: 40, th2: -15, sh2: -70, ax: 74 },
      { t: 180, ua: 40, fa: 30, th: 8, sh: 0, ax: 100, ay: FOOT_Y - 20 },
      { t: 188, ua: 20, fa: 0, ua2: 60, fa2: 40, th: -15, sh: -70, th2: 30, sh2: -10, tf2: 40, ax: 126 },
      { t: 180, ua: 40, fa: 30, th: 8, sh: 0, ax: 100, ay: FOOT_Y - 20 },
    ],
  },
  jump_lunge: {
    view: 'side', anchor: 'hip', at: [100, 113], loop: 'cycle', ms: 340, hold: 80, show: 0,
    frames: [
      { t: 178, ua: 40, fa: 70, ua2: -30, fa2: -10, th: 84, sh: -4, ft: 90, th2: -10, sh2: -96, ft2: 44 },
      { t: 180, ua: 10, fa: 20, th: 20, sh: -20, th2: -24, sh2: -80, ft: 60, ft2: 30, ay: 75 },
      { t: 178, ua: -30, fa: -10, ua2: 40, fa2: 70, th: -10, sh: -96, ft: 44, th2: 84, sh2: -4, ft2: 90 },
      { t: 180, ua: 10, fa: 20, th: -24, sh: -80, th2: 20, sh2: -20, ft: 30, ft2: 60, ay: 75 },
    ],
  },
  tuck_jump: {
    view: 'side', anchor: 'ankle', at: [96, FOOT_Y], loop: 'cycle', ms: 340, hold: 60,
    frames: [
      { t: 160, ua: -30, fa: -20, th: 60, sh: -30 },
      { t: 174, ub: 168, ua: 110, fa: 140, th: 140, sh: 30, ft: 120, ay: 70 },
      { ...stand, ua: 30, fa: 40, ft: 80 },
    ],
  },
  star_jump: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], loop: 'cycle', ms: 340, hold: 80,
    frames: [
      { t: 180, ua: 20, fa: 10, th: 26, sh: -16, tf: 30 },
      { t: 180, ua: 150, fa: 160, th: 36, sh: 36, ay: FOOT_Y - 26 },
      { t: 180, ua: 14, fa: 10, th: 4, sh: 0 },
    ],
  },
  butt_kicks: {
    view: 'side', anchor: 'hip', at: [96, HIP_Y], ms: 270, smooth: true,
    frames: [
      { t: 180, ua: -30, fa: 60, ua2: 40, fa2: 100, th: 0, sh: 0, ft: 80, th2: -10, sh2: -150, ft2: -110 },
      { t: 180, ua: 40, fa: 100, ua2: -30, fa2: 60, th: -10, sh: -150, ft: -110, th2: 0, sh2: 0, ft2: 80 },
    ],
  },
  shadow_boxing: {
    view: 'side', anchor: 'ankle', at: [96, FOOT_Y], loop: 'cycle', ms: 200, hold: 140, show: 1,
    frames: [
      { t: 176, ua: 30, fa: 165, th: 10, sh: 4, th2: -12, sh2: -8 },
      { t: 176, ua: 88, fa: 90, ua2: 30, fa2: 165, th: 10, sh: 4, th2: -12, sh2: -8 },
      { t: 176, ua: 30, fa: 165, th: 10, sh: 4, th2: -12, sh2: -8 },
      { t: 172, ua: 30, fa: 165, ua2: 88, fa2: 90, th: 10, sh: 4, th2: -12, sh2: -8 },
    ],
  },

  // ── Home: dumbbell ───────────────────────────────────────────────────────
  floor_fly: {
    view: 'side', anchor: 'hip', at: [104, 146], hand: 'dumbbell', ecc: 'to',
    frames: [
      lieBack({ ua: 180, fa: 180, th: 140, sh: 20 }),
      lieBack({ ua: 150, fa: 186, uz: 74, th: 140, sh: 20 }),
    ],
  },
  pullover: {
    view: 'side', anchor: 'hip', at: [118, 102], hand: 'dumbbell', props: [flatBench()], ms: 1100, ecc: 'to',
    frames: [
      lieBack({ ua: 180, fa: 180 }),
      lieBack({ ua: 276, fa: 280 }),
    ],
  },
  shrug: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', grip: 'neutral', hold: 320, ecc: 'back',
    frames: [
      { ...stand, ua: 2, fa: 2 },
      { ...stand, ua: 2, fa: 2, n: 176, ft: 74, ay: FOOT_Y - 3 },
    ],
  },
  // Upright row: lead with the elbows out to the sides, up to shoulder height.
  upright_row: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', ecc: 'back',
    frames: [
      { ...stand, ua: 4, fa: 4 },
      { ...stand, ua: 96, fa: 186, uz: 64 },
    ],
  },
  concentration_curl: {
    view: 'side', anchor: 'hip', at: [86, 110], hand: 'dumbbell', ecc: 'back', props: [{ type: 'box', x: 62, y: 112, w: 42, h: 40 }],
    frames: [
      seated({ t: 140, n: 120, ua: 20, fa: 20 }),
      seated({ t: 140, n: 120, ua: 20, fa: 158 }),
    ],
  },
  tricep_kickback: {
    view: 'side', anchor: 'hip', at: [68, 95], hand: 'dumbbell', grip: 'neutral', ecc: 'back', lock: feet(92),
    frames: [
      { t: 116, th: 0, sh: 0, n: 124, ua: -64, fa: 0, ax: 71, ay: 97 },
      { t: 116, th: 0, sh: 0, n: 124, ua: -64, fa: -66, ax: 71, ay: 97 },
    ],
  },
  floor_skull_crusher: {
    view: 'side', anchor: 'hip', at: [104, 146], hand: 'dumbbell', grip: 'neutral', ecc: 'to',
    frames: [
      lieBack({ ua: 172, fa: 176, th: 140, sh: 20 }),
      lieBack({ ua: 166, fa: 300, th: 140, sh: 20 }),
    ],
  },
  step_up_db: {
    view: 'side', anchor: 'ankle', at: [116, 130], hand: 'dumbbell', ecc: 'back', props: [{ type: 'box', x: 100, y: 133, w: 40, h: 19 }],
    frames: [
      { t: 172, ua: 2, fa: 2, th: 60, sh: -20, th2: -8, sh2: -8, ft2: 60 },
      { t: 180, ua: 2, fa: 2, th: 0, sh: 0, th2: 80, sh2: 0, ft2: 90 },
    ],
  },
  sumo_squat_db: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], hand: 'kettlebell', ecc: 'to',
    frames: [
      { t: 180, ua: 4, fa: -10, th: 30, sh: 30 },
      { t: 180, ua: 4, fa: -10, th: 70, sh: 5, tf: 40 },
    ],
  },
  single_leg_rdl_db: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', ecc: 'to',
    frames: [
      { ...stand, ua: 1, fa: 1 },
      { t: 96, n: 100, ua: 0, fa: 0, th: 10, sh: -4, th2: -84, sh2: -86, ft2: 0 },
    ],
  },
  glute_bridge_db: {
    view: 'side', anchor: 'ankle', at: [124, FOOT_Y], hand: 'dumbbell', ecc: 'back',
    frames: [
      { t: -90, n: -90, ua: 90, fa: 90, th: 142, sh: 20 },
      { t: -70, n: -80, ua: 110, fa: 110, th: 108, sh: 2 },
    ],
  },
  side_bend: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], hand: 'dumbbell', ms: 1000, ecc: 'to',
    frames: [
      { t: 180, ua: 4, fa: 4, th: 8, sh: 0 },
      { t: 160, ua: 4, fa: 4, th: 8, sh: 0 },
    ],
  },
  woodchop: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], hand: 'dumbbell', ms: 760,
    frames: [
      { t: 172, ua: 135, fa: 135, ua2: -135, fa2: -135, th: 14, sh: 2 },
      { t: 190, ua: -30, fa: -30, ua2: 30, fa2: 30, af: 30, th: 26, sh: -10, tf: 30 },
    ],
  },
  thruster_db: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', ms: 760, loop: 'cycle', hold: 120,
    frames: [
      { t: 156, ua: 30, fa: 170, uz: 30, th: 88, sh: -38 },
      { ...stand, ua: 22, fa: 168, uz: 30 },
      { ...overhead, uz: 12 },
      { ...stand, ua: 22, fa: 168, uz: 30 },
    ],
  },
  db_snatch: {
    view: 'side', anchor: 'hip', at: [92, HIP_Y], hand: 'dumbbell', loop: 'cycle', ms: 500, hold: 220, show: 2,
    lock: { toe: [101, FOOT_Y], toe2: [101, FOOT_Y] },
    frames: [
      { t: 118, th: 0, sh: 0, n: 126, ua: 0, fa: 0, ua2: 10, fa2: 10, ft: 90, ax: 62, ay: 104 },
      { t: 184, th: 0, sh: 0, ua: 80, fa: 150, ua2: -10, fa2: 0, ft: 60, ax: 92, ay: 84 },
      { t: 180, th: 0, sh: 0, ua: 178, fa: 180, ua2: 10, fa2: 14, ft: 90, ax: 92, ay: HIP_Y },
    ],
  },
  clean_press_db: {
    view: 'side', anchor: 'hip', at: [92, HIP_Y], hand: 'dumbbell', loop: 'cycle', ms: 540, hold: 200, show: 2,
    lock: feet(92),
    frames: [
      { t: 118, th: 0, sh: 0, n: 126, ua: 0, fa: 0, ax: 64, ay: 104 },
      { t: 180, th: 0, sh: 0, ua: 22, fa: 168, uz: 30, ax: 92, ay: HIP_Y },
      { t: 180, th: 0, sh: 0, ua: 176, fa: 180, uz: 12, ax: 92, ay: HIP_Y },
      { t: 180, th: 0, sh: 0, ua: 22, fa: 168, uz: 30, ax: 92, ay: HIP_Y },
    ],
  },

  // ── Home: resistance band ────────────────────────────────────────────────
  band_pulldown: {
    view: 'side', anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: [112, 2], kind: 'band' }, ecc: 'back',
    props: [{ type: 'pulley', x: 112, y: 2 }],
    frames: [
      { ...stand, ua: 168, fa: 172, uz: 20 },
      { ...stand, t: 184, ua: 12, fa: 166, uz: 50 },
    ],
  },
  band_face_pull: {
    view: 'side', anchor: 'ankle', at: [80, FOOT_Y], ecc: 'back',
    tether: { from: 'wrist', to: [176, 46], kind: 'band' }, props: [{ type: 'pulley', x: 176, y: 46 }],
    frames: [
      { t: 176, ua: 100, fa: 100, th: 4, sh: -4 },
      { t: 182, ua: 168, fa: 176, uz: 72, th: 4, sh: -4 },
    ],
  },
  band_ohp: {
    view: 'side', track: true, anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: 'ankle', kind: 'band' }, ecc: 'back',
    frames: [{ ...stand, ua: 14, fa: 180, uz: 62 }, { ...overhead, uz: 12 }],
  },
  band_lateral_raise: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], tether: { from: 'wrist', to: 'ankle', kind: 'band' }, ecc: 'back',
    frames: [
      { t: 180, ua: 10, fa: 14, th: 4, sh: 0 },
      { t: 180, ua: 86, fa: 92, th: 4, sh: 0 },
    ],
  },
  band_pushdown: {
    view: 'side', anchor: 'ankle', at: [86, FOOT_Y], ecc: 'back',
    tether: { from: 'wrist', to: [150, 18], kind: 'band' }, props: [{ type: 'pulley', x: 150, y: 18 }],
    frames: [
      { t: 172, ua: 8, fa: 150, th: 4, sh: -4 },
      { t: 172, ua: 6, fa: 4, th: 4, sh: -4 },
    ],
  },
  band_deadlift: {
    view: 'side', anchor: 'hip', at: [92, HIP_Y], tether: { from: 'wrist', to: 'ankle', kind: 'band' }, ecc: 'back', show: 0,
    lock: feet(92),
    frames: [
      { t: 120, th: 0, sh: 0, n: 128, ua: 0, fa: 0, ax: 64, ay: 108 },
      { t: 180, th: 0, sh: 0, n: 182, ua: -2, fa: -2, ax: 92, ay: HIP_Y },
    ],
  },
  band_good_morning: {
    view: 'side', anchor: 'hip', at: [92, HIP_Y], tether: { from: 'wrist', to: 'ankle', kind: 'band' }, ecc: 'to',
    // Hands hold the band behind the neck (shoulder rotation the side view can't show).
    lock: feet(92), audit: { skip: ['elbow'] },
    frames: [
      { t: 180, th: 0, sh: 0, n: 182, ua: -40, fa: 160, ax: 92, ay: HIP_Y },
      { t: 110, th: 0, sh: 0, n: 116, ua: -110, fa: 90, ax: 66, ay: 93 },
    ],
  },
  band_lateral_walk: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], ms: 560, loopBand: true,
    frames: [
      { t: 180, ua: 30, fa: -60, th: 10, sh: 0, tf: 30 },
      { t: 180, ua: 30, fa: -60, th: 28, sh: 26, tf: 30 },
    ],
  },
  band_pallof: {
    view: 'side', anchor: 'ankle', at: [100, FOOT_Y], hold: 600, ecc: 'back',
    tether: { from: 'wrist', to: [40, 92], kind: 'band' }, props: [{ type: 'pulley', x: 40, y: 92 }],
    frames: [
      { t: 180, ua: 30, fa: 150, th: 10, sh: -6 },
      { t: 180, ua: 88, fa: 90, th: 10, sh: -6 },
    ],
  },
  band_fly: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], ecc: 'back',
    tether: { from: 'wrist', to: [190, 64], kind: 'band' },
    frames: [
      { t: 180, ua: 94, fa: 94, th: 8, sh: 2 },
      { t: 180, ua: 64, fa: -30, af: 40, th: 8, sh: 2 },
    ],
  },
  towel_curl: {
    view: 'side', anchor: 'hip', at: [86, 110], tether: { from: 'wrist', to: 'ankle', kind: 'cable' }, ecc: 'back',
    props: [{ type: 'box', x: 62, y: 112, w: 42, h: 40 }],
    frames: [
      seated({ t: 172, ua: 10, fa: 40, sh: 34, ft: 124 }),
      seated({ t: 172, ua: 10, fa: 150, sh: 20, ft: 110 }),
    ],
  },
};

/** Fallback used for custom exercises without a pattern. */
export const DEFAULT_PATTERN = 'squat_bw';
