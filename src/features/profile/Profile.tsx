import { useMemo, useRef, useState } from 'react';
import { generateSample } from '@/data/sample';
import { formatClock, formatMonth } from '@/domain/dates';
import { finished, workoutDurationSec, workoutSetCount } from '@/domain/metrics';
import { fmtNumber, fromDisplayWeight, parseDecimal, toDisplayWeight, weightUnit } from '@/domain/units';
import { LANGUAGES, t } from '@/i18n';
import { Rich } from '@/i18n/Rich';
import { downloadJSON, makeBackup, parseBackup } from '@/lib/backup';
import { clearPhotos } from '@/lib/photoDb';
import { navigate } from '@/lib/router';
import { AUTH_ENABLED, useAuth } from '@/store/useAuth';
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
  const user = useAuth((s) => s.user);

  async function confirmSignOut() {
    const ok = await confirm({ title: t('pf.signOutConfirm'), message: t('pf.signOutMsg'), confirmLabel: t('pf.signOut'), destructive: true });
    if (ok) useAuth.getState().signOut();
  }

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
    toast(t('pf.exported'), 'success');
  };

  const importData = async (file: File) => {
    try {
      const data = parseBackup(await file.text());
      const ok = await confirm({
        title: t('pf.replaceTitle'),
        message: t('pf.importMsg', {
          workouts: t('n.workouts', { n: data.workouts.length }),
          routines: t('pf.routinesCount', { n: data.routines.length }),
        }),
        confirmLabel: t('pf.import'),
        destructive: true,
      });
      if (!ok) return;
      await clearPhotos().catch(() => undefined);
      // Keep this device's language and theme; everything else comes from the backup.
      useData.getState().replaceAll({ ...data, settings: { ...data.settings, language: settings.language, theme: settings.theme } });
      toast(t('pf.imported'), 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : t('pf.importFailed'), 'error');
    }
  };

  const loadSample = async () => {
    const ok = await confirm({
      title: t('pf.sampleTitle'),
      message: t('pf.sampleMsg'),
      confirmLabel: t('pf.loadSample'),
      destructive: workouts.length > 0,
    });
    if (!ok) return;
    await clearPhotos().catch(() => undefined);
    useData.getState().replaceAll(generateSample(settings));
    toast(t('pf.sampleLoaded'), 'success');
    navigate('/');
  };

  const eraseAll = async () => {
    const ok = await confirm({
      title: t('pf.eraseTitle'),
      message: t('pf.eraseMsg'),
      confirmLabel: t('pf.eraseConfirm'),
      destructive: true,
    });
    if (!ok) return;
    await clearPhotos().catch(() => undefined);
    const { language, theme } = settings;
    useData.getState().resetAll();
    useData.getState().updateSettings({ language, theme });
    useUI.getState().set({ summary: null });
    toast(t('pf.erased'));
  };

  const goalDisplay = settings.goalWeight ? fmtNumber(toDisplayWeight(settings.goalWeight, units), 1) : '';

  return (
    <Screen title={t('pf.title')} large>
      <div className="profile-card">
        <div className="profile-avatar">{settings.name.trim() ? settings.name.trim()[0].toUpperCase() : <Icon name="user" size={28} />}</div>
        <input
          className="profile-name"
          value={settings.name}
          placeholder={t('pf.namePlaceholder')}
          onChange={(e) => updateSettings({ name: e.target.value.slice(0, 40) })}
          aria-label={t('pf.namePlaceholder')}
          autoCapitalize="words"
        />
        <p className="faint">{t('pf.since', { date: formatMonth(new Date(settings.createdAt)) })}</p>
        <div className="profile-stats">
          <div>
            <span className="num">{lifetime.count}</span>
            <label>{t('stat.workouts')}</label>
          </div>
          <div>
            <span className="num">{fmtNumber(lifetime.sets, 0)}</span>
            <label>{t('stat.sets')}</label>
          </div>
          <div>
            <span className="num">{t('pf.hours', { n: fmtNumber(lifetime.hours, 0) })}</span>
            <label>{t('stat.trained')}</label>
          </div>
        </div>
      </div>

      <Group title={t('pf.preferences')}>
        <Row icon="globe" iconColor="#34aadc" label={t('pf.language')}>
          <Segmented className="lang-seg" value={settings.language} onChange={(v) => updateSettings({ language: v })} options={LANGUAGES} />
        </Row>
        <Row icon="image" iconColor="#5e5ce6" label={t('pf.theme')}>
          <Segmented
            className="theme-seg"
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v })}
            options={[
              { value: 'system', label: t('pf.themeAuto') },
              { value: 'light', label: t('pf.themeLight') },
              { value: 'dark', label: t('pf.themeDark') },
            ]}
          />
        </Row>
        <Row icon="scale" iconColor="#0a84ff" label={t('pf.units')}>
          <Segmented
            className="units-seg"
            value={units}
            onChange={(v) => updateSettings({ units: v })}
            options={[
              { value: 'metric', label: t('pf.metric') },
              { value: 'imperial', label: t('pf.imperial') },
            ]}
          />
        </Row>
        <Row icon="target" iconColor="#30b0c7" label={t('pf.goalWeight')}>
          <input
            className="row-input num"
            inputMode="decimal"
            placeholder={t('pf.notSet')}
            value={goalText ?? goalDisplay}
            onFocus={() => setGoalText(goalDisplay)}
            onChange={(e) => setGoalText(e.target.value.replace(/[^\d.,]/g, ''))}
            onBlur={() => {
              const v = goalText === null ? null : parseDecimal(goalText);
              if (goalText !== null && goalText.trim() === '') updateSettings({ goalWeight: null });
              else if (v !== null && v >= 20 && v <= 700) updateSettings({ goalWeight: fromDisplayWeight(v, units) });
              else if (goalText !== null) toast(t('pf.goalInvalid'), 'error');
              setGoalText(null);
            }}
            aria-label={t('pf.goalAria', { unit: weightUnit(units) })}
          />
          <span className="faint unit-suffix">{weightUnit(units)}</span>
        </Row>
        <Row icon="calendar" iconColor="#ff9f0a" label={t('pf.weeklyGoal')} detail={t('pf.weeklyGoalSub')}>
          <Stepper label={t('pf.weeklyGoalAria')} value={settings.weeklyGoal} min={1} max={7} onChange={(v) => updateSettings({ weeklyGoal: v })} />
        </Row>
      </Group>

      <Group title={t('pf.workouts')}>
        <Row icon="timer" iconColor="#34c759" label={t('pf.defaultRest')} detail={t('pf.betweenSets')}>
          <Stepper
            label={t('pf.defaultRestAria')}
            value={settings.defaultRestSec}
            step={15}
            min={15}
            max={600}
            onChange={(v) => updateSettings({ defaultRestSec: v })}
            format={formatClock}
          />
        </Row>
        <Row icon="bolt" iconColor="#ff375f" label={t('pf.restSound')}>
          <Toggle label={t('pf.restSound')} checked={settings.restSound} onChange={(v) => updateSettings({ restSound: v })} />
        </Row>
        <Row
          icon="layers"
          iconColor="#bf5af2"
          label={t('pf.activeSplit')}
          value={activeSplit?.name ?? t('common.none')}
          chevron
          onClick={() => {
            useUI.getState().set({ workoutsTab: 'splits' });
            navigate('/workouts');
          }}
        />
      </Group>

      <Group title={t('pf.data')} footer={t('pf.dataFooter')}>
        <Row icon="download" iconColor="#0a84ff" label={t('pf.export')} onClick={exportData} chevron />
        <Row icon="upload" iconColor="#5e5ce6" label={t('pf.importRow')} onClick={() => fileRef.current?.click()} chevron />
        <Row icon="bolt" iconColor="#8e8e93" label={t('pf.sampleRow')} detail={t('pf.sampleSub')} onClick={loadSample} chevron />
        <Row icon="trash" iconColor="#ff453a" label={t('pf.eraseRow')} destructive onClick={eraseAll} />
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

      <Group title={t('pf.app')}>
        {!isStandalone() && (
          <Row icon="download" iconColor="#c8ff3d" label={t('pf.addHome')} detail={t('pf.addHomeSub')} onClick={() => setInstallHelp(true)} chevron />
        )}
        <Row icon="info" iconColor="#636366" label={t('pf.version')} value="1.0.0" />
      </Group>

      {AUTH_ENABLED && user && (
        <Group title={t('pf.account')}>
          <Row icon="user" iconColor="#636366" label={user.name} detail={<span dir="ltr">{user.email}</span>} />
          <Row icon="logout" iconColor="#ff453a" label={t('pf.signOut')} destructive onClick={confirmSignOut} />
        </Group>
      )}

      <Sheet
        open={installHelp}
        onClose={() => setInstallHelp(false)}
        title={t('pf.install')}
        right={
          <button className="nav-btn is-strong" onClick={() => setInstallHelp(false)}>
            {t('common.done')}
          </button>
        }
      >
        <ol className="install-steps">
          <li>
            <span className="num">1</span>
            <span>
              <Rich text={t('pf.step1')} />
            </span>
          </li>
          <li>
            <span className="num">2</span>
            <span>
              <Rich text={t('pf.step2')} /> <Icon name="upload" size={16} />
            </span>
          </li>
          <li>
            <span className="num">3</span>
            <span>
              <Rich text={t('pf.step3')} />
            </span>
          </li>
        </ol>
        <p className="muted" style={{ fontSize: 14, marginTop: 14 }}>
          {t('pf.installNote')}
        </p>
      </Sheet>
    </Screen>
  );
}
