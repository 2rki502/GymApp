import type { ExerciseKind, ExerciseLog, PREvent, PRKind, SetLog, Workout, ID } from './types';

/** Estimated one-rep max (Epley). Unreliable past ~12 reps, so those are clamped. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 12) / 30);
}

/** Sets that count toward stats: completed and not warm-ups. */
export function isWorkingSet(s: SetLog): boolean {
  return s.done && s.type !== 'warmup';
}

export function workoutSetCount(w: Workout): number {
  return w.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0);
}

export function workoutDurationSec(w: Workout): number {
  if (!w.endedAt) return 0;
  return Math.max(0, (new Date(w.endedAt).getTime() - new Date(w.startedAt).getTime()) / 1000);
}

export function byDateAsc(a: Workout, b: Workout): number {
  return a.startedAt.localeCompare(b.startedAt);
}

export function finished(workouts: Workout[]): Workout[] {
  return workouts.filter((w) => w.endedAt !== null);
}

/** The single "best" set of an exercise log, ranked by the metric that matters for its kind. */
export function bestSet(e: ExerciseLog, kind: ExerciseKind): SetLog | null {
  let best: SetLog | null = null;
  let bestScore = -1;
  for (const s of e.sets) {
    if (!isWorkingSet(s)) continue;
    const score = setScore(s, kind);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

function setScore(s: SetLog, kind: ExerciseKind): number {
  if (kind === 'weight') return e1rm(s.weight ?? 0, s.reps ?? 0);
  if (kind === 'time') return s.duration ?? 0;
  // reps kind: added load matters a little more than one extra rep
  return (s.reps ?? 0) + (s.weight ?? 0) * 0.01;
}

/** PR metrics tracked per exercise kind. */
export function trackedKinds(kind: ExerciseKind): PRKind[] {
  if (kind === 'weight') return ['e1rm', 'weight'];
  if (kind === 'time') return ['duration'];
  return ['reps'];
}

function metricOf(s: SetLog, k: PRKind): number {
  switch (k) {
    case 'weight': return (s.reps ?? 0) > 0 ? s.weight ?? 0 : 0;
    case 'e1rm': return e1rm(s.weight ?? 0, s.reps ?? 0);
    case 'reps': return s.reps ?? 0;
    case 'duration': return s.duration ?? 0;
  }
}

export interface PersonalBests {
  weight: number;
  e1rm: number;
  reps: number;
  duration: number;
}

/**
 * Walk history chronologically and emit an event every time an exercise beats its
 * previous best. First-ever performances establish a baseline and are not PRs.
 * Derived on demand so editing/deleting history can never leave stale PRs behind.
 */
export function computePRs(
  workouts: Workout[],
  kindOf: (exerciseId: ID) => ExerciseKind,
): { events: PREvent[]; bests: Map<ID, PersonalBests> } {
  const bests = new Map<ID, PersonalBests>();
  const events: PREvent[] = [];
  const sorted = finished(workouts).sort(byDateAsc);

  for (const w of sorted) {
    // Aggregate per exercise first: the same exercise can appear twice in one workout.
    const perExercise = new Map<ID, SetLog[]>();
    for (const e of w.exercises) {
      const list = perExercise.get(e.exerciseId) ?? [];
      list.push(...e.sets.filter(isWorkingSet));
      perExercise.set(e.exerciseId, list);
    }

    for (const [exerciseId, sets] of perExercise) {
      if (sets.length === 0) continue;
      const kind = kindOf(exerciseId);
      const prev = bests.get(exerciseId);
      const next: PersonalBests = prev ? { ...prev } : { weight: 0, e1rm: 0, reps: 0, duration: 0 };

      for (const k of trackedKinds(kind)) {
        let top: SetLog | null = null;
        let topVal = 0;
        for (const s of sets) {
          const v = metricOf(s, k);
          if (v > topVal) {
            topVal = v;
            top = s;
          }
        }
        if (!top || topVal <= 0) continue;
        if (prev && topVal > prev[k] + 1e-9) {
          events.push({
            workoutId: w.id,
            exerciseId,
            setId: top.id,
            date: w.startedAt,
            kind: k,
            value: topVal,
            previous: prev[k] > 0 ? prev[k] : null,
            weight: top.weight,
            reps: top.reps,
          });
        }
        next[k] = Math.max(next[k], topVal);
      }
      bests.set(exerciseId, next);
    }
  }
  return { events, bests };
}

export interface ExerciseSession {
  workoutId: ID;
  date: string;
  sets: SetLog[];
  best: SetLog | null;
  e1rm: number;
  topWeight: number;
  maxReps: number;
  maxDuration: number;
}

/** Every finished session containing an exercise, oldest first. */
export function exerciseHistory(workouts: Workout[], exerciseId: ID, kind: ExerciseKind): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const w of finished(workouts).sort(byDateAsc)) {
    const logs = w.exercises.filter((e) => e.exerciseId === exerciseId);
    if (logs.length === 0) continue;
    const merged: ExerciseLog = { ...logs[0], sets: logs.flatMap((l) => l.sets) };
    const working = merged.sets.filter(isWorkingSet);
    if (working.length === 0) continue;
    out.push({
      workoutId: w.id,
      date: w.startedAt,
      sets: working,
      best: bestSet(merged, kind),
      e1rm: Math.max(0, ...working.map((s) => e1rm(s.weight ?? 0, s.reps ?? 0))),
      topWeight: Math.max(0, ...working.map((s) => ((s.reps ?? 0) > 0 ? s.weight ?? 0 : 0))),
      maxReps: Math.max(0, ...working.map((s) => s.reps ?? 0)),
      maxDuration: Math.max(0, ...working.map((s) => s.duration ?? 0)),
    });
  }
  return out;
}

/** Completed sets from the most recent finished workout that included the exercise. */
export function previousSets(workouts: Workout[], exerciseId: ID, excludeWorkoutId?: ID): SetLog[] {
  let latest: Workout | null = null;
  for (const w of workouts) {
    if (w.id === excludeWorkoutId || w.endedAt === null) continue;
    if (!w.exercises.some((e) => e.exerciseId === exerciseId)) continue;
    if (!latest || w.startedAt > latest.startedAt) latest = w;
  }
  if (!latest) return [];
  return latest.exercises
    .filter((e) => e.exerciseId === exerciseId)
    .flatMap((e) => e.sets)
    .filter((s) => s.done);
}
