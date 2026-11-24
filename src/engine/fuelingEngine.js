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

export const SPORT_OPTIONS = [
  { value: 'Ride', label: 'Cycling / Ride', kind: 'ride' },
  { value: 'WeightTraining', label: 'Gym / Strength', kind: 'strength' },
  { value: 'Run', label: 'Running', kind: 'run' },
  { value: 'Swim', label: 'Swimming', kind: 'swim' },
  { value: 'Yoga', label: 'Yoga / Mobility', kind: 'other' },
  { value: 'Workout', label: 'Other Workout', kind: 'other' },
  { value: 'Rest', label: 'Rest Day', kind: 'rest' },
];

export function normalizeSportKind(sport = '', title = '') {
  const s = String(sport || '').toLowerCase();
  const t = String(title || '').toLowerCase();
  if (s === 'rest') return 'rest';
  if (/ride|cycl|bike|spin|zwift|velomobile|handcycle/.test(s)) return 'ride';
  if (/weight|strength|gym|crossfit|kettlebell|lift/.test(s) || /\b(gym|strength|weights|lifting|kettlebell|core)\b/.test(t)) {
    return 'strength';
  }
  if (/run|trail|jog/.test(s)) return 'run';
  if (/swim/.test(s)) return 'swim';
  if (/yoga|pilates|walk|hike|row|ski|mobility|stretch|other|workout|hiit|elliptical/.test(s)) {
    return 'other';
  }
  // Fallback: default cycling if title mentions ftp/watts/ride/z2, otherwise ride when sport is empty
  if (!s) return 'ride';
  return 'other';
}

export function sportLabelForKind(sportKind, rawSport = '') {
  if (sportKind === 'ride') return 'Ride';
  if (sportKind === 'strength') return 'Gym / Strength';
  if (sportKind === 'run') return 'Run';
  if (sportKind === 'swim') return 'Swim';
  if (rawSport && rawSport !== 'Workout') return rawSport;
  return 'Workout';
}

export const FUEL_CATEGORY_META = {
  REST: { label: 'Rest & Repair', badge: 'LOW', color: 'low', gPerKgRange: '2.5–3.5 g/kg' },
  LOW: { label: 'Light Fuel', badge: 'LOW', color: 'low', gPerKgRange: '3.5–4.5 g/kg' },
  MODERATE: { label: 'Steady Fuel', badge: 'MED', color: 'med', gPerKgRange: '5.0–6.5 g/kg' },
  HIGH: { label: 'High Performance', badge: 'HIGH', color: 'high', gPerKgRange: '6.5–8.5 g/kg' },
  VERY_HIGH: { label: 'Max Glycogen', badge: 'MAX', color: 'max', gPerKgRange: '8.5–11 g/kg' },
};

export const BOTTLE_SIZE_OPTIONS = [500, 550, 650, 750, 950];

export const HEAT_LEVEL_OPTIONS = [
  { value: 'cool', label: 'Cool', sub: '<15°C', fluidMult: 0.85, sodiumMult: 0.85 },
  { value: 'moderate', label: 'Moderate', sub: '15–22°C', fluidMult: 1.0, sodiumMult: 1.0 },
  { value: 'warm', label: 'Warm', sub: '23–28°C', fluidMult: 1.2, sodiumMult: 1.25 },
  { value: 'hot', label: 'Hot / Indoor', sub: '>28°C', fluidMult: 1.38, sodiumMult: 1.45 },
];

export const SWEAT_RATE_OPTIONS = [
  { value: 'light', label: 'Light', fluidMult: 0.82, sodiumMult: 0.8 },
  { value: 'medium', label: 'Medium', fluidMult: 1.0, sodiumMult: 1.0 },
  { value: 'heavy', label: 'Heavy', fluidMult: 1.28, sodiumMult: 1.35 },
];

function formatQuarterFraction(val) {
  const quarters = Math.round(val * 4);
  if (quarters <= 0) return '0';
  const whole = Math.floor(quarters / 4);
  const rem = quarters % 4;
  const fracMap = { 0: '', 1: '¼', 2: '½', 3: '¾' };
  if (whole === 0) return fracMap[rem] || '¼';
  return `${whole}${fracMap[rem]}`;
}

function formatTbspMeasure(grams, gramsPerTbsp = 12.5) {
  const g = Math.max(0, Number(grams) || 0);
  if (g < 2) return '0 tbsp';
  const tbsp = g / gramsPerTbsp;
  if (tbsp < 0.35) return '1 tsp';
  return `${formatQuarterFraction(tbsp)} tbsp`;
}

function formatTspMeasure(grams, gramsPerTsp = 5.9) {
  const g = Math.max(0, Number(grams) || 0);
  if (g < 0.25) return 'pinch';
  const eighths = Math.max(1, Math.round((g / gramsPerTsp) * 8));
  const whole = Math.floor(eighths / 8);
  const rem = eighths % 8;
  const fracMap = { 0: '', 1: '⅛', 2: '¼', 3: '⅜', 4: '½', 5: '⅝', 6: '¾', 7: '⅞' };
  if (whole === 0) return `${fracMap[rem]} tsp`;
  return `${whole}${fracMap[rem]} tsp`;
}

