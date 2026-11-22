// Biometrics, 7-day EMA weight trend, Lean Mass preservation check, Adaptive TDEE, and Withings CSV parser

export function computeBiometricsSummary(entries = [], profile) {
  const sorted = [...entries]
    .filter((e) => e && e.date && typeof e.weightKg === 'number' && !Number.isNaN(e.weightKg))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    const w = profile.defaultWeightKg || 74;
    const bf = profile.defaultBodyFatPct || 15;
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
  let lastKnownBf = sorted.find((e) => typeof e.bodyFatPct === 'number')?.bodyFatPct ?? profile.defaultBodyFatPct ?? 15;

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
  const daysSpan = Math.max(
    1,
    Math.round((new Date(latest.date) - new Date(baseline.date)) / (1000 * 60 * 60 * 24))
  );
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
      profile.goalMode === 'cut' ? -(profile.targetLossKgPerWeek || 0.35) : 0;
    const rateErrorKg = weeklyRateKg - expectedWeeklyDelta; // positive = losing slower than target
    if (profile.goalMode === 'cut' && leanMassDeltaKg <= -0.35) {
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
  const isLbs = weightIdx >= 0 && header[weightIdx].includes('lb');

  if (dateIdx < 0 || weightIdx < 0) return [];

  const byDate = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const rawDate = cols[dateIdx];
    const rawW = parseFloat(cols[weightIdx]);
    if (!rawDate || Number.isNaN(rawW) || rawW <= 0) continue;

    const dateMatch = rawDate.match(/\d{4}-\d{2}-\d{2}/);
    const isoDate = dateMatch ? dateMatch[0] : new Date(rawDate).toISOString().slice(0, 10);
    if (!isoDate || isoDate === 'Invalid Da') continue;

    const weightKg = Number((isLbs ? rawW * 0.45359237 : rawW).toFixed(2));
    let bodyFatPct = null;
    if (fatPctIdx >= 0 && cols[fatPctIdx]) {
      const parsed = parseFloat(cols[fatPctIdx]);
      if (!Number.isNaN(parsed) && parsed > 3 && parsed < 60) bodyFatPct = Number(parsed.toFixed(1));
    } else if (fatMassIdx >= 0 && cols[fatMassIdx]) {
      const rawFat = parseFloat(cols[fatMassIdx]);
      if (!Number.isNaN(rawFat) && rawFat > 0) {
        const fatKg = isLbs ? rawFat * 0.45359237 : rawFat;
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
        restingHr: null,
        hrv: null,
        sleepHrs: null,
        source: 'withings-csv',
      });
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
