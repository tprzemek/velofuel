import { formatLiquid, formatSodiumPractical, getUnits } from './units';

// Pro Cycling Fueling Engine
const INTENSITY_META = {
  rest: { label: 'Rest Day', ifEst: 0, carbFractionBurn: 0 },
  recovery: { label: 'Recovery Spin', ifEst: 0.52, carbFractionBurn: 0.3 },
  endurance: { label: 'Zone 2 Endurance', ifEst: 0.68, carbFractionBurn: 0.48 },
  tempo: { label: 'Tempo / Aerobic', ifEst: 0.8, carbFractionBurn: 0.65 },
  sweetspot: { label: 'Sweet Spot', ifEst: 0.87, carbFractionBurn: 0.78 },
  threshold: { label: 'Threshold / FTP', ifEst: 0.93, carbFractionBurn: 0.88 },
  vo2max: { label: 'VO2max Intervals', ifEst: 0.96, carbFractionBurn: 0.92 },
  race: { label: 'Race / Epic', ifEst: 0.9, carbFractionBurn: 0.86 },
};

export const INTENSITY_OPTIONS = Object.entries(INTENSITY_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const FUEL_CATEGORY_META = {
  REST: { label: 'Rest & Repair', badge: 'LOW', color: 'low', gPerKgRange: '2.5–3.5 g/kg' },
  LOW: { label: 'Light Fuel', badge: 'LOW', color: 'low', gPerKgRange: '3.5–4.5 g/kg' },
  MODERATE: { label: 'Steady Fuel', badge: 'MED', color: 'med', gPerKgRange: '5.0–6.5 g/kg' },
  HIGH: { label: 'High Performance', badge: 'HIGH', color: 'high', gPerKgRange: '6.5–8.5 g/kg' },
  VERY_HIGH: { label: 'Max Glycogen', badge: 'MAX', color: 'max', gPerKgRange: '8.5–11 g/kg' },
};

export const BOTTLE_SIZE_OPTIONS = [500, 550, 650, 750, 950];

export function estimateSessionKj(session, ftp = 290) {
  if (!session || session.intensity === 'rest' || !session.durationMin) return 0;
  if (session.status === 'completed' && session.actualKj > 0) return Math.round(session.actualKj);
  if (session.plannedKj > 0) return Math.round(session.plannedKj);
  const meta = INTENSITY_META[session.intensity] || INTENSITY_META.endurance;
  const avgWatts = meta.ifEst * ftp * 0.92;
  return Math.round((avgWatts * session.durationMin * 60) / 1000);
}

// Cycling Efficiency varies 18–24%.
// Metabolic kcal = Mechanical kJ / (4.184 * GE). At 23.9% => 1 kJ = 1.00 kcal; at 22% => 1.09 kcal.
export function kjToMetabolicKcal(kj, grossEfficiencyPct = 22.0) {
  if (!kj || kj <= 0) return 0;
  const clampedGe = Math.min(26, Math.max(17, Number(grossEfficiencyPct) || 22)) / 100;
  return Math.round(kj / (4.184 * clampedGe));
}

export function classifySessionCategory(session, exerciseKcal) {
  if (!session || session.intensity === 'rest' || !session.durationMin || exerciseKcal < 130) return 'REST';
  if (exerciseKcal >= 2250 || session.intensity === 'race' || session.durationMin >= 200) return 'VERY_HIGH';
  if (exerciseKcal >= 1350 || session.intensity === 'threshold' || session.intensity === 'vo2max') return 'HIGH';
  if (exerciseKcal >= 620 || session.intensity === 'tempo' || session.intensity === 'sweetspot' || session.durationMin >= 85) {
    return 'MODERATE';
  }
  return 'LOW';
}

// Expenditure-matched & progressive on-bike fueling with custom bottle sizes and practical salt/tablet recipes
export function computeOnBikePlan(session, category, exerciseKcal, options = {}) {
  if (!session || !session.durationMin || session.intensity === 'rest') {
    return null;
  }
  const hrs = session.durationMin / 60;
  const kcalPerHr = exerciseKcal / Math.max(hrs, 0.25);
  const meta = INTENSITY_META[session.intensity] || INTENSITY_META.endurance;
  const bottleSizeMl = Math.max(300, Number(session.bottleSizeMl || options.defaultBottleMl) || 650);
  const tabletMg = Math.max(100, Number(options.electrolyteTabMg) || 500);
  const units = options.units || getUnits();

  // Estimate carbohydrate burn per hour (g/hr)
  const carbBurnGPerHr = (kcalPerHr * meta.carbFractionBurn) / 4;

  let carbsPerHour = 0;
  let progressiveRamp = null;

  if (session.durationMin <= 55 && (session.intensity === 'recovery' || session.intensity === 'endurance')) {
    carbsPerHour = 0;
  } else if (session.durationMin <= 75) {
    carbsPerHour = session.intensity === 'threshold' || session.intensity === 'vo2max'
      ? Math.round(Math.min(55, Math.max(30, carbBurnGPerHr * 0.35)) / 5) * 5
      : Math.round(Math.min(35, Math.max(20, carbBurnGPerHr * 0.28)) / 5) * 5;
  } else {
    const replaceFraction = category === 'VERY_HIGH' ? 0.56 : category === 'HIGH' ? 0.5 : 0.44;
    const rawRate = carbBurnGPerHr * replaceFraction;
    const cap = category === 'VERY_HIGH' ? 95 : category === 'HIGH' ? 85 : 65;
    carbsPerHour = Math.round(Math.min(cap, Math.max(30, rawRate)) / 5) * 5;

    if (session.durationMin >= 150 && carbsPerHour >= 60) {
      const hr1 = Math.max(45, Math.round((carbsPerHour * 0.78) / 5) * 5);
      const hr2Plus = Math.min(100, Math.round((carbsPerHour * 1.1) / 5) * 5);
      progressiveRamp = `Hr 1: ${hr1}g → Hr 2+: ${hr2Plus}g/h`;
    }
  }

  const totalCarbs = Math.round(carbsPerHour * hrs);
  const fluidMlPerHr = category === 'HIGH' || category === 'VERY_HIGH' ? 700 : 550;
  const totalFluidMl = Math.round(fluidMlPerHr * hrs);
  const sodiumMgPerHr = category === 'HIGH' || category === 'VERY_HIGH' ? 650 : 450;
  const totalSodiumMg = Math.round(sodiumMgPerHr * hrs);
  const bottles = Math.max(1, Math.ceil(totalFluidMl / bottleSizeMl));
  const carbsPerBottle = Math.round(totalCarbs / bottles);
  const sodiumPerBottleMg = Math.round(totalSodiumMg / bottles);
  const bottleLabel = formatLiquid(bottleSizeMl, units);
  const bottleSaltText = formatSodiumPractical(sodiumPerBottleMg, tabletMg);

  let note = `Short easy spin — ${bottles}× ${bottleLabel} water + ${bottleSaltText} per bottle. Save carbs for meals.`;
  if (carbsPerHour > 60) {
    note = `${bottles}× ${bottleLabel} bottles (~${carbsPerBottle}g carbs + ${bottleSaltText} per bottle, or split with gels). ${
      progressiveRamp ? `Gradual ramp: ${progressiveRamp}.` : 'Sip steadily every 15 min.'
    }`;
  } else if (carbsPerHour > 0) {
    note = `${bottles}× ${bottleLabel} bottle${bottles > 1 ? 's' : ''} (~${carbsPerBottle}g carbs + ${bottleSaltText} per bottle) matched to ~${Math.round(kcalPerHr)} kcal/h burn.`;
  }

  return {
    carbsPerHour,
    totalCarbs,
    totalKcal: totalCarbs * 4,
    kcalPerHr: Math.round(kcalPerHr),
    progressiveRamp,
    fluidMlPerHr,
    totalFluidMl,
    bottleSizeMl,
    bottleLabel,
    carbsPerBottle,
    sodiumMgPerHr,
    totalSodiumMg,
    sodiumPerBottleMg,
    bottleSaltText,
    bottles,
    note,
  };
}

export function computeBmr(profile, weightKg) {
  const w = weightKg || profile.defaultWeightKg || 74;
  const h = profile.heightCm || 179;
  const a = profile.age || 34;
  const sexOffset = profile.sex === 'female' ? -161 : 5;
  return 10 * w + 6.25 * h - 5 * a + sexOffset;
}

export function computeDailyPlan({
  date,
  profile,
  biometricsSummary,
  todaySession,
  tomorrowSession,
  yesterdaySession,
  dayMeals,
  dayTimelineOrder,
}) {
  const weightKg = biometricsSummary?.trendWeightKg || profile.defaultWeightKg || 74;
  const bodyFatPct = biometricsSummary?.latestBodyFatPct || profile.defaultBodyFatPct || 15;
  const leanMassKg = biometricsSummary?.leanMassKg || weightKg * (1 - bodyFatPct / 100);
  const gePct = profile.grossEfficiencyPct || 22.0;

  const exerciseKj = estimateSessionKj(todaySession, profile.ftp);
  const exerciseKcal = kjToMetabolicKcal(exerciseKj, gePct);
  const rideHours = todaySession && todaySession.intensity !== 'rest' ? (todaySession.durationMin || 0) / 60 : 0;
  const nonExerciseHours = Math.max(12, Number((24 - rideHours).toFixed(1)));

  const category = classifySessionCategory(todaySession, exerciseKcal);

  const tomorrowKj = estimateSessionKj(tomorrowSession, profile.ftp);
  const tomorrowKcal = kjToMetabolicKcal(tomorrowKj, gePct);
  const tomorrowCategory = classifySessionCategory(tomorrowSession, tomorrowKcal);
  const needsTomorrowPreload = tomorrowCategory === 'HIGH' || tomorrowCategory === 'VERY_HIGH';

  const yesterdayKj = estimateSessionKj(yesterdaySession, profile.ftp);
  const yesterdayKcal = kjToMetabolicKcal(yesterdayKj, gePct);
  const yesterdayCategory = classifySessionCategory(yesterdaySession, yesterdayKcal);
  const recoveryCarryover = yesterdayCategory === 'VERY_HIGH';

  // Tim Podlogar Non-Exercise-Hours RMR correction:
  // Only apply RMR * activity factor (1.25–1.45) to the hours NOT spent riding so we never double-count RMR during exercise!
  const bmr24h = computeBmr(profile, weightKg);
  const activityMult =
    profile.activityLevel === 'active' ? 1.45 : profile.activityLevel === 'light' ? 1.35 : 1.25;
  const full24hOffBike = Math.round(bmr24h * activityMult);
  const offBikeTdee = Math.round(
    bmr24h * (nonExerciseHours / 24) * activityMult + (profile.tdeeAdjustmentKcal || 0)
  );
  const avoidedDoubleCountKcal = Math.max(0, full24hOffBike - Math.round(bmr24h * (nonExerciseHours / 24) * activityMult));
  const totalTdee = offBikeTdee + exerciseKcal;

  // Lean-floor caution (Kolie Moore / Tim Podlogar: below lean floor, cutting impairs hormones & recovery)
  const leanFloorBf = profile.sex === 'female' ? 16.5 : 8.5;
  const nearLeanFloor = profile.goalMode === 'cut' && bodyFatPct <= leanFloorBf;

  // Smart Periodized Deficit (Weight loss on Rest/Easy days, capped <= 650 kcal, protect Hard/Race sessions)
  let plannedDeficit = 0;
  let deficitStrategyNote = 'Energy balance matched to today’s exact ride burn and off-bike hours.';

  if (profile.goalMode === 'cut') {
    const avgDailyDeficit = Math.round(((profile.targetLossKgPerWeek || 0.35) * 7700) / 7);
    const multByCat = {
      REST: 1.35,
      LOW: 1.25,
      MODERATE: 0.85,
      HIGH: 0.2,
      VERY_HIGH: 0,
    };
    const capByCat = {
      REST: 600,
      LOW: 550,
      MODERATE: 450,
      HIGH: 150,
      VERY_HIGH: 0,
    };
    plannedDeficit = Math.min(Math.round(avgDailyDeficit * multByCat[category]), capByCat[category]);
    if (needsTomorrowPreload && (category === 'REST' || category === 'LOW')) {
      plannedDeficit = Math.round(plannedDeficit * 0.55);
      deficitStrategyNote = `Lighter deficit (-${plannedDeficit} kcal) because tomorrow is ${tomorrowSession?.title || 'a key session'} — prioritizing glycogen readiness.`;
    } else if (category === 'HIGH' || category === 'VERY_HIGH') {
      deficitStrategyNote = `Key session day — deficit paused (${plannedDeficit > 0 ? `-${plannedDeficit} kcal` : '0 kcal'}) so watts & recovery stay sharp.`;
    } else {
      deficitStrategyNote = `Smart cut (-${plannedDeficit} kcal, capped ≤600 kcal) placed on low-demand work while protecting muscle & training quality.`;
    }
  } else if (profile.goalMode === 'carb_load') {
    plannedDeficit = -650;
    deficitStrategyNote = '24h Race Carb Load: ~10 g/kg low-fiber carbs, low fat (0.65 g/kg), deliberate 24h surplus to fill energy stores.';
  }

  let targetKcal = totalTdee - plannedDeficit;

  // Low-fuel safety floor to protect recovery and muscle mass
  const minSafeIntake = Math.round(32 * leanMassKg + exerciseKcal);
  let eaGuardTriggered = false;
  if (targetKcal < minSafeIntake) {
    targetKcal = minSafeIntake;
    plannedDeficit = totalTdee - targetKcal;
    eaGuardTriggered = true;
    deficitStrategyNote = `Cut trimmed to -${Math.max(0, plannedDeficit)} kcal to keep enough fuel above your ride burn for recovery and muscle.`;
  }

  // Macros calibrated to BOTH bodyweight (g/kg) AND total energy (% kcal)
  const proteinPerKg =
    profile.goalMode === 'cut'
      ? profile.proteinGPerKgCut || 2.0
      : profile.goalMode === 'carb_load'
      ? 1.7
      : profile.proteinGPerKgMaintain || 1.75;
  // Cap protein so it doesn't crowd out carbs on very high-demand days
  const proteinG = Math.round(Math.min(weightKg * proteinPerKg, leanMassKg * 2.4, (targetKcal * 0.34) / 4));

  // Fat: dual floor (g/kg AND ~20% baseline non-exercise kcal), capped on high-carb / carb-load days
  const fatPerKgByCat = {
    REST: 1.05,
    LOW: 1.0,
    MODERATE: 0.95,
    HIGH: 0.9,
    VERY_HIGH: 0.85,
  };
  let fatPerKg = profile.goalMode === 'carb_load' ? 0.65 : fatPerKgByCat[category];
  if (profile.goalMode === 'cut' && (category === 'REST' || category === 'LOW')) {
    fatPerKg = Math.max(0.82, fatPerKg - 0.12);
  }
  const minFatFromTotalEnergy = profile.goalMode === 'carb_load' ? Math.round(weightKg * 0.6) : Math.round((offBikeTdee * 0.22) / 9);
  const maxFatCap = profile.goalMode === 'carb_load' ? Math.round(weightKg * 0.72) : Math.round((targetKcal * 0.33) / 9);
  let fatG = Math.round(Math.min(maxFatCap, Math.max(minFatFromTotalEnergy, weightKg * fatPerKg)));

  // Carbs fill the remaining energy, subject to daily cycling minimums
  let carbsG = Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4);
  const minCarbPerKg =
    profile.goalMode === 'carb_load'
      ? 10.0
      : { REST: 2.5, LOW: 3.4, MODERATE: 4.8, HIGH: 6.3, VERY_HIGH: 8.2 }[category] +
        (needsTomorrowPreload && category !== 'VERY_HIGH' ? 0.7 : 0) +
        (recoveryCarryover ? 0.4 : 0);

  const minCarbsG = Math.round(weightKg * minCarbPerKg);
  if (carbsG < minCarbsG) {
    const fatFloor = profile.goalMode === 'carb_load' ? Math.round(weightKg * 0.6) : Math.round(weightKg * 0.8);
    const freedFatKcal = Math.max(0, (fatG - fatFloor) * 9);
    const neededKcal = (minCarbsG - carbsG) * 4;
    if (freedFatKcal >= neededKcal) {
      fatG = Math.round(fatG - neededKcal / 9);
      carbsG = minCarbsG;
    } else {
      fatG = fatFloor;
      carbsG = minCarbsG;
      targetKcal = carbsG * 4 + proteinG * 4 + fatG * 9;
    }
  }

  targetKcal = carbsG * 4 + proteinG * 4 + fatG * 9;
  const energyAvailability = Number(((targetKcal - exerciseKcal) / Math.max(leanMassKg, 40)).toFixed(1));
  const onBikePlan = computeOnBikePlan(todaySession, category, exerciseKcal, {
    defaultBottleMl: profile.defaultBottleMl || 650,
    electrolyteTabMg: profile.electrolyteTabMg || 500,
    units: getUnits(profile),
  });

  // Plain-English Nutrient Timing Tips
  const leadHrs = Number(profile.preRideLeadHours || 2);
  const preRideCarbTargetG = Math.round(weightKg * Math.min(3.5, Math.max(1.0, leadHrs)));
  const hasRide = Boolean(todaySession && todaySession.durationMin > 0 && todaySession.intensity !== 'rest');

  const timingCoaching = {
    preRideCue:
      hasRide && (todaySession.timing === 'morning' || category === 'HIGH' || category === 'VERY_HIGH')
        ? `Aim for ~${preRideCarbTargetG}g carbs (${leadHrs}h before). Include fruit, honey, or yogurt/milk for quick energy; keep fat and fiber light.`
        : null,
    postRideCue: !hasRide
      ? null
      : needsTomorrowPreload
      ? `Hard ride tomorrow: refuel within 45 min (~${Math.round(weightKg * 1.1)}g carbs from starch + fruit/juice + 30g protein, low fat) so your energy stores refill overnight.`
      : `Tomorrow is easy/rest: eat a normal protein + carb meal soon after riding to avoid evening cravings — no extra sugar loading needed.`,
  };

  const meals = buildMealTimeline({
    category,
    todaySession,
    needsTomorrowPreload,
    carbsG,
    proteinG,
    fatG,
    onBikePlan,
    dayMeals,
    timelineOrder: dayTimelineOrder || todaySession?.timelineOrder || profile.defaultTimelineOrder,
  });

  const microTargets = {
    fiber: category === 'VERY_HIGH' || profile.goalMode === 'carb_load' ? 20 : 34,
    iron: profile.sex === 'female' ? 18 : 11,
    vitC: profile.sex === 'female' ? 75 : 90,
    calcium: 1100,
    vitD: 15,
    magnesium: profile.sex === 'female' ? 350 : 420,
    sodium: profile.goalMode === 'carb_load' ? 1800 : 2300 + (onBikePlan ? onBikePlan.totalSodiumMg : 0),
  };

  return {
    date,
    weightKg,
    leanMassKg: Number(leanMassKg.toFixed(1)),
    grossEfficiencyPct: gePct,
    exerciseKj,
    exerciseKcal,
    rideHours: Number(rideHours.toFixed(2)),
    nonExerciseHours,
    avoidedDoubleCountKcal,
    offBikeTdee,
    totalTdee,
    plannedDeficit: totalTdee - targetKcal,
    deficitStrategyNote,
    eaGuardTriggered,
    nearLeanFloor,
    energyAvailability,
    category,
    categoryMeta: FUEL_CATEGORY_META[category],
    tomorrowCategory,
    needsTomorrowPreload,
    tomorrowTitle: tomorrowSession?.title || null,
    timingCoaching,
    targets: {
      kcal: targetKcal,
      carbs: carbsG,
      protein: proteinG,
      fat: fatG,
      carbsPerKg: Number((carbsG / weightKg).toFixed(1)),
      proteinPerKg: Number((proteinG / weightKg).toFixed(1)),
      fatPerKg: Number((fatG / weightKg).toFixed(1)),
      carbsPct: Math.round(((carbsG * 4) / Math.max(targetKcal, 1)) * 100),
      proteinPct: Math.round(((proteinG * 4) / Math.max(targetKcal, 1)) * 100),
      fatPct: Math.round(((fatG * 9) / Math.max(targetKcal, 1)) * 100),
    },
    onBikePlan,
    meals,
    microTargets,
  };
}

