import { useMemo } from 'react';
import { GROUP_LABEL, MUSCLE_LABEL } from '@/data/exercises';
import { formatShortDate } from '@/domain/dates';
import { exerciseHistory } from '@/domain/metrics';
import { addExercises } from '@/domain/workoutOps';
import { fmtWeight } from '@/domain/units';
import type { Exercise } from '@/domain/types';
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
        <ExerciseAnimation anim={ex.anim} className="guide-anim" />
        <div className="guide-tags">
          <span className="badge">{GROUP_LABEL[ex.group]}</span>
          {ex.equipment.slice(0, 2).map((q) => (
            <span key={q} className="badge badge-muted">
              {q}
            </span>
          ))}
        </div>
      </div>

      <div className="guide-facts">
        <div>
          <label>Sets</label>
          <span className="num">{ex.recommended.sets}</span>
        </div>
        <div>
          <label>{ex.kind === 'time' ? 'Duration' : 'Reps'}</label>
          <span className="num">{ex.recommended.reps}</span>
        </div>
        <div>
          <label>Rest</label>
          <span className="num">{ex.recommended.restSec}s</span>
        </div>
      </div>

      <section className="guide-block">
        <h3>Muscles worked</h3>
        <div className="muscle-tags">
          {ex.primary.map((m) => (
            <span key={m} className="muscle-tag is-primary">
              {MUSCLE_LABEL(m)}
            </span>
          ))}
          {ex.secondary.map((m) => (
            <span key={m} className="muscle-tag">
              {MUSCLE_LABEL(m)}
            </span>
          ))}
        </div>
        <p className="guide-legend">
          <span className="dot" style={{ background: 'var(--accent-fg)' }} /> Primary <span className="dot" style={{ background: 'var(--surface-3)', marginLeft: 10 }} /> Secondary
        </p>
      </section>

      {ex.equipment.length > 0 && (
        <section className="guide-block">
          <h3>Equipment</h3>
          <p className="muted">{ex.equipment.join(' · ')}</p>
        </section>
      )}

      {ex.instructions.length > 0 && (
        <section className="guide-block">
          <h3>How to perform</h3>
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
          <h3>Common mistakes</h3>
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
          <h3>Your history</h3>
          {history.length === 0 ? (
            <p className="muted">You haven't logged this exercise yet.</p>
          ) : (
            <button className="card card-tappable guide-history" onClick={() => navigate(`/progress/exercise/${ex.id}`)}>
              <div>
                <label>Sessions</label>
                <span className="num">{history.length}</span>
              </div>
              <div>
                <label>Last</label>
                <span className="num">{formatShortDate(last.date)}</span>
              </div>
              <div>
                <label>{ex.kind === 'weight' ? 'Heaviest' : ex.kind === 'time' ? 'Longest' : 'Most reps'}</label>
                <span className="num">
                  {ex.kind === 'weight' ? fmtWeight(best?.weight ?? 0, units) : ex.kind === 'time' ? `${best?.duration ?? 0}s` : best?.reps ?? 0}
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
        toast(`Added to ${session.name}`, 'success');
      }}
    >
      Add
    </button>
  ) : ex.custom ? (
    <button
      className="nav-btn"
      aria-label="Delete exercise"
      onClick={async () => {
        if (!(await confirm({ title: `Delete ${ex.name}?`, confirmLabel: 'Delete', destructive: true }))) return;
        if (deleteCustom(ex.id)) {
          toast('Exercise deleted');
          goBack('/library');
        } else toast('It is used in your workouts or routines, so it can’t be deleted.', 'error');
      }}
    >
      <Icon name="trash" />
    </button>
  ) : null;

  return (
    <Screen title={ex.name} back={{ label: 'Library', to: '/library' }} right={right}>
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
    <Sheet open={!!ex} onClose={() => set({ peekExercise: null })} title={ex?.name} full right={<button className="nav-btn is-strong" onClick={() => set({ peekExercise: null })}>Done</button>}>
      {ex && <ExerciseGuide ex={ex} compact />}
    </Sheet>
  );
}
