import { useMemo, useState } from 'react';
import { englishName } from '@/data/localize';
import { formatLongDate, formatShortDate } from '@/domain/dates';
import { exerciseHistory, finished } from '@/domain/metrics';
import { fmtNumber, fmtWeight, toDisplayWeight, weightUnit } from '@/domain/units';
import type { ID } from '@/domain/types';
import { ExerciseThumb } from '@/features/library/figure/Figure';
import { prLabel } from '@/features/session/Session';
import { t } from '@/i18n';
import { navigate } from '@/lib/router';
import { useExerciseLookup, usePRs } from '@/store/selectors';
import { useData } from '@/store/useData';
import { LineChart, Sparkline } from '@/ui/charts';
import { EmptyState, Segmented } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { formatPR } from './ProgressScreen';

export function StrengthTab() {
  const workouts = useData((s) => s.workouts);
  const units = useData((s) => s.settings.units);
  const lookup = useExerciseLookup();
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    const last = new Map<ID, string>();
    for (const w of finished(workouts)) for (const e of w.exercises) if ((last.get(e.exerciseId) ?? '') < w.startedAt) last.set(e.exerciseId, w.startedAt);
    const needle = q.toLowerCase();
    return [...last.entries()]
      .sort((a, b) => b[1].localeCompare(a[1]))
      .map(([id, date]) => {
        const ex = lookup(id);
        const h = exerciseHistory(workouts, id, ex.kind);
        const values = h.map((s) => (ex.kind === 'weight' ? s.e1rm : ex.kind === 'time' ? s.maxDuration : s.maxReps));
        return { ex, date, sessions: h.length, values, best: Math.max(0, ...values) };
      })
      .filter((i) => i.ex.name.toLowerCase().includes(needle) || englishName(i.ex.id).toLowerCase().includes(needle));
  }, [workouts, lookup, q]);

  if (!finished(workouts).length) {
    return <EmptyState icon="trophy" title={t('st.emptyTitle')} text={t('st.emptyText')} />;
  }

  return (
    <>
      <div className="search" style={{ marginTop: 12 }}>
        <Icon name="search" size={18} />
        <input type="search" placeholder={t('st.find')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="strength-list">
        {items.map(({ ex, date, sessions, values, best }) => (
          <button key={ex.id} className="card card-tappable strength-item" onClick={() => navigate(`/progress/exercise/${ex.id}`)}>
            <span className="ex-thumb ex-thumb-sm">
              <ExerciseThumb anim={ex.anim} video={ex.video} />
            </span>
            <span className="strength-main">
              <strong>{ex.name}</strong>
              <span className="muted">
                {t('n.sessions', { n: sessions })} · {formatShortDate(date)}
              </span>
            </span>
            <span className="strength-spark">
              {values.length > 1 ? <Sparkline values={values.slice(-12)} height={30} /> : null}
              <span className="num">
                {ex.kind === 'weight' ? fmtNumber(toDisplayWeight(best, units), 0) : fmtNumber(best, 0)}
                <small> {ex.kind === 'weight' ? weightUnit(units) : ex.kind === 'time' ? t('unit.s') : t('unit.reps', { n: best })}</small>
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="faint swipe-hint">{t('st.e1rmNote')}</p>
    </>
  );
}

type Metric = 'e1rm' | 'weight';

export function ExerciseProgressScreen({ id }: { id: string }) {
  const lookup = useExerciseLookup();
  const ex = lookup(id);
  const workouts = useData((s) => s.workouts);
  const units = useData((s) => s.settings.units);
  const { bests, events } = usePRs();
  const [metric, setMetric] = useState<Metric>('e1rm');
  const history = useMemo(() => exerciseHistory(workouts, id, ex.kind), [workouts, id, ex.kind]);
  const best = bests.get(id);
  const prs = useMemo(() => events.filter((e) => e.exerciseId === id).sort((a, b) => b.date.localeCompare(a.date)), [events, id]);

  const data = history.map((s) => ({
    x: new Date(s.date).getTime(),
    y: ex.kind === 'weight' ? toDisplayWeight(metric === 'e1rm' ? s.e1rm : s.topWeight, units) : ex.kind === 'time' ? s.maxDuration : s.maxReps,
  }));
  const unit = ex.kind === 'weight' ? weightUnit(units) : ex.kind === 'time' ? t('unit.s') : t('unit.reps', { n: 5 });

  return (
    <Screen
      title={ex.name}
      back={{ label: t('pg.title'), to: '/progress' }}
      right={
        <button className="nav-btn" onClick={() => navigate(`/library/exercise/${id}`)} aria-label={t('st.guide')}>
          <Icon name="info" />
        </button>
      }
    >
      <h1 className="guide-title">{ex.name}</h1>
      {history.length === 0 ? (
        <EmptyState icon="chart" title={t('st.noSessions')} text={t('st.noSessionsText')} />
      ) : (
        <>
          <div className={`stat-grid ${ex.kind === 'weight' ? 'stat-grid-3' : ''}`}>
            {ex.kind === 'weight' ? (
              <>
                <div className="stat">
                  <div className="stat-label">{t('st.e1rm')}</div>
                  <div className="stat-value num">
                    {fmtNumber(toDisplayWeight(best?.e1rm ?? 0, units), 1)}
                    <small>{unit}</small>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">{t('st.heaviest')}</div>
                  <div className="stat-value num">
                    {fmtNumber(toDisplayWeight(best?.weight ?? 0, units), 1)}
                    <small>{unit}</small>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">{t('stat.sessions')}</div>
                  <div className="stat-value num">{history.length}</div>
                </div>
              </>
            ) : (
              <>
                <div className="stat">
                  <div className="stat-label">{ex.kind === 'time' ? t('st.longestHold') : t('st.mostReps')}</div>
                  <div className="stat-value num">
                    {ex.kind === 'time' ? best?.duration ?? 0 : best?.reps ?? 0}
                    <small>{unit}</small>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">{t('stat.sessions')}</div>
                  <div className="stat-value num">{history.length}</div>
                </div>
              </>
            )}
          </div>

          <div className="card chart-card">
            {ex.kind === 'weight' && (
              <Segmented
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'e1rm', label: t('st.e1rm') },
                  { value: 'weight', label: t('st.heaviest') },
                ]}
              />
            )}
            <div style={{ marginTop: 12 }}>
              <LineChart
                data={data}
                height={210}
                ariaLabel={t('st.progressAria', { name: ex.name })}
                formatY={(v) => fmtNumber(v, 1)}
                formatX={(x) => formatShortDate(new Date(x))}
                emptyText={t('st.moreSessions')}
              />
            </div>
          </div>

          {prs.length > 0 && (
            <>
              <h2 className="wk-section">{t('st.timeline')}</h2>
              <div className="group-body">
                {prs.slice(0, 8).map((p) => (
                  <div key={`${p.workoutId}-${p.kind}`} className="row">
                    <span className="row-icon" style={{ background: 'rgba(255,210,90,.16)', color: 'var(--gold)' }}>
                      <Icon name="trophy" size={16} />
                    </span>
                    <span className="row-main">
                      <span className="row-label">{prLabel(p.kind)}</span>
                      <span className="row-detail">{formatLongDate(p.date)}</span>
                    </span>
                    <span className="row-value num">{formatPR(p.kind, p.value, units)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="wk-section">{t('stat.sessions')}</h2>
          <div className="group-body">
            {[...history].reverse().map((s) => (
              <button key={s.workoutId} className="row is-tappable" onClick={() => navigate(`/workouts/history/${s.workoutId}`)}>
                <span className="row-main">
                  <span className="row-label">{formatLongDate(s.date)}</span>
                  <span className="row-detail num" dir="ltr">
                    {s.sets
                      .map((x) =>
                        ex.kind === 'time' ? t('time.seconds', { n: x.duration ?? 0 }) : ex.kind === 'reps' ? `${x.reps}` : `${fmtWeight(x.weight ?? 0, units, false)}×${x.reps}`,
                      )
                      .join('  ')}
                  </span>
                </span>
                <Icon name="chevronRight" size={16} stroke={2.4} className="row-chevron" />
              </button>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
