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

/** Difficulty, shared by exercises and routine templates. */
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';

/** How an exercise is logged. */
export type ExerciseKind = 'weight' | 'reps' | 'time';

export type Muscle =
  | 'chest' | 'upper chest' | 'front delts' | 'side delts' | 'rear delts' | 'triceps' | 'biceps'
  | 'forearms' | 'lats' | 'upper back' | 'traps' | 'lower back' | 'abs' | 'obliques'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'adductors' | 'hip flexors' | 'cardio';

export interface ExerciseVideo {
  src: string;
  /** still frame used as the thumbnail and before playback */
  poster: string;
  credit: string;
  creditUrl: string;
}

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
  /** Demo video; when present it replaces the animated figure. */
  video?: ExerciseVideo;
  instructions: string[];
  mistakes: string[];
  recommended: { sets: number; reps: string; restSec: number };
  /** Library exercises only (see data/exerciseMeta.ts). */
  level?: Level;
  /** Body area it trains. For gym exercises this is the same as `group`. */
  area?: GymGroup;
  /** Where it is listed in the Home library: its own group, or a gym exercise you can do at home. */
  homeGroup?: HomeGroup;
  /** Swaps when you lack the equipment or need it easier/harder, best first. */
  alternatives?: ID[];
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
  /** The routine's target ("5-8" → 5 reps, "45s" → 45 s): the hint when there is no history yet. */
  targetReps?: number;
  targetSec?: number;
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
export type Language = 'en' | 'ar';

export interface Settings {
  name: string;
  units: UnitSystem;
  theme: ThemePref;
  language: Language;
  weeklyGoal: number;
  defaultRestSec: number;
  restSound: boolean;
  goalWeight: number | null; // kg
  activeSplitId: ID | null;
  createdAt: string;
}

// ─── Nutrition ───────────────────────────────────────────────────────────────

export type NutritionGoal = 'lose' | 'muscle' | 'maintain' | 'gain';
export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very';

/**
 * What the calorie and macro targets are calculated from. Targets themselves are
 * never stored: they are derived (see domain/nutrition.ts), so changing any answer
 * or logging a new body weight updates them immediately.
 */
export interface NutritionProfile {
  goal: NutritionGoal;
  sex: Sex;
  /** Stored instead of age so it stays correct over time. */
  birthYear: number;
  heightCm: number;
  /** kg. Fallback only: the latest body-weight entry wins when there is one. */
  weightKg: number;
  activity: ActivityLevel;
  updatedAt: string;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodEntry {
  id: ID;
  date: LocalDate;
  meal: Meal;
  name: string;
  kcal: number;
  /** grams */
  protein: number;
  carbs: number;
  fat: number;
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
