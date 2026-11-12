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
}

export const GROUND = 152;
const FOOT_Y = 148;
const STAND: Pt = [92, FOOT_Y];

// Reusable poses ---------------------------------------------------------------
const stand: Pose = { t: 180, ua: 3, fa: 6, th: 0, sh: 0 };
const standArmsBack: Pose = { ...stand, ua: -4, fa: 2 };
const rackHigh: Pose = { ...stand, ua: 22, fa: 168 }; // hands at chin height (press start)
const overhead: Pose = { ...stand, ua: 176, fa: 180 };
const plankHigh: Pose = { t: 112, ua: 2, fa: 2, th: -68, sh: -68, ft: 8 };
const plankLow: Pose = { t: 100, ua: -78, fa: 6, th: -80, sh: -80, ft: 8 };
const lieBack = (o: Partial<Pose>): Pose => ({ t: -90, ua: 180, fa: 180, th: 68, sh: -4, ft: 90, ...o });
const seated = (o: Partial<Pose>): Pose => ({ t: 182, ua: 3, fa: 6, th: 90, sh: 2, ft: 90, ...o });
const kneelHinge = (o: Partial<Pose>): Pose => ({ t: 95, ua: 0, fa: 0, th: 0, sh: -90, ft: -90, ...o });

const flatBench = (y = 108): Prop => ({ type: 'bench', x: 34, y, w: 104, legs: true });

