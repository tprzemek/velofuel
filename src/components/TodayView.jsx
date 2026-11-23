import { useRef, useState } from 'react';
import {
  Bike,
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
} from 'lucide-react';
import {
  BOTTLE_SIZE_OPTIONS,
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

export default function TodayView({
  plan,
  profile,
  units,
  session,
  logs,
  staples = [],
  supplements = [],
  biometricsSummary,
  hasIntervalsConnected = false,
  bgSyncing = false,
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
  onDeleteLog,
  onLogOnBike,
  onSaveOnBikeLog,
  onCompleteRide,
  onNavigateTab,
}) {
  const existingOnBikeLog = logs.find((l) => l.slot === 'on_bike' && l.type === 'on_bike') || null;
  const hasAnyOnBikeLog = logs.some((l) => l.slot === 'on_bike');
  const loggedOnBikeCarbs = logs
    .filter((l) => l.slot === 'on_bike')
    .reduce((sum, l) => sum + (Number(l.carbs) || 0), 0);

  // Bottle size default vs this-ride-only toggle
  const [bottleAsDefault, setBottleAsDefault] = useState(true);

  // Complete / Edit Ride form state
  const [editingActual, setEditingActual] = useState(false);
  const [actualKjInput, setActualKjInput] = useState(session?.actualKj || plan.exerciseKj || 0);
  const [actualMinInput, setActualMinInput] = useState(session?.durationMin || 60);
  const [actualRideCarbsInput, setActualRideCarbsInput] = useState(
    existingOnBikeLog?.carbs ?? plan.onBikePlan?.totalCarbs ?? 0
  );
  const [actualRideProteinInput, setActualRideProteinInput] = useState(existingOnBikeLog?.protein ?? 0);
  const [actualRideFatInput, setActualRideFatInput] = useState(existingOnBikeLog?.fat ?? 0);
  const [actualRideSodiumInput, setActualRideSodiumInput] = useState(
    existingOnBikeLog?.micros?.sodium ?? plan.onBikePlan?.totalSodiumMg ?? 0
  );
  const [completeScannedItems, setCompleteScannedItems] = useState([]);
  const [syncRideCarbsOnComplete, setSyncRideCarbsOnComplete] = useState(true);

  // Inline Actual On-Bike Fuel editor state
  const [editingOnBike, setEditingOnBike] = useState(false);
  const [editingOnBikeId, setEditingOnBikeId] = useState(null);
  const [onBikeCarbsInput, setOnBikeCarbsInput] = useState(plan.onBikePlan?.totalCarbs ?? 0);
  const [onBikeProteinInput, setOnBikeProteinInput] = useState(0);
  const [onBikeFatInput, setOnBikeFatInput] = useState(0);
  const [onBikeSodiumInput, setOnBikeSodiumInput] = useState(plan.onBikePlan?.totalSodiumMg ?? 0);
  const [onBikeBottlesInput, setOnBikeBottlesInput] = useState(plan.onBikePlan?.bottles ?? 1);
  const [onBikeScannedItems, setOnBikeScannedItems] = useState([]);

  // Direct barcode scanner inside ride fuel editors ('onbike' | 'complete' | null)
  const [rideScannerTarget, setRideScannerTarget] = useState(null);

  // Expandable Suggested Meal per slot (hidden by default so meal cards stay clean!)
  const [openSuggestionSlot, setOpenSuggestionSlot] = useState(null);

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

  const openOnBikeEditor = (entry = null) => {
    setEditingOnBikeId(entry?.id || existingOnBikeLog?.id || null);
    setOnBikeCarbsInput(entry?.carbs ?? existingOnBikeLog?.carbs ?? plan.onBikePlan?.totalCarbs ?? 0);
    setOnBikeProteinInput(entry?.protein ?? existingOnBikeLog?.protein ?? 0);
    setOnBikeFatInput(entry?.fat ?? existingOnBikeLog?.fat ?? 0);
    setOnBikeSodiumInput(
      entry?.micros?.sodium ?? existingOnBikeLog?.micros?.sodium ?? plan.onBikePlan?.totalSodiumMg ?? 0
    );
    setOnBikeBottlesInput(entry?.bottles ?? existingOnBikeLog?.bottles ?? plan.onBikePlan?.bottles ?? 1);
    setOnBikeScannedItems([]);
    setEditingOnBike(true);
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

  const handleSaveOnBikeCustom = (e) => {
    e.preventDefault();
    const carbs = Math.max(0, Math.round(Number(onBikeCarbsInput) || 0));
    const protein = Math.max(0, Math.round(Number(onBikeProteinInput) || 0));
    const fat = Math.max(0, Math.round(Number(onBikeFatInput) || 0));
    const sodiumMg = Math.max(0, Math.round(Number(onBikeSodiumInput) || 0));
    const bottles = Math.max(0, Number(onBikeBottlesInput) || 0);
    onSaveOnBikeLog({
      existingId: editingOnBikeId,
      carbs,
      protein,
      fat,
      sodiumMg,
      bottles,
      bottleLabel: plan.onBikePlan?.bottleLabel || formatLiquid(profile?.defaultBottleMl || 650, units),
      scannedItems: onBikeScannedItems,
      durationMin: session?.durationMin || 0,
      plannedCarbs: plan.onBikePlan?.totalCarbs || 0,
    });
    setEditingOnBike(false);
    setEditingOnBikeId(null);
    setOnBikeScannedItems([]);
  };

  const handleSaveCompletedRide = (e) => {
    e.preventDefault();
    const kj = Number(actualKjInput) || 0;
    const mins = Number(actualMinInput) || 0;
    onCompleteRide(plan.date, kj, mins);
    if (syncRideCarbsOnComplete) {
      onSaveOnBikeLog({
        existingId: existingOnBikeLog?.id || null,
        carbs: Math.max(0, Math.round(Number(actualRideCarbsInput) || 0)),
        protein: Math.max(0, Math.round(Number(actualRideProteinInput) || 0)),
        fat: Math.max(0, Math.round(Number(actualRideFatInput) || 0)),
        sodiumMg: Math.max(0, Math.round(Number(actualRideSodiumInput) || 0)),
        bottles: existingOnBikeLog?.bottles ?? plan.onBikePlan?.bottles ?? 1,
        bottleLabel: plan.onBikePlan?.bottleLabel || formatLiquid(profile?.defaultBottleMl || 650, units),
        scannedItems: completeScannedItems,
        durationMin: mins,
        plannedCarbs: plan.onBikePlan?.totalCarbs || 0,
        silent: true,
      });
    }
    setEditingActual(false);
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

  // Helper for the Training card quick placement dropdown
  const nonBikeOrder = currentOrder.filter((id) => id !== 'on_bike');
  const onBikeIdx = currentOrder.indexOf('on_bike');
  const placementOptions = [
    { idx: 0, label: 'Before Breakfast (Early Morning)' },
    ...nonBikeOrder.map((id, i) => ({
      idx: i + 1,
      label: `After ${id.charAt(0).toUpperCase() + id.slice(1)}`,
    })),
  ];

  const handleSelectTrainingPlacement = (targetIdx) => {
    const next = [...nonBikeOrder];
    next.splice(Math.min(Math.max(0, Number(targetIdx)), next.length), 0, 'on_bike');
    onReorderTimeline(plan.date, next);
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

      {/* Tomorrow's Ride Pre-Load Banner */}
      {plan.needsTomorrowPreload && (
        <div className="notice-strip green">
          <Zap size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Tomorrow&apos;s Ride Pre-Load:</strong> Tomorrow is{' '}
            <strong>{plan.tomorrowTitle || plan.tomorrowCategory}</strong>. Tonight’s dinner carbs are automatically
            boosted so you wake up ready to ride hard.
          </div>
        </div>
      )}

      {/* Water Weight Notice from Withings Scale */}
      {biometricsSummary.glycogenNotice && (
        <div className="notice-strip">
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{biometricsSummary.glycogenNotice}</div>
        </div>
      )}

      {/* Compact Rest Day Card (when there is no cycling workout today) */}
      {!plan.onBikePlan && (
        <section className="card" aria-label="Rest Day Summary">
          <div className="session-card-head">
            <div>
              <div className="section-kicker" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Bike size={13} /> Recovery / Rest Day
              </div>
              <h2 className="session-title" style={{ marginTop: 3 }}>
                {session?.title || 'Rest & Mobility Day'}
              </h2>
              <div className="session-meta mono">0 kJ on bike · Smart fat-loss &amp; muscle repair</div>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => onNavigateTab('training')}>
              Add Ride
            </button>
          </div>
        </section>
      )}

      {/* Draggable Daily Timeline (Meals + Training Card freely reorderable!) */}
      <section aria-label="Meal Plan and Training Timeline">
        <div className="section-header" style={{ padding: '0 2px' }}>
          <h2 className="section-title">Daily Fuel &amp; Training Timeline</h2>
          <span className="section-kicker">Drag cards to reorder</span>
        </div>

        <div className="meal-list">
          {plan.meals.map((slot, idx) => {
            const slotLogs = logs.filter((l) => l.slot === slot.slot);
            const isOnBike = slot.slot === 'on_bike';
            const codeClass = slot.carbCode.toLowerCase();
            const isDragging = draggedSlot === slot.slot;
            const isDragOver = dragOverSlot === slot.slot && draggedSlot !== slot.slot;
            const canSaveAsStaple =
              !isOnBike && slotLogs.length > 0 && slotLogs.some((l) => l.type === 'food' && l.ingredient);
            const onBikeDelta = isOnBike ? (Number(onBikeCarbsInput) || 0) - slot.targetCarbs : 0;
            const suggestionOpen = !isOnBike && openSuggestionSlot === slot.slot;
            const suggestion = suggestionOpen
              ? suggestMealForSlot(slot, staples, plan.category, slot.slot === 'dinner' ? remaining : null)
              : null;

            return (
              <div
                key={slot.slot}
                data-slot={slot.slot}
                className={`meal-slot ${isOnBike ? 'training-card' : `code-${codeClass}`} ${
                  isDragging ? 'dragging' : ''
                } ${isDragOver ? 'drag-over' : ''}`}
              >
                {/* Card Header with Pointer Drag Handle (iOS, Android & Desktop) & Reorder Buttons */}
                <div className="meal-slot-head">
                  <div className="meal-slot-title-group">
                    <span
                      className="drag-handle"
                      role="button"
                      tabIndex={0}
                      aria-label={`Drag ${isOnBike ? 'Training' : slot.label} card to reorder`}
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
                    {isOnBike && <Bike size={16} color="var(--code-high)" />}
                    <span className="meal-slot-name">
                      {isOnBike ? session?.title || 'Training Session' : slot.label}
                    </span>
                    <span className={`carb-badge ${codeClass}`}>{slot.carbCode}</span>
                  </div>

                  <div className="reorder-controls">
                    <button
                      type="button"
                      className="reorder-btn"
                      disabled={idx === 0}
                      onClick={() => moveCard(slot.slot, idx - 1)}
                      aria-label={`Move ${isOnBike ? 'Training' : slot.label} up`}
                      title="Move up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="reorder-btn"
                      disabled={idx === plan.meals.length - 1}
                      onClick={() => moveCard(slot.slot, idx + 1)}
                      aria-label={`Move ${isOnBike ? 'Training' : slot.label} down`}
                      title="Move down"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>
                </div>

                {/* TRAINING & ON-BIKE FUEL CARD BODY */}
                {isOnBike && plan.onBikePlan ? (
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
                        {session?.durationMin} min · {plan.exerciseKj} kJ (~{plan.exerciseKcal} kcal burned)
                        {session?.source === 'intervals.icu' && session?.status === 'completed' && (
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
                            title="Pull latest completed ride kJ & duration from Intervals.icu"
                          >
                            <RefreshCw size={13} className={bgSyncing ? 'spin' : ''} />
                          </button>
                        )}
                        <button
                          type="button"
                          className={`btn btn-sm ${session?.status === 'completed' ? 'btn-soft' : 'btn-primary'}`}
                          onClick={() => {
                            setActualKjInput(session?.actualKj || plan.exerciseKj);
                            setActualMinInput(session?.durationMin || 60);
                            setActualRideCarbsInput(
                              existingOnBikeLog?.carbs ?? session?.carbsIngested ?? plan.onBikePlan?.totalCarbs ?? 0
                            );
                            setActualRideProteinInput(existingOnBikeLog?.protein ?? 0);
                            setActualRideFatInput(existingOnBikeLog?.fat ?? 0);
                            setActualRideSodiumInput(
                              existingOnBikeLog?.micros?.sodium ?? plan.onBikePlan?.totalSodiumMg ?? 0
                            );
                            setCompleteScannedItems([]);
                            setEditingActual((v) => !v);
                          }}
                        >
                          <CheckCircle2 size={14} />
                          {session?.status === 'completed' ? 'Edit Ride' : 'Complete'}
                        </button>
                      </div>
                    </div>

                    {/* Quick Placement Selector for Training Card */}
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
                        htmlFor="training-placement"
                        style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-secondary)', whiteSpace: 'nowrap' }}
                      >
                        Workout placement:
                      </label>
                      <select
                        id="training-placement"
                        className="select"
                        style={{ padding: '5px 9px', fontSize: '0.75rem', fontWeight: 700, maxWidth: 220 }}
                        value={onBikeIdx}
                        onChange={(e) => handleSelectTrainingPlacement(Number(e.target.value))}
                      >
                        {placementOptions.map((opt) => (
                          <option key={opt.idx} value={opt.idx}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {editingActual && (
                      <form
                        onSubmit={handleSaveCompletedRide}
                        style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-hairline)' }}
                      >
                        <div className="field-grid">
                          <div className="field">
                            <label htmlFor="actual-kj">Actual Power Work (kJ)</label>
                            <NumericInput
                              id="actual-kj"
                              className="input mono"
                              value={actualKjInput}
                              onChange={setActualKjInput}
                              min={0}
                              max={8000}
                              fallback={0}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="actual-min">Duration (min)</label>
                            <NumericInput
                              id="actual-min"
                              className="input mono"
                              value={actualMinInput}
                              onChange={setActualMinInput}
                              min={0}
                              max={720}
                              fallback={60}
                            />
                          </div>

                          <div className="field full" style={{ marginTop: 2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <label htmlFor="actual-ride-carbs" style={{ margin: 0 }}>
                                Actual Ride Carbs (g){' '}
                                <span style={{ fontWeight: 500, color: 'var(--ink-muted)' }}>
                                  (plan: {plan.onBikePlan.totalCarbs}g)
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
                              id="actual-ride-carbs"
                              className="input mono"
                              value={actualRideCarbsInput}
                              onChange={setActualRideCarbsInput}
                              min={0}
                              max={1000}
                              fallback={0}
                            />
                          </div>

                          <div className="field">
                            <label htmlFor="actual-ride-prot">Ride Protein (g)</label>
                            <NumericInput
                              id="actual-ride-prot"
                              className="input mono"
                              value={actualRideProteinInput}
                              onChange={setActualRideProteinInput}
                              min={0}
                              max={200}
                              fallback={0}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="actual-ride-fat">Ride Fat (g)</label>
                            <NumericInput
                              id="actual-ride-fat"
                              className="input mono"
                              value={actualRideFatInput}
                              onChange={setActualRideFatInput}
                              min={0}
                              max={200}
                              fallback={0}
                            />
                          </div>
                        </div>

                        {completeScannedItems.length > 0 && (
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
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button type="submit" className="btn btn-accent btn-sm" style={{ flex: 1 }}>
                            Save &amp; Recalculate Remaining Meals
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => setEditingActual(false)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Prominent Prescribed On-Bike Numbers */}
                    <div className="on-bike-grid">
                      <div className="mini-stat" style={{ background: 'rgba(255,255,255,0.82)' }}>
                        <div className="mini-stat-label">Planned Rate</div>
                        <div className="mini-stat-val mono" style={{ color: 'var(--code-high)' }}>
                          {plan.onBikePlan.carbsPerHour} g/h
                        </div>
                      </div>
                      <div className="mini-stat" style={{ background: 'rgba(255,255,255,0.82)' }}>
                        <div className="mini-stat-label">
                          {hasAnyOnBikeLog ? 'Actual / Plan' : 'Planned Carbs'}
                        </div>
                        <div className="mini-stat-val mono">
                          {hasAnyOnBikeLog
                            ? `${loggedOnBikeCarbs} / ${plan.onBikePlan.totalCarbs}g`
                            : `${plan.onBikePlan.totalCarbs} g`}
                        </div>
                      </div>
                      <div className="mini-stat" style={{ background: 'rgba(255,255,255,0.82)' }}>
                        <div className="mini-stat-label">Bottles</div>
                        <div className="mini-stat-val mono">
                          {plan.onBikePlan.bottles}× {plan.onBikePlan.bottleLabel}
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
                          const active = plan.onBikePlan.bottleSizeMl === ml;
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
                              onClick={() => onSetRideBottleSize(plan.date, ml, bottleAsDefault)}
                            >
                              {formatLiquid(ml, units)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <p className="muted-text" style={{ marginTop: 8, fontSize: '0.75rem' }}>
                      <Droplets size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                      {plan.onBikePlan.note}
                    </p>

                    {(plan.timingCoaching?.preRideCue || plan.timingCoaching?.postRideCue) && (
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
                  /* REGULAR MEAL CARD: Prominent Planned Macros Strip (No meal listed by default!) */
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
                            {(!isOnBike || entry.protein > 0) && (
                              <span style={{ color: 'var(--macro-protein)' }}>{entry.protein}g P</span>
                            )}
                            {(!isOnBike || entry.fat > 0) && (
                              <span style={{ color: 'var(--macro-fat)' }}>{entry.fat}g F</span>
                            )}
                            <span style={{ color: 'var(--ink-muted)' }}>{entry.kcal} kcal</span>
                            {isOnBike && entry.micros?.sodium > 0 && (
                              <span style={{ color: 'var(--ink-secondary)' }}>{entry.micros.sodium}mg Na</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          {isOnBike && entry.type === 'on_bike' && (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => openOnBikeEditor(entry)}
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
                {isOnBike && editingOnBike && (
                  <form
                    onSubmit={handleSaveOnBikeCustom}
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
                        <label htmlFor="onbike-carbs">Actual Carbs (g)</label>
                        <NumericInput
                          id="onbike-carbs"
                          className="input mono"
                          min={0}
                          max={1200}
                          fallback={0}
                          value={onBikeCarbsInput}
                          onChange={setOnBikeCarbsInput}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="onbike-sodium">Actual Sodium (mg)</label>
                        <NumericInput
                          id="onbike-sodium"
                          className="input mono"
                          min={0}
                          max={10000}
                          fallback={0}
                          value={onBikeSodiumInput}
                          onChange={setOnBikeSodiumInput}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="onbike-protein">Protein (g) — bars/mix</label>
                        <NumericInput
                          id="onbike-protein"
                          className="input mono"
                          min={0}
                          max={200}
                          fallback={0}
                          value={onBikeProteinInput}
                          onChange={setOnBikeProteinInput}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="onbike-fat">Fat (g) — bars/nuts</label>
                        <NumericInput
                          id="onbike-fat"
                          className="input mono"
                          min={0}
                          max={200}
                          fallback={0}
                          value={onBikeFatInput}
                          onChange={setOnBikeFatInput}
                        />
                      </div>
                      <div className="field full">
                        <label htmlFor="onbike-bottles">
                          Bottles Drunk ({plan.onBikePlan?.bottleLabel})
                        </label>
                        <NumericInput
                          id="onbike-bottles"
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
                      <button type="button" className="btn btn-sm" onClick={() => setEditingOnBike(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Card Action Buttons */}
                <div className="meal-actions">
                  {isOnBike ? (
                    <>
                      {!existingOnBikeLog && (
                        <button
                          type="button"
                          className="btn btn-sm btn-accent"
                          onClick={() => onLogOnBike(slot, plan.onBikePlan)}
                        >
                          <Zap size={14} /> Log Planned ({slot.targetCarbs}g C)
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => openOnBikeEditor(existingOnBikeLog)}
                      >
                        <Pencil size={13} /> {existingOnBikeLog ? 'Modify Actual' : 'Log Actual / Tweak'}
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
        onClose={() => setRideScannerTarget(null)}
        onSelectFood={handleScannedRideProduct}
      />
    </>
  );
}
