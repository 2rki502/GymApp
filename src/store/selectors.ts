import { useMemo } from 'react';
import { EXERCISES } from '@/data/exercises';
import { toLocalDate, weekdayIndex } from '@/domain/dates';
import { computePRs } from '@/domain/metrics';
import type { Exercise, ID, Routine, Workout } from '@/domain/types';
import { useData } from './useData';

const LIBRARY = new Map(EXERCISES.map((e) => [e.id, e]));

export const UNKNOWN_EXERCISE: Exercise = {
  id: 'unknown',
  name: 'Deleted exercise',
  section: 'custom',
  group: 'custom',
  kind: 'weight',
  primary: [],
  secondary: [],
  equipment: [],
  instructions: [],
  mistakes: [],
  recommended: { sets: 3, reps: '10', restSec: 90 },
};

export type ExerciseLookup = (id: ID) => Exercise;

export function makeLookup(custom: Exercise[]): ExerciseLookup {
  const customMap = new Map(custom.map((e) => [e.id, e]));
  return (id) => LIBRARY.get(id) ?? customMap.get(id) ?? { ...UNKNOWN_EXERCISE, id };
}

/** Stable lookup across library + user-created exercises. */
export function useExerciseLookup(): ExerciseLookup {
  const custom = useData((s) => s.customExercises);
  return useMemo(() => makeLookup(custom), [custom]);
}

export function useAllExercises(): Exercise[] {
  const custom = useData((s) => s.customExercises);
  return useMemo(() => [...EXERCISES, ...custom], [custom]);
}

/** PR events and all-time bests, recomputed only when history changes. */
export function usePRs() {
  const workouts = useData((s) => s.workouts);
  const lookup = useExerciseLookup();
  return useMemo(() => computePRs(workouts, (id) => lookup(id).kind), [workouts, lookup]);
}

export interface TodayPlan {
  splitName: string | null;
  routine: Routine | null;
  isRestDay: boolean;
  doneToday: Workout | null;
}

export function useTodayPlan(now = new Date()): TodayPlan {
  const { settings, splits, routines, workouts } = useData();
  const today = toLocalDate(now);
  return useMemo(() => {
    const split = splits.find((s) => s.id === settings.activeSplitId) ?? null;
    const routineId = split ? split.days[weekdayIndex(now)] : null;
    const routine = routineId ? routines.find((r) => r.id === routineId) ?? null : null;
    const doneToday =
      [...workouts].reverse().find((w) => w.endedAt && toLocalDate(w.startedAt) === today) ?? null;
    return { splitName: split?.name ?? null, routine, isRestDay: !!split && !routine, doneToday };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.activeSplitId, splits, routines, workouts, today]);
}

export const sortedWorkouts = (ws: Workout[]) => ws.filter((w) => w.endedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
