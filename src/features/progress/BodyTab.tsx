import { useMemo, useState } from 'react';
import { addDays, formatLongDate, formatShortDate, parseLocalDate, startOfDay, toLocalDate } from '@/domain/dates';
import { uid } from '@/domain/id';
import { fmtNumber, fromDisplayLength, fromDisplayWeight, lengthUnit, parseDecimal, toDisplayLength, toDisplayWeight, weightUnit } from '@/domain/units';
import { MEASUREMENT_KEYS, type MeasurementEntry, type MeasurementKey } from '@/domain/types';
import { signed, t } from '@/i18n';
import { useData } from '@/store/useData';
import { LineChart } from '@/ui/charts';
import { Chips, EmptyState, Segmented, SwipeRow } from '@/ui/controls';
import { toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';

export const measurementLabel = (k: MeasurementKey) => t(`m.${k}`);

type Range = '1m' | '3m' | '6m' | '1y' | 'all';
const RANGE_DAYS: Record<Range, number> = { '1m': 30, '3m': 91, '6m': 182, '1y': 365, all: Infinity };

function inWindow(date: string, range: Range) {
  if (range === 'all') return true;
  return parseLocalDate(date) >= addDays(startOfDay(new Date()), -RANGE_DAYS[range]);
}

export function BodyTab() {
  const { bodyWeights, measurements, settings, deleteBodyWeight, deleteMeasurement } = useData();
  const units = settings.units;
  const [range, setRange] = useState<Range>('3m');
  const [logWeight, setLogWeight] = useState(false);
  const [measureSheet, setMeasureSheet] = useState<MeasurementEntry | 'new' | null>(null);
  const [metric, setMetric] = useState<MeasurementKey>('waist');
  const [showAll, setShowAll] = useState(false);

  const series = useMemo(
    () =>
      [...bodyWeights]
        .filter((b) => inWindow(b.date, range))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((b) => ({ x: parseLocalDate(b.date).getTime(), y: toDisplayWeight(b.weight, units) })),
    [bodyWeights, range, units],
  );
  const latest = bodyWeights[0];
  const first = series[0];
  const change = latest && first ? toDisplayWeight(latest.weight, units) - first.y : 0;

  const metricKeys = MEASUREMENT_KEYS.filter((k) => measurements.some((m) => m.values[k] != null));
  const activeMetric = metricKeys.includes(metric) ? metric : metricKeys[0];
  const disp = (k: MeasurementKey, n: number) => (k === 'bodyFat' ? n : toDisplayLength(n, units));
  const unitFor = (k: MeasurementKey) => (k === 'bodyFat' ? '%' : lengthUnit(units));
  const mSeries = useMemo(
    () =>
      activeMetric
        ? [...measurements]
            .filter((m) => m.values[activeMetric] != null)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((m) => ({ x: parseLocalDate(m.date).getTime(), y: disp(activeMetric, m.values[activeMetric]!) }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [measurements, activeMetric, units],
  );
  const latestM = measurements[0];
  const goal = settings.goalWeight ? toDisplayWeight(settings.goalWeight, units) : null;

  return (
    <>
      {/* ── Body weight ── */}
      <div className="card chart-card">
        <div className="chart-card-head">
          <div>
            <div className="eyebrow">{t('body.weight')}</div>
            {latest ? (
              <div className="bw-headline">
                <span className="num">{fmtNumber(toDisplayWeight(latest.weight, units), 1)}</span>
                <small>{weightUnit(units)}</small>
                {series.length > 1 && (
                  <span className={`delta ${change <= 0 ? 'up' : 'flat'}`}>
                    {signed(change, (v) => fmtNumber(v, 1))} {weightUnit(units)}
                  </span>
                )}
              </div>
            ) : (
              <h3>{t('body.none')}</h3>
            )}
            {latest && <span className="faint bw-date">{t('body.lastLogged', { date: formatLongDate(latest.date) })}</span>}
          </div>
          <button className="icon-btn is-accent" onClick={() => setLogWeight(true)} aria-label={t('body.logAria')}>
            <Icon name="plus" size={20} stroke={2.6} />
          </button>
        </div>
        <LineChart
          data={series}
          height={200}
          ariaLabel={t('body.chartAria')}
          formatY={(v) => fmtNumber(v, 1)}
          formatX={(x) => formatShortDate(new Date(x))}
          goal={goal !== null ? { y: goal, label: t('body.goal', { n: fmtNumber(goal, 1) }) } : undefined}
          emptyText={bodyWeights.length ? t('body.noRange') : t('body.logToSee')}
        />
        <Segmented
          className="range-seg"
          value={range}
          onChange={setRange}
          options={[
            { value: '1m', label: t('range.1m') },
            { value: '3m', label: t('range.3m') },
            { value: '6m', label: t('range.6m') },
            { value: '1y', label: t('range.1y') },
            { value: 'all', label: t('range.all') },
          ]}
        />
      </div>

      {bodyWeights.length > 0 && (
        <>
          <h2 className="wk-section">{t('body.log')}</h2>
          <div className="group-body">
            {(showAll ? bodyWeights : bodyWeights.slice(0, 5)).map((b, i) => {
              const prev = bodyWeights[i + 1];
              const d = prev ? toDisplayWeight(b.weight - prev.weight, units) : 0;
              return (
                <SwipeRow key={b.id} onDelete={() => deleteBodyWeight(b.id)}>
                  <div className="row">
                    <span className="row-main">
                      <span className="row-label">{formatLongDate(b.date)}</span>
                    </span>
                    {prev && Math.abs(d) >= 0.05 && (
                      <span className={`delta ${d < 0 ? 'up' : 'flat'}`}>{signed(d, (v) => fmtNumber(v, 1))}</span>
                    )}
                    <span className="row-value num">
                      {fmtNumber(toDisplayWeight(b.weight, units), 1)} {weightUnit(units)}
                    </span>
                  </div>
                </SwipeRow>
              );
            })}
          </div>
          {bodyWeights.length > 5 && (
            <button className="link show-more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t('body.showLess') : t('body.showAll', { n: bodyWeights.length })}
            </button>
          )}
          <p className="faint swipe-hint">{t('body.swipeHint')}</p>
        </>
      )}

      {/* ── Measurements ── */}
      <div className="section-title">
        <h2>{t('body.measurements')}</h2>
        <button className="link" onClick={() => setMeasureSheet('new')}>
          {t('common.add')}
        </button>
      </div>
      {measurements.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="ruler"
            title={t('body.trackTitle')}
            text={t('body.trackText')}
            action={
              <button className="btn btn-primary" onClick={() => setMeasureSheet('new')}>
                {t('body.addMeasurements')}
              </button>
            }
          />
        </div>
      ) : (
        <>
          <Chips value={activeMetric} onChange={setMetric} options={metricKeys.map((k) => ({ value: k, label: measurementLabel(k) }))} />
          <div className="card chart-card" style={{ marginTop: 12 }}>
            <LineChart
              data={mSeries}
              height={170}
              color="var(--blue)"
              ariaLabel={t('body.overTime', { name: measurementLabel(activeMetric) })}
              formatY={(v) => `${fmtNumber(v, 1)}${activeMetric === 'bodyFat' ? '%' : ''}`}
              formatX={(x) => formatShortDate(new Date(x))}
            />
          </div>
          {latestM && (
            <div className="measure-grid">
              {MEASUREMENT_KEYS.filter((k) => latestM.values[k] != null).map((k) => {
                const v = latestM.values[k]!;
                const prevEntry = measurements.find((m) => m.id !== latestM.id && m.values[k] != null);
                const pv = prevEntry?.values[k];
                const diff = pv != null ? disp(k, v) - disp(k, pv) : 0;
                return (
                  <button key={k} className={`measure ${k === activeMetric ? 'is-active' : ''}`} onClick={() => setMetric(k)}>
                    <span>{measurementLabel(k)}</span>
                    <strong className="num">
                      {fmtNumber(disp(k, v), 1)}
                      <small>{unitFor(k)}</small>
                    </strong>
                    {pv != null && Math.abs(diff) >= 0.05 && (
                      <em className="num">{signed(diff, (v) => fmtNumber(v, 1))}</em>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <h2 className="wk-section">{t('body.history')}</h2>
          <div className="group-body">
            {measurements.map((m) => (
              <SwipeRow key={m.id} onDelete={() => deleteMeasurement(m.id)}>
                <button className="row is-tappable" onClick={() => setMeasureSheet(m)}>
                  <span className="row-main">
                    <span className="row-label">{formatLongDate(m.date)}</span>
                    <span className="row-detail">
                      {t('n.measurements', { n: Object.keys(m.values).length })}
                      {m.values[activeMetric] != null &&
                        ` · ${measurementLabel(activeMetric)} ${fmtNumber(disp(activeMetric, m.values[activeMetric]!), 1)} ${unitFor(activeMetric)}`}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={16} stroke={2.4} className="row-chevron" />
                </button>
              </SwipeRow>
            ))}
          </div>
        </>
      )}

      <WeightSheet open={logWeight} onClose={() => setLogWeight(false)} />
      <MeasurementSheet entry={measureSheet} onClose={() => setMeasureSheet(null)} />
    </>
  );
}

export function WeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { bodyWeights, settings, logBodyWeight } = useData();
  const units = settings.units;
  const [date, setDate] = useState(toLocalDate());
  const [text, setText] = useState('');
  const last = bodyWeights[0];

  const save = () => {
    const v = parseDecimal(text);
    if (v === null || v < 20 || v > 700) return toast(t('body.invalidWeight'), 'error');
    if (date > toLocalDate()) return toast(t('body.futureDate'), 'error');
    logBodyWeight(date, fromDisplayWeight(v, units));
    toast(t('body.logged'), 'success');
    setText('');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('body.logTitle')}
      left={
        <button className="nav-btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
      }
      right={
        <button className="nav-btn is-strong" onClick={save}>
          {t('common.save')}
        </button>
      }
    >
      <div className="big-input">
        <input
          inputMode="decimal"
          autoFocus
          placeholder={last ? fmtNumber(toDisplayWeight(last.weight, units), 1) : '0.0'}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          aria-label={t('body.weightAria', { unit: weightUnit(units) })}
          className="num"
          dir="ltr"
        />
        <span>{weightUnit(units)}</span>
      </div>
      <label className="field">
        <span>{t('common.date')}</span>
        <input className="input" type="date" value={date} max={toLocalDate()} onChange={(e) => setDate(e.target.value)} />
      </label>
      {bodyWeights.some((b) => b.date === date) && (
        <p className="faint" style={{ marginTop: 8, fontSize: 14 }}>
          {t('body.replaces')}
        </p>
      )}
    </Sheet>
  );
}

function MeasurementSheet({ entry, onClose }: { entry: MeasurementEntry | 'new' | null; onClose: () => void }) {
  const { measurements, settings, saveMeasurement, deleteMeasurement } = useData();
  const units = settings.units;
  const editing = entry && entry !== 'new' ? entry : null;
  const [date, setDate] = useState(toLocalDate());
  const [vals, setVals] = useState<Partial<Record<MeasurementKey, string>>>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const key = entry === null ? null : editing ? editing.id : 'new';
  if (key !== loadedFor) {
    setLoadedFor(key);
    if (editing) {
      setDate(editing.date);
      const v: Partial<Record<MeasurementKey, string>> = {};
      for (const k of MEASUREMENT_KEYS) {
        const n = editing.values[k];
        if (n != null) v[k] = fmtNumber(k === 'bodyFat' ? n : toDisplayLength(n, units), 1).replace(/,/g, '');
      }
      setVals(v);
    } else {
      setDate(toLocalDate());
      setVals({});
    }
  }

  const prev = measurements.find((m) => m.id !== editing?.id);

  const save = () => {
    const values: MeasurementEntry['values'] = {};
    for (const k of MEASUREMENT_KEYS) {
      const raw = vals[k];
      if (!raw) continue;
      const n = parseDecimal(raw);
      if (n === null || n <= 0 || (k === 'bodyFat' ? n > 70 : n > 400)) return toast(t('body.checkValue', { name: measurementLabel(k) }), 'error');
      values[k] = k === 'bodyFat' ? n : fromDisplayLength(n, units);
    }
    if (!Object.keys(values).length) return toast(t('body.enterOne'), 'error');
    saveMeasurement({ id: editing?.id ?? uid(), date, values });
    toast(t('body.saved'), 'success');
    onClose();
  };

  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      full
      title={editing ? t('body.editTitle') : t('body.newTitle')}
      left={
        <button className="nav-btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
      }
      right={
        <button className="nav-btn is-strong" onClick={save}>
          {t('common.save')}
        </button>
      }
    >
      <label className="field">
        <span>{t('common.date')}</span>
        <input className="input" type="date" value={date} max={toLocalDate()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="group-body" style={{ marginTop: 16 }}>
        {MEASUREMENT_KEYS.map((k) => {
          const pv = prev?.values[k];
          const ph = pv != null ? fmtNumber(k === 'bodyFat' ? pv : toDisplayLength(pv, units), 1) : '—';
          return (
            <label key={k} className="row">
              <span className="row-main">
                <span className="row-label">{measurementLabel(k)}</span>
              </span>
              <input
                className="row-input num"
                inputMode="decimal"
                placeholder={ph}
                value={vals[k] ?? ''}
                onChange={(e) => setVals({ ...vals, [k]: e.target.value.replace(/[^\d.,]/g, '') })}
                aria-label={measurementLabel(k)}
                dir="ltr"
              />
              <span className="faint unit-suffix">{k === 'bodyFat' ? '%' : lengthUnit(units)}</span>
            </label>
          );
        })}
      </div>
      <p className="faint" style={{ fontSize: 13, marginTop: 10 }}>
        {t('body.placeholderHint')}
      </p>
      {editing && (
        <button
          className="btn btn-danger btn-block"
          style={{ marginTop: 20 }}
          onClick={() => {
            deleteMeasurement(editing.id);
            onClose();
          }}
        >
          {t('body.deleteEntry')}
        </button>
      )}
    </Sheet>
  );
}
