import { useEffect, useMemo, useState } from 'react';
import { addDays, formatLongDate, parseLocalDate, toLocalDate } from '@/domain/dates';
import { calcTargets, entriesOn, kcalFromMacros, MEALS, mealForHour, recentFoods, sumIntake, type Intake, type Targets } from '@/domain/nutrition';
import { uid } from '@/domain/id';
import type { FoodEntry, LocalDate, Meal, NutritionGoal } from '@/domain/types';
import { fmtNumber, fmtWeight, parseDecimal } from '@/domain/units';
import { t } from '@/i18n';
import { useData } from '@/store/useData';
import { Ring } from '@/ui/charts';
import { Chips, EmptyState, Group, Row, SwipeRow } from '@/ui/controls';
import { toast } from '@/ui/dialogs';
import { Icon } from '@/ui/Icon';
import { Screen, SectionTitle } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { AboutFields, ActivityPicker, BodyFields, GOAL_ICON, GoalPicker, goalTip, grams, kcal, MacroBar, MACROS, NumField, planLine, TargetSummary, useTargets } from './parts';
import { initialDraft, parseDraft, savePlan, type PlanDraft } from './planForm';
import './nutrition.css';

const back = () => ({ label: t('tab.home'), to: '/' });

/** How the calorie ring reads for each goal: a ceiling when cutting, a target to reach when building. */
export function calorieTone(goal: NutritionGoal, consumed: number, target: number): 'normal' | 'over' | 'met' {
  // Cutting and maintaining leave little headroom; a surplus goal tolerates more before it counts as over.
  const ceiling = goal === 'lose' || goal === 'maintain' ? 1.05 : 1.15;
  if (consumed > target * ceiling) return 'over';
  if (consumed >= target * 0.95) return 'met';
  return 'normal';
}
export const TONE_COLOR = { normal: 'var(--chart)', over: 'var(--red)', met: 'var(--green)' } as const;

export function NutritionScreen() {
  const profile = useData((s) => s.nutrition);
  const targets = useTargets();
  const title = t('nut.title');

  if (!profile || !targets) {
    return (
      <Screen title={title} back={back()}>
        <EmptyState
          icon="food"
          title={t('nut.setupTitle')}
          text={t('nut.setupText')}
          action={
            <button className="btn btn-primary" onClick={() => useData.getState().skipNutrition(false)}>
              {t('nut.setupBtn')}
            </button>
          }
        />
      </Screen>
    );
  }
  return <Dashboard goal={profile.goal} targets={targets} />;
}

function Dashboard({ goal, targets }: { goal: NutritionGoal; targets: Targets }) {
  const foodLog = useData((s) => s.foodLog);
  const today = toLocalDate();
  const [date, setDate] = useState<LocalDate>(today);
  const [food, setFood] = useState<FoodEntry | 'new' | null>(null);
  const [editPlan, setEditPlan] = useState(false);

  const entries = useMemo(() => entriesOn(foodLog, date), [foodLog, date]);
  const eaten = useMemo(() => sumIntake(entries), [entries]);
  const shift = (n: number) => setDate(toLocalDate(addDays(parseLocalDate(date), n)));

  return (
    <Screen
      title={t('nut.title')}
      large
      back={back()}
      right={
        <button className="nav-btn" onClick={() => setFood('new')} aria-label={t('nut.addFood')}>
          <Icon name="plus" size={24} stroke={2.4} />
        </button>
      }
    >
      <div className="daynav">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label={t('nut.prevDay')}>
          <Icon name="chevronLeft" size={20} stroke={2.4} />
        </button>
        <strong>{formatLongDate(date)}</strong>
        <button className="icon-btn" onClick={() => shift(1)} disabled={date >= today} aria-label={t('nut.nextDay')}>
          <Icon name="chevronRight" size={20} stroke={2.4} />
        </button>
      </div>

      <CalorieCard goal={goal} targets={targets} eaten={eaten} />

      <div className="card macro-card">
        {MACROS.map((m) => (
          <MacroBar key={m.key} label={t(m.label)} color={m.color} value={eaten[m.key]} target={targets[m.key]} />
        ))}
      </div>

      <p className="nut-tip">
        <Icon name="bolt" size={16} /> {goalTip(goal)}
      </p>

      <SectionTitle
        action={
          <button className="link" onClick={() => setFood('new')}>
            {t('nut.addFood')}
          </button>
        }
      >
        {t('nut.foodLog')}
      </SectionTitle>
      {entries.length === 0 ? (
        <div className="card food-empty">
          <strong>{t('nut.noFood')}</strong>
          <p>{t('nut.noFoodText')}</p>
          <button className="btn btn-primary btn-sm" onClick={() => setFood('new')}>
            <Icon name="plus" size={16} stroke={2.6} /> {t('nut.addFood')}
          </button>
        </div>
      ) : (
        MEALS.map((meal) => {
          const list = entries.filter((e) => e.meal === meal);
          if (!list.length) return null;
          return (
            <Group
              key={meal}
              title={
                <span className="meal-title">
                  {t(`meal.${meal}`)} <span className="num">{kcal(sumIntake(list).kcal)}</span>
                </span>
              }
            >
              {list.map((e) => (
                <SwipeRow
                  key={e.id}
                  onDelete={() => {
                    useData.getState().deleteFood(e.id);
                    toast(t('nut.foodDeleted'));
                  }}
                >
                  <Row label={e.name} detail={<MacroLine e={e} />} value={<span className="num">{kcal(e.kcal)}</span>} onClick={() => setFood(e)} />
                </SwipeRow>
              ))}
            </Group>
          );
        })
      )}

      <PlanGroup goal={goal} targets={targets} onEdit={() => setEditPlan(true)} />

      <FoodSheet entry={food} date={date} onClose={() => setFood(null)} />
      <PlanSheet open={editPlan} onClose={() => setEditPlan(false)} />
    </Screen>
  );
}

