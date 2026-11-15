import { describe, expect, it } from 'vitest';
import { searchBuiltIn } from '@/domain/food';
import { ar } from '@/i18n/ar';
import { en } from '@/i18n/en';
import { FOODS } from './foods';

describe('built-in common foods (USDA)', () => {
  it('have unique ids and names in both languages', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    for (const f of FOODS) {
      expect(f.name.length, f.id).toBeGreaterThan(2);
      expect(/[؀-ۿ]/.test(f.nameAr), f.id).toBe(true);
      expect(f.servings.length, f.id).toBeGreaterThan(0);
    }
  });

  it('label every serving size in English and Arabic', () => {
    for (const f of FOODS)
      for (const s of f.servings) {
        expect((en as Record<string, unknown>)[`serv.${s.key}`], `${f.id} ${s.key}`).toBeDefined();
        expect((ar as Record<string, unknown>)[`serv.${s.key}`], `${f.id} ${s.key}`).toBeDefined();
        expect(s.amount, `${f.id} ${s.key}`).toBeGreaterThan(0);
      }
  });

  it('have calories that agree with their macros (catches a garbled value)', () => {
    for (const f of FOODS) {
      const { kcal, protein, carbs, fat } = f.per100;
      const fromMacros = protein * 4 + carbs * 4 + fat * 9;
      if (kcal < 20) continue; // coffee, tea, greens: rounding dominates
      // USDA uses food-specific energy factors and counts fiber in carbs, so fruit and vegetables
      // sit up to ~29% below the plain 4/4/9 estimate (spinach). A swapped or per-serving value
      // would be off by far more than 30%.
      expect(Math.abs(fromMacros - kcal) / kcal, `${f.id}: ${kcal} kcal vs ${fromMacros.toFixed(0)} from macros`).toBeLessThan(0.3);
    }
  });

  it('answer real searches in both languages', () => {
    const first = (q: string) => searchBuiltIn(q, FOODS)[0]?.id;
    expect(first('pepsi')).toBe('cola');
    expect(first('بيبسي')).toBe('cola');
    expect(first('chicken')).toBe('chicken-breast');
    expect(searchBuiltIn('خبز', FOODS).map((f) => f.id)).toContain('pita-white');
    expect(searchBuiltIn('تمر', FOODS).map((f) => f.id)).toEqual(expect.arrayContaining(['dates', 'dates-medjool']));
    expect(first('laban')).toBe('laban');
  });
});
