import { useEffect, useMemo, useRef, useState } from 'react';
import { FOODS } from '@/data/foods';
import {
  nutritionFor, parseScannedCode, searchBuiltIn, type BuiltInFood, type FoodItem, type MacroKey, type Serving,
} from '@/domain/food';
import { uid } from '@/domain/id';
import { MEALS, mealForHour, recentFoods } from '@/domain/nutrition';
import type { FoodEntry, LocalDate, Meal } from '@/domain/types';
import { fmtNumber, parseDecimal } from '@/domain/units';
import { getLang, joinList, t, type Key } from '@/i18n';
import { foodApi, type LookupResult, type SearchResult } from '@/lib/foodApi';
import { preloadScanner, ScannerError, startScanner, type ScanError, type Scanner } from '@/lib/scanner';
import { useData } from '@/store/useData';
import { Chips } from '@/ui/controls';
import { toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { MACROS } from './parts';

/** What the manual form starts with when a lookup hands over to it. */
export interface FoodPrefill {
  name: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  brand?: string;
  barcode?: string;
  /** why the form opened: shown as a short note above it */
  reason?: 'missing' | 'notFound' | 'edit' | 'manual';
}

type View = { kind: 'find' } | { kind: 'scan' } | { kind: 'detail'; item: FoodItem; from: 'find' | 'scan' };

const fmt = (n: number) => fmtNumber(n, n % 1 ? 1 : 0);
const unitLabel = (u: 'g' | 'ml') => t(u === 'ml' ? 'unit.ml' : 'unit.g');

function builtInItem(f: BuiltInFood): FoodItem {
  const lang = getLang();
  return { source: 'builtin', id: `usda:${f.id}`, name: lang === 'ar' ? f.nameAr : f.name, unit: f.unit, per100: f.per100, missing: [], servings: f.servings };
}

/** A food logged before, as something to log again. */
function recentItem(e: FoodEntry): FoodItem {
  if (e.per100 && e.amount && e.unit) {
    return {
      source: 'recent', id: `recent:${e.id}`, name: e.name, brand: e.brand, barcode: e.barcode, unit: e.unit, per100: e.per100, missing: [],
      servings: [{ key: 'label', label: e.servingLabel ?? `${fmt(e.amount)} ${unitLabel(e.unit)}`, amount: e.amount }],
    };
  }
  // Entered by hand: one portion = what was logged.
  return {
    source: 'recent', id: `recent:${e.id}`, name: e.name, unit: 'g', portionOnly: true, missing: [],
    per100: { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat },
    servings: [{ key: 'asLogged', amount: 100 }],
  };
}

/** "2 × 1 can · 660 ml": several servings, with the total so the amount is never ambiguous. */
function multipleText(s: Serving, count: number, amount: number, unit: 'g' | 'ml'): string {
  const word = s.key === 'label' || s.key === 'package' ? servingText(s, unit) : t(`serv.${s.key}` as Key);
  return `${fmt(count)} × ${word} · ${fmt(amount)} ${unitLabel(unit)}`;
}

/** "1 can (330 ml)": a known serving word plus its weight, or a product's own printed serving. */
export function servingText(s: Serving, unit: 'g' | 'ml'): string {
  const amount = `${fmt(s.amount)} ${unitLabel(unit)}`;
  if (s.key === 'asLogged') return t('food.asLogged');
  if (s.key === 'label') return s.label && /\d/.test(s.label) ? s.label : `${s.label ?? ''} (${amount})`.trim();
  if (s.key === 'package') return t('food.wholePack', { amount: s.label || amount });
  if (s.key === 'per100') return `100 ${unitLabel(unit)}`;
  return `${t(`serv.${s.key}` as Key)} (${amount})`;
}

export function FoodFinder({ open, date, onClose, onManual }: { open: boolean; date: LocalDate; onClose: () => void; onManual: (p: FoodPrefill) => void }) {
  const [view, setView] = useState<View>({ kind: 'find' });
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setView({ kind: 'find' });
      setQuery('');
    }
  }, [open]);

  const save = (item: FoodItem, amount: number, serving: string, meal: Meal) => {
    const n = nutritionFor(item.per100!, amount);
    const source = item.source === 'recent' ? (item.portionOnly ? 'manual' : item.barcode ? 'off' : 'builtin') : item.source;
    useData.getState().saveFood({
      id: uid(),
      date,
      createdAt: new Date().toISOString(),
      meal,
      name: item.name.slice(0, 60),
      ...n,
      brand: item.brand,
      barcode: item.barcode,
      source,
      ...(item.portionOnly ? {} : { amount: Math.round(amount * 10) / 10, unit: item.unit, servingLabel: serving, per100: item.per100! }),
    });
    toast(t('nut.foodAdded'), 'success');
    onClose();
  };

  const toManual = (p: FoodPrefill) => {
    onClose();
    onManual(p);
  };

  const back =
    view.kind === 'find' ? (
      <button className="nav-btn" onClick={onClose}>
        {t('common.cancel')}
      </button>
    ) : (
      <button className="nav-btn" onClick={() => setView({ kind: 'find' })}>
        <Icon name="chevronLeft" size={20} stroke={2.4} /> {t('common.back')}
      </button>
    );

  return (
    <Sheet open={open} onClose={onClose} title={t('nut.addFood')} left={back} full className="ff-sheet">
      {view.kind === 'find' && (
        <FindView
          query={query}
          setQuery={setQuery}
          onPick={(item) => setView({ kind: 'detail', item, from: 'find' })}
          onScan={() => setView({ kind: 'scan' })}
          onManual={() => toManual({ name: query.trim(), reason: 'manual' })}
        />
      )}
      {view.kind === 'scan' && (
        <ScanView
          onFound={(item) => setView({ kind: 'detail', item, from: 'scan' })}
          onManual={(barcode) => toManual({ name: '', barcode, reason: 'notFound' })}
        />
      )}
      {view.kind === 'detail' && (
        <DetailView
          key={view.item.id}
          item={view.item}
          onAdd={save}
          onEdit={(p) => toManual(p)}
        />
      )}
    </Sheet>
  );
}

