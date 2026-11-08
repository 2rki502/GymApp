import { useMemo } from 'react';
import { SPLIT_PRESETS } from '@/data/templates';
import { formatDuration, formatLongDate, formatMonth, weekdayIndex, WEEKDAYS_SHORT } from '@/domain/dates';
import { workoutDurationSec, workoutSetCount } from '@/domain/metrics';
import type { Routine, Workout } from '@/domain/types';
import { startEmptyWorkout, startRoutine } from '@/features/session/actions';
import { navigate } from '@/lib/router';
import { sortedWorkouts, useExerciseLookup, usePRs } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { EmptyState, Segmented } from '@/ui/controls';
import { actionSheet, confirm, toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import './workouts.css';

export function WorkoutsScreen() {
  const tab = useUI((s) => s.workoutsTab);
  const setUI = useUI((s) => s.set);
  const right =
    tab === 'routines' ? (
      <button className="nav-btn" aria-label="New routine" onClick={() => navigate('/workouts/routine/new')}>
        <Icon name="plus" size={24} />
      </button>
    ) : tab === 'splits' ? (
      <button className="nav-btn" aria-label="New split" onClick={() => navigate('/workouts/split/new')}>
        <Icon name="plus" size={24} />
      </button>
    ) : null;

  return (
    <Screen
      title="Workouts"
      large
      right={right}
      header={
        <div className="wk-seg">
          <Segmented
            value={tab}
            onChange={(v) => setUI({ workoutsTab: v })}
            options={[
              { value: 'routines', label: 'Routines' },
              { value: 'history', label: 'History' },
              { value: 'splits', label: 'Splits' },
            ]}
          />
        </div>
      }
    >
      {tab === 'routines' && <RoutinesTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'splits' && <SplitsTab />}
    </Screen>
  );
}

function RoutinesTab() {
  const routines = useData((s) => s.routines);
  const workouts = useData((s) => s.workouts);
  const lastDone = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workouts) if (w.routineId && w.endedAt && (m.get(w.routineId) ?? '') < w.startedAt) m.set(w.routineId, w.startedAt);
    return m;
  }, [workouts]);

  return (
    <>
      <button className="start-empty card-tappable" onClick={() => startEmptyWorkout()}>
        <span className="start-empty-icon">
          <Icon name="plus" size={22} stroke={2.6} />
        </span>
        <span>
          <strong>Start Empty Workout</strong>
          <span className="muted">Log exercises as you go</span>
        </span>
      </button>

      <h2 className="wk-section">My Routines</h2>
      {routines.length === 0 ? (
        <EmptyState
          icon="layers"
          title="No routines yet"
          text="Create a routine, or pick a split template to generate a full program."
          action={
            <div className="btn-row" style={{ width: '100%' }}>
              <button className="btn" onClick={() => useUI.getState().set({ workoutsTab: 'splits' })}>
                Templates
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/workouts/routine/new')}>
                Create
              </button>
            </div>
          }
        />
      ) : (
        <div className="routine-list">
          {routines.map((r) => (
            <RoutineCard key={r.id} r={r} last={lastDone.get(r.id)} />
          ))}
        </div>
      )}
    </>
  );
}

function RoutineCard({ r, last }: { r: Routine; last?: string }) {
  const lookup = useExerciseLookup();
  const dup = useData((s) => s.duplicateRoutine);
  const del = useData((s) => s.deleteRoutine);
  const sets = r.exercises.reduce((n, e) => n + e.sets, 0);
  const menu = () =>
    actionSheet({
      title: r.name,
      actions: [
        { label: 'Edit', onSelect: () => navigate(`/workouts/routine/${r.id}`) },
        { label: 'Duplicate', onSelect: () => dup(r.id) && toast('Routine duplicated', 'success') },
        {
          label: 'Delete',
          destructive: true,
          onSelect: async () => {
            if (await confirm({ title: `Delete “${r.name}”?`, message: 'Your workout history is kept.', confirmLabel: 'Delete', destructive: true })) del(r.id);
          },
        },
      ],
    });
  return (
    <div className={`routine-card color-${r.color}`}>
      <button className="routine-body" onClick={() => navigate(`/workouts/routine/${r.id}`)}>
        <div className="routine-top">
          <span className="dot" style={{ background: 'var(--c)' }} />
          <strong>{r.name}</strong>
        </div>
        <p className="routine-ex">{r.exercises.map((e) => lookup(e.exerciseId).name).join(' · ') || 'No exercises'}</p>
        <p className="routine-meta">
          {r.exercises.length} exercises · {sets} sets{last ? ` · last ${formatLongDate(last).toLowerCase()}` : ''}
        </p>
      </button>
      <div className="routine-actions">
        <button className="icon-btn" onClick={menu} aria-label={`${r.name} options`}>
          <Icon name="more" size={20} stroke={3} />
        </button>
        <button className="btn btn-primary btn-sm" disabled={!r.exercises.length} onClick={() => startRoutine(r)}>
          <Icon name="play" size={13} fill /> Start
        </button>
      </div>
    </div>
  );
}

