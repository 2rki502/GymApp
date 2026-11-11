import { describe, expect, it } from 'vitest';
import { onboardingSteps } from './onboarding';

const state = (o: { nutrition?: boolean; activeSplitId?: string | null; splits?: string[] }) => ({
  nutrition: o.nutrition ? {} : null,
  settings: { activeSplitId: o.activeSplitId ?? null },
  splits: (o.splits ?? []).map((id) => ({ id })),
});

describe('onboarding steps', () => {
  it('asks a new user every question, with the training split right after the goal', () => {
    expect(onboardingSteps(state({}))).toEqual(['goal', 'split', 'about', 'body', 'activity', 'result']);
  });

  it('asks only for the split when nutrition is already set up', () => {
    expect(onboardingSteps(state({ nutrition: true }))).toEqual(['split']);
  });

  it('treats an active split that no longer exists as missing', () => {
    expect(onboardingSteps(state({ nutrition: true, activeSplitId: 'gone', splits: ['other'] }))).toEqual(['split']);
  });

  it('lets the user in once nutrition and an existing split are set', () => {
    expect(onboardingSteps(state({ nutrition: true, activeSplitId: 's1', splits: ['s1'] }))).toEqual([]);
  });

  it('still asks the nutrition questions, without the split, when only nutrition is missing', () => {
    expect(onboardingSteps(state({ activeSplitId: 's1', splits: ['s1'] }))).toEqual(['goal', 'about', 'body', 'activity', 'result']);
  });
});
