import { useMemo } from 'react';
import { startOn } from '@/domain/schedule';
import { localizePreset } from '@/data/localize';
import { SPLIT_PRESETS } from '@/data/templates';
import { formatDuration, formatLongDate, formatMonth, weekdayIndex, weekdayLetter, weekdayShort } from '@/domain/dates';
import { workoutDurationSec, workoutSetCount } from '@/domain/metrics';
import type { Routine, Workout } from '@/domain/types';
import { startEmptyWorkout, startRoutine } from '@/features/session/actions';
import { getLang, joinList, t } from '@/i18n';
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
      <button className="nav-btn" aria-label={t('wk.newRoutine')} onClick={() => navigate('/workouts/routine/new')}>
        <Icon name="plus" size={24} />
      </button>
    ) : tab === 'splits' ? (
      <button className="nav-btn" aria-label={t('wk.newSplit')} onClick={() => navigate('/workouts/split/new')}>
        <Icon name="plus" size={24} />
      </button>
    ) : null;

  return (
    <Screen
      title={t('wk.title')}
      large
      right={right}
      header={
        <div className="wk-seg">
          <Segmented
            value={tab}
            onChange={(v) => setUI({ workoutsTab: v })}
            options={[
              { value: 'routines', label: t('wk.routines') },
              { value: 'history', label: t('wk.history') },
              { value: 'splits', label: t('wk.splits') },
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
          <strong>{t('wk.startEmpty')}</strong>
          <span className="muted">{t('wk.startEmptySub')}</span>
        </span>
      </button>

      <h2 className="wk-section">{t('wk.myRoutines')}</h2>
      {routines.length === 0 ? (
        <EmptyState
          icon="layers"
          title={t('wk.noRoutines')}
          text={t('wk.noRoutinesText')}
          action={
            <div className="btn-row" style={{ width: '100%' }}>
              <button className="btn" onClick={() => useUI.getState().set({ workoutsTab: 'splits' })}>
                {t('wk.templates')}
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/workouts/routine/new')}>
                {t('common.create')}
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
        { label: t('common.edit'), onSelect: () => navigate(`/workouts/routine/${r.id}`) },
        { label: t('wk.duplicate'), onSelect: () => dup(r.id) && toast(t('wk.duplicated'), 'success') },
        {
          label: t('common.delete'),
          destructive: true,
          onSelect: async () => {
            if (await confirm({ title: t('wk.deleteTitle', { name: r.name }), message: t('wk.historyKept'), confirmLabel: t('common.delete'), destructive: true })) del(r.id);
          },
        },
      ],
    });
  const lastText = last ? formatLongDate(last) : '';
  return (
    <div className={`routine-card color-${r.color}`}>
      <button className="routine-body" onClick={() => navigate(`/workouts/routine/${r.id}`)}>
        <div className="routine-top">
          <span className="dot" style={{ background: 'var(--c)' }} />
          <strong>{r.name}</strong>
        </div>
        <p className="routine-ex">{r.exercises.map((e) => lookup(e.exerciseId).name).join(' · ') || t('wk.noExercises')}</p>
        <p className="routine-meta">
          {t('n.exercises', { n: r.exercises.length })} · {t('n.sets', { n: sets })}
          {last ? ` · ${t('wk.lastDone', { date: getLang() === 'en' ? lastText.toLowerCase() : lastText })}` : ''}
        </p>
      </button>
      <div className="routine-actions">
        <button className="icon-btn" onClick={menu} aria-label={t('editor.options', { name: r.name })}>
          <Icon name="more" size={20} stroke={3} />
        </button>
        <button className="btn btn-primary btn-sm" disabled={!r.exercises.length} onClick={() => startRoutine(r)}>
          <Icon name="play" size={13} fill /> {t('common.start')}
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
        title={t('wk.noWorkouts')}
        text={t('wk.noWorkoutsText')}
        action={
          <button className="btn btn-primary" onClick={() => startEmptyWorkout()}>
            {t('wk.startWorkout')}
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
        <span>
          <Icon name="clock" size={14} /> {formatDuration(workoutDurationSec(w))}
        </span>
        <span>
          <Icon name="dumbbell" size={14} /> {t('n.exercises', { n: w.exercises.length })}
        </span>
        <span>
          <Icon name="layers" size={14} /> {t('n.sets', { n: workoutSetCount(w) })}
        </span>
      </div>
      <ul className="history-ex">
        {w.exercises.slice(0, 4).map((e) => (
          <li key={e.id}>
            <span className="faint num">{e.sets.length}×</span> {lookup(e.exerciseId).name}
          </li>
        ))}
        {w.exercises.length > 4 && <li className="faint">{t('n.moreExercises', { n: w.exercises.length - 4 })}</li>}
      </ul>
    </button>
  );
}

function SplitsTab() {
  const { splits, routines, settings, updateSettings, applySplitPreset } = useData();
  const today = weekdayIndex(new Date());
  const name = (id: string | null) => (id ? routines.find((r) => r.id === id)?.name ?? '—' : t('wk.rest'));

  return (
    <>
      {splits.length > 0 && <h2 className="wk-section">{t('wk.mySplits')}</h2>}
      {splits.map((sp) => {
        const active = settings.activeSplitId === sp.id;
        return (
          <div key={sp.id} className={`card split-card ${active ? 'is-active' : ''}`}>
            <button className="split-head" onClick={() => navigate(`/workouts/split/${sp.id}`)}>
              <div>
                <strong>{sp.name}</strong>
                <span className="muted">{t('n.trainingDays', { n: sp.days.filter(Boolean).length })}</span>
              </div>
              {active ? <span className="badge">{t('wk.active')}</span> : <Icon name="chevronRight" size={18} className="faint" />}
            </button>
            <div className="split-week">
              {sp.days.map((d, i) => (
                <div key={i} className={`split-day ${d ? 'is-train' : ''} ${i === today ? 'is-today' : ''}`}>
                  <span>{weekdayShort(i)}</span>
                  <strong>{name(d)}</strong>
                </div>
              ))}
            </div>
            {!active && (
              <button className="btn btn-sm btn-block" style={{ marginTop: 12 }} onClick={() => updateSettings({ activeSplitId: sp.id })}>
                {t('wk.setActive')}
              </button>
            )}
          </div>
        );
      })}

      <h2 className="wk-section">{t('wk.programTemplates')}</h2>
      <p className="muted wk-hint">{t('wk.programHint')}</p>
      <div className="preset-list">
        {SPLIT_PRESETS.map(localizePreset).map((p) => (
          <button
            key={p.id}
            className="card card-tappable preset"
            onClick={async () => {
              const ok = await confirm({
                title: t('wk.useTitle', { name: p.name }),
                message: t('wk.useMsg', { n: p.routines.length, names: joinList(p.routines.map((r) => r.name)) }),
                confirmLabel: t('wk.addProgram'),
              });
              if (ok) {
                applySplitPreset({ ...p, days: startOn(p.days, weekdayIndex(new Date())) });
                toast(t('wk.nowActive', { name: p.name }), 'success');
              }
            }}
          >
            <div>
              <strong>{p.name}</strong>
              <span className="muted">{p.description}</span>
            </div>
            <div className="preset-days">
              {startOn(p.days, weekdayIndex(new Date())).map((d, i) => (
                <span key={i} className={d ? 'is-train' : ''} title={weekdayShort(i)}>
                  {weekdayLetter(i)}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