export const DEFAULT_MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast', kind: 'breakfast', size: 'meal', location: 'Home' },
  { id: 'lunch', label: 'Lunch', kind: 'lunch', size: 'meal', location: 'Work / Home' },
  { id: 'snack', label: 'Snack', kind: 'snack', size: 'snack', location: 'Home / Work' },
  { id: 'dinner', label: 'Dinner', kind: 'dinner', size: 'meal', location: 'Home (Auto-Balances Day)' },
];

export const DEFAULT_TIMELINE_ORDER = ['breakfast', 'lunch', 'snack', 'on_bike', 'dinner'];

function inferTimingFromOrder(order, fallbackTiming = 'evening') {
  if (!Array.isArray(order)) return fallbackTiming;
  const idx = order.indexOf('on_bike');
  if (idx < 0) return fallbackTiming;
  const ratio = idx / Math.max(order.length - 1, 1);
  if (ratio <= 0.3) return 'morning';
  if (ratio <= 0.6) return 'midday';
  return 'evening';
}

function distributeByWeights(total, weights) {
  const sum = weights.reduce((acc, w) => acc + Math.max(0.01, w), 0);
  if (sum <= 0 || weights.length === 0) return [];
  const raw = weights.map((w) => Math.round(total * (Math.max(0.01, w) / sum)));
  const diff = total - raw.reduce((a, b) => a + b, 0);
  if (raw.length > 0) {
    raw[raw.length - 1] = Math.max(0, raw[raw.length - 1] + diff);
  }
  return raw;
}

