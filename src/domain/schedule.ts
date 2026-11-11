import type { SplitPreset } from '@/data/templates';

/**
 * Rotate a Monday-first weekly plan so its day 1 falls on weekday `start` (0 = Monday).
 * Presets are written as "day 1 = Monday"; this makes a plan begin the day it is picked
 * instead of mid-cycle (e.g. Legs, because it happened to be Wednesday).
 */
export function startOn<T>(days: T[], start: number): T[] {
  const n = days.length;
  const out = new Array<T>(n);
  for (let i = 0; i < n; i++) out[(start + i) % n] = days[i];
  return out;
}

export const trainingDayCount = (days: (string | null)[]): number => days.filter((d) => d !== null).length;

/** A plan built from the template workouts: keeps only the workouts used, once each. */
export function customPreset(days: (string | null)[], catalog: SplitPreset[], name: string): SplitPreset {
  const used = new Set(days.filter((d): d is string => d !== null));
  const routines: SplitPreset['routines'] = [];
  for (const p of catalog)
    for (const r of p.routines)
      if (used.has(r.key) && !routines.some((x) => x.key === r.key)) routines.push(r);
  return { id: 'custom', name, description: '', routines, days };
}
