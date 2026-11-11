import { useMemo, useState } from 'react';
import { formatDuration, formatLongDate, formatTime, toLocalDate } from '@/domain/dates';
import { e1rm, isWorkingSet, workoutDurationSec, workoutSetCount } from '@/domain/metrics';
import { fmtNumber, fmtWeight, toDisplayWeight } from '@/domain/units';
import { uid } from '@/domain/id';
import { canComplete, newSet } from '@/domain/workoutOps';
import type { Routine, SetType, Workout } from '@/domain/types';
import { prLabel } from '@/features/session/Session';
import { beginWorkout } from '@/features/session/actions';
import { WorkoutEditor } from '@/features/workout/WorkoutEditor';
import { ExerciseThumb } from '@/features/library/figure/Figure';
import { t, type Key } from '@/i18n';
import { goBack, navigate } from '@/lib/router';
import { useExerciseLookup, usePRs } from '@/store/selectors';
import { useData } from '@/store/useData';
import { EmptyState } from '@/ui/controls';
import { actionSheet, confirm, toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import './workouts.css';

const LETTER: Record<SetType, Key | null> = { normal: null, warmup: 'set.warmup', drop: 'set.drop', failure: 'set.failure' };

export function WorkoutDetailScreen({ id }: { id: string }) {
  const w = useData((s) => s.workouts.find((x) => x.id === id));
  const [editing, setEditing] = useState(false);
  if (!w) {
    return (
      <Screen title={t('wd.title')} back={{ label: t('wk.title'), to: '/workouts' }}>
        <EmptyState icon="info" title={t('wd.notFound')} text={t('wd.notFoundText')} />
      </Screen>
    );
  }
  return editing ? <EditWorkout w={w} onDone={() => setEditing(false)} /> : <ViewWorkout w={w} onEdit={() => setEditing(true)} />;
}

function ViewWorkout({ w, onEdit }: { w: Workout; onEdit: () => void }) {
  const lookup = useExerciseLookup();
  const units = useData((s) => s.settings.units);
  const del = useData((s) => s.deleteWorkout);
  const saveRoutine = useData((s) => s.saveRoutine);
  const { events } = usePRs();
  const prs = useMemo(() => events.filter((e) => e.workoutId === w.id), [events, w.id]);
  const prSets = new Map(prs.map((p) => [p.setId, p.kind]));

  const repeat = () => {
    const now = new Date();
    beginWorkout({
      id: uid(),
      name: w.name,
      routineId: w.routineId,
      startedAt: now.toISOString(),
      endedAt: null,
      exercises: w.exercises.map((e) => ({
        ...e,
        id: uid(),
        sets: e.sets.map(() => newSet()),
      })),
    });
  };

  const saveAsRoutine = () => {
    const now = new Date().toISOString();
    const r: Routine = {
      id: uid(),
      name: w.name,
      color: 'lime',
      createdAt: now,
      updatedAt: now,
      exercises: w.exercises.map((e) => {
        const reps = e.sets.map((s) => s.reps ?? 0).filter(Boolean);
        const ex = lookup(e.exerciseId);
        return {
          id: uid(),
          exerciseId: e.exerciseId,
          sets: e.sets.length,
          reps: ex.kind === 'time' ? `${Math.max(...e.sets.map((s) => s.duration ?? 0))}s` : reps.length ? String(Math.max(...reps)) : ex.recommended.reps,
          restSec: e.restSec,
        };
      }),
    };
    saveRoutine(r);
    toast(t('wd.savedRoutine'), 'success');
  };

  const menu = () =>
    actionSheet({
      actions: [
        { label: t('wd.editWorkout'), onSelect: onEdit },
        { label: t('wd.repeat'), onSelect: repeat },
        { label: t('wd.saveRoutine'), onSelect: saveAsRoutine },
        {
          label: t('wd.delete'),
          destructive: true,
          onSelect: async () => {
            if (await confirm({ title: t('wd.deleteTitle'), message: t('wd.deleteMsg'), confirmLabel: t('common.delete'), destructive: true })) {
              del(w.id);
              toast(t('wd.deleted'));
              goBack('/workouts');
            }
          },
        },
      ],
    });

  return (
    <Screen
      title={w.name}
      back={{ label: t('common.back'), to: '/workouts' }}
      right={
        <>
          <button className="nav-btn" onClick={onEdit}>
            {t('common.edit')}
          </button>
          <button className="nav-btn" onClick={menu} aria-label={t('wd.moreActions')}>
            <Icon name="more" size={22} stroke={3} />
          </button>
        </>
      }
    >
      <h1 className="guide-title">{w.name}</h1>
      <p className="muted wd-date">
        {formatLongDate(w.startedAt)} · {formatTime(w.startedAt)}
      </p>
      <div className="wd-stats">
        <div>
          <label>{t('stat.duration')}</label>
          <span className="num">{formatDuration(workoutDurationSec(w))}</span>
        </div>
        <div>
          <label>{t('stat.sets')}</label>
          <span className="num">{workoutSetCount(w)}</span>
        </div>
        <div>
          <label>{t('stat.prs')}</label>
          <span className="num">{new Set(prs.map((p) => p.exerciseId)).size}</span>
        </div>
      </div>
      {w.note && <p className="wd-note">{w.note}</p>}

      {w.exercises.map((e) => {
        const ex = lookup(e.exerciseId);
        let n = 0;
        return (
          <section key={e.id} className="card wd-ex">
            <button className="wd-ex-head" onClick={() => navigate(`/progress/exercise/${ex.id}`)}>
              <span className="ex-thumb ex-thumb-sm">
                <ExerciseThumb anim={ex.anim} video={ex.video} />
              </span>
              <strong>{ex.name}</strong>
              <Icon name="chevronRight" size={16} className="faint" />
            </button>
            <table className="wd-table">
              <tbody>
                {e.sets.map((s) => {
                  const letter = LETTER[s.type];
                  const label = letter ? t(letter) : String(++n);
                  const pr = prSets.get(s.id);
                  return (
                    <tr key={s.id} className={s.type === 'warmup' ? 'is-warmup' : ''}>
                      <td className={`set-type-${s.type} wd-set`}>{label}</td>
                      <td className="num">
                        {ex.kind === 'time'
                          ? t('time.seconds', { n: s.duration ?? 0 })
                          : ex.kind === 'reps'
                            ? s.weight
                              ? t('wd.repsPlus', { reps: t('n.reps', { n: s.reps ?? 0 }), weight: fmtWeight(s.weight, units) })
                              : t('n.reps', { n: s.reps ?? 0 })
                            : `${fmtWeight(s.weight ?? 0, units)} × ${s.reps ?? 0}`}
                      </td>
                      <td className="num faint">
                        {ex.kind === 'weight' && isWorkingSet(s) && (s.reps ?? 0) > 1
                          ? t('wd.e1rm', { n: fmtNumber(toDisplayWeight(e1rm(s.weight ?? 0, s.reps ?? 0), units), 0) })
                          : ''}
                      </td>
                      <td>
                        {pr && (
                          <span className="badge badge-gold">
                            <Icon name="trophy" size={11} stroke={2.4} /> {prLabel(pr)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
      <button className="btn btn-block" style={{ marginTop: 16 }} onClick={repeat}>
        <Icon name="swap" size={18} /> {t('wd.repeatThis')}
      </button>
    </Screen>
  );
}

function EditWorkout({ w, onDone }: { w: Workout; onDone: () => void }) {
  const save = useData((s) => s.saveWorkout);
  const lookup = useExerciseLookup();
  const [draft, setDraft] = useState<Workout>(w);
  const start = new Date(draft.startedAt);
  const durMin = Math.max(1, Math.round(workoutDurationSec(draft) / 60));

  const setStart = (date: string, time: string) => {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    if ([y, m, d, hh, mm].some((x) => Number.isNaN(x))) return;
    const ns = new Date(y, m - 1, d, hh, mm);
    setDraft((x) => ({ ...x, startedAt: ns.toISOString(), endedAt: new Date(ns.getTime() + durMin * 60_000).toISOString() }));
  };

  const onSave = () => {
    const cleaned: Workout = {
      ...draft,
      name: draft.name.trim() || w.name,
      exercises: draft.exercises
        .map((e) => ({ ...e, sets: e.sets.filter((s) => canComplete(s, lookup(e.exerciseId).kind)).map((s) => ({ ...s, done: true })) }))
        .filter((e) => e.sets.length),
    };
    if (!cleaned.exercises.length) return toast(t('wd.needSet'), 'error');
    if (new Date(cleaned.startedAt) > new Date()) return toast(t('wd.future'), 'error');
    save(cleaned);
    toast(t('wd.updated'), 'success');
    onDone();
  };

  return (
    <Screen
      title={t('wd.editTitle')}
      left={
        <button
          className="nav-btn"
          onClick={async () => {
            if (draft !== w && !(await confirm({ title: t('common.discardChanges'), confirmLabel: t('common.discard'), destructive: true }))) return;
            onDone();
          }}
        >
          {t('common.cancel')}
        </button>
      }
      right={
        <button className="nav-btn is-strong" onClick={onSave}>
          {t('common.save')}
        </button>
      }
    >
      <input className="routine-name-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label={t('session.nameAria')} />
      <div className="wd-edit-meta">
        <label className="field">
          <span>{t('common.date')}</span>
          <input
            className="input"
            type="date"
            value={toLocalDate(start)}
            max={toLocalDate(new Date())}
            onChange={(e) => setStart(e.target.value, `${start.getHours()}:${start.getMinutes()}`)}
          />
        </label>
        <label className="field">
          <span>{t('wd.start')}</span>
          <input className="input" type="time" value={formatTime(start)} onChange={(e) => setStart(toLocalDate(start), e.target.value)} />
        </label>
        <label className="field">
          <span>{t('wd.minutes')}</span>
          <input
            className="input"
            inputMode="numeric"
            value={durMin}
            onChange={(e) => {
              const m = Math.min(600, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1));
              setDraft((x) => ({ ...x, endedAt: new Date(new Date(x.startedAt).getTime() + m * 60_000).toISOString() }));
            }}
          />
        </label>
      </div>
      <div style={{ height: 16 }} />
      <WorkoutEditor workout={draft} mode="edit" onChange={(fn) => setDraft((d) => fn(d))} />
      <label className="field">
        <span>{t('common.notes')}</span>
        <textarea className="input" value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
      </label>
    </Screen>
  );
}