function buildMealTimeline({
  category,
  todaySession,
  needsTomorrowPreload,
  carbsG,
  proteinG,
  fatG,
  onBikePlan,
  dayMeals,
  timelineOrder,
}) {
  const hasRide = Boolean(todaySession && todaySession.durationMin > 0 && todaySession.intensity !== 'rest');
  const timing = inferTimingFromOrder(timelineOrder, todaySession?.timing || 'evening');
  const onBikeCarbs = onBikePlan?.totalCarbs || 0;
  const offBikeCarbs = Math.max(80, carbsG - onBikeCarbs);

  const activeMealDefs =
    Array.isArray(dayMeals) && dayMeals.length > 0 ? dayMeals : DEFAULT_MEAL_SLOTS;

  let baseCWeights = { breakfast: 0.25, lunch: 0.3, snack: 0.15, dinner: 0.3 };
  if (hasRide && timing === 'morning') {
    baseCWeights = { breakfast: 0.3, lunch: 0.3, snack: 0.16, dinner: 0.24 };
  } else if (hasRide && timing === 'evening') {
    baseCWeights = { breakfast: 0.23, lunch: 0.29, snack: 0.2, dinner: 0.28 };
  }
  const basePWeights = { breakfast: 0.25, lunch: 0.28, snack: 0.18, dinner: 0.29 };
  const baseFWeights = { breakfast: 0.26, lunch: 0.32, snack: 0.12, dinner: 0.3 };

  // Build ordered list of active meal definitions respecting timelineOrder
  const mealDefsById = new Map(activeMealDefs.map((m) => [m.id, m]));
  let orderedMealIds;
  if (Array.isArray(timelineOrder) && timelineOrder.length > 0) {
    orderedMealIds = timelineOrder.filter((id) => mealDefsById.has(id));
    for (const m of activeMealDefs) {
      if (!orderedMealIds.includes(m.id)) orderedMealIds.push(m.id);
    }
  } else {
    orderedMealIds = activeMealDefs.map((m) => m.id);
  }

  const orderedMealDefs = orderedMealIds.map((id) => mealDefsById.get(id)).filter(Boolean);
  const preloadTargetId = mealDefsById.has('dinner')
    ? 'dinner'
    : orderedMealDefs[orderedMealDefs.length - 1]?.id || null;

  const rawCW = orderedMealDefs.map((m) => {
    let w =
      baseCWeights[m.kind] ??
      (m.size === 'snack' ? 0.16 : 0.28);
    if (needsTomorrowPreload && m.id === preloadTargetId) {
      w += 0.08;
    }
    return w;
  });
  const rawPW = orderedMealDefs.map(
    (m) => basePWeights[m.kind] ?? (m.size === 'snack' ? 0.16 : 0.28)
  );
  const rawFW = orderedMealDefs.map(
    (m) => baseFWeights[m.kind] ?? (m.size === 'snack' ? 0.12 : 0.28)
  );

  const allocC = distributeByWeights(offBikeCarbs, rawCW);
  const allocP = distributeByWeights(proteinG, rawPW);
  const allocF = distributeByWeights(fatG, rawFW);

  const codeForCarbs = (g) => {
    if (g >= 85) return 'HIGH';
    if (g >= 50) return 'MED';
    return 'LOW';
  };

  const slotsById = {};
  orderedMealDefs.forEach((m, i) => {
    let label = m.label;
    let timeHint = m.size === 'snack' ? 'Snack' : 'Meal';
    if (m.kind === 'breakfast') {
      label = hasRide && timing === 'morning' ? 'Pre-Ride Breakfast' : m.label || 'Breakfast';
      timeHint = hasRide && timing === 'morning' ? 'Light & quick energy · Low fiber' : 'Morning';
    } else if (m.kind === 'lunch') {
      label = m.label || 'Lunch';
      timeHint = 'Midday';
    } else if (m.kind === 'snack') {
      label = hasRide ? (timing === 'evening' ? 'Pre-Ride Snack' : 'Post-Ride Recovery') : 'Afternoon Snack';
      timeHint = hasRide && timing === 'evening' ? '90m before · Low fat' : hasRide ? 'Within 45m · Low fat' : 'Afternoon';
    } else if (m.kind === 'dinner') {
      label = needsTomorrowPreload ? 'Dinner (Pre-Load)' : m.label || 'Dinner';
      timeHint = 'Evening';
    }

    slotsById[m.id] = {
      slot: m.id,
      kind: m.kind || 'custom',
      size: m.size || 'meal',
      label,
      baseLabel: m.label,
      location: m.location || 'Home / Work',
      timeHint,
      isPreloadTarget: needsTomorrowPreload && m.id === preloadTargetId,
      isLastMeal: i === orderedMealDefs.length - 1,
      targetCarbs: allocC[i] ?? 0,
      targetProtein: allocP[i] ?? 0,
      targetFat: allocF[i] ?? 0,
    };
  });

  if (hasRide && onBikePlan) {
    slotsById.on_bike = {
      slot: 'on_bike',
      kind: 'on_bike',
      label: 'Training · On-Bike Fuel',
      baseLabel: 'Training',
      location: 'During Ride',
      timeHint:
        onBikeCarbs > 0
          ? onBikePlan.progressiveRamp || `${onBikePlan.carbsPerHour}g/hr · ${todaySession.durationMin}m`
          : `Water + electrolytes · ${todaySession.durationMin}m`,
      targetCarbs: onBikeCarbs,
      targetProtein: 0,
      targetFat: 0,
      carbCode: onBikePlan.carbsPerHour >= 70 ? 'HIGH' : onBikeCarbs > 0 ? 'MED' : 'LOW',
      targetKcal: onBikeCarbs * 4,
    };
  }

  // Respect user's custom card placement order (filtering out any removed meals!)
  let effectiveOrder;
  if (Array.isArray(timelineOrder) && timelineOrder.length > 0) {
    effectiveOrder = timelineOrder.filter((id) => Boolean(slotsById[id]));
    for (const id of Object.keys(slotsById)) {
      if (!effectiveOrder.includes(id)) effectiveOrder.push(id);
    }
  } else {
    effectiveOrder = [...orderedMealIds];
    if (slotsById.on_bike) {
      const insertIdx = Math.min(
        effectiveOrder.length,
        timing === 'morning' ? 1 : timing === 'midday' ? 2 : Math.max(0, effectiveOrder.length - 1)
      );
      effectiveOrder.splice(insertIdx, 0, 'on_bike');
    }
  }

  const orderedSlots = effectiveOrder.map((id) => slotsById[id]).filter(Boolean);

  return orderedSlots.map((s) => ({
    ...s,
    carbCode:
      s.carbCode ||
      (category === 'REST' && !needsTomorrowPreload
        ? s.targetCarbs >= 55
          ? 'MED'
          : 'LOW'
        : codeForCarbs(s.targetCarbs)),
    targetKcal: s.targetKcal ?? s.targetCarbs * 4 + s.targetProtein * 4 + s.targetFat * 9,
  }));
}

