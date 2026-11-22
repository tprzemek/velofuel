// Pro Cycling Fueling Engine
// Combines:
// - Dr. Sam Impey & Prof. James Morton: Fuel For The Work Required (FFTWR / Hexis)
// - Dr. Tim Podlogar (Empirical Cycling Perspectives #41 / Tudor Pro Cycling):
//   * Non-exercise-hours RMR (avoids double-counting RMR during ride hours!)
//   * Individual cycling Gross Efficiency % (18-24%) for kJ -> metabolic kcal
//   * Expenditure-matched progressive on-bike fueling (avoiding over-fueling easy rides)
//   * Liver vs. muscle glycogen timing (fructose/galactose pre-ride, between-sessions post-ride)
//   * Macros calibrated to BOTH g/kg bodyweight AND % total energy
//   * 24-hour glycogen supercompensation (10-12 g/kg, low fat/fiber)
// - FoodCoach modular Home Staple Auto-Scaling

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

export function estimateSessionKj(session, ftp = 290) {
  if (!session || session.intensity === 'rest' || !session.durationMin) return 0;
  if (session.status === 'completed' && session.actualKj > 0) return Math.round(session.actualKj);
  if (session.plannedKj > 0) return Math.round(session.plannedKj);
  const meta = INTENSITY_META[session.intensity] || INTENSITY_META.endurance;
  const avgWatts = meta.ifEst * ftp * 0.92;
  return Math.round((avgWatts * session.durationMin * 60) / 1000);
}

// Tim Podlogar: Cycling Gross Efficiency varies 18–24%.
// Metabolic kcal = Mechanical kJ / (4.184 * GE). At 23.9% GE => 1 kJ = 1.00 kcal; at 22% GE => 1.09 kcal.
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

