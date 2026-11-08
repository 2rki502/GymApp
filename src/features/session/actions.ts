import { localizeTemplate } from '@/data/localize';
import type { RoutineTemplate } from '@/data/templates';
import { uid } from '@/domain/id';
import { newWorkout, workoutFromRoutine } from '@/domain/workoutOps';
import type { Routine, Workout } from '@/domain/types';
import { t } from '@/i18n';
import { makeLookup } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { confirm } from '@/ui/dialogs';

/** Start a workout, asking first if one is already in progress. */
export async function beginWorkout(w: Workout): Promise<boolean> {
  const { session, startSession } = useData.getState();
  if (session) {
    const ok = await confirm({
      title: t('session.inProgressTitle'),
      message: t('session.inProgressMsg', { name: session.name }),
      confirmLabel: t('session.discardAndStart'),
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
  const name = h < 11 ? t('session.nameMorning') : h < 17 ? t('session.nameAfternoon') : t('session.nameEvening');
  return beginWorkout(newWorkout(name));
}

export function startRoutine(r: Routine) {
  const lookup = makeLookup(useData.getState().customExercises);
  return beginWorkout(workoutFromRoutine(r, (id) => lookup(id).kind));
}

export function startTemplate(template: RoutineTemplate) {
  const tpl = localizeTemplate(template);
  const now = new Date().toISOString();
  const r: Routine = {
    id: tpl.id,
    name: tpl.name,
    color: tpl.color,
    exercises: tpl.exercises.map((e) => ({ id: uid(), ...e })),
    createdAt: now,
    updatedAt: now,
  };
  return startRoutine(r).then((ok) => {
    // Template sessions aren't linked to a user routine.
    if (ok) useData.getState().updateSession((w) => ({ ...w, routineId: undefined }));
    return ok;
  });
}