// Suggest a smart meal for any meal slot tailored to today's carb demand
export function suggestMealForSlot(slot, staples = [], category = 'MODERATE', remainingMacros = null) {
  if (!slot || !Array.isArray(staples) || staples.length === 0) return null;
  const effectiveType = slot.kind === 'custom' ? (slot.size === 'snack' ? 'snack' : 'lunch') : slot.slot;
  const pinned = staples.find((s) => s.dailySlot === slot.slot || s.dailySlot === effectiveType);
  const slotMatches = staples.filter((s) => s.mealTypes?.includes(slot.slot) || s.mealTypes?.includes(effectiveType));
  const candidates = slotMatches.length > 0 ? slotMatches : staples;

  let chosen = pinned;
  if (!chosen) {
    const isLowCarbDay = category === 'REST' || category === 'LOW';
    if (effectiveType === 'breakfast' && isLowCarbDay) {
      chosen = candidates.find((s) => /egg|avocado|yogurt/i.test(s.name)) || candidates[0];
    } else if (effectiveType === 'breakfast') {
      chosen = candidates.find((s) => /oat|banana|honey/i.test(s.name)) || candidates[0];
    } else if (effectiveType === 'dinner' && !isLowCarbDay) {
      chosen = candidates.find((s) => /rice|pasta/i.test(s.name)) || candidates[0];
    } else if (effectiveType === 'dinner' && isLowCarbDay) {
      chosen = candidates.find((s) => /salmon|chicken/i.test(s.name)) || candidates[0];
    } else {
      chosen = candidates[0];
    }
  }

  const useRemaining = Boolean((slot.slot === 'dinner' || slot.isLastMeal) && remainingMacros);
  const targetC = useRemaining ? Math.max(25, Math.round(remainingMacros.carbs)) : slot.targetCarbs;
  const targetP = useRemaining ? Math.max(25, Math.round(remainingMacros.protein)) : slot.targetProtein;

  const scaled = scaleStapleToTargets(chosen, targetC, targetP);
  return {
    staple: chosen,
    scaled,
    reason: pinned
      ? 'Your pinned favorite, portioned for today'
      : useRemaining
      ? 'Auto-balanced to close out today’s remaining macros'
      : category === 'HIGH' || category === 'VERY_HIGH'
      ? 'High-carb match for today’s hard session'
      : 'Balanced match for today’s targets',
  };
}

