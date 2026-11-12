import { afterEach, describe, expect, it } from 'vitest';
import { EXERCISES } from '@/data/exercises';
import { AR_EQUIPMENT, AR_EXERCISES, AR_MUSCLES, AR_PRESETS, AR_PRESET_ROUTINES, AR_TEMPLATES } from '@/data/exercises.ar';
import { fmtReps, localizeExercise, localizePreset } from '@/data/localize';
import { HOME_ROUTINES, SPLIT_PRESETS } from '@/data/templates';
import { formatDuration, formatLongDate, formatShortDate } from '@/domain/dates';
import { weightUnit } from '@/domain/units';
import { ar } from './ar';
import { en } from './en';
import { setLang, t } from './index';

afterEach(() => setLang('en'));

describe('dictionaries', () => {
  it('Arabic covers every English key with the same placeholders', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const e = en[key];
      const a = ar[key];
      expect(a, key).toBeDefined();
      const ph = (s: unknown) => [...JSON.stringify(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((v, i, arr) => arr.indexOf(v) === i).sort();
      // Arabic may drop {n} in forms like "one"/"two" (the word implies the number).
      expect(ph(a).filter((p) => p !== 'n'), key).toEqual(ph(e).filter((p) => p !== 'n'));
      expect(typeof a === 'string', key).toBe(typeof e === 'string');
    }
  });

  it('selects Arabic plural forms', () => {
    setLang('ar');
    expect(t('n.sets', { n: 1 })).toBe('مجموعة واحدة');
    expect(t('n.sets', { n: 2 })).toBe('مجموعتان');
    expect(t('n.sets', { n: 5 })).toBe('5 مجموعات');
    expect(t('n.sets', { n: 12 })).toBe('12 مجموعة');
    expect(t('n.exercises', { n: 11 })).toBe('11 تمرينا');
  });

  it('shows Arabic without diacritics (the UI font cannot position them)', () => {
    setLang('ar');
    const marks = /[ً-ْٰ]/;
    for (const key of Object.keys(ar) as (keyof typeof ar)[]) {
      for (const n of [0, 1, 2, 5, 11, 100]) expect(marks.test(t(key, { n })), key).toBe(false);
    }
    for (const e of EXERCISES) {
      const loc = localizeExercise(e);
      expect(marks.test([loc.name, ...loc.instructions, ...loc.mistakes].join(' ')), e.id).toBe(false);
    }
  });

  it('interpolates and falls back to English', () => {
    expect(t('custom.created', { name: 'Curl' })).toBe('Curl created');
    setLang('ar');
    expect(t('custom.created', { name: 'Curl' })).toBe('تم إنشاء Curl');
  });
});

describe('Arabic content', () => {
  it('translates every exercise with matching structure', () => {
    for (const e of EXERCISES) {
      const tr = AR_EXERCISES[e.id];
      expect(tr, e.id).toBeDefined();
      expect(tr[1].length, `${e.id} instructions`).toBe(e.instructions.length);
      expect(tr[2].length, `${e.id} mistakes`).toBe(e.mistakes.length);
      expect(/[؀-ۿ]/.test(tr[0]), `${e.id} name is Arabic`).toBe(true);
    }
    expect(Object.keys(AR_EXERCISES).sort()).toEqual(EXERCISES.map((e) => e.id).sort());
  });

  it('translates every muscle, equipment item, template and preset', () => {
    for (const e of EXERCISES) {
      for (const m of [...e.primary, ...e.secondary]) expect(AR_MUSCLES[m], m).toBeDefined();
      for (const q of e.equipment) expect(AR_EQUIPMENT[q], q).toBeDefined();
    }
    for (const tpl of HOME_ROUTINES) {
      expect(AR_TEMPLATES[tpl.id], tpl.id).toBeDefined();
      expect(AR_EQUIPMENT[tpl.equipment], tpl.equipment).toBeDefined();
    }
    for (const p of SPLIT_PRESETS) {
      expect(AR_PRESETS[p.id], p.id).toBeDefined();
      for (const r of p.routines) expect(AR_PRESET_ROUTINES[r.key], r.key).toBeDefined();
    }
  });

  it('localises exercises and presets only in Arabic', () => {
    const bench = EXERCISES.find((e) => e.id === 'bench-press')!;
    expect(localizeExercise(bench).name).toBe('Barbell Bench Press');
    setLang('ar');
    expect(localizeExercise(bench).name).toBe('بنش برس بالبار');
    expect(localizePreset(SPLIT_PRESETS[0]).routines.map((r) => r.name)).toEqual(['دفع', 'سحب', 'أرجل']);
  });

  it('formats rep targets, units and dates', () => {
    setLang('ar');
    expect(fmtReps('10-12 / leg')).toBe('10-12 لكل ساق');
    expect(fmtReps('8 / side')).toBe('8 لكل جهة');
    expect(fmtReps('30-60s')).toBe('30-60 ث');
    expect(fmtReps('8-12')).toBe('8-12');
    expect(weightUnit('metric')).toBe('كغ');
    expect(formatShortDate('2026-11-07')).toBe('7 نوفمبر');
    expect(formatDuration(3725)).toBe('1 س 2 د');
    expect(formatLongDate(new Date())).toBe('اليوم');
  });
});

describe('"+N more exercises" in Arabic', () => {
  it('agrees with the number', () => {
    setLang('ar');
    expect(t('n.moreExercises', { n: 1 })).toBe('وتمرين آخر');
    expect(t('n.moreExercises', { n: 2 })).toBe('وتمرينان آخران');
    expect(t('n.moreExercises', { n: 3 })).toBe('و3 تمارين أخرى');
    expect(t('n.moreExercises', { n: 11 })).toBe('و11 تمرينا آخر');
  });
});
