// Direct browser client for Intervals.icu REST API (CORS-enabled by intervals.icu)
// Pulls Withings/Google Health wellness data, completed rides, and upcoming planned workouts.

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function inferIntensity(item) {
  const rawIf = Number(item.icu_intensity || item.intensity || 0);
  const ifVal = rawIf > 2 ? rawIf / 100 : rawIf;
  const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();
  const durationMin = Math.round((item.moving_time || item.elapsed_time || item.moving_time_secs || 0) / 60);

  if (text.includes('race') || text.includes('crit') || text.includes('gran fondo')) return 'race';
  if (text.includes('vo2') || text.includes('anaerobic') || ifVal >= 0.94) return 'vo2max';
  if (text.includes('threshold') || text.includes('ftp') || ifVal >= 0.89) return 'threshold';
  if (text.includes('sweet spot') || text.includes('sweetspot') || text.includes('sst') || ifVal >= 0.83) return 'sweetspot';
  if (text.includes('tempo') || ifVal >= 0.76) return 'tempo';
  if (text.includes('recovery') || text.includes('easy') || (ifVal > 0 && ifVal < 0.58)) return 'recovery';
  if (durationMin >= 150) return 'endurance';
  if (item.icu_training_load && durationMin > 0) {
    const loadPerHr = (item.icu_training_load / durationMin) * 60;
    if (loadPerHr >= 85) return 'threshold';
    if (loadPerHr >= 70) return 'sweetspot';
    if (loadPerHr >= 58) return 'tempo';
    if (loadPerHr < 40) return 'recovery';
  }
  return durationMin > 0 ? 'endurance' : 'rest';
}

