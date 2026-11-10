import { useMemo } from 'react';
import { ACTIVITY_LEVELS, GOALS, profileTargets, type Targets } from '@/domain/nutrition';
import type { ActivityLevel, NutritionGoal, UnitSystem } from '@/domain/types';
import { fmtNumber, lengthUnit, weightUnit } from '@/domain/units';
import { ltr, t } from '@/i18n';
import { useData } from '@/store/useData';
import { Icon, type IconName } from '@/ui/Icon';
import { cleanNumber, type PlanDraft } from './planForm';
import './nutrition.css';

export const GOAL_ICON: Record<NutritionGoal, IconName> = { lose: 'flame', muscle: 'dumbbell', maintain: 'scale', gain: 'chart' };
export const ACTIVITY_ICON: Record<ActivityLevel, IconName> = { sedentary: 'clock', light: 'user', moderate: 'timer', very: 'bolt' };

export const MACROS = [
  { key: 'protein', label: 'nut.protein', color: 'var(--blue)' },
  { key: 'carbs', label: 'nut.carbs', color: 'var(--orange)' },
  { key: 'fat', label: 'nut.fat', color: 'var(--purple)' },
] as const;

export const kcal = (v: number) => `${fmtNumber(v, 0)} ${t('unit.kcal')}`;
export const grams = (v: number) => `${fmtNumber(v, 0)} ${t('unit.g')}`;

/** Current targets, derived from the saved plan and the latest weigh-in. */
export function useTargets(): Targets | null {
  const profile = useData((s) => s.nutrition);
  const latest = useData((s) => s.bodyWeights[0]?.weight ?? null);
  return useMemo(() => (profile ? profileTargets(profile, latest) : null), [profile, latest]);
}

/** One-line explanation of how the calorie target relates to maintenance. */
export function planLine(goal: NutritionGoal, targets: Targets): string {
  const diff = Math.abs(targets.calories - targets.tdee);
  if (diff === 0) return goal === 'lose' ? t('nut.planMinor') : t('nut.planMaintain');
  const vars = { diff: fmtNumber(diff, 0) };
  if (goal === 'lose') return t('nut.planLose', vars);
  if (goal === 'muscle') return t('nut.planMuscle', vars);
  return t('nut.planGain', vars);
}

export const goalTip = (goal: NutritionGoal) =>
  t(goal === 'lose' ? 'nut.tipLose' : goal === 'muscle' ? 'nut.tipMuscle' : goal === 'gain' ? 'nut.tipGain' : 'nut.tipMaintain');

/** Large tappable options with an icon, title and description. */
function ChoiceList<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; icon: IconName; title: string; text: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="choices" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={`choice ${o.value === value ? 'is-on' : ''}`} onClick={() => onChange(o.value)}>
          <span className="choice-icon">
            <Icon name={o.icon} size={20} stroke={2.2} />
          </span>
          <span className="choice-main">
            <strong>{o.title}</strong>
            <span>{o.text}</span>
          </span>
          <span className="choice-check">{o.value === value && <Icon name="check" size={14} stroke={3.4} />}</span>
        </button>
      ))}
    </div>
  );
}

export function GoalPicker({ value, onChange }: { value: NutritionGoal | null; onChange: (v: NutritionGoal) => void }) {
  return (
    <ChoiceList
      label={t('nut.goal')}
      value={value}
      onChange={onChange}
      options={GOALS.map((g) => ({ value: g, icon: GOAL_ICON[g], title: t(`goal.${g}`), text: t(`goal.${g}Sub`) }))}
    />
  );
}

export function ActivityPicker({ value, onChange }: { value: ActivityLevel | null; onChange: (v: ActivityLevel) => void }) {
  return (
    <ChoiceList
      label={t('nut.activity')}
      value={value}
      onChange={onChange}
      options={ACTIVITY_LEVELS.map((a) => ({ value: a, icon: ACTIVITY_ICON[a], title: t(`act.${a}`), text: t(`act.${a}Sub`) }))}
    />
  );
}

