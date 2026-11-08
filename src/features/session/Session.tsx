import { useEffect, useMemo, useRef, useState } from 'react';
import { formatClock, formatDuration } from '@/domain/dates';
import { computePRs, workoutSetCount } from '@/domain/metrics';
import { countSets } from '@/domain/workoutOps';
import type { PRKind, Workout } from '@/domain/types';
import { WorkoutEditor } from '@/features/workout/WorkoutEditor';
import { t } from '@/i18n';
import { restDoneChime } from '@/lib/feedback';
import { navigate } from '@/lib/router';
import { useNow } from '@/lib/useNow';
import { useExerciseLookup, usePRs } from '@/store/selectors';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { confirm, toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import './session.css';

/** Full-screen live workout logger, presented above the tab bar. */
export function SessionView() {
  const session = useData((s) => s.session);
  const updateSession = useData((s) => s.updateSession);
  const finishSession = useData((s) => s.finishSession);
  const discardSession = useData((s) => s.discardSession);
  const open = useUI((s) => s.sessionOpen);
  const setUI = useUI((s) => s.set);
  const { bests } = usePRs();
  const now = useNow(1000, !!session && open);
  const [renaming, setRenaming] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const shown = !!session && open;

  // Keep mounted during the slide-down animation.
  useEffect(() => {
    if (shown) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const last = useRef<Workout | null>(null);
  if (session) last.current = session;
  const w = session ?? last.current;
  if (!visible || !w) return null;

  const elapsed = (now - new Date(w.startedAt).getTime()) / 1000;
  const { done, total } = countSets(w);

  const finish = async () => {
    if (done === 0) {
      const discard = await confirm({
        title: t('session.noSetsTitle'),
        message: t('session.noSetsMsg'),
        confirmLabel: t('session.discardWorkout'),
        cancelLabel: t('session.keepGoing'),
        destructive: true,
      });
      if (discard) discardSession();
      return;
    }
    if (done < total) {
      const ok = await confirm({
        title: t('session.finishTitle'),
        message: t('session.incomplete', { n: total - done }),
        confirmLabel: t('session.finish'),
      });
      if (!ok) return;
    }
    const saved = finishSession();
    if (saved) setUI({ summary: saved, sessionOpen: true });
  };

  const cancel = async () => {
    const ok = await confirm({
      title: t('session.discardTitle'),
      message: t('session.discardMsg'),
      confirmLabel: t('common.discard'),
      destructive: true,
    });
    if (ok) {
      discardSession();
      toast(t('session.discarded'));
    }
  };

  return (
    <div className={`session ${closing ? 'is-closing' : ''}`} role="dialog" aria-label={t('session.aria')}>
      <header className="session-bar">
        <button className="icon-btn" onClick={() => setUI({ sessionOpen: false })} aria-label={t('session.minimise')}>
          <Icon name="chevronDown" size={22} stroke={2.4} />
        </button>
        <div className="session-clock num" aria-label={t('session.elapsed')}>
          {formatClock(elapsed)}
        </div>
        <button className="btn btn-primary btn-sm" onClick={finish}>
          {t('session.finish')}
        </button>
      </header>
      <div className="session-scroll">
        <div className="session-head">
          {renaming ? (
            <input
              className="session-name-input"
              autoFocus
              defaultValue={w.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v) updateSession((s) => ({ ...s, name: v }));
                setRenaming(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              aria-label={t('session.nameAria')}
            />
          ) : (
            <button className="session-name" onClick={() => setRenaming(true)}>
              {w.name} <Icon name="edit" size={16} className="faint" />
            </button>
          )}
          <div className="session-stats">
            <div>
              <span className="num">{done}/{total}</span>
              <label>{t('stat.sets')}</label>
            </div>
            <div>
              <span className="num">{w.exercises.length}</span>
              <label>{t('stat.exercises')}</label>
            </div>
          </div>
        </div>

        {w.exercises.length === 0 && (
          <div className="session-empty">
            <Icon name="dumbbell" size={30} />
            <p>{t('session.empty')}</p>
          </div>
        )}

        <WorkoutEditor workout={w} mode="live" onChange={updateSession} bests={bests} />

        <label className="field">
          <span>{t('common.notes')}</span>
          <textarea
            className="input"
            placeholder={t('session.notesPlaceholder')}
            value={w.note ?? ''}
            onChange={(e) => updateSession((s) => ({ ...s, note: e.target.value }))}
          />
        </label>
        <button className="btn btn-danger btn-block session-cancel" onClick={cancel}>
          {t('session.discardWorkout')}
        </button>
      </div>
      <RestPanel />
    </div>
  );
}

function RestPanel() {
  const rest = useData((s) => s.rest);
  const adjust = useData((s) => s.adjustRest);
  const stop = useData((s) => s.stopRest);
  const now = useNow(250, !!rest);
  if (!rest) return null;
  const left = Math.max(0, (rest.endsAt - now) / 1000);
  const pct = Math.min(1, 1 - left / rest.duration);
  return (
    <div className="rest-panel" role="timer" aria-label={t('rest.aria', { time: formatClock(Math.ceil(left)) })}>
      <div className="rest-progress" style={{ transform: `scaleX(${pct})` }} />
      <div className="rest-inner">
        <button className="rest-btn" onClick={() => adjust(-15)} aria-label={t('rest.minus')} dir="ltr">
          −15
        </button>
        <div className="rest-time">
          <span className="eyebrow">{t('rest.label')}</span>
          <span className="num">{formatClock(Math.ceil(left))}</span>
        </div>
        <button className="rest-btn" onClick={() => adjust(15)} aria-label={t('rest.plus')} dir="ltr">
          +15
        </button>
        <button className="rest-btn rest-skip" onClick={stop}>
          {t('rest.skip')}
        </button>
      </div>
    </div>
  );
}

/** Collapsed session bar shown above the tab bar while the workout is minimised. */
export function SessionMiniBar() {
  const session = useData((s) => s.session);
  const rest = useData((s) => s.rest);
  const open = useUI((s) => s.sessionOpen);
  const setUI = useUI((s) => s.set);
  const now = useNow(1000, !!session && !open);
  if (!session || open) return null;
  const elapsed = (now - new Date(session.startedAt).getTime()) / 1000;
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  return (
    <button className="mini-bar" onClick={() => setUI({ sessionOpen: true })} aria-label={t('mini.open')}>
      <span className="mini-pulse" />
      <span className="mini-main">
        <strong>{session.name}</strong>
        <span className="num">{restLeft > 0 ? t('rest.mini', { time: formatClock(restLeft) }) : formatClock(elapsed)}</span>
      </span>
      <Icon name="chevronUp" size={20} stroke={2.4} />
    </button>
  );
}

/** Fires the chime when the rest timer elapses, wherever the user is in the app. */
export function RestWatcher() {
  const rest = useData((s) => s.rest);
  const sound = useData((s) => s.settings.restSound);
  useEffect(() => {
    if (!rest) return;
    const fire = () => {
      const r = useData.getState().rest;
      if (!r || r.endsAt > Date.now()) return;
      useData.getState().stopRest();
      // Only alert if it ended recently (not e.g. after reopening the app hours later).
      if (Date.now() - r.endsAt < 30_000) {
        if (sound) restDoneChime();
        toast(t('rest.done'), 'success');
      }
    };
    const delay = Math.max(0, rest.endsAt - Date.now());
    const timer = setTimeout(fire, delay);
    const onVis = () => document.visibilityState === 'visible' && fire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [rest, sound]);
  return null;
}

/** Post-workout summary with stats and the PRs set in this session. */
export function SummarySheet() {
  const summary = useUI((s) => s.summary);
  const setUI = useUI((s) => s.set);
  const workouts = useData((s) => s.workouts);
  const lookup = useExerciseLookup();
  const prs = useMemo(() => {
    if (!summary) return [];
    const { events } = computePRs(workouts, (id) => lookup(id).kind);
    const mine = events.filter((e) => e.workoutId === summary.id);
    // One line per exercise: prefer e1RM, then weight, reps, duration.
    const order = ['e1rm', 'weight', 'reps', 'duration'];
    const byEx = new Map<string, (typeof mine)[number]>();
    for (const e of mine.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))) if (!byEx.has(e.exerciseId)) byEx.set(e.exerciseId, e);
    return [...byEx.values()];
  }, [summary, workouts, lookup]);

  const close = () => setUI({ summary: null });
  const w = summary;
  const dur = w?.endedAt ? (new Date(w.endedAt).getTime() - new Date(w.startedAt).getTime()) / 1000 : 0;

  return (
    <Sheet open={!!w} onClose={close}>
      {w && (
        <div className="summary">
          <div className="summary-burst">
            <Icon name="check" size={34} stroke={3} />
          </div>
          <h2>{t('summary.title')}</h2>
          <p className="muted">{w.name}</p>
          <div className="summary-stats">
            <div>
              <span className="num">{formatDuration(dur)}</span>
              <label>{t('stat.duration')}</label>
            </div>
            <div>
              <span className="num">{w.exercises.length}</span>
              <label>{t('stat.exercises')}</label>
            </div>
            <div>
              <span className="num">{workoutSetCount(w)}</span>
              <label>{t('stat.sets')}</label>
            </div>
          </div>
          {prs.length > 0 && (
            <div className="summary-prs">
              <div className="eyebrow">
                <Icon name="trophy" size={14} /> {t('n.prs', { n: prs.length })}
              </div>
              {prs.map((p) => (
                <div key={p.exerciseId + p.kind} className="summary-pr">
                  <span>{lookup(p.exerciseId).name}</span>
                  <span className="badge badge-gold">{prLabel(p.kind)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 22 }}>
            <button
              className="btn"
              onClick={() => {
                close();
                navigate(`/workouts/history/${w.id}`);
              }}
            >
              {t('summary.viewDetails')}
            </button>
            <button className="btn btn-primary" onClick={close}>
              {t('common.done')}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function prLabel(kind: PRKind | string): string {
  switch (kind) {
    case 'e1rm': return t('pr.e1rm');
    case 'weight': return t('pr.weight');
    case 'reps': return t('pr.reps');
    case 'duration': return t('pr.duration');
    default: return t('pr.short');
  }
}
