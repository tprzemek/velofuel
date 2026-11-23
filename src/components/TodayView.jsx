import { useRef, useState } from 'react';
import {
  Bike,
  Dumbbell,
  Activity,
  CheckCircle2,
  Flame,
  Scale,
  Camera,
  Trash2,
  Droplets,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Zap,
  ScanBarcode,
  Pill,
  BookmarkPlus,
  Sparkles,
  Pencil,
  RefreshCw,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Lightbulb,
  Plus,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  BOTTLE_SIZE_OPTIONS,
  INTENSITY_OPTIONS,
  normalizeSportKind,
  SPORT_OPTIONS,
  suggestMealForSlot,
  sumDailyLogs,
} from '../engine/fuelingEngine';
import { formatFoodAmount, formatLiquid, formatSodiumPractical } from '../engine/units';
import NumericInput from './NumericInput';
import BarcodeScannerModal from './BarcodeScannerModal';

function CalorieRing({ eaten, target }) {
  const ratio = Math.min(1, Math.max(0, eaten / Math.max(target, 1)));
  const size = 74;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - ratio);
  const pctNum = Math.round((eaten / Math.max(target, 1)) * 100);

  return (
    <div className="hero-ring-wrap" aria-label={`${pctNum}% of daily calories logged`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pctNum > 108 ? '#F7C76B' : '#32E09D'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.35s ease' }}
        />
      </svg>
      <div className="hero-ring-label">
        <div className="mono" style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff' }}>
          {pctNum}%
        </div>
        <div style={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(248,247,244,0.62)', textTransform: 'uppercase' }}>
          fueled
        </div>
      </div>
    </div>
  );
}

function WorkoutSportIcon({ sportKind, size = 16 }) {
  if (sportKind === 'ride') return <Bike size={size} color="var(--code-high)" />;
  if (sportKind === 'strength') return <Dumbbell size={size} color="var(--code-med)" />;
  return <Activity size={size} color="var(--macro-protein)" />;
}

const QUICK_CUSTOM_MEALS = [
  { label: 'Mid-Morning Snack', size: 'snack' },
  { label: 'Post-Ride Shake', size: 'snack' },
  { label: 'Second Lunch', size: 'meal' },
  { label: 'Evening Snack', size: 'snack' },
];

const QUICK_WORKOUT_PRESETS = [
  { title: 'Gym / Strength', sport: 'WeightTraining', durationMin: 45, kcal: 270, kj: 0, timing: 'morning', status: 'completed', intensity: 'endurance' },
  { title: 'Zone 2 Ride', sport: 'Ride', durationMin: 90, kcal: 0, kj: 950, timing: 'evening', status: 'planned', intensity: 'endurance' },
  { title: 'Easy Run', sport: 'Run', durationMin: 45, kcal: 460, kj: 0, timing: 'morning', status: 'planned', intensity: 'endurance' },
  { title: 'Yoga / Mobility', sport: 'Yoga', durationMin: 30, kcal: 130, kj: 0, timing: 'morning', status: 'completed', intensity: 'recovery' },
];

export default function TodayView({
  plan,
  profile,
  units,
  usdaApiKey = '',
  logs,
  staples = [],
  supplements = [],
  biometricsSummary,
  hasIntervalsConnected = false,
  bgSyncing = false,
  isDayCustomized = false,
  onResyncNow,
  onOpenStapleModal,
  onOpenQuickFoodModal,
  onOpenWorkModal,
  onOpenSupplementsModal,
  onQuickLogStaple,
  onSaveSlotAsStaple,
  onLogDailyStack,
  onSetRideBottleSize,
  onReorderTimeline,
  onDeleteMealSlot,
  onAddMealSlot,
  onResetDayMeals,
  onDeleteLog,
  onLogOnBike,
  onSaveOnBikeLog,
  onCompleteRide,
  onSaveSession,
  onDeleteSession,
  onNavigateTab,
}) {
  // Bottle size default vs this-ride-only toggle
  const [bottleAsDefault, setBottleAsDefault] = useState(true);

  // Per-workout Complete / Edit form state (keyed by slot.slot)
  const [editingActualSlot, setEditingActualSlot] = useState(null);
  const [actualKjInput, setActualKjInput] = useState(0);
  const [actualKcalInput, setActualKcalInput] = useState(0);
  const [actualMinInput, setActualMinInput] = useState(60);
  const [actualRideCarbsInput, setActualRideCarbsInput] = useState(0);
  const [actualRideProteinInput, setActualRideProteinInput] = useState(0);
  const [actualRideFatInput, setActualRideFatInput] = useState(0);
  const [actualRideSodiumInput, setActualRideSodiumInput] = useState(0);
  const [completeScannedItems, setCompleteScannedItems] = useState([]);
  const [syncRideCarbsOnComplete, setSyncRideCarbsOnComplete] = useState(true);

  // Per-workout Inline Actual On-Bike Fuel editor state
  const [editingOnBikeSlot, setEditingOnBikeSlot] = useState(null);
  const [editingOnBikeId, setEditingOnBikeId] = useState(null);
  const [onBikeCarbsInput, setOnBikeCarbsInput] = useState(0);
  const [onBikeProteinInput, setOnBikeProteinInput] = useState(0);
  const [onBikeFatInput, setOnBikeFatInput] = useState(0);
  const [onBikeSodiumInput, setOnBikeSodiumInput] = useState(0);
  const [onBikeBottlesInput, setOnBikeBottlesInput] = useState(1);
  const [onBikeScannedItems, setOnBikeScannedItems] = useState([]);

  // Direct barcode scanner inside ride fuel editors ('onbike' | 'complete' | null)
  const [rideScannerTarget, setRideScannerTarget] = useState(null);

  // Expandable Suggested Meal per slot (hidden by default so meal cards stay clean!)
  const [openSuggestionSlot, setOpenSuggestionSlot] = useState(null);

  // Inline "+ Add Meal / Snack" customizer state
  const [addingMeal, setAddingMeal] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [newMealSize, setNewMealSize] = useState('snack');
  const [newMealPos, setNewMealPos] = useState(1);

  // Inline "+ Add Workout" state (Gym, 2nd Ride, Run, Yoga, etc.)
  const [addingWorkout, setAddingWorkout] = useState(false);
  const [newWTitle, setNewWTitle] = useState('Gym / Strength');
  const [newWSport, setNewWSport] = useState('WeightTraining');
  const [newWDuration, setNewWDuration] = useState(45);
  const [newWIntensity, setNewWIntensity] = useState('endurance');
  const [newWKj, setNewWKj] = useState(900);
  const [newWKcal, setNewWKcal] = useState(270);
  const [newWTiming, setNewWTiming] = useState('morning');
  const [newWStatus, setNewWStatus] = useState('completed');

  // Pointer-based drag-and-drop timeline card reorder state (works on iOS, Android & Desktop)
  const [draggedSlot, setDraggedSlot] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const dragSourceRef = useRef(null);
  const dragTargetRef = useRef(null);

  const totals = sumDailyLogs(logs);
  const remaining = {
    kcal: plan.targets.kcal - totals.kcal,
    carbs: plan.targets.carbs - totals.carbs,
    protein: plan.targets.protein - totals.protein,
    fat: plan.targets.fat - totals.fat,
    carbUncertainty: totals.carbUncertainty,
    kcalUncertainty: totals.kcalUncertainty,
  };

  const pct = (val, target) => Math.min(100, Math.max(0, Math.round((val / Math.max(target, 1)) * 100)));

  const currentOrder = plan.meals.map((m) => m.slot);

  const moveCard = (fromSlot, toIndex) => {
    const order = [...currentOrder];
    const fromIndex = order.indexOf(fromSlot);
    if (fromIndex < 0 || toIndex < 0 || toIndex >= order.length || fromIndex === toIndex) return;
    order.splice(fromIndex, 1);
    order.splice(toIndex, 0, fromSlot);
    onReorderTimeline(plan.date, order);
  };

  const finishPointerDrag = () => {
    const src = dragSourceRef.current;
    const tgt = dragTargetRef.current;
    if (src && tgt && src !== tgt) {
      const targetIdx = currentOrder.indexOf(tgt);
      moveCard(src, targetIdx);
    }
    dragSourceRef.current = null;
    dragTargetRef.current = null;
    setDraggedSlot(null);
    setDragOverSlot(null);
  };

  const openOnBikeEditor = (slot, entry = null) => {
    const wp = slot.workout?.onBikePlan;
    const existing = entry || logs.find((l) => l.slot === slot.slot && l.type === 'on_bike') || null;
    setEditingOnBikeId(existing?.id || null);
    setOnBikeCarbsInput(existing?.carbs ?? wp?.totalCarbs ?? 0);
    setOnBikeProteinInput(existing?.protein ?? 0);
    setOnBikeFatInput(existing?.fat ?? 0);
    setOnBikeSodiumInput(existing?.micros?.sodium ?? wp?.totalSodiumMg ?? 0);
    setOnBikeBottlesInput(existing?.bottles ?? wp?.bottles ?? 1);
    setOnBikeScannedItems([]);
    setEditingOnBikeSlot(slot.slot);
  };

  const handleScannedRideProduct = (food) => {
    const f = (Number(food.grams) || 100) / 100;
    const p100 = food.per100g || {};
    const addC = Math.round((p100.carbs || 0) * f);
    const addP = Math.round((p100.protein || 0) * f);
    const addF = Math.round((p100.fat || 0) * f);
    const addNa = Math.round((p100.sodium || 0) * f);
    const label = `${formatFoodAmount(food.grams, units)} ${food.name} (+${addC}C${addP > 0 ? ` · +${addP}P` : ''}${addF > 0 ? ` · +${addF}F` : ''})`;

    if (rideScannerTarget === 'complete') {
      setActualRideCarbsInput((v) => (Number(v) || 0) + addC);
      setActualRideProteinInput((v) => (Number(v) || 0) + addP);
      setActualRideFatInput((v) => (Number(v) || 0) + addF);
      setActualRideSodiumInput((v) => (Number(v) || 0) + addNa);
      setCompleteScannedItems((prev) => [...prev, label]);
    } else if (rideScannerTarget === 'onbike') {
      setOnBikeCarbsInput((v) => (Number(v) || 0) + addC);
      setOnBikeProteinInput((v) => (Number(v) || 0) + addP);
      setOnBikeFatInput((v) => (Number(v) || 0) + addF);
      setOnBikeSodiumInput((v) => (Number(v) || 0) + addNa);
      setOnBikeScannedItems((prev) => [...prev, label]);
    }
    setRideScannerTarget(null);
  };

  const handleSaveOnBikeCustom = (e, slot) => {
    e.preventDefault();
    const workout = slot.workout;
    const wp = workout?.onBikePlan;
    const carbs = Math.max(0, Math.round(Number(onBikeCarbsInput) || 0));
    const protein = Math.max(0, Math.round(Number(onBikeProteinInput) || 0));
    const fat = Math.max(0, Math.round(Number(onBikeFatInput) || 0));
    const sodiumMg = Math.max(0, Math.round(Number(onBikeSodiumInput) || 0));
    const bottles = Math.max(0, Number(onBikeBottlesInput) || 0);
    onSaveOnBikeLog({
      existingId: editingOnBikeId,
      slotId: slot.slot,
      carbs,
      protein,
      fat,
      sodiumMg,
      bottles,
      bottleLabel: wp?.bottleLabel || formatLiquid(profile?.defaultBottleMl || 650, units),
      scannedItems: onBikeScannedItems,
      durationMin: workout?.durationMin || 0,
      plannedCarbs: wp?.totalCarbs || 0,
    });
    setEditingOnBikeSlot(null);
    setEditingOnBikeId(null);
    setOnBikeScannedItems([]);
  };

  const handleSaveCompletedWorkout = (e, slot) => {
    e.preventDefault();
    const workout = slot.workout;
    const wp = workout?.onBikePlan;
    const isRide = workout?.sportKind === 'ride';
    const kj = isRide ? Math.max(0, Number(actualKjInput) || 0) : 0;
    const kcal = !isRide ? Math.max(0, Number(actualKcalInput) || 0) : 0;
    const mins = Math.max(0, Number(actualMinInput) || 0);
    onCompleteRide(plan.date, kj, mins, workout?.id, kcal);
    if (wp && syncRideCarbsOnComplete) {
      const existing = logs.find((l) => l.slot === slot.slot && l.type === 'on_bike') || null;
      onSaveOnBikeLog({
        existingId: existing?.id || null,
        slotId: slot.slot,
        carbs: Math.max(0, Math.round(Number(actualRideCarbsInput) || 0)),
        protein: Math.max(0, Math.round(Number(actualRideProteinInput) || 0)),
        fat: Math.max(0, Math.round(Number(actualRideFatInput) || 0)),
        sodiumMg: Math.max(0, Math.round(Number(actualRideSodiumInput) || 0)),
        bottles: existing?.bottles ?? wp?.bottles ?? 1,
        bottleLabel: wp?.bottleLabel || formatLiquid(profile?.defaultBottleMl || 650, units),
        scannedItems: completeScannedItems,
        durationMin: mins,
        plannedCarbs: wp?.totalCarbs || 0,
        silent: true,
      });
    }
    setEditingActualSlot(null);
    setCompleteScannedItems([]);
  };

  const microsList = [
    { key: 'iron', label: 'Iron', unit: 'mg', val: totals.micros.iron, target: plan.microTargets.iron },
    { key: 'vitC', label: 'Vit C', unit: 'mg', val: totals.micros.vitC, target: plan.microTargets.vitC },
    { key: 'calcium', label: 'Calcium', unit: 'mg', val: totals.micros.calcium, target: plan.microTargets.calcium },
    { key: 'vitD', label: 'Vit D', unit: 'µg', val: totals.micros.vitD, target: plan.microTargets.vitD },
    { key: 'magnesium', label: 'Magnesium', unit: 'mg', val: totals.micros.magnesium, target: plan.microTargets.magnesium },
    { key: 'sodium', label: 'Sodium', unit: 'mg', val: totals.micros.sodium, target: plan.microTargets.sodium },
    { key: 'fiber', label: 'Fiber', unit: 'g', val: totals.micros.fiber, target: plan.microTargets.fiber },
  ];

  const sodiumRemainingMg = Math.max(0, plan.microTargets.sodium - totals.micros.sodium);
  const dailyStack = supplements.filter((s) => s.inDailyStack);
  const loggedSuppEntries = logs.filter((l) => l.type === 'supplement');
  const loggedSuppIds = new Set(loggedSuppEntries.map((l) => l.supplementId));
  const unloggedDailyStack = dailyStack.filter((s) => !loggedSuppIds.has(s.id));

  const formatLeftLabel = (diff) => (diff >= 0 ? `${diff}g left` : `+${Math.abs(diff)}g over`);

  // Count non-workout meals (for guarding last meal deletion)
  const mealOnlySlots = plan.meals.filter((m) => !m.isWorkout);
  const mealCount = mealOnlySlots.length;

  // Build quick placement dropdown options for ANY workout slot
  const getPlacementOptionsForSlot = (targetSlotId) => {
    const others = plan.meals.filter((m) => m.slot !== targetSlotId);
    const firstLabel = others[0]?.baseLabel || others[0]?.label || 'First Card';
    return {
      othersOrder: others.map((m) => m.slot),
      currentIdx: currentOrder.indexOf(targetSlotId),
      options: [
        { idx: 0, label: `Before ${firstLabel} (Top)` },
        ...others.map((m, i) => ({
          idx: i + 1,
          label: `After ${m.isWorkout ? m.workout?.title || m.label : m.baseLabel || m.label}`,
        })),
      ],
    };
  };

  const handleSelectWorkoutPlacement = (targetSlotId, targetIdx) => {
    const othersOrder = currentOrder.filter((id) => id !== targetSlotId);
    const next = [...othersOrder];
    next.splice(Math.min(Math.max(0, Number(targetIdx)), next.length), 0, targetSlotId);
    onReorderTimeline(plan.date, next);
  };

  const handleSubmitNewMeal = (e) => {
    e.preventDefault();
    if (!newMealName.trim() || !onAddMealSlot) return;
    onAddMealSlot(plan.date, {
      label: newMealName.trim(),
      size: newMealSize,
      insertIndex: Number(newMealPos),
    });
    setNewMealName('');
    setNewMealSize('snack');
    setAddingMeal(false);
  };

  const newWSportKind = normalizeSportKind(newWSport, newWTitle);
  const isNewWRide = newWSportKind === 'ride';

  const handleSubmitNewWorkout = (e) => {
    e.preventDefault();
    if (!newWTitle.trim() || !onSaveSession) return;
    const dur = Math.max(5, Number(newWDuration) || 45);
    const kj = isNewWRide ? Math.max(0, Number(newWKj) || 0) : 0;
    const kcal = !isNewWRide ? Math.max(0, Number(newWKcal) || 0) : 0;
    onSaveSession({
      id: `manual-${plan.date}-${Date.now()}`,
      date: plan.date,
      title: newWTitle.trim(),
      sport: newWSport,
      intensity: newWIntensity,
      durationMin: dur,
      plannedKj: kj,
      actualKj: newWStatus === 'completed' ? kj : 0,
      plannedKcal: kcal,
      actualKcal: newWStatus === 'completed' ? kcal : 0,
      timing: newWTiming,
      status: newWStatus,
      source: 'manual',
    });
    setAddingWorkout(false);
  };

  return (
    <>
      {/* Modern Hero Daily Telemetry Fuel Card */}
      <section className="card-carbon" aria-label="Daily Fuel Target">
        <div className="hero-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className={`carb-badge-dark ${plan.categoryMeta.color}`}>
                <Flame size={12} /> {plan.categoryMeta.badge} CARB · {plan.categoryMeta.label}
              </span>
              <button
                type="button"
                className="hero-goal-pill"
                onClick={() => onNavigateTab('body')}
                style={{ cursor: 'pointer' }}
              >
                {plan.plannedDeficit > 40
                  ? `Cut -${plan.plannedDeficit}`
                  : plan.plannedDeficit < -40
                  ? `Load +${Math.abs(plan.plannedDeficit)}`
                  : 'Fuel 100%'}
              </button>
            </div>
            <div className="hero-kcal mono">
              {remaining.kcal >= 0 ? (
                <>
                  {remaining.kcal.toLocaleString()}
                  <span style={{ fontSize: '0.96rem', fontWeight: 600, color: 'rgba(248,247,244,0.62)' }}>
                    {' '}kcal left
                  </span>
                </>
              ) : (
                <>
                  <span style={{ color: '#FBD07E' }}>+{Math.abs(remaining.kcal).toLocaleString()}</span>
                  <span style={{ fontSize: '0.96rem', fontWeight: 600, color: 'rgba(248,247,244,0.62)' }}>
                    {' '}kcal over
                  </span>
                </>
              )}
            </div>
            <div className="hero-kcal-sub mono">
              {totals.kcal.toLocaleString()} / {plan.targets.kcal.toLocaleString()} kcal eaten
              {totals.hasEstimates && (
                <span style={{ color: '#FBD07E' }}> · ±{totals.kcalUncertainty} est</span>
              )}
            </div>
          </div>

          <CalorieRing eaten={totals.kcal} target={plan.targets.kcal} />
        </div>

        <div className="macro-bars">
          <div className="macro-bar-box">
            <div className="macro-bar-head">
              <span className="macro-bar-name">Carbs</span>
              <span className="macro-bar-gkg mono">{plan.targets.carbsPerKg}g/kg</span>
            </div>
            <div
              className="macro-bar-left mono"
              style={{ color: remaining.carbs >= 0 ? '#5BF0B2' : '#FBD07E' }}
            >
              {formatLeftLabel(remaining.carbs)}
            </div>
            <div className="macro-bar-val mono">
              {totals.carbs}<span>/{plan.targets.carbs}g</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill fill-carb" style={{ width: `${pct(totals.carbs, plan.targets.carbs)}%` }} />
            </div>
          </div>

          <div className="macro-bar-box">
            <div className="macro-bar-head">
              <span className="macro-bar-name">Protein</span>
              <span className="macro-bar-gkg mono">{plan.targets.proteinPerKg}g/kg</span>
            </div>
            <div
              className="macro-bar-left mono"
              style={{ color: remaining.protein >= 0 ? '#7CC8FF' : '#FBD07E' }}
            >
              {formatLeftLabel(remaining.protein)}
            </div>
            <div className="macro-bar-val mono">
              {totals.protein}<span>/{plan.targets.protein}g</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill fill-protein" style={{ width: `${pct(totals.protein, plan.targets.protein)}%` }} />
            </div>
          </div>

          <div className="macro-bar-box">
            <div className="macro-bar-head">
              <span className="macro-bar-name">Fat</span>
              <span className="macro-bar-gkg mono">{plan.targets.fatPerKg}g/kg</span>
            </div>
            <div
              className="macro-bar-left mono"
              style={{ color: remaining.fat >= 0 ? '#FBD07E' : '#FCAFA6' }}
            >
              {formatLeftLabel(remaining.fat)}
            </div>
            <div className="macro-bar-val mono">
              {totals.fat}<span>/{plan.targets.fat}g</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill fill-fat" style={{ width: `${pct(totals.fat, plan.targets.fat)}%` }} />
            </div>
          </div>
        </div>

        <div className="hero-footer">
          <div>{plan.deficitStrategyNote}</div>
          <div className="ea-row">
            <span className={`ea-chip ${plan.energyAvailability < 34 ? 'warn' : ''}`}>
              <ShieldCheck size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {plan.energyAvailability < 34 ? 'Low-Fuel Guard Active' : 'Recovery Fuel: Healthy'}
            </span>
            <span className="mono" style={{ fontSize: '0.68rem', color: 'rgba(248,247,244,0.66)' }}>
              Off-bike ({plan.nonExerciseHours}h): {plan.offBikeTdee} kcal
            </span>
          </div>
        </div>
      </section>

      {/* Water Weight Notice from Withings Scale */}
      {biometricsSummary.glycogenNotice && (
        <div className="notice-strip">
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{biometricsSummary.glycogenNotice}</div>
        </div>
      )}

      {/* Compact Rest Day Card (ONLY when there are zero workouts today) */}
      {(!plan.workouts || plan.workouts.length === 0) && (
        <section className="card" aria-label="Rest Day Summary">
          <div className="session-card-head">
            <div>
              <div className="section-kicker" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Bike size={13} /> Recovery / Rest Day
              </div>
              <h2 className="session-title" style={{ marginTop: 3 }}>
                Rest &amp; Mobility Day
              </h2>
              <div className="session-meta mono">0 kcal training · Smart fat-loss &amp; muscle repair</div>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setAddingMeal(false);
                setAddingWorkout(true);
              }}
            >
              + Add Workout
            </button>
          </div>
        </section>
      )}

      {/* Draggable & Fully Customizable Daily Timeline (Multiple Workouts + Meals) */}
      <section aria-label="Meal Plan and Training Timeline">
        <div className="section-header" style={{ padding: '0 2px', flexWrap: 'wrap', gap: 6 }}>
          <div>
            <h2 className="section-title">Daily Fuel &amp; Training Timeline</h2>
            <span className="section-kicker">
              {plan.workouts?.length > 1
                ? `${plan.workouts.length} workouts today · Drag cards to reorder`
                : 'Drag to reorder · Skip or add meals & workouts'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            {isDayCustomized && onResetDayMeals && (
              <button
                type="button"
                className="btn btn-sm"
                style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                onClick={() => onResetDayMeals(plan.date)}
                title="Restore default Breakfast, Lunch, Snack & Dinner"
              >
                <RotateCcw size={12} /> Reset meals
              </button>
            )}
            {onSaveSession && (
              <button
                type="button"
                className="btn btn-sm"
                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                onClick={() => {
                  setAddingMeal(false);
                  setAddingWorkout((v) => !v);
                }}
              >
                <Dumbbell size={12} /> + Workout
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-soft"
              style={{ padding: '4px 9px', fontSize: '0.72rem' }}
              onClick={() => {
                setAddingWorkout(false);
                setNewMealPos(Math.min(1, plan.meals.length));
                setAddingMeal((v) => !v);
              }}
            >
              <Plus size={13} /> Add Meal
            </button>
          </div>
        </div>

        {/* Inline "+ Add Workout" Card (Gym, 2nd Ride, Run, Yoga, etc.) */}
        {addingWorkout && (
          <form
            className="card"
            onSubmit={handleSubmitNewWorkout}
            style={{ marginBottom: 10, borderColor: 'var(--code-med)', padding: 13 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: '0.84rem' }}>Add Workout to Today</span>
              <button type="button" className="icon-btn" onClick={() => setAddingWorkout(false)} aria-label="Close add workout">
                <X size={15} />
              </button>
            </div>

            <div className="chip-row" style={{ marginBottom: 9 }}>
              {QUICK_WORKOUT_PRESETS.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setNewWTitle(preset.title);
                    setNewWSport(preset.sport);
                    setNewWDuration(preset.durationMin);
                    setNewWKcal(preset.kcal);
                    setNewWKj(preset.kj);
                    setNewWTiming(preset.timing);
                    setNewWStatus(preset.status);
                    setNewWIntensity(preset.intensity);
                  }}
                >
                  + {preset.title}
                </button>
              ))}
            </div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="nw-sport">Workout Type</label>
                <select
                  id="nw-sport"
                  className="select"
                  value={newWSport}
                  onChange={(e) => {
                    const nextSport = e.target.value;
                    setNewWSport(nextSport);
                    const k = normalizeSportKind(nextSport, '');
                    if (k === 'strength') setNewWTitle('Gym / Strength');
                    else if (k === 'ride') setNewWTitle('Zone 2 Ride');
                    else if (k === 'run') setNewWTitle('Easy Run');
                    else if (k === 'swim') setNewWTitle('Swim Session');
                  }}
                >
                  {SPORT_OPTIONS.filter((o) => o.kind !== 'rest').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="nw-status">Status</label>
                <select
                  id="nw-status"
                  className="select"
                  value={newWStatus}
                  onChange={(e) => setNewWStatus(e.target.value)}
                >
                  <option value="planned">Scheduled / Planned</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="field full">
                <label htmlFor="nw-title">Workout Name</label>
                <input
                  id="nw-title"
                  className="input"
                  placeholder="e.g., Morning Gym, Evening Intervals"
                  value={newWTitle}
                  onChange={(e) => setNewWTitle(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="nw-dur">Duration (min)</label>
                <NumericInput
                  id="nw-dur"
                  className="input mono"
                  min={5}
                  max={600}
                  fallback={45}
                  value={newWDuration}
                  onChange={setNewWDuration}
                />
              </div>
              {isNewWRide ? (
                <div className="field">
                  <label htmlFor="nw-kj">Power Work (kJ)</label>
                  <NumericInput
                    id="nw-kj"
                    className="input mono"
                    min={0}
                    max={8000}
                    fallback={900}
                    value={newWKj}
                    onChange={setNewWKj}
                  />
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="nw-kcal">Burn (kcal)</label>
                  <NumericInput
                    id="nw-kcal"
                    className="input mono"
                    min={0}
                    max={4000}
                    fallback={270}
                    value={newWKcal}
                    onChange={setNewWKcal}
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="nw-timing">Time of Day</label>
                <select
                  id="nw-timing"
                  className="select"
                  value={newWTiming}
                  onChange={(e) => setNewWTiming(e.target.value)}
                >
                  <option value="morning">Morning</option>
                  <option value="midday">Midday</option>
                  <option value="evening">Afternoon / Evening</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="nw-intensity">Intensity</label>
                <select
                  id="nw-intensity"
                  className="select"
                  value={newWIntensity}
                  onChange={(e) => setNewWIntensity(e.target.value)}
                >
                  {INTENSITY_OPTIONS.filter((o) => o.value !== 'rest').map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="submit" className="btn btn-accent btn-sm" style={{ flex: 1 }} disabled={!newWTitle.trim()}>
                <Plus size={14} /> Add Workout &amp; Recalculate Day
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setAddingWorkout(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {addingMeal && (
          <form
            className="card"
            onSubmit={handleSubmitNewMeal}
            style={{ marginBottom: 10, borderColor: 'var(--code-high)', padding: 13 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: '0.84rem' }}>Add a Meal or Snack</span>
              <button type="button" className="icon-btn" onClick={() => setAddingMeal(false)} aria-label="Close add meal">
                <X size={15} />
              </button>
            </div>

            <div className="chip-row" style={{ marginBottom: 9 }}>
              {QUICK_CUSTOM_MEALS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setNewMealName(preset.label);
                    setNewMealSize(preset.size);
                  }}
                >
                  + {preset.label}
                </button>
              ))}
            </div>

            <div className="field-grid">
              <div className="field full">
                <label htmlFor="new-meal-name">Meal or Snack Name</label>
                <input
                  id="new-meal-name"
                  className="input"
                  placeholder="e.g., Mid-Morning Snack, Second Lunch, Late Recovery"
                  value={newMealName}
                  onChange={(e) => setNewMealName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="new-meal-size">Macro Share</label>
                <select
                  id="new-meal-size"
                  className="select"
                  value={newMealSize}
                  onChange={(e) => setNewMealSize(e.target.value)}
                >
                  <option value="snack">Snack (lighter share)</option>
                  <option value="meal">Full Meal (standard share)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="new-meal-pos">Place in Timeline</label>
                <select
                  id="new-meal-pos"
                  className="select"
                  value={newMealPos}
                  onChange={(e) => setNewMealPos(Number(e.target.value))}
                >
                  <option value={0}>At the top (first)</option>
                  {plan.meals.map((m, mIdx) => (
                    <option key={m.slot} value={mIdx + 1}>
                      After {m.isWorkout ? m.workout?.title || m.label : m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="submit" className="btn btn-accent btn-sm" style={{ flex: 1 }} disabled={!newMealName.trim()}>
                <Plus size={14} /> Add &amp; Rebalance Day
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setAddingMeal(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="meal-list">
          {plan.meals.map((slot, idx) => {
            const slotLogs = logs.filter((l) => l.slot === slot.slot);
            const isWorkout = Boolean(slot.isWorkout);
            const workout = slot.workout || null;
            const wPlan = workout?.onBikePlan || null;
            const isRide = workout?.sportKind === 'ride';
            const existingWorkoutFuelLog = slotLogs.find((l) => l.type === 'on_bike') || null;
            const hasAnyWorkoutFuelLog = slotLogs.length > 0;
            const loggedWorkoutCarbs = slotLogs.reduce((sum, l) => sum + (Number(l.carbs) || 0), 0);
            const codeClass = slot.carbCode.toLowerCase();
            const isDragging = draggedSlot === slot.slot;
            const isDragOver = dragOverSlot === slot.slot && draggedSlot !== slot.slot;
            const canSaveAsStaple =
              !isWorkout && slotLogs.length > 0 && slotLogs.some((l) => l.type === 'food' && l.ingredient);
            const onBikeDelta = isWorkout && wPlan ? (Number(onBikeCarbsInput) || 0) - wPlan.totalCarbs : 0;
            const suggestionOpen = !isWorkout && openSuggestionSlot === slot.slot;
            const suggestion = suggestionOpen
              ? suggestMealForSlot(slot, staples, plan.category, slot.slot === 'dinner' || slot.isLastMeal ? remaining : null)
              : null;
            const isEditingActualHere = editingActualSlot === slot.slot;
            const isEditingOnBikeHere = editingOnBikeSlot === slot.slot;
            const placementMeta = isWorkout ? getPlacementOptionsForSlot(slot.slot) : null;
            const cardAccessibleName = isWorkout
              ? slot.slot === 'on_bike'
                ? 'Training'
                : workout?.title || slot.label
              : slot.label;

            return (
              <div
                key={slot.slot}
                data-slot={slot.slot}
                className={`meal-slot ${isWorkout ? 'training-card' : `code-${codeClass}`} ${
                  isDragging ? 'dragging' : ''
                } ${isDragOver ? 'drag-over' : ''}`}
              >
                {/* Card Header with Pointer Drag Handle (iOS, Android & Desktop), Reorder & Remove */}
                <div className="meal-slot-head">
                  <div className="meal-slot-title-group">
                    <span
                      className="drag-handle"
                      role="button"
                      tabIndex={0}
                      aria-label={`Drag ${cardAccessibleName} card to reorder`}
                      title="Drag card to reorder"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.currentTarget.setPointerCapture?.(e.pointerId);
                        dragSourceRef.current = slot.slot;
                        dragTargetRef.current = slot.slot;
                        setDraggedSlot(slot.slot);
                        setDragOverSlot(slot.slot);
                      }}
                      onPointerMove={(e) => {
                        if (!dragSourceRef.current) return;
                        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-slot]');
                        const hovered = el?.getAttribute('data-slot');
                        if (hovered && hovered !== dragTargetRef.current) {
                          dragTargetRef.current = hovered;
                          setDragOverSlot(hovered);
                        }
                      }}
                      onPointerUp={() => finishPointerDrag()}
                      onPointerCancel={() => finishPointerDrag()}
                    >
                      <GripVertical size={16} />
                    </span>
                    {isWorkout && <WorkoutSportIcon sportKind={workout?.sportKind} size={16} />}
                    <span className="meal-slot-name">
                      {isWorkout ? workout?.title || 'Training Session' : slot.label}
                    </span>
                    {isWorkout ? (
                      <span
                        className={`carb-badge ${workout?.status === 'completed' ? 'high' : 'low'}`}
                        style={{ fontSize: '0.6rem', padding: '2px 6px' }}
                      >
                        {workout?.status === 'completed' ? 'Completed' : 'Scheduled'}
                      </span>
                    ) : (
                      <span className={`carb-badge ${codeClass}`}>{slot.carbCode}</span>
                    )}
                  </div>

                  <div className="reorder-controls">
                    <button
                      type="button"
                      className="reorder-btn"
                      disabled={idx === 0}
                      onClick={() => moveCard(slot.slot, idx - 1)}
                      aria-label={`Move ${cardAccessibleName} up`}
                      title="Move up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="reorder-btn"
                      disabled={idx === plan.meals.length - 1}
                      onClick={() => moveCard(slot.slot, idx + 1)}
                      aria-label={`Move ${cardAccessibleName} down`}
                      title="Move down"
                    >
                      <ArrowDown size={13} />
                    </button>
                    {!isWorkout && onDeleteMealSlot && (
                      <button
                        type="button"
                        className="reorder-btn"
                        disabled={mealCount <= 1}
                        onClick={() => onDeleteMealSlot(plan.date, slot.slot, slot.label)}
                        aria-label={`Remove ${slot.label} meal slot`}
                        title={
                          mealCount <= 1
                            ? 'Keep at least one meal for the day'
                            : `Skip / remove ${slot.label} (macros redistribute to remaining meals)`
                        }
                      >
                        <X size={13} />
                      </button>
                    )}
                    {isWorkout && onDeleteSession && workout?.id && (
                      <button
                        type="button"
                        className="reorder-btn"
                        onClick={() => onDeleteSession(workout.id, workout.title)}
                        aria-label={`Remove ${workout.title} workout`}
                        title={`Remove ${workout.title}`}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* WORKOUT CARD BODY (Ride with On-Bike Fueling OR Gym / Run / Swim / Yoga) */}
                {isWorkout && workout ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div className="session-meta mono" style={{ margin: 0 }}>
                        {isRide
                          ? `${workout.durationMin} min · ${workout.kj} kJ (~${workout.kcal} kcal burned)`
                          : `${workout.sportLabel} · ${workout.durationMin} min · ~${workout.kcal} kcal burned`}
                        {workout.source === 'intervals.icu' && workout.status === 'completed' && (
                          <span className="carb-badge high" style={{ fontSize: '0.58rem', padding: '2px 6px', marginLeft: 6 }}>
                            Auto-pulled
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        {hasIntervalsConnected && onResyncNow && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={onResyncNow}
                            disabled={bgSyncing}
                            title="Pull latest completed & scheduled workouts from Intervals.icu"
                          >
                            <RefreshCw size={13} className={bgSyncing ? 'spin' : ''} />
                          </button>
                        )}
                        <button
                          type="button"
                          className={`btn btn-sm ${workout.status === 'completed' ? 'btn-soft' : 'btn-primary'}`}
                          onClick={() => {
                            if (isEditingActualHere) {
                              setEditingActualSlot(null);
                              return;
                            }
                            setActualKjInput(workout.actualKj || workout.kj || 0);
                            setActualKcalInput(workout.actualKcal || workout.kcal || 0);
                            setActualMinInput(workout.durationMin || 60);
                            setActualRideCarbsInput(
                              existingWorkoutFuelLog?.carbs ?? workout.carbsIngested ?? wPlan?.totalCarbs ?? 0
                            );
                            setActualRideProteinInput(existingWorkoutFuelLog?.protein ?? 0);
                            setActualRideFatInput(existingWorkoutFuelLog?.fat ?? 0);
                            setActualRideSodiumInput(
                              existingWorkoutFuelLog?.micros?.sodium ?? wPlan?.totalSodiumMg ?? 0
                            );
                            setCompleteScannedItems([]);
                            setEditingActualSlot(slot.slot);
                          }}
                        >
                          <CheckCircle2 size={14} />
                          {workout.status === 'completed'
                            ? isRide
                              ? 'Edit Ride'
                              : 'Edit Workout'
                            : 'Complete'}
                        </button>
                      </div>
                    </div>

                    {/* Quick Placement Selector for This Workout Card */}
                    {placementMeta && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          marginTop: 9,
                        }}
                      >
                        <label
                          htmlFor={`training-placement-${slot.slot}`}
                          style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-secondary)', whiteSpace: 'nowrap' }}
                        >
                          Workout placement:
                        </label>
                        <select
                          id={`training-placement-${slot.slot}`}
                          className="select"
                          style={{ padding: '5px 9px', fontSize: '0.75rem', fontWeight: 700, maxWidth: 220 }}
                          value={placementMeta.currentIdx}
                          onChange={(e) => handleSelectWorkoutPlacement(slot.slot, Number(e.target.value))}
                        >
                          {placementMeta.options.map((opt) => (
                            <option key={opt.idx} value={opt.idx}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Per-Workout Complete / Edit Form */}
                    {isEditingActualHere && (
                      <form
                        onSubmit={(e) => handleSaveCompletedWorkout(e, slot)}
                        style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-hairline)' }}
                      >
                        <div className="field-grid">
                          {isRide ? (
                            <div className="field">
                              <label htmlFor={`actual-kj-${slot.slot}`}>Actual Power Work (kJ)</label>
                              <NumericInput
                                id={`actual-kj-${slot.slot}`}
                                className="input mono"
                                value={actualKjInput}
                                onChange={setActualKjInput}
                                min={0}
                                max={8000}
                                fallback={0}
                              />
                            </div>
                          ) : (
                            <div className="field">
                              <label htmlFor={`actual-kcal-${slot.slot}`}>Actual Burn (kcal)</label>
                              <NumericInput
                                id={`actual-kcal-${slot.slot}`}
                                className="input mono"
                                value={actualKcalInput}
                                onChange={setActualKcalInput}
                                min={0}
                                max={4000}
                                fallback={0}
                              />
                            </div>
                          )}
                          <div className="field">
                            <label htmlFor={`actual-min-${slot.slot}`}>Duration (min)</label>
                            <NumericInput
                              id={`actual-min-${slot.slot}`}
                              className="input mono"
                              value={actualMinInput}
                              onChange={setActualMinInput}
                              min={0}
                              max={720}
                              fallback={45}
                            />
                          </div>

                          {wPlan && (
                            <>
                              <div className="field full" style={{ marginTop: 2 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <label htmlFor={`actual-ride-carbs-${slot.slot}`} style={{ margin: 0 }}>
                                    Actual Ride Carbs (g){' '}
                                    <span style={{ fontWeight: 500, color: 'var(--ink-muted)' }}>
                                      (plan: {wPlan.totalCarbs}g)
                                    </span>
                                  </label>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-soft"
                                    style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                                    onClick={() => setRideScannerTarget('complete')}
                                  >
                                    <ScanBarcode size={13} /> Scan Bar / Gel
                                  </button>
                                </div>
                                <NumericInput
                                  id={`actual-ride-carbs-${slot.slot}`}
                                  className="input mono"
                                  value={actualRideCarbsInput}
                                  onChange={setActualRideCarbsInput}
                                  min={0}
                                  max={1000}
                                  fallback={0}
                                />
                              </div>

                              <div className="field">
                                <label htmlFor={`actual-ride-prot-${slot.slot}`}>Ride Protein (g)</label>
                                <NumericInput
                                  id={`actual-ride-prot-${slot.slot}`}
                                  className="input mono"
                                  value={actualRideProteinInput}
                                  onChange={setActualRideProteinInput}
                                  min={0}
                                  max={200}
                                  fallback={0}
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`actual-ride-fat-${slot.slot}`}>Ride Fat (g)</label>
                                <NumericInput
                                  id={`actual-ride-fat-${slot.slot}`}
                                  className="input mono"
                                  value={actualRideFatInput}
                                  onChange={setActualRideFatInput}
                                  min={0}
                                  max={200}
                                  fallback={0}
                                />
                              </div>
                            </>
                          )}
                        </div>

                        {wPlan && completeScannedItems.length > 0 && (
                          <div className="chip-row" style={{ marginTop: 8 }}>
                            {completeScannedItems.map((item, sIdx) => (
                              <span
                                key={`${item}-${sIdx}`}
                                className="chip mono"
                                style={{ fontSize: '0.68rem', background: 'var(--code-high-bg)', color: 'var(--code-high)', borderColor: 'transparent' }}
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        )}

                        {wPlan && (
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 7,
                              marginTop: 8,
                              fontSize: '0.75rem',
                              color: 'var(--ink-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={syncRideCarbsOnComplete}
                              onChange={(e) => setSyncRideCarbsOnComplete(e.target.checked)}
                            />
                            Log actual on-bike fuel &amp; recalculate what&apos;s left today
                          </label>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button type="submit" className="btn btn-accent btn-sm" style={{ flex: 1 }}>
                            Save &amp; Recalculate Remaining Meals
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => setEditingActualSlot(null)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* RIDE / ENDURANCE FUELING DETAILS vs NON-RIDE (GYM / SWIM / YOGA) DETAILS */}
                    {wPlan ? (
                      <>
                        {/* Prominent Prescribed On-Bike Numbers */}
                        <div className="on-bike-grid">
                          <div className="mini-stat" style={{ background: 'rgba(255,255,255,0.82)' }}>
                            <div className="mini-stat-label">Planned Rate</div>
                            <div className="mini-stat-val mono" style={{ color: 'var(--code-high)' }}>
                              {wPlan.carbsPerHour} g/h
                            </div>
                          </div>
                          <div className="mini-stat" style={{ background: 'rgba(255,255,255,0.82)' }}>
                            <div className="mini-stat-label">
                              {hasAnyWorkoutFuelLog ? 'Actual / Plan' : 'Planned Carbs'}
                            </div>
                            <div className="mini-stat-val mono">
                              {hasAnyWorkoutFuelLog
                                ? `${loggedWorkoutCarbs} / ${wPlan.totalCarbs}g`
                                : `${wPlan.totalCarbs} g`}
                            </div>
                          </div>
                          <div className="mini-stat" style={{ background: 'rgba(255,255,255,0.82)' }}>
                            <div className="mini-stat-label">Bottles</div>
                            <div className="mini-stat-val mono">
                              {wPlan.bottles}× {wPlan.bottleLabel}
                            </div>
                          </div>
                        </div>

                        {/* Bottle Size Selector (Default for all rides OR This ride only) */}
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
                              Bottle size:
                            </span>
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button
                                type="button"
                                className="chip"
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '0.66rem',
                                  ...(bottleAsDefault
                                    ? { background: 'var(--code-high)', color: '#fff', borderColor: 'var(--code-high)' }
                                    : {}),
                                }}
                                onClick={() => setBottleAsDefault(true)}
                              >
                                Save as default
                              </button>
                              <button
                                type="button"
                                className="chip"
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '0.66rem',
                                  ...(!bottleAsDefault
                                    ? { background: 'var(--bg-carbon)', color: '#fff', borderColor: 'var(--bg-carbon)' }
                                    : {}),
                                }}
                                onClick={() => setBottleAsDefault(false)}
                              >
                                This ride only
                              </button>
                            </div>
                          </div>
                          <div className="chip-row" role="group" aria-label="Ride bottle size">
                            {BOTTLE_SIZE_OPTIONS.map((ml) => {
                              const active = wPlan.bottleSizeMl === ml;
                              return (
                                <button
                                  key={ml}
                                  type="button"
                                  className="chip mono"
                                  style={{
                                    padding: '4px 9px',
                                    fontSize: '0.72rem',
                                    ...(active
                                      ? { background: 'var(--bg-carbon)', color: '#fff', borderColor: 'var(--bg-carbon)' }
                                      : {}),
                                  }}
                                  onClick={() => onSetRideBottleSize(plan.date, ml, bottleAsDefault, workout.id)}
                                >
                                  {formatLiquid(ml, units)}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <p className="muted-text" style={{ marginTop: 8, fontSize: '0.75rem' }}>
                          <Droplets size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                          {wPlan.note}
                        </p>

                        {workout.isPrimaryWorkout && (plan.timingCoaching?.preRideCue || plan.timingCoaching?.postRideCue) && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {plan.timingCoaching.preRideCue && (
                              <p className="muted-text" style={{ fontSize: '0.72rem' }}>
                                <strong>Pre-Ride:</strong> {plan.timingCoaching.preRideCue}
                              </p>
                            )}
                            {plan.timingCoaching.postRideCue && (
                              <p className="muted-text" style={{ fontSize: '0.72rem' }}>
                                <strong>Post-Ride:</strong> {plan.timingCoaching.postRideCue}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      /* NON-RIDE WORKOUT (Gym / Strength / Yoga / Swim / Short Run) */
                      <>
                        <div className="on-bike-grid">
                          <div className="mini-stat" style={{ background: 'rgba(255,255,255,0.82)' }}>
                            <div className="mini-stat-label">Type</div>
                            <div className="mini-stat-val" style={{ fontSize: '0.84rem' }}>
                              {workout.sportLabel}
                            </div>
                          </div>
                          <div className="mini-stat" style={{ background: 'rgba(255,255,255,0.82)' }}>
                            <div className="mini-stat-label">Duration</div>
                            <div className="mini-stat-val mono">{workout.durationMin} min</div>
                          </div>
                          <div className="mini-stat" style={{ background: 'rgba(255,255,255,0.82)' }}>
                            <div className="mini-stat-label">Burn Added</div>
                            <div className="mini-stat-val mono" style={{ color: 'var(--code-med)' }}>
                              +{workout.kcal} kcal
                            </div>
                          </div>
                        </div>
                        <p className="muted-text" style={{ marginTop: 8, fontSize: '0.75rem' }}>
                          {workout.fuelNote}
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  /* REGULAR MEAL CARD: Prominent Planned Macros Strip (No meal listed by default!) */
                  <>
                    {slot.isPreloadTarget && (
                      <div
                        className="notice-strip green"
                        style={{ marginTop: 8, marginBottom: 0, padding: '8px 10px', fontSize: '0.74rem' }}
                      >
                        <Zap size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <strong>Tomorrow&apos;s Ride Pre-Load:</strong> Tomorrow is{' '}
                          <strong>{plan.tomorrowTitle || plan.tomorrowCategory}</strong> — tonight&apos;s carbs are
                          boosted so you wake up topped off.
                        </div>
                      </div>
                    )}
                    <div className="planned-macro-grid" aria-label={`Planned macros for ${slot.label}`}>
                      <div className="planned-pill carb">
                        <span className="planned-pill-label">Carbs</span>
                        <span className="planned-pill-num mono">{slot.targetCarbs}g</span>
                      </div>
                      <div className="planned-pill prot">
                        <span className="planned-pill-label">Protein</span>
                        <span className="planned-pill-num mono">{slot.targetProtein}g</span>
                      </div>
                      <div className="planned-pill fat">
                        <span className="planned-pill-label">Fat</span>
                        <span className="planned-pill-num mono">{slot.targetFat}g</span>
                      </div>
                      <div className="planned-pill">
                        <span className="planned-pill-label">Planned</span>
                        <span className="planned-pill-num mono">{slot.targetKcal}</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Logged Items (ONLY rendered once the user actually logs food/fuel) */}
                {slotLogs.length > 0 && (
                  <div className="meal-entries">
                    {slotLogs.map((entry) => (
                      <div className="logged-item" key={entry.id}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="logged-item-title">
                            {entry.title}{' '}
                            {entry.uncertaintyPct > 0 && (
                              <span className="est-tag mono">±{entry.uncertaintyPct}% est</span>
                            )}
                          </div>
                          <div className="logged-item-detail">{entry.detail}</div>
                          <div className="logged-item-macros mono">
                            <span style={{ color: 'var(--macro-carb)' }}>{entry.carbs}g C</span>
                            {(!isWorkout || entry.protein > 0) && (
                              <span style={{ color: 'var(--macro-protein)' }}>{entry.protein}g P</span>
                            )}
                            {(!isWorkout || entry.fat > 0) && (
                              <span style={{ color: 'var(--macro-fat)' }}>{entry.fat}g F</span>
                            )}
                            <span style={{ color: 'var(--ink-muted)' }}>{entry.kcal} kcal</span>
                            {isWorkout && entry.micros?.sodium > 0 && (
                              <span style={{ color: 'var(--ink-secondary)' }}>{entry.micros.sodium}mg Na</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          {isWorkout && wPlan && entry.type === 'on_bike' && (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => openOnBikeEditor(slot, entry)}
                              aria-label="Edit actual ride fuel"
                              title="Modify actual carbs, protein, fat, or sodium consumed"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => onDeleteLog(entry.id)}
                            aria-label={`Remove ${entry.title}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Optional Suggested Meal Drawer (only shown when user taps "Suggested Meal") */}
                {suggestionOpen && suggestion && (
                  <div className="suggestion-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--code-high)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Suggested {slot.label}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', marginTop: 2 }}>
                          {suggestion.staple.name}
                        </div>
                        <div className="muted-text" style={{ fontSize: '0.73rem', marginTop: 2 }}>
                          {suggestion.scaled.resolvedItems
                            .map((i) => `${formatFoodAmount(i.grams, units)} ${i.name}`)
                            .join(' · ')}
                        </div>
                        <div className="mono" style={{ fontSize: '0.73rem', fontWeight: 700, marginTop: 4, color: 'var(--ink-primary)' }}>
                          {suggestion.scaled.carbs}g C · {suggestion.scaled.protein}g P · {suggestion.scaled.fat}g F · {suggestion.scaled.kcal} kcal
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-accent"
                        style={{ flex: 1 }}
                        onClick={() => {
                          onQuickLogStaple(slot, suggestion.staple);
                          setOpenSuggestionSlot(null);
                        }}
                      >
                        <Sparkles size={13} /> Log Suggested
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                          setOpenSuggestionSlot(null);
                          onOpenStapleModal(slot, remaining);
                        }}
                      >
                        Adjust Portions
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Actual On-Bike Fuel Editor (manual Carbs/Protein/Fat/Sodium + barcode scan) */}
                {isWorkout && wPlan && isEditingOnBikeHere && (
                  <form
                    onSubmit={(e) => handleSaveOnBikeCustom(e, slot)}
                    style={{
                      marginTop: 10,
                      padding: 11,
                      borderRadius: 11,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-strong)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>
                        Actual Ride Fuel Consumed
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-accent"
                        style={{ padding: '4px 9px', fontSize: '0.72rem' }}
                        onClick={() => setRideScannerTarget('onbike')}
                      >
                        <ScanBarcode size={13} /> Scan Bar / Gel / Mix
                      </button>
                    </div>

                    {onBikeScannedItems.length > 0 && (
                      <div className="chip-row" style={{ marginBottom: 8 }}>
                        {onBikeScannedItems.map((item, sIdx) => (
                          <span
                            key={`${item}-${sIdx}`}
                            className="chip mono"
                            style={{ fontSize: '0.68rem', background: 'var(--code-high-bg)', color: 'var(--code-high)', borderColor: 'transparent' }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="field-grid">
                      <div className="field">
                        <label htmlFor={`onbike-carbs-${slot.slot}`}>Actual Carbs (g)</label>
                        <NumericInput
                          id={`onbike-carbs-${slot.slot}`}
                          className="input mono"
                          min={0}
                          max={1200}
                          fallback={0}
                          value={onBikeCarbsInput}
                          onChange={setOnBikeCarbsInput}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`onbike-sodium-${slot.slot}`}>Actual Sodium (mg)</label>
                        <NumericInput
                          id={`onbike-sodium-${slot.slot}`}
                          className="input mono"
                          min={0}
                          max={10000}
                          fallback={0}
                          value={onBikeSodiumInput}
                          onChange={setOnBikeSodiumInput}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`onbike-protein-${slot.slot}`}>Protein (g) — bars/mix</label>
                        <NumericInput
                          id={`onbike-protein-${slot.slot}`}
                          className="input mono"
                          min={0}
                          max={200}
                          fallback={0}
                          value={onBikeProteinInput}
                          onChange={setOnBikeProteinInput}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`onbike-fat-${slot.slot}`}>Fat (g) — bars/nuts</label>
                        <NumericInput
                          id={`onbike-fat-${slot.slot}`}
                          className="input mono"
                          min={0}
                          max={200}
                          fallback={0}
                          value={onBikeFatInput}
                          onChange={setOnBikeFatInput}
                        />
                      </div>
                      <div className="field full">
                        <label htmlFor={`onbike-bottles-${slot.slot}`}>
                          Bottles Drunk ({wPlan.bottleLabel})
                        </label>
                        <NumericInput
                          id={`onbike-bottles-${slot.slot}`}
                          className="input mono"
                          min={0}
                          max={12}
                          step={0.5}
                          fallback={1}
                          value={onBikeBottlesInput}
                          onChange={setOnBikeBottlesInput}
                        />
                      </div>
                    </div>

                    <div className="chip-row" style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="chip mono"
                        onClick={() => setOnBikeCarbsInput((v) => Math.max(0, (Number(v) || 0) - 25))}
                      >
                        -25g (1 gel)
                      </button>
                      <button
                        type="button"
                        className="chip mono"
                        onClick={() => setOnBikeCarbsInput((v) => (Number(v) || 0) + 25)}
                      >
                        +25g (1 gel)
                      </button>
                      <button
                        type="button"
                        className="chip mono"
                        onClick={() =>
                          setOnBikeSodiumInput((v) => (Number(v) || 0) + (profile?.electrolyteTabMg || 500))
                        }
                      >
                        +1 tab (+{profile?.electrolyteTabMg || 500}mg Na)
                      </button>
                    </div>

                    <div className="muted-text" style={{ marginTop: 8, fontSize: '0.73rem' }}>
                      Sodium: <strong>{formatSodiumPractical(onBikeSodiumInput, profile?.electrolyteTabMg || 500)}</strong>
                      <br />
                      {onBikeDelta < 0 ? (
                        <span style={{ color: 'var(--code-high)', fontWeight: 700 }}>
                          {Math.abs(onBikeDelta)}g less than planned → +{Math.abs(onBikeDelta)}g carbs added to what&apos;s left for your meals today.
                        </span>
                      ) : onBikeDelta > 0 ? (
                        <span style={{ color: 'var(--code-med)', fontWeight: 700 }}>
                          +{onBikeDelta}g more than planned → remaining meals today trimmed by {onBikeDelta}g carbs.
                        </span>
                      ) : (
                        <span>Matches today&apos;s prescribed ride fuel.</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button type="submit" className="btn btn-accent btn-sm" style={{ flex: 1 }}>
                        Save Actual Ride Fuel
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => setEditingOnBikeSlot(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Card Action Buttons */}
                <div className="meal-actions">
                  {isWorkout ? (
                    wPlan ? (
                      <>
                        {!existingWorkoutFuelLog && (
                          <button
                            type="button"
                            className="btn btn-sm btn-accent"
                            onClick={() => onLogOnBike(slot, wPlan)}
                          >
                            <Zap size={14} /> Log Planned ({slot.targetCarbs}g C)
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => openOnBikeEditor(slot, existingWorkoutFuelLog)}
                        >
                          <Pencil size={13} /> {existingWorkoutFuelLog ? 'Modify Actual' : 'Log Actual / Tweak'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => onOpenQuickFoodModal(slot)}
                        >
                          <ScanBarcode size={14} /> Scan Bar / Gel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onOpenQuickFoodModal(slot)}
                      >
                        <ScanBarcode size={14} /> Log Intra-Workout Shake / Drink
                      </button>
                    )
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-accent"
                        onClick={() => onOpenQuickFoodModal(slot)}
                      >
                        <ScanBarcode size={14} /> Scan / Type
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => onOpenStapleModal(slot, remaining)}
                      >
                        <Scale size={14} />
                        {slot.slot === 'dinner' ? 'Saved Dinner' : 'Saved Meal'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-soft"
                        onClick={() => setOpenSuggestionSlot(suggestionOpen ? null : slot.slot)}
                      >
                        <Lightbulb size={13} /> Suggested Meal
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onOpenWorkModal(slot)}
                      >
                        <Camera size={14} /> Work Meal
                      </button>
                    </>
                  )}
                </div>

                {canSaveAsStaple && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ marginTop: 7, width: '100%', fontSize: '0.74rem' }}
                    onClick={() => onSaveSlotAsStaple(slot, slotLogs)}
                  >
                    <BookmarkPlus size={14} /> Save Logged {slot.label} as Reusable Meal
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!addingMeal && (
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginTop: 10, width: '100%', borderStyle: 'dashed' }}
            onClick={() => {
              setNewMealPos(plan.meals.length);
              setAddingMeal(true);
            }}
          >
            <Plus size={14} /> Add Extra Meal or Snack
          </button>
        )}
      </section>

      {/* Key Endurance Vitamins, Minerals, Practical Sodium & Supplements */}
      <section className="card" aria-label="Key Vitamins and Minerals">
        <div className="section-header">
          <h2 className="section-title">Key Vitamins &amp; Minerals</h2>
          <button
            type="button"
            className="btn btn-sm btn-soft"
            onClick={onOpenSupplementsModal}
          >
            <Pill size={13} /> Supplements
          </button>
        </div>

        <div className="micro-grid">
          {microsList.map((m) => {
            const p = pct(m.val, m.target);
            return (
              <div className="micro-item" key={m.key}>
                <div className="micro-name">{m.label}</div>
                <div className="micro-val mono">
                  {m.val}
                  <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', fontWeight: 500 }}>
                    /{m.target}{m.unit}
                  </span>
                </div>
                <div className="progress-track light" style={{ height: 5 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${p}%`,
                      background: p >= 70 ? 'var(--code-high)' : p >= 35 ? 'var(--code-med)' : 'var(--code-low)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Practical Sodium Helper (Table Salt / Electrolyte Tabs) */}
        <div
          className={`notice-strip ${sodiumRemainingMg <= 150 ? 'green' : 'slate'}`}
          style={{ marginTop: 10, fontSize: '0.76rem' }}
        >
          <Droplets size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            {sodiumRemainingMg <= 150 ? (
              <>
                <strong>Sodium covered:</strong> Today&apos;s logged food &amp; ride drinks already meet your{' '}
                <span className="mono">{plan.microTargets.sodium} mg</span> target — no extra salt needed.
              </>
            ) : (
              <>
                <strong>Sodium left today: {sodiumRemainingMg} mg</strong> ({formatSodiumPractical(sodiumRemainingMg, profile?.electrolyteTabMg || 500)}).
                Scanned packaged foods count automatically — only add extra salt or tabs if your home-cooked meals were unsalted.
              </>
            )}
          </div>
        </div>

        {/* Daily Supplements Quick-Log Bar */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-hairline)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
              Daily Supplements
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {unloggedDailyStack.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-accent"
                  onClick={() => onLogDailyStack(unloggedDailyStack)}
                >
                  <Pill size={13} /> Log Daily Stack ({unloggedDailyStack.length})
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm"
                onClick={onOpenSupplementsModal}
              >
                + Add / Scan
              </button>
            </div>
          </div>

          {loggedSuppEntries.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {loggedSuppEntries.map((entry) => (
                <span
                  key={entry.id}
                  className="chip"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--code-high-bg)', color: 'var(--code-high)', borderColor: 'transparent' }}
                >
                  <CheckCircle2 size={12} /> {entry.title}
                  <button
                    type="button"
                    onClick={() => onDeleteLog(entry.id)}
                    aria-label={`Remove ${entry.title}`}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'inherit' }}
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="muted-text" style={{ marginTop: 5, fontSize: '0.72rem' }}>
              Saved stack: {dailyStack.length > 0 ? dailyStack.map((s) => s.name).join(' · ') : 'None yet — tap + Add / Scan'}.
            </p>
          )}
        </div>

        <button
          type="button"
          className="btn btn-soft btn-sm"
          style={{ marginTop: 10, width: '100%' }}
          onClick={() => onNavigateTab('training')}
        >
          View 7-Day Periodized Carb Wave <ArrowRight size={14} />
        </button>
      </section>

      <BarcodeScannerModal
        isOpen={Boolean(rideScannerTarget)}
        units={units}
        usdaApiKey={usdaApiKey}
        onClose={() => setRideScannerTarget(null)}
        onSelectFood={handleScannedRideProduct}
      />
    </>
  );
}
