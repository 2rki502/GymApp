import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { toLocalDate } from '@/domain/dates';
import { uid } from '@/domain/id';
import { finalizeWorkout } from '@/domain/workoutOps';
import type {
  BodyWeightEntry, Exercise, ID, MeasurementEntry, ProgressPhotoMeta, Routine, Settings, Split, Workout,
} from '@/domain/types';
import type { RoutineTemplate, SplitPreset } from '@/data/templates';
import { safeStorage } from './storage';

export interface RestTimer {
  startedAt: number;
  endsAt: number;
  duration: number;
  exerciseLogId: ID | null;
}

export interface DataState {
  settings: Settings;
  workouts: Workout[];
  routines: Routine[];
  splits: Split[];
  bodyWeights: BodyWeightEntry[];
  measurements: MeasurementEntry[];
  photos: ProgressPhotoMeta[];
  customExercises: Exercise[];
  session: Workout | null;
  rest: RestTimer | null;
}

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'forge:data';

export function defaultSettings(): Settings {
  return {
    name: '',
    units: 'metric',
    theme: 'dark',
    language: 'en',
    weeklyGoal: 4,
    defaultRestSec: 90,
    restSound: true,
    goalWeight: null,
    activeSplitId: null,
    createdAt: new Date().toISOString(),
  };
}

export function emptyData(): DataState {
  return {
    settings: defaultSettings(),
    workouts: [],
    routines: [],
    splits: [],
    bodyWeights: [],
    measurements: [],
    photos: [],
    customExercises: [],
    session: null,
    rest: null,
  };
}

const now = () => new Date().toISOString();
const byDateDesc = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date);

interface Actions {
  updateSettings: (patch: Partial<Settings>) => void;

  // routines & splits
  saveRoutine: (r: Routine) => void;
  deleteRoutine: (id: ID) => void;
  duplicateRoutine: (id: ID) => ID | null;
  routineFromTemplate: (t: RoutineTemplate) => ID;
  saveSplit: (s: Split) => void;
  deleteSplit: (id: ID) => void;
  applySplitPreset: (p: SplitPreset) => ID;

  // live session
  startSession: (w: Workout) => void;
  updateSession: (fn: (w: Workout) => Workout) => void;
  finishSession: () => Workout | null;
  discardSession: () => void;
  startRest: (sec: number, exerciseLogId: ID | null) => void;
  adjustRest: (deltaSec: number) => void;
  stopRest: () => void;

  // history
  saveWorkout: (w: Workout) => void;
  deleteWorkout: (id: ID) => void;

  // body
  logBodyWeight: (date: string, kg: number) => void;
  deleteBodyWeight: (id: ID) => void;
  saveMeasurement: (m: MeasurementEntry) => void;
  deleteMeasurement: (id: ID) => void;
  addPhoto: (p: ProgressPhotoMeta) => void;
  removePhoto: (id: ID) => void;

  // custom exercises
  saveCustomExercise: (e: Exercise) => void;
  deleteCustomExercise: (id: ID) => boolean;

  // whole-dataset
  replaceAll: (data: Omit<DataState, 'session' | 'rest'>) => void;
  resetAll: () => void;
}

export type Store = DataState & Actions;