export function estimateSessionKj(session, ftp = 290) {
  if (!session || session.intensity === 'rest' || !session.durationMin) return 0;
  const kind = normalizeSportKind(session.sport, session.title);
  if (kind !== 'ride') return 0;
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

export function estimateSessionBurn(session, profile = {}, weightKg = 74) {
  if (!session || session.intensity === 'rest' || !session.durationMin) {
    return { kj: 0, kcal: 0, sportKind: 'rest' };
  }
  const sportKind = normalizeSportKind(session.sport, session.title);
  if (sportKind === 'rest') return { kj: 0, kcal: 0, sportKind: 'rest' };

  const gePct = profile.grossEfficiencyPct || 22.0;
  const mins = Math.max(0, Number(session.durationMin) || 0);
  const wFactor = Math.max(0.65, Math.min(1.6, (Number(weightKg) || 74) / 75));

  if (sportKind === 'ride') {
    const kj = estimateSessionKj(session, profile.ftp || 290);
    const kcal =
      kj > 0
        ? kjToMetabolicKcal(kj, gePct)
        : Math.round(
            (session.status === 'completed' && session.actualKcal > 0
              ? session.actualKcal
              : session.plannedKcal || mins * 8.5 * wFactor) || 0
          );
    return { kj, kcal, sportKind };
  }

  // Non-ride workouts (Gym/Strength, Run, Swim, Yoga/Other): use actual watch/Intervals calories when present, else realistic weight-scaled burn
  if (session.status === 'completed' && Number(session.actualKcal) > 0) {
    return { kj: 0, kcal: Math.round(Number(session.actualKcal)), sportKind };
  }
  if (Number(session.plannedKcal) > 0) {
    return { kj: 0, kcal: Math.round(Number(session.plannedKcal)), sportKind };
  }
  const meta = INTENSITY_META[session.intensity] || INTENSITY_META.endurance;
  let kcalPerMin = 5.0;
  if (sportKind === 'strength') {
    kcalPerMin = meta.ifEst >= 0.85 ? 6.8 : 5.6;
  } else if (sportKind === 'run') {
    kcalPerMin = meta.ifEst >= 0.88 ? 13.0 : meta.ifEst >= 0.75 ? 11.2 : 9.8;
  } else if (sportKind === 'swim') {
    kcalPerMin = 9.5;
  } else {
    kcalPerMin = 4.2;
  }
  return { kj: 0, kcal: Math.round(mins * kcalPerMin * wFactor), sportKind };
}

export function classifySessionCategory(session, exerciseKcal) {
  if (!session || session.intensity === 'rest' || !session.durationMin || exerciseKcal < 130) return 'REST';
  const sportKind = normalizeSportKind(session.sport, session.title);
  if (exerciseKcal >= 2250 || session.intensity === 'race' || (sportKind === 'ride' && session.durationMin >= 200)) {
    return 'VERY_HIGH';
  }
  if (
    exerciseKcal >= 1350 ||
    (sportKind === 'ride' && (session.intensity === 'threshold' || session.intensity === 'vo2max')) ||
    (sportKind === 'run' && session.durationMin >= 90)
  ) {
    return 'HIGH';
  }
  if (
    exerciseKcal >= 620 ||
    (sportKind === 'ride' && (session.intensity === 'tempo' || session.intensity === 'sweetspot' || session.durationMin >= 85)) ||
    (sportKind === 'run' && session.durationMin >= 45)
  ) {
    return 'MODERATE';
  }
  return 'LOW';
}

const CAT_RANK = { REST: 0, LOW: 1, MODERATE: 2, HIGH: 3, VERY_HIGH: 4 };

function classifyDayWorkouts(workouts, totalExerciseKcal) {
  if (!Array.isArray(workouts) || workouts.length === 0 || totalExerciseKcal < 130) return 'REST';
  let best = 'LOW';
  if (totalExerciseKcal >= 2250) best = 'VERY_HIGH';
  else if (totalExerciseKcal >= 1350) best = 'HIGH';
  else if (totalExerciseKcal >= 620) best = 'MODERATE';

  for (const w of workouts) {
    const c = classifySessionCategory(w, w.kcal || 0);
    if ((CAT_RANK[c] || 0) > (CAT_RANK[best] || 0)) {
      best = c;
    }
  }
  return best;
}

// Expenditure-matched & progressive on-bike fueling with heat/sweat tuning, custom bottle sizes, and DIY bottle mix recipes
export function computeOnBikePlan(session, category, exerciseKcal, options = {}) {
  const durationMin = Number(session?.durationMin);
  if (!session || !(durationMin > 0) || session.intensity === 'rest') {
    return null;
  }
  const sportKind = normalizeSportKind(session.sport, session.title);
  // Only rides (and long runs >= 65m) get an active intra-workout carb/bottle plan; gym/yoga/short spins do not!
  if (sportKind !== 'ride' && !(sportKind === 'run' && durationMin >= 65)) {
    return null;
  }

  const hrs = durationMin / 60;
  const safeKcal = Math.max(0, Number(exerciseKcal) || 0);
  const kcalPerHr = safeKcal / Math.max(hrs, 0.25);
  const meta = INTENSITY_META[session.intensity] || INTENSITY_META.endurance;
  const bottleSizeMl = Math.max(300, Number(session.bottleSizeMl || options.defaultBottleMl) || 650);
  const tabletMg = Math.max(100, Number(options.electrolyteTabMg) || 500);
  const units = options.units || getUnits();

  const rawHeatLevel = session.heatLevel || options.heatLevel || 'moderate';
  const rawSweatRate = session.sweatRate || options.sweatRate || 'medium';
  const rawCarbBase = session.carbBase || options.carbBase || 'sugar';
  const rawSaltSource = session.saltSource || options.saltSource || 'table_salt';

  const heatMeta = HEAT_LEVEL_OPTIONS.find((h) => h.value === rawHeatLevel) || HEAT_LEVEL_OPTIONS[1];
  const sweatMeta = SWEAT_RATE_OPTIONS.find((s) => s.value === rawSweatRate) || SWEAT_RATE_OPTIONS[1];
  const heatLevel = heatMeta.value;
  const sweatRate = sweatMeta.value;
  const carbBase = rawCarbBase === 'malto_fructose' ? 'malto_fructose' : 'sugar';
  const saltSource = rawSaltSource === 'sodium_citrate' ? 'sodium_citrate' : 'table_salt';

  // Estimate carbohydrate burn per hour (g/hr)
  const carbBurnGPerHr = (kcalPerHr * meta.carbFractionBurn) / 4;

  let carbsPerHour = 0;
  let progressiveRamp = null;

  if (durationMin <= 55 && (session.intensity === 'recovery' || session.intensity === 'endurance')) {
    carbsPerHour = 0;
  } else if (durationMin <= 75) {
    carbsPerHour = session.intensity === 'threshold' || session.intensity === 'vo2max'
      ? Math.round(Math.min(55, Math.max(30, carbBurnGPerHr * 0.35)) / 5) * 5
      : Math.round(Math.min(35, Math.max(20, carbBurnGPerHr * 0.28)) / 5) * 5;
  } else {
    const replaceFraction = category === 'VERY_HIGH' ? 0.56 : category === 'HIGH' ? 0.5 : 0.44;
    const rawRate = carbBurnGPerHr * replaceFraction;
    const cap = sportKind === 'run' ? 65 : category === 'VERY_HIGH' ? 95 : category === 'HIGH' ? 85 : 65;
    carbsPerHour = Math.round(Math.min(cap, Math.max(30, rawRate)) / 5) * 5;

    if (durationMin >= 150 && carbsPerHour >= 60) {
      const hr1 = Math.max(45, Math.round((carbsPerHour * 0.78) / 5) * 5);
      const hr2Plus = Math.min(100, Math.round((carbsPerHour * 1.1) / 5) * 5);
      progressiveRamp = `Hr 1: ${hr1}g → Hr 2+: ${hr2Plus}g/h`;
    }
  }

  const totalCarbs = Math.round(carbsPerHour * hrs);
  const baseFluidMlPerHr = category === 'HIGH' || category === 'VERY_HIGH' ? 700 : 550;
  const baseSodiumMgPerHr = category === 'HIGH' || category === 'VERY_HIGH' ? 650 : 450;

  // Exact v10 baseline when moderate + medium (1.0 * 1.0); smooth physiological scaling otherwise
  const fluidMlPerHr = Math.min(
    1150,
    Math.max(400, Math.round((baseFluidMlPerHr * heatMeta.fluidMult * sweatMeta.fluidMult) / 25) * 25)
  );
  const totalFluidMl = Math.round(fluidMlPerHr * hrs);
  const sodiumMgPerHr = Math.min(
    1300,
    Math.max(300, Math.round((baseSodiumMgPerHr * heatMeta.sodiumMult * sweatMeta.sodiumMult) / 25) * 25)
  );
  const totalSodiumMg = Math.round(sodiumMgPerHr * hrs);
  const bottles = Math.max(1, Math.ceil(totalFluidMl / bottleSizeMl));
  const carbsPerBottle = Math.round(totalCarbs / bottles);
  const sodiumPerBottleMg = Math.round(totalSodiumMg / bottles);
  const bottleLabel = formatLiquid(bottleSizeMl, units);
  const bottleSaltText = formatSodiumPractical(sodiumPerBottleMg, tabletMg);

  // DIY Bottle Mix Studio recipe (per bottle)
  const sugarG = carbsPerBottle;
  const sugarSpoons = formatTbspMeasure(sugarG, 12.5);
  const maltoG = Math.round(carbsPerBottle * (2 / 3));
  const fructoseG = Math.max(0, carbsPerBottle - maltoG);
  const maltoSpoons = formatTbspMeasure(maltoG, 9.5);
  const fructoseSpoons = formatTbspMeasure(fructoseG, 12.0);
  // Table salt: ~38.8% Na => 2.58g / 1000mg Na; Sodium citrate: ~23% Na => 4.35g / 1000mg Na
  const tableSaltG = Number((sodiumPerBottleMg / 388).toFixed(1));
  const tableSaltSpoons = formatTspMeasure(tableSaltG, 5.9);
  const sodiumCitrateG = Number((sodiumPerBottleMg / 230).toFixed(1));
  const sodiumCitrateSpoons = formatTspMeasure(sodiumCitrateG, 4.35);

  const diyRecipe = {
    carbBase,
    saltSource,
    sugarG,
    sugarSpoons,
    maltoG,
    fructoseG,
    maltoSpoons,
    fructoseSpoons,
    tableSaltG,
    tableSaltSpoons,
    sodiumCitrateG,
    sodiumCitrateSpoons,
    highCarbHint:
      carbsPerBottle > 80
        ? 'Over 80g/bottle gets very sweet with pure sugar — add a squeeze of lemon or switch to Malto + Fructose (2:1).'
        : null,
    highSaltHint:
      sodiumMgPerHr >= 750
        ? 'At high salt levels, sodium citrate tastes milder and is gentler on your stomach than table salt.'
        : null,
    saltNote:
      saltSource === 'sodium_citrate'
        ? 'Gentler on your stomach at high salt levels (23% sodium)'
        : 'Everyday pantry table salt (39% sodium)',
  };

  let note = `Short easy spin — ${bottles}× ${bottleLabel} water + ${bottleSaltText} per bottle. Save carbs for meals.`;
  if (sportKind === 'run') {
    note = `Long run fueling: ~${totalCarbs}g carbs (${carbsPerHour}g/h via gels/chews) + ${bottleSaltText} electrolyte fluid.`;
  } else if (carbsPerHour > 60) {
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
    heatLevel,
    sweatRate,
    carbBase,
    saltSource,
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
    diyRecipe,
    note,
  };
}

function getNonRideFuelNote(sportKind, durationMin) {
  if (sportKind === 'strength') {
    return `Gym / Strength (${durationMin}m) — no bike gels needed. Drink water during lifting and include 25–40g protein + carbs in your next meal for muscle repair.`;
  }
  if (sportKind === 'swim') {
    return `Swim session (${durationMin}m) — keep a water bottle on deck and refuel with carbs + protein afterward.`;
  }
  if (sportKind === 'run') {
    return `Run (${durationMin}m) — water + electrolytes are plenty; save carbs for your regular meals.`;
  }
  return `${durationMin}m workout — hydrate well; calories burned are automatically added to today's meal targets.`;
}

function normalizeActiveWorkouts(input) {
  const arr = Array.isArray(input) ? input.filter(Boolean) : input ? [input] : [];
  return arr.filter((s) => s && s.intensity !== 'rest' && normalizeSportKind(s.sport, s.title) !== 'rest' && (Number(s.durationMin) || 0) > 0);
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
  todaySessions,
  tomorrowSession,
  tomorrowSessions,
  yesterdaySession,
  yesterdaySessions,
  dayMeals,
  dayTimelineOrder,
}) {
  const weightKg = biometricsSummary?.trendWeightKg || profile.defaultWeightKg || 74;
  const bodyFatPct = biometricsSummary?.latestBodyFatPct || profile.defaultBodyFatPct || 15;
  const leanMassKg = biometricsSummary?.leanMassKg || weightKg * (1 - bodyFatPct / 100);
  const gePct = profile.grossEfficiencyPct || 22.0;

  const rawTodayList = normalizeActiveWorkouts(todaySessions ?? (todaySession ? [todaySession] : []));
  const rawTomorrowList = normalizeActiveWorkouts(tomorrowSessions ?? (tomorrowSession ? [tomorrowSession] : []));
  const rawYesterdayList = normalizeActiveWorkouts(yesterdaySessions ?? (yesterdaySession ? [yesterdaySession] : []));

  // Compute burn for every workout today (completed AND still-scheduled!)
  const todayWorkoutsBase = rawTodayList.map((sess) => {
    const burn = estimateSessionBurn(sess, profile, weightKg);
    return {
      ...sess,
      sportKind: burn.sportKind,
      sportLabel: sportLabelForKind(burn.sportKind, sess.sport),
      kj: burn.kj,
      kcal: burn.kcal,
    };
  });

  // Sort workouts chronologically by timing (morning -> midday -> evening), completed first if tie
  const TIMING_ORDER = { morning: 0, midday: 1, evening: 2 };
  todayWorkoutsBase.sort((a, b) => {
    const ta = TIMING_ORDER[a.timing] ?? 2;
    const tb = TIMING_ORDER[b.timing] ?? 2;
    if (ta !== tb) return ta - tb;
    if (a.status !== b.status) return a.status === 'completed' ? -1 : 1;
    return 0;
  });

  const exerciseKj = todayWorkoutsBase.reduce((s, w) => s + w.kj, 0);
  const exerciseKcal = todayWorkoutsBase.reduce((s, w) => s + w.kcal, 0);
  const rideHours = todayWorkoutsBase.reduce((s, w) => s + (w.durationMin || 0) / 60, 0);
  const nonExerciseHours = Math.max(12, Number((24 - rideHours).toFixed(1)));

  const category = classifyDayWorkouts(todayWorkoutsBase, exerciseKcal);

  const tomorrowBurnList = rawTomorrowList.map((s) => ({ ...s, ...estimateSessionBurn(s, profile, weightKg) }));
  const tomorrowKcal = tomorrowBurnList.reduce((s, w) => s + w.kcal, 0);
  const tomorrowCategory = classifyDayWorkouts(tomorrowBurnList, tomorrowKcal);
  const needsTomorrowPreload = tomorrowCategory === 'HIGH' || tomorrowCategory === 'VERY_HIGH';
  const tomorrowTitle = tomorrowBurnList.map((w) => w.title).filter(Boolean).join(' + ') || null;

  const yesterdayBurnList = rawYesterdayList.map((s) => ({ ...s, ...estimateSessionBurn(s, profile, weightKg) }));
  const yesterdayKcal = yesterdayBurnList.reduce((s, w) => s + w.kcal, 0);
  const yesterdayCategory = classifyDayWorkouts(yesterdayBurnList, yesterdayKcal);
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
      deficitStrategyNote = `Lighter deficit (-${plannedDeficit} kcal) because tomorrow is ${tomorrowTitle || 'a key session'} — prioritizing glycogen readiness.`;
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
    deficitStrategyNote = `Cut trimmed to -${Math.max(0, plannedDeficit)} kcal to keep enough fuel above your workout burn for recovery and muscle.`;
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

  const fuelOptions = {
    defaultBottleMl: profile.defaultBottleMl || 650,
    electrolyteTabMg: profile.electrolyteTabMg || 500,
    units: getUnits(profile),
  };

  // Pick the primary workout (highest-kcal ride/endurance workout, else first workout) to keep the canonical 'on_bike' slot ID
  let primaryIdx = -1;
  if (todayWorkoutsBase.length > 0) {
    const rideIndices = todayWorkoutsBase
      .map((w, idx) => ({ w, idx }))
      .filter(({ w }) => w.sportKind === 'ride' || (w.sportKind === 'run' && w.durationMin >= 65));
    if (rideIndices.length > 0) {
      rideIndices.sort((a, b) => b.w.kcal - a.w.kcal);
      primaryIdx = rideIndices[0].idx;
    } else {
      primaryIdx = 0;
    }
  }

  const workouts = todayWorkoutsBase.map((w, idx) => {
    const wCat = classifySessionCategory(w, w.kcal);
    const fuelPlan = computeOnBikePlan(w, wCat, w.kcal, fuelOptions);
    const slotId = idx === primaryIdx ? 'on_bike' : `workout-${w.id}`;
    return {
      ...w,
      slotId,
      isPrimaryWorkout: idx === primaryIdx,
      workoutCategory: wCat,
      onBikePlan: fuelPlan,
      fuelNote: fuelPlan ? fuelPlan.note : getNonRideFuelNote(w.sportKind, w.durationMin),
    };
  });

  const primaryWorkout = primaryIdx >= 0 ? workouts[primaryIdx] : null;
  const onBikePlan = primaryWorkout?.onBikePlan || workouts.find((w) => w.onBikePlan)?.onBikePlan || null;
  const totalOnBikeCarbs = workouts.reduce((s, w) => s + (w.onBikePlan?.totalCarbs || 0), 0);
  const totalOnBikeSodiumMg = workouts.reduce((s, w) => s + (w.onBikePlan?.totalSodiumMg || 0), 0);

  // Plain-English Nutrient Timing Tips
  const leadHrs = Number(profile.preRideLeadHours || 2);
  const preRideCarbTargetG = Math.round(weightKg * Math.min(3.5, Math.max(1.0, leadHrs)));
  const hasAnyWorkout = workouts.length > 0;
  const hasRide = workouts.some((w) => w.sportKind === 'ride');

  const timingCoaching = {
    preRideCue:
      hasRide && (primaryWorkout?.timing === 'morning' || category === 'HIGH' || category === 'VERY_HIGH')
        ? `Aim for ~${preRideCarbTargetG}g carbs (${leadHrs}h before). Include fruit, honey, or yogurt/milk for quick energy; keep fat and fiber light.`
        : null,
    postRideCue: !hasAnyWorkout
      ? null
      : needsTomorrowPreload
      ? `Hard session tomorrow: refuel within 45 min (~${Math.round(weightKg * 1.1)}g carbs from starch + fruit/juice + 30g protein, low fat) so your energy stores refill overnight.`
      : `Tomorrow is easy/rest: eat a normal protein + carb meal soon after training to avoid evening cravings — no extra sugar loading needed.`,
  };

  const meals = buildMealTimeline({
    category,
    workouts,
    primaryWorkout,
    needsTomorrowPreload,
    carbsG,
    proteinG,
    fatG,
    totalOnBikeCarbs,
    dayMeals,
    timelineOrder: dayTimelineOrder || primaryWorkout?.timelineOrder || profile.defaultTimelineOrder,
  });

  const microTargets = {
    fiber: category === 'VERY_HIGH' || profile.goalMode === 'carb_load' ? 20 : 34,
    iron: profile.sex === 'female' ? 18 : 11,
    vitC: profile.sex === 'female' ? 75 : 90,
    calcium: 1100,
    vitD: 15,
    magnesium: profile.sex === 'female' ? 350 : 420,
    sodium: profile.goalMode === 'carb_load' ? 1800 : 2300 + totalOnBikeSodiumMg,
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
    tomorrowTitle,
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
    workouts,
    onBikePlan,
    totalOnBikeCarbs,
    totalOnBikeSodiumMg,
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
  workouts = [],
  primaryWorkout = null,
  needsTomorrowPreload,
  carbsG,
  proteinG,
  fatG,
  totalOnBikeCarbs = 0,
  dayMeals,
  timelineOrder,
}) {
  const hasWorkout = workouts.length > 0;
  const timing = inferTimingFromOrder(timelineOrder, primaryWorkout?.timing || 'evening');
  const offBikeCarbs = Math.max(80, carbsG - totalOnBikeCarbs);

  const activeMealDefs =
    Array.isArray(dayMeals) && dayMeals.length > 0 ? dayMeals : DEFAULT_MEAL_SLOTS;

  let baseCWeights = { breakfast: 0.25, lunch: 0.3, snack: 0.15, dinner: 0.3 };
  if (hasWorkout && timing === 'morning') {
    baseCWeights = { breakfast: 0.3, lunch: 0.3, snack: 0.16, dinner: 0.24 };
  } else if (hasWorkout && timing === 'evening') {
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
    let w = baseCWeights[m.kind] ?? (m.size === 'snack' ? 0.16 : 0.28);
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
      label = hasWorkout && timing === 'morning' ? 'Pre-Workout Breakfast' : m.label || 'Breakfast';
      timeHint = hasWorkout && timing === 'morning' ? 'Light & quick energy · Low fiber' : 'Morning';
    } else if (m.kind === 'lunch') {
      label = m.label || 'Lunch';
      timeHint = 'Midday';
    } else if (m.kind === 'snack') {
      label = hasWorkout ? (timing === 'evening' ? 'Pre-Ride Snack' : 'Post-Workout Recovery') : 'Afternoon Snack';
      timeHint = hasWorkout && timing === 'evening' ? '90m before · Low fat' : hasWorkout ? 'Within 45m · Low fat' : 'Afternoon';
    } else if (m.kind === 'dinner') {
      label = needsTomorrowPreload ? 'Dinner (Pre-Load)' : m.label || 'Dinner';
      timeHint = 'Evening';
    }

    slotsById[m.id] = {
      slot: m.id,
      kind: m.kind || 'custom',
      size: m.size || 'meal',
      isWorkout: false,
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

  // Create a draggable card for EVERY workout today (completed AND still-scheduled, rides AND gym/run/swim!)
  for (const w of workouts) {
    const wp = w.onBikePlan;
    const wCarbs = wp?.totalCarbs || 0;
    const badgeCode = wp
      ? wp.carbsPerHour >= 70
        ? 'HIGH'
        : wCarbs > 0
        ? 'MED'
        : 'LOW'
      : w.kcal >= 450
      ? 'MED'
      : 'LOW';

    slotsById[w.slotId] = {
      slot: w.slotId,
      kind: 'workout',
      isWorkout: true,
      workout: w,
      label: w.title || w.sportLabel || 'Workout',
      baseLabel: w.title || w.sportLabel || 'Workout',
      location: w.sportLabel,
      timeHint: wp
        ? wCarbs > 0
          ? wp.progressiveRamp || `${wp.carbsPerHour}g/hr · ${w.durationMin}m`
          : `Water + electrolytes · ${w.durationMin}m`
        : `${w.sportLabel} · ${w.durationMin}m · ~${w.kcal} kcal`,
      targetCarbs: wCarbs,
      targetProtein: 0,
      targetFat: 0,
      carbCode: badgeCode,
      targetKcal: wCarbs * 4,
    };
  }

  // Respect user's custom card placement order; insert any new workouts smartly by their time of day!
  let effectiveOrder;
  if (Array.isArray(timelineOrder) && timelineOrder.length > 0) {
    effectiveOrder = timelineOrder.filter((id) => Boolean(slotsById[id]));
  } else {
    effectiveOrder = [...orderedMealIds];
  }

  // Insert any missing workouts (e.g. a newly synced Morning Gym + Evening Ride) at their natural time-of-day slot
  for (const w of workouts) {
    if (!effectiveOrder.includes(w.slotId)) {
      const wTiming = w.timing || 'evening';
      let insertIdx = effectiveOrder.length;
      if (wTiming === 'morning') {
        const bfIdx = effectiveOrder.indexOf('breakfast');
        insertIdx = bfIdx >= 0 ? bfIdx + 1 : 0;
      } else if (wTiming === 'midday') {
        const lIdx = effectiveOrder.indexOf('lunch');
        insertIdx = lIdx >= 0 ? lIdx + 1 : Math.min(2, effectiveOrder.length);
      } else {
        const dIdx = effectiveOrder.indexOf('dinner');
        insertIdx = dIdx >= 0 ? dIdx : effectiveOrder.length;
      }
      effectiveOrder.splice(insertIdx, 0, w.slotId);
    }
  }

  // Ensure any remaining meal slots are also present
  for (const id of Object.keys(slotsById)) {
    if (!effectiveOrder.includes(id)) effectiveOrder.push(id);
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

function formatRideMin(mins) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}:${String(rem).padStart(2, '0')}`;
}

// Deterministic chronological ride eating & bottle drinking schedule (EatMyRide / Saturday style)
export function buildRideEatingSchedule(durationMin, pack = {}, onBikePlan = null) {
  const rawDur = Number(durationMin);
  if (!(rawDur > 0)) {
    return [];
  }
  const dur = Math.round(rawDur);
  const carbBottles = Math.max(0, Math.round(Number(pack.carbBottles) || 0));
  const gels = Math.max(0, Math.round(Number(pack.gels) || 0));
  const bars = Math.max(0, Math.round(Number(pack.bars) || 0));
  const tabs = Math.max(0, Math.round(Number(pack.tabs) || 0));

  const cues = [];

  // Bottle milestones divided evenly across ride duration
  if (carbBottles > 0) {
    const minsPerBottle = dur / carbBottles;
    for (let i = 0; i < carbBottles; i += 1) {
      const startM = Math.round(i * minsPerBottle);
      const endM = Math.round((i + 1) * minsPerBottle);
      const bottleCarbs = onBikePlan?.carbsPerBottle || 0;
      cues.push({
        minute: startM,
        timeLabel: `${formatRideMin(startM)}–${formatRideMin(endM)}`,
        kind: 'bottle',
        text: `Sip Carb Bottle #${i + 1} steadily every 15 min${bottleCarbs > 0 ? ` (~${bottleCarbs}g C)` : ''}`,
      });
    }
  }

  // Solids first (earlier when gut is fresher), then gels — strictly outside the final 15 min
  const eatables = [];
  for (let i = 0; i < bars; i += 1) {
    eatables.push({ kind: 'bar', text: `Bar / Rice Cake #${i + 1} (40g C) + water sip` });
  }
  for (let i = 0; i < gels; i += 1) {
    eatables.push({ kind: 'gel', text: `Energy Gel #${i + 1} (25g C) + water sip` });
  }

  const usableWindow = Math.max(0, dur - 15);
  if (eatables.length > 0) {
    const count = eatables.length;
    const idealStep = Math.floor(usableWindow / (count + 1));
    if (usableWindow === 0) {
      eatables.forEach((item) => {
        cues.push({
          minute: 0,
          timeLabel: formatRideMin(0),
          kind: item.kind,
          text: item.text,
        });
      });
    } else if (idealStep >= 15) {
      eatables.forEach((item, idx) => {
        const targetMin = Math.min(usableWindow, Math.max(Math.min(20, usableWindow), idealStep * (idx + 1)));
        const flooredMin = Math.min(usableWindow, Math.floor(targetMin / 5) * 5);
        cues.push({
          minute: flooredMin,
          timeLabel: formatRideMin(flooredMin),
          kind: item.kind,
          text: item.text,
        });
      });
    } else {
      const minStart = count === 1 ? usableWindow : Math.min(10, usableWindow);
      const span = Math.max(0, usableWindow - minStart);
      const useFiveMinSnap = count === 1 || span / Math.max(1, count - 1) >= 7.5;
      eatables.forEach((item, idx) => {
        const rawMin = count === 1 ? usableWindow : minStart + (idx / (count - 1)) * span;
        const minute = useFiveMinSnap
          ? Math.min(usableWindow, Math.floor(rawMin / 5) * 5)
          : Math.min(usableWindow, Math.floor(rawMin));
        cues.push({
          minute,
          timeLabel: formatRideMin(minute),
          kind: item.kind,
          text: item.text,
        });
      });
    }
  }

  if (tabs > 0 && carbBottles === 0) {
    cues.push({
      minute: 0,
      timeLabel: '0:00',
      kind: 'electrolyte',
      text: `Dissolve ${tabs} electrolyte tab${tabs > 1 ? 's' : ''} into your water bottle${tabs > 1 ? 's' : ''} before rolling out`,
    });
  }

  if (cues.length === 0) {
    cues.push({
      minute: 0,
      timeLabel: `0:00–${formatRideMin(dur)}`,
      kind: 'bottle',
      text: 'Sip water + electrolytes steadily every 15–20 min.',
    });
  }

  cues.sort((a, b) => a.minute - b.minute || (a.kind === 'bottle' ? -1 : 1));
  return cues;
}

