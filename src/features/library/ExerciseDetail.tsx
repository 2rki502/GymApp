import { useMemo } from 'react';
import { equipmentLabel, fmtReps, groupLabel, muscleLabel } from '@/data/localize';
import { formatShortDate } from '@/domain/dates';
import { exerciseHistory } from '@/domain/metrics';
import { addExercises } from '@/domain/workoutOps';
import { fmtWeight } from '@/domain/units';
import type { Exercise, ExerciseVideo } from '@/domain/types';
import { t } from '@/i18n';
import { goBack, navigate } from '@/lib/router';
import { useExerciseLookup, usePRs } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { confirm, toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { ExerciseAnimation } from './figure/Figure';
import './library.css';

/** Exercise guide content, shared by the library route and the in-session peek sheet. */
export function ExerciseGuide({ ex, compact }: { ex: Exercise; compact?: boolean }) {
  const workouts = useData((s) => s.workouts);
  const units = useData((s) => s.settings.units);
  const { bests } = usePRs();
  const history = useMemo(() => exerciseHistory(workouts, ex.id, ex.kind), [workouts, ex]);
  const best = bests.get(ex.id);
  const last = history[history.length - 1];

  return (
    <div className="guide">
      <div className="guide-hero">
        {ex.video ? <ExerciseVideoPlayer video={ex.video} label={ex.name} /> : <ExerciseAnimation anim={ex.anim} className="guide-anim" />}
        <div className="guide-tags">
          <span className="badge">{groupLabel(ex.group)}</span>
          {ex.equipment.slice(0, 2).map((q) => (
            <span key={q} className="badge badge-muted">
              {equipmentLabel(q)}
            </span>
          ))}
        </div>
      </div>

      <div className="guide-facts">
        <div>
          <label>{t('guide.sets')}</label>
          <span className="num">{ex.recommended.sets}</span>
        </div>
        <div>
          <label>{ex.kind === 'time' ? t('guide.duration') : t('guide.reps')}</label>
          <span className="num">{fmtReps(ex.recommended.reps)}</span>
        </div>
        <div>
          <label>{t('guide.rest')}</label>
          <span className="num">{t('time.seconds', { n: ex.recommended.restSec })}</span>
        </div>
      </div>

      <section className="guide-block">
        <h3>{t('guide.muscles')}</h3>
        <div className="muscle-tags">
          {ex.primary.map((m) => (
            <span key={m} className="muscle-tag is-primary">
              {muscleLabel(m)}
            </span>
          ))}
          {ex.secondary.map((m) => (
            <span key={m} className="muscle-tag">
              {muscleLabel(m)}
            </span>
          ))}
        </div>
        <p className="guide-legend">
          <span className="dot" style={{ background: 'var(--accent-fg)' }} /> {t('guide.primary')}{' '}
          <span className="dot" style={{ background: 'var(--surface-3)', marginInlineStart: 10 }} /> {t('guide.secondary')}
        </p>
      </section>

      {ex.equipment.length > 0 && (
        <section className="guide-block">
          <h3>{t('guide.equipment')}</h3>
          <p className="muted">{ex.equipment.map(equipmentLabel).join(' · ')}</p>
        </section>
      )}

      {ex.instructions.length > 0 && (
        <section className="guide-block">
          <h3>{t('guide.how')}</h3>
          <ol className="steps">
            {ex.instructions.map((s, i) => (
              <li key={i}>
                <span className="step-n num">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {ex.mistakes.length > 0 && (
        <section className="guide-block">
          <h3>{t('guide.mistakes')}</h3>
          <ul className="mistakes">
            {ex.mistakes.map((m, i) => (
              <li key={i}>
                <Icon name="warning" size={16} />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!compact && (
        <section className="guide-block">
          <h3>{t('guide.history')}</h3>
          {history.length === 0 ? (
            <p className="muted">{t('guide.notYet')}</p>
          ) : (
            <button className="card card-tappable guide-history" onClick={() => navigate(`/progress/exercise/${ex.id}`)}>
              <div>
                <label>{t('stat.sessions')}</label>
                <span className="num">{history.length}</span>
              </div>
              <div>
                <label>{t('guide.last')}</label>
                <span className="num">{formatShortDate(last.date)}</span>
              </div>
              <div>
                <label>{ex.kind === 'weight' ? t('guide.heaviest') : ex.kind === 'time' ? t('guide.longest') : t('guide.mostReps')}</label>
                <span className="num">
                  {ex.kind === 'weight'
                    ? fmtWeight(best?.weight ?? 0, units)
                    : ex.kind === 'time'
                      ? t('time.seconds', { n: best?.duration ?? 0 })
                      : best?.reps ?? 0}
                </span>
              </div>
              <Icon name="chevronRight" size={18} className="faint" />
            </button>
          )}
        </section>
      )}
    </div>
  );
}

export function ExerciseDetailScreen({ id }: { id: string }) {
  const lookup = useExerciseLookup();
  const ex = lookup(id);
  const session = useData((s) => s.session);
  const updateSession = useData((s) => s.updateSession);
  const deleteCustom = useData((s) => s.deleteCustomExercise);
  const defaultRest = useData((s) => s.settings.defaultRestSec);

  const right = session ? (
    <button
      className="nav-btn is-strong"
      onClick={() => {
        updateSession((w) => addExercises(w, [ex.id], ex.recommended.restSec || defaultRest));
        toast(t('guide.addedTo', { name: session.name }), 'success');
      }}
    >
      {t('common.add')}
    </button>
  ) : ex.custom ? (
    <button
      className="nav-btn"
      aria-label={t('guide.deleteAria')}
      onClick={async () => {
        if (!(await confirm({ title: t('guide.deleteTitle', { name: ex.name }), confirmLabel: t('common.delete'), destructive: true }))) return;
        if (deleteCustom(ex.id)) {
          toast(t('guide.deleted'));
          goBack('/library');
        } else toast(t('guide.inUse'), 'error');
      }}
    >
      <Icon name="trash" />
    </button>
  ) : null;

  return (
    <Screen title={ex.name} back={{ label: t('lib.title'), to: '/library' }} right={right}>
      <h1 className="guide-title">{ex.name}</h1>
      <ExerciseGuide ex={ex} />
    </Screen>
  );
}

/** Exercise guide in a sheet, opened from a live session without leaving it. */
export function ExercisePeekSheet() {
  const id = useUI((s) => s.peekExercise);
  const set = useUI((s) => s.set);
  const lookup = useExerciseLookup();
  const ex = id ? lookup(id) : null;
  return (
    <Sheet
      open={!!ex}
      onClose={() => set({ peekExercise: null })}
      title={ex?.name}
      full
      right={
        <button className="nav-btn is-strong" onClick={() => set({ peekExercise: null })}>
          {t('common.done')}
        </button>
      }
    >
      {ex && <ExerciseGuide ex={ex} compact />}
    </Sheet>
  );
}

/** Demo video: still frame until the user presses play; nothing downloads before that. */
function ExerciseVideoPlayer({ video, label }: { video: ExerciseVideo; label: string }) {
  return (
    <figure className="guide-video">
      <video src={video.src} poster={video.poster} controls playsInline loop preload="none" aria-label={label} />
      <figcaption>
        {t('ex.videoBy')}{' '}
        <a href={video.creditUrl} target="_blank" rel="noopener noreferrer">
          {video.credit}
        </a>
      </figcaption>
    </figure>
  );
}
