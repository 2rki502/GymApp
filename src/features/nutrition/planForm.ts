/**
 * Form state shared by onboarding and the "Edit Plan" sheet. Fields are kept as the
 * text the user typed (in their display units) and parsed into canonical kg / cm.
 */
import { toLocalDate } from '@/domain/dates';
import { ageFromBirthYear, LIMITS, type TargetInput } from '@/domain/nutrition';
import type { ActivityLevel, NutritionGoal, Sex, UnitSystem } from '@/domain/types';
import { CM_PER_IN, fmtNumber, fromDisplayWeight, parseDecimal, toDisplayWeight } from '@/domain/units';
import { t } from '@/i18n';
import { useData } from '@/store/useData';

export interface PlanDraft {
  goal: NutritionGoal | null;
  sex: Sex | null;
  age: string;
  /** cm (metric) or feet (imperial) */
  height: string;
  /** extra inches (imperial only) */
  heightIn: string;
  weight: string;
  target: string;
  activity: ActivityLevel | null;
}

export interface PlanValues extends TargetInput {
  targetKg: number | null;
}

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

/** Keep digits and one decimal separator; accept Arabic-Indic digits from Arabic keyboards. */
export function cleanNumber(s: string, decimal = true): string {
  const latin = s.replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) & 0xf)).replace(/[٫،]/g, '.');
  return latin.replace(decimal ? /[^\d.,]/g : /\D/g, '');
}

const num = (v: number, dp = 1) => fmtNumber(v, dp).replace(/,/g, '');

function heightText(cm: number, units: UnitSystem): Pick<PlanDraft, 'height' | 'heightIn'> {
  if (units === 'metric') return { height: num(cm, 0), heightIn: '' };
  const totalIn = Math.round(cm / CM_PER_IN);
  return { height: String(Math.floor(totalIn / 12)), heightIn: String(totalIn % 12) };
}

function heightCm(d: PlanDraft, units: UnitSystem): number | null {
  const a = parseDecimal(d.height);
  if (a === null) return null;
  if (units === 'metric') return a;
  return (a * 12 + (parseDecimal(d.heightIn) ?? 0)) * CM_PER_IN;
}

/** Draft pre-filled from what the app already knows (saved plan, latest weigh-in, goal weight). */
export function initialDraft(): PlanDraft {
  const { nutrition: p, bodyWeights, settings } = useData.getState();
  const units = settings.units;
  const weightKg = bodyWeights[0]?.weight ?? p?.weightKg ?? null;
  return {
    goal: p?.goal ?? null,
    sex: p?.sex ?? null,
    age: p ? String(ageFromBirthYear(p.birthYear)) : '',
    ...(p ? heightText(p.heightCm, units) : { height: '', heightIn: '' }),
    weight: weightKg ? num(toDisplayWeight(weightKg, units)) : '',
    target: settings.goalWeight ? num(toDisplayWeight(settings.goalWeight, units)) : '',
    activity: p?.activity ?? null,
  };
}

/** Re-express the typed values when the user switches unit system mid-form. */
export function convertDraft(d: PlanDraft, from: UnitSystem, to: UnitSystem): PlanDraft {
  if (from === to) return d;
  const cm = heightCm(d, from);
  const conv = (s: string) => {
    const v = parseDecimal(s);
    return v === null ? '' : num(toDisplayWeight(fromDisplayWeight(v, from), to));
  };
  return { ...d, ...(cm ? heightText(cm, to) : { height: '', heightIn: '' }), weight: conv(d.weight), target: conv(d.target) };
}

type Check = { ok: true } | { ok: false; error: string };
const fail = (error: string): Check => ({ ok: false, error });

export function checkAbout(d: PlanDraft): Check {
  const age = parseDecimal(d.age);
  if (!d.sex || age === null || !Number.isInteger(age) || age < LIMITS.age.min || age > LIMITS.age.max) {
    return fail(t('nut.errAge', LIMITS.age));
  }
  return { ok: true };
}

export function checkBody(d: PlanDraft, units: UnitSystem): Check {
  const cm = heightCm(d, units);
  if (cm === null || cm < LIMITS.heightCm.min || cm > LIMITS.heightCm.max) return fail(t('nut.errHeight'));
  const w = parseDecimal(d.weight);
  const kg = w === null ? null : fromDisplayWeight(w, units);
  if (kg === null || kg < LIMITS.weightKg.min || kg > LIMITS.weightKg.max) return fail(t('nut.errWeight'));
  if (d.target.trim() !== '') {
    const tv = parseDecimal(d.target);
    const tkg = tv === null ? null : fromDisplayWeight(tv, units);
    if (tkg === null || tkg < LIMITS.weightKg.min || tkg > LIMITS.weightKg.max) return fail(t('nut.errTarget'));
  }
  return { ok: true };
}

/** Parse a complete draft, or return the first problem. */
export function parseDraft(d: PlanDraft, units: UnitSystem): { ok: true; value: PlanValues } | { ok: false; error: string } {
  for (const c of [checkAbout(d), checkBody(d, units)]) if (!c.ok) return c;
  if (!d.goal || !d.sex || !d.activity) return { ok: false, error: t('nut.errAge', LIMITS.age) };
  const tv = d.target.trim() === '' ? null : parseDecimal(d.target);
  return {
    ok: true,
    value: {
      goal: d.goal,
      sex: d.sex,
      age: parseDecimal(d.age)!,
      heightCm: heightCm(d, units)!,
      weightKg: fromDisplayWeight(parseDecimal(d.weight)!, units),
      activity: d.activity,
      targetKg: tv === null ? null : fromDisplayWeight(tv, units),
    },
  };
}

/** Save the plan. The weight also becomes today's weigh-in, so Progress and nutrition agree. */
export function savePlan(v: PlanValues) {
  const s = useData.getState();
  s.saveNutrition({
    goal: v.goal,
    sex: v.sex,
    birthYear: new Date().getFullYear() - v.age,
    heightCm: v.heightCm,
    weightKg: v.weightKg,
    activity: v.activity,
  });
  const latest = s.bodyWeights[0];
  if (!latest || Math.abs(latest.weight - v.weightKg) > 0.05) s.logBodyWeight(toLocalDate(), v.weightKg);
  if (v.targetKg !== s.settings.goalWeight) s.updateSettings({ goalWeight: v.targetKg });
}
