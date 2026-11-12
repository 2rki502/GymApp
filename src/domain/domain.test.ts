import { describe, expect, it } from 'vitest';
import { addDays, formatClock, startOfWeek, toLocalDate, weekdayIndex } from './dates';
import { computePRs, e1rm, exerciseHistory, previousSets, workoutSetCount } from './metrics';
import { comparePeriod, weeklyBuckets, weeklyStreak } from './stats';
import { fmtWeight, fromDisplayWeight, parseDecimal, toDisplayWeight } from './units';
import {
  addSet, canComplete, cycleSetType, fillFromHint, finalizeWorkout, moveExercise, newExerciseLog, newSet, newWorkout,
  parseRepTarget, planHint, removeSet, updateSet, workoutFromRoutine,
} from './workoutOps';
import type { ExerciseKind, Workout } from './types';

const kindOf = (id: string): ExerciseKind => (id === 'plank' ? 'time' : id === 'pushup' ? 'reps' : 'weight');

function workout(date: string, exerciseId: string, sets: [number | null, number | null][], opts: Partial<Workout> = {}): Workout {
  const start = new Date(date);
  return {
    id: `${date}-${exerciseId}`,
    name: 'Test',
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + 3600_000).toISOString(),
    exercises: [
      {
        id: `log-${date}`,
        exerciseId,
        restSec: 90,
        sets: sets.map(([weight, reps], i) => ({ id: `${date}-${i}`, type: 'normal', weight, reps, duration: null, done: true })),
      },
    ],
    ...opts,
  };
}

describe('dates', () => {
  it('starts weeks on Monday', () => {
    const sunday = new Date(2026, 10, 8); // Sun 8 Nov 2026
    expect(weekdayIndex(sunday)).toBe(6);
    expect(toLocalDate(startOfWeek(sunday))).toBe('2026-11-02');
  });
  it('formats clocks', () => {
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-4)).toBe('0:00');
  });
});

describe('units', () => {
  it('round-trips lb without drift', () => {
    const kg = fromDisplayWeight(135, 'imperial');
    expect(toDisplayWeight(kg, 'imperial')).toBeCloseTo(135, 9);
    expect(fmtWeight(kg, 'imperial')).toBe('135 lb');
  });
  it('parses comma decimals and rejects junk', () => {
    expect(parseDecimal('62,5')).toBe(62.5);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('-3')).toBeNull();
  });
});

describe('metrics', () => {
  it('computes Epley e1RM', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
    expect(e1rm(0, 5)).toBe(0);
  });

  it('excludes warm-ups and incomplete sets from set counts', () => {
    const w = workout('2026-11-01T10:00:00', 'bench', [[100, 5], [100, 5]]);
    w.exercises[0].sets[0].type = 'warmup';
    w.exercises[0].sets.push(newSet({ weight: 200, reps: 10, done: false }));
    expect(workoutSetCount(w)).toBe(1);
  });

  it('detects PRs only after a baseline exists', () => {
    const history = [
      workout('2026-10-01T10:00:00', 'bench', [[80, 5]]),
      workout('2026-10-08T10:00:00', 'bench', [[85, 5]]),
      workout('2026-10-15T10:00:00', 'bench', [[85, 5]]),
    ];
    const { events, bests } = computePRs(history, kindOf);
    expect(events.every((e) => e.workoutId === history[1].id)).toBe(true);
    expect(events.map((e) => e.kind).sort()).toEqual(['e1rm', 'weight']);
    expect(bests.get('bench')?.weight).toBe(85);
  });

  it('ignores unfinished workouts', () => {
    const live = workout('2026-10-20T10:00:00', 'bench', [[200, 5]], { endedAt: null });
    const { bests } = computePRs([workout('2026-10-01T10:00:00', 'bench', [[80, 5]]), live], kindOf);
    expect(bests.get('bench')?.weight).toBe(80);
  });

  it('tracks rep PRs for bodyweight exercises', () => {
    const { events } = computePRs(
      [workout('2026-10-01T10:00:00', 'pushup', [[null, 20]]), workout('2026-10-02T10:00:00', 'pushup', [[null, 25]])],
      kindOf,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'reps', value: 25, previous: 20 });
  });

  it('returns previous sets from the latest other workout', () => {
    const a = workout('2026-10-01T10:00:00', 'bench', [[80, 5]]);
    const b = workout('2026-10-08T10:00:00', 'bench', [[90, 3]]);
    expect(previousSets([b, a], 'bench').map((s) => s.weight)).toEqual([90]);
    expect(previousSets([a, b], 'bench', b.id).map((s) => s.weight)).toEqual([80]);
    expect(previousSets([a], 'squat')).toEqual([]);
  });

  it('builds per-exercise history in date order', () => {
    const h = exerciseHistory(
      [workout('2026-10-08T10:00:00', 'bench', [[90, 3]]), workout('2026-10-01T10:00:00', 'bench', [[80, 5], [82.5, 5]])],
      'bench',
      'weight',
    );
    expect(h.map((s) => s.topWeight)).toEqual([82.5, 90]);
    expect(h[0].sets).toHaveLength(2);
  });
});

