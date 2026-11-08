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
};

/** Fallback used for custom exercises without a pattern. */
export const DEFAULT_PATTERN = 'squat_bw';