// Deterministic Intra-Day Fuel Wave Curve (06:00–22:00) synced to the user's exact ordered timeline
export function computeIntraDayEnergyCurve(plan, logs = []) {
  const slots = Array.isArray(plan?.meals) ? plan.meals : [];
  const offBikeBurn = Math.max(1200, Number(plan?.offBikeTdee) || 2000);
  const hourlyBaselineDrain = offBikeBurn / 16;

  // Map ordered timeline slots monotonically onto waking hours (7..20)
  const n = slots.length;
  const slotHours = slots.map((s, idx) => {
    const ideal =
      s.kind === 'breakfast'
        ? 7.5
        : s.kind === 'lunch'
        ? 12.5
        : s.kind === 'snack'
        ? 15.5
        : s.kind === 'dinner'
        ? 19.5
        : s.isWorkout
        ? s.workout?.timing === 'morning'
          ? 9.0
          : s.workout?.timing === 'midday'
          ? 13.5
          : 17.5
        : 7.5 + (idx / Math.max(1, n - 1)) * 12;
    return ideal;
  });

  // Enforce monotonic order matching the user's dragged timeline
  for (let i = 1; i < slotHours.length; i += 1) {
    if (slotHours[i] <= slotHours[i - 1] + 1.0) {
      slotHours[i] = slotHours[i - 1] + 1.25;
    }
  }
  if (slotHours.length > 1 && slotHours[slotHours.length - 1] > 20.5) {
    const startH = 7.5;
    const endH = 20.0;
    for (let i = 0; i < slotHours.length; i += 1) {
      slotHours[i] = startH + (i / (slotHours.length - 1)) * (endH - startH);
    }
  }

  // Group logged calories by slot (never counts unlogged meals as eaten!)
  const loggedKcalBySlot = new Map();
  let totalLoggedFoodKcal = 0;
  for (const l of logs || []) {
    if (!l || l.type === 'supplement') continue;
    const k = Math.max(0, Number(l.kcal) || 0);
    loggedKcalBySlot.set(l.slot, (loggedKcalBySlot.get(l.slot) || 0) + k);
    totalLoggedFoodKcal += k;
  }

  // Build hourly event deltas across 06:00–22:00
  const plannedDeltaByHour = new Map();
  const loggedDeltaByHour = new Map();
  const markers = [];
  let hasLoggedWorkout = false;

  slots.forEach((slot, idx) => {
    const hourInt = Math.min(21, Math.max(7, Math.round(slotHours[idx])));
    const loggedHere = loggedKcalBySlot.get(slot.slot) || 0;
    const hasLoggedHere = loggedHere > 0;

    if (slot.isWorkout) {
      const burnKcal = Math.max(0, Number(slot.workout?.kcal) || 0);
      const plannedFuelKcal = Math.max(0, Number(slot.workout?.onBikePlan?.totalKcal) || 0);
      const isWorkoutLogged = slot.workout?.status === 'completed' || hasLoggedHere;
      const netPlanned = plannedFuelKcal - burnKcal;
      plannedDeltaByHour.set(hourInt, (plannedDeltaByHour.get(hourInt) || 0) + netPlanned);
      if (isWorkoutLogged) {
        hasLoggedWorkout = true;
        const netLogged = loggedHere - burnKcal;
        loggedDeltaByHour.set(hourInt, (loggedDeltaByHour.get(hourInt) || 0) + netLogged);
      }
      markers.push({
        hour: hourInt,
        type: 'workout',
        label: slot.workout?.title || slot.label,
        logged: isWorkoutLogged,
      });
    } else {
      const plannedMealKcal = hasLoggedHere ? loggedHere : Math.max(0, Number(slot.targetKcal) || 0);
      plannedDeltaByHour.set(hourInt, (plannedDeltaByHour.get(hourInt) || 0) + plannedMealKcal);
      if (hasLoggedHere) {
        loggedDeltaByHour.set(hourInt, (loggedDeltaByHour.get(hourInt) || 0) + loggedHere);
      }
      markers.push({
        hour: hourInt,
        type: 'meal',
        label: slot.baseLabel || slot.label,
        logged: hasLoggedHere,
      });
    }
  });

  // Start morning with a realistic +150 kcal buffer so a well-paced day stays in the shaded balanced band
  let plannedBal = 150;
  let loggedBal = 150;
  const points = [];

  for (let h = 6; h <= 22; h += 1) {
    if (h > 6) {
      plannedBal -= hourlyBaselineDrain;
      loggedBal -= hourlyBaselineDrain;
    }
    plannedBal += plannedDeltaByHour.get(h) || 0;
    loggedBal += loggedDeltaByHour.get(h) || 0;

    const label = h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`;
    points.push({
      hour: h,
      label,
      plannedBalance: Math.round(plannedBal),
      loggedBalance: Math.round(loggedBal),
    });
  }

  // Determine latest logged hour so solid logged line highlights actual progress cleanly
  const hasLoggedAny = totalLoggedFoodKcal > 0 || hasLoggedWorkout;
  const loggedMarkerHours = markers.filter((m) => m.logged).map((m) => m.hour);
  const lastLoggedHour = hasLoggedAny && loggedMarkerHours.length > 0 ? Math.max(...loggedMarkerHours) : 6;
  const minPlanned = Math.min(...points.map((p) => p.plannedBalance));
  const hasWorkout = slots.some((s) => s.isWorkout);

  let status = 'Ready to Fuel';
  let statusTone = 'slate';
  let summaryNote = hasWorkout
    ? 'Follow your planned meals around today’s workout to keep energy steady all day.'
    : 'Spacing meals evenly keeps energy steady and prevents late-evening hunger.';

  if (totalLoggedFoodKcal > 0) {
    const pctLogged = Math.round((totalLoggedFoodKcal / Math.max(1, plan?.targets?.kcal || 2000)) * 100);
    if (pctLogged >= 85) {
      status = 'Well Fueled';
      statusTone = 'high';
      summaryNote = 'Solid fueling across the day — energy balance stays right in your target zone.';
    } else if (minPlanned < -600 && hasWorkout) {
      status = 'Big Ride Dip Ahead';
      statusTone = 'med';
      summaryNote = 'Eat your pre-ride snack 60–90 min before training and bring bottles so energy doesn’t dip too deep.';
    } else {
      status = `${pctLogged}% Fueled So Far`;
      statusTone = 'high';
      summaryNote = 'Solid line shows what you’ve logged; dashed line projects the rest of your plan.';
    }
  } else if (hasWorkout) {
    status = 'Plan Ready';
    statusTone = 'high';
  }

  return {
    points,
    markers,
    lastLoggedHour,
    hasLoggedAny,
    balancedBand: { min: -350, max: 350 },
    status,
    statusTone,
    summaryNote,
  };
}

