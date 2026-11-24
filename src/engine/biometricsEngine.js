// Biometrics, weight trend, lean mass preservation check, intake-aware weekly check-in, and Withings CSV parser
import { computeBmr, estimateSessionBurn } from './fuelingEngine';

function parseValidDateMs(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return NaN;
  const trimmed = dateStr.trim();
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) {
      return dt.getTime();
    }
    return NaN;
  }
  return Date.parse(trimmed);
}

export function computeBiometricsSummary(entries = [], profile = {}) {
  const safeProfile = profile || {};
  const sorted = [...(Array.isArray(entries) ? entries : [])]
    .filter(
      (e) =>
        e &&
        e.date &&
        Number.isFinite(parseValidDateMs(e.date)) &&
        typeof e.weightKg === 'number' &&
        Number.isFinite(e.weightKg)
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    const w = safeProfile.defaultWeightKg || 74;
    const bf = safeProfile.defaultBodyFatPct || 15;
    const lbm = Number((w * (1 - bf / 100)).toFixed(1));
    return {
      series: [],
      latestWeightKg: w,
      trendWeightKg: w,
      latestBodyFatPct: bf,
      leanMassKg: lbm,
      fatMassKg: Number((w - lbm).toFixed(1)),
      weeklyRateKg: 0,
      leanMassDeltaKg: 0,
      glycogenNotice: null,
      tdeeSuggestion: null,
      latestRestingHr: null,
      latestHrv: null,
    };
  }

  // Exponential Moving Average (7-day smoothing, alpha = 0.25)
  const alpha = 0.25;
  let emaWeight = sorted[0].weightKg;
  let lastKnownBf = sorted.find((e) => typeof e.bodyFatPct === 'number')?.bodyFatPct ?? safeProfile.defaultBodyFatPct ?? 15;

  const series = sorted.map((e, idx) => {
    emaWeight = idx === 0 ? e.weightKg : alpha * e.weightKg + (1 - alpha) * emaWeight;
    if (typeof e.bodyFatPct === 'number') lastKnownBf = e.bodyFatPct;
    const lbm = Number((emaWeight * (1 - lastKnownBf / 100)).toFixed(2));
    const fatMass = Number((emaWeight - lbm).toFixed(2));
    return {
      ...e,
      trendWeightKg: Number(emaWeight.toFixed(2)),
      effectiveBodyFatPct: Number(lastKnownBf.toFixed(1)),
      leanMassKg: lbm,
      fatMassKg: fatMass,
    };
  });

  const latest = series[series.length - 1];
  const prev = series.length >= 2 ? series[series.length - 2] : latest;

  // Weekly rate of change using trend weight over last 7-14 entries
  const lookbackIdx = Math.max(0, series.length - Math.min(series.length, 10));
  const baseline = series[lookbackIdx];
  const spanMs = parseValidDateMs(latest.date) - parseValidDateMs(baseline.date);
  const daysSpan = Number.isFinite(spanMs)
    ? Math.max(1, Math.round(spanMs / (1000 * 60 * 60 * 24)))
    : 1;
  const weeklyRateKg = Number((((latest.trendWeightKg - baseline.trendWeightKg) / daysSpan) * 7).toFixed(2));
  const leanMassDeltaKg = Number((latest.leanMassKg - baseline.leanMassKg).toFixed(2));

  // Glycogen/water bounce detector: if scale jumped > +0.35 kg overnight while 7d trend is stable/falling
  const overnightDelta = Number((latest.weightKg - prev.weightKg).toFixed(2));
  let glycogenNotice = null;
  if (overnightDelta >= 0.35 && weeklyRateKg <= 0.05) {
    glycogenNotice = `Scale is +${overnightDelta.toFixed(1)} kg vs yesterday, likely muscle glycogen & water retention (1g glycogen stores ~3g water). Your 7-day trend (${latest.trendWeightKg.toFixed(1)} kg) is steady — do not panic-cut carbs.`;
  } else if (overnightDelta <= -0.5) {
    glycogenNotice = `Scale dropped ${Math.abs(overnightDelta).toFixed(1)} kg overnight — likely post-ride dehydration or low glycogen. Rehydrate with sodium today.`;
  }

  // Adaptive TDEE recommendation (MacroFactor-style feedback loop)
  let tdeeSuggestion = null;
  if (daysSpan >= 7) {
    const expectedWeeklyDelta =
      safeProfile.goalMode === 'cut' ? -(safeProfile.targetLossKgPerWeek || 0.35) : 0;
    const rateErrorKg = weeklyRateKg - expectedWeeklyDelta; // positive = losing slower than target
    if (safeProfile.goalMode === 'cut' && leanMassDeltaKg <= -0.35) {
      tdeeSuggestion = {
        type: 'warning',
        deltaKcal: +150,
        message: `Lean mass trend dipped ${leanMassDeltaKg} kg over ${daysSpan}d. Consider adding +150 kcal/day on training days or nudging protein to 2.2 g/kg.`,
      };
    } else if (Math.abs(rateErrorKg) >= 0.18) {
      // 1 kg ≈ 7700 kcal => rateErrorKg/week ≈ rateErrorKg * 1100 kcal/day, apply conservative 50% step capped at ±180 kcal
      const rawStep = Math.round((-rateErrorKg * 1100 * 0.45) / 25) * 25;
      const clampedStep = Math.max(-175, Math.min(175, rawStep));
      if (clampedStep !== 0) {
        tdeeSuggestion = {
          type: clampedStep < 0 ? 'trim' : 'add',
          deltaKcal: clampedStep,
          message:
            clampedStep < 0
              ? `Your 14-day weight trend is ${weeklyRateKg > 0 ? '+' : ''}${weeklyRateKg} kg/wk vs your goal of ${expectedWeeklyDelta.toFixed(2)} kg/wk. Suggested tweak: ${clampedStep} kcal on Rest/Easy days.`
              : `You're losing faster (${weeklyRateKg} kg/wk) than your goal (${expectedWeeklyDelta.toFixed(2)} kg/wk). Suggested tweak: +${clampedStep} kcal/day to protect your power & recovery.`,
        };
      }
    } else {
      tdeeSuggestion = {
        type: 'ontrack',
        deltaKcal: 0,
        message: `Your weight trend (${weeklyRateKg > 0 ? '+' : ''}${weeklyRateKg} kg/wk) and muscle mass (${leanMassDeltaKg >= 0 ? '+' : ''}${leanMassDeltaKg} kg) are right on target.`,
      };
    }
  }

  const latestRhr = [...series].reverse().find((s) => s.restingHr != null)?.restingHr ?? null;
  const latestHrv = [...series].reverse().find((s) => s.hrv != null)?.hrv ?? null;
  const latestMuscleMassKg = [...series].reverse().find((s) => s.muscleMassKg != null)?.muscleMassKg ?? null;
  const latestHydrationKg = [...series].reverse().find((s) => s.hydrationKg != null)?.hydrationKg ?? null;
  const latestBoneMassKg = [...series].reverse().find((s) => s.boneMassKg != null)?.boneMassKg ?? null;

  return {
    series,
    latestWeightKg: latest.weightKg,
    trendWeightKg: latest.trendWeightKg,
    latestBodyFatPct: latest.effectiveBodyFatPct,
    leanMassKg: latest.leanMassKg,
    fatMassKg: latest.fatMassKg,
    weeklyRateKg,
    leanMassDeltaKg,
    glycogenNotice,
    tdeeSuggestion,
    latestRestingHr: latestRhr,
    latestHrv: latestHrv,
    latestMuscleMassKg,
    latestHydrationKg,
    latestBoneMassKg,
  };
}

