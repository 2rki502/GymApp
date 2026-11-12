import type { AccentColor, Level } from '@/domain/types';

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  reps: string;
  restSec: number;
}

export interface RoutineTemplate {
  id: string;
  name: string;
  description: string;
  level: Level;
  minutes: number;
  color: AccentColor;
  equipment: string;
  exercises: TemplateExercise[];
}

const x = (exerciseId: string, sets: number, reps: string, restSec: number): TemplateExercise => ({ exerciseId, sets, reps, restSec });

/** Home full-body routines shown in the library. */
export const HOME_ROUTINES: RoutineTemplate[] = [
  {
    id: 'tpl-bw-full', name: 'Bodyweight Full Body', level: 'Beginner', minutes: 30, color: 'lime', equipment: 'No equipment',
    description: 'A balanced session hitting every major muscle group using only your bodyweight.',
    exercises: [x('bodyweight-squat', 3, '15-20', 45), x('push-up', 3, '8-15', 60), x('reverse-lunge', 3, '10 / leg', 45), x('glute-bridge', 3, '15', 45), x('superman', 3, '12', 45), x('plank', 3, '30-45s', 45)],
  },
  {
    id: 'tpl-db-full', name: 'Dumbbell Total Body', level: 'Intermediate', minutes: 40, color: 'blue', equipment: 'Dumbbells',
    description: 'Strength-focused full-body session for a home setup with a pair of dumbbells.',
    exercises: [x('goblet-squat', 4, '10-12', 75), x('db-floor-press', 4, '8-12', 75), x('db-bent-row', 4, '10-12', 75), x('db-rdl', 3, '10-12', 75), x('db-shoulder-press', 3, '8-12', 75), x('renegade-row', 3, '8 / side', 60)],
  },
  {
    id: 'tpl-band-full', name: 'Resistance Band Circuit', level: 'Beginner', minutes: 25, color: 'orange', equipment: 'Resistance band',
    description: 'Joint-friendly strength work you can do anywhere with a single band.',
    exercises: [x('band-squat', 3, '15', 45), x('band-chest-press', 3, '12-15', 45), x('band-row', 3, '12-15', 45), x('band-kickback', 3, '12 / leg', 30), x('band-pull-apart', 3, '15-20', 30), x('band-curl', 2, '15', 30), x('band-tricep-extension', 2, '15', 30)],
  },
  {
    id: 'tpl-hiit', name: 'HIIT Express', level: 'Intermediate', minutes: 20, color: 'pink', equipment: 'No equipment',
    description: 'Short, intense conditioning intervals to raise your heart rate and burn calories.',
    exercises: [x('jumping-jack', 3, '45s', 20), x('burpee', 3, '10', 30), x('mountain-climber', 3, '30s', 20), x('jump-squat', 3, '12', 30), x('high-knees', 3, '30s', 20), x('bicycle-crunch', 3, '20', 30)],
  },
  {
    id: 'tpl-core', name: 'Core Strength', level: 'Beginner', minutes: 15, color: 'purple', equipment: 'Mat',
    description: 'A focused core finisher for stability, posture and a stronger midsection.',
    exercises: [x('plank', 3, '45s', 30), x('crunch', 3, '20', 30), x('russian-twist', 3, '20', 30), x('bicycle-crunch', 3, '20', 30), x('superman', 3, '12', 30)],
  },
  {
    id: 'tpl-bw-starter', name: 'Home Starter', level: 'Beginner', minutes: 25, color: 'teal', equipment: 'No equipment',
    description: 'Your first weeks of training: easier versions of the key movements to build a base.',
    exercises: [x('bodyweight-squat', 3, '12-15', 60), x('incline-push-up', 3, '8-12', 60), x('glute-bridge', 3, '12-15', 45), x('prone-y-raise', 3, '10-12', 45), x('reverse-lunge', 2, '8 / leg', 60), x('dead-bug', 3, '6 / side', 45)],
  },
  {
    id: 'tpl-bw-upper', name: 'Bodyweight Upper Body', level: 'Intermediate', minutes: 35, color: 'blue', equipment: 'No equipment',
    description: 'Chest, back, shoulders and arms with no equipment. A sturdy table covers the pulling.',
    exercises: [x('push-up', 4, '10-15', 75), x('inverted-row', 4, '8-12', 75), x('pike-push-up', 3, '8-10', 75), x('diamond-push-up', 3, '8-12', 60), x('prone-y-raise', 3, '12-15', 45), x('plank-shoulder-tap', 3, '10 / side', 45)],
  },
  {
    id: 'tpl-bw-lower', name: 'Bodyweight Legs & Glutes', level: 'Intermediate', minutes: 35, color: 'lime', equipment: 'No equipment',
    description: 'Single-leg work makes bodyweight hard enough to keep building your legs at home.',
    exercises: [x('split-squat', 3, '10-12 / leg', 60), x('single-leg-rdl', 3, '8-10 / leg', 60), x('lateral-lunge', 3, '8 / side', 60), x('single-leg-glute-bridge', 3, '10-12 / leg', 45), x('step-up', 3, '10 / leg', 60), x('single-leg-calf-raise', 3, '15 / leg', 30)],
  },
  {
    id: 'tpl-calisthenics', name: 'Advanced Calisthenics', level: 'Advanced', minutes: 45, color: 'purple', equipment: 'Pull-up bar',
    description: 'Hard bodyweight progressions for strength: archer push-ups, chin-ups, pistols and Nordics.',
    exercises: [x('archer-push-up', 4, '5-8 / side', 90), x('chin-up', 4, '6-10', 120), x('elevated-pike-push-up', 3, '6-10', 90), x('pistol-squat', 3, '5-8 / leg', 90), x('nordic-curl', 3, '3-6', 120), x('hollow-hold', 3, '30-40s', 45)],
  },
  {
    id: 'tpl-db-upper', name: 'Dumbbell Upper Body', level: 'Intermediate', minutes: 40, color: 'orange', equipment: 'Dumbbells',
    description: 'Push, pull and arms with a pair of dumbbells and the floor as your bench.',
    exercises: [x('db-floor-press', 4, '8-12', 90), x('db-bent-row', 4, '10-12', 75), x('arnold-press', 3, '8-12', 75), x('db-pullover', 3, '10-12', 60), x('hammer-curl', 3, '10-12', 60), x('db-tricep-kickback', 3, '12-15', 45)],
  },
  {
    id: 'tpl-db-lower', name: 'Dumbbell Legs & Glutes', level: 'Intermediate', minutes: 40, color: 'lime', equipment: 'Dumbbells',
    description: 'Squat, hinge and lunge patterns to build strong legs and glutes at home.',
    exercises: [x('goblet-squat', 4, '10-12', 90), x('db-rdl', 4, '10-12', 90), x('db-step-up', 3, '8-10 / leg', 75), x('walking-lunge', 3, '10 / leg', 75), x('db-glute-bridge', 3, '12-15', 60), x('calf-raise', 3, '15-20', 45)],
  },
  {
    id: 'tpl-band-upper', name: 'Band Upper Body', level: 'Beginner', minutes: 30, color: 'pink', equipment: 'Resistance band',
    description: 'A full upper-body session with one band and a door anchor.',
    exercises: [x('band-chest-press', 3, '12-15', 45), x('band-lat-pulldown', 3, '12-15', 45), x('band-overhead-press', 3, '12-15', 45), x('band-face-pull', 3, '15-20', 45), x('band-curl', 2, '15', 30), x('band-pushdown', 2, '15', 30)],
  },
  {
    id: 'tpl-hiit-advanced', name: 'Advanced HIIT', level: 'Advanced', minutes: 25, color: 'pink', equipment: 'No equipment',
    description: 'Explosive jumps and crawls with short rests. Only for when the basics feel easy.',
    exercises: [x('burpee', 4, '12', 30), x('tuck-jump', 4, '10', 30), x('jumping-lunge', 4, '8 / leg', 30), x('skater-jump', 4, '10 / side', 30), x('bear-crawl', 3, '30s', 30), x('v-up', 3, '12', 30)],
  },
  {
    id: 'tpl-core-advanced', name: 'Advanced Core', level: 'Advanced', minutes: 20, color: 'purple', equipment: 'Mat',
    description: 'Hollow holds, V-ups and anti-rotation work for a strong, stable midsection.',
    exercises: [x('hollow-hold', 3, '30-40s', 45), x('v-up', 3, '10-12', 45), x('lying-leg-raise', 3, '12-15', 45), x('side-plank', 3, '30-40s / side', 30), x('plank-shoulder-tap', 3, '12 / side', 30), x('flutter-kick', 3, '30s', 30)],
  },
  {
    id: 'tpl-db-power', name: 'Dumbbell Conditioning', level: 'Advanced', minutes: 30, color: 'orange', equipment: 'Dumbbells',
    description: 'Full-body power moves done back to back to build strength and fitness together.',
    exercises: [x('db-thruster', 4, '10', 60), x('db-snatch', 4, '6 / side', 60), x('db-clean-press', 3, '6-8', 75), x('renegade-row', 3, '8 / side', 60), x('db-woodchop', 3, '10 / side', 45)],
  },
];

