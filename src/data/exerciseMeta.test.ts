import { describe, expect, it } from 'vitest';
import { PATTERNS } from '@/features/library/figure/patterns';
import { HOME_ROUTINES } from './templates';
import { AR_EQUIPMENT, AR_EXERCISES } from './exercises.ar';
import { EXERCISES } from './exercises';
import { EXERCISE_META, NO_GEAR } from './exerciseMeta';

const byId = new Map(EXERCISES.map((e) => [e.id, e]));
const needsGear = (id: string) => byId.get(id)!.equipment.some((q) => !NO_GEAR.has(q));
const home = EXERCISES.filter((e) => e.homeGroup);

describe('exercise library metadata', () => {
  it('has unique ids and metadata for every exercise, and none for unknown ids', () => {
    expect(byId.size).toBe(EXERCISES.length);
    for (const e of EXERCISES) expect(EXERCISE_META[e.id], e.id).toBeDefined();
    for (const id of Object.keys(EXERCISE_META)) expect(byId.has(id), id).toBe(true);
  });

  it('gives every exercise a level and a body area', () => {
    for (const e of EXERCISES) {
      expect(e.level, e.id).toMatch(/^(Beginner|Intermediate|Advanced)$/);
      expect(e.area, e.id).toBeDefined();
    }
  });

  it('only points alternatives at other real exercises', () => {
    for (const e of EXERCISES) {
      expect(e.alternatives?.length, e.id).toBeGreaterThan(0);
      for (const a of e.alternatives!) {
        expect(byId.has(a), `${e.id} → ${a}`).toBe(true);
        expect(a, e.id).not.toBe(e.id);
      }
    }
  });

  it('offers a no-equipment alternative for every home exercise that needs equipment', () => {
    for (const e of home.filter((x) => needsGear(x.id))) {
      expect(e.alternatives!.some((a) => !needsGear(a)), `${e.id} has no equipment-free alternative`).toBe(true);
    }
  });

  it('lists a broad home library: every body area at every level, in each equipment group', () => {
    expect(home.length).toBeGreaterThanOrEqual(110);
    for (const area of ['chest', 'back', 'shoulders', 'arms', 'legs', 'abs', 'fullbody'] as const) {
      const inArea = home.filter((e) => e.area === area);
      expect(inArea.length, area).toBeGreaterThanOrEqual(5);
    }
    for (const level of ['Beginner', 'Intermediate', 'Advanced'] as const)
      expect(home.filter((e) => e.level === level).length, level).toBeGreaterThanOrEqual(15);
    for (const g of ['bodyweight', 'dumbbell', 'band', 'noequipment'] as const)
      expect(home.filter((e) => e.homeGroup === g).length, g).toBeGreaterThanOrEqual(10);
  });

  it('has an animation, Arabic text and translated equipment for every exercise', () => {
    for (const e of EXERCISES) {
      expect(PATTERNS[e.anim!], `${e.id} anim ${e.anim}`).toBeDefined();
      const ar = AR_EXERCISES[e.id];
      expect(ar, `${e.id} Arabic`).toBeDefined();
      expect(ar[1].length, `${e.id} Arabic steps`).toBe(e.instructions.length);
      expect(ar[2].length, `${e.id} Arabic mistakes`).toBe(e.mistakes.length);
      for (const q of e.equipment) expect(AR_EQUIPMENT[q], `equipment "${q}"`).toBeDefined();
    }
  });

  it('home routines only use library exercises and translated equipment', () => {
    for (const r of HOME_ROUTINES) {
      for (const x of r.exercises) expect(byId.has(x.exerciseId), `${r.id}: ${x.exerciseId}`).toBe(true);
      expect(AR_EQUIPMENT[r.equipment], r.equipment).toBeDefined();
    }
  });
});
