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
  Copy,
  Package,
  ChevronDown,
  ChevronUp,
  Scissors,
  Thermometer,
  Clock,
} from 'lucide-react';
import {
  BOTTLE_SIZE_OPTIONS,
  buildRideEatingSchedule,
  computeIntraDayEnergyCurve,
  HEAT_LEVEL_OPTIONS,
  INTENSITY_OPTIONS,
  normalizeSportKind,
  SPORT_OPTIONS,
  suggestMealForSlot,
  sumDailyLogs,
  SWEAT_RATE_OPTIONS,
} from '../engine/fuelingEngine';
import { getFoodServings } from '../engine/foodDatabase';
import {
  foodDisplayToGrams,
  foodUnitLabel,
  formatFoodAmount,
  formatLiquid,
  formatSodiumPractical,
  gramsToFoodDisplay,
} from '../engine/units';
import NumericInput from './NumericInput';
import BarcodeScannerModal from './BarcodeScannerModal';

const MICRO_TIPS = {
  iron: {
    tip: 'Pair iron-rich foods with Vitamin C (citrus, berries, peppers) for better absorption, and space coffee/tea or calcium ~1 hour apart.',
    sources: 'lean beef, rolled oats, spinach, lentils, or your daily supplement stack',
  },
  vitC: {
    tip: 'Vitamin C boosts plant-iron absorption and supports immune recovery after heavy training blocks.',
    sources: 'oranges, orange juice, strawberries, broccoli, or bell peppers',
  },
  calcium: {
    tip: 'Steady daily calcium supports bone density for cyclists — aim for 2–3 dairy or fortified plant-milk servings.',
    sources: 'Greek yogurt, milk, skyr, parmesan, tofu, or fortified oat/soy milk',
  },
  vitD: {
    tip: 'Vitamin D absorbs best alongside a meal containing a little healthy fat (eggs, salmon, olive oil, or nuts).',
    sources: 'salmon, eggs, fortified milk, or your Vitamin D supplement',
  },
  magnesium: {
    tip: 'Magnesium supports muscle relaxation, sleep quality, and energy metabolism during high-volume weeks.',
    sources: 'oats, almonds, chia/flax seeds, spinach, peanut butter, or evening magnesium',
  },
  sodium: {
    tip: 'On sweaty rides, sodium helps retain fluid and prevent cramping — adjust your ride card Conditions & Sweat Rate for exact bottle dosing.',
    sources: 'ride bottle salt/sodium citrate, electrolyte tabs, bread, cottage cheese, or tomato sauce',
  },
  fiber: {
    tip: 'Keep fiber lighter right before hard rides or races for a calm stomach, and enjoy higher fiber on rest and recovery days.',
    sources: 'oats, berries, whole-grain bread, lentils, chickpeas, and vegetables',
  },
};

