import { t } from '@/i18n';
import { GOALS } from '@/domain/nutrition';
import type { NutritionProfile } from '@/domain/types';
import { defaultSettings, SCHEMA_VERSION, type DataState } from '@/store/useData';

export type BackupData = Omit<DataState, 'session' | 'rest'>;

export interface BackupFile {
  app: 'forge';
  version: number;
  exportedAt: string;
  data: BackupData;
}

export function makeBackup(s: DataState): BackupFile {
  const { session: _session, rest: _rest, ...data } = s;
  return { app: 'forge', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data };
}

const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !isArray(v);
const isArray = Array.isArray;

/** Validate an imported backup. Throws with a user-readable message on failure. */
export function parseBackup(text: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(t('backup.notJson'));
  }
  if (!isObj(raw) || raw.app !== 'forge' || !isObj(raw.data)) throw new Error(t('backup.notForge'));
  if (typeof raw.version !== 'number' || raw.version > SCHEMA_VERSION) {
    throw new Error(t('backup.newer'));
  }
  const d = raw.data;
  const arrays = ['workouts', 'routines', 'splits', 'bodyWeights', 'measurements', 'photos', 'customExercises', 'foodLog'] as const;
  for (const k of arrays) {
    if (d[k] !== undefined && !isArr(d[k])) throw new Error(t('backup.corrupt', { key: k }));
  }
  const workouts = (d.workouts as unknown[] | undefined) ?? [];
  for (const w of workouts) {
    if (!isObj(w) || typeof w.id !== 'string' || typeof w.startedAt !== 'string' || !isArr(w.exercises)) {
      throw new Error(t('backup.badWorkout'));
    }
  }
  return {
    settings: { ...defaultSettings(), ...(isObj(d.settings) ? (d.settings as object) : {}) },
    workouts: workouts as BackupData['workouts'],
    routines: (d.routines as BackupData['routines']) ?? [],
    splits: (d.splits as BackupData['splits']) ?? [],
    bodyWeights: (d.bodyWeights as BackupData['bodyWeights']) ?? [],
    measurements: (d.measurements as BackupData['measurements']) ?? [],
    // Photo blobs aren't part of JSON backups; drop metadata that would point nowhere.
    photos: [],
    customExercises: (d.customExercises as BackupData['customExercises']) ?? [],
    // Older backups have no nutrition data: the user is offered onboarding again.
    nutrition: validProfile(d.nutrition) ? d.nutrition : null,
    nutritionSkipped: d.nutritionSkipped === true,
    foodLog: ((d.foodLog as unknown[] | undefined) ?? []).filter(validFood) as BackupData['foodLog'],
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validProfile(v: unknown): v is NutritionProfile {
  return isObj(v) && GOALS.includes(v.goal as NutritionProfile['goal']) && isNum(v.birthYear) && isNum(v.heightCm) && isNum(v.weightKg)
    && (v.sex === 'male' || v.sex === 'female') && typeof v.activity === 'string';
}

function validFood(v: unknown): boolean {
  return isObj(v) && typeof v.id === 'string' && typeof v.date === 'string' && typeof v.name === 'string'
    && isNum(v.kcal) && isNum(v.protein) && isNum(v.carbs) && isNum(v.fat);
}

export function downloadJSON(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
