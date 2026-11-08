import { useMemo, useState } from 'react';
import { formatDuration, formatLongDate, formatTime, toLocalDate } from '@/domain/dates';
import { e1rm, isWorkingSet, workoutDurationSec, workoutSetCount } from '@/domain/metrics';
import { fmtNumber, fmtWeight, toDisplayWeight } from '@/domain/units';
import { uid } from '@/domain/id';
import { canComplete, newSet } from '@/domain/workoutOps';
import type { Routine, Workout } from '@/domain/types';
import { prLabel } from '@/features/session/Session';
import { beginWorkout } from '@/features/session/actions';
import { WorkoutEditor } from '@/features/workout/WorkoutEditor';
import { ExerciseThumb } from '@/features/library/figure/Figure';
import { goBack, navigate } from '@/lib/router';
import { useExerciseLookup, usePRs } from '@/store/selectors';
import { useData } from '@/store/useData';
import { EmptyState } from '@/ui/controls';
import { actionSheet, confirm, toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import './workouts.css';

export function WorkoutDetailScreen({ id }: { id: string }) {
  const w = useData((s) => s.workouts.find((x) => x.id === id));
  const [editing, setEditing] = useState(false);
  if (!w) {
    return (
      <Screen title="Workout" back={{ label: 'Workouts', to: '/workouts' }}>
        <EmptyState icon="info" title="Workout not found" text="It may have been deleted." />
      </Screen>
    );
  }
  return editing ? <EditWorkout w={w} onDone={() => setEditing(false)} /> : <ViewWorkout w={w} onEdit={() => setEditing(true)} />;
}

function ViewWorkout({ w, onEdit }: { w: Workout; onEdit: () => void }) {
  const lookup = useExerciseLookup();
  const units = useData((s) => s.settings.units);
  const del = useData((s) => s.deleteWorkout);
  const saveRoutine = useData((s) => s.saveRoutine);
  const { events } = usePRs();
  const prs = useMemo(() => events.filter((e) => e.workoutId === w.id), [events, w.id]);
  const prSets = new Map(prs.map((p) => [p.setId, p.kind]));

  const repeat = () => {
    const now = new Date();
    beginWorkout({
      id: uid(),
      name: w.name,
      routineId: w.routineId,
      startedAt: now.toISOString(),
      endedAt: null,
      exercises: w.exercises.map((e) => ({
        ...e,
        id: uid(),
        sets: e.sets.map(() => newSet()),
      })),
    });
  };

  const saveAsRoutine = () => {
    const now = new Date().toISOString();
    const r: Routine = {
      id: uid(),
      name: w.name,
      color: 'lime',
      createdAt: now,
      updatedAt: now,
      exercises: w.exercises.map((e) => {
        const reps = e.sets.map((s) => s.reps ?? 0).filter(Boolean);
        const ex = lookup(e.exerciseId);
        return {
          id: uid(),
          exerciseId: e.exerciseId,
          sets: e.sets.length,
          reps: ex.kind === 'time' ? `${Math.max(...e.sets.map((s) => s.duration ?? 0))}s` : reps.length ? String(Math.max(...reps)) : ex.recommended.reps,
          restSec: e.restSec,
        };
      }),
    };
    saveRoutine(r);
    toast('Saved as routine', 'success');
  };

  const menu = () =>
    actionSheet({
      actions: [
        { label: 'Edit workout', onSelect: onEdit },
        { label: 'Repeat workout', onSelect: repeat },
        { label: 'Save as routine', onSelect: saveAsRoutine },
        {
          label: 'Delete workout',
          destructive: true,
          onSelect: async () => {
            if (await confirm({ title: 'Delete this workout?', message: 'This also removes any PRs it set.', confirmLabel: 'Delete', destructive: true })) {
              del(w.id);
              toast('Workout deleted');
              goBack('/workouts');
            }
          },
        },
      ],
    });

  return (
    <Screen
      title={w.name}
      back={{ label: 'Back', to: '/workouts' }}
      right={
        <>
          <button className="nav-btn" onClick={onEdit}>Edit</button>
          <button className="nav-btn" onClick={menu} aria-label="More actions">
            <Icon name="more" size={22} stroke={3} />
          </button>
        </>
      }
    >
      <h1 className="guide-title">{w.name}</h1>
      <p className="muted wd-date">
        {formatLongDate(w.startedAt)} · {formatTime(w.startedAt)}
      </p>
      <div className="wd-stats">
        <div><label>Duration</label><span className="num">{formatDuration(workoutDurationSec(w))}</span></div>
        <div><label>Sets</label><span className="num">{workoutSetCount(w)}</span></div>
        <div><label>PRs</label><span className="num">{new Set(prs.map((p) => p.exerciseId)).size}</span></div>
      </div>
      {w.note && <p className="wd-note">{w.note}</p>}

      {w.exercises.map((e) => {
        const ex = lookup(e.exerciseId);
        let n = 0;
        return (
          <section key={e.id} className="card wd-ex">
            <button className="wd-ex-head" onClick={() => navigate(`/progress/exercise/${ex.id}`)}>
              <span className="ex-thumb ex-thumb-sm"><ExerciseThumb anim={ex.anim} /></span>
              <strong>{ex.name}</strong>
              <Icon name="chevronRight" size={16} className="faint" />
            </button>
            <table className="wd-table">
              <tbody>
                {e.sets.map((s) => {
                  const label = s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : String(++n);
                  const pr = prSets.get(s.id);
                  return (
                    <tr key={s.id} className={s.type === 'warmup' ? 'is-warmup' : ''}>
                      <td className={`set-type-${s.type} wd-set`}>{label}</td>
                      <td className="num">
                        {ex.kind === 'time'
                          ? `${s.duration ?? 0}s`
                          : ex.kind === 'reps'
                            ? `${s.reps ?? 0} reps${s.weight ? ` +${fmtWeight(s.weight, units)}` : ''}`
                            : `${fmtWeight(s.weight ?? 0, units)} × ${s.reps ?? 0}`}
                      </td>
                      <td className="num faint">
                        {ex.kind === 'weight' && isWorkingSet(s) && (s.reps ?? 0) > 1 ? `e1RM ${fmtNumber(toDisplayWeight(e1rm(s.weight ?? 0, s.reps ?? 0), units), 0)}` : ''}
                      </td>
                      <td>{pr && <span className="badge badge-gold"><Icon name="trophy" size={11} stroke={2.4} /> {prLabel(pr)}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
      <button className="btn btn-block" style={{ marginTop: 16 }} onClick={repeat}>
        <Icon name="swap" size={18} /> Repeat this workout
      </button>
    </Screen>
  );
}

function EditWorkout({ w, onDone }: { w: Workout; onDone: () => void }) {
  const save = useData((s) => s.saveWorkout);
  const lookup = useExerciseLookup();
  const [draft, setDraft] = useState<Workout>(w);
  const start = new Date(draft.startedAt);
  const durMin = Math.max(1, Math.round(workoutDurationSec(draft) / 60));

  const setStart = (date: string, time: string) => {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return;
    const ns = new Date(y, m - 1, d, hh, mm);
    setDraft((x) => ({ ...x, startedAt: ns.toISOString(), endedAt: new Date(ns.getTime() + durMin * 60_000).toISOString() }));
  };

  const onSave = () => {
    const cleaned: Workout = {
      ...draft,
      name: draft.name.trim() || w.name,
      exercises: draft.exercises
        .map((e) => ({ ...e, sets: e.sets.filter((s) => canComplete(s, lookup(e.exerciseId).kind)).map((s) => ({ ...s, done: true })) }))
        .filter((e) => e.sets.length),
    };
    if (!cleaned.exercises.length) return toast('A workout needs at least one complete set', 'error');
    if (new Date(cleaned.startedAt) > new Date()) return toast('Start time can’t be in the future', 'error');
    save(cleaned);
    toast('Workout updated', 'success');
    onDone();
  };

  return (
    <Screen
      title="Edit Workout"
      left={
        <button
          className="nav-btn"
          onClick={async () => {
            if (draft !== w && !(await confirm({ title: 'Discard changes?', confirmLabel: 'Discard', destructive: true }))) return;
            onDone();
          }}
        >
          Cancel
        </button>
      }
      right={<button className="nav-btn is-strong" onClick={onSave}>Save</button>}
    >
      <input className="routine-name-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Workout name" />
      <div className="wd-edit-meta">
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" value={toLocalDate(start)} max={toLocalDate(new Date())} onChange={(e) => setStart(e.target.value, `${start.getHours()}:${start.getMinutes()}`)} />
        </label>
        <label className="field">
          <span>Start</span>
          <input className="input" type="time" value={formatTime(start)} onChange={(e) => setStart(toLocalDate(start), e.target.value)} />
        </label>
        <label className="field">
          <span>Minutes</span>
          <input
            className="input"
            inputMode="numeric"
            value={durMin}
            onChange={(e) => {
              const m = Math.min(600, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1));
              setDraft((x) => ({ ...x, endedAt: new Date(new Date(x.startedAt).getTime() + m * 60_000).toISOString() }));
            }}
          />
        </label>
      </div>
      <div style={{ height: 16 }} />
      <WorkoutEditor workout={draft} mode="edit" onChange={(fn) => setDraft((d) => fn(d))} />
      <label className="field">
        <span>Notes</span>
        <textarea className="input" value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
      </label>
    </Screen>
  );
}
