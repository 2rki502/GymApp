import { useMemo, useState } from 'react';
import { addDays, formatDuration, formatShortDate, greeting, parseLocalDate, startOfDay, startOfWeek, toLocalDate, WEEKDAYS_LETTER } from '@/domain/dates';
import { workoutDurationSec, workoutSetCount } from '@/domain/metrics';
import { activeDays, comparePeriod, weeklyBuckets, weeklyStreak } from '@/domain/stats';
import { fmtNumber, toDisplayWeight, weightUnit } from '@/domain/units';
import { startEmptyWorkout, startRoutine } from '@/features/session/actions';
import { prLabel } from '@/features/session/Session';
import { formatPR } from '@/features/progress/ProgressScreen';
import { WeightSheet } from '@/features/progress/BodyTab';
import { navigate } from '@/lib/router';
import { useExerciseLookup, usePRs, useTodayPlan } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { BarChart, Ring, Sparkline } from '@/ui/charts';
import { Icon } from '@/ui/Icon';
import { Screen, SectionTitle } from '@/ui/Screen';
import { ExerciseAnimation } from '@/features/library/figure/Figure';
import './home.css';

const LONG_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export function HomeScreen() {
  const settings = useData((s) => s.settings);
  const workouts = useData((s) => s.workouts);
  const routines = useData((s) => s.routines);
  const name = settings.name.trim().split(' ')[0];
  const hasHistory = workouts.some((w) => w.endedAt);

  return (
    <Screen
      title={name ? `${greeting()}, ${name}` : greeting()}
      large
      eyebrow={LONG_DATE.format(new Date())}
      right={
        <button className="avatar" onClick={() => navigate('/profile')} aria-label="Profile">
          {name ? name[0].toUpperCase() : <Icon name="user" size={18} />}
        </button>
      }
    >
      {!hasHistory && routines.length === 0 && <Welcome />}
      <TodayCard />
      <WeekCard />
      <div className="home-tiles">
        <BodyWeightTile />
        <StreakTile />
      </div>
      <RecentPRs />
      {hasHistory && <ProgressSummary />}
      {routines.length > 0 && <QuickStart />}
    </Screen>
  );
}

function Welcome() {
  return (
    <div className="welcome">
      <ExerciseAnimation anim="squat_back" className="welcome-art" />
      <h2>Welcome to Forge</h2>
      <p>Track every set, follow a split and watch your strength grow. Start by choosing a program.</p>
      <div className="btn-row">
        <button
          className="btn btn-primary"
          onClick={() => {
            useUI.getState().set({ workoutsTab: 'splits' });
            navigate('/workouts');
          }}
        >
          Pick a Program
        </button>
        <button className="btn" onClick={() => navigate('/library')}>
          Browse Library
        </button>
      </div>
    </div>
  );
}

function TodayCard() {
  const plan = useTodayPlan();
  const lookup = useExerciseLookup();
  const session = useData((s) => s.session);

  if (session) {
    return (
      <button className="today today-live card-tappable" onClick={() => useUI.getState().set({ sessionOpen: true })}>
        <div className="eyebrow today-eyebrow">
          <span className="mini-pulse" /> In progress
        </div>
        <h2>{session.name}</h2>
        <p className="muted">
          {session.exercises.length} exercises · {session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)} sets done
        </p>
        <span className="btn btn-primary today-btn">Resume Workout</span>
      </button>
    );
  }

  if (plan.doneToday) {
    const w = plan.doneToday;
    return (
      <button className="today today-done card-tappable" onClick={() => navigate(`/workouts/history/${w.id}`)}>
        <div className="eyebrow today-eyebrow">
          <Icon name="check" size={14} stroke={3} /> Completed today
        </div>
        <h2>{w.name}</h2>
        <div className="today-stats">
          <span><Icon name="clock" size={15} /> {formatDuration(workoutDurationSec(w))}</span>
          <span><Icon name="dumbbell" size={15} /> {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}</span>
          <span><Icon name="layers" size={15} /> {workoutSetCount(w)} set{workoutSetCount(w) === 1 ? '' : 's'}</span>
        </div>
        <p className="muted today-note">Great work. Recovery is where the gains happen.</p>
      </button>
    );
  }

  if (plan.routine) {
    const r = plan.routine;
    const sets = r.exercises.reduce((n, e) => n + e.sets, 0);
    const minutes = Math.round(r.exercises.reduce((t, e) => t + e.sets * (45 + e.restSec), 0) / 60);
    return (
      <div className={`today color-${r.color}`}>
        <span className="tpl-glow" />
        <div className="eyebrow today-eyebrow">Today · {plan.splitName}</div>
        <h2>{r.name}</h2>
        <div className="today-stats">
          <span><Icon name="layers" size={15} /> {r.exercises.length} exercises</span>
          <span><Icon name="target" size={15} /> {sets} sets</span>
          <span><Icon name="clock" size={15} /> ~{minutes} min</span>
        </div>
        <ul className="today-list">
          {r.exercises.slice(0, 4).map((e) => (
            <li key={e.id}>
              <span>{lookup(e.exerciseId).name}</span>
              <span className="faint num">
                {e.sets} × {e.reps}
              </span>
            </li>
          ))}
          {r.exercises.length > 4 && <li className="faint">+{r.exercises.length - 4} more</li>}
        </ul>
        <div className="btn-row">
          <button className="btn" onClick={() => navigate(`/workouts/routine/${r.id}`)}>
            Edit
          </button>
          <button className="btn btn-primary" onClick={() => startRoutine(r)}>
            <Icon name="play" size={15} fill /> Start Workout
          </button>
        </div>
      </div>
    );
  }

  if (plan.isRestDay) {
    return (
      <div className="today today-rest">
        <div className="eyebrow today-eyebrow">Today · {plan.splitName}</div>
        <h2>Rest day</h2>
        <p className="muted">Recover, stretch, walk. Feeling fresh? You can still train.</p>
        <button className="btn today-btn" onClick={() => startEmptyWorkout()}>
          Start an Extra Workout
        </button>
      </div>
    );
  }

  return (
    <div className="today">
      <div className="eyebrow today-eyebrow">Today</div>
      <h2>Ready to train?</h2>
      <p className="muted">Set an active split to see your scheduled workout here each day.</p>
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button
          className="btn"
          onClick={() => {
            useUI.getState().set({ workoutsTab: 'splits' });
            navigate('/workouts');
          }}
        >
          Plan Week
        </button>
        <button className="btn btn-primary" onClick={() => startEmptyWorkout()}>
          <Icon name="plus" size={18} stroke={2.6} /> Quick Start
        </button>
      </div>
    </div>
  );
}

