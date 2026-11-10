import { useMemo, useState } from 'react';
import { calcTargets } from '@/domain/nutrition';
import { t } from '@/i18n';
import { navigate } from '@/lib/router';
import { useData } from '@/store/useData';
import { Segmented } from '@/ui/controls';
import { toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { AboutFields, ActivityPicker, BodyFields, GoalPicker, goalTip, TargetSummary } from './parts';
import { checkAbout, checkBody, convertDraft, initialDraft, parseDraft, savePlan, type PlanDraft } from './planForm';
import './nutrition.css';

const STEPS = ['goal', 'about', 'body', 'activity', 'result'] as const;

/**
 * First-run questionnaire: goal → about you → measurements → activity → targets.
 * Shown instead of the app until it is completed or skipped.
 */
export function Onboarding() {
  const units = useData((s) => s.settings.units);
  const language = useData((s) => s.settings.language);
  const updateSettings = useData((s) => s.updateSettings);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PlanDraft>(initialDraft);
  const set = (patch: Partial<PlanDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const name = STEPS[step];

  const parsed = useMemo(() => (name === 'result' ? parseDraft(draft, units) : null), [name, draft, units]);
  const targets = parsed?.ok ? calcTargets(parsed.value) : null;

  const canContinue =
    name === 'goal' ? draft.goal !== null
    : name === 'about' ? draft.sex !== null && draft.age !== ''
    : name === 'body' ? draft.height !== '' && draft.weight !== ''
    : name === 'activity' ? draft.activity !== null
    : targets !== null;

  const next = () => {
    const check = name === 'about' ? checkAbout(draft) : name === 'body' ? checkBody(draft, units) : null;
    if (check && !check.ok) return toast(check.error, 'error');
    if (name !== 'result') return setStep(step + 1);
    if (!parsed?.ok) return;
    savePlan(parsed.value);
    navigate('/nutrition');
  };

  const title = { goal: 'ob.goalTitle', about: 'ob.aboutTitle', body: 'ob.bodyTitle', activity: 'ob.activityTitle', result: 'ob.resultTitle' } as const;
  const sub = { goal: 'ob.goalSub', about: 'ob.aboutSub', body: 'ob.bodySub', activity: 'ob.activitySub', result: 'ob.resultSub' } as const;

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
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-label={t('ob.step', { step: step + 1, total: STEPS.length })}
          >
            {STEPS.map((s, i) => (
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
          <p className="ob-step">{t('ob.step', { step: step + 1, total: STEPS.length })}</p>
          <h1>{t(title[name])}</h1>
          <p className="ob-sub">{t(sub[name])}</p>

          {name === 'goal' && <GoalPicker value={draft.goal} onChange={(goal) => set({ goal })} />}
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
            {name === 'result' ? t('ob.finish') : t('ob.next')}
          </button>
          {step === 0 && (
            <button className="ob-skip" onClick={() => useData.getState().skipNutrition(true)}>
              {t('ob.skip')}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