export interface SplitPreset {
  id: string;
  name: string;
  description: string;
  routines: { key: string; name: string; color: AccentColor; exercises: TemplateExercise[] }[];
  /** Monday … Sunday → routine key or null for rest */
  days: (string | null)[];
}

export const SPLIT_PRESETS: SplitPreset[] = [
  {
    id: 'ppl', name: 'Push / Pull / Legs', description: '6 days · high frequency, ideal for intermediate lifters',
    routines: [
      { key: 'push', name: 'Push', color: 'orange', exercises: [x('bench-press', 4, '5-8', 150), x('overhead-press', 3, '6-8', 120), x('incline-db-press', 3, '8-12', 90), x('lateral-raise', 3, '12-15', 60), x('tricep-pushdown', 3, '10-12', 60)] },
      { key: 'pull', name: 'Pull', color: 'blue', exercises: [x('deadlift', 3, '3-5', 180), x('pull-up', 3, '6-10', 120), x('barbell-row', 3, '8-10', 90), x('face-pull', 3, '12-15', 60), x('barbell-curl', 3, '8-12', 60)] },
      { key: 'legs', name: 'Legs', color: 'lime', exercises: [x('back-squat', 4, '5-8', 180), x('romanian-deadlift', 3, '8-10', 120), x('leg-press', 3, '10-12', 90), x('leg-curl', 3, '10-12', 60), x('calf-raise', 4, '12-15', 60)] },
    ],
    days: ['push', 'pull', 'legs', 'push', 'pull', 'legs', null],
  },
  {
    id: 'ul', name: 'Upper / Lower', description: '4 days · balanced strength and size',
    routines: [
      { key: 'upper', name: 'Upper', color: 'blue', exercises: [x('bench-press', 4, '5-8', 150), x('barbell-row', 4, '6-10', 120), x('seated-db-press', 3, '8-12', 90), x('lat-pulldown', 3, '10-12', 90), x('hammer-curl', 2, '10-12', 60), x('skull-crusher', 2, '10-12', 60)] },
      { key: 'lower', name: 'Lower', color: 'lime', exercises: [x('back-squat', 4, '5-8', 180), x('romanian-deadlift', 3, '8-10', 120), x('bulgarian-split-squat', 3, '8-10 / leg', 90), x('leg-extension', 3, '12-15', 60), x('hanging-leg-raise', 3, '10-15', 60)] },
    ],
    days: ['upper', 'lower', null, 'upper', 'lower', null, null],
  },
  {
    id: 'fb', name: 'Full Body 3×', description: '3 days · perfect for beginners and busy weeks',
    routines: [
      { key: 'fa', name: 'Full Body A', color: 'purple', exercises: [x('back-squat', 3, '5-8', 150), x('bench-press', 3, '5-8', 150), x('barbell-row', 3, '8-10', 90), x('plank', 3, '45s', 45)] },
      { key: 'fb', name: 'Full Body B', color: 'teal', exercises: [x('deadlift', 3, '3-5', 180), x('overhead-press', 3, '6-8', 120), x('lat-pulldown', 3, '10-12', 90), x('walking-lunge', 3, '10 / leg', 90)] },
    ],
    days: ['fa', null, 'fb', null, 'fa', null, null],
  },
];
