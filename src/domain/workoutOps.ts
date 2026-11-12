/**
 * Pure, immutable editing operations on a Workout. Shared by the live session and
 * by history editing so both behave identically.
 */
import { uid } from './id';
import type { ExerciseKind, ExerciseLog, ID, Routine, SetLog, SetType, Workout } from './types';

export function newSet(partial: Partial<SetLog> = {}): SetLog {
  return { id: uid(), type: 'normal', weight: null, reps: null, duration: null, done: false, ...partial };
}

export function newExerciseLog(exerciseId: ID, restSec: number, setCount = 3, template?: Partial<SetLog>): ExerciseLog {
  return {
    id: uid(),
    exerciseId,
    restSec,
    sets: Array.from({ length: Math.max(1, setCount) }, () => newSet(template)),
  };
}

export function newWorkout(name: string, now = new Date()): Workout {
  return { id: uid(), name, startedAt: now.toISOString(), endedAt: null, exercises: [] };
}

/** First number in a rep target like "8-12" → 8, "30s" → 30. */
export function parseRepTarget(reps: string): number | null {
  const m = /\d+/.exec(reps);
  return m ? Number(m[0]) : null;
}

export function workoutFromRoutine(routine: Routine, kindOf: (id: ID) => ExerciseKind, now = new Date()): Workout {
  const w = newWorkout(routine.name, now);
  w.routineId = routine.id;
  w.exercises = routine.exercises.map((re) => {
    const kind = kindOf(re.exerciseId);
    const target = parseRepTarget(re.reps);
    // Targets prefill only when the routine pins them; otherwise previous performance
    // is shown as placeholder hints in the UI.
    const template: Partial<SetLog> =
      kind === 'time'
        ? { duration: null }
        : { weight: re.weight ?? null, reps: re.weight != null && target ? target : null };
    const log = newExerciseLog(re.exerciseId, re.restSec, re.sets, template);
    if (target !== null) {
      if (kind === 'time') log.targetSec = target;
      else log.targetReps = target;
    }
    return log;
  });
  return w;
}

const mapExercise = (w: Workout, exId: ID, fn: (e: ExerciseLog) => ExerciseLog): Workout => ({
  ...w,
  exercises: w.exercises.map((e) => (e.id === exId ? fn(e) : e)),
});

export function addExercises(w: Workout, exerciseIds: ID[], restSec: number): Workout {
  return { ...w, exercises: [...w.exercises, ...exerciseIds.map((id) => newExerciseLog(id, restSec, 3))] };
}

export function removeExercise(w: Workout, exId: ID): Workout {
  return { ...w, exercises: w.exercises.filter((e) => e.id !== exId) };
}

export function moveExercise(w: Workout, exId: ID, delta: -1 | 1): Workout {
  const i = w.exercises.findIndex((e) => e.id === exId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= w.exercises.length) return w;
  const list = [...w.exercises];
  [list[i], list[j]] = [list[j], list[i]];
  return { ...w, exercises: list };
}

export function replaceExercise(w: Workout, exId: ID, newExerciseId: ID): Workout {
  return mapExercise(w, exId, (e) => ({
    ...e,
    exerciseId: newExerciseId,
    sets: e.sets.map((s) => ({ ...s, weight: null, reps: null, duration: null, done: false })),
  }));
}

export function setRest(w: Workout, exId: ID, restSec: number): Workout {
  return mapExercise(w, exId, (e) => ({ ...e, restSec: Math.max(0, Math.round(restSec)) }));
}

export function setExerciseNote(w: Workout, exId: ID, note: string): Workout {
  return mapExercise(w, exId, (e) => ({ ...e, note }));
}

/** New set copies the last set's values (the usual gym flow) but is not done. */
export function addSet(w: Workout, exId: ID, done = false): Workout {
  return mapExercise(w, exId, (e) => {
    const last = e.sets[e.sets.length - 1];
    const s = newSet(last ? { weight: last.weight, reps: last.reps, duration: last.duration, done } : { done });
    return { ...e, sets: [...e.sets, s] };
  });
}

export function updateSet(w: Workout, exId: ID, setId: ID, patch: Partial<Omit<SetLog, 'id'>>): Workout {
  return mapExercise(w, exId, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));
}

export function removeSet(w: Workout, exId: ID, setId: ID): Workout {
  return mapExercise(w, exId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) }));
}

const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
export function cycleSetType(w: Workout, exId: ID, setId: ID): Workout {
  return mapExercise(w, exId, (e) => ({
    ...e,
    sets: e.sets.map((s) =>
      s.id === setId ? { ...s, type: SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(s.type) + 1) % SET_TYPE_CYCLE.length] } : s,
    ),
  }));
}

/** Whether a set has enough data to be marked complete. */
export function canComplete(s: SetLog, kind: ExerciseKind): boolean {
  if (kind === 'time') return (s.duration ?? 0) > 0;
  if (kind === 'reps') return (s.reps ?? 0) > 0;
  return (s.reps ?? 0) > 0 && s.weight !== null;
}

/** Fill empty fields of a set from a hint (previous performance) before completing it. */
export function fillFromHint(s: SetLog, hint: SetLog | undefined): SetLog {
  if (!hint) return s;
  return {
    ...s,
    weight: s.weight ?? hint.weight,
    reps: s.reps ?? hint.reps,
    duration: s.duration ?? hint.duration,
  };
}

/**
 * Prepare a live session for saving: keep only completed sets, drop empty
 * exercises, and stamp the end time.
 */
export function finalizeWorkout(w: Workout, now = new Date()): Workout {
  return {
    ...w,
    endedAt: now.toISOString(),
    exercises: w.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
      .filter((e) => e.sets.length > 0),
  };
}

export function countSets(w: Workout): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const e of w.exercises) {
    total += e.sets.length;
    done += e.sets.filter((s) => s.done).length;
  }
  return { done, total };
}

/**
 * The routine's target as a hint (reps, or seconds for timed exercises), used when there is
 * no previous performance yet. Weight is never guessed: it must come from the lifter.
 */
export function planHint(log: ExerciseLog, kind: ExerciseKind): SetLog | undefined {
  const reps = kind === 'time' ? null : log.targetReps ?? null;
  const duration = kind === 'time' ? log.targetSec ?? null : null;
  if (reps === null && duration === null) return undefined;
  return { id: '', type: 'normal', weight: null, reps, duration, done: false };
}