export const PATTERNS: Record<string, Pattern> = {
  // ── Squat family ──────────────────────────────────────────────────────────
  squat_back: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell',
    frames: [
      { ...stand, ua: -42, fa: 160 },
      { t: 138, ua: -82, fa: 118, th: 80, sh: -36 },
    ],
  },
  squat_front: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell',
    frames: [
      { ...stand, ua: 92, fa: 220 },
      { t: 158, ua: 72, fa: 198, th: 84, sh: -36 },
    ],
  },
  squat_goblet: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'kettlebell',
    frames: [
      { ...stand, ua: 18, fa: 166 },
      { t: 152, ua: 4, fa: 150, th: 84, sh: -38 },
    ],
  },
  squat_bw: {
    view: 'side', anchor: 'ankle', at: STAND,
    frames: [
      { ...stand, ua: 10, fa: 14 },
      { t: 145, ua: 86, fa: 90, th: 82, sh: -38 },
    ],
  },
  squat_band: {
    view: 'side', anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: 'ankle', kind: 'band' },
    frames: [
      { ...stand, ua: 18, fa: 166 },
      { t: 145, ua: -10, fa: 140, th: 82, sh: -38 },
    ],
  },
  squat_jump: {
    view: 'side', anchor: 'ankle', at: STAND, ms: 520, hold: 60, loop: 'cycle',
    frames: [
      { t: 145, ua: -40, fa: -30, th: 82, sh: -38 },
      { ...stand, ua: 170, fa: 175, ft: 30, ay: FOOT_Y - 26 },
      { ...stand, ua: 40, fa: 50 },
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
    view: 'side', anchor: 'hip', at: [72, 118], foot: 'plate',
    props: [{ type: 'box', x: 56, y: 124, w: 34, h: 28 }, { type: 'bench', x: 82, y: 122, w: 62, angle: 146 }],
    frames: [
      { t: -122, ua: 70, fa: 90, th: 150, sh: 102, ft: 160 },
      { t: -122, ua: 70, fa: 90, th: 122, sh: 126, ft: 200 },
    ],
  },
  lunge: {
    view: 'side', anchor: 'ankle', at: [110, FOOT_Y], hand: 'dumbbell',
    frames: [
      { t: 180, ua: 2, fa: 2, th: 24, sh: -6, th2: -24, sh2: -42, ft2: 0 },
      { t: 178, ua: 2, fa: 2, th: 86, sh: -6, th2: -12, sh2: -88, ft2: 0 },
    ],
  },
  lunge_bw: {
    view: 'side', anchor: 'ankle', at: [110, FOOT_Y],
    frames: [
      { t: 180, ua: 6, fa: 20, th: 24, sh: -6, th2: -24, sh2: -42, ft2: 0 },
      { t: 178, ua: 30, fa: 60, th: 86, sh: -6, th2: -12, sh2: -88, ft2: 0 },
    ],
  },
  split_squat: {
    view: 'side', anchor: 'ankle', at: [118, FOOT_Y], hand: 'dumbbell',
    props: [{ type: 'box', x: 34, y: 124, w: 34, h: 28 }],
    frames: [
      { t: 180, ua: 2, fa: 2, th: 22, sh: -4, th2: -30, sh2: -76, ft2: -30 },
      { t: 172, ua: 2, fa: 2, th: 84, sh: -12, th2: 4, sh2: -108, ft2: -30 },
    ],
  },
  calf_raise: {
    view: 'side', anchor: 'toe', at: [101, FOOT_Y + 1], hand: 'dumbbell', ms: 800, hold: 250,
    frames: [
      { ...stand, ua: 1, fa: 1, ft: 90 },
      { ...stand, ua: 1, fa: 1, ft: 30 },
    ],
  },
  leg_ext: {
    view: 'side', anchor: 'hip', at: [74, 108],
    props: [{ type: 'box', x: 50, y: 110, w: 50, h: 42 }],
    frames: [
      seated({ ua: 30, fa: 20, sh: -8 }),
      seated({ ua: 30, fa: 20, sh: 82 }),
    ],
  },
  leg_curl: {
    view: 'side', anchor: 'hip', at: [100, 104], props: [flatBench(110)],
    frames: [
      { t: 90, n: 100, ua: 2, fa: 30, th: -90, sh: -92, ft: 0 },
      { t: 90, n: 100, ua: 2, fa: 30, th: -90, sh: -178, ft: -90 },
    ],
  },

  // ── Hinge family ──────────────────────────────────────────────────────────
  deadlift: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell',
    frames: [
      { t: 128, ua: -2, fa: -2, th: 68, sh: -16 },
      { ...standArmsBack },
    ],
  },
  rdl: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell',
    frames: [
      { ...standArmsBack },
      { t: 104, ua: 0, fa: 0, th: 14, sh: -8 },
    ],
  },
  rdl_db: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell',
    frames: [
      { ...standArmsBack },
      { t: 104, ua: 0, fa: 0, th: 14, sh: -8 },
    ],
  },
  kb_swing: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'kettlebell', ms: 700,
    frames: [
      { t: 112, ua: -30, fa: -30, th: 30, sh: -16 },
      { ...stand, ua: 94, fa: 94 },
    ],
  },
  good_morning_bw: {
    view: 'side', anchor: 'ankle', at: STAND,
    frames: [
      { ...stand, ua: -40, fa: 160 },
      { t: 100, ua: -110, fa: 90, th: 10, sh: -6 },
    ],
  },
  hip_thrust: {
    view: 'side', anchor: 'ankle', at: [128, FOOT_Y], hand: 'barbell',
    props: [{ type: 'box', x: 22, y: 112, w: 36, h: 40 }],
    frames: [
      { t: -116, n: -110, ua: 70, fa: 140, th: 150, sh: 14 },
      { t: -82, n: -110, ua: 120, fa: 175, th: 98, sh: 0 },
    ],
  },
  glute_bridge: {
    view: 'side', anchor: 'ankle', at: [124, FOOT_Y],
    frames: [
      { t: -90, n: -90, ua: 90, fa: 90, th: 142, sh: 20 },
      { t: -70, n: -80, ua: 72, fa: 88, th: 108, sh: 2 },
    ],
  },
  superman: {
    view: 'side', anchor: 'hip', at: [92, 144], hold: 400,
    frames: [
      { t: 90, n: 90, ua: 90, fa: 90, th: -90, sh: -90, ft: -90 },
      { t: 103, n: 112, ua: 112, fa: 114, th: -102, sh: -104, ft: -100 },
    ],
  },
  glute_kickback: {
    view: 'side', anchor: 'wrist', at: [132, FOOT_Y], tether: { from: 'ankle', to: [140, 150], kind: 'band' },
    frames: [
      kneelHinge({ th: 6, sh: -88, th2: 0, sh2: -90 }),
      kneelHinge({ th: -104, sh: -110, ft: -180, th2: 0, sh2: -90 }),
    ],
  },

  // ── Push family ───────────────────────────────────────────────────────────
  bench_press: {
    view: 'side', anchor: 'hip', at: [118, 102], hand: 'barbell', props: [flatBench()],
    frames: [
      lieBack({ ua: 180, fa: 180 }),
      lieBack({ ua: 30, fa: 172 }),
    ],
  },
  db_bench: {
    view: 'side', anchor: 'hip', at: [118, 102], hand: 'dumbbell', props: [flatBench()],
    frames: [
      lieBack({ ua: 180, fa: 180 }),
      lieBack({ ua: 24, fa: 170 }),
    ],
  },
  incline_press: {
    view: 'side', anchor: 'hip', at: [116, 104], hand: 'dumbbell',
    props: [{ type: 'bench', x: 66, y: 110, w: 70, legs: true }, { type: 'bench', x: 116, y: 108, w: 54, angle: 145 }],
    frames: [
      lieBack({ t: -128, ua: 182, fa: 182, th: 84, sh: -4 }),
      lieBack({ t: -128, ua: 46, fa: 170, th: 84, sh: -4 }),
    ],
  },
  fly: {
    view: 'side', anchor: 'hip', at: [118, 102], hand: 'dumbbell', props: [flatBench()],
    frames: [
      lieBack({ ua: 176, fa: 186 }),
      lieBack({ ua: 90, fa: 112 }),
    ],
  },
  floor_press: {
    view: 'side', anchor: 'hip', at: [104, 146], hand: 'dumbbell',
    frames: [
      lieBack({ ua: 180, fa: 180, th: 140, sh: 20 }),
      lieBack({ ua: 80, fa: 176, th: 140, sh: 20 }),
    ],
  },
  skull_crusher: {
    view: 'side', anchor: 'hip', at: [118, 102], hand: 'barbell', props: [flatBench()],
    frames: [
      lieBack({ ua: 172, fa: 176 }),
      lieBack({ ua: 166, fa: 262 }),
    ],
  },
  machine_press: {
    view: 'side', anchor: 'hip', at: [74, 110], hand: 'handle',
    props: [{ type: 'box', x: 50, y: 112, w: 44, h: 40 }, { type: 'bench', x: 50, y: 112, w: 56, angle: 100 }],
    frames: [
      seated({ t: 186, ua: -54, fa: 92 }),
      seated({ t: 186, ua: 88, fa: 90 }),
    ],
  },
  ohp: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell',
    frames: [rackHigh, overhead],
  },
  db_press_standing: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell',
    frames: [{ ...rackHigh, ua: 10, fa: 176 }, overhead],
  },
  seated_press: {
    view: 'side', anchor: 'hip', at: [86, 110], hand: 'dumbbell',
    props: [{ type: 'box', x: 62, y: 112, w: 42, h: 40 }, { type: 'bench', x: 64, y: 112, w: 60, angle: 172 }],
    frames: [
      seated({ ua: 12, fa: 176 }),
      seated({ ua: 178, fa: 180 }),
    ],
  },
  pushup: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2],
    frames: [plankHigh, plankLow],
  },
  pushup_diamond: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2],
    frames: [{ ...plankHigh, ua: 10, fa: 0 }, { ...plankLow, ua: -60, fa: 30 }],
  },
  pike_pushup: {
    view: 'side', anchor: 'toe', at: [50, FOOT_Y + 2],
    frames: [
      { t: 38, n: 30, ua: 36, fa: 36, th: -42, sh: -42, ft: 20 },
      { t: 52, n: 40, ua: -62, fa: 30, th: -42, sh: -42, ft: 20 },
    ],
  },
  dip: {
    view: 'side', anchor: 'wrist', at: [96, 82], props: [{ type: 'bar', x: 78, y: 84, w: 36 }],
    frames: [
      { t: 172, ua: 4, fa: 2, th: 12, sh: -62, ft: 30 },
      { t: 160, ua: -74, fa: 8, th: 24, sh: -52, ft: 30 },
    ],
  },
  chair_dip: {
    view: 'side', anchor: 'wrist', at: [60, 108], props: [{ type: 'box', x: 34, y: 110, w: 30, h: 42 }],
    frames: [
      { t: 180, ua: -10, fa: -6, th: 78, sh: 66, ft: 160 },
      { t: 178, ua: -96, fa: -8, th: 74, sh: 30, ft: 140 },
    ],
  },
  pushdown: {
    view: 'side', anchor: 'ankle', at: [86, FOOT_Y], hand: 'handle',
    tether: { from: 'wrist', to: [150, 18], kind: 'cable' }, props: [{ type: 'pulley', x: 150, y: 18 }],
    frames: [
      { t: 172, ua: 8, fa: 150, th: 4, sh: -4 },
      { t: 172, ua: 6, fa: 4, th: 4, sh: -4 },
    ],
  },
  overhead_ext: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell',
    frames: [
      { ...stand, ua: 170, fa: 178 },
      { ...stand, ua: 164, fa: 330 },
    ],
  },
  band_overhead_ext: {
    view: 'side', anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: 'ankle', kind: 'band' },
    frames: [
      { ...stand, ua: 170, fa: 178 },
      { ...stand, ua: 164, fa: 330 },
    ],
  },
  band_press: {
    view: 'side', anchor: 'ankle', at: [100, FOOT_Y], tether: { from: 'wrist', to: [44, 76], kind: 'band' },
    props: [{ type: 'pulley', x: 44, y: 76 }],
    frames: [
      { t: 176, ua: -60, fa: 94, th: 4, sh: -4 },
      { t: 176, ua: 86, fa: 90, th: 4, sh: -4 },
    ],
  },

  // ── Pull family ───────────────────────────────────────────────────────────
  pullup: {
    view: 'side', anchor: 'wrist', at: [100, 14], props: [{ type: 'bar', x: 70, y: 14, w: 60 }],
    frames: [
      { t: 180, ua: 178, fa: 180, th: 8, sh: -26, ft: 40 },
      { t: 186, ua: 18, fa: 170, th: 14, sh: -30, ft: 40 },
    ],
  },
  hanging_leg_raise: {
    view: 'side', anchor: 'wrist', at: [100, 14], props: [{ type: 'bar', x: 70, y: 14, w: 60 }],
    frames: [
      { t: 180, ua: 178, fa: 180, th: 2, sh: 0, ft: 40 },
      { t: 184, ua: 176, fa: 180, th: 96, sh: 96, ft: 160 },
    ],
  },
  pulldown: {
    view: 'side', anchor: 'hip', at: [92, 110], hand: 'handle',
    tether: { from: 'wrist', to: [104, 4], kind: 'cable' }, props: [{ type: 'box', x: 70, y: 112, w: 40, h: 40 }],
    frames: [
      seated({ t: 186, ua: 172, fa: 176 }),
      seated({ t: 196, ua: 14, fa: 162 }),
    ],
  },
  row_barbell: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell',
    frames: [
      { t: 116, ua: 2, fa: 2, th: 30, sh: -18 },
      { t: 118, ua: -72, fa: 6, th: 30, sh: -18 },
    ],
  },
  row_db: {
    view: 'side', anchor: 'ankle', at: [118, FOOT_Y], hand: 'dumbbell',
    props: [{ type: 'bench', x: 120, y: 108, w: 60, legs: true }],
    frames: [
      { t: 104, ua: 0, fa: 0, ua2: 14, fa2: 6, th: 6, sh: -6 },
      { t: 106, ua: -74, fa: 4, ua2: 14, fa2: 6, th: 6, sh: -6 },
    ],
  },
  seated_row: {
    view: 'side', anchor: 'hip', at: [66, 120], hand: 'handle',
    tether: { from: 'wrist', to: [178, 116], kind: 'cable' },
    props: [{ type: 'box', x: 40, y: 122, w: 60, h: 30 }, { type: 'pulley', x: 178, y: 116 }],
    frames: [
      { t: 160, ua: 92, fa: 92, th: 84, sh: 104, ft: 180 },
      { t: 188, ua: -64, fa: 92, th: 84, sh: 104, ft: 180 },
    ],
  },
  band_row: {
    view: 'side', anchor: 'ankle', at: [86, FOOT_Y], tether: { from: 'wrist', to: [176, 82], kind: 'band' },
    props: [{ type: 'pulley', x: 176, y: 82 }],
    frames: [
      { t: 176, ua: 92, fa: 92, th: 4, sh: -4 },
      { t: 182, ua: -60, fa: 92, th: 4, sh: -4 },
    ],
  },
  face_pull: {
    view: 'side', anchor: 'ankle', at: [80, FOOT_Y], hand: 'handle',
    tether: { from: 'wrist', to: [176, 46], kind: 'cable' }, props: [{ type: 'pulley', x: 176, y: 46 }],
    frames: [
      { t: 176, ua: 100, fa: 100, th: 4, sh: -4 },
      { t: 182, ua: 196, fa: 112, th: 4, sh: -4 },
    ],
  },
  reverse_fly: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell',
    frames: [
      { t: 112, ua: 4, fa: 10, th: 28, sh: -16 },
      { t: 112, ua: -66, fa: -60, th: 28, sh: -16 },
    ],
  },
  renegade_row: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2], hand: 'dumbbell',
    frames: [plankHigh, { ...plankHigh, ua: -80, fa: 2, ua2: 2, fa2: 2 }],
  },

  // ── Arms ─────────────────────────────────────────────────────────────────
  curl: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell',
    frames: [{ ...stand, ua: 4, fa: 6 }, { ...stand, ua: 10, fa: 158 }],
  },
  curl_barbell: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell',
    frames: [{ ...stand, ua: 4, fa: 6 }, { ...stand, ua: 10, fa: 158 }],
  },
  curl_band: {
    view: 'side', anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: 'ankle', kind: 'band' },
    frames: [{ ...stand, ua: 4, fa: 6 }, { ...stand, ua: 10, fa: 158 }],
  },
  front_raise: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell',
    frames: [{ ...stand, ua: 10, fa: 14 }, { ...stand, ua: 94, fa: 98 }],
  },

  // ── Front-view patterns ──────────────────────────────────────────────────
  lateral_raise: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], hand: 'dumbbell',
    frames: [
      { t: 180, ua: 10, fa: 14, th: 4, sh: 0 },
      { t: 180, ua: 86, fa: 92, th: 4, sh: 0 },
    ],
  },
  cable_fly: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], hand: 'handle',
    tether: { from: 'wrist', to: [186, 12], kind: 'cable' },
    frames: [
      { t: 180, ua: 112, fa: 104, th: 10, sh: 2 },
      { t: 180, ua: 34, fa: -20, th: 10, sh: 2 },
    ],
  },
  band_pull_apart: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y],
    frames: [
      { t: 180, ua: 76, fa: -40, th: 4, sh: 0 },
      { t: 180, ua: 92, fa: 92, th: 4, sh: 0 },
    ],
  },
  jumping_jack: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], ms: 420,
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
  crunch: {
    view: 'side', anchor: 'hip', at: [104, 146],
    frames: [
      { t: -90, n: -92, ua: 200, fa: 280, th: 140, sh: 20 },
      { t: -122, n: -130, ua: 168, fa: 250, th: 140, sh: 20 },
    ],
  },
  bicycle_crunch: {
    view: 'side', anchor: 'hip', at: [100, 146], ms: 650, loop: 'pingpong',
    frames: [
      { t: -118, n: -130, ua: 166, fa: 250, th: 150, sh: 72, th2: 100, sh2: 98, ft: 160, ft2: 180 },
      { t: -118, n: -130, ua: 166, fa: 250, th: 100, sh: 98, th2: 150, sh2: 72, ft: 180, ft2: 160 },
    ],
  },
  cable_crunch: {
    view: 'side', anchor: 'knee', at: [100, FOOT_Y - 2], hand: 'handle',
    tether: { from: 'wrist', to: [116, 6], kind: 'cable' },
    frames: [
      { t: 168, n: 160, ua: 40, fa: 170, th: 0, sh: -90, ft: 0 },
      { t: 92, n: 70, ua: -30, fa: 120, th: 6, sh: -90, ft: 0 },
    ],
  },
  ab_wheel: {
    view: 'side', anchor: 'knee', at: [70, FOOT_Y], hand: 'wheel', ms: 1300,
    frames: [
      { t: 130, n: 120, ua: 4, fa: 4, th: 10, sh: -90, ft: -90 },
      { t: 98, n: 96, ua: 104, fa: 104, th: -50, sh: -90, ft: -90 },
    ],
  },
  russian_twist: {
    view: 'side', anchor: 'hip', at: [86, 146], hand: 'plate', ms: 700,
    frames: [
      { t: 214, n: 204, ua: 104, fa: 150, th: 128, sh: 70, ft: 140 },
      { t: 214, n: 204, ua: 60, fa: 110, th: 128, sh: 70, ft: 140 },
    ],
  },
  mountain_climber: {
    view: 'side', anchor: 'wrist', at: [148, FOOT_Y], ms: 380,
    frames: [
      { ...plankHigh, th: 62, sh: -62, th2: -68, sh2: -68, ft: 30, ft2: 8 },
      { ...plankHigh, th: -68, sh: -68, th2: 62, sh2: -62, ft: 8, ft2: 30 },
    ],
  },

  // ── Conditioning / full body ─────────────────────────────────────────────
  burpee: {
    view: 'side', anchor: 'ankle', at: [100, FOOT_Y], loop: 'cycle', ms: 480, hold: 40,
    frames: [
      { ...stand, ua: 6, fa: 10 },
      { t: 120, ua: 10, fa: 4, th: 120, sh: -50, ft: 90 },
      { ...plankHigh, ax: 60, ay: FOOT_Y - 4, ft: 8 },
      { t: 120, ua: 10, fa: 4, th: 120, sh: -50, ft: 90 },
      { ...stand, ua: 172, fa: 176, ft: 30, ay: FOOT_Y - 22 },
    ],
  },
  high_knees: {
    view: 'side', anchor: 'hip', at: [96, FOOT_Y - 61], ms: 300,
    frames: [
      { t: 182, ua: -40, fa: 60, ua2: 50, fa2: 150, th: 0, sh: 0, ft: 70, th2: 92, sh2: 4, ft2: 60 },
      { t: 182, ua: 50, fa: 150, ua2: -40, fa2: 60, th: 92, sh: 4, ft: 60, th2: 0, sh2: 0, ft2: 70 },
    ],
  },
  farmer_carry: {
    view: 'side', anchor: 'hip', at: [96, 87], hand: 'dumbbell', ms: 600,
    frames: [
      { t: 180, ua: 2, fa: 2, th: 22, sh: 4, th2: -18, sh2: -26, ft: 90, ft2: 60 },
      { t: 180, ua: 2, fa: 2, th: -18, sh: -26, th2: 22, sh2: 4, ft: 60, ft2: 90 },
    ],
  },
  power_clean: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell', loop: 'cycle', ms: 560, hold: 260,
    frames: [
      { t: 128, ua: -2, fa: -2, th: 68, sh: -16 },
      { t: 186, ua: -10, fa: -10, th: 0, sh: 0, ft: 60 },
      { t: 170, ua: 100, fa: 226, th: 40, sh: -22 },
      { ...stand, ua: 100, fa: 226 },
    ],
  },
  thruster: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'barbell', ms: 800, loop: 'cycle', hold: 120,
    frames: [
      { t: 158, ua: 72, fa: 198, th: 84, sh: -36 },
      { ...stand, ua: 92, fa: 220 },
      { ...overhead },
      { ...stand, ua: 92, fa: 220 },
    ],
  },

  // ── Home additions: bodyweight ───────────────────────────────────────────
  pushup_knee: {
    view: 'side', anchor: 'knee', at: [70, FOOT_Y + 2],
    frames: [
      { t: 130, ua: 2, fa: 2, th: -50, sh: -90, ft: -90 },
      { t: 108, ua: -84, fa: 6, th: -72, sh: -90, ft: -90 },
    ],
  },
  pushup_incline: {
    view: 'side', anchor: 'wrist', at: [134, 110], props: [{ type: 'box', x: 118, y: 112, w: 34, h: 40 }],
    frames: [
      { t: 140, ua: 2, fa: 2, th: -40, sh: -40, ft: 20 },
      { t: 128, ua: -70, fa: 10, th: -52, sh: -52, ft: 20 },
    ],
  },
  pushup_decline: {
    view: 'side', anchor: 'toe', at: [36, 96], props: [{ type: 'box', x: 14, y: 98, w: 34, h: 54 }],
    frames: [
      { t: 82, n: 76, ua: 2, fa: 2, th: -98, sh: -98, ft: 8 },
      { t: 74, n: 66, ua: -70, fa: 14, th: -106, sh: -106, ft: 8 },
    ],
  },
  pushup_archer: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2],
    frames: [plankHigh, { ...plankLow, ua2: 64, fa2: 76 }],
  },
  pushup_planche: {
    view: 'side', anchor: 'toe', at: [36, FOOT_Y + 2],
    frames: [
      { ...plankHigh, t: 106, ua: -24, fa: -24, ft: 0 },
      { ...plankLow, t: 94, ua: -104, fa: -14, th: -84, sh: -84, ft: 0 },
    ],
  },
  towel_curl: {
    view: 'side', anchor: 'hip', at: [86, 110], tether: { from: 'wrist', to: 'ankle', kind: 'cable' },
    props: [{ type: 'box', x: 62, y: 112, w: 42, h: 40 }],
    frames: [
      seated({ t: 172, ua: 10, fa: 40, sh: 34, ft: 124 }),
      seated({ t: 172, ua: 10, fa: 150, sh: 20, ft: 110 }),
    ],
  },
  pushup_clap: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2], loop: 'cycle', ms: 360, hold: 60,
    frames: [plankLow, plankHigh, { ...plankHigh, t: 126, n: 120, ua: 70, fa: 76 }, plankHigh],
  },
  inverted_row: {
    view: 'side', anchor: 'ankle', at: [38, 146], props: [{ type: 'bar', x: 100, y: 88, w: 50 }],
    frames: [
      { t: 98, n: 100, ua: 200, fa: 200, th: -82, sh: -82, ft: 170 },
      { t: 124, n: 120, ua: -30, fa: 150, th: -56, sh: -56, ft: 160 },
    ],
  },
  prone_y_raise: {
    view: 'side', anchor: 'hip', at: [92, 144], hold: 400,
    frames: [
      { t: 90, n: 90, ua: 90, fa: 90, th: -90, sh: -90, ft: -90 },
      { t: 96, n: 104, ua: 122, fa: 124, th: -90, sh: -90, ft: -90 },
    ],
  },
  pike_elevated: {
    view: 'side', anchor: 'toe', at: [38, 90], props: [{ type: 'box', x: 14, y: 92, w: 34, h: 60 }],
    frames: [
      { t: 45, n: 30, ua: 20, fa: 20, th: -80, sh: -80, ft: 0 },
      { t: 30, n: 10, ua: -50, fa: 40, th: -80, sh: -80, ft: 0 },
    ],
  },
  handstand_wall: {
    view: 'side', anchor: 'wrist', at: [104, FOOT_Y + 2], ms: 1800, props: [{ type: 'wall', x: 92 }],
    frames: [
      { t: 2, n: 0, ua: 0, fa: 0, th: 178, sh: 178, ft: 180 },
      { t: 0, n: -2, ua: 0, fa: 0, th: 180, sh: 182, ft: 180 },
    ],
  },
  tricep_ext_bw: {
    view: 'side', anchor: 'wrist', at: [130, 110], props: [{ type: 'box', x: 116, y: 112, w: 36, h: 40 }],
    frames: [
      { t: 140, ua: 2, fa: 2, th: -40, sh: -40, ft: 20 },
      { t: 120, ua: 40, fa: 92, th: -60, sh: -60, ft: 20 },
    ],
  },
  lateral_lunge: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y],
    frames: [
      { t: 180, ua: 14, fa: 10, th: 33, sh: 33 },
      { t: 170, ua: 20, fa: 40, th: 70, sh: -20, th2: 50, sh2: 50, ax: 114 },
    ],
  },
  step_up: {
    view: 'side', anchor: 'ankle', at: [116, 130], props: [{ type: 'box', x: 100, y: 133, w: 40, h: 19 }],
    frames: [
      { t: 172, ua: 20, fa: 30, ua2: -16, fa2: 0, th: 60, sh: -20, th2: -8, sh2: -8, ft2: 60 },
      { t: 180, ua: -10, fa: 10, ua2: 14, fa2: 30, th: 0, sh: 0, th2: 80, sh2: 0, ft2: 90 },
    ],
  },
  glute_bridge_single: {
    view: 'side', anchor: 'ankle', at: [124, FOOT_Y],
    frames: [
      { t: -90, n: -90, ua: 90, fa: 90, th: 142, sh: 20, th2: 120, sh2: 120, ft2: 150 },
      { t: -70, n: -80, ua: 72, fa: 88, th: 108, sh: 2, th2: 108, sh2: 108, ft2: 150 },
    ],
  },
  pistol_squat: {
    view: 'side', anchor: 'ankle', at: [100, FOOT_Y],
    frames: [
      { t: 180, ua: 80, fa: 85, th: 0, sh: 0, th2: 40, sh2: 40, ft2: 150 },
      { t: 140, ua: 92, fa: 92, th: 90, sh: -40, th2: 88, sh2: 88, ft2: 180 },
    ],
  },
  nordic_curl: {
    view: 'side', anchor: 'knee', at: [60, FOOT_Y], ms: 1500, hold: 300,
    frames: [
      { t: 180, ua: 30, fa: 160, th: 0, sh: -90, ft: -90 },
      { t: 128, n: 118, ua: 100, fa: 100, th: -52, sh: -90, ft: -90 },
    ],
  },
  single_leg_rdl: {
    view: 'side', anchor: 'ankle', at: STAND,
    frames: [
      { ...stand, ua: 3, fa: 6 },
      { t: 96, n: 100, ua: 2, fa: 2, th: 10, sh: -4, th2: -84, sh2: -86, ft2: 0 },
    ],
  },
  calf_raise_bw: {
    view: 'side', anchor: 'toe', at: [101, FOOT_Y + 1], ms: 800, hold: 250,
    frames: [
      { ...stand, ua: 40, fa: 50, ft: 90, th2: -30, sh2: -100 },
      { ...stand, ua: 40, fa: 50, ft: 30, th2: -30, sh2: -100 },
    ],
  },
  donkey_kick: {
    view: 'side', anchor: 'wrist', at: [132, FOOT_Y],
    frames: [
      kneelHinge({ t: 100, th: 4, sh: -88, th2: 0, sh2: -90 }),
      kneelHinge({ t: 100, th: -100, sh: -176, ft: -90, th2: 0, sh2: -90 }),
    ],
  },
  sumo_squat: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y],
    frames: [
      { t: 180, ua: 20, fa: -60, th: 30, sh: 30 },
      { t: 180, ua: 24, fa: -64, th: 70, sh: 5 },
    ],
  },

  // ── Home additions: core ─────────────────────────────────────────────────
  side_plank: {
    view: 'side', anchor: 'toe', at: [40, FOOT_Y + 2], ms: 1800,
    frames: [
      { t: 98, ua: 0, fa: 90, ua2: 180, fa2: 180, th: -82, sh: -82, ft: 0 },
      { t: 99, ua: 0, fa: 90, ua2: 178, fa2: 178, th: -81, sh: -81, ft: 0 },
    ],
  },
  dead_bug: {
    view: 'side', anchor: 'hip', at: [104, 146], loop: 'cycle', ms: 700, hold: 120,
    frames: [
      { t: -90, n: -90, ua: 180, fa: 180, th: 180, sh: 90, ft: 180 },
      { t: -90, n: -90, ua: 264, fa: 264, ua2: 180, fa2: 180, th: 180, sh: 90, th2: 98, sh2: 98, ft: 180, ft2: 180 },
      { t: -90, n: -90, ua: 180, fa: 180, th: 180, sh: 90, ft: 180 },
      { t: -90, n: -90, ua: 180, fa: 180, ua2: 264, fa2: 264, th: 98, sh: 98, th2: 180, sh2: 90, ft: 180, ft2: 180 },
    ],
  },
  bird_dog: {
    view: 'side', anchor: 'knee', at: [80, FOOT_Y], hold: 300, ms: 900,
    frames: [
      kneelHinge({ t: 104 }),
      kneelHinge({ t: 104, ua: 96, fa: 96, ua2: 0, fa2: 0, th2: -94, sh2: -94, ft2: -90 }),
    ],
  },
  leg_raise: {
    view: 'side', anchor: 'hip', at: [100, 146],
    frames: [
      { t: -90, n: -90, ua: 90, fa: 90, th: 94, sh: 94, ft: 180 },
      { t: -90, n: -90, ua: 90, fa: 90, th: 176, sh: 176, ft: 250 },
    ],
  },
  flutter_kick: {
    view: 'side', anchor: 'hip', at: [100, 144], ms: 300,
    frames: [
      { t: -100, n: -110, ua: 90, fa: 90, th: 100, sh: 100, th2: 118, sh2: 118, ft: 160, ft2: 160 },
      { t: -100, n: -110, ua: 90, fa: 90, th: 118, sh: 118, th2: 100, sh2: 100, ft: 160, ft2: 160 },
    ],
  },
  hollow_hold: {
    view: 'side', anchor: 'hip', at: [100, 144], ms: 1800,
    frames: [
      { t: -105, n: -118, ua: -112, fa: -112, th: 102, sh: 102, ft: 150 },
      { t: -106, n: -120, ua: -110, fa: -110, th: 103, sh: 103, ft: 150 },
    ],
  },
  v_up: {
    view: 'side', anchor: 'hip', at: [100, 144], hold: 160,
    frames: [
      { t: -96, n: -100, ua: -100, fa: -100, th: 96, sh: 96, ft: 160 },
      { t: -138, n: -150, ua: 132, fa: 132, th: 136, sh: 136, ft: 200 },
    ],
  },
  reverse_crunch: {
    view: 'side', anchor: 'shoulder', at: [70, 142],
    frames: [
      { t: -90, n: -90, ua: 90, fa: 90, th: 178, sh: 92, ft: 180 },
      { t: -76, n: -90, ua: 90, fa: 90, th: 214, sh: 150, ft: 230 },
    ],
  },
  shoulder_tap: {
    view: 'side', anchor: 'toe', at: [42, FOOT_Y + 2], loop: 'cycle', ms: 420, hold: 120,
    frames: [plankHigh, { ...plankHigh, ua: 40, fa: 196 }, plankHigh, { ...plankHigh, ua2: 40, fa2: 196 }],
  },

  // ── Home additions: conditioning ─────────────────────────────────────────
  squat_thrust: {
    view: 'side', anchor: 'ankle', at: [100, FOOT_Y], loop: 'cycle', ms: 460, hold: 60,
    frames: [
      { ...stand, ua: 6, fa: 10 },
      { t: 120, ua: 10, fa: 4, th: 120, sh: -50, ft: 90 },
      { ...plankHigh, ax: 60, ay: FOOT_Y - 4, ft: 8 },
      { t: 120, ua: 10, fa: 4, th: 120, sh: -50, ft: 90 },
    ],
  },
  inchworm: {
    view: 'side', anchor: 'toe', at: [60, FOOT_Y + 2], loop: 'cycle', ms: 900, hold: 200,
    frames: [
      { ...stand, ua: 3, fa: 6, ft: 90 },
      { t: 60, n: 30, ua: 6, fa: 6, th: 4, sh: -4, ft: 90 },
      { ...plankHigh },
      { t: 60, n: 30, ua: 6, fa: 6, th: 4, sh: -4, ft: 90 },
    ],
  },
  bear_crawl: {
    view: 'side', anchor: 'hip', at: [100, 112], ms: 450,
    frames: [
      { t: 98, n: 96, ua: 12, fa: 8, ua2: -12, fa2: -8, th: -6, sh: -80, th2: 22, sh2: -62, ft: -90, ft2: -90 },
      { t: 98, n: 96, ua: -12, fa: -8, ua2: 12, fa2: 8, th: 22, sh: -62, th2: -6, sh2: -80, ft: -90, ft2: -90 },
    ],
  },
  skater_jump: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], loop: 'cycle', ms: 380, hold: 60,
    frames: [
      { t: 172, ua: 60, fa: 40, ua2: 20, fa2: 0, th: 30, sh: -10, th2: -15, sh2: -70, ax: 74 },
      { t: 180, ua: 40, fa: 30, th: 8, sh: 0, ax: 100, ay: FOOT_Y - 20 },
      { t: 188, ua: 20, fa: 0, ua2: 60, fa2: 40, th: -15, sh: -70, th2: 30, sh2: -10, ax: 126 },
      { t: 180, ua: 40, fa: 30, th: 8, sh: 0, ax: 100, ay: FOOT_Y - 20 },
    ],
  },
  jump_lunge: {
    view: 'side', anchor: 'hip', at: [100, 116], loop: 'cycle', ms: 360, hold: 80,
    frames: [
      { t: 178, ua: 40, fa: 70, ua2: -30, fa2: -10, th: 86, sh: -6, th2: -12, sh2: -88, ft2: 0 },
      { t: 180, ua: 10, fa: 20, th: 14, sh: -10, th2: -14, sh2: -24, ay: 76 },
      { t: 178, ua: -30, fa: -10, ua2: 40, fa2: 70, th: -12, sh: -88, ft: 0, th2: 86, sh2: -6 },
      { t: 180, ua: 10, fa: 20, th: -14, sh: -24, th2: 14, sh2: -10, ay: 76 },
    ],
  },
  tuck_jump: {
    view: 'side', anchor: 'hip', at: [96, 106], loop: 'cycle', ms: 380, hold: 60,
    frames: [
      { t: 160, ua: -30, fa: -20, th: 60, sh: -30 },
      { t: 176, ua: 110, fa: 140, th: 140, sh: 30, ft: 120, ay: 52 },
      { ...stand, ua: 30, fa: 40, ay: 87 },
    ],
  },
  star_jump: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], loop: 'cycle', ms: 360, hold: 80,
    frames: [
      { t: 180, ua: 20, fa: 10, th: 26, sh: -16 },
      { t: 180, ua: 150, fa: 160, th: 36, sh: 36, ay: FOOT_Y - 26 },
      { t: 180, ua: 14, fa: 10, th: 4, sh: 0 },
    ],
  },
  butt_kicks: {
    view: 'side', anchor: 'hip', at: [96, FOOT_Y - 61], ms: 280,
    frames: [
      { t: 180, ua: -30, fa: 60, ua2: 40, fa2: 100, th: 0, sh: 0, ft: 70, th2: -10, sh2: -160, ft2: -120 },
      { t: 180, ua: 40, fa: 100, ua2: -30, fa2: 60, th: -10, sh: -160, ft: -120, th2: 0, sh2: 0, ft2: 70 },
    ],
  },
  shadow_boxing: {
    view: 'side', anchor: 'ankle', at: [96, FOOT_Y], loop: 'cycle', ms: 220, hold: 140,
    frames: [
      { t: 176, ua: 30, fa: 165, th: 10, sh: 4, th2: -12, sh2: -8 },
      { t: 176, ua: 88, fa: 90, ua2: 30, fa2: 165, th: 10, sh: 4, th2: -12, sh2: -8 },
      { t: 176, ua: 30, fa: 165, th: 10, sh: 4, th2: -12, sh2: -8 },
      { t: 172, ua: 30, fa: 165, ua2: 88, fa2: 90, th: 10, sh: 4, th2: -12, sh2: -8 },
    ],
  },

  // ── Home additions: dumbbell ─────────────────────────────────────────────
  floor_fly: {
    view: 'side', anchor: 'hip', at: [104, 146], hand: 'dumbbell',
    frames: [
      lieBack({ ua: 180, fa: 180, th: 140, sh: 20 }),
      lieBack({ ua: 110, fa: 130, th: 140, sh: 20 }),
    ],
  },
  pullover: {
    view: 'side', anchor: 'hip', at: [118, 102], hand: 'dumbbell', props: [flatBench()], ms: 1100,
    frames: [
      lieBack({ ua: 180, fa: 180 }),
      lieBack({ ua: 276, fa: 280 }),
    ],
  },
  shrug: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', hold: 300,
    frames: [
      { ...stand, ua: 2, fa: 2 },
      { ...stand, ua: 2, fa: 2, n: 176, ft: 74, ay: FOOT_Y - 3 },
    ],
  },
  upright_row: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell',
    frames: [
      { ...stand, ua: 4, fa: 4 },
      { ...stand, ua: 80, fa: 190 },
    ],
  },
  concentration_curl: {
    view: 'side', anchor: 'hip', at: [86, 110], hand: 'dumbbell', props: [{ type: 'box', x: 62, y: 112, w: 42, h: 40 }],
    frames: [
      seated({ t: 140, n: 120, ua: 20, fa: 20 }),
      seated({ t: 140, n: 120, ua: 20, fa: 160 }),
    ],
  },
  tricep_kickback: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell',
    frames: [
      { t: 110, ua: -70, fa: 0, th: 24, sh: -14 },
      { t: 110, ua: -70, fa: -72, th: 24, sh: -14 },
    ],
  },
  floor_skull_crusher: {
    view: 'side', anchor: 'hip', at: [104, 146], hand: 'dumbbell',
    frames: [
      lieBack({ ua: 172, fa: 176, th: 140, sh: 20 }),
      lieBack({ ua: 166, fa: 262, th: 140, sh: 20 }),
    ],
  },
  step_up_db: {
    view: 'side', anchor: 'ankle', at: [116, 130], hand: 'dumbbell', props: [{ type: 'box', x: 100, y: 133, w: 40, h: 19 }],
    frames: [
      { t: 172, ua: 2, fa: 2, th: 60, sh: -20, th2: -8, sh2: -8, ft2: 60 },
      { t: 180, ua: 2, fa: 2, th: 0, sh: 0, th2: 80, sh2: 0, ft2: 90 },
    ],
  },
  sumo_squat_db: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], hand: 'kettlebell',
    frames: [
      { t: 180, ua: 4, fa: -10, th: 30, sh: 30 },
      { t: 180, ua: 4, fa: -10, th: 70, sh: 5 },
    ],
  },
  single_leg_rdl_db: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell',
    frames: [
      { ...stand, ua: 1, fa: 1 },
      { t: 96, n: 100, ua: 0, fa: 0, th: 10, sh: -4, th2: -84, sh2: -86, ft2: 0 },
    ],
  },
  glute_bridge_db: {
    view: 'side', anchor: 'ankle', at: [124, FOOT_Y], hand: 'dumbbell',
    frames: [
      { t: -90, n: -90, ua: 90, fa: 90, th: 142, sh: 20 },
      { t: -70, n: -80, ua: 110, fa: 110, th: 108, sh: 2 },
    ],
  },
  side_bend: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], hand: 'dumbbell', ms: 1000,
    frames: [
      { t: 180, ua: 4, fa: 4, th: 8, sh: 0 },
      { t: 160, ua: 4, fa: 4, th: 8, sh: 0 },
    ],
  },
  woodchop: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], hand: 'dumbbell', ms: 800,
    frames: [
      { t: 172, ua: 135, fa: 135, ua2: -135, fa2: -135, th: 14, sh: 2 },
      { t: 190, ua: -30, fa: -30, ua2: 30, fa2: 30, th: 26, sh: -10 },
    ],
  },
  thruster_db: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', ms: 800, loop: 'cycle', hold: 120,
    frames: [
      { t: 158, ua: 30, fa: 170, th: 84, sh: -36 },
      { ...stand, ua: 22, fa: 168 },
      { ...overhead },
      { ...stand, ua: 22, fa: 168 },
    ],
  },
  db_snatch: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', loop: 'cycle', ms: 520, hold: 220,
    frames: [
      { t: 120, ua: 0, fa: 0, ua2: 20, fa2: 20, th: 40, sh: -24 },
      { t: 184, ua: 90, fa: 160, ua2: -10, fa2: 0, th: 0, sh: 0, ft: 50 },
      { ...stand, ua: 178, fa: 180, ua2: 10, fa2: 14 },
    ],
  },
  clean_press_db: {
    view: 'side', anchor: 'ankle', at: STAND, hand: 'dumbbell', loop: 'cycle', ms: 560, hold: 200,
    frames: [
      { t: 118, ua: 0, fa: 0, th: 36, sh: -20 },
      { ...rackHigh },
      { ...overhead },
      { ...rackHigh },
    ],
  },

  // ── Home additions: resistance band ──────────────────────────────────────
  band_pulldown: {
    view: 'side', anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: [112, 2], kind: 'band' },
    props: [{ type: 'pulley', x: 112, y: 2 }],
    frames: [
      { ...stand, ua: 168, fa: 172 },
      { ...stand, t: 184, ua: 12, fa: 166 },
    ],
  },
  band_face_pull: {
    view: 'side', anchor: 'ankle', at: [80, FOOT_Y],
    tether: { from: 'wrist', to: [176, 46], kind: 'band' }, props: [{ type: 'pulley', x: 176, y: 46 }],
    frames: [
      { t: 176, ua: 100, fa: 100, th: 4, sh: -4 },
      { t: 182, ua: 196, fa: 112, th: 4, sh: -4 },
    ],
  },
  band_ohp: {
    view: 'side', anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: 'ankle', kind: 'band' },
    frames: [{ ...rackHigh, ua: 10, fa: 176 }, overhead],
  },
  band_lateral_raise: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], tether: { from: 'wrist', to: 'ankle', kind: 'band' },
    frames: [
      { t: 180, ua: 10, fa: 14, th: 4, sh: 0 },
      { t: 180, ua: 86, fa: 92, th: 4, sh: 0 },
    ],
  },
  band_pushdown: {
    view: 'side', anchor: 'ankle', at: [86, FOOT_Y],
    tether: { from: 'wrist', to: [150, 18], kind: 'band' }, props: [{ type: 'pulley', x: 150, y: 18 }],
    frames: [
      { t: 172, ua: 8, fa: 150, th: 4, sh: -4 },
      { t: 172, ua: 6, fa: 4, th: 4, sh: -4 },
    ],
  },
  band_deadlift: {
    view: 'side', anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: 'ankle', kind: 'band' },
    frames: [
      { t: 128, ua: -2, fa: -2, th: 68, sh: -16 },
      { ...standArmsBack },
    ],
  },
  band_good_morning: {
    view: 'side', anchor: 'ankle', at: STAND, tether: { from: 'wrist', to: 'ankle', kind: 'band' },
    frames: [
      { ...stand, ua: -40, fa: 160 },
      { t: 100, ua: -110, fa: 90, th: 10, sh: -6 },
    ],
  },
  band_lateral_walk: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y], ms: 600,
    frames: [
      { t: 180, ua: 30, fa: -60, th: 10, sh: 0 },
      { t: 180, ua: 30, fa: -60, th: 28, sh: 26 },
    ],
  },
  band_pallof: {
    view: 'side', anchor: 'ankle', at: [100, FOOT_Y], hold: 500,
    tether: { from: 'wrist', to: [40, 92], kind: 'band' }, props: [{ type: 'pulley', x: 40, y: 92 }],
    frames: [
      { t: 180, ua: 30, fa: 150, th: 10, sh: -6 },
      { t: 180, ua: 88, fa: 90, th: 10, sh: -6 },
    ],
  },
  band_fly: {
    view: 'front', anchor: 'ankle', at: [100, FOOT_Y],
    tether: { from: 'wrist', to: [190, 64], kind: 'band' },
    frames: [
      { t: 180, ua: 94, fa: 94, th: 8, sh: 2 },
      { t: 180, ua: 64, fa: -30, th: 8, sh: 2 },
    ],
  },
};

/** Fallback used for custom exercises without a pattern. */
export const DEFAULT_PATTERN = 'squat_bw';
