import { useMemo, useState } from 'react';
import { localizePreset } from '@/data/localize';
import { SPLIT_PRESETS } from '@/data/templates';
import { weekdayLetter } from '@/domain/dates';
import { calcTargets } from '@/domain/nutrition';
import { t } from '@/i18n';
import type { OnboardingStep } from '@/lib/onboarding';
import { navigate } from '@/lib/router';
import { useData } from '@/store/useData';
import { Segmented } from '@/ui/controls';
import { toast } from '@/ui/dialogs';
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
  const [presetId, setPresetId] = useState<string | null>(null);
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
    : name === 'split' ? presetId !== null
    : targets !== null;

  const next = () => {
    const check = name === 'about' ? checkAbout(draft) : name === 'body' ? checkBody(draft, units) : null;
    if (check && !check.ok) return toast(check.error, 'error');
    if (!isLast) return setStep(step + 1);
    if (name === 'result' && !parsed?.ok) return;
    // Save the split first: saving nutrition last is what lets the app open.
    const preset = SPLIT_PRESETS.find((p) => p.id === presetId);
    if (steps.includes('split') && preset) useData.getState().applySplitPreset(localizePreset(preset));
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
          {name === 'split' && <SplitPicker value={presetId} onChange={setPresetId} />}
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

/** The training programs, each with its week at a glance (training days lit). */
function SplitPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const presets = useMemo(() => SPLIT_PRESETS.map(localizePreset), []);
  return (
    <div className="choices" role="radiogroup" aria-label={t('ob.splitTitle')}>
      {presets.map((p) => {
        const on = p.id === value;
        return (
          <button key={p.id} type="button" role="radio" aria-checked={on} className={`choice ${on ? 'is-on' : ''}`} onClick={() => onChange(p.id)}>
            <span className="choice-icon">
              <Icon name="calendar" size={20} stroke={2.2} />
            </span>
            <span className="choice-main">
              <strong>{p.name}</strong>
              <span>{p.description}</span>
              <span className="split-week" aria-hidden="true">
                {p.days.map((d, i) => (
                  <i key={i} className={d ? 'is-on' : ''}>
                    {weekdayLetter(i)}
                  </i>
                ))}
              </span>
            </span>
            <span className="choice-check">{on && <Icon name="check" size={14} stroke={3.4} />}</span>
          </button>
        );
      })}
    </div>
  );
}