// ── Find ───────────────────────────────────────────────────────────────────

function FindView({ query, setQuery, onPick, onScan, onManual }: {
  query: string;
  setQuery: (q: string) => void;
  onPick: (item: FoodItem) => void;
  onScan: () => void;
  onManual: () => void;
}) {
  const foodLog = useData((s) => s.foodLog);
  const lang = getLang();
  const q = query.trim();
  const recent = useMemo(() => recentFoods(foodLog, 8), [foodLog]);
  const recentHits = useMemo(() => {
    if (!q) return recent;
    const ql = q.toLowerCase();
    return recentFoods(foodLog, 50).filter((e) => e.name.toLowerCase().includes(ql) || e.brand?.toLowerCase().includes(ql)).slice(0, 4);
  }, [q, recent, foodLog]);
  const common = useMemo(() => searchBuiltIn(q, FOODS).slice(0, 12), [q]);
  const [online, setOnline] = useState<{ query: string; result: SearchResult | 'loading' } | null>(null);
  const reqRef = useRef(0);

  const searchOnline = (text = q) => {
    if (text.length < 2) return;
    const id = ++reqRef.current;
    setOnline({ query: text, result: 'loading' });
    void foodApi.search(text, lang).then((result) => {
      if (reqRef.current === id) setOnline({ query: text, result });
    });
  };

  // Nothing on the device matches: look online automatically after a pause (the client stays
  // within the database's rate limit, and results are cached).
  useEffect(() => {
    if (q.length < 3 || common.length || recentHits.length) return;
    const h = setTimeout(() => searchOnline(q), 800);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, common.length, recentHits.length]);

  const shown = online && online.query === q ? online.result : null;

  return (
    <div className="ff">
      <div className="ff-bar">
        <label className="ff-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            enterKeyHint="search"
            dir="auto"
            placeholder={t('food.searchPlaceholder')}
            aria-label={t('food.searchPlaceholder')}
            value={query}
            maxLength={60}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchOnline()}
          />
          {query && (
            <button className="ff-clear" onClick={() => setQuery('')} aria-label={t('food.clear')}>
              <Icon name="x" size={16} stroke={2.6} />
            </button>
          )}
        </label>
        <button className="ff-scan" onClick={onScan} onPointerDown={preloadScanner} aria-label={t('food.scanAria')}>
          <Icon name="scan" size={22} stroke={2.2} />
          <span>{t('food.scan')}</span>
        </button>
      </div>

      {recentHits.length > 0 && (
        <Section title={t(q ? 'food.yourFoods' : 'food.recent')}>
          {recentHits.map((e) => (
            <ResultRow key={e.id} name={e.name} sub={e.servingLabel ?? e.brand} kcal={e.kcal} kcalNote={t('food.asLoggedShort')} onClick={() => onPick(recentItem(e))} />
          ))}
        </Section>
      )}

      {common.length > 0 && (
        <Section title={t('food.common')}>
          {common.map((f) => (
            <ResultRow
              key={f.id}
              name={lang === 'ar' ? f.nameAr : f.name}
              sub={f.servings[0] ? servingText(f.servings[0], f.unit) : undefined}
              kcal={f.servings[0] ? nutritionFor(f.per100, f.servings[0].amount).kcal : f.per100.kcal}
              kcalNote={f.servings[0] ? undefined : t('food.per100', { unit: unitLabel(f.unit) })}
              onClick={() => onPick(builtInItem(f))}
            />
          ))}
        </Section>
      )}

      {q.length >= 2 && (
        <Section title={t('food.products')}>
          {!shown && (
            <button className="ff-row ff-action" onClick={() => searchOnline()}>
              <Icon name="search" size={18} />
              <span>{t('food.searchOnline', { q })}</span>
            </button>
          )}
          {shown === 'loading' && <p className="ff-status">{t('food.searching')}</p>}
          {shown && shown !== 'loading' && shown.status === 'ok' && shown.items.length === 0 && <p className="ff-status">{t('food.noResults', { q })}</p>}
          {shown && shown !== 'loading' && shown.status === 'ok' &&
            shown.items.slice(0, 15).map((it) => (
              <ResultRow
                key={it.id}
                name={it.name}
                sub={[it.brand, it.servings[0] ? servingText(it.servings[0], it.unit) : null].filter(Boolean).join(' · ')}
                image={it.image}
                kcal={it.per100 ? (it.servings[0] ? nutritionFor(it.per100, it.servings[0].amount).kcal : it.per100.kcal) : null}
                kcalNote={it.per100 && !it.servings[0] ? t('food.per100', { unit: unitLabel(it.unit) }) : undefined}
                onClick={() => onPick(it)}
              />
            ))}
          {shown && shown !== 'loading' && shown.status !== 'ok' && (
            <div className="ff-problem">
              <p>{t(FAILURE_TEXT[shown.status])}</p>
              {shown.status !== 'offline' && (
                <button className="btn btn-sm" onClick={() => searchOnline()}>
                  {t('food.retry')}
                </button>
              )}
            </div>
          )}
          {shown && shown !== 'loading' && shown.status === 'ok' && shown.items.length > 0 && <p className="ff-credit">{t('food.creditOff')}</p>}
        </Section>
      )}

      {q.length === 1 && <p className="ff-status">{t('food.typeMore')}</p>}

      <button className="ff-row ff-action ff-manual" onClick={onManual}>
        <Icon name="edit" size={18} />
        <span>{q ? t('food.manualNamed', { q }) : t('food.manual')}</span>
      </button>
      {common.length > 0 && <p className="ff-credit">{t('food.creditUsda')}</p>}
    </div>
  );
}

