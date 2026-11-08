import { useMemo, useState } from 'react';
import { MUSCLE_LABEL } from '@/data/exercises';
import { addDays, formatDuration, formatShortDate, startOfDay } from '@/domain/dates';
import { comparePeriod, inRange, muscleDistribution, weeklyBuckets, weeklyStreak, type PeriodSummary } from '@/domain/stats';
import { fmtNumber, toDisplayWeight, weightUnit } from '@/domain/units';
import { useExerciseLookup, usePRs } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { BarChart } from '@/ui/charts';
import { EmptyState, Segmented } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { navigate } from '@/lib/router';
import { prLabel } from '@/features/session/Session';
import { startEmptyWorkout } from '@/features/session/actions';
import { BodyTab } from './BodyTab';
import { PhotosTab } from './PhotosTab';
import { StrengthTab } from './StrengthTab';
import './progress.css';

export function ProgressScreen() {
  const tab = useUI((s) => s.progressTab);
  const setUI = useUI((s) => s.set);
  return (
    <Screen
      title="Progress"
      large
      header={
        <div className="wk-seg">
          <Segmented
            value={tab}
            onChange={(v) => setUI({ progressTab: v })}
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'body', label: 'Body' },
              { value: 'strength', label: 'Strength' },
              { value: 'photos', label: 'Photos' },
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
  if (Math.abs(diff) < 1e-9) return <span className="delta flat">Same</span>;
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
        title="Your progress starts here"
        text="Finish a workout and your weekly stats, training trends and PRs will show up here."
        action={<button className="btn btn-primary" onClick={() => startEmptyWorkout()}>Start a Workout</button>}
      />
    );
  }

  const tile = (label: string, k: keyof PeriodSummary, fmt: (n: number) => string, unit = '') => (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value num">{fmt(cmp.current[k])}</div>
      <Delta cur={cmp.current[k]} prev={cmp.previous[k]} format={fmt} unit={unit} />
    </div>
  );

  const barData = weeks.map((w, i) => ({
    label: i === weeks.length - 1 ? 'Now' : formatShortDate(w.start).split(' ')[0],
    value: metric === 'workouts' ? w.workouts : w.durationSec / 60,
    tip: `Week of ${formatShortDate(w.start)}`,
    highlight: i === weeks.length - 1,
  }));
  const maxMuscle = Math.max(1, ...muscles.map((m) => m.sets));

  return (
    <>
      <div className="ov-period">
        <h2>{period === 'week' ? 'This week' : 'This month'}</h2>
        <Segmented
          className="ov-period-seg"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
      </div>
      <p className="faint ov-sub">Compared with the same point last {period}</p>
      <div className="stat-grid stat-grid-3">
        {tile('Workouts', 'workouts', (n) => fmtNumber(n, 0))}
        {tile('Time', 'durationSec', (n) => formatDuration(n))}
        {tile('Sets', 'sets', (n) => fmtNumber(n, 0))}
      </div>

      <div className="card chart-card">
        <div className="chart-card-head">
          <div>
            <div className="eyebrow">Last 12 weeks</div>
            <h3>{metric === 'workouts' ? 'Workouts per week' : 'Minutes per week'}</h3>
          </div>
        </div>
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'workouts', label: 'Workouts' },
            { value: 'duration', label: 'Time' },
          ]}
        />
        <div style={{ marginTop: 14 }}>
          <BarChart data={barData} height={170} ariaLabel="Weekly training chart" formatY={(v) => fmtNumber(v, 0)} />
        </div>
      </div>

      <div className="card streak-card">
        <Icon name="flame" size={26} />
        <div>
          <strong className="num">
            {streak.weeks} week{streak.weeks === 1 ? '' : 's'}
          </strong>
          <span className="muted">
            streak hitting {streak.goal}+ workouts · {streak.thisWeek}/{streak.goal} this week
          </span>
        </div>
      </div>

      {muscles.length > 0 && (
        <div className="card">
          <div className="eyebrow">Last 30 days</div>
          <h3 className="card-h">Sets per muscle group</h3>
          <div className="muscle-bars">
            {muscles.map((m) => (
              <div key={m.muscle} className="muscle-bar">
                <span>{MUSCLE_LABEL(m.muscle)}</span>
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
          <h2 className="wk-section">Recent PRs</h2>
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
  if (kind === 'reps') return `${value} reps`;
  if (kind === 'duration') return `${value}s`;
  return `${fmtNumber(toDisplayWeight(value, units), 1)} ${weightUnit(units)}`;
}
