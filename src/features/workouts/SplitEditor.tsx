import { useState } from 'react';
import { weekdayName } from '@/domain/dates';
import { uid } from '@/domain/id';
import type { Split } from '@/domain/types';
import { t } from '@/i18n';
import { goBack, navigate } from '@/lib/router';
import { useData } from '@/store/useData';
import { Group, Row, Toggle } from '@/ui/controls';
import { confirm, toast } from '@/ui/dialogs';
import { Screen } from '@/ui/Screen';
import './workouts.css';

export function SplitEditorScreen({ id }: { id: string }) {
  const existing = useData((s) => s.splits.find((x) => x.id === id));
  const routines = useData((s) => s.routines);
  const activeId = useData((s) => s.settings.activeSplitId);
  const { saveSplit, deleteSplit, updateSettings } = useData();
  const isNew = !existing;
  const [draft, setDraft] = useState<Split>(() => existing ?? { id: uid(), name: '', days: Array(7).fill(null) });
  const [makeActive, setMakeActive] = useState(isNew ? !activeId : activeId === draft.id);

  const onSave = () => {
    if (!draft.name.trim()) return toast(t('sp.nameRequired'), 'error');
    saveSplit({ ...draft, name: draft.name.trim() });
    if (makeActive) updateSettings({ activeSplitId: draft.id });
    else if (activeId === draft.id) updateSettings({ activeSplitId: null });
    toast(t('sp.saved'), 'success');
    goBack('/workouts');
  };

  return (
    <Screen
      title={isNew ? t('sp.new') : t('sp.edit')}
      left={
        <button className="nav-btn" onClick={() => goBack('/workouts')}>
          {t('common.cancel')}
        </button>
      }
      right={
        <button className="nav-btn is-strong" onClick={onSave} disabled={!draft.name.trim()}>
          {t('common.save')}
        </button>
      }
    >
      <input
        className="routine-name-input"
        placeholder={t('sp.namePlaceholder')}
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        aria-label={t('sp.namePlaceholder')}
      />

      {routines.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">{t('sp.needRoutines')}</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/workouts/routine/new')}>
            {t('sp.newRoutine')}
          </button>
        </div>
      ) : (
        <Group title={t('sp.schedule')} footer={t('sp.scheduleFooter')}>
          {draft.days.map((d, i) => (
            <div key={i} className="row">
              <span className="row-main">
                <span className="row-label">{weekdayName(i)}</span>
              </span>
              <select
                className={`day-select ${d ? 'is-train' : ''}`}
                value={d ?? ''}
                aria-label={t('sp.dayAria', { day: weekdayName(i) })}
                onChange={(e) => setDraft({ ...draft, days: draft.days.map((x, j) => (j === i ? e.target.value || null : x)) })}
              >
                <option value="">{t('wk.rest')}</option>
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
        <Row label={t('sp.active')}>
          <Toggle label={t('sp.active')} checked={makeActive} onChange={setMakeActive} />
        </Row>
      </Group>

      {!isNew && (
        <button
          className="btn btn-danger btn-block"
          style={{ marginTop: 24 }}
          onClick={async () => {
            if (await confirm({ title: t('wk.deleteTitle', { name: draft.name }), message: t('sp.routinesKept'), confirmLabel: t('common.delete'), destructive: true })) {
              deleteSplit(draft.id);
              goBack('/workouts');
            }
          }}
        >
          {t('sp.delete')}
        </button>
      )}
    </Screen>
  );
}