describe('stats', () => {
  const now = new Date(2026, 10, 7, 12); // Sat 7 Nov 2026
  const week = startOfWeek(now);
  const at = (d: Date) => workout(addDays(d, 0).toISOString(), 'bench', [[50, 10]], { id: d.toISOString() });

  it('counts a streak of weeks meeting the goal', () => {
    const ws = [
      at(addDays(week, -14)), at(addDays(week, -13)),
      at(addDays(week, -7)), at(addDays(week, -6)),
      at(addDays(week, 1)),
    ];
    expect(weeklyStreak(ws, 2, now)).toEqual({ weeks: 2, thisWeek: 1, goal: 2 });
    expect(weeklyStreak([...ws, at(addDays(week, 2))], 2, now).weeks).toBe(3);
  });

  it('breaks the streak on a missed week', () => {
    const ws = [at(addDays(week, -21)), at(addDays(week, -7))];
    expect(weeklyStreak(ws, 1, now).weeks).toBe(1);
  });

  it('buckets weeks oldest first including the current week', () => {
    const b = weeklyBuckets([at(addDays(week, 1)), at(addDays(week, -6))], 3, now);
    expect(b.map((x) => x.workouts)).toEqual([0, 1, 1]);
  });

  it('compares like-for-like spans', () => {
    // Previous week: one on Monday (inside span), one on Sunday (outside a Saturday-noon span).
    const ws = [at(addDays(week, -7)), workout(addDays(week, -1).toISOString(), 'bench', [[50, 10]], { id: 'sun' }), at(week)];
    const cmp = comparePeriod(ws, 'week', now);
    expect(cmp.current.workouts).toBe(1);
    expect(cmp.previous.workouts).toBe(1);
  });
});

