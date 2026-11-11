import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '@/i18n';
import { EXERCISES } from './exercises';
import { localizeExercise } from './localize';

afterEach(() => setLang('en'));

describe('exercise videos (prototype)', () => {
  it('gives the barbell deadlift a video, a thumbnail and credit', () => {
    const v = EXERCISES.find((e) => e.id === 'deadlift')?.video;
    expect(v?.src).toMatch(/^https:\/\/ymove\.app\/api\/free\//);
    expect(v?.poster).toMatch(/type=thumbnail$/);
    expect(v?.credit).toBe('Your Move');
  });

  it('only the deadlift has one', () => {
    expect(EXERCISES.filter((e) => e.video).map((e) => e.id)).toEqual(['deadlift']);
  });

  it('keeps the video in Arabic', () => {
    setLang('ar');
    expect(localizeExercise(EXERCISES.find((e) => e.id === 'deadlift')!).video?.src).toBeDefined();
  });
});