// Flexible Ingredient-List Staple Auto-Scaling
// Works whether a meal has 0, 1, or multiple 'carb' and 'protein' ingredients (e.g., just Oats + Berries!)
export function scaleStapleToTargets(staple, targetCarbs, targetProtein) {
  const ingredients = Array.isArray(staple?.ingredients) ? staple.ingredients : [];
  const gramsById = {};
  ingredients.forEach((ing) => {
    gramsById[ing.id] = ing.grams || 100;
  });

  // 1. Scale 'carb' tagged ingredients proportionally to hit targetCarbs
  const carbIngs = ingredients.filter((i) => i.role === 'carb' && (i.per100g?.carbs || 0) > 0);
  const nonCarbIngs = ingredients.filter((i) => !carbIngs.includes(i));
  const fixedCarbs = nonCarbIngs.reduce((s, i) => s + ((i.grams || 0) / 100) * (i.per100g?.carbs || 0), 0);
  const baselineCarbPool = carbIngs.reduce((s, i) => s + ((i.grams || 0) / 100) * (i.per100g?.carbs || 0), 0);

  if (carbIngs.length > 0 && baselineCarbPool > 0) {
    const neededCarbs = Math.max(10, targetCarbs - fixedCarbs);
    const ratio = neededCarbs / baselineCarbPool;
    carbIngs.forEach((ing) => {
      const minG = ing.minGrams ?? Math.max(10, Math.round((ing.grams || 60) * 0.4));
      const maxG = ing.maxGrams ?? Math.max((ing.grams || 60) + 100, Math.round((ing.grams || 60) * 2.4));
      const scaled = Math.round(Math.min(maxG, Math.max(minG, (ing.grams || 60) * ratio)) / 5) * 5;
      gramsById[ing.id] = Math.max(5, scaled);
    });
  }

  // 2. Scale 'protein' tagged ingredients (if any exist in this meal!) to hit targetProtein
  const protIngs = ingredients.filter((i) => i.role === 'protein' && (i.per100g?.protein || 0) > 0);
  const nonProtIngs = ingredients.filter((i) => !protIngs.includes(i));
  const otherProtein = nonProtIngs.reduce(
    (s, i) => s + ((gramsById[i.id] || 0) / 100) * (i.per100g?.protein || 0),
    0
  );
  const baselineProtPool = protIngs.reduce((s, i) => s + ((i.grams || 0) / 100) * (i.per100g?.protein || 0), 0);

  if (protIngs.length > 0 && baselineProtPool > 0) {
    const neededProt = Math.max(8, targetProtein - otherProtein);
    const ratio = neededProt / baselineProtPool;
    protIngs.forEach((ing) => {
      const minG = ing.minGrams ?? Math.max(15, Math.round((ing.grams || 100) * 0.45));
      const maxG = ing.maxGrams ?? Math.max((ing.grams || 100) + 90, Math.round((ing.grams || 100) * 2.1));
      const scaled = Math.round(Math.min(maxG, Math.max(minG, (ing.grams || 100) * ratio)) / 5) * 5;
      gramsById[ing.id] = Math.max(5, scaled);
    });
  }

  return computeStapleNutrition(staple, gramsById);
}

