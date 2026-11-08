import { useMemo, useState } from 'react';
import { muscleLabel } from '@/data/localize';
import { addDays, formatDuration, formatShortDate, startOfDay } from '@/domain/dates';
import { comparePeriod, inRange, muscleDistribution, weeklyBuckets, weeklyStreak, type PeriodSummary } from '@/domain/stats';
import { fmtNumber, toDisplayWeight, weightUnit } from '@/domain/units';
import { prLabel } from '@/features/session/Session';
import { startEmptyWorkout } from '@/features/session/actions';
import { t } from '@/i18n';
import { navigate } from '@/lib/router';
import { useExerciseLookup, usePRs } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { BarChart } from '@/ui/charts';
import { EmptyState, Segmented } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { BodyTab } from './BodyTab';
import { PhotosTab } from './PhotosTab';
import { StrengthTab } from './StrengthTab';
import './progress.css';

export function ProgressScreen() {
  const tab = useUI((s) => s.progressTab);
  const setUI = useUI((s) => s.set);
  return (
    <Screen
      title={t('pg.title')}
      large
      header={
        <div className="wk-seg">
          <Segmented
            value={tab}
            onChange={(v) => setUI({ progressTab: v })}
            options={[
              { value: 'overview', label: t('pg.overview') },
              { value: 'body', label: t('pg.body') },
              { value: 'strength', label: t('pg.strength') },
              { value: 'photos', label: t('pg.photos') },
            ]}
          />
        </div>
      }
    >
      {tab === 'overview' && <OverviewTab />}
      {tab === 'body' && <BodyTab />}
      {tab === 'strength' && <StrengthTab />}
      {tab === 'photos' && <PhotosTab />}
    </Screen>
  );
}

export function Delta({ cur, prev, unit = '', invert, format = (n: number) => fmtNumber(n, 0) }: { cur: number; prev: number; unit?: string; invert?: boolean; format?: (n: number) => string }) {
  const diff = cur - prev;
  if (prev === 0 && cur === 0) return <span className="delta flat">—</span>;
  if (Math.abs(diff) < 1e-9) return <span className="delta flat">{t('common.same')}</span>;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={`delta ${good ? 'up' : 'down'}`}>
      <Icon name={diff > 0 ? 'arrowUp' : 'arrowDown'} size={12} stroke={2.8} />
      {format(Math.abs(diff))}
      {unit}
    </span>
  );
}