const FAILURE_TEXT: Record<'busy' | 'offline' | 'timeout' | 'error', Key> = {
  busy: 'food.busy',
  offline: 'food.offline',
  timeout: 'food.timeout',
  error: 'food.error',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ff-section">
      <h3>{title}</h3>
      <div className="ff-list">{children}</div>
    </section>
  );
}

function ResultRow({ name, sub, kcal, kcalNote, image, onClick }: {
  name: string;
  sub?: string | null;
  kcal: number | null;
  kcalNote?: string;
  image?: string;
  onClick: () => void;
}) {
  return (
    <button className="ff-row" onClick={onClick}>
      {image !== undefined && (
        <span className="ff-thumb" aria-hidden="true">
          {image ? <ProductImage src={image} /> : <Icon name="scan" size={16} />}
        </span>
      )}
      <span className="ff-main">
        <strong dir="auto">{name}</strong>
        {sub && <span dir="auto">{sub}</span>}
      </span>
      <span className="ff-kcal">
        {kcal === null ? (
          <span className="ff-missing">{t('food.incomplete')}</span>
        ) : (
          <>
            <span className="num">{fmtNumber(kcal, 0)}</span> {t('unit.kcal')}
            {kcalNote && <small>{kcalNote}</small>}
          </>
        )}
      </span>
      <Icon name="chevronRight" size={16} stroke={2.4} className="ff-chev" />
    </button>
  );
}

