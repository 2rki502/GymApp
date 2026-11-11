import { useMemo, useState } from 'react';
import { localizePreset } from '@/data/localize';
import { SPLIT_PRESETS, type SplitPreset } from '@/data/templates';
import { weekdayIndex, weekdayLetter, weekdayName } from '@/domain/dates';
import { customPreset, startOn, trainingDayCount } from '@/domain/schedule';
import { calcTargets } from '@/domain/nutrition';
import { t } from '@/i18n';
import type { OnboardingStep } from '@/lib/onboarding';
import { navigate } from '@/lib/router';
import { useData } from '@/store/useData';
import { Segmented } from '@/ui/controls';
import { actionSheet, toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { AboutFields, ActivityPicker, BodyFields, GoalPicker, goalTip, TargetSummary } from './parts';
import { checkAbout, checkBody, convertDraft, initialDraft, parseDraft, savePlan, type PlanDraft } from './planForm';
import './nutrition.css';

/**
 * First-run questionnaire: goal → training split → about you → measurements → activity → targets.
 * Shown instead of the app until it is complete; there is no skip, because the app is built
 * around a plan. `steps` is only what this user still needs (e.g. just the split).
 */
export function Onboarding({ steps }: { steps: OnboardingStep[] }) {
  const units = useData((s) => s.settings.units);
  const language = useData((s) => s.settings.language);
  const updateSettings = useData((s) => s.updateSettings);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PlanDraft>(initialDraft);
  // The training plan: which program was picked, and the actual week (Monday-first) it maps to.
  const [presetId, setPresetId] = useState<string | null>(null);
  const [week, setWeek] = useState<(string | null)[]>(EMPTY_WEEK);
  const presets = useMemo(() => SPLIT_PRESETS.map(localizePreset), []);
  const pickPlan = (id: string) => {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    // Day 1 of the program starts today, not on whatever weekday the template assumed.
    setWeek(p ? startOn(p.days, weekdayIndex(new Date())) : EMPTY_WEEK);
    // The week planner appears below the cards, off-screen on a phone: bring it into view
    // so people see they can adjust the days before continuing.
    requestAnimationFrame(() => {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.querySelector('.week-plan')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  };
  const set = (patch: Partial<PlanDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const name = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;

  const parsed = useMemo(() => (name === 'result' ? parseDraft(draft, units) : null), [name, draft, units]);
  const targets = parsed?.ok ? calcTargets(parsed.value) : null;

  const canContinue =
    name === 'goal' ? draft.goal !== null
    : name === 'about' ? draft.sex !== null && draft.age !== ''
    : name === 'body' ? draft.height !== '' && draft.weight !== ''
    : name === 'activity' ? draft.activity !== null
    : name === 'split' ? presetId !== null && trainingDayCount(week) > 0
    : targets !== null;

  const next = () => {
    const check = name === 'about' ? checkAbout(draft) : name === 'body' ? checkBody(draft, units) : null;
    if (check && !check.ok) return toast(check.error, 'error');
    if (!isLast) return setStep(step + 1);
    if (name === 'result' && !parsed?.ok) return;
    // Save the split first: saving nutrition last is what lets the app open.
    if (steps.includes('split') && presetId) {
      const base = presets.find((p) => p.id === presetId);
      // Save the week as the user arranged it; only the workouts it actually uses are created.
      const plan: SplitPreset = base ? customPreset(week, [base], base.name) : customPreset(week, presets, t('ob.myPlan'));
      useData.getState().applySplitPreset(plan);
    }
    if (name === 'result' && parsed?.ok) savePlan(parsed.value);
    // Land on Home, where today's workout from the chosen split is waiting.
    navigate('/');
  };

  const title = { goal: 'ob.goalTitle', split: 'ob.splitTitle', about: 'ob.aboutTitle', body: 'ob.bodyTitle', activity: 'ob.activityTitle', result: 'ob.resultTitle' } as const;
  const sub = { goal: 'ob.goalSub', split: 'ob.splitSub', about: 'ob.aboutSub', body: 'ob.bodySub', activity: 'ob.activitySub', result: 'ob.resultSub' } as const;

  return (
    <div className="ob">
      <div className="ob-inner">
        <header className="ob-top">
          <button className="ob-back" onClick={() => setStep(step - 1)} disabled={step === 0} aria-label={t('common.back')}>
            <Icon name="chevronLeft" size={24} stroke={2.4} />
          </button>
          <div
            className="ob-progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={step + 1}
            aria-label={t('ob.step', { step: step + 1, total: steps.length })}
          >
            {steps.map((s, i) => (
              <i key={s} className={i <= step ? 'is-on' : ''} />
            ))}
          </div>
          {/* Switching language remounts the app, so it is only offered before any answers are typed. */}
          <button
            className="ob-lang"
            style={step === 0 ? undefined : { visibility: 'hidden' }}
            onClick={() => updateSettings({ language: language === 'en' ? 'ar' : 'en' })}
            aria-label={t('pf.language')}
          >
            <Icon name="globe" size={17} />
            {language === 'en' ? 'ع' : 'EN'}
          </button>
        </header>

        <main className="ob-body" key={name}>
          <p className="ob-step">{t('ob.step', { step: step + 1, total: steps.length })}</p>
          <h1>{t(title[name])}</h1>
          <p className="ob-sub">{t(sub[name])}</p>

          {name === 'goal' && <GoalPicker value={draft.goal} onChange={(goal) => set({ goal })} />}
          {name === 'split' && (
            <>
              <SplitPicker presets={presets} value={presetId} onChange={pickPlan} />
              {presetId && (
                <WeekPlanner
                  week={week}
                  onChange={setWeek}
                  options={presetId === CUSTOM ? allWorkouts(presets) : presets.find((p) => p.id === presetId)!.routines}
                />
              )}
            </>
          )}
          {name === 'about' && (
            <div className="ob-fields">
              <AboutFields draft={draft} set={set} />
            </div>
          )}
          {name === 'body' && (
            <div className="ob-fields">
              <div className="numfield">
                <span className="numfield-label">{t('nut.units')}</span>
                <Segmented
                  value={units}
                  onChange={(v) => {
                    setDraft((d) => convertDraft(d, units, v));
                    updateSettings({ units: v });
                  }}
                  options={[
                    { value: 'metric', label: t('pf.metric') },
                    { value: 'imperial', label: t('pf.imperial') },
                  ]}
                />
              </div>
              <BodyFields draft={draft} set={set} units={units} />
            </div>
          )}
          {name === 'activity' && <ActivityPicker value={draft.activity} onChange={(activity) => set({ activity })} />}
          {name === 'result' && targets && parsed?.ok && (
            <>
              <TargetSummary targets={targets} goal={parsed.value.goal} />
              <p className="ob-tip">
                <Icon name="bolt" size={16} /> {goalTip(parsed.value.goal)}
              </p>
              <p className="ob-note">{t('nut.method')}</p>
            </>
          )}
        </main>

        <footer className="ob-foot">
          <button className="btn btn-primary btn-block" disabled={!canContinue} onClick={next}>
            {!isLast ? t('ob.next') : name === 'result' ? t('ob.finish') : t('ob.finishSplit')}
          </button>
        </footer>
      </div>
    </div>
  );
}

const CUSTOM = 'custom';
const EMPTY_WEEK: (string | null)[] = [null, null, null, null, null, null, null];

/** Every template workout, once each: the building blocks for a custom week. */
function allWorkouts(presets: SplitPreset[]): SplitPreset['routines'] {
  const seen = new Set<string>();
  return presets.flatMap((p) => p.routines).filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));
}

/** The programs plus "Build my own". Each card's strip shows the week as it would start today. */
function SplitPicker({ presets, value, onChange }: { presets: SplitPreset[]; value: string | null; onChange: (id: string) => void }) {
  const today = weekdayIndex(new Date());
  const options = [
    ...presets.map((p) => ({ id: p.id, icon: 'calendar' as const, title: p.name, text: p.description, days: startOn(p.days, today) })),
    { id: CUSTOM, icon: 'edit' as const, title: t('ob.custom'), text: t('ob.customSub'), days: null },
  ];
  return (
    <div className="choices" role="radiogroup" aria-label={t('ob.splitTitle')}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} className={`choice ${on ? 'is-on' : ''}`} onClick={() => onChange(o.id)}>
            <span className="choice-icon">
              <Icon name={o.icon} size={20} stroke={2.2} />
            </span>
            <span className="choice-main">
              <strong>{o.title}</strong>
              <span>{o.text}</span>
              {o.days && (
                <span className="split-week" aria-hidden="true">
                  {o.days.map((d, i) => (
                    <i key={i} className={`${d ? 'is-on' : ''} ${i === today ? 'is-today' : ''}`}>
                      {weekdayLetter(i)}
                    </i>
                  ))}
                </span>
              )}
            </span>
            <span className="choice-check">{on && <Icon name="check" size={14} stroke={3.4} />}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The next 7 days, starting today. Tap a day to choose its workout or make it a rest day.
 * `week` is stored Monday-first (the app's format); rows are shown in the order you'll live them.
 */
function WeekPlanner({
  week,
  options,
  onChange,
}: {
  week: (string | null)[];
  options: SplitPreset['routines'];
  onChange: (w: (string | null)[]) => void;
}) {
  const today = weekdayIndex(new Date());
  const byKey = new Map(options.map((o) => [o.key, o]));
  const setDay = (idx: number, key: string | null) => onChange(week.map((d, i) => (i === idx ? key : d)));
  const count = trainingDayCount(week);

  return (
    <section className="week-plan" aria-label={t('ob.yourWeek')}>
      <div className="week-plan-head">
        <h2>{t('ob.yourWeek')}</h2>
        <span className="num">{t('ob.daysCount', { n: count })}</span>
      </div>
      <p className="week-plan-hint">{t('ob.weekHint')}</p>
      <ul>
        {Array.from({ length: 7 }, (_, k) => {
          const idx = (today + k) % 7;
          const label = k === 0 ? t('common.today') : k === 1 ? t('ob.tomorrow') : weekdayName(idx);
          const r = week[idx] ? byKey.get(week[idx]!) : undefined;
          const workout = r ? r.name : t('ob.rest');
          return (
            <li key={idx}>
              <button
                type="button"
                className={`week-row ${r ? `is-train color-${r.color}` : ''}`}
                aria-label={t('ob.dayAria', { day: label, workout })}
                onClick={() =>
                  actionSheet({
                    title: label,
                    actions: [
                      ...options.map((o) => ({ label: o.name, onSelect: () => setDay(idx, o.key) })),
                      { label: t('ob.rest'), onSelect: () => setDay(idx, null) },
                    ],
                  })
                }
              >
                <span className="week-day">
                  <strong>{label}</strong>
                  {k < 2 && <span>{weekdayName(idx)}</span>}
                </span>
                <span className="week-workout">
                  <i aria-hidden="true" />
                  {workout}
                </span>
                <Icon name="chevronRight" size={16} stroke={2.4} className="week-chev" />
              </button>
            </li>
          );
        })}
      </ul>
      {count === 0 && <p className="week-plan-warn">{t('ob.needDay')}</p>}
    </section>
  );
}