function WeekCard() {
  const workouts = useData((s) => s.workouts);
  const goal = useData((s) => s.settings.weeklyGoal);
  const days = useMemo(() => activeDays(workouts), [workouts]);
  const week = startOfWeek(new Date());
  const today = toLocalDate();
  const count = useMemo(() => weeklyStreak(workouts, goal).thisWeek, [workouts, goal]);

  return (
    <button className="card card-tappable week-card" onClick={() => { useUI.getState().set({ workoutsTab: 'history' }); navigate('/workouts'); }}>
      <div className="week-left">
        <div className="eyebrow">This week</div>
        <div className="week-days">
          {WEEKDAYS_LETTER.map((l, i) => {
            const d = toLocalDate(addDays(week, i));
            const done = days.has(d);
            return (
              <div key={i} className={`wday ${done ? 'is-done' : ''} ${d === today ? 'is-today' : ''} ${d > today ? 'is-future' : ''}`}>
                <span>{l}</span>
                <i>{done && <Icon name="check" size={12} stroke={3.4} />}</i>
              </div>
            );
          })}
        </div>
      </div>
      <Ring value={count / goal} size={66} stroke={7} label={`${count} of ${goal} workouts this week`}>
        <strong className="num ring-num">{count}</strong>
        <span className="ring-of">of {goal}</span>
      </Ring>
    </button>
  );
}

function BodyWeightTile() {
  const bodyWeights = useData((s) => s.bodyWeights);
  const units = useData((s) => s.settings.units);
  const [open, setOpen] = useState(false);
  const latest = bodyWeights[0];
  const recent = useMemo(() => {
    const cutoff = toLocalDate(addDays(startOfDay(new Date()), -30));
    return bodyWeights.filter((b) => b.date >= cutoff).reverse();
  }, [bodyWeights]);
  const change = recent.length > 1 ? toDisplayWeight(recent[recent.length - 1].weight - recent[0].weight, units) : null;

  if (!latest) {
    return (
      <>
        <button className="stat home-tile card-tappable" onClick={() => setOpen(true)}>
          <div className="stat-label"><Icon name="scale" size={15} /> Body weight</div>
          <div className="tile-cta">
            <Icon name="plus" size={18} stroke={2.6} /> Log weight
          </div>
        </button>
        <WeightSheet open={open} onClose={() => setOpen(false)} />
      </>
    );
  }
  return (
    <>
      <button className="stat home-tile card-tappable" onClick={() => { useUI.getState().set({ progressTab: 'body' }); navigate('/progress'); }}>
        <div className="stat-label"><Icon name="scale" size={15} /> Body weight</div>
        <div className="stat-value num">
          {fmtNumber(toDisplayWeight(latest.weight, units), 1)}
          <small>{weightUnit(units)}</small>
        </div>
        {recent.length > 1 && <Sparkline values={recent.map((b) => b.weight)} height={26} color="var(--blue)" />}
        <div className="tile-foot">
          {change !== null ? `${change > 0 ? '+' : change < 0 ? '−' : ''}${fmtNumber(Math.abs(change), 1)} ${weightUnit(units)} · 30 days` : `Logged ${formatShortDate(parseLocalDate(latest.date))}`}
        </div>
      </button>
    </>
  );
}