/** Product photo: a neutral placeholder until it loads (the image server can take seconds), hidden if it fails. */
function ProductImage({ src }: { src: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  if (state === 'failed') return <Icon name="scan" size={16} />;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={`ff-img ${state === 'ready' ? 'is-ready' : ''}`}
      onLoad={() => setState('ready')}
      onError={() => setState('failed')}
    />
  );
}

// ── Scan ───────────────────────────────────────────────────────────────────

type ScanState =
  | { kind: 'starting' }
  | { kind: 'scanning' }
  | { kind: 'camera'; error: ScanError }
  | { kind: 'looking'; code: string }
  | { kind: 'badCode'; reason: 'checksum' | 'format' | 'notProduct' | 'empty' }
  | { kind: 'notFound'; code: string }
  | { kind: 'failed'; code: string; status: 'busy' | 'offline' | 'timeout' | 'error' };

const CAMERA_TEXT: Record<ScanError, Key> = {
  insecure: 'food.camInsecure',
  unsupported: 'food.camUnsupported',
  denied: 'food.camDenied',
  noCamera: 'food.camNone',
  inUse: 'food.camInUse',
  failed: 'food.camFailed',
  cancelled: 'food.camFailed', // never shown: a cancelled start belongs to a screen that's gone
};
const CODE_TEXT: Record<'checksum' | 'format' | 'notProduct' | 'empty', Key> = {
  checksum: 'food.codeChecksum',
  format: 'food.codeFormat',
  notProduct: 'food.codeNotProduct',
  empty: 'food.codeFormat',
};

