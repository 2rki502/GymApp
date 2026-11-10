import { describe, expect, it } from 'vitest';
import { bmr, calcTargets, kcalFromMacros, mealForHour, profileTargets, recentFoods, sumIntake, type TargetInput } from './nutrition';
import type { FoodEntry } from './types';

const base: TargetInput = { goal: 'maintain', sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate' };
const food = (over: Partial<FoodEntry>): FoodEntry => ({
  id: 'x', date: '2026-11-10', meal: 'lunch', name: 'Rice', kcal: 200, protein: 4, carbs: 44, fat: 1, createdAt: '2026-11-10T12:00:00Z', ...over,
});

describe('calorie targets', () => {
  it('uses the Mifflin-St Jeor equation', () => {
    expect(bmr('male', 80, 180, 30)).toBe(1780); // 800 + 1125 - 150 + 5
    expect(bmr('female', 60, 165, 25)).toBeCloseTo(1345.25); // 600 + 1031.25 - 125 - 161
  });

  it('scales maintenance by activity level', () => {
    expect(calcTargets(base).tdee).toBe(2760); // 1780 x 1.55 = 2759
    expect(calcTargets({ ...base, activity: 'sedentary' }).tdee).toBe(2140);
    expect(calcTargets({ ...base, activity: 'very' }).tdee).toBe(3070);
  });

  it('adjusts calories for each goal', () => {
    const tdee = 1780 * 1.55;
    expect(calcTargets(base).calories).toBe(2760);
    expect(calcTargets({ ...base, goal: 'lose' }).calories).toBe(Math.round((tdee * 0.8) / 10) * 10);
    expect(calcTargets({ ...base, goal: 'muscle' }).calories).toBe(Math.round((tdee * 1.1) / 10) * 10);
    expect(calcTargets({ ...base, goal: 'gain' }).calories).toBe(Math.round((tdee * 1.15) / 10) * 10);
  });

  it('gives different people different targets', () => {
    const a = calcTargets({ ...base, goal: 'lose' });
    const b = calcTargets({ goal: 'lose', sex: 'female', age: 45, heightCm: 160, weightKg: 62, activity: 'light' });
    expect(a.calories).not.toBe(b.calories);
    expect(a.protein).not.toBe(b.protein);
  });

  it('never sets a deficit below the safe minimum', () => {
    const small = calcTargets({ goal: 'lose', sex: 'female', age: 60, heightCm: 150, weightKg: 45, activity: 'sedentary' });
    expect(small.calories).toBeGreaterThanOrEqual(Math.min(1200, small.tdee));
    expect(small.calories).toBeLessThanOrEqual(small.tdee);
  });

  it('does not prescribe a deficit under 18', () => {
    const teen = calcTargets({ ...base, goal: 'lose', age: 16 });
    expect(teen.calories).toBe(teen.tdee);
  });
});

describe('macro targets', () => {
  it('sets protein from body weight and fat from calories', () => {
    const t = calcTargets({ ...base, goal: 'lose' }); // 2210 kcal
    expect(t.calories).toBe(2210);
    expect(t.protein).toBe(160); // 2.0 g/kg x 80 kg
    expect(t.fat).toBe(60); // 25% of 2210 / 9 = 61
    expect(t.carbs).toBe(260); // (2210 - 640 - 540) / 4 = 257.5
  });

  it('adds up to the calorie target within rounding', () => {
    for (const goal of ['lose', 'muscle', 'maintain', 'gain'] as const) {
      for (const weightKg of [45, 70, 100, 160]) {
        const t = calcTargets({ ...base, goal, weightKg });
        expect(Math.abs(kcalFromMacros(t.protein, t.carbs, t.fat) - t.calories)).toBeLessThanOrEqual(30);
        expect(t.carbs).toBeGreaterThan(0);
      }
    }
  });

  it('keeps protein realistic at high body weight', () => {
    const t = calcTargets({ ...base, goal: 'lose', weightKg: 160 });
    expect(t.protein).toBeLessThanOrEqual(200); // capped at BMI-30 reference weight (97 kg)
  });
});

describe('profiles and intake', () => {
  const profile = { goal: 'lose', sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activity: 'moderate', updatedAt: '' } as const;
  const now = new Date(2026, 10, 10);

  it('recalculates when the latest weigh-in changes', () => {
    expect(profileTargets(profile, null, now).calories).toBe(2210);
    expect(profileTargets(profile, 75, now).calories).toBeLessThan(2210);
    expect(profileTargets(profile, 75, now).protein).toBe(150);
  });

  it('sums a day and derives calories from macros', () => {
    expect(sumIntake([food({}), food({ kcal: 300, protein: 30, carbs: 0, fat: 20 })])).toEqual({ kcal: 500, protein: 34, carbs: 44, fat: 21 });
    expect(kcalFromMacros(30, 40, 10)).toBe(370);
  });

  it('lists recent foods once each, newest first', () => {
    const log = [
      food({ id: 'a', name: 'Rice', createdAt: '2026-11-08T10:00:00Z' }),
      food({ id: 'b', name: 'Eggs', createdAt: '2026-11-09T10:00:00Z' }),
      food({ id: 'c', name: 'rice ', createdAt: '2026-11-10T10:00:00Z' }),
    ];
    expect(recentFoods(log).map((e) => e.id)).toEqual(['c', 'b']);
  });

  it('picks a meal from the time of day', () => {
    expect([8, 13, 19, 23].map(mealForHour)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
  });
});
