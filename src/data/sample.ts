/**
 * Generates a realistic, deterministic 10-week training history so the app can be
 * explored before real data exists. Offered explicitly from Profile — never auto-loaded.
 */
import { addDays, startOfDay, toLocalDate, weekdayIndex } from '@/domain/dates';
import { uid } from '@/domain/id';
import { parseRepTarget } from '@/domain/workoutOps';
import type { BodyWeightEntry, MeasurementEntry, Routine, Settings, SetLog, Split, Workout } from '@/domain/types';
import { t } from '@/i18n';
import { EXERCISES } from './exercises';
import { localizePreset } from './localize';
import { SPLIT_PRESETS } from './templates';
import type { ReplaceData } from '@/store/useData';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Starting working weights (kg) for the sample lifter. */
const START: Record<string, number> = {
  'bench-press': 70, 'overhead-press': 42.5, 'incline-db-press': 24, 'lateral-raise': 8, 'tricep-pushdown': 25,
  deadlift: 120, 'barbell-row': 60, 'face-pull': 20, 'barbell-curl': 30,
  'back-squat': 95, 'romanian-deadlift': 80, 'leg-press': 160, 'leg-curl': 40, 'calf-raise': 60,
};

const round25 = (n: number) => Math.round(n / 2.5) * 2.5;

export function generateSample(settings: Settings, now = new Date(), weeks = 10): ReplaceData {
  const rand = rng(42);
  const preset = localizePreset(SPLIT_PRESETS[0]);
  const kind = (id: string) => EXERCISES.find((e) => e.id === id)?.kind ?? 'weight';

  const keyToRoutine = new Map<string, Routine>();
  const created = addDays(now, -weeks * 7 - 2).toISOString();
  for (const r of preset.routines) {
    keyToRoutine.set(r.key, {
      id: uid(), name: r.name, color: r.color, createdAt: created, updatedAt: created,
      exercises: r.exercises.map((e) => ({ id: uid(), ...e })),
    });
  }
  const split: Split = { id: uid(), name: preset.name, days: preset.days.map((k) => (k ? keyToRoutine.get(k)!.id : null)) };

  const workouts: Workout[] = [];
  const today = startOfDay(now);
  const first = addDays(today, -weeks * 7);
  for (let d = first; d < today; d = addDays(d, 1)) {
    const key = preset.days[weekdayIndex(d)];
    if (!key || rand() < 0.12) continue; // occasional missed session
    const routine = keyToRoutine.get(key)!;
    const progress = (d.getTime() - first.getTime()) / (today.getTime() - first.getTime());
    const start = new Date(d);
    start.setHours(rand() < 0.5 ? 7 : 18, Math.floor(rand() * 50), 0, 0);
    let minutes = 0;

    const exercises = routine.exercises.map((re) => {
      const k = kind(re.exerciseId);
      const base = START[re.exerciseId] ?? 20;
      const work = round25(base * (1 + 0.14 * progress + (rand() - 0.5) * 0.03));
      const target = parseRepTarget(re.reps) ?? 8;
      const sets: SetLog[] = Array.from({ length: re.sets }, (_, i) => {
        minutes += 2.6;
        if (k === 'reps') {
          return { id: uid(), type: 'normal', weight: null, reps: Math.round(target + 2 + progress * 3 - i), duration: null, done: true };
        }
        const fatigue = i >= re.sets - 1 && rand() < 0.4 ? 1 : 0;
        return { id: uid(), type: 'normal', weight: work, reps: Math.max(1, target + Math.round(rand() * 2) - fatigue), duration: null, done: true };
      });
      return { id: uid(), exerciseId: re.exerciseId, restSec: re.restSec, sets };
    });

    workouts.push({
      id: uid(),
      name: routine.name,
      routineId: routine.id,
      startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + (minutes + 8 + rand() * 10) * 60_000).toISOString(),
      exercises,
    });
  }

  const bodyWeights: BodyWeightEntry[] = [];
  for (let i = weeks * 7; i >= 0; i -= 1) {
    if (i % 2 === 1 && rand() < 0.6) continue;
    const d = addDays(today, -i);
    const trend = 84.5 - (1 - i / (weeks * 7)) * 3.2;
    bodyWeights.push({ id: uid(), date: toLocalDate(d), weight: Math.round((trend + (rand() - 0.5) * 0.9) * 10) / 10 });
  }

  const measurements: MeasurementEntry[] = [];
  for (let i = weeks * 7; i >= 0; i -= 14) {
    const p = 1 - i / (weeks * 7);
    measurements.push({
      id: uid(),
      date: toLocalDate(addDays(today, -i)),
      values: {
        chest: +(104 + p * 1.5).toFixed(1),
        waist: +(86 - p * 3.5).toFixed(1),
        hips: +(99 - p * 1).toFixed(1),
        shoulders: +(118 + p * 2).toFixed(1),
        leftArm: +(36 + p * 1.2).toFixed(1),
        rightArm: +(36.4 + p * 1.2).toFixed(1),
        leftThigh: +(58 + p * 0.8).toFixed(1),
        rightThigh: +(58.3 + p * 0.8).toFixed(1),
        bodyFat: +(19 - p * 2.6).toFixed(1),
      },
    });
  }

  return {
    settings: { ...settings, name: settings.name || t('sample.name'), activeSplitId: split.id, goalWeight: settings.goalWeight ?? 80, createdAt: created },
    workouts,
    routines: [...keyToRoutine.values()],
    splits: [split],
    bodyWeights: bodyWeights.sort((a, b) => b.date.localeCompare(a.date)),
    measurements: measurements.sort((a, b) => b.date.localeCompare(a.date)),
    photos: [],
    customExercises: [],
  };
}