describe('workout ops', () => {
  it('copies the previous set when adding', () => {
    let w = newWorkout('W');
    w = { ...w, exercises: [newExerciseLog('bench', 90, 1)] };
    const exId = w.exercises[0].id;
    w = updateSet(w, exId, w.exercises[0].sets[0].id, { weight: 60, reps: 8, done: true });
    w = addSet(w, exId);
    expect(w.exercises[0].sets[1]).toMatchObject({ weight: 60, reps: 8, done: false });
  });

  it('cycles set types and removes sets', () => {
    let w = { ...newWorkout('W'), exercises: [newExerciseLog('bench', 90, 2)] };
    const ex = w.exercises[0];
    w = cycleSetType(w, ex.id, ex.sets[0].id);
    expect(w.exercises[0].sets[0].type).toBe('warmup');
    w = removeSet(w, ex.id, ex.sets[1].id);
    expect(w.exercises[0].sets).toHaveLength(1);
  });

  it('reorders exercises within bounds', () => {
    let w = { ...newWorkout('W'), exercises: [newExerciseLog('a', 90), newExerciseLog('b', 90)] };
    const first = w.exercises[0].id;
    expect(moveExercise(w, first, -1)).toBe(w);
    w = moveExercise(w, first, 1);
    expect(w.exercises.map((e) => e.exerciseId)).toEqual(['b', 'a']);
  });

  it('finalizes by keeping completed sets only', () => {
    let w = { ...newWorkout('W'), exercises: [newExerciseLog('a', 90, 2), newExerciseLog('b', 90, 1)] };
    w = updateSet(w, w.exercises[0].id, w.exercises[0].sets[0].id, { weight: 10, reps: 10, done: true });
    const f = finalizeWorkout(w);
    expect(f.endedAt).not.toBeNull();
    expect(f.exercises).toHaveLength(1);
    expect(f.exercises[0].sets).toHaveLength(1);
  });

  it('validates set completion per kind', () => {
    expect(canComplete(newSet({ reps: 5 }), 'weight')).toBe(false);
    expect(canComplete(newSet({ reps: 5, weight: 0 }), 'weight')).toBe(true);
    expect(canComplete(newSet({ reps: 12 }), 'reps')).toBe(true);
    expect(canComplete(newSet({ duration: 0 }), 'time')).toBe(false);
  });

  it('builds a session from a routine', () => {
    const w = workoutFromRoutine(
      {
        id: 'r', name: 'Push', color: 'lime', createdAt: '', updatedAt: '',
        exercises: [
          { id: 'x', exerciseId: 'bench', sets: 4, reps: '6-8', restSec: 150, weight: 80 },
          { id: 'y', exerciseId: 'plank', sets: 2, reps: '45s', restSec: 60 },
        ],
      },
      kindOf,
    );
    expect(w.routineId).toBe('r');
    expect(w.exercises[0].sets).toHaveLength(4);
    expect(w.exercises[0].sets[0]).toMatchObject({ weight: 80, reps: 6 });
    expect(w.exercises[1].restSec).toBe(60);
    expect(parseRepTarget('AMRAP')).toBeNull();
  });

  it("remembers the plan's target so a first-timer isn't faced with blank sets", () => {
    const w = workoutFromRoutine(
      {
        id: 'r', name: 'Push', color: 'lime', createdAt: '', updatedAt: '',
        exercises: [
          { id: 'x', exerciseId: 'bench', sets: 4, reps: '5-8', restSec: 150 },
          { id: 'y', exerciseId: 'plank', sets: 2, reps: '45s', restSec: 60 },
          { id: 'z', exerciseId: 'bench', sets: 3, reps: 'AMRAP', restSec: 90 },
        ],
      },
      kindOf,
    );
    // Values stay empty (last time's numbers still win when there is history)...
    expect(w.exercises[0].sets[0]).toMatchObject({ weight: null, reps: null });
    // ...but the target is kept and becomes the fallback hint.
    expect(planHint(w.exercises[0], 'weight')).toMatchObject({ weight: null, reps: 5 });
    expect(planHint(w.exercises[1], 'time')).toMatchObject({ duration: 45 });
    expect(planHint(w.exercises[2], 'weight')).toBeUndefined();
  });

  it('completes a first-time set from the plan once the weight is typed', () => {
    const log = { ...newExerciseLog('bench', 90, 1), targetReps: 5 };
    const typed = { ...log.sets[0], weight: 60 };
    expect(canComplete(fillFromHint(log.sets[0], planHint(log, 'weight')), 'weight')).toBe(false); // weight still needed
    expect(fillFromHint(typed, planHint(log, 'weight'))).toMatchObject({ weight: 60, reps: 5 });
    expect(canComplete(fillFromHint(typed, planHint(log, 'weight')), 'weight')).toBe(true);
  });
});
