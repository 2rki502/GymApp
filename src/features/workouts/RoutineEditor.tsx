import { useState } from 'react';
import { uid } from '@/domain/id';
import type { AccentColor, Routine, RoutineExercise } from '@/domain/types';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { ExerciseThumb } from '@/features/library/figure/Figure';
import { startRoutine } from '@/features/session/actions';
import { goBack } from '@/lib/router';
import { useExerciseLookup } from '@/store/selectors';
import { useData } from '@/store/useData';
import { EmptyState, Stepper } from '@/ui/controls';
import { confirm, toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { formatClock } from '@/domain/dates';
import './workouts.css';

const COLORS: AccentColor[] = ['lime', 'blue', 'orange', 'pink', 'purple', 'teal'];

export function RoutineEditorScreen({ id }: { id: string }) {
  const existing = useData((s) => s.routines.find((r) => r.id === id));
  const save = useData((s) => s.saveRoutine);
  const del = useData((s) => s.deleteRoutine);
  const lookup = useExerciseLookup();
  const isNew = id === 'new' || !existing;
  const [draft, setDraft] = useState<Routine>(
    () =>
      existing ?? {
        id: uid(),
        name: '',
        color: 'lime',
        exercises: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
  );
  const [picking, setPicking] = useState(false);
  const [dirty, setDirty] = useState(false);

  const patch = (p: Partial<Routine>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };
  const patchEx = (exId: string, p: Partial<RoutineExercise>) =>
    patch({ exercises: draft.exercises.map((e) => (e.id === exId ? { ...e, ...p } : e)) });
  const move = (i: number, d: -1 | 1) => {
    const list = [...draft.exercises];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    patch({ exercises: list });
  };

  const valid = draft.name.trim().length > 0 && draft.exercises.length > 0;
  const onSave = () => {
    if (!draft.name.trim()) return toast('Give your routine a name', 'error');
    if (!draft.exercises.length) return toast('Add at least one exercise', 'error');
    save({ ...draft, name: draft.name.trim() });
    toast(isNew ? 'Routine created' : 'Routine saved', 'success');
    goBack('/workouts');
  };
  const onCancel = async () => {
    if (dirty && !(await confirm({ title: 'Discard changes?', confirmLabel: 'Discard', destructive: true }))) return;
    goBack('/workouts');
  };

  return (
    <Screen
      title={isNew ? 'New Routine' : 'Edit Routine'}
      left={<button className="nav-btn" onClick={onCancel}>Cancel</button>}
      right={<button className="nav-btn is-strong" onClick={onSave} disabled={!valid}>Save</button>}
    >
      <input
        className="routine-name-input"
        placeholder="Routine name"
        value={draft.name}
        onChange={(e) => patch({ name: e.target.value })}
        autoCapitalize="words"
        aria-label="Routine name"
      />
      <div className="color-pick" role="radiogroup" aria-label="Colour">
        {COLORS.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={draft.color === c}
            aria-label={c}
            className={`color-swatch color-${c} ${draft.color === c ? 'is-on' : ''}`}
            onClick={() => patch({ color: c })}
          />
        ))}
      </div>

      {draft.exercises.length === 0 ? (
        <EmptyState icon="dumbbell" title="No exercises" text="Add exercises and set your target sets, reps and rest." />
      ) : (
        <div className="re-list">
          {draft.exercises.map((e, i) => {
            const ex = lookup(e.exerciseId);
            return (
              <div key={e.id} className="re-item">
                <div className="re-head">
                  <span className="ex-thumb ex-thumb-sm">
                    <ExerciseThumb anim={ex.anim} />
                  </span>
                  <strong>{ex.name}</strong>
                  <div className="re-tools">
                    <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                      <Icon name="arrowUp" size={16} />
                    </button>
                    <button className="icon-btn" disabled={i === draft.exercises.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                      <Icon name="arrowDown" size={16} />
                    </button>
                    <button className="icon-btn" onClick={() => patch({ exercises: draft.exercises.filter((x) => x.id !== e.id) })} aria-label="Remove">
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
                <div className="re-fields">
                  <label>
                    <span>Sets</span>
                    <Stepper label="sets" value={e.sets} min={1} max={12} onChange={(v) => patchEx(e.id, { sets: v })} />
                  </label>
                  <label>
                    <span>{ex.kind === 'time' ? 'Time' : 'Reps'}</span>
                    <input className="re-input" value={e.reps} onChange={(ev) => patchEx(e.id, { reps: ev.target.value.slice(0, 12) })} aria-label="Target reps" />
                  </label>
                  <label>
                    <span>Rest</span>
                    <Stepper label="rest" value={e.restSec} step={15} min={0} max={600} onChange={(v) => patchEx(e.id, { restSec: v })} format={(v) => (v ? formatClock(v) : 'Off')} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn btn-block wo-add" style={{ marginTop: 14 }} onClick={() => setPicking(true)}>
        <Icon name="plus" size={20} stroke={2.4} /> Add Exercises
      </button>

      <label className="field">
        <span>Notes</span>
        <textarea className="input" value={draft.note ?? ''} placeholder="Focus, cues, progression plan…" onChange={(e) => patch({ note: e.target.value })} />
      </label>

      {!isNew && (
        <div className="btn-row" style={{ marginTop: 24 }}>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (await confirm({ title: `Delete “${draft.name}”?`, message: 'Your workout history is kept.', confirmLabel: 'Delete', destructive: true })) {
                del(draft.id);
                goBack('/workouts');
              }
            }}
          >
            Delete
          </button>
          <button
            className="btn btn-primary"
            disabled={!valid}
            onClick={() => {
              save({ ...draft, name: draft.name.trim() });
              startRoutine({ ...draft, name: draft.name.trim() });
            }}
          >
            <Icon name="play" size={14} fill /> Start
          </button>
        </div>
      )}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(ids) =>
          patch({
            exercises: [
              ...draft.exercises,
              ...ids.map((exerciseId) => {
                const rec = lookup(exerciseId).recommended;
                return { id: uid(), exerciseId, sets: rec.sets, reps: rec.reps, restSec: rec.restSec };
              }),
            ],
          })
        }
      />
    </Screen>
  );
}
