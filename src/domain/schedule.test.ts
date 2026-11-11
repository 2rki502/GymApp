import { describe, expect, it } from 'vitest';
import type { SplitPreset } from '@/data/templates';
import { customPreset, startOn, trainingDayCount } from './schedule';

const ppl = ['push', 'pull', 'legs', 'push', 'pull', 'legs', null];

describe('schedule', () => {
  it('starts a Monday-first plan on Wednesday (index 2) with day 1 of the plan', () => {
    expect(startOn(ppl, 2)).toEqual(['legs', null, 'push', 'pull', 'legs', 'push', 'pull']);
  });

  it('leaves a plan picked on Monday unchanged', () => {
    expect(startOn(ppl, 0)).toEqual(ppl);
  });

  it('puts day 1 on Sunday when started on a Sunday (index 6)', () => {
    expect(startOn(ppl, 6)[6]).toBe('push');
    expect(startOn(ppl, 6)[0]).toBe('pull');
  });

  it('counts training days', () => {
    expect(trainingDayCount(ppl)).toBe(6);
    expect(trainingDayCount([null, null, null, null, null, null, null])).toBe(0);
  });

  it('builds a custom plan with only the workouts it uses, each once', () => {
    const catalog: SplitPreset[] = [
      { id: 'a', name: 'A', description: '', days: [], routines: [
        { key: 'push', name: 'Push', color: 'orange', exercises: [] },
        { key: 'pull', name: 'Pull', color: 'blue', exercises: [] },
      ] },
      { id: 'b', name: 'B', description: '', days: [], routines: [{ key: 'upper', name: 'Upper', color: 'blue', exercises: [] }] },
    ];
    const days = ['push', null, 'upper', 'push', null, null, null];
    const p = customPreset(days, catalog, 'My Schedule');
    expect(p.name).toBe('My Schedule');
    expect(p.days).toEqual(days);
    expect(p.routines.map((r) => r.key)).toEqual(['push', 'upper']);
  });
});
