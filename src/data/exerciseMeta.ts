import type { GymGroup, HomeGroup, Level } from '@/domain/types';

/**
 * Per-exercise extras for the library: difficulty, the body area a home exercise
 * trains (gym exercises use their group), alternatives, and which gym exercises are
 * also listed in the Home library because they need only home equipment.
 *
 * Alternatives are ordered best first. Every exercise that needs equipment has at
 * least one alternative you can do without any (enforced by exerciseMeta.test.ts).
 */
interface Meta {
  level: Level;
  /** Home exercises only: the body area it trains. */
  area?: GymGroup;
  alt: string[];
  /** Gym exercises only: also list it in this Home group. */
  home?: HomeGroup;
}

const B: Level = 'Beginner';
const I: Level = 'Intermediate';
const A: Level = 'Advanced';

/** Gym exercise. */
const g = (level: Level, alt: string[], home?: HomeGroup): Meta => ({ level, alt, ...(home ? { home } : {}) });
/** Home exercise. */
const h = (level: Level, area: GymGroup, alt: string[]): Meta => ({ level, area, alt });

/** Household items that don't count as equipment for "no equipment" alternatives. */
export const NO_GEAR = new Set(['None', 'Mat', 'Wall', 'None (optional weight)', 'Sturdy chair', 'Sturdy table', 'Step or sturdy chair', 'Sofa or partner', 'Towel']);

