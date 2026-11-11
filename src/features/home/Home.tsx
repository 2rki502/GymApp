import { useMemo, useState } from 'react';
import { fmtReps } from '@/data/localize';
import {
  addDays, formatDuration, formatFullDate, formatShortDate, greeting, parseLocalDate, startOfDay, startOfWeek, toLocalDate, weekdayIndex, weekdayLetter,
} from '@/domain/dates';
import { workoutDurationSec, workoutSetCount } from '@/domain/metrics';
import { entriesOn, sumIntake } from '@/domain/nutrition';
import { activeDays, comparePeriod, weeklyBuckets, weeklyStreak } from '@/domain/stats';
import { fmtNumber, toDisplayWeight, weightUnit } from '@/domain/units';
import { startEmptyWorkout, startRoutine } from '@/features/session/actions';
import { prLabel } from '@/features/session/Session';
import { formatPR } from '@/features/progress/ProgressScreen';
import { WeightSheet } from '@/features/progress/BodyTab';
import { calorieTone, TONE_COLOR } from '@/features/nutrition/NutritionScreen';
import { MACROS, MacroBar, useTargets } from '@/features/nutrition/parts';
import { ExerciseAnimation } from '@/features/library/figure/Figure';
import { signed, t } from '@/i18n';
import { navigate } from '@/lib/router';
import { useExerciseLookup, usePRs, useTodayPlan } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { BarChart, Ring, Sparkline } from '@/ui/charts';
import { Icon } from '@/ui/Icon';
import { Screen, SectionTitle } from '@/ui/Screen';
import './home.css';

const WEEK = [0, 1, 2, 3, 4, 5, 6];