const MacroLine = ({ e }: { e: Intake }) => (
  <span className="num food-macros">
    {MACROS.map((m) => `${t(m.label)} ${grams(e[m.key])}`).join(' · ')}
  </span>
);

function CalorieCard({ goal, targets, eaten }: { goal: NutritionGoal; targets: Targets; eaten: Intake }) {
  const remaining = targets.calories - eaten.kcal;
  const over = remaining < 0;
  const tone = calorieTone(goal, eaten.kcal, targets.calories);
  return (
    <div className={`card kcal-card tone-${tone}`}>
      <div className="kcal-goal">
        <span className="goal-chip">
          <Icon name={GOAL_ICON[goal]} size={14} stroke={2.4} /> {t(`goal.${goal}`)}
        </span>
        <p>{planLine(goal, targets)}</p>
      </div>
      <Ring
        value={eaten.kcal / targets.calories}
        size={184}
        stroke={15}
        color={TONE_COLOR[tone]}
        label={t('nut.ringAria', { consumed: fmtNumber(eaten.kcal, 0), target: fmtNumber(targets.calories, 0) })}
      >
        <strong className="num kcal-big">{fmtNumber(Math.abs(remaining), 0)}</strong>
        <span className="kcal-unit">{t(over ? 'nut.kcalOver' : 'nut.kcalLeft')}</span>
      </Ring>
      <div className="kcal-stats">
        <div>
          <label>{t('nut.consumed')}</label>
          <span className="num">{fmtNumber(eaten.kcal, 0)}</span>
        </div>
        <div>
          <label>{t('nut.target')}</label>
          <span className="num">{fmtNumber(targets.calories, 0)}</span>
        </div>
        <div className={tone === 'over' ? 'is-over' : ''}>
          <label>{t(over ? 'nut.over' : 'nut.remaining')}</label>
          <span className="num">{fmtNumber(Math.abs(remaining), 0)}</span>
        </div>
      </div>
    </div>
  );
}

function PlanGroup({ goal, targets, onEdit }: { goal: NutritionGoal; targets: Targets; onEdit: () => void }) {
  const profile = useData((s) => s.nutrition)!;
  const units = useData((s) => s.settings.units);
  const weight = useData((s) => s.bodyWeights[0]?.weight ?? profile.weightKg);
  return (
    <Group title={t('nut.plan')} footer={`${t('nut.weightNote')} ${t('nut.method')}`}>
      <Row icon={GOAL_ICON[goal]} iconColor="#ff9f0a" label={t('nut.goal')} value={t(`goal.${goal}`)} />
      <Row icon="bolt" iconColor="#34c759" label={t('nut.activity')} value={t(`act.${profile.activity}`)} />
      <Row icon="scale" iconColor="#0a84ff" label={t('nut.weight')} value={<span className="num">{fmtWeight(weight, units)}</span>} />
      <Row icon="flame" iconColor="#ff375f" label={t('nut.maintenance')} value={<span className="num">{kcal(targets.tdee)}</span>} />
      <Row icon="edit" iconColor="#5e5ce6" label={t('nut.editPlan')} onClick={onEdit} chevron />
    </Group>
  );
}

// ─── Food sheet ──────────────────────────────────────────────────────────────

interface FoodDraft {
  name: string;
  meal: Meal;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}

const text = (n: number) => (n ? String(Math.round(n * 10) / 10) : '');
const foodDraft = (e: FoodEntry | null): FoodDraft =>
  e
    ? { name: e.name, meal: e.meal, kcal: text(e.kcal), protein: text(e.protein), carbs: text(e.carbs), fat: text(e.fat) }
    : { name: '', meal: mealForHour(new Date().getHours()), kcal: '', protein: '', carbs: '', fat: '' };