// Parse standard Withings Health Mate weight.csv export
// Columns typically: Date, Weight (kg), Fat mass (kg), Bone mass (kg), Muscle mass (kg), Hydration (kg), Comments
export function parseWithingsCsv(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').toLowerCase());
  const dateIdx = header.findIndex((h) => h.includes('date'));
  const weightIdx = header.findIndex((h) => h.includes('weight'));
  const fatMassIdx = header.findIndex((h) => h.includes('fat mass') || h.includes('fat (kg)'));
  const fatPctIdx = header.findIndex((h) => h.includes('fat (%)') || h.includes('fat ratio') || h.includes('body fat'));
  const muscleIdx = header.findIndex((h) => h.includes('muscle'));
  const hydrationIdx = header.findIndex((h) => h.includes('hydration'));
  const boneIdx = header.findIndex((h) => h.includes('bone'));
  const isLbs = weightIdx >= 0 && header[weightIdx].includes('lb');
  const toKg = (raw) => {
    const n = parseFloat(raw);
    if (Number.isNaN(n) || n <= 0) return null;
    return Number((isLbs ? n * 0.45359237 : n).toFixed(2));
  };

  if (dateIdx < 0 || weightIdx < 0) return [];

  const byDate = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const rawDate = cols[dateIdx];
    const weightKg = toKg(cols[weightIdx]);
    if (!rawDate || !weightKg) continue;

    const dateMatch = rawDate.match(/\d{4}-\d{2}-\d{2}/);
    const isoDate = dateMatch ? dateMatch[0] : new Date(rawDate).toISOString().slice(0, 10);
    if (!isoDate || isoDate === 'Invalid Da') continue;

    let bodyFatPct = null;
    if (fatPctIdx >= 0 && cols[fatPctIdx]) {
      const parsed = parseFloat(cols[fatPctIdx]);
      if (!Number.isNaN(parsed) && parsed > 3 && parsed < 60) bodyFatPct = Number(parsed.toFixed(1));
    } else if (fatMassIdx >= 0 && cols[fatMassIdx]) {
      const fatKg = toKg(cols[fatMassIdx]);
      if (fatKg) {
        const pct = (fatKg / weightKg) * 100;
        if (pct > 3 && pct < 60) bodyFatPct = Number(pct.toFixed(1));
      }
    }

    // Keep the earliest morning reading if multiple weigh-ins on the same date
    if (!byDate.has(isoDate)) {
      byDate.set(isoDate, {
        date: isoDate,
        weightKg,
        bodyFatPct,
        muscleMassKg: muscleIdx >= 0 ? toKg(cols[muscleIdx]) : null,
        hydrationKg: hydrationIdx >= 0 ? toKg(cols[hydrationIdx]) : null,
        boneMassKg: boneIdx >= 0 ? toKg(cols[boneIdx]) : null,
        restingHr: null,
        hrv: null,
        sleepHrs: null,
        source: 'withings-csv',
      });
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function getLocalIsoOffset(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Intake-Aware Smart Weekly Check-In (adherence-neutral, skips blank & partial <45% food days)
export function computeWeeklyCheckIn(entries = [], profile = {}, logsByDate = {}, sessions = []) {
  const safeProfile = profile || {};
  const summary = computeBiometricsSummary(entries, safeProfile);
  const series = summary.series || [];
  const weightKg = summary.trendWeightKg || safeProfile.defaultWeightKg || 74;

  const lookbackIdx = Math.max(0, series.length - Math.min(series.length, 10));
  const baseline = series[lookbackIdx];
  const latest = series[series.length - 1];
  const spanMs = baseline && latest ? parseValidDateMs(latest.date) - parseValidDateMs(baseline.date) : NaN;
  const daysSpan = Number.isFinite(spanMs)
    ? Math.max(0, Math.round(spanMs / (1000 * 60 * 60 * 24)))
    : 0;

  const todayMs = parseValidDateMs(getLocalIsoOffset(0));
  const latestMs = latest ? parseValidDateMs(latest.date) : NaN;
  const daysSinceLatestWeighIn =
    Number.isFinite(latestMs) && Number.isFinite(todayMs)
      ? Math.round((todayMs - latestMs) / (1000 * 60 * 60 * 24))
      : Infinity;
  const hasRecentWeighIn = Number.isFinite(daysSinceLatestWeighIn) && daysSinceLatestWeighIn <= 21;

  // Group sessions by date for accurate per-day planned burn
  const sessionsByDate = new Map();
  for (const s of sessions || []) {
    if (!s || !s.date) continue;
    const list = sessionsByDate.get(s.date) || [];
    list.push(s);
    sessionsByDate.set(s.date, list);
  }

  const bmr24h = computeBmr(safeProfile, weightKg);
  const activityMult =
    safeProfile.activityLevel === 'active' ? 1.45 : safeProfile.activityLevel === 'light' ? 1.35 : 1.25;
  const approxCutDeficit =
    safeProfile.goalMode === 'cut'
      ? Math.min(500, Math.round(((safeProfile.targetLossKgPerWeek || 0.35) * 7700) / 7))
      : 0;

  // Inspect the last 14 COMPLETED past days (excluding unfinished today, blank 0-kcal days, and <45% partial days)
  const completeRecords = [];
  let blankDaysSkipped = 0;
  let partialDaysSkipped = 0;

  for (let offset = -14; offset <= -1; offset += 1) {
    const iso = getLocalIsoOffset(offset);
    const dayLogs = Array.isArray(logsByDate?.[iso]) ? logsByDate[iso] : [];
    const loggedKcal = dayLogs
      .filter((l) => l && l.type !== 'supplement')
      .reduce((acc, l) => acc + Math.max(0, Number(l.kcal) || 0), 0);

    if (loggedKcal <= 0) {
      blankDaysSkipped += 1;
      continue;
    }

    const daySessions = sessionsByDate.get(iso) || [];
    let exerciseKcal = 0;
    let rideHours = 0;
    for (const s of daySessions) {
      const burn = estimateSessionBurn(s, safeProfile, weightKg);
      if (burn.kcal > 0) {
        exerciseKcal += burn.kcal;
        rideHours += (Number(s.durationMin) || 0) / 60;
      }
    }
    const nonExHours = Math.max(12, 24 - rideHours);
    const offBikeBurn = Math.round(
      bmr24h * (nonExHours / 24) * activityMult + (safeProfile.tdeeAdjustmentKcal || 0)
    );
    const plannedBurnKcal = offBikeBurn + exerciseKcal;
    const estimatedDailyTarget = Math.max(1400, plannedBurnKcal - approxCutDeficit);

    if (loggedKcal < estimatedDailyTarget * 0.45) {
      partialDaysSkipped += 1;
      continue;
    }

    completeRecords.push({
      date: iso,
      loggedKcal,
      plannedBurnKcal,
      estimatedDailyTarget,
    });
  }

  const completeDays = completeRecords.length;
  const avgLoggedKcal =
    completeDays > 0
      ? Math.round(completeRecords.reduce((s, r) => s + r.loggedKcal, 0) / completeDays)
      : null;

  if (completeDays < 4 || !Number.isFinite(daysSpan) || daysSpan < 7 || !hasRecentWeighIn) {
    return {
      status: 'building',
      statusLabel: 'Building Baseline',
      completeDays,
      requiredDays: 4,
      partialDaysSkipped,
      blankDaysSkipped,
      daysSpan: Number.isFinite(daysSpan) ? daysSpan : 0,
      avgLoggedKcal,
      weeklyRateKg: Number.isFinite(summary.weeklyRateKg) ? summary.weeklyRateKg : 0,
      estimatedDailyBurn: null,
      avgPlannedBurn: null,
      suggestedAdjustmentKcal: 0,
      checkedInRecently: false,
      message:
        !hasRecentWeighIn && series.length > 0
          ? `Your latest morning weigh-in is over 3 weeks old. Log a fresh morning weigh-in along with at least 4 complete food days (${completeDays}/4) to unlock your personalized calorie check-in.`
          : `Log at least 4 complete food days (${completeDays}/4 in the last 14 days) and 2+ morning weigh-ins across a week to unlock your personalized calorie check-in. Skipped or partial days are ignored automatically.`,
    };
  }

  const avgPlannedBurn = Math.round(
    completeRecords.reduce((s, r) => s + r.plannedBurnKcal, 0) / completeDays
  );
  const avgPlannedTarget = Math.round(
    completeRecords.reduce((s, r) => s + r.estimatedDailyTarget, 0) / completeDays
  );

  // 1 kg body weight change ≈ 7,700 kcal => daily stored energy change = weeklyRateKg * 1100
  const dailyEnergyChangeKcal = (summary.weeklyRateKg * 7700) / 7;
  const estimatedDailyBurn = Math.max(1200, Math.round(avgLoggedKcal - dailyEnergyChangeKcal));

  // Respect recent weekly check-in (within the last 6 days)
  const lastCheckInMs = safeProfile.lastCheckInDate ? parseValidDateMs(safeProfile.lastCheckInDate) : NaN;
  const daysSinceCheckIn =
    Number.isFinite(lastCheckInMs) && Number.isFinite(todayMs)
      ? Math.round((todayMs - lastCheckInMs) / (1000 * 60 * 60 * 24))
      : null;
  if (daysSinceCheckIn !== null && daysSinceCheckIn >= 0 && daysSinceCheckIn < 7) {
    const daysUntilNext = 7 - daysSinceCheckIn;
    return {
      status: 'on_track',
      statusLabel: 'Checked In',
      completeDays,
      requiredDays: 4,
      partialDaysSkipped,
      blankDaysSkipped,
      daysSpan,
      avgLoggedKcal,
      weeklyRateKg: summary.weeklyRateKg,
      estimatedDailyBurn,
      avgPlannedBurn,
      suggestedAdjustmentKcal: 0,
      checkedInRecently: true,
      message: `You completed your weekly check-in on ${safeProfile.lastCheckInDate} — next check-in opens in ${daysUntilNext} day${daysUntilNext === 1 ? '' : 's'}.`,
    };
  }

  const burnGapKcal = estimatedDailyBurn - avgPlannedBurn;

  let suggestedAdjustmentKcal = 0;
  let status = 'on_track';
  let statusLabel = 'On Track';
  let message = '';

  if (safeProfile.goalMode === 'cut' && summary.leanMassDeltaKg <= -0.35) {
    suggestedAdjustmentKcal = 125;
    status = 'ready';
    statusLabel = 'Ready to Check In';
    message = `Your muscle mass trend dipped ${summary.leanMassDeltaKg} kg over ${daysSpan} days while logging ~${avgLoggedKcal.toLocaleString()} kcal/day. Consider nudging your daily budget up +125 kcal to protect power and recovery.`;
  } else if (Math.abs(burnGapKcal) >= 75) {
    const rawStep = Math.round((burnGapKcal * 0.45) / 25) * 25;
    suggestedAdjustmentKcal = Math.max(-150, Math.min(150, rawStep));
    if (suggestedAdjustmentKcal !== 0) {
      status = 'ready';
      statusLabel = 'Ready to Check In';
      message =
        suggestedAdjustmentKcal > 0
          ? `Based on what you actually logged (${avgLoggedKcal.toLocaleString()} kcal/day) and your 7-day weight trend, your body is burning ~${Math.abs(burnGapKcal)} kcal/day more than estimated. Want to nudge your daily budget up +${suggestedAdjustmentKcal} kcal?`
          : `Based on what you actually logged (${avgLoggedKcal.toLocaleString()} kcal/day) and your 7-day weight trend, your body is burning ~${Math.abs(burnGapKcal)} kcal/day less than estimated. Want to trim your daily budget by ${Math.abs(suggestedAdjustmentKcal)} kcal?`;
    }
  }

  if (!message) {
    const intakeVsTarget = avgLoggedKcal - avgPlannedTarget;
    if (intakeVsTarget >= 150) {
      message = `Your estimated daily burn (~${estimatedDailyBurn.toLocaleString()} kcal/day) is right on track. Your scale simply reflected eating ~${intakeVsTarget} kcal/day above plan — no calorie cut needed.`;
    } else {
      message = `Your logged intake (~${avgLoggedKcal.toLocaleString()} kcal/day) and 7-day weight trend line up nicely with your estimated daily burn (~${estimatedDailyBurn.toLocaleString()} kcal/day) — no budget tweak needed.`;
    }
  }

  return {
    status,
    statusLabel,
    completeDays,
    requiredDays: 4,
    partialDaysSkipped,
    blankDaysSkipped,
    daysSpan,
    avgLoggedKcal,
    weeklyRateKg: summary.weeklyRateKg,
    estimatedDailyBurn,
    avgPlannedBurn,
    suggestedAdjustmentKcal,
    checkedInRecently: false,
    message,
  };
}

