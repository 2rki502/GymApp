import { useState } from 'react';
import { WEEKDAYS_SHORT } from '@/domain/dates';
import { uid } from '@/domain/id';
import type { Split } from '@/domain/types';
import { goBack, navigate } from '@/lib/router';
import { useData } from '@/store/useData';
import { Group, Row, Toggle } from '@/ui/controls';
import { confirm, toast } from '@/ui/dialogs';
import { Screen } from '@/ui/Screen';
import './workouts.css';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function SplitEditorScreen({ id }: { id: string }) {
  const existing = useData((s) => s.splits.find((x) => x.id === id));
  const routines = useData((s) => s.routines);
  const activeId = useData((s) => s.settings.activeSplitId);
  const { saveSplit, deleteSplit, updateSettings } = useData();
  const isNew = !existing;
  const [draft, setDraft] = useState<Split>(() => existing ?? { id: uid(), name: '', days: Array(7).fill(null) });
  const [makeActive, setMakeActive] = useState(isNew ? !activeId : activeId === draft.id);

  const onSave = () => {
    if (!draft.name.trim()) return toast('Name your split', 'error');
    saveSplit({ ...draft, name: draft.name.trim() });
    if (makeActive) updateSettings({ activeSplitId: draft.id });
    else if (activeId === draft.id) updateSettings({ activeSplitId: null });
    toast('Split saved', 'success');
    goBack('/workouts');
  };

  return (
    <Screen
      title={isNew ? 'New Split' : 'Edit Split'}
      left={<button className="nav-btn" onClick={() => goBack('/workouts')}>Cancel</button>}
      right={<button className="nav-btn is-strong" onClick={onSave} disabled={!draft.name.trim()}>Save</button>}
    >
      <input className="routine-name-input" placeholder="Split name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Split name" />

      {routines.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">Create some routines first, then assign them to days of the week.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/workouts/routine/new')}>
            New Routine
          </button>
        </div>
      ) : (
        <Group title="Weekly schedule" footer="Today's scheduled routine appears on your Home screen.">
          {draft.days.map((d, i) => (
            <div key={i} className="row">
              <span className="row-main">
                <span className="row-label">{DAY_NAMES[i]}</span>
              </span>
              <select
                className={`day-select ${d ? 'is-train' : ''}`}
                value={d ?? ''}
                aria-label={`${WEEKDAYS_SHORT[i]} routine`}
                onChange={(e) => setDraft({ ...draft, days: draft.days.map((x, j) => (j === i ? e.target.value || null : x)) })}
              >
                <option value="">Rest</option>
                {routines.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </Group>
      )}

      <Group>
        <Row label="Active split">
          <Toggle label="Active split" checked={makeActive} onChange={setMakeActive} />
        </Row>
      </Group>

      {!isNew && (
        <button
          className="btn btn-danger btn-block"
          style={{ marginTop: 24 }}
          onClick={async () => {
            if (await confirm({ title: `Delete “${draft.name}”?`, message: 'Routines are kept.', confirmLabel: 'Delete', destructive: true })) {
              deleteSplit(draft.id);
              goBack('/workouts');
            }
          }}
        >
          Delete Split
        </button>
      )}
    </Screen>
  );
}