export const EXERCISE_META: Record<string, Meta> = {
  // ─── Gym ───────────────────────────────────────────────────────────────────
  'bench-press': g(I, ['db-floor-press', 'push-up', 'band-chest-press']),
  'incline-db-press': g(I, ['decline-push-up', 'db-floor-press', 'band-chest-press']),
  'db-fly': g(B, ['db-floor-fly', 'band-fly', 'wide-push-up']),
  'cable-crossover': g(B, ['band-fly', 'db-floor-fly', 'wide-push-up']),
  'chest-dip': g(I, ['chair-dip', 'decline-push-up']),
  'machine-chest-press': g(B, ['push-up', 'band-chest-press', 'db-floor-press']),
  deadlift: g(A, ['db-rdl', 'band-deadlift', 'single-leg-rdl']),
  'pull-up': g(I, ['chin-up', 'inverted-row', 'band-lat-pulldown'], 'bodyweight'),
  'lat-pulldown': g(B, ['band-lat-pulldown', 'pull-up', 'inverted-row']),
  'barbell-row': g(I, ['db-bent-row', 'inverted-row', 'band-row']),
  'seated-cable-row': g(B, ['band-row', 'inverted-row', 'db-bent-row']),
  'db-row': g(B, ['db-bent-row', 'inverted-row', 'band-row']),
  'face-pull': g(B, ['band-face-pull', 'prone-y-raise', 'band-pull-apart']),
  'overhead-press': g(I, ['db-shoulder-press', 'band-overhead-press', 'pike-push-up']),
  'seated-db-press': g(B, ['db-shoulder-press', 'arnold-press', 'pike-push-up']),
  'lateral-raise': g(B, ['band-lateral-raise', 'db-upright-row', 'pike-push-up'], 'dumbbell'),
  'rear-delt-fly': g(B, ['band-pull-apart', 'prone-y-raise', 'band-face-pull'], 'dumbbell'),
  'front-raise': g(B, ['db-shoulder-press', 'band-overhead-press', 'pike-push-up'], 'dumbbell'),
  'barbell-curl': g(B, ['db-curl', 'band-curl', 'chin-up', 'towel-curl']),
  'hammer-curl': g(B, ['db-curl', 'band-curl', 'chin-up', 'towel-curl'], 'dumbbell'),
  'tricep-pushdown': g(B, ['band-pushdown', 'diamond-push-up', 'chair-dip']),
  'skull-crusher': g(I, ['db-floor-skull-crusher', 'bodyweight-tricep-extension', 'band-tricep-extension']),
  'overhead-tricep-extension': g(B, ['band-tricep-extension', 'bodyweight-tricep-extension', 'chair-dip'], 'dumbbell'),
  'back-squat': g(I, ['goblet-squat', 'band-squat', 'bodyweight-squat']),
  'front-squat': g(A, ['goblet-squat', 'bodyweight-squat', 'pistol-squat']),
  'romanian-deadlift': g(I, ['db-rdl', 'single-leg-rdl', 'band-good-morning']),
  'leg-press': g(B, ['goblet-squat', 'bodyweight-squat', 'step-up']),
  'walking-lunge': g(B, ['reverse-lunge', 'split-squat', 'jumping-lunge'], 'dumbbell'),
  'bulgarian-split-squat': g(I, ['split-squat', 'step-up', 'pistol-squat'], 'dumbbell'),
  'leg-extension': g(B, ['split-squat', 'wall-sit', 'step-up']),
  'leg-curl': g(B, ['nordic-curl', 'single-leg-glute-bridge', 'single-leg-rdl']),
  'calf-raise': g(B, ['single-leg-calf-raise'], 'dumbbell'),
  'hip-thrust': g(I, ['db-glute-bridge', 'single-leg-glute-bridge', 'band-glute-bridge']),
  'hanging-leg-raise': g(I, ['lying-leg-raise', 'reverse-crunch', 'v-up'], 'bodyweight'),
  'cable-crunch': g(B, ['crunch', 'reverse-crunch', 'v-up']),
  plank: g(B, ['side-plank', 'hollow-hold', 'dead-bug'], 'bodyweight'),
  'ab-wheel': g(A, ['hollow-hold', 'inchworm', 'plank']),
  crunch: g(B, ['reverse-crunch', 'dead-bug', 'bicycle-crunch'], 'bodyweight'),
  'power-clean': g(A, ['db-clean-press', 'db-snatch', 'jump-squat']),
  'kettlebell-swing': g(I, ['db-snatch', 'band-deadlift', 'glute-bridge']),
  thruster: g(I, ['db-thruster', 'jump-squat', 'burpee']),
  'farmers-carry': g(B, ['plank', 'bear-crawl'], 'dumbbell'),

  // ─── Home · bodyweight ─────────────────────────────────────────────────────
  'push-up': h(B, 'chest', ['knee-push-up', 'incline-push-up', 'wide-push-up', 'decline-push-up']),
  'knee-push-up': h(B, 'chest', ['incline-push-up', 'push-up']),
  'incline-push-up': h(B, 'chest', ['knee-push-up', 'push-up']),
  'wide-push-up': h(I, 'chest', ['push-up', 'knee-push-up', 'db-floor-fly']),
  'decline-push-up': h(I, 'chest', ['push-up', 'pike-push-up']),
  'archer-push-up': h(A, 'chest', ['wide-push-up', 'decline-push-up']),
  'clap-push-up': h(A, 'chest', ['push-up', 'decline-push-up']),
  'pseudo-planche-push-up': h(A, 'chest', ['decline-push-up', 'push-up']),
  'inverted-row': h(I, 'back', ['band-row', 'db-bent-row', 'superman']),
  'chin-up': h(I, 'back', ['inverted-row', 'band-lat-pulldown']),
  'prone-y-raise': h(B, 'back', ['superman', 'band-pull-apart']),
  superman: h(B, 'back', ['prone-y-raise', 'bird-dog']),
  'pike-push-up': h(I, 'shoulders', ['push-up', 'elevated-pike-push-up', 'band-overhead-press']),
  'elevated-pike-push-up': h(A, 'shoulders', ['pike-push-up', 'wall-handstand-hold']),
  'wall-handstand-hold': h(A, 'shoulders', ['elevated-pike-push-up', 'pike-push-up']),
  'diamond-push-up': h(I, 'arms', ['chair-dip', 'push-up', 'bodyweight-tricep-extension']),
  'chair-dip': h(B, 'arms', ['diamond-push-up', 'bodyweight-tricep-extension']),
  'bodyweight-tricep-extension': h(I, 'arms', ['diamond-push-up', 'chair-dip']),
  'towel-curl': h(B, 'arms', ['chin-up', 'band-curl', 'db-curl']),
  'bodyweight-squat': h(B, 'legs', ['sumo-squat', 'wall-sit', 'jump-squat', 'pistol-squat']),
  'reverse-lunge': h(B, 'legs', ['split-squat', 'curtsy-lunge', 'step-up']),
  'split-squat': h(B, 'legs', ['reverse-lunge', 'bulgarian-split-squat']),
  'lateral-lunge': h(I, 'legs', ['sumo-squat', 'curtsy-lunge']),
  'curtsy-lunge': h(I, 'legs', ['reverse-lunge', 'lateral-lunge']),
  'step-up': h(B, 'legs', ['reverse-lunge', 'db-step-up']),
  'glute-bridge': h(B, 'legs', ['single-leg-glute-bridge', 'donkey-kick', 'band-glute-bridge']),
  'single-leg-glute-bridge': h(I, 'legs', ['glute-bridge', 'db-glute-bridge']),
  'pistol-squat': h(A, 'legs', ['split-squat', 'step-up', 'bodyweight-squat']),
  'nordic-curl': h(A, 'legs', ['single-leg-glute-bridge', 'single-leg-rdl']),
  'single-leg-rdl': h(I, 'legs', ['glute-bridge', 'db-single-leg-rdl']),
  'single-leg-calf-raise': h(B, 'legs', ['calf-raise', 'jumping-jack']),
  'donkey-kick': h(B, 'legs', ['glute-bridge', 'band-kickback']),
  'sumo-squat': h(B, 'legs', ['bodyweight-squat', 'db-sumo-squat']),
  'wall-sit': h(B, 'legs', ['bodyweight-squat', 'split-squat']),
  'side-plank': h(B, 'abs', ['plank', 'russian-twist']),
  'dead-bug': h(B, 'abs', ['bird-dog', 'hollow-hold']),
  'bird-dog': h(B, 'abs', ['dead-bug', 'superman']),
  'lying-leg-raise': h(I, 'abs', ['reverse-crunch', 'hanging-leg-raise']),
  'flutter-kick': h(I, 'abs', ['lying-leg-raise', 'dead-bug']),
  'hollow-hold': h(A, 'abs', ['dead-bug', 'plank']),
  'v-up': h(A, 'abs', ['crunch', 'lying-leg-raise']),
  'reverse-crunch': h(B, 'abs', ['lying-leg-raise', 'crunch']),
  'plank-shoulder-tap': h(I, 'abs', ['plank', 'renegade-row']),

  // ─── Home · cardio & HIIT ──────────────────────────────────────────────────
  burpee: h(I, 'fullbody', ['squat-thrust', 'star-jump']),
  'squat-thrust': h(B, 'fullbody', ['burpee', 'mountain-climber']),
  'mountain-climber': h(B, 'fullbody', ['plank', 'bear-crawl']),
  'jumping-jack': h(B, 'fullbody', ['star-jump', 'shadow-boxing']),
  'high-knees': h(B, 'fullbody', ['butt-kick', 'jumping-jack', 'shadow-boxing']),
  'butt-kick': h(B, 'fullbody', ['high-knees', 'jumping-jack']),
  'shadow-boxing': h(B, 'fullbody', ['jumping-jack', 'high-knees']),
  inchworm: h(B, 'fullbody', ['bear-crawl', 'plank']),
  'bear-crawl': h(I, 'fullbody', ['mountain-climber', 'inchworm']),
  'star-jump': h(I, 'fullbody', ['jumping-jack', 'jump-squat']),
  'skater-jump': h(I, 'fullbody', ['lateral-lunge', 'jumping-jack']),
  'jump-squat': h(I, 'legs', ['bodyweight-squat', 'tuck-jump']),
  'jumping-lunge': h(A, 'legs', ['reverse-lunge', 'jump-squat']),
  'tuck-jump': h(A, 'legs', ['jump-squat', 'star-jump']),
  'bicycle-crunch': h(B, 'abs', ['dead-bug', 'crunch', 'russian-twist']),
  'russian-twist': h(B, 'abs', ['db-woodchop', 'side-plank', 'bicycle-crunch']),

  // ─── Home · dumbbell ───────────────────────────────────────────────────────
  'db-floor-press': h(B, 'chest', ['push-up', 'band-chest-press', 'incline-push-up']),
  'db-floor-fly': h(B, 'chest', ['wide-push-up', 'band-fly']),
  'db-bent-row': h(I, 'back', ['inverted-row', 'band-row', 'prone-y-raise']),
  'db-pullover': h(I, 'back', ['band-lat-pulldown', 'inverted-row']),
  'db-shrug': h(B, 'back', ['farmers-carry', 'prone-y-raise']),
  'renegade-row': h(A, 'back', ['plank-shoulder-tap', 'inverted-row']),
  'db-shoulder-press': h(B, 'shoulders', ['pike-push-up', 'band-overhead-press']),
  'arnold-press': h(I, 'shoulders', ['db-shoulder-press', 'pike-push-up']),
  'db-upright-row': h(I, 'shoulders', ['lateral-raise', 'band-lateral-raise', 'pike-push-up']),
  'db-curl': h(B, 'arms', ['band-curl', 'chin-up', 'towel-curl']),
  'concentration-curl': h(B, 'arms', ['db-curl', 'band-curl', 'chin-up', 'towel-curl']),
  'db-tricep-kickback': h(B, 'arms', ['band-pushdown', 'diamond-push-up']),
  'db-floor-skull-crusher': h(I, 'arms', ['bodyweight-tricep-extension', 'band-tricep-extension']),
  'goblet-squat': h(B, 'legs', ['bodyweight-squat', 'sumo-squat', 'band-squat']),
  'db-rdl': h(I, 'legs', ['single-leg-rdl', 'band-good-morning', 'band-deadlift']),
  'db-step-up': h(I, 'legs', ['step-up', 'reverse-lunge']),
  'db-sumo-squat': h(B, 'legs', ['sumo-squat', 'goblet-squat']),
  'db-single-leg-rdl': h(A, 'legs', ['single-leg-rdl', 'db-rdl']),
  'db-glute-bridge': h(B, 'legs', ['single-leg-glute-bridge', 'band-glute-bridge']),
  'db-side-bend': h(B, 'abs', ['side-plank', 'russian-twist']),
  'db-woodchop': h(I, 'abs', ['russian-twist', 'band-pallof-press']),
  'db-thruster': h(I, 'fullbody', ['burpee', 'jump-squat']),
  'db-snatch': h(A, 'fullbody', ['tuck-jump', 'burpee']),
  'db-clean-press': h(A, 'fullbody', ['burpee', 'db-thruster']),

  // ─── Home · resistance band ────────────────────────────────────────────────
  'band-chest-press': h(B, 'chest', ['push-up', 'incline-push-up']),
  'band-fly': h(I, 'chest', ['wide-push-up', 'db-floor-fly']),
  'band-row': h(B, 'back', ['inverted-row', 'db-bent-row']),
  'band-lat-pulldown': h(B, 'back', ['inverted-row', 'chin-up']),
  'band-pull-apart': h(B, 'back', ['prone-y-raise', 'band-face-pull']),
  'band-face-pull': h(B, 'shoulders', ['prone-y-raise', 'band-pull-apart']),
  'band-overhead-press': h(B, 'shoulders', ['pike-push-up', 'db-shoulder-press']),
  'band-lateral-raise': h(B, 'shoulders', ['lateral-raise', 'pike-push-up']),
  'band-curl': h(B, 'arms', ['db-curl', 'chin-up', 'towel-curl']),
  'band-tricep-extension': h(B, 'arms', ['bodyweight-tricep-extension', 'chair-dip']),
  'band-pushdown': h(B, 'arms', ['diamond-push-up', 'chair-dip']),
  'band-squat': h(B, 'legs', ['bodyweight-squat', 'goblet-squat']),
  'band-deadlift': h(B, 'legs', ['single-leg-rdl', 'glute-bridge']),
  'band-good-morning': h(I, 'legs', ['single-leg-rdl', 'superman']),
  'band-kickback': h(B, 'legs', ['donkey-kick', 'glute-bridge']),
  'band-lateral-walk': h(B, 'legs', ['lateral-lunge', 'donkey-kick']),
  'band-glute-bridge': h(B, 'legs', ['glute-bridge', 'single-leg-glute-bridge']),
  'band-pallof-press': h(I, 'abs', ['side-plank', 'plank-shoulder-tap']),
};
