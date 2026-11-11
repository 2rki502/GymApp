import { useEffect, useMemo, type ReactNode } from 'react';
import { applyLanguage, setLang } from '@/i18n';
import { onboardingSteps } from '@/lib/onboarding';
import { AUTH_ENABLED, useAuth } from '@/store/useAuth';
import { useData } from '@/store/useData';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { ExerciseDetailScreen, ExercisePeekSheet } from '@/features/library/ExerciseDetail';
import { NutritionScreen } from '@/features/nutrition/NutritionScreen';
import { Onboarding } from '@/features/nutrition/Onboarding';
import { LibraryScreen } from '@/features/library/Library';
import { TemplateDetailScreen } from '@/features/library/TemplateDetail';
import { HomeScreen } from '@/features/home/Home';
import { ProfileScreen } from '@/features/profile/Profile';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
import { ExerciseProgressScreen } from '@/features/progress/StrengthTab';
import { RestWatcher, SessionMiniBar, SessionView, SummarySheet } from '@/features/session/Session';
import { RoutineEditorScreen } from '@/features/workouts/RoutineEditor';
import { SplitEditorScreen } from '@/features/workouts/SplitEditor';
import { WorkoutDetailScreen } from '@/features/workouts/WorkoutDetail';
import { WorkoutsScreen } from '@/features/workouts/WorkoutsScreen';
import { match, useRouter } from '@/lib/router';
import { useThemeSync } from '@/lib/theme';
import { DialogHost } from '@/ui/dialogs';
import { TabBar } from '@/ui/TabBar';
import { ErrorBoundary } from './ErrorBoundary';

type RouteDef = [pattern: string, render: (p: Record<string, string>) => ReactNode];

const ROUTES: RouteDef[] = [
  ['/', () => <HomeScreen />],
  ['/nutrition', () => <NutritionScreen />],
  ['/workouts', () => <WorkoutsScreen />],
  ['/workouts/routine/:id', (p) => <RoutineEditorScreen key={p.id} id={p.id} />],
  ['/workouts/history/:id', (p) => <WorkoutDetailScreen key={p.id} id={p.id} />],
  ['/workouts/split/:id', (p) => <SplitEditorScreen key={p.id} id={p.id} />],
  ['/progress', () => <ProgressScreen />],
  ['/progress/exercise/:id', (p) => <ExerciseProgressScreen id={p.id} />],
  ['/library', () => <LibraryScreen />],
  ['/library/exercise/:id', (p) => <ExerciseDetailScreen id={p.id} />],
  ['/library/routine/:id', (p) => <TemplateDetailScreen id={p.id} />],
  ['/profile', () => <ProfileScreen />],
];

function resolve(path: string): ReactNode {
  for (const [pattern, render] of ROUTES) {
    const params = match(pattern, path);
    if (params) return render(params);
  }
  return <HomeScreen />;
}

export function App() {
  const { path, direction } = useRouter();
  const lang = useData((s) => s.settings.language);
  // Set synchronously so every t() call in this render uses the new language,
  // then sync <html lang/dir>. Keying the tree by language remounts it cleanly.
  setLang(lang);
  useEffect(() => applyLanguage(lang), [lang]);
  useThemeSync();
  const signedIn = useAuth((s) => s.user !== null);
  const nutrition = useData((s) => s.nutrition);
  const activeSplitId = useData((s) => s.settings.activeSplitId);
  const splits = useData((s) => s.splits);
  const steps = useMemo(() => onboardingSteps({ nutrition, settings: { activeSplitId }, splits }), [nutrition, activeSplitId, splits]);
  if (AUTH_ENABLED && !signedIn) {
    return (
      <div className="app" key={lang}>
        <AuthScreen />
        <DialogHost />
      </div>
    );
  }
  // First run: nutrition targets and a training split are both required before entering the app.
  if (steps.length > 0) {
    return (
      <div className="app" key={lang}>
        <Onboarding steps={steps} />
        <DialogHost />
      </div>
    );
  }
  return (
    <div className="app" key={lang}>
      <div key={path} className={`page page-${direction}`}>
        <ErrorBoundary key={path}>{resolve(path)}</ErrorBoundary>
      </div>
      <SessionMiniBar />
      <TabBar />
      <ErrorBoundary>
        <SessionView />
      </ErrorBoundary>
      <SummarySheet />
      <ExercisePeekSheet />
      <RestWatcher />
      <DialogHost />
    </div>
  );
}
