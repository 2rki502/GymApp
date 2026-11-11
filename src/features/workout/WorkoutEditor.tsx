import { memo, useMemo, useState } from 'react';
import { formatClock } from '@/domain/dates';
import { e1rm, previousSets, type PersonalBests } from '@/domain/metrics';
import { fromDisplayWeight, toDisplayWeight, weightUnit } from '@/domain/units';
import {
  addExercises, addSet, canComplete, cycleSetType, fillFromHint, moveExercise, removeExercise, removeSet,
  replaceExercise, setRest, updateSet,
} from '@/domain/workoutOps';
import type { Exercise, ExerciseLog, ID, SetLog, SetType, UnitSystem, Workout } from '@/domain/types';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { ExerciseThumb } from '@/features/library/figure/Figure';
import { t, type Key } from '@/i18n';
import { unlockAudio, vibrate } from '@/lib/feedback';
import { useExerciseLookup } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { Stepper, SwipeRow } from '@/ui/controls';
import { actionSheet, toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { NumInput } from './NumInput';
import './workout.css';

type Mode = 'live' | 'edit';

interface Props {
  workout: Workout;
  onChange: (fn: (w: Workout) => Workout) => void;
  mode: Mode;
  /** all-time bests from finished workouts, for live PR badges */
  bests?: Map<ID, PersonalBests>;
}

export function WorkoutEditor({ workout, onChange, mode, bests }: Props) {
  const lookup = useExerciseLookup();
  const workouts = useData((s) => s.workouts);
  const units = useData((s) => s.settings.units);
  const defaultRest = useData((s) => s.settings.defaultRestSec);
  const startRest = useData((s) => s.startRest);
  const [picker, setPicker] = useState<{ replace?: ID } | null>(null);
  const [restFor, setRestFor] = useState<ExerciseLog | null>(null);

  const hints = useMemo(() => {
    const m = new Map<ID, SetLog[]>();
    for (const e of workout.exercises) if (!m.has(e.exerciseId)) m.set(e.exerciseId, previousSets(workouts, e.exerciseId, workout.id));
    return m;
  }, [workouts, workout.exercises, workout.id]);

  const openMenu = (log: ExerciseLog, ex: Exercise, index: number) => {
    actionSheet({
      title: ex.name,
      actions: [
        ...(ex.instructions.length ? [{ label: t('editor.howTo'), onSelect: () => useUI.getState().set({ peekExercise: ex.id }) }] : []),
        { label: t('editor.replace'), onSelect: () => setPicker({ replace: log.id }) },
        ...(mode === 'live'
          ? [{ label: t('editor.restTimer', { time: log.restSec ? formatClock(log.restSec) : t('common.off') }), onSelect: () => setRestFor(log) }]
          : []),
        ...(index > 0 ? [{ label: t('editor.moveUp'), onSelect: () => onChange((w) => moveExercise(w, log.id, -1)) }] : []),
        ...(index < workout.exercises.length - 1 ? [{ label: t('editor.moveDown'), onSelect: () => onChange((w) => moveExercise(w, log.id, 1)) }] : []),
        { label: t('editor.remove'), destructive: true, onSelect: () => onChange((w) => removeExercise(w, log.id)) },
      ],
    });
  };

  return (
    <div className="wo-editor">
      {workout.exercises.map((log, i) => {
        const ex = lookup(log.exerciseId);
        return (
          <ExerciseBlock
            key={log.id}
            log={log}
            ex={ex}
            mode={mode}
            units={units}
            hints={hints.get(log.exerciseId) ?? []}
            best={bests?.get(log.exerciseId)}
            onMenu={() => openMenu(log, ex, i)}
            onChange={onChange}
            onCompleted={() => log.restSec > 0 && startRest(log.restSec, log.id)}
          />
        );
      })}

      <button className="btn btn-block wo-add" onClick={() => setPicker({})}>
        <Icon name="plus" size={20} stroke={2.4} /> {t('editor.addExercise')}
      </button>

      <ExercisePicker
        open={!!picker}
        multi={!picker?.replace}
        title={picker?.replace ? t('editor.replaceTitle') : t('editor.addTitle')}
        onClose={() => setPicker(null)}
        onPick={(ids) => {
          if (picker?.replace) onChange((w) => replaceExercise(w, picker.replace!, ids[0]));
          else
            onChange((w) => {
              let next = addExercises(w, ids, defaultRest);
              // Use each exercise's recommended rest when it's in the library.
              for (const e of next.exercises.slice(-ids.length)) next = setRest(next, e.id, lookup(e.exerciseId).recommended.restSec || defaultRest);
              if (mode === 'edit') {
                next = { ...next, exercises: next.exercises.map((e, idx) => (idx >= w.exercises.length ? { ...e, sets: e.sets.map((s) => ({ ...s, done: true })) } : e)) };
              }
              return next;
            });
        }}
      />

      <Sheet
        open={!!restFor}
        onClose={() => setRestFor(null)}
        title={t('editor.restTitle')}
        right={<button className="nav-btn is-strong" onClick={() => setRestFor(null)}>{t('common.done')}</button>}
      >
        {restFor && (
          <RestPicker
            value={workout.exercises.find((e) => e.id === restFor.id)?.restSec ?? restFor.restSec}
            onChange={(v) => onChange((w) => setRest(w, restFor.id, v))}
          />
        )}
      </Sheet>
    </div>
  );
}

function RestPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const presets = [0, 30, 60, 90, 120, 150, 180, 240];
  return (
    <div className="rest-picker">
      <p className="muted">{t('editor.restHelp')}</p>
      <div className="rest-picker-main">
        <Stepper label={t('editor.restAria')} value={value} step={15} min={0} max={600} onChange={onChange} format={(v) => (v ? formatClock(v) : t('common.off'))} />
      </div>
      <div className="rest-presets">
        {presets.map((p) => (
          <button key={p} className={`chip ${p === value ? 'is-active' : ''}`} onClick={() => onChange(p)}>
            {p ? formatClock(p) : t('common.off')}
          </button>
        ))}
      </div>
    </div>
  );
}