/** Labelled number input with a unit suffix. */
export function NumField({
  label,
  hint,
  unit,
  value,
  onChange,
  decimal = true,
  placeholder,
  autoFocus,
}: {
  label: string;
  hint?: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="numfield">
      <span className="numfield-label">
        {label}
        {hint && <em>{hint}</em>}
      </span>
      <span className="numfield-box">
        <input
          className="num"
          dir="ltr"
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={value}
          placeholder={placeholder ?? '0'}
          autoFocus={autoFocus}
          onChange={(e) => onChange(cleanNumber(e.target.value, decimal).slice(0, 6))}
          aria-label={`${label} (${unit})`}
        />
        <i>{unit}</i>
      </span>
    </label>
  );
}

type SetDraft = (patch: Partial<PlanDraft>) => void;

export function AboutFields({ draft, set }: { draft: PlanDraft; set: SetDraft }) {
  return (
    <>
      <div className="numfield">
        <span className="numfield-label">{t('nut.gender')}</span>
        <div className="pillpair" role="radiogroup" aria-label={t('nut.gender')}>
          {(['male', 'female'] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={draft.sex === s} className={draft.sex === s ? 'is-on' : ''} onClick={() => set({ sex: s })}>
              {t(`nut.${s}`)}
            </button>
          ))}
        </div>
      </div>
      <NumField label={t('nut.age')} unit={t('nut.years')} value={draft.age} decimal={false} onChange={(v) => set({ age: v.slice(0, 3) })} />
    </>
  );
}

export function BodyFields({ draft, set, units }: { draft: PlanDraft; set: SetDraft; units: UnitSystem }) {
  return (
    <>
      {units === 'metric' ? (
        <NumField label={t('nut.height')} unit={lengthUnit(units)} value={draft.height} onChange={(v) => set({ height: v })} />
      ) : (
        <div className="numfield-pair">
          <NumField label={t('nut.height')} unit={t('unit.ft')} value={draft.height} decimal={false} onChange={(v) => set({ height: v.slice(0, 1) })} />
          <NumField label={' '} unit={t('unit.in')} value={draft.heightIn} onChange={(v) => set({ heightIn: v })} />
        </div>
      )}
      <NumField label={t('nut.weight')} unit={weightUnit(units)} value={draft.weight} onChange={(v) => set({ weight: v })} />
      <NumField label={t('nut.targetWeight')} hint={t('nut.optional')} unit={weightUnit(units)} value={draft.target} placeholder="–" onChange={(v) => set({ target: v })} />
    </>
  );
}

/** Calorie figure plus the three macro targets, used for the onboarding result and plan preview. */
export function TargetSummary({ targets, goal }: { targets: Targets; goal: NutritionGoal }) {
  return (
    <div className="targets">
      <div className="targets-kcal">
        <span className="eyebrow">{t('nut.dailyCalories')}</span>
        <strong className="num">
          {fmtNumber(targets.calories, 0)}
          <small>{t('unit.kcal')}</small>
        </strong>
        <p>{planLine(goal, targets)}</p>
      </div>
      <div className="targets-macros">
        {MACROS.map((m) => (
          <div key={m.key} style={{ ['--c' as string]: m.color }}>
            <i />
            <span>{t(m.label)}</span>
            <strong className="num">
              {fmtNumber(targets[m.key], 0)}
              <small>{t('unit.g')}</small>
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Progress bar for one macro: consumed vs target with what is left. */
export function MacroBar({ label, color, value, target, compact }: { label: string; color: string; value: number; target: number; compact?: boolean }) {
  const over = value > target;
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const rest = Math.abs(target - value);
  return (
    <div className={`macro ${compact ? 'is-compact' : ''}`} style={{ ['--c' as string]: color }}>
      <div className="macro-head">
        <span className="macro-name">{label}</span>
        <span className="macro-nums num">
          {ltr(`${fmtNumber(value, 0)} / ${fmtNumber(target, 0)}`)} {t('unit.g')}
        </span>
      </div>
      <div className="macro-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.round(value)}>
        <i className={over ? 'is-over' : ''} style={{ width: `${pct * 100}%` }} />
      </div>
      {!compact && <div className={`macro-foot ${over ? 'is-over' : ''}`}>{t(over ? 'nut.overBy' : 'nut.left', { amount: grams(rest) })}</div>}
    </div>
  );
}
