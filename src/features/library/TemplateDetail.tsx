import { fmtReps, levelLabel, localizeTemplate } from '@/data/localize';
import { HOME_ROUTINES } from '@/data/templates';
import { startTemplate } from '@/features/session/actions';
import { t } from '@/i18n';
import { navigate } from '@/lib/router';
import { useExerciseLookup } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { EmptyState } from '@/ui/controls';
import { toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { ExerciseThumb } from './figure/Figure';
import './library.css';

export function TemplateDetailScreen({ id }: { id: string }) {
  const raw = HOME_ROUTINES.find((x) => x.id === id);
  const lookup = useExerciseLookup();
  const fromTemplate = useData((s) => s.routineFromTemplate);
  const back = { label: t('lib.title'), to: '/library' };

  if (!raw) {
    return (
      <Screen title={t('tpl.title')} back={back}>
        <EmptyState icon="info" title={t('tpl.notFound')} />
      </Screen>
    );
  }
  const tpl = localizeTemplate(raw);
  const totalSets = tpl.exercises.reduce((n, e) => n + e.sets, 0);

  return (
    <Screen title={tpl.name} back={back}>
      <div className={`tpl-hero color-${tpl.color}`}>
        <span className="tpl-glow" />
        <span className="badge">{levelLabel(tpl.level)}</span>
        <h1>{tpl.name}</h1>
        <p>{tpl.description}</p>
        <div className="tpl-hero-stats">
          <span>
            <Icon name="clock" size={15} /> {t('time.minutesApprox', { n: tpl.minutes })}
          </span>
          <span>
            <Icon name="layers" size={15} /> {t('n.sets', { n: totalSets })}
          </span>
          <span>
            <Icon name="dumbbell" size={15} /> {tpl.equipment}
          </span>
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button
          className="btn"
          onClick={() => {
            fromTemplate(tpl);
            useUI.getState().set({ workoutsTab: 'routines' });
            toast(t('tpl.saved'), 'success');
          }}
        >
          <Icon name="plus" size={18} /> {t('common.save')}
        </button>
        <button className="btn btn-primary" onClick={() => startTemplate(raw)}>
          <Icon name="play" size={16} fill /> {t('common.start')}
        </button>
      </div>

      <h2 className="lib-section">{t('tpl.exercises')}</h2>
      <div className="group-body">
        {tpl.exercises.map((e, i) => {
          const ex = lookup(e.exerciseId);
          return (
            <button key={i} className="row is-tappable" onClick={() => navigate(`/library/exercise/${ex.id}`)}>
              <span className="ex-thumb ex-thumb-sm">
                <ExerciseThumb anim={ex.anim} video={ex.video} />
              </span>
              <span className="row-main">
                <span className="row-label">{ex.name}</span>
                <span className="row-detail">
                  {t('tpl.rowDetail', { sets: e.sets, reps: fmtReps(e.reps), rest: t('time.seconds', { n: e.restSec }) })}
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