function StreakTile() {
  const workouts = useData((s) => s.workouts);
  const goal = useData((s) => s.settings.weeklyGoal);
  const s = useMemo(() => weeklyStreak(workouts, goal), [workouts, goal]);
  const total = workouts.filter((w) => w.endedAt).length;
  return (
    <button className="stat home-tile card-tappable" onClick={() => { useUI.getState().set({ progressTab: 'overview' }); navigate('/progress'); }}>
      <div className="stat-label"><Icon name="flame" size={15} style={{ color: 'var(--orange)' }} /> Streak</div>
      <div className="stat-value num">
        {s.weeks}
        <small>{s.weeks === 1 ? 'week' : 'weeks'}</small>
      </div>
      <div className="streak-bar" aria-hidden="true">
        {Array.from({ length: s.goal }, (_, i) => (
          <i key={i} className={i < s.thisWeek ? 'is-on' : ''} />
        ))}
      </div>
      <div className="tile-foot">{total} workouts all time</div>
    </button>
  );
}

function RecentPRs() {
  const { events } = usePRs();
  const lookup = useExerciseLookup();
  const units = useData((s) => s.settings.units);
  const recent = useMemo(() => {
    // Best PR per exercise from the last 30 days, most recent first.
    const cutoff = addDays(new Date(), -30).toISOString();
    const order = ['e1rm', 'weight', 'reps', 'duration'];
    const seen = new Set<string>();
    return [...events]
      .filter((e) => e.date >= cutoff)
      .sort((a, b) => b.date.localeCompare(a.date) || order.indexOf(a.kind) - order.indexOf(b.kind))
      .filter((e) => (seen.has(e.exerciseId) ? false : (seen.add(e.exerciseId), true)))
      .slice(0, 8);
  }, [events]);

  if (!recent.length) return null;
  return (
    <>
      <SectionTitle action={<button className="link" onClick={() => { useUI.getState().set({ progressTab: 'overview' }); navigate('/progress'); }}>See all</button>}>
        Recent PRs
      </SectionTitle>
      <div className="pr-scroller">
        {recent.map((p) => (
          <button key={`${p.workoutId}-${p.exerciseId}`} className="pr-card" onClick={() => navigate(`/progress/exercise/${p.exerciseId}`)}>
            <Icon name="trophy" size={20} />
            <strong className="num">{formatPR(p.kind, p.value, units)}</strong>
            <span className="pr-name">{lookup(p.exerciseId).name}</span>
            <span className="faint">
              {prLabel(p.kind)} · {formatShortDate(p.date)}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function ProgressSummary() {
  const workouts = useData((s) => s.workouts);
  const cmp = useMemo(() => comparePeriod(workouts, 'month'), [workouts]);
  const weeks = useMemo(() => weeklyBuckets(workouts, 8), [workouts]);
  const diff = cmp.current.workouts - cmp.previous.workouts;
  const hasPrev = cmp.previous.workouts > 0;

  return (
    <>
      <SectionTitle action={<button className="link" onClick={() => { useUI.getState().set({ progressTab: 'overview' }); navigate('/progress'); }}>Details</button>}>
        This month
      </SectionTitle>
      <div className="card summary-card">
        <div className="summary-row">
          <div>
            <span className="num">{cmp.current.workouts}</span>
            <label>Workouts</label>
          </div>
          <div>
            <span className="num">{cmp.current.sets}</span>
            <label>Sets</label>
          </div>
          <div>
            <span className="num">{formatDuration(cmp.current.durationSec)}</span>
            <label>Trained</label>
          </div>
        </div>
        {hasPrev && (
          <p className="summary-line">
            {diff === 0 ? (
              'Same number of workouts as this point last month.'
            ) : (
              <>
                <strong className={diff > 0 ? 'up' : 'down'}>
                  {Math.abs(diff)} {diff > 0 ? 'more' : 'fewer'}
                </strong>{' '}
                workout{Math.abs(diff) === 1 ? '' : 's'} than this point last month.
              </>
            )}
          </p>
        )}
        <BarChart
          data={weeks.map((w, i) => ({
            label: i === weeks.length - 1 ? 'Now' : String(w.start.getDate()),
            value: w.workouts,
            tip: `Week of ${formatShortDate(w.start)}`,
            highlight: i === weeks.length - 1,
          }))}
          height={120}
          ariaLabel="Workouts per week, last 8 weeks"
          formatY={(v) => fmtNumber(v, 0)}
        />
      </div>
    </>
  );
}

function QuickStart() {
  const routines = useData((s) => s.routines);
  return (
    <>
      <SectionTitle>Quick start</SectionTitle>
      <div className="quick-grid">
        {routines.slice(0, 6).map((r) => (
          <button key={r.id} className={`quick color-${r.color}`} onClick={() => startRoutine(r)} disabled={!r.exercises.length}>
            <span className="quick-dot" />
            <strong>{r.name}</strong>
            <span className="faint">{r.exercises.length} exercises</span>
            <Icon name="play" size={14} fill className="quick-play" />
          </button>
        ))}
        <button className="quick quick-empty" onClick={() => startEmptyWorkout()}>
          <Icon name="plus" size={18} stroke={2.6} />
          <strong>Empty workout</strong>
        </button>
      </div>
    </>
  );
}