function FuelWaveCard({ plan, logs }) {
  const curve = computeIntraDayEnergyCurve(plan, logs);
  const pts = curve.points || [];
  if (pts.length < 2) return null;

  const width = 440;
  const height = 122;
  const padL = 14;
  const padR = 14;
  const padT = 14;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allVals = pts.flatMap((p) => [
    p.plannedBalance,
    p.hour <= curve.lastLoggedHour ? p.loggedBalance : 0,
    curve.balancedBand.min,
    curve.balancedBand.max,
  ]);
  const minVal = Math.min(...allVals, -500) - 80;
  const maxVal = Math.max(...allVals, 450) + 80;
  const range = Math.max(400, maxVal - minVal);

  const xAtHour = (h) => padL + ((h - 6) / 16) * plotW;
  const yAtVal = (v) => padT + ((maxVal - v) / range) * plotH;

  const plannedPath = pts
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xAtHour(p.hour).toFixed(1)} ${yAtVal(p.plannedBalance).toFixed(1)}`)
    .join(' ');

  const loggedPts = curve.hasLoggedAny
    ? pts.filter((p) => p.hour <= curve.lastLoggedHour)
    : pts.slice(0, 2);
  const loggedPath = loggedPts
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xAtHour(p.hour).toFixed(1)} ${yAtVal(p.loggedBalance).toFixed(1)}`)
    .join(' ');
  const lastLoggedPt = loggedPts[loggedPts.length - 1];

  const bandTop = yAtVal(curve.balancedBand.max);
  const bandBottom = yAtVal(curve.balancedBand.min);
  const zeroY = yAtVal(0);

  return (
    <section className="card fuel-wave-card" aria-label="Intra-Day Fuel Wave">
      <div className="section-header" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
        <div>
          <h2 className="section-title" style={{ fontSize: '0.9rem' }}>Today&apos;s Fuel Wave</h2>
          <span className="section-kicker">Energy balance synced to your timeline</span>
        </div>
        <span className={`carb-badge ${curve.statusTone === 'med' ? 'med' : curve.statusTone === 'high' ? 'high' : 'low'}`}>
          {curve.status}
        </span>
      </div>

      <div className="chart-wrap" style={{ marginTop: 4 }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="122"
          role="img"
          aria-label="Today's intra-day fuel balance wave"
        >
          {/* Shaded Balanced Band */}
          <rect
            x={padL}
            y={bandTop}
            width={plotW}
            height={Math.max(4, bandBottom - bandTop)}
            rx="6"
            fill="rgba(20, 122, 83, 0.08)"
          />
          <line
            x1={padL}
            x2={width - padR}
            y1={zeroY}
            y2={zeroY}
            stroke="rgba(20, 24, 28, 0.14)"
            strokeDasharray="3 3"
          />

          {/* Planned Trajectory (Dashed) */}
          <path
            d={plannedPath}
            fill="none"
            stroke="#515A64"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Logged Progress (Solid) */}
          <path
            d={loggedPath}
            fill="none"
            stroke="#147A53"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Workout Dip Markers */}
          {curve.markers
            .filter((m) => m.type === 'workout')
            .map((m, idx) => {
              const pt = pts.find((p) => p.hour === m.hour);
              if (!pt) return null;
              return (
                <circle
                  key={`wk-${m.hour}-${idx}`}
                  cx={xAtHour(m.hour)}
                  cy={yAtVal(pt.plannedBalance)}
                  r="4"
                  fill="#B86B14"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                >
                  <title>{`${m.label} (~${pt.label})`}</title>
                </circle>
              );
            })}

          {lastLoggedPt && (
            <circle
              cx={xAtHour(lastLoggedPt.hour)}
              cy={yAtVal(lastLoggedPt.loggedBalance)}
              r="4.2"
              fill="#147A53"
              stroke="#FFFFFF"
              strokeWidth="1.8"
            />
          )}

          {/* Hour axis labels */}
          {[6, 10, 14, 18, 22].map((h) => {
            const lbl = h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`;
            return (
              <text
                key={h}
                x={xAtHour(h)}
                y={height - 4}
                textAnchor={h === 6 ? 'start' : h === 22 ? 'end' : 'middle'}
                fontSize="9.5"
                fill="#7D8690"
                fontFamily="JetBrains Mono, monospace"
              >
                {lbl}
              </text>
            );
          })}
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.68rem', color: 'var(--ink-muted)', marginTop: 2 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--code-high)', fontWeight: 700 }}>— Logged</span>
          <span>┄ Planned</span>
          <span style={{ color: 'var(--code-med)', fontWeight: 700 }}>● Workout</span>
        </div>
        <span>Shaded = steady zone</span>
      </div>
      <p className="muted-text" style={{ fontSize: '0.73rem', marginTop: 4 }}>
        {curve.summaryNote}
      </p>
    </section>
  );
}

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
  yesterdayMealLogs = [],
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
  onUpdateSessionFuelSettings,
  onReorderTimeline,
  onDeleteMealSlot,
  onAddMealSlot,
  onResetDayMeals,
  onDeleteLog,
  onUpdateLog,
  onSplitStapleLog,
  onCopyYesterdayMeal,
  onCopyYesterdayDay,
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

  // v11: Inline edit state for logged foods / saved meals / quick adds
  const [editingLogId, setEditingLogId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGrams, setEditGrams] = useState(100);
  const [editCarbs, setEditCarbs] = useState(0);
  const [editProtein, setEditProtein] = useState(0);
  const [editFat, setEditFat] = useState(0);
  const [editKcal, setEditKcal] = useState(0);
  const [editStapleBase, setEditStapleBase] = useState(null);

  // v11: DIY Bottle Mix units ('grams' | 'spoons') & collapsible Pack Your Ride state
  const [diyUnits, setDiyUnits] = useState('grams');
  const [openPackSlot, setOpenPackSlot] = useState(null);
  const [packBySlot, setPackBySlot] = useState({});

  // v11: Tap-to-inspect micronutrient contributors
  const [selectedMicroKey, setSelectedMicroKey] = useState(null);

  const foodUnit = foodUnitLabel(units);

  const openInlineLogEditor = (entry) => {
    if (editingLogId === entry.id) {
      setEditingLogId(null);
      return;
    }
    setEditingLogId(entry.id);
    setEditTitle(entry.title || '');
    setEditGrams(Math.max(1, Math.round(Number(entry.ingredient?.grams) || 100)));
    setEditCarbs(Math.max(0, Math.round(Number(entry.carbs) || 0)));
    setEditProtein(Math.max(0, Math.round(Number(entry.protein) || 0)));
    setEditFat(Math.max(0, Math.round(Number(entry.fat) || 0)));
    setEditKcal(Math.max(0, Math.round(Number(entry.kcal) || 0)));
    setEditStapleBase(
      entry.type === 'staple'
        ? {
            carbs: entry.carbs || 0,
            protein: entry.protein || 0,
            fat: entry.fat || 0,
            micros: { ...(entry.micros || {}) },
          }
        : null
    );
  };

  const handleEditMacroChange = (field, rawVal) => {
    const prevVal = field === 'c' ? editCarbs : field === 'p' ? editProtein : editFat;
    const nextC = field === 'c' ? rawVal : editCarbs;
    const nextP = field === 'p' ? rawVal : editProtein;
    const nextF = field === 'f' ? rawVal : editFat;
    if (field === 'c') setEditCarbs(rawVal);
    if (field === 'p') setEditProtein(rawVal);
    if (field === 'f') setEditFat(rawVal);
    if (Number(prevVal) !== Number(rawVal)) {
      const cNum = Math.max(0, Math.round(Number(nextC) || 0));
      const pNum = Math.max(0, Math.round(Number(nextP) || 0));
      const fNum = Math.max(0, Math.round(Number(nextF) || 0));
      setEditKcal(cNum * 4 + pNum * 4 + fNum * 9);
    }
  };

  const handleSaveInlineLogEdit = (entry) => {
    if (!onUpdateLog) return;
    if (entry.ingredient) {
      const grams = Math.max(1, Math.round(Number(editGrams) || 1));
      const f = grams / 100;
      const p = entry.ingredient.per100g || {};
      const carbs = Math.round((p.carbs || 0) * f);
      const protein = Math.round((p.protein || 0) * f);
      const fat = Math.round((p.fat || 0) * f);
      const kcal = carbs * 4 + protein * 4 + fat * 9;
      onUpdateLog(entry.id, {
        detail: formatFoodAmount(grams, units),
        ingredient: { ...entry.ingredient, grams },
        carbs,
        protein,
        fat,
        kcal,
        micros: {
          fiber: Number(((p.fiber || 0) * f).toFixed(1)),
          iron: Number(((p.iron || 0) * f).toFixed(1)),
          vitC: Math.round((p.vitC || 0) * f),
          calcium: Math.round((p.calcium || 0) * f),
          vitD: Number(((p.vitD || 0) * f).toFixed(1)),
          magnesium: Math.round((p.magnesium || 0) * f),
          sodium: Math.round((p.sodium || 0) * f),
        },
      });
    } else if (entry.type === 'staple') {
      const c = Math.max(0, Math.round(Number(editCarbs) || 0));
      const p = Math.max(0, Math.round(Number(editProtein) || 0));
      const f = Math.max(0, Math.round(Number(editFat) || 0));
      const kcal = c * 4 + p * 4 + f * 9;
      const baseKcal = editStapleBase
        ? editStapleBase.carbs * 4 + editStapleBase.protein * 4 + editStapleBase.fat * 9
        : entry.kcal || 0;
      const ratio = baseKcal > 10 ? kcal / baseKcal : 1;
      const baseM = editStapleBase?.micros || entry.micros || {};
      const baseItems =
        Array.isArray(entry.resolvedItems) && entry.resolvedItems.length > 0
          ? entry.resolvedItems
          : null;
      const scaledResolvedItems = baseItems
        ? baseItems.map((ri) => ({
            ...ri,
            grams: Math.max(1, Math.round((Number(ri.grams) || 50) * ratio)),
          }))
        : undefined;
      const updatedDetail = scaledResolvedItems
        ? scaledResolvedItems.map((i) => `${formatFoodAmount(i.grams, units)} ${i.name}`).join(' · ')
        : Math.abs(ratio - 1) >= 0.03
        ? `Adjusted portion (${Number(ratio.toFixed(2))}×)`
        : entry.detail;
      onUpdateLog(entry.id, {
        detail: updatedDetail,
        ...(scaledResolvedItems ? { resolvedItems: scaledResolvedItems } : {}),
        carbs: c,
        protein: p,
        fat: f,
        kcal,
        micros: {
          fiber: Number(((baseM.fiber || 0) * ratio).toFixed(1)),
          iron: Number(((baseM.iron || 0) * ratio).toFixed(1)),
          vitC: Math.round((baseM.vitC || 0) * ratio),
          calcium: Math.round((baseM.calcium || 0) * ratio),
          vitD: Number(((baseM.vitD || 0) * ratio).toFixed(1)),
          magnesium: Math.round((baseM.magnesium || 0) * ratio),
          sodium: Math.round((baseM.sodium || 0) * ratio),
        },
      });
    } else {
      const c = Math.max(0, Math.round(Number(editCarbs) || 0));
      const p = Math.max(0, Math.round(Number(editProtein) || 0));
      const f = Math.max(0, Math.round(Number(editFat) || 0));
      const kcal = Math.max(0, Math.round(Number(editKcal) || 0));
      onUpdateLog(entry.id, {
        title: editTitle.trim() || entry.title,
        carbs: c,
        protein: p,
        fat: f,
        kcal,
      });
    }
    setEditingLogId(null);
  };

  const getPackForSlot = (slotId, wPlan) => {
    const existing = packBySlot[slotId];
    if (existing) return existing;
    return {
      carbBottles: wPlan?.bottles || 1,
      gels: 0,
      bars: 0,
      tabs: 0,
    };
  };

  const updatePackCount = (slotId, wPlan, field, delta) => {
    setPackBySlot((prev) => {
      const cur = prev[slotId] || {
        carbBottles: wPlan?.bottles || 1,
        gels: 0,
        bars: 0,
        tabs: 0,
      };
      return {
        ...prev,
        [slotId]: {
          ...cur,
          [field]: Math.max(0, Math.min(12, (cur[field] || 0) + delta)),
        },
      };
    });
  };

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

      {/* Live Intra-Day Fuel Wave Curve (compact SVG card, NOT a .meal-slot) */}
      <FuelWaveCard plan={plan} logs={logs} />

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
            {yesterdayMealLogs.length > 0 && onCopyYesterdayDay && (
              <button
                type="button"
                className="btn btn-sm btn-soft"
                style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                onClick={onCopyYesterdayDay}
                title="Copy yesterday's meals & snacks (never copies workouts)"
              >
                <Copy size={12} /> Copy Yesterday&apos;s Meals
              </button>
            )}
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

                        {/* v11: Live Conditions / Heat & Sweat Rate Controls */}
                        <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Thermometer size={12} /> Conditions &amp; Sweat:
                            </span>
                            <span className="mono" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--code-high)' }}>
                              {formatLiquid(wPlan.fluidMlPerHr, units)}/h · {wPlan.sodiumMgPerHr}mg Na/h
                            </span>
                          </div>
                          <div className="chip-row" role="group" aria-label="Ride conditions">
                            {HEAT_LEVEL_OPTIONS.map((opt) => {
                              const active = wPlan.heatLevel === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  className={`chip ${active ? 'chip-active' : ''}`}
                                  style={{ padding: '3px 8px', fontSize: '0.69rem' }}
                                  onClick={() =>
                                    onUpdateSessionFuelSettings?.(plan.date, workout.id, { heatLevel: opt.value })
                                  }
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.69rem', fontWeight: 700, color: 'var(--ink-muted)' }}>
                              Sweat rate:
                            </span>
                            <div className="chip-row" role="group" aria-label="Ride sweat rate">
                              {SWEAT_RATE_OPTIONS.map((opt) => {
                                const active = wPlan.sweatRate === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    className={`chip ${active ? 'chip-active' : ''}`}
                                    style={{ padding: '2px 8px', fontSize: '0.68rem' }}
                                    onClick={() =>
                                      onUpdateSessionFuelSettings?.(plan.date, workout.id, { sweatRate: opt.value })
                                    }
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* v11: DIY Bottle Mix Studio (Table Sugar vs Malto+Fructose, Table Salt vs Sodium Citrate, Grams <-> Spoons) */}
                        {wPlan.diyRecipe && (
                          <div className="diy-mix-box">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.73rem', fontWeight: 800, color: 'var(--ink-primary)' }}>
                                DIY Bottle Mix · per {wPlan.bottleLabel}
                              </span>
                              <button
                                type="button"
                                className="chip mono"
                                style={{ padding: '2px 8px', fontSize: '0.66rem', fontWeight: 700 }}
                                onClick={() => setDiyUnits((u) => (u === 'grams' ? 'spoons' : 'grams'))}
                              >
                                {diyUnits === 'grams' ? 'Switch to Spoons' : 'Switch to Grams'}
                              </button>
                            </div>

                            <div className="diy-mix-recipe mono">
                              {wPlan.carbsPerBottle > 0 ? (
                                <div>
                                  •{' '}
                                  {wPlan.carbBase === 'malto_fructose' ? (
                                    diyUnits === 'spoons' ? (
                                      <>
                                        <strong>{wPlan.diyRecipe.maltoSpoons}</strong> malto +{' '}
                                        <strong>{wPlan.diyRecipe.fructoseSpoons}</strong> fructose (2:1)
                                      </>
                                    ) : (
                                      <>
                                        <strong>{wPlan.diyRecipe.maltoG}g</strong> malto +{' '}
                                        <strong>{wPlan.diyRecipe.fructoseG}g</strong> fructose (2:1)
                                      </>
                                    )
                                  ) : diyUnits === 'spoons' ? (
                                    <>
                                      <strong>{wPlan.diyRecipe.sugarSpoons}</strong> table sugar ({wPlan.carbsPerBottle}g C)
                                    </>
                                  ) : (
                                    <>
                                      <strong>{wPlan.diyRecipe.sugarG}g</strong> table sugar (1:1)
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div>• Plain water (no carbs needed for short easy spin)</div>
                              )}
                              <div>
                                •{' '}
                                {wPlan.saltSource === 'sodium_citrate' ? (
                                  diyUnits === 'spoons' ? (
                                    <>
                                      <strong>{wPlan.diyRecipe.sodiumCitrateSpoons}</strong> sodium citrate ({wPlan.sodiumPerBottleMg}mg Na)
                                    </>
                                  ) : (
                                    <>
                                      <strong>{wPlan.diyRecipe.sodiumCitrateG}g</strong> sodium citrate ({wPlan.sodiumPerBottleMg}mg Na)
                                    </>
                                  )
                                ) : diyUnits === 'spoons' ? (
                                  <>
                                    <strong>{wPlan.diyRecipe.tableSaltSpoons}</strong> table salt ({wPlan.sodiumPerBottleMg}mg Na)
                                  </>
                                ) : (
                                  <>
                                    <strong>{wPlan.diyRecipe.tableSaltG}g</strong> table salt ({wPlan.sodiumPerBottleMg}mg Na)
                                  </>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                              <div className="chip-row" role="group" aria-label="Carb mix base">
                                <button
                                  type="button"
                                  className={`chip ${wPlan.carbBase === 'sugar' ? 'chip-active' : ''}`}
                                  style={{ padding: '2px 7px', fontSize: '0.66rem' }}
                                  onClick={() =>
                                    onUpdateSessionFuelSettings?.(plan.date, workout.id, { carbBase: 'sugar' })
                                  }
                                >
                                  Table Sugar
                                </button>
                                <button
                                  type="button"
                                  className={`chip ${wPlan.carbBase === 'malto_fructose' ? 'chip-active' : ''}`}
                                  style={{ padding: '2px 7px', fontSize: '0.66rem' }}
                                  onClick={() =>
                                    onUpdateSessionFuelSettings?.(plan.date, workout.id, { carbBase: 'malto_fructose' })
                                  }
                                >
                                  Malto + Fructose
                                </button>
                              </div>
                              <div className="chip-row" role="group" aria-label="Sodium source">
                                <button
                                  type="button"
                                  className={`chip ${wPlan.saltSource === 'table_salt' ? 'chip-active' : ''}`}
                                  style={{ padding: '2px 7px', fontSize: '0.66rem' }}
                                  onClick={() =>
                                    onUpdateSessionFuelSettings?.(plan.date, workout.id, { saltSource: 'table_salt' })
                                  }
                                >
                                  Table Salt
                                </button>
                                <button
                                  type="button"
                                  className={`chip ${wPlan.saltSource === 'sodium_citrate' ? 'chip-active' : ''}`}
                                  style={{ padding: '2px 7px', fontSize: '0.66rem' }}
                                  onClick={() =>
                                    onUpdateSessionFuelSettings?.(plan.date, workout.id, { saltSource: 'sodium_citrate' })
                                  }
                                >
                                  Sodium Citrate
                                </button>
                              </div>
                            </div>

                            <div className="muted-text" style={{ fontSize: '0.68rem', marginTop: 5 }}>
                              {wPlan.diyRecipe.saltNote}
                              {wPlan.carbBase === 'sugar' && wPlan.diyRecipe.highCarbHint && (
                                <div style={{ color: 'var(--code-med)', fontWeight: 600, marginTop: 2 }}>
                                  {wPlan.diyRecipe.highCarbHint}
                                </div>
                              )}
                              {wPlan.saltSource === 'table_salt' && wPlan.diyRecipe.highSaltHint && (
                                <div style={{ color: 'var(--code-med)', fontWeight: 600, marginTop: 2 }}>
                                  {wPlan.diyRecipe.highSaltHint}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <p className="muted-text" style={{ marginTop: 8, fontSize: '0.75rem' }}>
                          <Droplets size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                          {wPlan.note}
                        </p>

                        {/* v11: Collapsible "Pack Your Ride" Itemized Fuel Builder + Hourly Eating Schedule */}
                        {(() => {
                          const packKey = `${plan.date}:${workout.id || slot.slot}`;
                          const packOpen = openPackSlot === packKey;
                          const pack = getPackForSlot(packKey, wPlan);
                          const tabMg = profile?.electrolyteTabMg || 500;
                          const packedCarbs =
                            pack.carbBottles * (wPlan.carbsPerBottle || 0) +
                            pack.gels * 25 +
                            pack.bars * 40;
                          const packedProtein = pack.bars * 5;
                          const packedFat = pack.bars * 5;
                          const packedFluidMl = pack.carbBottles * (wPlan.bottleSizeMl || 650);
                          const packedSodiumMg =
                            pack.carbBottles * (wPlan.sodiumPerBottleMg || 0) +
                            pack.gels * 50 +
                            pack.bars * 150 +
                            pack.tabs * tabMg;
                          const isHardRide = ['sweetspot', 'threshold', 'vo2max', 'race'].includes(workout.intensity);
                          const highSolidFatWarn =
                            (isHardRide && (packedFat >= 10 || packedProtein >= 10)) ||
                            packedFat >= 15 ||
                            packedProtein >= 15;
                          const schedule = packOpen
                            ? buildRideEatingSchedule(workout.durationMin, pack, wPlan)
                            : [];

                          return (
                            <div style={{ marginTop: 8 }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-soft"
                                style={{ width: '100%', justifyContent: 'space-between' }}
                                aria-expanded={packOpen}
                                onClick={() => setOpenPackSlot(packOpen ? null : packKey)}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <Package size={13} /> Pack Your Ride &amp; Eating Schedule
                                </span>
                                {packOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>

                              {packOpen && (
                                <div className="ride-pack-drawer">
                                  {/* Live Progress vs Ride Targets */}
                                  <div className="pack-progress-grid">
                                    <div className="pack-progress-row">
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700 }}>
                                        <span>Carbs</span>
                                        <span className="mono">{packedCarbs} / {wPlan.totalCarbs}g</span>
                                      </div>
                                      <div className="progress-track light" style={{ height: 5 }}>
                                        <div
                                          className="progress-fill"
                                          style={{
                                            width: `${pct(packedCarbs, Math.max(1, wPlan.totalCarbs))}%`,
                                            background: 'var(--macro-carb)',
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <div className="pack-progress-row">
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700 }}>
                                        <span>Fluid</span>
                                        <span className="mono">
                                          {formatLiquid(packedFluidMl, units)} / {formatLiquid(wPlan.totalFluidMl, units)}
                                        </span>
                                      </div>
                                      <div className="progress-track light" style={{ height: 5 }}>
                                        <div
                                          className="progress-fill"
                                          style={{
                                            width: `${pct(packedFluidMl, Math.max(1, wPlan.totalFluidMl))}%`,
                                            background: 'var(--macro-protein)',
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <div className="pack-progress-row">
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700 }}>
                                        <span>Sodium</span>
                                        <span className="mono">{packedSodiumMg} / {wPlan.totalSodiumMg}mg</span>
                                      </div>
                                      <div className="progress-track light" style={{ height: 5 }}>
                                        <div
                                          className="progress-fill"
                                          style={{
                                            width: `${pct(packedSodiumMg, Math.max(1, wPlan.totalSodiumMg))}%`,
                                            background: 'var(--code-med)',
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Natural-Unit Steppers */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 9 }}>
                                    {[
                                      {
                                        key: 'carbBottles',
                                        label: `Carb Bottles (${wPlan.bottleLabel})`,
                                        sub: `${wPlan.carbsPerBottle}g C · ${wPlan.sodiumPerBottleMg}mg Na each`,
                                      },
                                      {
                                        key: 'gels',
                                        label: 'Energy Gels',
                                        sub: '25g C · 50mg Na each',
                                      },
                                      {
                                        key: 'bars',
                                        label: 'Bars / Rice Cakes',
                                        sub: '40g C · 5g P · 5g F · 150mg Na',
                                      },
                                      {
                                        key: 'tabs',
                                        label: 'Electrolyte Tabs',
                                        sub: `${tabMg}mg Na each`,
                                      },
                                    ].map((item) => (
                                      <div key={item.key} className="pack-stepper-row">
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontWeight: 700, fontSize: '0.76rem' }}>{item.label}</div>
                                          <div className="mono" style={{ fontSize: '0.67rem', color: 'var(--ink-muted)' }}>
                                            {item.sub}
                                          </div>
                                        </div>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                          <button
                                            type="button"
                                            className="reorder-btn"
                                            aria-label={`Remove 1 ${item.label}`}
                                            disabled={pack[item.key] <= 0}
                                            onClick={() => updatePackCount(packKey, wPlan, item.key, -1)}
                                          >
                                            −
                                          </button>
                                          <span className="mono" style={{ minWidth: 18, textAlign: 'center', fontWeight: 800, fontSize: '0.82rem' }}>
                                            {pack[item.key]}
                                          </span>
                                          <button
                                            type="button"
                                            className="reorder-btn"
                                            aria-label={`Add 1 ${item.label}`}
                                            onClick={() => updatePackCount(packKey, wPlan, item.key, 1)}
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {highSolidFatWarn && (
                                    <div className="notice-strip" style={{ marginTop: 8, padding: '7px 9px', fontSize: '0.71rem' }}>
                                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                                      <span>
                                        Higher fat/protein ({packedFat}g F · {packedProtein}g P) can slow stomach emptying during hard efforts — save bars for steady endurance miles.
                                      </span>
                                    </div>
                                  )}

                                  {/* Deterministic Ride Eating Schedule */}
                                  <div className="ride-schedule-box">
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-secondary)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Clock size={12} /> Ride Eating Schedule ({workout.durationMin}m)
                                    </div>
                                    <ul className="ride-schedule-list">
                                      {schedule.map((cue, cIdx) => (
                                        <li key={`${cue.timeLabel}-${cIdx}`}>
                                          <span className="mono" style={{ fontWeight: 800, color: 'var(--code-high)', minWidth: 56 }}>
                                            {cue.timeLabel}
                                          </span>
                                          <span>{cue.text}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  <button
                                    type="button"
                                    className="btn btn-sm btn-accent btn-block"
                                    style={{ marginTop: 9 }}
                                    onClick={() => {
                                      const summaryParts = [];
                                      if (pack.carbBottles > 0) summaryParts.push(`${pack.carbBottles} bottle${pack.carbBottles > 1 ? 's' : ''}`);
                                      if (pack.gels > 0) summaryParts.push(`${pack.gels} gel${pack.gels > 1 ? 's' : ''}`);
                                      if (pack.bars > 0) summaryParts.push(`${pack.bars} bar${pack.bars > 1 ? 's' : ''}`);
                                      if (pack.tabs > 0) summaryParts.push(`${pack.tabs} tab${pack.tabs > 1 ? 's' : ''}`);
                                      onSaveOnBikeLog({
                                        existingId: existingWorkoutFuelLog?.id || null,
                                        slotId: slot.slot,
                                        carbs: packedCarbs,
                                        protein: packedProtein,
                                        fat: packedFat,
                                        sodiumMg: packedSodiumMg,
                                        bottles: pack.carbBottles,
                                        bottleLabel: wPlan.bottleLabel,
                                        scannedItems: summaryParts.length ? [`Pack: ${summaryParts.join(' + ')}`] : [],
                                        durationMin: workout.durationMin,
                                        plannedCarbs: wPlan.totalCarbs,
                                      });
                                    }}
                                  >
                                    <Zap size={13} /> Log Pack as Actual Ride Fuel ({packedCarbs}g C)
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}

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
                    {slotLogs.map((entry) => {
                      const isEditingThis = !isWorkout && editingLogId === entry.id;
                      const foodServings = entry.ingredient ? getFoodServings(entry.ingredient) : [];
                      const ingPreview = entry.ingredient
                        ? (() => {
                            const f = (Number(editGrams) || 0) / 100;
                            const p = entry.ingredient.per100g || {};
                            const c = Math.round((p.carbs || 0) * f);
                            const pr = Math.round((p.protein || 0) * f);
                            const fa = Math.round((p.fat || 0) * f);
                            return { c, p: pr, f: fa, kcal: c * 4 + pr * 4 + fa * 9 };
                          })()
                        : null;
                      const manualPreviewKcal =
                        Math.max(0, Math.round(Number(editCarbs) || 0)) * 4 +
                        Math.max(0, Math.round(Number(editProtein) || 0)) * 4 +
                        Math.max(0, Math.round(Number(editFat) || 0)) * 9;

                      return (
                        <div className="logged-item-wrap" key={entry.id}>
                          <div className="logged-item">
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
                              {!isWorkout && onUpdateLog && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => openInlineLogEditor(entry)}
                                  aria-label={`Edit ${entry.title}`}
                                  title="Edit amount or macros"
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

                          {/* v11: Compact Inline Log Editor (div, NEVER nested form) */}
                          {isEditingThis && (
                            <div className="inline-log-editor" role="region" aria-label={`Editing ${entry.title}`}>
                              {entry.ingredient ? (
                                <>
                                  {foodServings.length > 0 && (
                                    <div className="serving-chips-row" style={{ marginBottom: 7 }}>
                                      {foodServings.map((srv) => (
                                        <button
                                          key={`${srv.label}-${srv.grams}`}
                                          type="button"
                                          className={`chip ${Math.round(editGrams) === Math.round(srv.grams) ? 'chip-active' : ''}`}
                                          style={{ padding: '2px 8px', fontSize: '0.68rem' }}
                                          onClick={() => setEditGrams(srv.grams)}
                                        >
                                          {srv.label} ({formatFoodAmount(srv.grams, units)})
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                      <label
                                        htmlFor={`edit-amt-${entry.id}`}
                                        style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-secondary)' }}
                                      >
                                        Amount ({foodUnit})
                                      </label>
                                      <NumericInput
                                        id={`edit-amt-${entry.id}`}
                                        className="input mono"
                                        style={{ width: 78, padding: '5px 8px', fontSize: '0.82rem', fontWeight: 700 }}
                                        min={foodUnit === 'g' ? 1 : 0.1}
                                        max={foodUnit === 'g' ? 2500 : 120}
                                        step={foodUnit === 'g' ? 1 : 0.1}
                                        fallback={gramsToFoodDisplay(entry.ingredient.grams || 100, units)}
                                        value={gramsToFoodDisplay(editGrams, units)}
                                        onChange={(v) => setEditGrams(Math.max(1, foodDisplayToGrams(v, units)))}
                                      />
                                    </div>
                                    {ingPreview && (
                                      <div className="mono" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                                        <span style={{ color: 'var(--macro-carb)' }}>{ingPreview.c}g C</span> ·{' '}
                                        <span style={{ color: 'var(--macro-protein)' }}>{ingPreview.p}g P</span> ·{' '}
                                        <span style={{ color: 'var(--macro-fat)' }}>{ingPreview.f}g F</span> · {ingPreview.kcal} kcal
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : entry.type === 'staple' ? (
                                <>
                                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--ink-secondary)', marginBottom: 5 }}>
                                    Quick portion scale:
                                  </div>
                                  <div className="chip-row" style={{ marginBottom: 8 }}>
                                    {[0.5, 0.75, 1, 1.25, 1.5].map((mult) => (
                                      <button
                                        key={mult}
                                        type="button"
                                        className="chip mono"
                                        style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                        onClick={() => {
                                          if (!editStapleBase) return;
                                          setEditCarbs(Math.round(editStapleBase.carbs * mult));
                                          setEditProtein(Math.round(editStapleBase.protein * mult));
                                          setEditFat(Math.round(editStapleBase.fat * mult));
                                        }}
                                      >
                                        {mult}×
                                      </button>
                                    ))}
                                  </div>
                                  <div className="quick-add-macro-row">
                                    <div className="field">
                                      <label htmlFor={`edit-c-${entry.id}`}>Carbs (g)</label>
                                      <NumericInput
                                        id={`edit-c-${entry.id}`}
                                        className="input mono"
                                        min={0}
                                        max={600}
                                        fallback={0}
                                        value={editCarbs}
                                        onChange={setEditCarbs}
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`edit-p-${entry.id}`}>Protein (g)</label>
                                      <NumericInput
                                        id={`edit-p-${entry.id}`}
                                        className="input mono"
                                        min={0}
                                        max={300}
                                        fallback={0}
                                        value={editProtein}
                                        onChange={setEditProtein}
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`edit-f-${entry.id}`}>Fat (g)</label>
                                      <NumericInput
                                        id={`edit-f-${entry.id}`}
                                        className="input mono"
                                        min={0}
                                        max={250}
                                        fallback={0}
                                        value={editFat}
                                        onChange={setEditFat}
                                      />
                                    </div>
                                  </div>
                                  <div className="mono" style={{ fontSize: '0.71rem', color: 'var(--ink-muted)', marginTop: 5 }}>
                                    Updated total: <strong>{manualPreviewKcal} kcal</strong>
                                  </div>
                                  {onSplitStapleLog && (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-soft btn-block"
                                      style={{ marginTop: 7 }}
                                      onClick={() => {
                                        onSplitStapleLog(entry.id, manualPreviewKcal);
                                        setEditingLogId(null);
                                      }}
                                    >
                                      <Scissors size={13} /> Split into individual foods
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="field" style={{ marginBottom: 7 }}>
                                    <label htmlFor={`edit-title-${entry.id}`}>Title</label>
                                    <input
                                      id={`edit-title-${entry.id}`}
                                      className="input"
                                      value={editTitle}
                                      onChange={(e) => setEditTitle(e.target.value)}
                                    />
                                  </div>
                                  <div className="quick-add-macro-row">
                                    <div className="field">
                                      <label htmlFor={`edit-c-${entry.id}`}>Carbs (g)</label>
                                      <NumericInput
                                        id={`edit-c-${entry.id}`}
                                        className="input mono"
                                        min={0}
                                        max={600}
                                        fallback={0}
                                        value={editCarbs}
                                        onChange={(v) => handleEditMacroChange('c', v)}
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`edit-p-${entry.id}`}>Protein (g)</label>
                                      <NumericInput
                                        id={`edit-p-${entry.id}`}
                                        className="input mono"
                                        min={0}
                                        max={300}
                                        fallback={0}
                                        value={editProtein}
                                        onChange={(v) => handleEditMacroChange('p', v)}
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`edit-f-${entry.id}`}>Fat (g)</label>
                                      <NumericInput
                                        id={`edit-f-${entry.id}`}
                                        className="input mono"
                                        min={0}
                                        max={250}
                                        fallback={0}
                                        value={editFat}
                                        onChange={(v) => handleEditMacroChange('f', v)}
                                      />
                                    </div>
                                  </div>
                                  <div className="field" style={{ marginTop: 7 }}>
                                    <label htmlFor={`edit-kcal-${entry.id}`}>Calories (kcal)</label>
                                    <NumericInput
                                      id={`edit-kcal-${entry.id}`}
                                      className="input mono"
                                      min={0}
                                      max={5000}
                                      fallback={0}
                                      value={editKcal}
                                      onChange={setEditKcal}
                                    />
                                  </div>
                                </>
                              )}

                              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  style={{ flex: 1 }}
                                  onClick={() => handleSaveInlineLogEdit(entry)}
                                >
                                  Save Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => setEditingLogId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                      {slotLogs.length === 0 &&
                        onCopyYesterdayMeal &&
                        yesterdayMealLogs.some((l) => l.slot === slot.slot) && (
                          <button
                            type="button"
                            className="btn btn-sm btn-soft"
                            onClick={() => onCopyYesterdayMeal(slot.slot, slot.label)}
                          >
                            <Copy size={13} /> Repeat Yesterday
                          </button>
                        )}
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
          <div>
            <h2 className="section-title">Key Vitamins &amp; Minerals</h2>
            <span className="section-kicker">Tap any nutrient to inspect today&apos;s sources</span>
          </div>
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
            const isSelected = selectedMicroKey === m.key;
            return (
              <button
                type="button"
                className={`micro-item micro-item-btn ${isSelected ? 'selected' : ''}`}
                key={m.key}
                aria-pressed={isSelected}
                onClick={() => setSelectedMicroKey(isSelected ? null : m.key)}
              >
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
              </button>
            );
          })}
        </div>

        {/* v11: Tap-to-Inspect Micronutrient Contributors Drawer */}
        {selectedMicroKey && (() => {
          const activeMicro = microsList.find((m) => m.key === selectedMicroKey);
          if (!activeMicro) return null;
          const tipMeta = MICRO_TIPS[activeMicro.key];
          const contributors = logs
            .map((entry) => ({
              id: entry.id,
              title: entry.title,
              type: entry.type,
              amount: Number(entry.micros?.[activeMicro.key] || 0),
            }))
            .filter((c) => c.amount > 0)
            .sort((a, b) => b.amount - a.amount);

          return (
            <div className="micro-drawer" role="region" aria-label={`${activeMicro.label} contributors`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong style={{ fontSize: '0.78rem' }}>
                  Where today&apos;s {activeMicro.label} came from
                </strong>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Close nutrient breakdown"
                  onClick={() => setSelectedMicroKey(null)}
                >
                  <X size={14} />
                </button>
              </div>
              {contributors.length > 0 ? (
                <ul className="micro-contributor-list">
                  {contributors.map((c) => (
                    <li key={c.id}>
                      <span>
                        {c.title}
                        {c.type === 'supplement' && (
                          <span style={{ fontSize: '0.66rem', color: 'var(--code-high)', marginLeft: 5, fontWeight: 700 }}>
                            Supplement
                          </span>
                        )}
                      </span>
                      <span className="mono" style={{ fontWeight: 700 }}>
                        {Number(c.amount.toFixed(1))} {activeMicro.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted-text" style={{ fontSize: '0.73rem' }}>
                  Nothing logged yet — top quick sources: {tipMeta?.sources || 'whole foods or your daily stack'}.
                </p>
              )}
              {tipMeta?.tip && (
                <p className="muted-text" style={{ fontSize: '0.71rem', marginTop: 6, color: 'var(--code-high)' }}>
                  <strong>Pairing tip:</strong> {tipMeta.tip}
                </p>
              )}
            </div>
          );
        })()}

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
