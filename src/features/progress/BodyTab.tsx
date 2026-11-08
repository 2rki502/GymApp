import { useMemo, useState } from 'react';
import { addDays, formatLongDate, formatShortDate, parseLocalDate, startOfDay, toLocalDate } from '@/domain/dates';
import { uid } from '@/domain/id';
import { fmtNumber, fromDisplayLength, fromDisplayWeight, lengthUnit, parseDecimal, toDisplayLength, toDisplayWeight, weightUnit } from '@/domain/units';
import { MEASUREMENT_KEYS, type MeasurementEntry, type MeasurementKey } from '@/domain/types';
import { useData } from '@/store/useData';
import { LineChart } from '@/ui/charts';
import { Chips, EmptyState, Segmented, SwipeRow } from '@/ui/controls';
import { toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';

export const MEASUREMENT_LABEL: Record<MeasurementKey, string> = {
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  shoulders: 'Shoulders',
  neck: 'Neck',
  leftArm: 'Left arm',
  rightArm: 'Right arm',
  leftThigh: 'Left thigh',
  rightThigh: 'Right thigh',
  calves: 'Calves',
  bodyFat: 'Body fat',
};

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
  const mSeries = useMemo(
    () =>
      activeMetric
        ? [...measurements]
            .filter((m) => m.values[activeMetric] != null)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((m) => ({
              x: parseLocalDate(m.date).getTime(),
              y: activeMetric === 'bodyFat' ? m.values[activeMetric]! : toDisplayLength(m.values[activeMetric]!, units),
            }))
        : [],
    [measurements, activeMetric, units],
  );
  const mUnit = activeMetric === 'bodyFat' ? '%' : ` ${lengthUnit(units)}`;
  const latestM = measurements[0];

  return (
    <>
      {/* ── Body weight ── */}
      <div className="card chart-card">
        <div className="chart-card-head">
          <div>
            <div className="eyebrow">Body weight</div>
            {latest ? (
              <div className="bw-headline">
                <span className="num">{fmtNumber(toDisplayWeight(latest.weight, units), 1)}</span>
                <small>{weightUnit(units)}</small>
                {series.length > 1 && (
                  <span className={`delta ${change <= 0 ? 'up' : 'flat'}`}>
                    {change > 0 ? '+' : change < 0 ? '−' : ''}
                    {fmtNumber(Math.abs(change), 1)} {weightUnit(units)}
                  </span>
                )}
              </div>
            ) : (
              <h3>No entries yet</h3>
            )}
            {latest && <span className="faint bw-date">Last logged {formatLongDate(latest.date).toLowerCase()}</span>}
          </div>
          <button className="icon-btn is-accent" onClick={() => setLogWeight(true)} aria-label="Log body weight">
            <Icon name="plus" size={20} stroke={2.6} />
          </button>
        </div>
        <LineChart
          data={series}
          height={200}
          ariaLabel="Body weight over time"
          formatY={(v) => fmtNumber(v, 1)}
          formatX={(x) => formatShortDate(new Date(x))}
          goal={settings.goalWeight ? { y: toDisplayWeight(settings.goalWeight, units), label: `Goal ${fmtNumber(toDisplayWeight(settings.goalWeight, units), 1)}` } : undefined}
          emptyText={bodyWeights.length ? 'No entries in this range' : 'Log your weight to see the trend'}
        />
        <Segmented
          className="range-seg"
          value={range}
          onChange={setRange}
          options={[
            { value: '1m', label: '1M' },
            { value: '3m', label: '3M' },
            { value: '6m', label: '6M' },
            { value: '1y', label: '1Y' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {bodyWeights.length > 0 && (
        <>
          <h2 className="wk-section">Weight log</h2>
          <div className="group-body">
            {(showAll ? bodyWeights : bodyWeights.slice(0, 5)).map((b, i, arr) => {
              const prev = arr[i + 1] ?? bodyWeights[i + 1];
              const d = prev ? toDisplayWeight(b.weight - prev.weight, units) : 0;
              return (
                <SwipeRow key={b.id} onDelete={() => deleteBodyWeight(b.id)}>
                  <div className="row">
                    <span className="row-main">
                      <span className="row-label">{formatLongDate(b.date)}</span>
                    </span>
                    {prev && Math.abs(d) >= 0.05 && <span className={`delta ${d < 0 ? 'up' : 'flat'}`}>{d > 0 ? '+' : '−'}{fmtNumber(Math.abs(d), 1)}</span>}
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
              {showAll ? 'Show less' : `Show all ${bodyWeights.length}`}
            </button>
          )}
          <p className="faint swipe-hint">Swipe left on an entry to delete it.</p>
        </>
      )}

      {/* ── Measurements ── */}
      <div className="section-title">
        <h2>Measurements</h2>
        <button className="link" onClick={() => setMeasureSheet('new')}>
          Add
        </button>
      </div>
      {measurements.length === 0 ? (
        <div className="card">
          <EmptyState icon="ruler" title="Track your measurements" text="Arms, chest, waist, thighs and body fat — see how your body changes beyond the scale." action={<button className="btn btn-primary" onClick={() => setMeasureSheet('new')}>Add Measurements</button>} />
        </div>
      ) : (
        <>
          <Chips value={activeMetric} onChange={setMetric} options={metricKeys.map((k) => ({ value: k, label: MEASUREMENT_LABEL[k] }))} />
          <div className="card chart-card" style={{ marginTop: 12 }}>
            <LineChart
              data={mSeries}
              height={170}
              color="var(--blue)"
              ariaLabel={`${MEASUREMENT_LABEL[activeMetric]} over time`}
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
                const disp = (n: number) => (k === 'bodyFat' ? n : toDisplayLength(n, units));
                const diff = pv != null ? disp(v) - disp(pv) : 0;
                return (
                  <button key={k} className={`measure ${k === activeMetric ? 'is-active' : ''}`} onClick={() => setMetric(k)}>
                    <span>{MEASUREMENT_LABEL[k]}</span>
                    <strong className="num">
                      {fmtNumber(disp(v), 1)}
                      <small>{k === 'bodyFat' ? '%' : lengthUnit(units)}</small>
                    </strong>
                    {pv != null && Math.abs(diff) >= 0.05 && (
                      <em className="num">
                        {diff > 0 ? '+' : '−'}
                        {fmtNumber(Math.abs(diff), 1)}
                      </em>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <h2 className="wk-section">History</h2>
          <div className="group-body">
            {measurements.map((m) => (
              <SwipeRow key={m.id} onDelete={() => deleteMeasurement(m.id)}>
                <button className="row is-tappable" onClick={() => setMeasureSheet(m)}>
                  <span className="row-main">
                    <span className="row-label">{formatLongDate(m.date)}</span>
                    <span className="row-detail">
                      {Object.keys(m.values).length} measurements
                      {m.values[activeMetric] != null && ` · ${MEASUREMENT_LABEL[activeMetric]} ${fmtNumber(activeMetric === 'bodyFat' ? m.values[activeMetric]! : toDisplayLength(m.values[activeMetric]!, units), 1)}${mUnit}`}
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
    if (v === null || v < 20 || v > 700) return toast('Enter a valid weight', 'error');
    if (date > toLocalDate()) return toast('Date can’t be in the future', 'error');
    logBodyWeight(date, fromDisplayWeight(v, units));
    toast('Weight logged', 'success');
    setText('');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Log Weight"
      left={<button className="nav-btn" onClick={onClose}>Cancel</button>}
      right={<button className="nav-btn is-strong" onClick={save}>Save</button>}
    >
      <div className="big-input">
        <input
          inputMode="decimal"
          autoFocus
          placeholder={last ? fmtNumber(toDisplayWeight(last.weight, units), 1) : '0.0'}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          aria-label={`Weight in ${weightUnit(units)}`}
          className="num"
        />
        <span>{weightUnit(units)}</span>
      </div>
      <label className="field">
        <span>Date</span>
        <input className="input" type="date" value={date} max={toLocalDate()} onChange={(e) => setDate(e.target.value)} />
      </label>
      {bodyWeights.some((b) => b.date === date) && <p className="faint" style={{ marginTop: 8, fontSize: 14 }}>This replaces the entry already logged for that day.</p>}
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
      const t = vals[k];
      if (!t) continue;
      const n = parseDecimal(t);
      if (n === null || n <= 0 || (k === 'bodyFat' ? n > 70 : n > 400)) return toast(`Check the value for ${MEASUREMENT_LABEL[k]}`, 'error');
      values[k] = k === 'bodyFat' ? n : fromDisplayLength(n, units);
    }
    if (!Object.keys(values).length) return toast('Enter at least one measurement', 'error');
    saveMeasurement({ id: editing?.id ?? uid(), date, values });
    toast('Measurements saved', 'success');
    onClose();
  };

  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      full
      title={editing ? 'Edit Measurements' : 'New Measurements'}
      left={<button className="nav-btn" onClick={onClose}>Cancel</button>}
      right={<button className="nav-btn is-strong" onClick={save}>Save</button>}
    >
      <label className="field">
        <span>Date</span>
        <input className="input" type="date" value={date} max={toLocalDate()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="group-body" style={{ marginTop: 16 }}>
        {MEASUREMENT_KEYS.map((k) => {
          const pv = prev?.values[k];
          const ph = pv != null ? fmtNumber(k === 'bodyFat' ? pv : toDisplayLength(pv, units), 1) : '—';
          return (
            <label key={k} className="row">
              <span className="row-main">
                <span className="row-label">{MEASUREMENT_LABEL[k]}</span>
              </span>
              <input
                className="row-input num"
                inputMode="decimal"
                placeholder={ph}
                value={vals[k] ?? ''}
                onChange={(e) => setVals({ ...vals, [k]: e.target.value.replace(/[^\d.,]/g, '') })}
                aria-label={MEASUREMENT_LABEL[k]}
              />
              <span className="faint unit-suffix">{k === 'bodyFat' ? '%' : lengthUnit(units)}</span>
            </label>
          );
        })}
      </div>
      <p className="faint" style={{ fontSize: 13, marginTop: 10 }}>Placeholders show your previous values. Leave blank to skip.</p>
      {editing && (
        <button
          className="btn btn-danger btn-block"
          style={{ marginTop: 20 }}
          onClick={() => {
            deleteMeasurement(editing.id);
            onClose();
          }}
        >
          Delete Entry
        </button>
      )}
    </Sheet>
  );
}