function FoodSheet({ entry, date, onClose }: { entry: FoodEntry | 'new' | null; date: LocalDate; onClose: () => void }) {
  const foodLog = useData((s) => s.foodLog);
  const editing = entry && entry !== 'new' ? entry : null;
  const [d, setD] = useState<FoodDraft>(() => foodDraft(null));
  const set = (patch: Partial<FoodDraft>) => setD((v) => ({ ...v, ...patch }));
  const recent = useMemo(() => recentFoods(foodLog, 6), [foodLog]);

  useEffect(() => {
    if (entry) setD(foodDraft(entry === 'new' ? null : entry));
  }, [entry]);

  const macros = { protein: parseDecimal(d.protein) ?? 0, carbs: parseDecimal(d.carbs) ?? 0, fat: parseDecimal(d.fat) ?? 0 };
  const implied = kcalFromMacros(macros.protein, macros.carbs, macros.fat);

  const save = () => {
    const name = d.name.trim();
    if (!name) return toast(t('nut.errName'), 'error');
    const kcalValue = d.kcal.trim() === '' ? implied : parseDecimal(d.kcal);
    if (kcalValue === null || (kcalValue === 0 && implied === 0)) return toast(t('nut.errFood'), 'error');
    useData.getState().saveFood({
      id: editing?.id ?? uid(),
      date: editing?.date ?? date,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      meal: d.meal,
      name: name.slice(0, 60),
      kcal: Math.round(kcalValue),
      ...macros,
    });
    toast(t(editing ? 'nut.foodSaved' : 'nut.foodAdded'), 'success');
    onClose();
  };

  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      title={t(editing ? 'nut.editFood' : 'nut.addFood')}
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
      <label className="field food-name">
        <span>{t('nut.foodName')}</span>
        <input
          className="input"
          value={d.name}
          placeholder={t('nut.foodPlaceholder')}
          maxLength={60}
          dir="auto"
          onChange={(e) => set({ name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </label>
      <div className="field">
        <span>{t('nut.meal')}</span>
        <Chips value={d.meal} onChange={(meal) => set({ meal })} options={MEALS.map((m) => ({ value: m, label: t(`meal.${m}`) }))} />
      </div>
      <div className="food-grid">
        <NumField
          label={t('nut.calories')}
          unit={t('unit.kcal')}
          value={d.kcal}
          placeholder={implied ? String(implied) : '0'}
          decimal={false}
          onChange={(v) => set({ kcal: v.slice(0, 5) })}
        />
        {MACROS.map((m) => (
          <NumField key={m.key} label={t(m.label)} unit={t('unit.g')} value={d[m.key]} onChange={(v) => set({ [m.key]: v.slice(0, 5) })} />
        ))}
      </div>
      <p className="food-hint">{t('nut.kcalHint')}</p>

      {!editing && recent.length > 0 && (
        <>
          <div className="food-recent-title">{t('nut.recent')}</div>
          <div className="food-recent">
            {recent.map((e) => (
              <button key={e.id} onClick={() => setD({ ...foodDraft(e), meal: d.meal })}>
                <span>{e.name}</span>
                <span className="num faint">{kcal(e.kcal)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {editing && (
        <button
          className="btn btn-danger btn-block food-delete"
          onClick={() => {
            useData.getState().deleteFood(editing.id);
            toast(t('nut.foodDeleted'));
            onClose();
          }}
        >
          {t('nut.deleteFood')}
        </button>
      )}
    </Sheet>
  );
}

// ─── Plan sheet ──────────────────────────────────────────────────────────────

function PlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const units = useData((s) => s.settings.units);
  const [draft, setDraft] = useState<PlanDraft>(initialDraft);
  const set = (patch: Partial<PlanDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (open) setDraft(initialDraft());
  }, [open]);

  const parsed = useMemo(() => parseDraft(draft, units), [draft, units]);
  const save = () => {
    if (!parsed.ok) return toast(parsed.error, 'error');
    savePlan(parsed.value);
    toast(t('nut.planUpdated'), 'success');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      title={t('nut.editPlan')}
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
      <div className="plan-preview">
        <div className="plan-preview-title">{t('nut.newTargets')}</div>
        {parsed.ok ? <TargetSummary targets={calcTargets(parsed.value)} goal={parsed.value.goal} /> : <p className="plan-error">{parsed.error}</p>}
      </div>
      <div className="plan-section">{t('nut.goal')}</div>
      <GoalPicker value={draft.goal} onChange={(goal) => set({ goal })} />
      <div className="plan-section">{t('nut.activity')}</div>
      <ActivityPicker value={draft.activity} onChange={(activity) => set({ activity })} />
      <div className="plan-section">{t('ob.bodyTitle')}</div>
      <div className="ob-fields">
        <BodyFields draft={draft} set={set} units={units} />
        <AboutFields draft={draft} set={set} />
      </div>
    </Sheet>
  );
}
