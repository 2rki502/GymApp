import { useMemo, useState } from 'react';
import { GROUP_LABEL, GYM_GROUPS, HOME_GROUP_LIST, MUSCLE_LABEL } from '@/data/exercises';
import { uid } from '@/domain/id';
import type { Exercise, ExerciseGroup, ExerciseKind, ID, Muscle } from '@/domain/types';
import { ExerciseThumb } from '@/features/library/figure/Figure';
import { useAllExercises } from '@/store/selectors';
import { useData } from '@/store/useData';
import { Chips, Segmented } from '@/ui/controls';
import { toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import './exercises.css';

type Filter = 'all' | 'recent' | ExerciseGroup;

export function matchesQuery(e: Exercise, q: string): boolean {
  if (!q) return true;
  const hay = `${e.name} ${e.primary.join(' ')} ${e.secondary.join(' ')} ${e.equipment.join(' ')} ${GROUP_LABEL[e.group]}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t));
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
  multi = true,
  title = 'Add Exercises',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ids: ID[]) => void;
  multi?: boolean;
  title?: string;
}) {
  const all = useAllExercises();
  const workouts = useData((s) => s.workouts);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<ID[]>([]);
  const [creating, setCreating] = useState(false);

  const recentIds = useMemo(() => {
    const seen: ID[] = [];
    for (const w of [...workouts].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
      for (const e of w.exercises) if (!seen.includes(e.exerciseId)) seen.push(e.exerciseId);
      if (seen.length >= 15) break;
    }
    return seen;
  }, [workouts]);

  const hasCustom = all.some((e) => e.custom);
  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...(recentIds.length ? [{ value: 'recent' as Filter, label: 'Recent' }] : []),
    ...(hasCustom ? [{ value: 'custom' as Filter, label: 'Custom' }] : []),
    ...[...GYM_GROUPS, ...HOME_GROUP_LIST].map((g) => ({ value: g as Filter, label: GROUP_LABEL[g] })),
  ];

  const list = useMemo(() => {
    let base = all;
    if (filter === 'recent') base = recentIds.map((id) => all.find((e) => e.id === id)).filter((e): e is Exercise => !!e);
    else if (filter !== 'all') base = all.filter((e) => e.group === filter);
    const r = base.filter((e) => matchesQuery(e, q));
    return filter === 'recent' ? r : [...r].sort((a, b) => a.name.localeCompare(b.name));
  }, [all, filter, q, recentIds]);

  const reset = () => {
    setQ('');
    setSelected([]);
    setFilter('all');
  };
  const close = () => {
    reset();
    onClose();
  };
  const commit = (ids: ID[]) => {
    if (!ids.length) return;
    onPick(ids);
    reset();
    onClose();
  };
  const toggle = (id: ID) => {
    if (!multi) return commit([id]);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={close}
        full
        title={title}
        left={<button className="nav-btn" onClick={close}>Cancel</button>}
        right={<button className="nav-btn" onClick={() => setCreating(true)} aria-label="New custom exercise"><Icon name="plus" /></button>}
      >
        <div className="search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Search exercises, muscles, equipment" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
        </div>
        <Chips value={filter} options={filters} onChange={setFilter} />
        <div className="picker-list">
          {list.map((e) => {
            const idx = selected.indexOf(e.id);
            return (
              <button key={e.id} className={`picker-item ${idx >= 0 ? 'is-selected' : ''}`} onClick={() => toggle(e.id)}>
                <span className="ex-thumb">
                  <ExerciseThumb anim={e.anim} />
                </span>
                <span className="picker-main">
                  <span className="picker-name">{e.name}</span>
                  <span className="picker-sub">
                    {e.primary.map(MUSCLE_LABEL).join(', ') || GROUP_LABEL[e.group]} · {e.equipment[0] ?? '—'}
                  </span>
                </span>
                {multi && <span className="picker-check">{idx >= 0 ? <span className="num">{idx + 1}</span> : null}</span>}
              </button>
            );
          })}
          {list.length === 0 && (
            <div className="picker-empty">
              <p>No exercises match “{q}”.</p>
              <button className="btn btn-sm" onClick={() => setCreating(true)}>
                <Icon name="plus" size={16} /> Create “{q}”
              </button>
            </div>
          )}
        </div>
        {multi && selected.length > 0 && (
          <div className="picker-footer">
            <button className="btn btn-primary btn-block" onClick={() => commit(selected)}>
              Add {selected.length} exercise{selected.length > 1 ? 's' : ''}
            </button>
          </div>
        )}
      </Sheet>
      <CustomExerciseSheet
        open={creating}
        initialName={q}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          if (multi) setSelected((s) => [...s, id]);
          else commit([id]);
          setQ('');
          setFilter('all');
        }}
      />
    </>
  );
}

const MUSCLE_OPTIONS: Muscle[] = ['chest', 'upper back', 'lats', 'front delts', 'side delts', 'rear delts', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'lower back', 'quads', 'hamstrings', 'glutes', 'calves', 'cardio'];

export function CustomExerciseSheet({
  open,
  onClose,
  onCreated,
  initialName = '',
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: ID) => void;
  initialName?: string;
}) {
  const save = useData((s) => s.saveCustomExercise);
  const [name, setName] = useState(initialName);
  const [kind, setKind] = useState<ExerciseKind>('weight');
  const [muscle, setMuscle] = useState<Muscle>('chest');
  const [equipment, setEquipment] = useState('');
  const [lastInitial, setLastInitial] = useState(initialName);

  if (open && initialName !== lastInitial) {
    setLastInitial(initialName);
    setName(initialName);
  }

  const submit = () => {
    const n = name.trim();
    if (!n) return toast('Give the exercise a name', 'error');
    const id = `custom-${uid()}`;
    save({
      id,
      name: n,
      section: 'custom',
      group: 'custom',
      kind,
      primary: [muscle],
      secondary: [],
      equipment: equipment.trim() ? [equipment.trim()] : [],
      instructions: [],
      mistakes: [],
      recommended: { sets: 3, reps: kind === 'time' ? '30-60s' : '8-12', restSec: 90 },
      custom: true,
    });
    toast(`${n} created`, 'success');
    setName('');
    setEquipment('');
    onCreated(id);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New Exercise"
      left={<button className="nav-btn" onClick={onClose}>Cancel</button>}
      right={<button className="nav-btn is-strong" onClick={submit} disabled={!name.trim()}>Save</button>}
    >
      <label className="field">
        <span>Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cable Lateral Raise" autoCapitalize="words" />
      </label>
      <div className="field">
        <span>Tracking</span>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'weight', label: 'Weight × Reps' },
            { value: 'reps', label: 'Reps' },
            { value: 'time', label: 'Time' },
          ]}
        />
      </div>
      <label className="field">
        <span>Primary muscle</span>
        <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}>
          {MUSCLE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {MUSCLE_LABEL(m)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Equipment (optional)</span>
        <input className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="e.g. Cable machine" />
      </label>
    </Sheet>
  );
}