export async function syncIntervalsDirect({ athleteId = '0', apiKey, daysBack = 28, daysForward = 7 }) {
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error('Paste your Intervals.icu API key first (from intervals.icu → Settings → Developer Settings).');
  }

  const id = encodeURIComponent(String(athleteId || '0').trim() || '0');
  const authHeader = 'Basic ' + btoa(`API_KEY:${String(apiKey).trim()}`);
  const headers = { Authorization: authHeader, Accept: 'application/json' };

  const today = new Date();
  const oldestWellness = formatDate(addDays(today, -daysBack));
  const newestToday = formatDate(today);
  const oldestActs = formatDate(addDays(today, -14));
  const newestEvents = formatDate(addDays(today, daysForward));

  const base = `https://intervals.icu/api/v1/athlete/${id}`;

  const [wellnessRes, activitiesRes, eventsRes] = await Promise.all([
    fetch(`${base}/wellness?oldest=${oldestWellness}&newest=${newestToday}`, { headers }),
    fetch(`${base}/activities?oldest=${oldestActs}&newest=${newestToday}`, { headers }),
    fetch(`${base}/events?oldest=${oldestActs}&newest=${newestEvents}&category=WORKOUT`, { headers }),
  ]);

  if (wellnessRes.status === 401 || wellnessRes.status === 403) {
    throw new Error('Intervals.icu rejected your credentials. Check your Athlete ID (or use "0") and API key.');
  }

  const wellnessRaw = wellnessRes.ok ? await wellnessRes.json() : [];
  const activitiesRaw = activitiesRes.ok ? await activitiesRes.json() : [];
  const eventsRaw = eventsRes.ok ? await eventsRes.json() : [];

  const biometrics = (Array.isArray(wellnessRaw) ? wellnessRaw : [])
    .filter((w) => w && (w.weight || w.bodyFat || w.restingHR || w.hrv))
    .map((w) => ({
      date: w.id,
      weightKg: typeof w.weight === 'number' ? Number(w.weight.toFixed(2)) : null,
      bodyFatPct: typeof w.bodyFat === 'number' ? Number(w.bodyFat.toFixed(1)) : null,
      restingHr: typeof w.restingHR === 'number' ? Math.round(w.restingHR) : null,
      hrv: typeof w.hrv === 'number' ? Math.round(w.hrv) : null,
      sleepHrs: typeof w.sleepSecs === 'number' ? Number((w.sleepSecs / 3600).toFixed(1)) : null,
      kcalConsumed: typeof w.kcalConsumed === 'number' ? Math.round(w.kcalConsumed) : null,
      source: 'intervals.icu',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let stravaRestrictedCount = 0;

  const completedSessions = (Array.isArray(activitiesRaw) ? activitiesRaw : [])
    .filter((a) => {
      if (!a) return false;
      if (a.source === 'STRAVA' && !a.moving_time && !a.icu_joules) {
        stravaRestrictedCount += 1;
        return false;
      }
      return true;
    })
    .map((a) => {
      const date = String(a.start_date_local || a.start_date || '').slice(0, 10);
      const durationMin = Math.round((a.moving_time || a.elapsed_time || 0) / 60);
      const actualKj = a.icu_joules ? Math.round(a.icu_joules / 1000) : a.calories ? Math.round(a.calories) : 0;
      const startHour = Number(String(a.start_date_local || '09:00').slice(11, 13)) || 9;
      return {
        id: `icu-act-${a.id}`,
        date,
        title: a.name || a.type || 'Completed Ride',
        sport: a.type || 'Ride',
        status: 'completed',
        durationMin,
        intensity: inferIntensity(a),
        actualKj,
        plannedKj: actualKj,
        tss: Math.round(a.icu_training_load || 0),
        timing: startHour < 11 ? 'morning' : startHour < 15 ? 'midday' : 'evening',
        source: 'intervals.icu',
      };
    })
    .filter((s) => s.date);

  const plannedSessions = (Array.isArray(eventsRaw) ? eventsRaw : [])
    .filter((e) => e && e.start_date_local)
    .map((e) => {
      const date = String(e.start_date_local).slice(0, 10);
      const durationMin = Math.round((e.moving_time || e.workout_doc?.duration || 0) / 60);
      const plannedKj = e.joules ? Math.round(e.joules / 1000) : e.icu_joules ? Math.round(e.icu_joules / 1000) : 0;
      const startHour = Number(String(e.start_date_local || '17:00').slice(11, 13)) || 17;
      return {
        id: `icu-evt-${e.id}`,
        date,
        title: e.name || 'Planned Workout',
        sport: e.type || 'Ride',
        status: 'planned',
        durationMin: durationMin || 60,
        intensity: inferIntensity(e),
        plannedKj,
        actualKj: 0,
        tss: Math.round(e.icu_training_load || 0),
        timing: startHour < 11 ? 'morning' : startHour < 15 ? 'midday' : 'evening',
        source: 'intervals.icu',
      };
    });

  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    biometrics,
    completedSessions,
    plannedSessions,
    diagnostics: {
      wellnessCount: biometrics.length,
      completedCount: completedSessions.length,
      plannedCount: plannedSessions.length,
      hasWeight: biometrics.some((b) => b.weightKg != null),
      hasBodyFat: biometrics.some((b) => b.bodyFatPct != null),
      hasHrv: biometrics.some((b) => b.hrv != null),
      stravaRestrictedCount,
    },
  };
}

export async function pushWellnessDirect({ athleteId = '0', apiKey, date, kcalConsumed, carbs, protein, fat }) {
  const id = encodeURIComponent(String(athleteId || '0').trim() || '0');
  const authHeader = 'Basic ' + btoa(`API_KEY:${String(apiKey).trim()}`);
  const resp = await fetch(`https://intervals.icu/api/v1/athlete/${id}/wellness/${date}`, {
    method: 'PUT',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      kcalConsumed: Math.round(kcalConsumed || 0),
      carbohydrates: Math.round(carbs || 0),
      protein: Math.round(protein || 0),
      fatTotal: Math.round(fat || 0),
    }),
  });
  if (!resp.ok) {
    throw new Error(`Could not push daily totals (HTTP ${resp.status})`);
  }
  return { ok: true };
}
