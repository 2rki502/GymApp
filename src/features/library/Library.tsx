import { useMemo, useState } from 'react';
import { EXERCISES, GROUP_LABEL, GYM_GROUPS, HOME_GROUP_LIST, MUSCLE_LABEL } from '@/data/exercises';
import { HOME_ROUTINES } from '@/data/templates';
import type { ExerciseGroup } from '@/domain/types';
import { matchesQuery } from '@/features/exercises/ExercisePicker';
import { navigate } from '@/lib/router';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { Chips, EmptyState, Segmented } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { ExerciseThumb } from './figure/Figure';
import './library.css';

type GroupFilter = 'all' | 'routines' | 'custom' | ExerciseGroup;

export function LibraryScreen() {
  const section = useUI((s) => s.librarySection);
  const setUI = useUI((s) => s.set);
  const custom = useData((s) => s.customExercises);
  const [group, setGroup] = useState<GroupFilter>('all');
  const [q, setQ] = useState('');

  const groups: GroupFilter[] = section === 'gym' ? GYM_GROUPS : ['routines', ...HOME_GROUP_LIST];
  const chipOptions = [
    { value: 'all' as GroupFilter, label: 'All' },
    ...groups.map((g) => ({ value: g, label: g === 'routines' ? 'Full-Body Routines' : GROUP_LABEL[g as ExerciseGroup] })),
    ...(section === 'gym' && custom.length ? [{ value: 'custom' as GroupFilter, label: 'My Exercises' }] : []),
  ];

  const list = useMemo(() => {
    const pool = section === 'gym' ? [...EXERCISES.filter((e) => e.section === 'gym'), ...custom] : EXERCISES.filter((e) => e.section === 'home');
    return pool
      .filter((e) => (group === 'all' ? true : group === 'custom' ? e.custom : e.group === group))
      .filter((e) => matchesQuery(e, q));
  }, [section, group, q, custom]);

  const showRoutines = section === 'home' && (group === 'all' || group === 'routines') && !q;
  const sections = useMemo(() => {
    const order = section === 'gym' ? [...GYM_GROUPS, 'custom' as const] : HOME_GROUP_LIST;
    return order
      .map((g) => ({ g, items: list.filter((e) => e.group === g) }))
      .filter((s) => s.items.length);
  }, [list, section]);

  return (
    <Screen
      title="Library"
      large
      header={
        <div className="lib-head">
          <Segmented
            value={section}
            onChange={(v) => {
              setUI({ librarySection: v });
              setGroup('all');
            }}
            options={[
              { value: 'gym', label: 'Gym' },
              { value: 'home', label: 'Home' },
            ]}
          />
          <div className="search">
            <Icon name="search" size={18} />
            <input type="search" placeholder="Search exercises or muscles" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
          </div>
          <Chips value={group} options={chipOptions} onChange={setGroup} />
        </div>
      }
    >
      {showRoutines && (
        <section>
          <h2 className="lib-section">Full-Body Routines</h2>
          <div className="tpl-scroller">
            {HOME_ROUTINES.map((t) => (
              <button key={t.id} className={`tpl-card color-${t.color}`} onClick={() => navigate(`/library/routine/${t.id}`)}>
                <span className="tpl-glow" />
                <span className="badge">{t.level}</span>
                <strong>{t.name}</strong>
                <span className="tpl-meta">
                  <Icon name="clock" size={13} /> {t.minutes} min · {t.exercises.length} exercises
                </span>
                <span className="tpl-meta">{t.equipment}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {group !== 'routines' &&
        sections.map(({ g, items }) => (
          <section key={g}>
            <h2 className="lib-section">{GROUP_LABEL[g]}</h2>
            <div className="lib-grid">
              {items.map((e) => (
                <button key={e.id} className="lib-card" onClick={() => navigate(`/library/exercise/${e.id}`)}>
                  <span className="lib-art">
                    <ExerciseThumb anim={e.anim} fit="scene" />
                  </span>
                  <span className="lib-name">{e.name}</span>
                  <span className="lib-sub">{e.primary.slice(0, 2).map(MUSCLE_LABEL).join(' · ') || 'Custom'}</span>
                </button>
              ))}
            </div>
          </section>
        ))}

      {group !== 'routines' && list.length === 0 && <EmptyState icon="search" title="No matches" text="Try a different search or category." />}
    </Screen>
  );
}
