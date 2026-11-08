import { useMemo, useRef, useState } from 'react';
import { generateSample } from '@/data/sample';
import { formatClock, formatMonth } from '@/domain/dates';
import { finished, workoutDurationSec, workoutSetCount } from '@/domain/metrics';
import { fmtNumber, fromDisplayWeight, parseDecimal, toDisplayWeight, weightUnit } from '@/domain/units';
import { downloadJSON, makeBackup, parseBackup } from '@/lib/backup';
import { clearPhotos } from '@/lib/photoDb';
import { navigate } from '@/lib/router';
import { useData } from '@/store/useData';
import { useUI } from '@/store/useUI';
import { Group, Row, Segmented, Stepper, Toggle } from '@/ui/controls';
import { confirm, toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import './profile.css';

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export function ProfileScreen() {
  const state = useData();
  const { settings, updateSettings, workouts, splits } = state;
  const units = settings.units;
  const fileRef = useRef<HTMLInputElement>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [goalText, setGoalText] = useState<string | null>(null);

  const lifetime = useMemo(() => {
    const f = finished(workouts);
    return {
      count: f.length,
      sets: f.reduce((s, w) => s + workoutSetCount(w), 0),
      hours: f.reduce((s, w) => s + workoutDurationSec(w), 0) / 3600,
    };
  }, [workouts]);
  const activeSplit = splits.find((s) => s.id === settings.activeSplitId);

  const exportData = () => {
    downloadJSON(`forge-backup-${new Date().toISOString().slice(0, 10)}.json`, makeBackup(useData.getState()));
    toast('Backup exported', 'success');
  };

  const importData = async (file: File) => {
    try {
      const data = parseBackup(await file.text());
      const ok = await confirm({
        title: 'Replace all data?',
        message: `Import ${data.workouts.length} workouts and ${data.routines.length} routines. Your current data on this device will be replaced.`,
        confirmLabel: 'Import',
        destructive: true,
      });
      if (!ok) return;
      await clearPhotos().catch(() => undefined);
      useData.getState().replaceAll(data);
      toast('Backup imported', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error');
    }
  };

  const loadSample = async () => {
    const ok = await confirm({
      title: 'Load sample data?',
      message: '10 weeks of Push/Pull/Legs history, body weight and measurements. This replaces your current data.',
      confirmLabel: 'Load Sample',
      destructive: workouts.length > 0,
    });
    if (!ok) return;
    await clearPhotos().catch(() => undefined);
    useData.getState().replaceAll(generateSample(settings));
    toast('Sample data loaded', 'success');
    navigate('/');
  };

  const eraseAll = async () => {
    const ok = await confirm({
      title: 'Erase all data?',
      message: 'Workouts, routines, body tracking and photos will be permanently deleted from this device.',
      confirmLabel: 'Erase Everything',
      destructive: true,
    });
    if (!ok) return;
    await clearPhotos().catch(() => undefined);
    useData.getState().resetAll();
    useUI.getState().set({ summary: null });
    toast('All data erased');
  };

  const goalDisplay = settings.goalWeight ? fmtNumber(toDisplayWeight(settings.goalWeight, units), 1) : '';

  return (
    <Screen title="Profile" large>
      <div className="profile-card">
        <div className="profile-avatar">{settings.name.trim() ? settings.name.trim()[0].toUpperCase() : <Icon name="user" size={28} />}</div>
        <input
          className="profile-name"
          value={settings.name}
          placeholder="Your name"
          onChange={(e) => updateSettings({ name: e.target.value.slice(0, 40) })}
          aria-label="Your name"
          autoCapitalize="words"
        />
        <p className="faint">Training since {formatMonth(new Date(settings.createdAt))}</p>
        <div className="profile-stats">
          <div>
            <span className="num">{lifetime.count}</span>
            <label>Workouts</label>
          </div>
          <div>
            <span className="num">{fmtNumber(lifetime.sets, 0)}</span>
            <label>Sets</label>
          </div>
          <div>
            <span className="num">{fmtNumber(lifetime.hours, 0)}h</span>
            <label>Trained</label>
          </div>
        </div>
      </div>

      <Group title="Preferences">
        <Row icon="image" iconColor="#5e5ce6" label="Theme">
          <Segmented
            className="theme-seg"
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v })}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
        <Row icon="scale" iconColor="#0a84ff" label="Units">
          <Segmented
            className="units-seg"
            value={units}
            onChange={(v) => updateSettings({ units: v })}
            options={[
              { value: 'metric', label: 'kg · cm' },
              { value: 'imperial', label: 'lb · in' },
            ]}
          />
        </Row>
        <Row icon="target" iconColor="#30b0c7" label="Goal weight">
          <input
            className="row-input num"
            inputMode="decimal"
            placeholder="Not set"
            value={goalText ?? goalDisplay}
            onFocus={() => setGoalText(goalDisplay)}
            onChange={(e) => setGoalText(e.target.value.replace(/[^\d.,]/g, ''))}
            onBlur={() => {
              const v = goalText === null ? null : parseDecimal(goalText);
              if (goalText !== null && goalText.trim() === '') updateSettings({ goalWeight: null });
              else if (v !== null && v >= 20 && v <= 700) updateSettings({ goalWeight: fromDisplayWeight(v, units) });
              else if (goalText !== null) toast('Enter a realistic goal weight', 'error');
              setGoalText(null);
            }}
            aria-label={`Goal weight in ${weightUnit(units)}`}
          />
          <span className="faint unit-suffix">{weightUnit(units)}</span>
        </Row>
        <Row icon="calendar" iconColor="#ff9f0a" label="Weekly goal" detail="Workouts / week">
          <Stepper label="weekly goal" value={settings.weeklyGoal} min={1} max={7} onChange={(v) => updateSettings({ weeklyGoal: v })} />
        </Row>
      </Group>

      <Group title="Workouts">
        <Row icon="timer" iconColor="#34c759" label="Default rest" detail="Between sets">
          <Stepper label="default rest" value={settings.defaultRestSec} step={15} min={15} max={600} onChange={(v) => updateSettings({ defaultRestSec: v })} format={formatClock} />
        </Row>
        <Row icon="bolt" iconColor="#ff375f" label="Rest timer sound">
          <Toggle label="Rest timer sound" checked={settings.restSound} onChange={(v) => updateSettings({ restSound: v })} />
        </Row>
        <Row
          icon="layers"
          iconColor="#bf5af2"
          label="Active split"
          value={activeSplit?.name ?? 'None'}
          chevron
          onClick={() => {
            useUI.getState().set({ workoutsTab: 'splits' });
            navigate('/workouts');
          }}
        />
      </Group>

      <Group title="Data" footer="Data is stored on this device. Export a backup regularly — progress photos are not included in backups.">
        <Row icon="download" iconColor="#0a84ff" label="Export backup" onClick={exportData} chevron />
        <Row icon="upload" iconColor="#5e5ce6" label="Import backup" onClick={() => fileRef.current?.click()} chevron />
        <Row icon="bolt" iconColor="#8e8e93" label="Load sample data" detail="Explore Forge with 10 weeks of history" onClick={loadSample} chevron />
        <Row icon="trash" iconColor="#ff453a" label="Erase all data" destructive onClick={eraseAll} />
      </Group>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) importData(f);
        }}
      />

      <Group title="App">
        {!isStandalone() && <Row icon="download" iconColor="#c8ff3d" label="Add to Home Screen" detail="Full-screen, offline, like a native app" onClick={() => setInstallHelp(true)} chevron />}
        <Row icon="info" iconColor="#636366" label="Version" value="1.0.0" />
      </Group>

      <Sheet open={installHelp} onClose={() => setInstallHelp(false)} title="Install Forge" right={<button className="nav-btn is-strong" onClick={() => setInstallHelp(false)}>Done</button>}>
        <ol className="install-steps">
          <li>
            <span className="num">1</span> Open Forge in <strong>Safari</strong>.
          </li>
          <li>
            <span className="num">2</span> Tap the <strong>Share</strong> button <Icon name="upload" size={16} /> in the toolbar.
          </li>
          <li>
            <span className="num">3</span> Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
          </li>
        </ol>
        <p className="muted" style={{ fontSize: 14, marginTop: 14 }}>
          Forge then opens full screen, works offline, and your data is protected from Safari's automatic storage clean-up.
        </p>
      </Sheet>
    </Screen>
  );
}
