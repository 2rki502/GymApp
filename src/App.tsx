import type { ReactNode } from 'react';
import { ExerciseDetailScreen, ExercisePeekSheet } from '@/features/library/ExerciseDetail';
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
  useThemeSync();
  return (
    <div className="app">
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
