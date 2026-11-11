import { useState } from 'react';
import { formatClock } from '@/domain/dates';
import { uid } from '@/domain/id';
import type { AccentColor, Routine, RoutineExercise } from '@/domain/types';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { ExerciseThumb } from '@/features/library/figure/Figure';
import { startRoutine } from '@/features/session/actions';
import { t } from '@/i18n';
import { goBack } from '@/lib/router';
import { useExerciseLookup } from '@/store/selectors';
import { useData } from '@/store/useData';
import { EmptyState, Stepper } from '@/ui/controls';
import { confirm, toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import './workouts.css';

const COLORS: AccentColor[] = ['lime', 'blue', 'orange', 'pink', 'purple', 'teal'];

export function RoutineEditorScreen({ id }: { id: string }) {
  const existing = useData((s) => s.routines.find((r) => r.id === id));
  const save = useData((s) => s.saveRoutine);
  const del = useData((s) => s.deleteRoutine);
  const lookup = useExerciseLookup();
  const isNew = id === 'new' || !existing;
  const [draft, setDraft] = useState<Routine>(
    () =>
      existing ?? {
        id: uid(),
        name: '',
        color: 'lime',
        exercises: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
  );
  const [picking, setPicking] = useState(false);
  const [dirty, setDirty] = useState(false);

  const patch = (p: Partial<Routine>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };
  const patchEx = (exId: string, p: Partial<RoutineExercise>) =>
    patch({ exercises: draft.exercises.map((e) => (e.id === exId ? { ...e, ...p } : e)) });
  const move = (i: number, d: -1 | 1) => {
    const list = [...draft.exercises];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    patch({ exercises: list });
  };

  const valid = draft.name.trim().length > 0 && draft.exercises.length > 0;
  const onSave = () => {
    if (!draft.name.trim()) return toast(t('re.nameRequired'), 'error');
    if (!draft.exercises.length) return toast(t('re.exerciseRequired'), 'error');
    save({ ...draft, name: draft.name.trim() });
    toast(isNew ? t('re.created') : t('re.saved'), 'success');
    goBack('/workouts');
  };
  const onCancel = async () => {
    if (dirty && !(await confirm({ title: t('common.discardChanges'), confirmLabel: t('common.discard'), destructive: true }))) return;
    goBack('/workouts');
  };

  return (
    <Screen
      title={isNew ? t('re.new') : t('re.edit')}
      left={
        <button className="nav-btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      }
      right={
        <button className="nav-btn is-strong" onClick={onSave} disabled={!valid}>
          {t('common.save')}
        </button>
      }
    >
      <input
        className="routine-name-input"
        placeholder={t('re.namePlaceholder')}
        value={draft.name}
        onChange={(e) => patch({ name: e.target.value })}
        autoCapitalize="words"
        aria-label={t('re.namePlaceholder')}
      />
      <div className="color-pick" role="radiogroup" aria-label={t('re.colour')}>
        {COLORS.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={draft.color === c}
            aria-label={t(`color.${c}`)}
            className={`color-swatch color-${c} ${draft.color === c ? 'is-on' : ''}`}
            onClick={() => patch({ color: c })}
          />
        ))}
      </div>

      {draft.exercises.length === 0 ? (
        <EmptyState icon="dumbbell" title={t('re.empty')} text={t('re.emptyText')} />
      ) : (
        <div className="re-list">
          {draft.exercises.map((e, i) => {
            const ex = lookup(e.exerciseId);
            return (
              <div key={e.id} className="re-item">
                <div className="re-head">
                  <span className="ex-thumb ex-thumb-sm">
                    <ExerciseThumb anim={ex.anim} video={ex.video} />
                  </span>
                  <strong>{ex.name}</strong>
                  <div className="re-tools">
                    <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('editor.moveUp')}>
                      <Icon name="arrowUp" size={16} />
                    </button>
                    <button className="icon-btn" disabled={i === draft.exercises.length - 1} onClick={() => move(i, 1)} aria-label={t('editor.moveDown')}>
                      <Icon name="arrowDown" size={16} />
                    </button>
                    <button className="icon-btn" onClick={() => patch({ exercises: draft.exercises.filter((x) => x.id !== e.id) })} aria-label={t('re.remove')}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
                <div className="re-fields">
                  <label>
                    <span>{t('re.sets')}</span>
                    <Stepper label={t('re.setsAria')} value={e.sets} min={1} max={12} onChange={(v) => patchEx(e.id, { sets: v })} />
                  </label>
                  <label>
                    <span>{ex.kind === 'time' ? t('re.time') : t('re.reps')}</span>
                    <input className="re-input" value={e.reps} onChange={(ev) => patchEx(e.id, { reps: ev.target.value.slice(0, 16) })} aria-label={t('re.repsAria')} />
                  </label>
                  <label>
                    <span>{t('re.rest')}</span>
                    <Stepper
                      label={t('editor.restAria')}
                      value={e.restSec}
                      step={15}
                      min={0}
                      max={600}
                      onChange={(v) => patchEx(e.id, { restSec: v })}
                      format={(v) => (v ? formatClock(v) : t('common.off'))}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn btn-block wo-add" style={{ marginTop: 14 }} onClick={() => setPicking(true)}>
        <Icon name="plus" size={20} stroke={2.4} /> {t('re.addExercises')}
      </button>

      <label className="field">
        <span>{t('common.notes')}</span>
        <textarea className="input" value={draft.note ?? ''} placeholder={t('re.notesPlaceholder')} onChange={(e) => patch({ note: e.target.value })} />
      </label>

      {!isNew && (
        <div className="btn-row" style={{ marginTop: 24 }}>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (await confirm({ title: t('wk.deleteTitle', { name: draft.name }), message: t('wk.historyKept'), confirmLabel: t('common.delete'), destructive: true })) {
                del(draft.id);
                goBack('/workouts');
              }
            }}
          >
            {t('common.delete')}
          </button>
          <button
            className="btn btn-primary"
            disabled={!valid}
            onClick={() => {
              save({ ...draft, name: draft.name.trim() });
              startRoutine({ ...draft, name: draft.name.trim() });
            }}
          >
            <Icon name="play" size={14} fill /> {t('common.start')}
          </button>
        </div>
      )}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(ids) =>
          patch({
            exercises: [
              ...draft.exercises,
              ...ids.map((exerciseId) => {
                const rec = lookup(exerciseId).recommended;
                return { id: uid(), exerciseId, sets: rec.sets, reps: rec.reps, restSec: rec.restSec };
              }),
            ],
          })
        }
      />
    </Screen>
  );
}