export function HomeScreen() {
  const settings = useData((s) => s.settings);
  const workouts = useData((s) => s.workouts);
  const routines = useData((s) => s.routines);
  const name = settings.name.trim().split(' ')[0];
  const hasHistory = workouts.some((w) => w.endedAt);

  return (
    <Screen
      title={name ? t('greet.named', { greeting: greeting(), name }) : greeting()}
      large
      eyebrow={formatFullDate(new Date())}
      right={
        <button className="avatar" onClick={() => navigate('/profile')} aria-label={t('tab.profile')}>
          {name ? name[0].toUpperCase() : <Icon name="user" size={18} />}
        </button>
      }
    >
      {!hasHistory && routines.length === 0 && <Welcome />}
      <TodayCard />
      <NutritionCard />
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

const goSplits = () => {
  useUI.getState().set({ workoutsTab: 'splits' });
  navigate('/workouts');
};

function Welcome() {
  return (
    <div className="welcome">
      <ExerciseAnimation anim="squat_back" className="welcome-art" />
      <h2>{t('home.welcomeTitle')}</h2>
      <p>{t('home.welcomeText')}</p>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={goSplits}>
          {t('home.pickProgram')}
        </button>
        <button className="btn" onClick={() => navigate('/library')}>
          {t('home.browseLibrary')}
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
    const done = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
    return (
      <button className="today today-live card-tappable" onClick={() => useUI.getState().set({ sessionOpen: true })}>
        <div className="eyebrow today-eyebrow">
          <span className="mini-pulse" /> {t('home.inProgress')}
        </div>
        <h2>{session.name}</h2>
        <p className="muted">
          {t('n.exercises', { n: session.exercises.length })} · {t('home.setsDone', { n: done })}
        </p>
        <span className="btn btn-primary today-btn">{t('home.resume')}</span>
      </button>
    );
  }

  if (plan.doneToday) {
    const w = plan.doneToday;
    return (
      <button className="today today-done card-tappable" onClick={() => navigate(`/workouts/history/${w.id}`)}>
        <div className="eyebrow today-eyebrow">
          <Icon name="check" size={14} stroke={3} /> {t('home.completedToday')}
        </div>
        <h2>{w.name}</h2>
        <div className="today-stats">
          <span><Icon name="clock" size={15} /> {formatDuration(workoutDurationSec(w))}</span>
          <span><Icon name="dumbbell" size={15} /> {t('n.exercises', { n: w.exercises.length })}</span>
          <span><Icon name="layers" size={15} /> {t('n.sets', { n: workoutSetCount(w) })}</span>
        </div>
        <p className="muted today-note">{t('home.greatWork')}</p>
      </button>
    );
  }

  if (plan.routine) {
    const r = plan.routine;
    const sets = r.exercises.reduce((n, e) => n + e.sets, 0);
    const minutes = Math.round(r.exercises.reduce((sum, e) => sum + e.sets * (45 + e.restSec), 0) / 60);
    return (
      <div className={`today color-${r.color}`}>
        <span className="tpl-glow" />
        <div className="eyebrow today-eyebrow">{t('home.todaySplit', { split: plan.splitName ?? '' })}</div>
        <h2>{r.name}</h2>
        <div className="today-stats">
          <span><Icon name="layers" size={15} /> {t('n.exercises', { n: r.exercises.length })}</span>
          <span><Icon name="target" size={15} /> {t('n.sets', { n: sets })}</span>
          <span><Icon name="clock" size={15} /> {t('time.minutesApprox', { n: minutes })}</span>
        </div>
        <ul className="today-list">
          {r.exercises.slice(0, 4).map((e) => (
            <li key={e.id}>
              <span>{lookup(e.exerciseId).name}</span>
              <span className="faint num">
                {e.sets} × {fmtReps(e.reps)}
              </span>
            </li>
          ))}
          {r.exercises.length > 4 && <li className="faint">{t('common.more', { n: r.exercises.length - 4 })}</li>}
        </ul>
        <div className="btn-row">
          <button className="btn" onClick={() => navigate(`/workouts/routine/${r.id}`)}>
            {t('common.edit')}
          </button>
          <button className="btn btn-primary" onClick={() => startRoutine(r)}>
            <Icon name="play" size={15} fill /> {t('home.startWorkout')}
          </button>
        </div>
      </div>
    );
  }

  if (plan.isRestDay) {
    return (
      <div className="today today-rest">
        <div className="eyebrow today-eyebrow">{t('home.todaySplit', { split: plan.splitName ?? '' })}</div>
        <h2>{t('home.restDay')}</h2>
        <p className="muted">{t('home.restText')}</p>
        <button className="btn today-btn" onClick={() => startEmptyWorkout()}>
          {t('home.extraWorkout')}
        </button>
      </div>
    );
  }

  return (
    <div className="today">
      <div className="eyebrow today-eyebrow">{t('common.today')}</div>
      <h2>{t('home.ready')}</h2>
      <p className="muted">{t('home.readyText')}</p>
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={goSplits}>
          {t('home.planWeek')}
        </button>
        <button className="btn btn-primary" onClick={() => startEmptyWorkout()}>
          <Icon name="plus" size={18} stroke={2.6} /> {t('home.quickStart')}
        </button>
      </div>
    </div>
  );
}

function NutritionCard() {
  const profile = useData((s) => s.nutrition);
  const foodLog = useData((s) => s.foodLog);
  const targets = useTargets();
  const eaten = useMemo(() => sumIntake(entriesOn(foodLog, toLocalDate())), [foodLog]);

  if (!profile || !targets) {
    return (
      <button className="card card-tappable nut-home nut-home-setup" onClick={() => navigate('/nutrition')}>
        <span className="nut-home-icon">
          <Icon name="food" size={22} />
        </span>
        <span className="nut-home-main">
          <strong>{t('nut.setupTitle')}</strong>
          <span className="muted">{t('nut.setupText')}</span>
        </span>
        <Icon name="chevronRight" size={18} stroke={2.4} className="faint" />
      </button>
    );
  }
  const remaining = targets.calories - eaten.kcal;
  const tone = calorieTone(profile.goal, eaten.kcal, targets.calories);
  return (
    <button className="card card-tappable nut-home" onClick={() => navigate('/nutrition')}>
      <Ring
        value={eaten.kcal / targets.calories}
        size={92}
        stroke={9}
        color={TONE_COLOR[tone]}
        label={t('nut.ringAria', { consumed: fmtNumber(eaten.kcal, 0), target: fmtNumber(targets.calories, 0) })}
      >
        <strong className="num ring-num">{fmtNumber(Math.abs(remaining), 0)}</strong>
        <span className="ring-of">{t(remaining < 0 ? 'nut.kcalOver' : 'nut.kcalLeft')}</span>
      </Ring>
      <div className="nut-home-main">
        <div className="eyebrow">
          {t('nut.homeEyebrow')} · {t(`goal.${profile.goal}`)}
        </div>
        {MACROS.map((m) => (
          <MacroBar key={m.key} compact label={t(m.label)} color={m.color} value={eaten[m.key]} target={targets[m.key]} />
        ))}
      </div>
    </button>
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
    <button
      className="card card-tappable week-card"
      onClick={() => {
        useUI.getState().set({ workoutsTab: 'history' });
        navigate('/workouts');
      }}
    >
      <div className="week-left">
        <div className="eyebrow">{t('home.thisWeek')}</div>
        <div className="week-days">
          {WEEK.map((i) => {
            const date = addDays(week, i);
            const d = toLocalDate(date);
            const done = days.has(d);
            return (
              <div key={i} className={`wday ${done ? 'is-done' : ''} ${d === today ? 'is-today' : ''} ${d > today ? 'is-future' : ''}`}>
                {/* Label by the real weekday: the week starts on Sunday in Arabic, Monday in English. */}
                <span>{weekdayLetter(weekdayIndex(date))}</span>
                <i>{done && <Icon name="check" size={12} stroke={3.4} />}</i>
              </div>
            );
          })}
        </div>
      </div>
      <Ring value={count / goal} size={66} stroke={7} label={t('home.ringLabel', { n: count, goal })}>
        <strong className="num ring-num">{count}</strong>
        <span className="ring-of">{t('home.ringOf', { goal })}</span>
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
          <div className="stat-label">
            <Icon name="scale" size={15} /> {t('home.bodyWeight')}
          </div>
          <div className="tile-cta">
            <Icon name="plus" size={18} stroke={2.6} /> {t('home.logWeight')}
          </div>
        </button>
        <WeightSheet open={open} onClose={() => setOpen(false)} />
      </>
    );
  }
  const changeText = change !== null ? `${signed(change, (v) => fmtNumber(v, 1))} ${weightUnit(units)}` : '';
  return (
    <button
      className="stat home-tile card-tappable"
      onClick={() => {
        useUI.getState().set({ progressTab: 'body' });
        navigate('/progress');
      }}
    >
      <div className="stat-label">
        <Icon name="scale" size={15} /> {t('home.bodyWeight')}
      </div>
      <div className="stat-value num">
        {fmtNumber(toDisplayWeight(latest.weight, units), 1)}
        <small>{weightUnit(units)}</small>
      </div>
      {recent.length > 1 && <Sparkline values={recent.map((b) => b.weight)} height={26} color="var(--blue)" />}
      <div className="tile-foot">
        {change !== null ? t('home.change30', { change: changeText }) : t('home.logged', { date: formatShortDate(parseLocalDate(latest.date)) })}
      </div>
    </button>
  );
}

function StreakTile() {
  const workouts = useData((s) => s.workouts);
  const goal = useData((s) => s.settings.weeklyGoal);
  const s = useMemo(() => weeklyStreak(workouts, goal), [workouts, goal]);
  const total = workouts.filter((w) => w.endedAt).length;
  return (
    <button
      className="stat home-tile card-tappable"
      onClick={() => {
        useUI.getState().set({ progressTab: 'overview' });
        navigate('/progress');
      }}
    >
      <div className="stat-label">
        <Icon name="flame" size={15} style={{ color: 'var(--orange)' }} /> {t('home.streak')}
      </div>
      <div className="stat-value num">
        {s.weeks}
        <small>{t('unit.weeks', { n: s.weeks })}</small>
      </div>
      <div className="streak-bar" aria-hidden="true">
        {Array.from({ length: s.goal }, (_, i) => (
          <i key={i} className={i < s.thisWeek ? 'is-on' : ''} />
        ))}
      </div>
      <div className="tile-foot">{t('home.allTime', { n: total })}</div>
    </button>
  );
}

const goOverview = () => {
  useUI.getState().set({ progressTab: 'overview' });
  navigate('/progress');
};

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
      <SectionTitle
        action={
          <button className="link" onClick={goOverview}>
            {t('home.seeAll')}
          </button>
        }
      >
        {t('home.recentPRs')}
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
      <SectionTitle
        action={
          <button className="link" onClick={goOverview}>
            {t('home.details')}
          </button>
        }
      >
        {t('home.thisMonth')}
      </SectionTitle>
      <div className="card summary-card">
        <div className="summary-row">
          <div>
            <span className="num">{cmp.current.workouts}</span>
            <label>{t('stat.workouts')}</label>
          </div>
          <div>
            <span className="num">{cmp.current.sets}</span>
            <label>{t('stat.sets')}</label>
          </div>
          <div>
            <span className="num">{formatDuration(cmp.current.durationSec)}</span>
            <label>{t('stat.trained')}</label>
          </div>
        </div>
        {hasPrev && (
          <p className="summary-line">
            {diff === 0 ? (
              t('home.sameAsLast')
            ) : (
              <>
                <strong className={diff > 0 ? 'up' : 'down'}>
                  {diff > 0 ? t('home.moreN', { n: diff }) : t('home.fewerN', { n: Math.abs(diff) })}
                </strong>{' '}
                {t('home.thanLastMonth')}
              </>
            )}
          </p>
        )}
        <BarChart
          data={weeks.map((w, i) => ({
            label: i === weeks.length - 1 ? t('common.now') : String(w.start.getDate()),
            value: w.workouts,
            tip: t('common.weekOf', { date: formatShortDate(w.start) }),
            highlight: i === weeks.length - 1,
          }))}
          height={120}
          ariaLabel={t('home.chartAria')}
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
      <SectionTitle>{t('home.quickStartTitle')}</SectionTitle>
      <div className="quick-grid">
        {routines.slice(0, 6).map((r) => (
          <button key={r.id} className={`quick color-${r.color}`} onClick={() => startRoutine(r)} disabled={!r.exercises.length}>
            <span className="quick-dot" />
            <strong>{r.name}</strong>
            <span className="faint">{t('n.exercises', { n: r.exercises.length })}</span>
            <Icon name="play" size={14} fill className="quick-play" />
          </button>
        ))}
        <button className="quick quick-empty" onClick={() => startEmptyWorkout()}>
          <Icon name="plus" size={18} stroke={2.6} />
          <strong>{t('home.emptyWorkout')}</strong>
        </button>
      </div>
    </>
  );
}
