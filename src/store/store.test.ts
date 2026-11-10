import { beforeEach, describe, expect, it } from 'vitest';
import { EXERCISES } from '@/data/exercises';
import { generateSample } from '@/data/sample';
import { SPLIT_PRESETS } from '@/data/templates';
import { computePRs } from '@/domain/metrics';
import { addSet, newExerciseLog, newWorkout, updateSet } from '@/domain/workoutOps';
import { makeBackup, parseBackup } from '@/lib/backup';
import { PATTERNS } from '@/features/library/figure/patterns';
import { defaultSettings, useData } from './useData';

const S = () => useData.getState();

beforeEach(() => S().resetAll());

describe('library data', () => {
  it('has unique ids and a valid animation for every exercise', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of EXERCISES) {
      expect(PATTERNS[e.anim!], `${e.id} anim ${e.anim}`).toBeDefined();
      expect(e.instructions.length).toBeGreaterThanOrEqual(3);
      expect(e.mistakes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('presets reference real exercises', () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const p of SPLIT_PRESETS) for (const r of p.routines) for (const x of r.exercises) expect(ids.has(x.exerciseId), x.exerciseId).toBe(true);
  });
});

describe('store', () => {
  it('runs a full session lifecycle', () => {
    let w = { ...newWorkout('Test'), exercises: [newExerciseLog('bench-press', 90, 2)] };
    S().startSession(w);
    const ex = S().session!.exercises[0];
    S().updateSession((s) => updateSet(s, ex.id, ex.sets[0].id, { weight: 60, reps: 8, done: true }));
    S().updateSession((s) => addSet(s, ex.id));
    S().startRest(90, ex.id);
    expect(S().rest?.duration).toBe(90);
    const saved = S().finishSession();
    expect(saved?.exercises[0].sets).toHaveLength(1);
    expect(S().session).toBeNull();
    expect(S().rest).toBeNull();
    expect(S().workouts).toHaveLength(1);
    w = S().workouts[0];
    S().deleteWorkout(w.id);
    expect(S().workouts).toHaveLength(0);
  });

  it('does not save a workout with no completed sets', () => {
    S().startSession({ ...newWorkout('Empty'), exercises: [newExerciseLog('bench-press', 90, 2)] });
    S().finishSession();
    expect(S().workouts).toHaveLength(0);
  });

  it('keeps one body-weight entry per day', () => {
    S().logBodyWeight('2026-11-01', 80);
    S().logBodyWeight('2026-11-01', 79.5);
    S().logBodyWeight('2026-11-02', 79);
    expect(S().bodyWeights.map((b) => b.weight)).toEqual([79, 79.5]);
  });

  it('applies a split preset and clears days when a routine is deleted', () => {
    const splitId = S().applySplitPreset(SPLIT_PRESETS[0]);
    expect(S().settings.activeSplitId).toBe(splitId);
    expect(S().routines).toHaveLength(3);
    const push = S().routines[0].id;
    S().deleteRoutine(push);
    expect(S().splits[0].days.includes(push)).toBe(false);
  });

  it('refuses to delete a custom exercise that is in use', () => {
    const custom = { ...EXERCISES[0], id: 'my-ex', custom: true, section: 'custom' as const, group: 'custom' as const };
    S().saveCustomExercise(custom);
    S().startSession({ ...newWorkout('W'), exercises: [newExerciseLog('my-ex', 90, 1)] });
    expect(S().deleteCustomExercise('my-ex')).toBe(false);
    S().discardSession();
    expect(S().deleteCustomExercise('my-ex')).toBe(true);
  });
});

describe('backup', () => {
  it('round-trips through export/import', () => {
    S().replaceAll(generateSample(defaultSettings(), new Date(2026, 10, 7)));
    const text = JSON.stringify(makeBackup(S()));
    const parsed = parseBackup(text);
    expect(parsed.workouts.length).toBe(S().workouts.length);
    expect(parsed.settings.activeSplitId).toBe(S().settings.activeSplitId);
  });

  it('rejects junk and foreign files', () => {
    expect(() => parseBackup('nope')).toThrow(/JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/not a Forge backup/);
    expect(() => parseBackup('{"app":"forge","version":99,"data":{}}')).toThrow(/newer/);
    expect(() => parseBackup('{"app":"forge","version":1,"data":{"workouts":[{"id":1}]}}')).toThrow(/invalid workout/);
  });
});

describe('nutrition', () => {
  const plan = { goal: 'lose', sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80, activity: 'moderate' } as const;
  const food = { id: 'f1', date: '2026-11-10', meal: 'lunch', name: 'Rice', kcal: 200, protein: 4, carbs: 44, fat: 1, createdAt: '2026-11-10T12:00:00Z' } as const;

  it('saves the plan and food entries, and edits replace them', () => {
    expect(S().nutrition).toBeNull();
    S().skipNutrition(true);
    S().saveNutrition(plan);
    expect(S().nutrition?.goal).toBe('lose');
    expect(S().nutritionSkipped).toBe(false);
    S().saveFood(food);
    S().saveFood({ ...food, kcal: 250 });
    expect(S().foodLog).toHaveLength(1);
    expect(S().foodLog[0].kcal).toBe(250);
    S().deleteFood('f1');
    expect(S().foodLog).toHaveLength(0);
  });

  it('survives loading sample data and round-trips through a backup', () => {
    S().saveNutrition(plan);
    S().saveFood(food);
    S().replaceAll(generateSample(defaultSettings(), new Date(2026, 10, 7)));
    expect(S().nutrition?.goal).toBe('lose');
    const parsed = parseBackup(JSON.stringify(makeBackup(S())));
    expect(parsed.nutrition?.heightCm).toBe(180);
    expect(parsed.foodLog).toHaveLength(1);
  });

  it('treats backups without nutrition data as not set up', () => {
    const parsed = parseBackup('{"app":"forge","version":1,"data":{"nutrition":{"goal":"x"},"foodLog":[{"id":1}]}}');
    expect(parsed.nutrition).toBeNull();
    expect(parsed.foodLog).toEqual([]);
  });
});

describe('sample data', () => {
  it('produces progressive history with PRs', () => {
    const data = generateSample(defaultSettings(), new Date(2026, 10, 7));
    expect(data.workouts.length).toBeGreaterThan(40);
    const kinds = new Map(EXERCISES.map((e) => [e.id, e.kind]));
    const { events } = computePRs(data.workouts, (id) => kinds.get(id) ?? 'weight');
    expect(events.length).toBeGreaterThan(10);
    expect(data.workouts.every((w) => w.endedAt && w.endedAt > w.startedAt)).toBe(true);
  });
});