const TYPE_LETTER: Record<SetType, Key | null> = { normal: null, warmup: 'set.warmup', drop: 'set.drop', failure: 'set.failure' };
const TYPE_NAME: Record<SetType, Key> = { normal: 'setType.normal', warmup: 'setType.warmup', drop: 'setType.drop', failure: 'setType.failure' };

const ExerciseBlock = memo(function ExerciseBlock({
  log,
  ex,
  mode,
  units,
  hints,
  best,
  onMenu,
  onChange,
  onCompleted,
}: {
  log: ExerciseLog;
  ex: Exercise;
  mode: Mode;
  units: UnitSystem;
  hints: SetLog[];
  best?: PersonalBests;
  onMenu: () => void;
  onChange: (fn: (w: Workout) => Workout) => void;
  onCompleted: () => void;
}) {
  const [shake, setShake] = useState<ID | null>(null);
  const kind = ex.kind;
  const doneCount = log.sets.filter((s) => s.done).length;
  let normalIdx = 0;

  const toggleDone = (s: SetLog, hint: SetLog | undefined) => {
    unlockAudio();
    if (s.done) return onChange((w) => updateSet(w, log.id, s.id, { done: false }));
    const filled = fillFromHint(s, hint);
    if (!canComplete(filled, kind)) {
      setShake(s.id);
      vibrate(30);
      setTimeout(() => setShake(null), 400);
      toast(kind === 'time' ? t('editor.needDuration') : kind === 'reps' ? t('editor.needReps') : t('editor.needWeightReps'), 'error');
      return;
    }
    vibrate(10);
    onChange((w) => updateSet(w, log.id, s.id, { weight: filled.weight, reps: filled.reps, duration: filled.duration, done: true }));
    onCompleted();
  };

  const isPR = (s: SetLog) => {
    if (!best || !s.done || s.type === 'warmup') return false;
    if (kind === 'weight') {
      const w = s.weight ?? 0;
      const r = s.reps ?? 0;
      return (best.e1rm > 0 && e1rm(w, r) > best.e1rm + 1e-9) || (best.weight > 0 && r > 0 && w > best.weight + 1e-9);
    }
    if (kind === 'time') return best.duration > 0 && (s.duration ?? 0) > best.duration;
    return best.reps > 0 && (s.reps ?? 0) > best.reps;
  };

  const hintText = (h?: SetLog) => {
    if (!h) return '—';
    if (kind === 'time') return t('time.seconds', { n: h.duration ?? 0 });
    if (kind === 'reps') return t('n.reps', { n: h.reps ?? 0 });
    return `${Math.round(toDisplayWeight(h.weight ?? 0, units) * 10) / 10} × ${h.reps ?? 0}`;
  };

  return (
    <section className="ex-block">
      <header className="ex-head">
        <button className="ex-head-main" onClick={() => ex.instructions.length && useUI.getState().set({ peekExercise: ex.id })}>
          <span className="ex-thumb ex-thumb-sm">
            <ExerciseThumb anim={ex.anim} video={ex.video} />
          </span>
          <span className="ex-title">
            <span className="ex-name">{ex.name}</span>
            <span className="ex-meta">
              {mode === 'live' ? t('editor.setsProgress', { done: doneCount, total: log.sets.length }) : t('n.sets', { n: log.sets.length })}
              {mode === 'live' && log.restSec > 0 && (
                <>
                  {' · '}
                  <Icon name="timer" size={12} stroke={2.4} /> {formatClock(log.restSec)}
                </>
              )}
            </span>
          </span>
        </button>
        <button className="icon-btn" onClick={onMenu} aria-label={t('editor.options', { name: ex.name })}>
          <Icon name="more" size={22} stroke={3} />
        </button>
      </header>

      <div className={`set-grid set-grid-${kind} ${mode === 'edit' ? 'is-edit' : ''}`}>
        <div className="set-hdr">
          <span>{t('editor.colSet')}</span>
          <span>{t('editor.colPrev')}</span>
          {kind === 'weight' && <span>{weightUnit(units)}</span>}
          {kind !== 'time' && <span>{t('editor.colReps')}</span>}
          {kind === 'time' && <span>{t('editor.colSecs')}</span>}
          {mode === 'live' && <span className="set-hdr-check"><Icon name="check" size={14} stroke={3} /></span>}
        </div>
        {log.sets.map((s, idx) => {
          const hint = hints[idx] ?? hints[hints.length - 1];
          const letter = TYPE_LETTER[s.type];
          const label = letter ? t(letter) : String(++normalIdx);
          const pr = isPR(s);
          return (
            <SwipeRow key={s.id} onDelete={() => onChange((w) => removeSet(w, log.id, s.id))}>
              <div className={`set-row ${s.done && mode === 'live' ? 'is-done' : ''} ${shake === s.id ? 'is-shake' : ''}`}>
                <button
                  className={`set-type set-type-${s.type}`}
                  onClick={() => onChange((w) => cycleSetType(w, log.id, s.id))}
                  aria-label={t('editor.typeAria', { label, type: t(TYPE_NAME[s.type]) })}
                >
                  {label}
                </button>
                <button
                  className="set-prev"
                  disabled={!hint}
                  onClick={() => hint && onChange((w) => updateSet(w, log.id, s.id, { weight: hint.weight, reps: hint.reps, duration: hint.duration }))}
                  aria-label={t('editor.usePrev')}
                >
                  {pr ? (
                    <span className="badge badge-gold">
                      <Icon name="trophy" size={12} stroke={2.4} /> {t('pr.short')}
                    </span>
                  ) : (
                    hintText(hint)
                  )}
                </button>
                {kind === 'weight' && (
                  <NumInput
                    className="set-input num"
                    ariaLabel={t('editor.weightAria', { label })}
                    value={s.weight === null ? null : toDisplayWeight(s.weight, units)}
                    placeholder={hint?.weight != null ? String(Math.round(toDisplayWeight(hint.weight, units) * 10) / 10) : '0'}
                    onCommit={(v) => onChange((w) => updateSet(w, log.id, s.id, { weight: v === null ? null : fromDisplayWeight(v, units) }))}
                    max={2000}
                  />
                )}
                {kind !== 'time' && (
                  <NumInput
                    className="set-input num"
                    integer
                    ariaLabel={t('editor.repsAria', { label })}
                    value={s.reps}
                    placeholder={hint?.reps != null ? String(hint.reps) : '0'}
                    onCommit={(v) => onChange((w) => updateSet(w, log.id, s.id, { reps: v }))}
                    max={999}
                  />
                )}
                {kind === 'time' && (
                  <NumInput
                    className="set-input num"
                    integer
                    ariaLabel={t('editor.secsAria', { label })}
                    value={s.duration}
                    placeholder={hint?.duration != null ? String(hint.duration) : '0'}
                    onCommit={(v) => onChange((w) => updateSet(w, log.id, s.id, { duration: v }))}
                    max={36000}
                  />
                )}
                {mode === 'live' && (
                  <button
                    className={`set-check ${s.done ? 'is-on' : ''}`}
                    onClick={() => toggleDone(s, hint)}
                    aria-label={s.done ? t('editor.uncheck') : t('editor.check')}
                    aria-pressed={s.done}
                  >
                    <Icon name="check" size={18} stroke={3} />
                  </button>
                )}
              </div>
            </SwipeRow>
          );
        })}
      </div>
      <button className="ex-add-set" onClick={() => onChange((w) => addSet(w, log.id, mode === 'edit'))}>
        <Icon name="plus" size={16} stroke={2.6} /> {t('editor.addSet')}
      </button>
    </section>
  );
});
