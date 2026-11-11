export type OnboardingStep = 'goal' | 'split' | 'about' | 'body' | 'activity' | 'result';

interface OnboardingState {
  nutrition: unknown;
  settings: { activeSplitId: string | null };
  splits: { id: string }[];
}

/**
 * The start-up questions this user still has to answer (empty = straight into the app).
 * Both parts are required: nutrition targets and an active training split. Someone who
 * already has one is only asked for the other.
 */
export function onboardingSteps(s: OnboardingState): OnboardingStep[] {
  const needsNutrition = s.nutrition === null;
  const needsSplit = !s.splits.some((sp) => sp.id === s.settings.activeSplitId);
  const steps: OnboardingStep[] = [];
  if (needsNutrition) steps.push('goal');
  if (needsSplit) steps.push('split');
  if (needsNutrition) steps.push('about', 'body', 'activity', 'result');
  return steps;
}
