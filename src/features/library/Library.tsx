import { useMemo, useState } from 'react';
import { EXERCISES, GYM_GROUPS, HOME_GROUP_LIST } from '@/data/exercises';
import { groupLabel, levelLabel, localizeExercise, localizeTemplate, muscleLabel } from '@/data/localize';
import { HOME_ROUTINES, type RoutineTemplate } from '@/data/templates';
import type { ExerciseGroup, GymGroup, Level } from '@/domain/types';
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
type AreaFilter = 'all' | GymGroup;

export const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced'];
const levelRank = (l?: Level) => (l ? LEVELS.indexOf(l) : LEVELS.length);
const byLevel = <T extends { level?: Level }>(items: T[]) => [...items].sort((a, b) => levelRank(a.level) - levelRank(b.level));

export function LibraryScreen() {
  const section = useUI((s) => s.librarySection);
  const setUI = useUI((s) => s.set);
  const custom = useData((s) => s.customExercises);
  const [group, setGroup] = useState<GroupFilter>('all');
  const [area, setArea] = useState<AreaFilter>('all');
  const [q, setQ] = useState('');
  const home = section === 'home';

  const groups: GroupFilter[] = home ? ['routines', ...HOME_GROUP_LIST] : GYM_GROUPS;
  const chipOptions = [
    { value: 'all' as GroupFilter, label: t('lib.all') },
    ...groups.map((g) => ({ value: g, label: g === 'routines' ? t('lib.routines') : groupLabel(g as ExerciseGroup) })),
    ...(!home && custom.length ? [{ value: 'custom' as GroupFilter, label: t('lib.mine') }] : []),
  ];
  // Home is organised by equipment first; this second row narrows it to a body area.
  const areaOptions = [{ value: 'all' as AreaFilter, label: t('lib.anyMuscle') }, ...GYM_GROUPS.map((g) => ({ value: g as AreaFilter, label: groupLabel(g) }))];

  const list = useMemo(() => {
    const lib = EXERCISES.map(localizeExercise);
    // Home lists its own exercises plus gym exercises that only need home equipment.
    const pool = home ? lib.filter((e) => e.homeGroup) : [...lib.filter((e) => e.section === 'gym'), ...custom];
    return pool
      .filter((e) => (group === 'all' ? true : group === 'custom' ? e.custom : home ? e.homeGroup === group : e.group === group))
      .filter((e) => (home && area !== 'all' ? e.area === area : true))
      .filter((e) => matchesQuery(e, q));
  }, [home, group, area, q, custom]);

  const routines = useMemo(() => byLevel(HOME_ROUTINES).map(localizeTemplate), []);
  const showRoutines = home && (group === 'all' || group === 'routines') && !q && area === 'all';
  const sections = useMemo(() => {
    if (home) return HOME_GROUP_LIST.map((g) => ({ g, items: byLevel(list.filter((e) => e.homeGroup === g)) })).filter((s) => s.items.length);
    return [...GYM_GROUPS, 'custom' as const].map((g) => ({ g, items: list.filter((e) => e.group === g) })).filter((s) => s.items.length);
  }, [list, home]);

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
              setArea('all');
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
          {home && group !== 'routines' && <Chips value={area} options={areaOptions} onChange={setArea} />}
        </div>
      }
    >
      {showRoutines && group === 'all' && (
        <section>
          <h2 className="lib-section">{t('lib.routines')}</h2>
          <div className="tpl-scroller">
            {routines.map((tpl) => (
              <TemplateCard key={tpl.id} tpl={tpl} />
            ))}
          </div>
        </section>
      )}

      {showRoutines &&
        group === 'routines' &&
        LEVELS.map((level) => (
          <section key={level}>
            <h2 className="lib-section">{levelLabel(level)}</h2>
            <div className="tpl-grid">
              {routines
                .filter((r) => r.level === level)
                .map((tpl) => (
                  <TemplateCard key={tpl.id} tpl={tpl} />
                ))}
            </div>
          </section>
        ))}

      {group !== 'routines' &&
        sections.map(({ g, items }) => (
          <section key={g}>
            <h2 className="lib-section">
              {groupLabel(g)} <span className="lib-count num">{items.length}</span>
            </h2>
            <div className="lib-grid">
              {items.map((e) => (
                <button key={e.id} className="lib-card" onClick={() => navigate(`/library/exercise/${e.id}`)}>
                  <span className="lib-art">
                    <ExerciseThumb anim={e.anim} video={e.video} fit="scene" />
                    {e.level && <span className={`lib-level is-${e.level.toLowerCase()}`}>{levelLabel(e.level)}</span>}
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

function TemplateCard({ tpl }: { tpl: RoutineTemplate }) {
  return (
    <button className={`tpl-card color-${tpl.color}`} onClick={() => navigate(`/library/routine/${tpl.id}`)}>
      <span className="tpl-glow" />
      <span className="badge">{levelLabel(tpl.level)}</span>
      <strong>{tpl.name}</strong>
      <span className="tpl-meta">
        <Icon name="clock" size={13} /> {t('time.minutes', { n: tpl.minutes })} · {t('n.exercises', { n: tpl.exercises.length })}
      </span>
      <span className="tpl-meta">{tpl.equipment}</span>
    </button>
  );
}
