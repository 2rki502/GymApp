import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '@/i18n';
import { addDays, startOfWeek, toLocalDate, weekdayIndex, weekdayLetter } from './dates';
import { weeklyStreak } from './stats';
import type { Workout } from './types';

afterEach(() => setLang('en'));

// Wednesday 11 Nov 2026
const wed = new Date(2026, 10, 11, 12);

const workoutOn = (d: Date): Workout => ({
  id: toLocalDate(d), name: 'W', startedAt: d.toISOString(), endedAt: new Date(d.getTime() + 3600_000).toISOString(), exercises: [],
});

describe('week start by language', () => {
  it('starts the week on Monday in English', () => {
    expect(toLocalDate(startOfWeek(wed))).toBe('2026-11-09');
  });

  it('starts the week on Sunday in Arabic', () => {
    setLang('ar');
    expect(toLocalDate(startOfWeek(wed))).toBe('2026-11-08');
    expect(toLocalDate(startOfWeek(new Date(2026, 10, 8, 9)))).toBe('2026-11-08'); // a Sunday is its own week start
  });

  it('uses the Arabic day letters, Sunday to Saturday: أ ث ث ر خ ج س', () => {
    setLang('ar');
    const sunday = startOfWeek(wed);
    const letters = Array.from({ length: 7 }, (_, i) => weekdayLetter(weekdayIndex(addDays(sunday, i))));
    expect(letters).toEqual(['أ', 'ث', 'ث', 'ر', 'خ', 'ج', 'س']);
  });

  it('counts a Sunday workout in the current week in Arabic, and in the previous week in English', () => {
    const sunday = [workoutOn(new Date(2026, 10, 8, 18))];
    expect(weeklyStreak(sunday, 4, wed).thisWeek).toBe(0);
    setLang('ar');
    expect(weeklyStreak(sunday, 4, wed).thisWeek).toBe(1);
  });
});
