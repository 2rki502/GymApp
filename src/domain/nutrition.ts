/**
 * Personalised calorie and macronutrient targets. Pure functions, no storage.
 *
 * Method:
 *  1. Resting energy (BMR) from the Mifflin-St Jeor equation, the most accurate of the
 *     common predictive equations for healthy adults.
 *  2. Maintenance calories (TDEE) = BMR x a standard activity factor.
 *  3. A goal adjustment as a percentage of maintenance, so it scales with body size.
 *  4. Protein from body weight (g per kg), fat as a share of calories, carbohydrate
 *     from the calories that remain.
 */
import type { ActivityLevel, FoodEntry, LocalDate, Meal, NutritionGoal, NutritionProfile, Sex } from './types';

export const GOALS: NutritionGoal[] = ['lose', 'muscle', 'maintain', 'gain'];
export const ACTIVITY_LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'very'];
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

/** Calorie change relative to maintenance. */
export const GOAL_ADJUST: Record<NutritionGoal, number> = {
  lose: -0.2,
  muscle: 0.1,
  maintain: 0,
  gain: 0.15,
};

/** Protein in grams per kg of body weight. */
export const PROTEIN_PER_KG: Record<NutritionGoal, number> = {
  lose: 2.0,
  muscle: 2.0,
  maintain: 1.6,
  gain: 1.8,
};

/** Share of calories from fat. */
export const FAT_SHARE: Record<NutritionGoal, number> = {
  lose: 0.25,
  muscle: 0.25,
  maintain: 0.3,
  gain: 0.3,
};

/** Commonly used lower limits for unsupervised dieting. */
export const MIN_CALORIES: Record<Sex, number> = { male: 1500, female: 1200 };

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export const LIMITS = {
  age: { min: 14, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 300 },
} as const;

export interface TargetInput {
  goal: NutritionGoal;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
}

export interface Targets {
  /** Resting energy, kcal/day */
  bmr: number;
  /** Maintenance calories, kcal/day */
  tdee: number;
  calories: number;
  /** grams */
  protein: number;
  carbs: number;
  fat: number;
}

export interface Intake {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Mifflin-St Jeor resting energy expenditure (kcal/day). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function calcTargets(p: TargetInput): Targets {
  const rest = bmr(p.sex, p.weightKg, p.heightCm, p.age);
  const tdee = rest * ACTIVITY_FACTOR[p.activity];

  // Under-18s are still growing: never prescribe a deficit.
  const adjust = p.goal === 'lose' && p.age < 18 ? 0 : GOAL_ADJUST[p.goal];
  let kcal = tdee * (1 + adjust);
  // A deficit never goes below the safe minimum (or above maintenance, for small bodies).
  if (adjust < 0) kcal = Math.min(tdee, Math.max(kcal, MIN_CALORIES[p.sex]));
  const calories = roundTo(kcal, 10);

  // For protein, cap the reference weight at BMI 30 so targets stay realistic at high body weights.
  const hm = p.heightCm / 100;
  const refWeight = Math.min(p.weightKg, 30 * hm * hm);
  // Protein stays within 35% of calories so there is always room for fat and carbohydrate.
  const proteinG = Math.min(PROTEIN_PER_KG[p.goal] * refWeight, (0.35 * calories) / KCAL_PER_G.protein);
  const protein = roundTo(proteinG, 5);
  const fat = roundTo((FAT_SHARE[p.goal] * calories) / KCAL_PER_G.fat, 5);
  const carbs = Math.max(0, roundTo((calories - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs, 5));

  return { bmr: Math.round(rest), tdee: roundTo(tdee, 10), calories, protein, carbs, fat };
}

export const ageFromBirthYear = (birthYear: number, now = new Date()) => now.getFullYear() - birthYear;

/** Targets for a saved profile. `latestWeightKg` (most recent weigh-in) overrides the profile weight. */
export function profileTargets(profile: NutritionProfile, latestWeightKg?: number | null, now = new Date()): Targets {
  return calcTargets({
    goal: profile.goal,
    sex: profile.sex,
    age: ageFromBirthYear(profile.birthYear, now),
    heightCm: profile.heightCm,
    weightKg: latestWeightKg ?? profile.weightKg,
    activity: profile.activity,
  });
}

export const emptyIntake = (): Intake => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

export function sumIntake(entries: FoodEntry[]): Intake {
  return entries.reduce<Intake>(
    (t, e) => ({ kcal: t.kcal + e.kcal, protein: t.protein + e.protein, carbs: t.carbs + e.carbs, fat: t.fat + e.fat }),
    emptyIntake(),
  );
}

export const entriesOn = (log: FoodEntry[], date: LocalDate) =>
  log.filter((e) => e.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/** Calories implied by macros (4/4/9), used when the user leaves calories blank. */
export const kcalFromMacros = (protein: number, carbs: number, fat: number) =>
  Math.round(protein * KCAL_PER_G.protein + carbs * KCAL_PER_G.carbs + fat * KCAL_PER_G.fat);

/** Distinct foods logged before, most recent first, for one-tap re-logging. */
export function recentFoods(log: FoodEntry[], limit = 8): FoodEntry[] {
  const seen = new Set<string>();
  const out: FoodEntry[] = [];
  for (const e of [...log].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = e.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** Default meal for the current time of day. */
export function mealForHour(hour: number): Meal {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 22) return 'dinner';
  return 'snack';
}
