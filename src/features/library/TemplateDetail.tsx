import { HOME_ROUTINES } from '@/data/templates';
import { navigate } from '@/lib/router';
import { useExerciseLookup } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { EmptyState } from '@/ui/controls';
import { toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { startTemplate } from '@/features/session/actions';
import { ExerciseThumb } from './figure/Figure';
import './library.css';

export function TemplateDetailScreen({ id }: { id: string }) {
  const t = HOME_ROUTINES.find((x) => x.id === id);
  const lookup = useExerciseLookup();
  const fromTemplate = useData((s) => s.routineFromTemplate);

  if (!t) {
    return (
      <Screen title="Routine" back={{ label: 'Library', to: '/library' }}>
        <EmptyState icon="info" title="Routine not found" />
      </Screen>
    );
  }
  const totalSets = t.exercises.reduce((n, e) => n + e.sets, 0);

  return (
    <Screen title={t.name} back={{ label: 'Library', to: '/library' }}>
      <div className={`tpl-hero color-${t.color}`}>
        <span className="tpl-glow" />
        <span className="badge">{t.level}</span>
        <h1>{t.name}</h1>
        <p>{t.description}</p>
        <div className="tpl-hero-stats">
          <span><Icon name="clock" size={15} /> ~{t.minutes} min</span>
          <span><Icon name="layers" size={15} /> {totalSets} sets</span>
          <span><Icon name="dumbbell" size={15} /> {t.equipment}</span>
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button
          className="btn"
          onClick={() => {
            fromTemplate(t);
            useUI.getState().set({ workoutsTab: 'routines' });
            toast('Saved to My Routines', 'success');
          }}
        >
          <Icon name="plus" size={18} /> Save
        </button>
        <button className="btn btn-primary" onClick={() => startTemplate(t)}>
          <Icon name="play" size={16} fill /> Start
        </button>
      </div>

      <h2 className="lib-section">Exercises</h2>
      <div className="group-body">
        {t.exercises.map((e, i) => {
          const ex = lookup(e.exerciseId);
          return (
            <button key={i} className="row is-tappable" onClick={() => navigate(`/library/exercise/${ex.id}`)}>
              <span className="ex-thumb ex-thumb-sm">
                <ExerciseThumb anim={ex.anim} />
              </span>
              <span className="row-main">
                <span className="row-label">{ex.name}</span>
                <span className="row-detail">
                  {e.sets} × {e.reps} · rest {e.restSec}s
                </span>
              </span>
              <Icon name="chevronRight" size={16} stroke={2.4} className="row-chevron" />
            </button>
          );
        })}
      </div>
    </Screen>
  );
}
