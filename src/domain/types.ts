/**
 * Core domain model. Every persisted entity has a string `id` so records can be
 * synced to a backend later without remapping. Weights are always stored in kg
 * and lengths in cm; conversion happens only at the UI boundary (see units.ts).
 */

export type ID = string;

/** ISO date `YYYY-MM-DD` in the user's local timezone. */
export type LocalDate = string;

export type LibrarySection = 'gym' | 'home';

export type GymGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'abs' | 'fullbody';
export type HomeGroup = 'bodyweight' | 'dumbbell' | 'band' | 'noequipment';
export type ExerciseGroup = GymGroup | HomeGroup | 'custom';

/** How an exercise is logged. */
export type ExerciseKind = 'weight' | 'reps' | 'time';

export type Muscle =
  | 'chest' | 'upper chest' | 'front delts' | 'side delts' | 'rear delts' | 'triceps' | 'biceps'
  | 'forearms' | 'lats' | 'upper back' | 'traps' | 'lower back' | 'abs' | 'obliques'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'adductors' | 'hip flexors' | 'cardio';

export interface Exercise {
  id: ID;
  name: string;
  section: LibrarySection | 'custom';
  group: ExerciseGroup;
  kind: ExerciseKind;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: string[];
  /** Animation pattern id (see data/animations). */
  anim?: string;
  instructions: string[];
  mistakes: string[];
  recommended: { sets: number; reps: string; restSec: number };
  custom?: boolean;
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface SetLog {
  id: ID;
  type: SetType;
  /** kg; `null` = not entered. For `reps` kind this is optional added load. */
  weight: number | null;
  reps: number | null;
  /** seconds, for `time` kind */
  duration: number | null;
  done: boolean;
}

export interface ExerciseLog {
  id: ID;
  exerciseId: ID;
  restSec: number;
  note?: string;
  sets: SetLog[];
}

export interface Workout {
  id: ID;
  name: string;
  routineId?: ID;
  startedAt: string; // ISO datetime
  endedAt: string | null;
  note?: string;
  exercises: ExerciseLog[];
}

export interface RoutineExercise {
  id: ID;
  exerciseId: ID;
  sets: number;
  reps: string; // e.g. "8-12" or "30s"
  restSec: number;
  /** optional target load in kg */
  weight?: number;
}

export interface Routine {
  id: ID;
  name: string;
  note?: string;
  color: AccentColor;
  exercises: RoutineExercise[];
  createdAt: string;
  updatedAt: string;
}

export type AccentColor = 'lime' | 'blue' | 'orange' | 'pink' | 'purple' | 'teal';

/** Weekly split: index 0 = Monday … 6 = Sunday; `null` = rest day. */
export interface Split {
  id: ID;
  name: string;
  days: (ID | null)[];
}

export interface BodyWeightEntry {
  id: ID;
  date: LocalDate;
  weight: number; // kg
}

export const MEASUREMENT_KEYS = [
  'chest', 'waist', 'hips', 'shoulders', 'neck', 'leftArm', 'rightArm', 'leftThigh', 'rightThigh', 'calves', 'bodyFat',
] as const;
export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number];

export interface MeasurementEntry {
  id: ID;
  date: LocalDate;
  /** cm, except bodyFat which is % */
  values: Partial<Record<MeasurementKey, number>>;
}

export type PhotoPose = 'front' | 'side' | 'back';

export interface ProgressPhotoMeta {
  id: ID;
  date: LocalDate;
  pose: PhotoPose;
  createdAt: string;
  width: number;
  height: number;
}

export type UnitSystem = 'metric' | 'imperial';
export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  name: string;
  units: UnitSystem;
  theme: ThemePref;
  weeklyGoal: number;
  defaultRestSec: number;
  restSound: boolean;
  goalWeight: number | null; // kg
  activeSplitId: ID | null;
  createdAt: string;
}

export type PRKind = 'weight' | 'e1rm' | 'reps' | 'duration';

export interface PREvent {
  workoutId: ID;
  exerciseId: ID;
  setId: ID;
  date: string;
  kind: PRKind;
  value: number;
  previous: number | null;
  weight: number | null;
  reps: number | null;
}
