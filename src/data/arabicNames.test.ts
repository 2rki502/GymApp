import { describe, expect, it } from 'vitest';
import { AR_EXERCISES, AR_MUSCLES, AR_PRESETS } from './exercises.ar';

/**
 * Arabic exercise names should be what people actually say in the gym: the borrowed
 * English name where that is the norm (ديدليفت), real Arabic where it is (العقلة).
 * This pins the names a fluent speaker flagged, and bans the literal translations.
 */
const NAMES: Record<string, string> = {
  deadlift: 'ديدليفت',
  'romanian-deadlift': 'ديدليفت روماني',
  'db-rdl': 'ديدليفت روماني بالدمبل',
  'bench-press': 'بنش برس بالبار',
  'incline-db-press': 'بنش مائل بالدمبل',
  'cable-crossover': 'كروس أوفر بالكيبل',
  'chest-dip': 'المتوازي للصدر',
  'chair-dip': 'ديبس على الكرسي',
  'lat-pulldown': 'السحب العالي',
  'seated-cable-row': 'السحب الأرضي بالكيبل',
  'face-pull': 'فيس بول',
  'overhead-press': 'ضغط الأكتاف بالبار',
  'front-raise': 'الرفرفة الأمامية',
  'barbell-curl': 'بايسبس بالبار',
  'db-curl': 'بايسبس بالدمبل',
  'band-curl': 'بايسبس بشريط المقاومة',
  'hammer-curl': 'بايسبس هامر',
  'tricep-pushdown': 'ترايسبس بوش داون',
  'overhead-tricep-extension': 'ترايسبس خلف الرأس',
  'band-tricep-extension': 'ترايسبس خلف الرأس بالشريط',
  'back-squat': 'السكوات بالبار',
  'hip-thrust': 'هيب ثرست بالبار',
  'power-clean': 'باور كلين',
  'kettlebell-swing': 'كيتل بيل سوينغ',
  'glute-bridge': 'جسر الأرداف',
  'wall-sit': 'كرسي الحائط',
  'goblet-squat': 'جوبلت سكوات',
  'renegade-row': 'رينيجيد رو',
  'band-kickback': 'كيك باك بالشريط',
  'jumping-jack': 'جامبينغ جاك',
  'russian-twist': 'روسيان تويست',
};

// Literal translations that read badly to a native speaker.
const BANNED = ['الميتة', 'المميتة', 'الكأس', 'الكلين القوي', 'القفز المفتوح', 'الالتفاف الروسي', 'المؤخرة', 'الغطس', 'ثني المطرقة', 'الجلوس على الحائط'];

describe('Arabic exercise names', () => {
  it('uses the names lifters actually say', () => {
    for (const [id, name] of Object.entries(NAMES)) expect(AR_EXERCISES[id]?.[0], id).toBe(name);
  });

  it('has no literal translations left, in names or instructions', () => {
    for (const [id, [name, steps, mistakes]] of Object.entries(AR_EXERCISES))
      for (const text of [name, ...steps, ...mistakes])
        for (const bad of BANNED) expect(text.includes(bad), `${id}: "${bad}" in "${text}"`).toBe(false);
  });

  it('names muscles the way a gym-goer would', () => {
    expect(AR_MUSCLES.glutes).toBe('الأرداف');
    expect(AR_MUSCLES.lats).toBe('المجانص');
    expect(AR_MUSCLES.adductors).toBe('الفخذ الداخلي');
    expect(AR_MUSCLES.cardio).toBe('الكارديو');
  });

  it('does not use "تكرار" (reps) to mean training frequency', () => {
    expect(AR_PRESETS.ppl[1].includes('تكرار')).toBe(false);
  });
});