export function computeStapleNutrition(staple, gramsById = {}) {
  const ingredients = Array.isArray(staple?.ingredients) ? staple.ingredients : [];
  let carbs = 0;
  let protein = 0;
  let fat = 0;
  const micros = { fiber: 0, iron: 0, vitC: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 0 };
  const resolvedItems = [];

  for (const ing of ingredients) {
    const g = gramsById[ing.id] !== undefined ? Number(gramsById[ing.id]) : Number(ing.grams || 0);
    const f = Math.max(0, g) / 100;
    const p = ing.per100g || {};
    carbs += (p.carbs || 0) * f;
    protein += (p.protein || 0) * f;
    fat += (p.fat || 0) * f;
    micros.fiber += (p.fiber || 0) * f;
    micros.iron += (p.iron || 0) * f;
    micros.vitC += (p.vitC || 0) * f;
    micros.calcium += (p.calcium || 0) * f;
    micros.vitD += (p.vitD || 0) * f;
    micros.magnesium += (p.magnesium || 0) * f;
    micros.sodium += (p.sodium || 0) * f;
    if (g > 0) {
      resolvedItems.push({ ...ing, grams: Math.round(g) });
    }
  }

  const rCarbs = Math.round(carbs);
  const rProt = Math.round(protein);
  const rFat = Math.round(fat);
  const kcal = rCarbs * 4 + rProt * 4 + rFat * 9;

  return {
    gramsById,
    resolvedItems,
    carbs: rCarbs,
    protein: rProt,
    fat: rFat,
    kcal,
    micros: {
      fiber: Number(micros.fiber.toFixed(1)),
      iron: Number(micros.iron.toFixed(1)),
      vitC: Math.round(micros.vitC),
      calcium: Math.round(micros.calcium),
      vitD: Number(micros.vitD.toFixed(1)),
      magnesium: Math.round(micros.magnesium),
      sodium: Math.round(micros.sodium),
    },
    detail: resolvedItems.map((i) => `${i.grams}g ${i.name}`).join(' · '),
  };
}

