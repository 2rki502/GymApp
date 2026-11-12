import { describe, expect, it } from 'vitest';
import { TABS, tabOf } from './router';

describe('bottom tabs', () => {
  it('are Home, Workouts, Nutrition (middle, most used), Progress, Library', () => {
    expect([...TABS]).toEqual(['/', '/workouts', '/nutrition', '/progress', '/library']);
  });

  it('give Nutrition its own tab', () => {
    expect(tabOf('/nutrition')).toBe('/nutrition');
  });

  it('keeps Profile under Home (opened from the avatar)', () => {
    expect(tabOf('/profile')).toBe('/');
  });

  it('keeps nested screens in their tab', () => {
    expect(tabOf('/library/exercise/deadlift')).toBe('/library');
    expect(tabOf('/workouts/routine/abc')).toBe('/workouts');
    expect(tabOf('/progress/exercise/x')).toBe('/progress');
  });
});