function HistoryTab() {
  const workouts = useData((s) => s.workouts);
  const months = useMemo(() => {
    const groups: { key: string; label: string; items: Workout[] }[] = [];
    for (const w of sortedWorkouts(workouts)) {
      const d = new Date(w.startedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: formatMonth(d), items: [] };
        groups.push(g);
      }
      g.items.push(w);
    }
    return groups;
  }, [workouts]);

  if (!months.length) {
    return (
      <EmptyState
        icon="calendar"
        title="No workouts logged"
        text="Finished workouts appear here with every set, rep and PR."
        action={
          <button className="btn btn-primary" onClick={() => startEmptyWorkout()}>
            Start a Workout
          </button>
        }
      />
    );
  }
  return (
    <>
      {months.map((m) => (
        <section key={m.key}>
          <h2 className="wk-section">
            {m.label} <span className="faint">· {m.items.length}</span>
          </h2>
          <div className="history-list">
            {m.items.map((w) => (
              <HistoryCard key={w.id} w={w} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function HistoryCard({ w }: { w: Workout }) {
  const lookup = useExerciseLookup();
  const { events } = usePRs();
  const prCount = useMemo(() => new Set(events.filter((e) => e.workoutId === w.id).map((e) => e.exerciseId)).size, [events, w.id]);
  return (
    <button className="card card-tappable history-card" onClick={() => navigate(`/workouts/history/${w.id}`)}>
      <div className="history-top">
        <div>
          <strong>{w.name}</strong>
          <span className="muted">{formatLongDate(w.startedAt)}</span>
        </div>
        {prCount > 0 && (
          <span className="badge badge-gold">
            <Icon name="trophy" size={12} stroke={2.4} /> {prCount}
          </span>
        )}
      </div>
      <div className="history-stats">
        <span><Icon name="clock" size={14} /> {formatDuration(workoutDurationSec(w))}</span>
        <span><Icon name="dumbbell" size={14} /> {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}</span>
        <span><Icon name="layers" size={14} /> {workoutSetCount(w)} sets</span>
      </div>
      <ul className="history-ex">
        {w.exercises.slice(0, 4).map((e) => (
          <li key={e.id}>
            <span className="faint num">{e.sets.length}×</span> {lookup(e.exerciseId).name}
          </li>
        ))}
        {w.exercises.length > 4 && <li className="faint">+{w.exercises.length - 4} more</li>}
      </ul>
    </button>
  );
}

function SplitsTab() {
  const { splits, routines, settings, updateSettings, applySplitPreset } = useData();
  const today = weekdayIndex(new Date());
  const name = (id: string | null) => (id ? routines.find((r) => r.id === id)?.name ?? '—' : 'Rest');

  return (
    <>
      {splits.length > 0 && <h2 className="wk-section">My Splits</h2>}
      {splits.map((sp) => {
        const active = settings.activeSplitId === sp.id;
        return (
          <div key={sp.id} className={`card split-card ${active ? 'is-active' : ''}`}>
            <button className="split-head" onClick={() => navigate(`/workouts/split/${sp.id}`)}>
              <div>
                <strong>{sp.name}</strong>
                <span className="muted">{sp.days.filter(Boolean).length} training days / week</span>
              </div>
              {active ? <span className="badge">Active</span> : <Icon name="chevronRight" size={18} className="faint" />}
            </button>
            <div className="split-week">
              {sp.days.map((d, i) => (
                <div key={i} className={`split-day ${d ? 'is-train' : ''} ${i === today ? 'is-today' : ''}`}>
                  <span>{WEEKDAYS_SHORT[i]}</span>
                  <strong>{name(d)}</strong>
                </div>
              ))}
            </div>
            {!active && (
              <button className="btn btn-sm btn-block" style={{ marginTop: 12 }} onClick={() => updateSettings({ activeSplitId: sp.id })}>
                Set as active split
              </button>
            )}
          </div>
        );
      })}

      <h2 className="wk-section">Program Templates</h2>
      <p className="muted wk-hint">Creates the routines and a weekly schedule for you. Everything stays editable.</p>
      <div className="preset-list">
        {SPLIT_PRESETS.map((p) => (
          <button
            key={p.id}
            className="card card-tappable preset"
            onClick={async () => {
              const ok = await confirm({
                title: `Use ${p.name}?`,
                message: `Adds ${p.routines.length} routines (${p.routines.map((r) => r.name).join(', ')}) and makes this your active split.`,
                confirmLabel: 'Add Program',
              });
              if (ok) {
                applySplitPreset(p);
                toast(`${p.name} is now your active split`, 'success');
              }
            }}
          >
            <div>
              <strong>{p.name}</strong>
              <span className="muted">{p.description}</span>
            </div>
            <div className="preset-days">
              {p.days.map((d, i) => (
                <span key={i} className={d ? 'is-train' : ''} title={WEEKDAYS_SHORT[i]}>
                  {WEEKDAYS_SHORT[i][0]}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
