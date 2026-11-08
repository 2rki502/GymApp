import { useMemo, useState } from 'react';
import { EXERCISES, GYM_GROUPS, HOME_GROUP_LIST } from '@/data/exercises';
import { groupLabel, levelLabel, localizeExercise, localizeTemplate, muscleLabel } from '@/data/localize';
import { HOME_ROUTINES } from '@/data/templates';
import type { ExerciseGroup } from '@/domain/types';
import { matchesQuery } from '@/features/exercises/ExercisePicker';
import { t } from '@/i18n';
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
    { value: 'all' as GroupFilter, label: t('lib.all') },
    ...groups.map((g) => ({ value: g, label: g === 'routines' ? t('lib.routines') : groupLabel(g as ExerciseGroup) })),
    ...(section === 'gym' && custom.length ? [{ value: 'custom' as GroupFilter, label: t('lib.mine') }] : []),
  ];

  const list = useMemo(() => {
    const lib = EXERCISES.map(localizeExercise);
    const pool = section === 'gym' ? [...lib.filter((e) => e.section === 'gym'), ...custom] : lib.filter((e) => e.section === 'home');
    return pool
      .filter((e) => (group === 'all' ? true : group === 'custom' ? e.custom : e.group === group))
      .filter((e) => matchesQuery(e, q));
  }, [section, group, q, custom]);

  const showRoutines = section === 'home' && (group === 'all' || group === 'routines') && !q;
  const sections = useMemo(() => {
    const order = section === 'gym' ? [...GYM_GROUPS, 'custom' as const] : HOME_GROUP_LIST;
    return order.map((g) => ({ g, items: list.filter((e) => e.group === g) })).filter((s) => s.items.length);
  }, [list, section]);

  return (
    <Screen
      title={t('lib.title')}
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
              { value: 'gym', label: t('lib.gym') },
              { value: 'home', label: t('lib.home') },
            ]}
          />
          <div className="search">
            <Icon name="search" size={18} />
            <input type="search" placeholder={t('lib.search')} value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
          </div>
          <Chips value={group} options={chipOptions} onChange={setGroup} />
        </div>
      }
    >
      {showRoutines && (
        <section>
          <h2 className="lib-section">{t('lib.routines')}</h2>
          <div className="tpl-scroller">
            {HOME_ROUTINES.map(localizeTemplate).map((tpl) => (
              <button key={tpl.id} className={`tpl-card color-${tpl.color}`} onClick={() => navigate(`/library/routine/${tpl.id}`)}>
                <span className="tpl-glow" />
                <span className="badge">{levelLabel(tpl.level)}</span>
                <strong>{tpl.name}</strong>
                <span className="tpl-meta">
                  <Icon name="clock" size={13} /> {t('time.minutes', { n: tpl.minutes })} · {t('n.exercises', { n: tpl.exercises.length })}
                </span>
                <span className="tpl-meta">{tpl.equipment}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {group !== 'routines' &&
        sections.map(({ g, items }) => (
          <section key={g}>
            <h2 className="lib-section">{groupLabel(g)}</h2>
            <div className="lib-grid">
              {items.map((e) => (
                <button key={e.id} className="lib-card" onClick={() => navigate(`/library/exercise/${e.id}`)}>
                  <span className="lib-art">
                    <ExerciseThumb anim={e.anim} fit="scene" />
                  </span>
                  <span className="lib-name">{e.name}</span>
                  <span className="lib-sub">{e.primary.slice(0, 2).map(muscleLabel).join(' · ') || groupLabel('custom')}</span>
                </button>
              ))}
            </div>
          </section>
        ))}

      {group !== 'routines' && list.length === 0 && <EmptyState icon="search" title={t('lib.noMatch')} text={t('lib.noMatchText')} />}
    </Screen>
  );
}
