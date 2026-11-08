import { addDays, startOfMonth, startOfWeek, toLocalDate } from './dates';
import { finished, isWorkingSet, workoutDurationSec, workoutSetCount } from './metrics';
import type { ID, Muscle, Workout } from './types';

export interface PeriodSummary {
  workouts: number;
  sets: number;
  durationSec: number;
}

export function summarize(workouts: Workout[]): PeriodSummary {
  return workouts.reduce<PeriodSummary>(
    (acc, w) => ({
      workouts: acc.workouts + 1,
      sets: acc.sets + workoutSetCount(w),
      durationSec: acc.durationSec + workoutDurationSec(w),
    }),
    { workouts: 0, sets: 0, durationSec: 0 },
  );
}

export function inRange(workouts: Workout[], start: Date, end: Date): Workout[] {
  const s = start.getTime();
  const e = end.getTime();
  return finished(workouts).filter((w) => {
    const t = new Date(w.startedAt).getTime();
    return t >= s && t < e;
  });
}

export interface WeekBucket extends PeriodSummary {
  start: Date;
}

/** The last `count` Monday-based weeks, oldest first, including the current week. */
export function weeklyBuckets(workouts: Workout[], count: number, now = new Date()): WeekBucket[] {
  const thisWeek = startOfWeek(now);
  const out: WeekBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    out.push({ start, ...summarize(inRange(workouts, start, addDays(start, 7))) });
  }
  return out;
}

export interface PeriodComparison {
  current: PeriodSummary;
  previous: PeriodSummary;
}

/**
 * Compare this period to-date against the same span of the previous period, so a
 * Tuesday isn't compared against a whole previous week.
 */
export function comparePeriod(workouts: Workout[], period: 'week' | 'month', now = new Date()): PeriodComparison {
  const start = period === 'week' ? startOfWeek(now) : startOfMonth(now);
  const prevStart = period === 'week' ? addDays(start, -7) : new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const elapsed = now.getTime() - start.getTime();
  const prevEnd = new Date(Math.min(prevStart.getTime() + elapsed, start.getTime()));
  return {
    current: summarize(inRange(workouts, start, addDays(now, 1))),
    previous: summarize(inRange(workouts, prevStart, prevEnd)),
  };
}

/** Set of local dates with at least one finished workout. */
export function activeDays(workouts: Workout[]): Set<string> {
  return new Set(finished(workouts).map((w) => toLocalDate(w.startedAt)));
}

export interface Streak {
  /** Consecutive weeks that met the weekly goal (the current week counts once met). */
  weeks: number;
  thisWeek: number;
  goal: number;
}

export function weeklyStreak(workouts: Workout[], goal: number, now = new Date()): Streak {
  const g = Math.max(1, goal);
  const counts = new Map<number, number>();
  for (const w of finished(workouts)) {
    const k = startOfWeek(new Date(w.startedAt)).getTime();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const current = startOfWeek(now);
  const thisWeek = counts.get(current.getTime()) ?? 0;
  let weeks = thisWeek >= g ? 1 : 0;
  // Walk back from last week; an unfinished current week doesn't break the streak.
  let cursor = addDays(current, -7);
  while ((counts.get(cursor.getTime()) ?? 0) >= g) {
    weeks++;
    cursor = addDays(cursor, -7);
  }
  return { weeks, thisWeek, goal: g };
}

/** Working sets per primary muscle — a practical proxy for training distribution. */
export function muscleDistribution(
  workouts: Workout[],
  primaryOf: (id: ID) => Muscle[],
): { muscle: Muscle; sets: number }[] {
  const tally = new Map<Muscle, number>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      const n = e.sets.filter(isWorkingSet).length;
      if (!n) continue;
      for (const m of primaryOf(e.exerciseId)) tally.set(m, (tally.get(m) ?? 0) + n);
    }
  }
  return [...tally.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}