// Podlogar expenditure-matched & progressive on-bike fueling:
// Scales with actual kcal/hr burn so lower-wattage rides aren't over-fueled (which suppresses fat oxidation & adds surplus)
export function computeOnBikePlan(session, category, exerciseKcal) {
  if (!session || !session.durationMin || session.intensity === 'rest') {
    return null;
  }
  const hrs = session.durationMin / 60;
  const kcalPerHr = exerciseKcal / Math.max(hrs, 0.25);
  const meta = INTENSITY_META[session.intensity] || INTENSITY_META.endurance;

  // Estimate endogenous + exogenous carb burn per hour (g/hr)
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
    // Target ~40–55% of hourly carbohydrate burn, capped by practical gut absorption (30–95 g/h)
    const replaceFraction = category === 'VERY_HIGH' ? 0.56 : category === 'HIGH' ? 0.5 : 0.44;
    const rawRate = carbBurnGPerHr * replaceFraction;
    const cap = category === 'VERY_HIGH' ? 95 : category === 'HIGH' ? 85 : 65;
    carbsPerHour = Math.round(Math.min(cap, Math.max(30, rawRate)) / 5) * 5;

    // Podlogar progressive fueling for long rides (>= 2.5h): start moderate Hr 1 to preserve fat oxidation, ramp Hr 2-3
    if (session.durationMin >= 150 && carbsPerHour >= 60) {
      const hr1 = Math.max(45, Math.round((carbsPerHour * 0.78) / 5) * 5);
      const hr2Plus = Math.min(100, Math.round((carbsPerHour * 1.1) / 5) * 5);
      progressiveRamp = `Hr 1: ${hr1}g → Hr 2+: ${hr2Plus}g/h`;
    }
  }

  const totalCarbs = Math.round(carbsPerHour * hrs);
  const fluidMlPerHr = category === 'HIGH' || category === 'VERY_HIGH' ? 700 : 550;
  const sodiumMgPerHr = category === 'HIGH' || category === 'VERY_HIGH' ? 650 : 450;
  const bottles = Math.max(1, Math.ceil((fluidMlPerHr * hrs) / 650));

  let note = 'Short easy spin — water + electrolytes only. Save carbs for meals.';
  if (carbsPerHour > 60) {
    note = `${bottles} bottles (dual-carb drink mix + gels) for ~${Math.round(kcalPerHr)} kcal/h burn. ${
      progressiveRamp ? `Gradual ramp: ${progressiveRamp}.` : 'Steady sips every 15 min.'
    }`;
  } else if (carbsPerHour > 0) {
    note = `${bottles} bottle${bottles > 1 ? 's' : ''} matched to ~${Math.round(kcalPerHr)} kcal/h burn — prevents deep fatigue & post-ride cravings without over-eating.`;
  }

  return {
    carbsPerHour,
    totalCarbs,
    totalKcal: totalCarbs * 4,
    kcalPerHr: Math.round(kcalPerHr),
    progressiveRamp,
    fluidMlPerHr,
    sodiumMgPerHr,
    totalSodiumMg: Math.round(sodiumMgPerHr * hrs),
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
  const onBikePlan = computeOnBikePlan(todaySession, category, exerciseKcal);

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
  });

  const microTargets = {
    fiber: category === 'VERY_HIGH' || profile.goalMode === 'carb_load' ? 20 : 34,
    iron: profile.sex === 'female' ? 18 : 11,
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

function buildMealTimeline({ category, todaySession, needsTomorrowPreload, carbsG, proteinG, fatG, onBikePlan }) {
  const hasRide = Boolean(todaySession && todaySession.durationMin > 0 && todaySession.intensity !== 'rest');
  const timing = todaySession?.timing || 'evening';
  const onBikeCarbs = onBikePlan?.totalCarbs || 0;
  const offBikeCarbs = Math.max(80, carbsG - onBikeCarbs);

  let cWeights = { breakfast: 0.25, lunch: 0.3, snack: 0.15, dinner: 0.3 };
  if (hasRide && timing === 'morning') {
    cWeights = { breakfast: 0.3, lunch: 0.3, snack: 0.16, dinner: 0.24 };
  } else if (hasRide && timing === 'evening') {
    cWeights = { breakfast: 0.23, lunch: 0.29, snack: 0.2, dinner: 0.28 };
  }
  if (needsTomorrowPreload) {
    cWeights.dinner += 0.08;
    cWeights.breakfast -= 0.04;
    cWeights.lunch -= 0.04;
  }

  const pWeights = { breakfast: 0.25, lunch: 0.28, snack: 0.18, dinner: 0.29 };
  const fWeights = { breakfast: 0.26, lunch: 0.32, snack: 0.12, dinner: 0.3 };

  const codeForCarbs = (g) => {
    if (g >= 85) return 'HIGH';
    if (g >= 50) return 'MED';
    return 'LOW';
  };

  const slots = [
    {
      slot: 'breakfast',
      label: hasRide && timing === 'morning' ? 'Pre-Ride Breakfast' : 'Breakfast',
      location: 'Home',
      timeHint: hasRide && timing === 'morning' ? 'Liver glycogen · Low fiber' : '07:30',
      targetCarbs: Math.round(offBikeCarbs * cWeights.breakfast),
      targetProtein: Math.round(proteinG * pWeights.breakfast),
      targetFat: Math.round(fatG * fWeights.breakfast),
    },
    {
      slot: 'lunch',
      label: 'Lunch',
      location: 'Work / Home',
      timeHint: '12:30',
      targetCarbs: Math.round(offBikeCarbs * cWeights.lunch),
      targetProtein: Math.round(proteinG * pWeights.lunch),
      targetFat: Math.round(fatG * fWeights.lunch),
    },
    {
      slot: 'snack',
      label: hasRide ? (timing === 'evening' ? 'Pre-Ride Fuel' : 'Post-Ride Recovery') : 'Afternoon Snack',
      location: 'Home / Work',
      timeHint: hasRide && timing === 'evening' ? '90m before · Low fat' : hasRide ? 'Within 45m · Low fat' : '15:30',
      targetCarbs: Math.round(offBikeCarbs * cWeights.snack),
      targetProtein: Math.round(proteinG * pWeights.snack),
      targetFat: Math.round(fatG * fWeights.snack),
    },
    {
      slot: 'dinner',
      label: needsTomorrowPreload ? 'Dinner (Pre-Load)' : 'Dinner',
      location: 'Home (Auto-Balances Day)',
      timeHint: '19:30',
      targetCarbs: Math.round(offBikeCarbs * cWeights.dinner),
      targetProtein: Math.round(proteinG * pWeights.dinner),
      targetFat: Math.round(fatG * fWeights.dinner),
    },
  ];

  if (hasRide && onBikeCarbs > 0) {
    const rideSlot = {
      slot: 'on_bike',
      label: 'On-Bike Fuel',
      location: 'During Ride',
      timeHint: onBikePlan.progressiveRamp || `${onBikePlan.carbsPerHour}g/hr · ${todaySession.durationMin}m`,
      targetCarbs: onBikeCarbs,
      targetProtein: 0,
      targetFat: 0,
      carbCode: onBikePlan.carbsPerHour >= 70 ? 'HIGH' : 'MED',
      targetKcal: onBikeCarbs * 4,
    };
    const insertIdx = timing === 'morning' ? 1 : timing === 'midday' ? 2 : 3;
    slots.splice(insertIdx, 0, rideSlot);
  }

  return slots.map((s) => ({
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
  const micros = { fiber: 0, iron: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 0 };
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
      micros: { fiber: 0, iron: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 0 },
    }
  );
}