function OverviewTab() {
  const workouts = useData((s) => s.workouts);
  const settings = useData((s) => s.settings);
  const lookup = useExerciseLookup();
  const { events } = usePRs();
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [metric, setMetric] = useState<'workouts' | 'duration'>('workouts');
  const units = settings.units;

  const cmp = useMemo(() => comparePeriod(workouts, period), [workouts, period]);
  const weeks = useMemo(() => weeklyBuckets(workouts, 12), [workouts]);
  const streak = useMemo(() => weeklyStreak(workouts, settings.weeklyGoal), [workouts, settings.weeklyGoal]);
  const muscles = useMemo(() => {
    const now = new Date();
    return muscleDistribution(inRange(workouts, addDays(startOfDay(now), -29), addDays(now, 1)), (id) => lookup(id).primary).slice(0, 8);
  }, [workouts, lookup]);
  const recentPRs = useMemo(() => [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6), [events]);

  if (!workouts.some((w) => w.endedAt)) {
    return (
      <EmptyState
        icon="chart"
        title={t('pg.emptyTitle')}
        text={t('pg.emptyText')}
        action={
          <button className="btn btn-primary" onClick={() => startEmptyWorkout()}>
            {t('wk.startWorkout')}
          </button>
        }
      />
    );
  }

  const tile = (label: string, k: keyof PeriodSummary, fmt: (n: number) => string) => (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value num">{fmt(cmp.current[k])}</div>
      <Delta cur={cmp.current[k]} prev={cmp.previous[k]} format={fmt} />
    </div>
  );

  const barData = weeks.map((w, i) => ({
    label: i === weeks.length - 1 ? t('common.now') : String(w.start.getDate()),
    value: metric === 'workouts' ? w.workouts : w.durationSec / 60,
    tip: t('common.weekOf', { date: formatShortDate(w.start) }),
    highlight: i === weeks.length - 1,
  }));
  const maxMuscle = Math.max(1, ...muscles.map((m) => m.sets));

  return (
    <>
      <div className="ov-period">
        <h2>{period === 'week' ? t('pg.thisWeek') : t('pg.thisMonth')}</h2>
        <Segmented
          className="ov-period-seg"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: t('pg.week') },
            { value: 'month', label: t('pg.month') },
          ]}
        />
      </div>
      <p className="faint ov-sub">{period === 'week' ? t('pg.compareWeek') : t('pg.compareMonth')}</p>
      <div className="stat-grid stat-grid-3">
        {tile(t('stat.workouts'), 'workouts', (n) => fmtNumber(n, 0))}
        {tile(t('stat.time'), 'durationSec', (n) => formatDuration(n))}
        {tile(t('stat.sets'), 'sets', (n) => fmtNumber(n, 0))}
      </div>

      <div className="card chart-card">
        <div className="chart-card-head">
          <div>
            <div className="eyebrow">{t('pg.last12')}</div>
            <h3>{metric === 'workouts' ? t('pg.perWeek') : t('pg.minPerWeek')}</h3>
          </div>
        </div>
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'workouts', label: t('stat.workouts') },
            { value: 'duration', label: t('stat.time') },
          ]}
        />
        <div style={{ marginTop: 14 }}>
          <BarChart data={barData} height={170} ariaLabel={t('pg.chartAria')} formatY={(v) => fmtNumber(v, 0)} />
        </div>
      </div>

      <div className="card streak-card">
        <Icon name="flame" size={26} />
        <div>
          <strong className="num">{t('n.weeks', { n: streak.weeks })}</strong>
          <span className="muted">{t('pg.streakText', { goal: streak.goal, n: streak.thisWeek })}</span>
        </div>
      </div>

      {muscles.length > 0 && (
        <div className="card">
          <div className="eyebrow">{t('pg.last30')}</div>
          <h3 className="card-h">{t('pg.muscleSets')}</h3>
          <div className="muscle-bars">
            {muscles.map((m) => (
              <div key={m.muscle} className="muscle-bar">
                <span>{muscleLabel(m.muscle)}</span>
                <div className="muscle-track">
                  <div style={{ width: `${(m.sets / maxMuscle) * 100}%` }} />
                </div>
                <span className="num">{m.sets}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentPRs.length > 0 && (
        <>
          <h2 className="wk-section">{t('pg.recentPRs')}</h2>
          <div className="group-body">
            {recentPRs.map((p) => (
              <button key={`${p.workoutId}-${p.exerciseId}-${p.kind}`} className="row is-tappable" onClick={() => navigate(`/progress/exercise/${p.exerciseId}`)}>
                <span className="row-icon" style={{ background: 'rgba(255,210,90,.16)', color: 'var(--gold)' }}>
                  <Icon name="trophy" size={16} />
                </span>
                <span className="row-main">
                  <span className="row-label">{lookup(p.exerciseId).name}</span>
                  <span className="row-detail">
                    {prLabel(p.kind)} · {formatShortDate(p.date)}
                  </span>
                </span>
                <span className="row-value num">{formatPR(p.kind, p.value, units)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function formatPR(kind: string, value: number, units: 'metric' | 'imperial'): string {
  if (kind === 'reps') return t('n.reps', { n: value });
  if (kind === 'duration') return t('time.seconds', { n: value });
  return `${fmtNumber(toDisplayWeight(value, units), 1)} ${weightUnit(units)}`;
}
