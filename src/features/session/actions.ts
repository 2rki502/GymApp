import { newWorkout, workoutFromRoutine } from '@/domain/workoutOps';
import type { Routine, Workout } from '@/domain/types';
import { makeLookup } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { confirm } from '@/ui/dialogs';
import type { RoutineTemplate } from '@/data/templates';
import { uid } from '@/domain/id';

/** Start a workout, asking first if one is already in progress. */
export async function beginWorkout(w: Workout): Promise<boolean> {
  const { session, startSession } = useData.getState();
  if (session) {
    const ok = await confirm({
      title: 'Workout in progress',
      message: `Discard "${session.name}" and start a new workout?`,
      confirmLabel: 'Discard & Start',
      destructive: true,
    });
    if (!ok) {
      useUI.getState().set({ sessionOpen: true });
      return false;
    }
  }
  startSession(w);
  useUI.getState().set({ sessionOpen: true });
  return true;
}

export function startEmptyWorkout() {
  const h = new Date().getHours();
  const name = h < 11 ? 'Morning Workout' : h < 17 ? 'Afternoon Workout' : 'Evening Workout';
  return beginWorkout(newWorkout(name));
}

export function startRoutine(r: Routine) {
  const lookup = makeLookup(useData.getState().customExercises);
  return beginWorkout(workoutFromRoutine(r, (id) => lookup(id).kind));
}

export function startTemplate(t: RoutineTemplate) {
  const now = new Date().toISOString();
  const r: Routine = {
    id: t.id,
    name: t.name,
    color: t.color,
    exercises: t.exercises.map((e) => ({ id: uid(), ...e })),
    createdAt: now,
    updatedAt: now,
  };
  return startRoutine(r).then((ok) => {
    // Template sessions aren't linked to a user routine.
    if (ok) useData.getState().updateSession((w) => ({ ...w, routineId: undefined }));
    return ok;
  });
}