function ScanView({ onFound, onManual }: { onFound: (item: FoodItem) => void; onManual: (barcode?: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanner = useRef<Scanner | null>(null);
  const alive = useRef(true);
  const [state, setState] = useState<ScanState>({ kind: 'starting' });
  const [typed, setTyped] = useState('');
  const [run, setRun] = useState(0); // bump to restart the camera
  const lang = getLang();

  const lookUp = async (raw: string) => {
    const parsed = parseScannedCode(raw);
    if (!parsed.ok) {
      setState({ kind: 'badCode', reason: parsed.reason });
      return;
    }
    setState({ kind: 'looking', code: parsed.gtin });
    const r: LookupResult = await foodApi.lookup(parsed.gtin, lang);
    if (!alive.current) return;
    if (r.status === 'found') onFound(r.item);
    else if (r.status === 'notFound') setState({ kind: 'notFound', code: parsed.gtin });
    else setState({ kind: 'failed', code: parsed.gtin, status: r.status });
  };

  useEffect(() => {
    alive.current = true;
    const video = videoRef.current;
    if (!video) return;
    const ctrl = new AbortController();
    setState({ kind: 'starting' });
    startScanner(
      video,
      (raw) => {
        scanner.current?.stop();
        void lookUp(raw);
      },
      ctrl.signal,
    )
      .then((s) => {
        if (ctrl.signal.aborted) return s.stop();
        scanner.current = s;
        setState((cur) => (cur.kind === 'starting' ? { kind: 'scanning' } : cur));
      })
      .catch((e) => {
        const reason = e instanceof ScannerError ? e.reason : 'failed';
        if (!ctrl.signal.aborted && reason !== 'cancelled') setState({ kind: 'camera', error: reason });
      });
    return () => {
      ctrl.abort();
      alive.current = false;
      scanner.current?.stop();
      scanner.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const submitTyped = () => {
    scanner.current?.stop();
    void lookUp(typed.replace(/\s+/g, ''));
  };
  const cameraLive = state.kind === 'scanning' || state.kind === 'starting';

  return (
    <div className="ff-scanview">
      <div className={`ff-camera ${cameraLive ? 'is-live' : ''}`}>
        <video ref={videoRef} playsInline muted aria-hidden="true" />
        {cameraLive && <span className="ff-frame" aria-hidden="true" />}
        <p className="ff-camera-msg" role="status" aria-live="polite">
          {state.kind === 'starting' && t('food.startingCamera')}
          {state.kind === 'scanning' && t('food.scanHint')}
          {state.kind === 'camera' && t(CAMERA_TEXT[state.error])}
          {state.kind === 'looking' && t('food.looking', { code: state.code })}
          {state.kind === 'badCode' && t(CODE_TEXT[state.reason])}
          {state.kind === 'notFound' && t('food.notFoundText', { code: state.code })}
          {state.kind === 'failed' && t(FAILURE_TEXT[state.status])}
        </p>
      </div>

      {(state.kind === 'badCode' || state.kind === 'notFound' || state.kind === 'failed') && (
        <div className="btn-row ff-scan-actions">
          <button className="btn" onClick={() => setRun((n) => n + 1)}>
            {t('food.scanAgain')}
          </button>
          {state.kind === 'failed' && state.status !== 'offline' ? (
            <button className="btn btn-primary" onClick={() => void lookUp(state.code)}>
              {t('food.retry')}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => onManual(state.kind === 'badCode' ? undefined : state.code)}>
              {t('food.manual')}
            </button>
          )}
        </div>
      )}

      <form
        className="ff-typecode"
        onSubmit={(e) => {
          e.preventDefault();
          submitTyped();
        }}
      >
        <label>
          <span>{t('food.typeCode')}</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            placeholder="5449000000996"
            value={typed}
            maxLength={20}
            onChange={(e) => setTyped(e.target.value.replace(/[^\d\s]/g, ''))}
          />
        </label>
        <button className="btn btn-primary" disabled={typed.replace(/\s/g, '').length < 8 || state.kind === 'looking'}>
          {t('food.lookup')}
        </button>
      </form>
    </div>
  );
}

// ── Detail ─────────────────────────────────────────────────────────────────

function DetailView({ item, onAdd, onEdit }: {
  item: FoodItem;
  onAdd: (item: FoodItem, amount: number, serving: string, meal: Meal) => void;
  onEdit: (p: FoodPrefill) => void;
}) {
  const options = useMemo<Serving[]>(
    () => (item.portionOnly ? item.servings : [...item.servings, { key: 'per100', amount: 100 }]),
    [item],
  );
  const [pick, setPick] = useState<number | 'custom'>(0);
  const [count, setCount] = useState(1);
  const [custom, setCustom] = useState('');
  const [meal, setMeal] = useState<Meal>(() => mealForHour(new Date().getHours()));

  const unit = unitLabel(item.unit);
  const serving = pick === 'custom' ? null : options[pick];
  const amount = serving ? serving.amount * count : parseDecimal(custom) ?? 0;
  const label =
    serving === null || serving.key === 'per100'
      ? `${fmt(amount)} ${unit}`
      : count === 1
        ? servingText(serving, item.unit)
        : multipleText(serving, count, amount, item.unit);
  const n = item.per100 ? nutritionFor(item.per100, amount) : null;
  const valid = amount > 0 && amount <= 5000;
  const missingNames = item.missing.map((m: MacroKey) => t(MACROS.find((x) => x.key === m)!.label));
  const prefillBase = { name: item.name, brand: item.brand, barcode: item.barcode };

  return (
    <div className="ff-detail">
      <header className="ff-head">
        {item.image && (
          <span className="ff-head-img">
            <ProductImage src={item.image} />
          </span>
        )}
        <div>
          <h2 dir="auto">{item.name}</h2>
          {(item.brand || item.barcode) && (
            <p dir="auto">{[item.brand, item.barcode && t('food.barcode', { code: item.barcode })].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      </header>

      {!item.per100 ? (
        <div className="ff-warn">
          <Icon name="warning" size={20} />
          <div>
            <strong>{t('food.missingTitle')}</strong>
            <p>{t('food.missingText')}</p>
            <button className="btn btn-primary btn-sm" onClick={() => onEdit({ ...prefillBase, reason: 'missing' })}>
              {t('food.addNutrition')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <span>{t('food.serving')}</span>
            <div className="chips ff-servings" role="radiogroup" aria-label={t('food.serving')}>
              {options.map((s, i) => (
                <button key={`${s.key}-${i}`} role="radio" aria-checked={pick === i} className={`chip ${pick === i ? 'is-active' : ''}`} onClick={() => setPick(i)}>
                  {servingText(s, item.unit)}
                </button>
              ))}
              {!item.portionOnly && (
                <button role="radio" aria-checked={pick === 'custom'} className={`chip ${pick === 'custom' ? 'is-active' : ''}`} onClick={() => setPick('custom')}>
                  {t('food.custom')}
                </button>
              )}
            </div>
          </div>

          {pick === 'custom' ? (
            <label className="field ff-amount">
              <span>{t('food.amount')}</span>
              <div className="ff-amount-input">
                <input className="input num" inputMode="decimal" autoFocus value={custom} placeholder="0" onChange={(e) => setCustom(e.target.value.slice(0, 6))} />
                <span>{unit}</span>
              </div>
            </label>
          ) : (
            <div className="field">
              <span>{t('food.howMany')}</span>
              <div className="ff-count">
                <button onClick={() => setCount((c) => Math.max(0.5, c - 0.5))} disabled={count <= 0.5} aria-label={t('common.decrease', { label: t('food.howMany') })}>
                  <Icon name="minus" size={20} stroke={2.6} />
                </button>
                <strong className="num">{fmt(count)}</strong>
                <button onClick={() => setCount((c) => Math.min(20, c + 0.5))} aria-label={t('common.increase', { label: t('food.howMany') })}>
                  <Icon name="plus" size={20} stroke={2.6} />
                </button>
              </div>
            </div>
          )}

          <div className="ff-totals" aria-live="polite">
            <div className="ff-kcal-big">
              <strong className="num">{n && valid ? fmtNumber(n.kcal, 0) : '–'}</strong>
              <span>{t('unit.kcal')}</span>
            </div>
            <div className="ff-macros">
              {MACROS.map((m) => (
                <div key={m.key} className={item.missing.includes(m.key) ? 'is-missing' : ''}>
                  <span>{t(m.label)}</span>
                  <strong className="num">{n && valid ? `${fmt(n[m.key])} ${t('unit.g')}` : '–'}</strong>
                </div>
              ))}
            </div>
            {!item.portionOnly && valid && <p className="ff-for">{t('food.forAmount', { amount: `${fmt(amount)} ${unit}` })}</p>}
          </div>
          {missingNames.length > 0 && <p className="ff-note">{t('food.missingMacros', { list: joinList(missingNames) })}</p>}

          <div className="field">
            <span>{t('nut.meal')}</span>
            <Chips value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: t(`meal.${m}`) }))} />
          </div>

          <button className="btn btn-primary btn-block ff-add" disabled={!valid} onClick={() => onAdd(item, amount, label, meal)}>
            <Icon name="plus" size={18} stroke={2.6} /> {t('food.addTo', { meal: t(`meal.${meal}`) })}
          </button>
          <button
            className="link ff-edit"
            onClick={() => onEdit({ ...prefillBase, ...(n && valid ? n : {}), reason: 'edit' })}
          >
            {t('food.editNutrition')}
          </button>
        </>
      )}
      <p className="ff-credit">{item.source === 'off' || (item.source === 'recent' && item.barcode) ? t('food.creditOff') : item.source === 'builtin' ? t('food.creditUsda') : ''}</p>
    </div>
  );
}