export const useData = create<Store>()(
  persist(
    (set, get) => ({
      ...emptyData(),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      saveRoutine: (r) =>
        set((s) => {
          const exists = s.routines.some((x) => x.id === r.id);
          const next = { ...r, updatedAt: now() };
          return { routines: exists ? s.routines.map((x) => (x.id === r.id ? next : x)) : [...s.routines, next] };
        }),
      deleteRoutine: (id) =>
        set((s) => ({
          routines: s.routines.filter((r) => r.id !== id),
          splits: s.splits.map((sp) => ({ ...sp, days: sp.days.map((d) => (d === id ? null : d)) })),
        })),
      duplicateRoutine: (id) => {
        const r = get().routines.find((x) => x.id === id);
        if (!r) return null;
        const copy: Routine = {
          ...r,
          id: uid(),
          name: `${r.name} (copy)`,
          exercises: r.exercises.map((e) => ({ ...e, id: uid() })),
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ routines: [...s.routines, copy] }));
        return copy.id;
      },
      routineFromTemplate: (t) => {
        const r: Routine = {
          id: uid(),
          name: t.name,
          color: t.color,
          note: t.description,
          exercises: t.exercises.map((e) => ({ id: uid(), ...e })),
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ routines: [...s.routines, r] }));
        return r.id;
      },
      saveSplit: (sp) =>
        set((s) => ({
          splits: s.splits.some((x) => x.id === sp.id) ? s.splits.map((x) => (x.id === sp.id ? sp : x)) : [...s.splits, sp],
        })),
      deleteSplit: (id) =>
        set((s) => ({
          splits: s.splits.filter((x) => x.id !== id),
          settings: s.settings.activeSplitId === id ? { ...s.settings, activeSplitId: null } : s.settings,
        })),
      applySplitPreset: (p) => {
        const keyToId = new Map<string, ID>();
        const routines: Routine[] = p.routines.map((pr) => {
          const id = uid();
          keyToId.set(pr.key, id);
          return {
            id,
            name: pr.name,
            color: pr.color,
            exercises: pr.exercises.map((e) => ({ id: uid(), ...e })),
            createdAt: now(),
            updatedAt: now(),
          };
        });
        const split: Split = { id: uid(), name: p.name, days: p.days.map((k) => (k ? keyToId.get(k) ?? null : null)) };
        set((s) => ({
          routines: [...s.routines, ...routines],
          splits: [...s.splits, split],
          settings: { ...s.settings, activeSplitId: split.id },
        }));
        return split.id;
      },

      startSession: (w) => set({ session: w, rest: null }),
      updateSession: (fn) => set((s) => (s.session ? { session: fn(s.session) } : {})),
      finishSession: () => {
        const s = get().session;
        if (!s) return null;
        const done = finalizeWorkout(s);
        set((st) => ({ session: null, rest: null, workouts: done.exercises.length ? [...st.workouts, done] : st.workouts }));
        return done;
      },
      discardSession: () => set({ session: null, rest: null }),
      startRest: (sec, exerciseLogId) => {
        if (sec <= 0) return set({ rest: null });
        const t = Date.now();
        set({ rest: { startedAt: t, endsAt: t + sec * 1000, duration: sec, exerciseLogId } });
      },
      adjustRest: (delta) =>
        set((s) => {
          if (!s.rest) return {};
          const endsAt = s.rest.endsAt + delta * 1000;
          if (endsAt <= Date.now()) return { rest: null };
          return { rest: { ...s.rest, endsAt, duration: Math.max(1, s.rest.duration + delta) } };
        }),
      stopRest: () => set({ rest: null }),

      saveWorkout: (w) =>
        set((s) => ({
          workouts: s.workouts.some((x) => x.id === w.id) ? s.workouts.map((x) => (x.id === w.id ? w : x)) : [...s.workouts, w],
        })),
      deleteWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),

      logBodyWeight: (date, kg) =>
        set((s) => {
          // One entry per day: re-logging the same day replaces it.
          const others = s.bodyWeights.filter((b) => b.date !== date);
          const existing = s.bodyWeights.find((b) => b.date === date);
          return { bodyWeights: [...others, { id: existing?.id ?? uid(), date, weight: kg }].sort(byDateDesc) };
        }),
      deleteBodyWeight: (id) => set((s) => ({ bodyWeights: s.bodyWeights.filter((b) => b.id !== id) })),
      saveMeasurement: (m) =>
        set((s) => ({
          measurements: [...s.measurements.filter((x) => x.id !== m.id), m].sort(byDateDesc),
        })),
      deleteMeasurement: (id) => set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),
      addPhoto: (p) => set((s) => ({ photos: [...s.photos, p].sort(byDateDesc) })),
      removePhoto: (id) => set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),

      saveCustomExercise: (e) =>
        set((s) => ({
          customExercises: s.customExercises.some((x) => x.id === e.id)
            ? s.customExercises.map((x) => (x.id === e.id ? e : x))
            : [...s.customExercises, e],
        })),
      deleteCustomExercise: (id) => {
        const s = get();
        const used =
          s.workouts.some((w) => w.exercises.some((e) => e.exerciseId === id)) ||
          s.routines.some((r) => r.exercises.some((e) => e.exerciseId === id)) ||
          !!s.session?.exercises.some((e) => e.exerciseId === id);
        if (used) return false;
        set({ customExercises: s.customExercises.filter((e) => e.id !== id) });
        return true;
      },

      replaceAll: (data) => set({ ...data, session: null, rest: null }),
      resetAll: () => set({ ...emptyData() }),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): DataState => ({
        settings: s.settings,
        workouts: s.workouts,
        routines: s.routines,
        splits: s.splits,
        bodyWeights: s.bodyWeights,
        measurements: s.measurements,
        photos: s.photos,
        customExercises: s.customExercises,
        session: s.session,
        rest: s.rest,
      }),
      // Future schema changes migrate here, keyed by the stored version.
      migrate: (persisted) => ({ ...emptyData(), ...(persisted as Partial<DataState>) }) as DataState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DataState>;
        return { ...current, ...p, settings: { ...defaultSettings(), ...p.settings } };
      },
    },
  ),
);

export const todayLocal = () => toLocalDate(new Date());