export function sumDailyLogs(logs = []) {
  return logs.reduce(
    (acc, entry) => {
      const unc = entry.uncertaintyPct || 0;
      const kcalRange = Math.round((entry.kcal || 0) * (unc / 100));
      const carbRange = Math.round((entry.carbs || 0) * (unc / 100));
      return {
        kcal: acc.kcal + (entry.kcal || 0),
        carbs: acc.carbs + (entry.carbs || 0),
        protein: acc.protein + (entry.protein || 0),
        fat: acc.fat + (entry.fat || 0),
        kcalUncertainty: acc.kcalUncertainty + kcalRange,
        carbUncertainty: acc.carbUncertainty + carbRange,
        hasEstimates: acc.hasEstimates || unc > 0,
        micros: {
          fiber: Number((acc.micros.fiber + (entry.micros?.fiber || 0)).toFixed(1)),
          iron: Number((acc.micros.iron + (entry.micros?.iron || 0)).toFixed(1)),
          vitC: Math.round(acc.micros.vitC + (entry.micros?.vitC || 0)),
          calcium: Math.round(acc.micros.calcium + (entry.micros?.calcium || 0)),
          vitD: Number((acc.micros.vitD + (entry.micros?.vitD || 0)).toFixed(1)),
          magnesium: Math.round(acc.micros.magnesium + (entry.micros?.magnesium || 0)),
          sodium: Math.round(acc.micros.sodium + (entry.micros?.sodium || 0)),
        },
      };
    },
    {
      kcal: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
      kcalUncertainty: 0,
      carbUncertainty: 0,
      hasEstimates: false,
      micros: { fiber: 0, iron: 0, vitC: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 0 },
    }
  );
}
