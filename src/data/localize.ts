/**
 * Localised views of the built-in data (exercise library, templates, presets).
 * Stored user data keeps stable ids; only display text is translated, so
 * switching language never changes or migrates anything that was saved.
 */
import type { Exercise, ExerciseGroup, Muscle } from '@/domain/types';
import { getLang, plainArabic, t, type Lang } from '@/i18n';
import { AR_EQUIPMENT, AR_EXERCISES, AR_GROUPS, AR_MUSCLES, AR_PRESET_ROUTINES, AR_PRESETS, AR_TEMPLATES } from './exercises.ar';
import { EXERCISES, GROUP_LABEL, MUSCLE_LABEL } from './exercises';
import type { RoutineTemplate, SplitPreset } from './templates';

const EN_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));
const cache = new Map<Lang, Map<string, Exercise>>();

export function localizeExercise(ex: Exercise): Exercise {
  const lang = getLang();
  if (lang === 'en' || ex.custom) return ex;
  let byLang = cache.get(lang);
  if (!byLang) {
    byLang = new Map();
    cache.set(lang, byLang);
  }
  const hit = byLang.get(ex.id);
  if (hit) return hit;
  const tr = AR_EXERCISES[ex.id];
  const out = tr ? { ...ex, name: plainArabic(tr[0]), instructions: tr[1].map(plainArabic), mistakes: tr[2].map(plainArabic) } : ex;
  byLang.set(ex.id, out);
  return out;
}

/** English name of a library exercise (search works in both languages). */
export const englishName = (id: string) => EN_BY_ID.get(id)?.name ?? '';

export const muscleLabel = (m: Muscle | string) => (getLang() === 'ar' ? plainArabic(AR_MUSCLES[m as Muscle] ?? m) : MUSCLE_LABEL(m));
export const groupLabel = (g: ExerciseGroup) => (getLang() === 'ar' ? plainArabic(AR_GROUPS[g]) : GROUP_LABEL[g]);
export const equipmentLabel = (e: string) => (getLang() === 'ar' ? plainArabic(AR_EQUIPMENT[e] ?? e) : e);

/** Rep targets like "8-12", "10-12 / leg", "30-60s", "8 / side". */
export function fmtReps(reps: string): string {
  if (getLang() === 'en') return reps;
  const leg = /^(.+?)\s*\/\s*leg$/i.exec(reps);
  if (leg) return t('reps.perLeg', { r: fmtReps(leg[1]) });
  const side = /^(.+?)\s*\/\s*side$/i.exec(reps);
  if (side) return t('reps.perSide', { r: fmtReps(side[1]) });
  const sec = /^([\d–-]+)s$/.exec(reps);
  if (sec) return t('reps.sec', { r: sec[1] });
  return reps;
}

export function localizeTemplate(tpl: RoutineTemplate): RoutineTemplate {
  if (getLang() === 'en') return tpl;
  const tr = AR_TEMPLATES[tpl.id];
  return {
    ...tpl,
    name: plainArabic(tr?.[0] ?? tpl.name),
    description: plainArabic(tr?.[1] ?? tpl.description),
    equipment: equipmentLabel(tpl.equipment),
  };
}

export function localizePreset(p: SplitPreset): SplitPreset {
  if (getLang() === 'en') return p;
  const tr = AR_PRESETS[p.id];
  return {
    ...p,
    name: plainArabic(tr?.[0] ?? p.name),
    description: plainArabic(tr?.[1] ?? p.description),
    routines: p.routines.map((r) => ({ ...r, name: plainArabic(AR_PRESET_ROUTINES[r.key] ?? r.name) })),
  };
}

export const levelLabel = (level: RoutineTemplate['level']) => t(`level.${level}`);
