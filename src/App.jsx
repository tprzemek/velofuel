import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame,
  UtensilsCrossed,
  Calendar,
  Scale,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import {
  DEFAULT_PROFILE,
  DEFAULT_STAPLES,
  DEFAULT_SUPPLEMENTS,
  createDefaultBiometrics,
  createDefaultLogs,
  createDefaultSessions,
  getIsoDate,
  migrateStaple,
} from './engine/defaultData';
import { computeBiometricsSummary } from './engine/biometricsEngine';
import { computeDailyPlan, scaleStapleToTargets } from './engine/fuelingEngine';
import { syncIntervalsDirect } from './engine/intervalsClient';
import { exchangeWithingsCode, fetchWithingsMeasurements } from './engine/withingsClient';
import { formatFoodAmount, getUnits } from './engine/units';
import TodayView from './components/TodayView';
import StaplesView from './components/StaplesView';
import TrainingView from './components/TrainingView';
import BodyView from './components/BodyView';
import SyncView from './components/SyncView';
import StapleScalerModal from './components/StapleScalerModal';
import WorkMealModal from './components/WorkMealModal';
import QuickFoodModal from './components/QuickFoodModal';
import SupplementsModal from './components/SupplementsModal';

const STORAGE_KEY = 'velofuel_state_v1';
const AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000;

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const migratedStaples =
        Array.isArray(parsed.staples) && parsed.staples.length
          ? parsed.staples.map(migrateStaple).filter(Boolean)
          : DEFAULT_STAPLES;
      return {
        profile: {
          ...DEFAULT_PROFILE,
          ...(parsed.profile || {}),
          units: getUnits(parsed.profile),
        },
        staples: migratedStaples.length ? migratedStaples : DEFAULT_STAPLES,
        supplements: Array.isArray(parsed.supplements) ? parsed.supplements : DEFAULT_SUPPLEMENTS,
        sessions: Array.isArray(parsed.sessions) && parsed.sessions.length ? parsed.sessions : createDefaultSessions(),
        biometrics: Array.isArray(parsed.biometrics) && parsed.biometrics.length ? parsed.biometrics : createDefaultBiometrics(),
        logsByDate: parsed.logsByDate || createDefaultLogs(),
        intervalsConfig: { athleteId: '0', apiKey: '', autoSync: true, ...(parsed.intervalsConfig || {}) },
        withingsConfig: {
          clientId: '',
          clientSecret: '',
          accessToken: '',
          refreshToken: '',
          expiresAt: 0,
          ...(parsed.withingsConfig || {}),
        },
        aiConfig: { provider: 'auto', apiKey: '', ...(parsed.aiConfig || {}) },
      };
    }
  } catch {
    // ignore corrupted storage
  }
  return {
    profile: DEFAULT_PROFILE,
    staples: DEFAULT_STAPLES,
    supplements: DEFAULT_SUPPLEMENTS,
    sessions: createDefaultSessions(),
    biometrics: createDefaultBiometrics(),
    logsByDate: createDefaultLogs(),
    intervalsConfig: { athleteId: '0', apiKey: '', autoSync: true },
    withingsConfig: { clientId: '', clientSecret: '', accessToken: '', refreshToken: '', expiresAt: 0 },
    aiConfig: { provider: 'auto', apiKey: '' },
  };
}

function shiftIsoDate(iso, deltaDays) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatTopDate(iso) {
  const today = getIsoDate(0);
  if (iso === today) return 'Today';
  if (iso === getIsoDate(-1)) return 'Yesterday';
  if (iso === getIsoDate(1)) return 'Tomorrow';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function App() {
  const [state, setState] = useState(loadInitialState);
  const [activeTab, setActiveTab] = useState('today');
  const [selectedDate, setSelectedDate] = useState(() => getIsoDate(0));
  const [toast, setToast] = useState('');
  const [bgSyncing, setBgSyncing] = useState(false);
  const lastSyncRef = useRef(0);

  // Modals
  const [stapleModal, setStapleModal] = useState({ open: false, slotInfo: null, remaining: null });
  const [quickFoodModal, setQuickFoodModal] = useState({ open: false, slotInfo: null });
  const [workModal, setWorkModal] = useState({ open: false, slotInfo: null });
  const [supplementsModalOpen, setSupplementsModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(window.__vfToastTimer);
    window.__vfToastTimer = window.setTimeout(() => setToast(''), 3400);
  }, []);

  const units = useMemo(() => getUnits(state.profile), [state.profile]);

  const biometricsSummary = useMemo(
    () => computeBiometricsSummary(state.biometrics, state.profile),
    [state.biometrics, state.profile]
  );

  const sessionByDate = useMemo(() => {
    const map = new Map();
    state.sessions.forEach((s) => map.set(s.date, s));
    return map;
  }, [state.sessions]);

  const selectedSession = sessionByDate.get(selectedDate) || null;
  const tomorrowSession = sessionByDate.get(shiftIsoDate(selectedDate, 1)) || null;
  const yesterdaySession = sessionByDate.get(shiftIsoDate(selectedDate, -1)) || null;

  const dailyPlan = useMemo(
    () =>
      computeDailyPlan({
        date: selectedDate,
        profile: state.profile,
        biometricsSummary,
        todaySession: selectedSession,
        tomorrowSession,
        yesterdaySession,
      }),
    [selectedDate, state.profile, biometricsSummary, selectedSession, tomorrowSession, yesterdaySession]
  );

  const selectedLogs = useMemo(
    () => state.logsByDate[selectedDate] || [],
    [state.logsByDate, selectedDate]
  );

  const handleImportBiometrics = useCallback((entries) => {
    setState((prev) => {
      const map = new Map(prev.biometrics.map((b) => [b.date, b]));
      entries.forEach((e) => {
        const cur = map.get(e.date) || {};
        map.set(e.date, {
          ...cur,
          ...e,
          weightKg: e.weightKg ?? cur.weightKg ?? null,
          bodyFatPct: e.bodyFatPct ?? cur.bodyFatPct ?? null,
          muscleMassKg: e.muscleMassKg ?? cur.muscleMassKg ?? null,
          hydrationKg: e.hydrationKg ?? cur.hydrationKg ?? null,
          boneMassKg: e.boneMassKg ?? cur.boneMassKg ?? null,
          restingHr: e.restingHr ?? cur.restingHr ?? null,
          hrv: e.hrv ?? cur.hrv ?? null,
        });
      });
      return { ...prev, biometrics: Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)) };
    });
  }, []);

  const handleApplyIntervalsSync = useCallback(
    (syncData) => {
      if (syncData.biometrics?.length) {
        handleImportBiometrics(syncData.biometrics);
      }
      setState((prev) => {
        const sessMap = new Map(prev.sessions.map((s) => [s.date, s]));
        (syncData.plannedSessions || []).forEach((s) => {
          const existing = sessMap.get(s.date);
          if (!existing || existing.status !== 'completed') {
            sessMap.set(s.date, { ...s, bottleSizeMl: existing?.bottleSizeMl });
          }
        });
        const nextLogsByDate = { ...prev.logsByDate };
        (syncData.completedSessions || []).forEach((s) => {
          const existing = sessMap.get(s.date);
          sessMap.set(s.date, { ...s, bottleSizeMl: existing?.bottleSizeMl });
          // If the completed ride from Intervals.icu recorded actual carbs_ingested and user hasn't logged on-bike fuel yet, auto-log it
          if (s.carbsIngested > 0) {
            const dayLogs = nextLogsByDate[s.date] || [];
            const alreadyLoggedOnBike = dayLogs.some((l) => l.slot === 'on_bike');
            if (!alreadyLoggedOnBike) {
              nextLogsByDate[s.date] = [
                ...dayLogs,
                {
                  id: `log-bike-icu-${s.date}`,
                  slot: 'on_bike',
                  type: 'on_bike',
                  title: 'Actual Ride Fuel (from Intervals.icu)',
                  detail: `${s.carbsIngested}g carbs synced from completed ride`,
                  carbs: s.carbsIngested,
                  protein: 0,
                  fat: 0,
                  kcal: s.carbsIngested * 4,
                  uncertaintyPct: 0,
                  micros: { fiber: 0, iron: 0, vitC: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 0 },
                  loggedAt: 'Auto',
                },
              ];
            }
          }
        });
        const nextProfile = syncData.profilePatch
          ? { ...prev.profile, ...syncData.profilePatch }
          : prev.profile;
        return {
          ...prev,
          profile: nextProfile,
          sessions: Array.from(sessMap.values()),
          logsByDate: nextLogsByDate,
        };
      });
    },
    [handleImportBiometrics]
  );

  const runBackgroundSync = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (!force && now - lastSyncRef.current < AUTO_SYNC_INTERVAL_MS) return;
      const canIntervals = Boolean(state.intervalsConfig.apiKey?.trim()) && (force || state.intervalsConfig.autoSync !== false);
      const canWithings = Boolean(state.withingsConfig.accessToken || state.withingsConfig.refreshToken);
      if (!canIntervals && !canWithings) return;

      lastSyncRef.current = now;
      setBgSyncing(true);
      try {
        const tasks = [];
        if (canIntervals) {
          tasks.push(
            syncIntervalsDirect({
              athleteId: state.intervalsConfig.athleteId || '0',
              apiKey: state.intervalsConfig.apiKey.trim(),
              daysBack: 28,
              daysForward: 7,
            })
              .then((data) => {
                handleApplyIntervalsSync(data);
                if (force) {
                  showToast(
                    data.diagnostics?.pulledFtp
                      ? `Synced Intervals.icu (FTP ${data.diagnostics.pulledFtp}W + rides)`
                      : 'Synced Intervals.icu rides & wellness!'
                  );
                }
              })
              .catch(() => {})
          );
        }
        if (canWithings) {
          tasks.push(
            fetchWithingsMeasurements(state.withingsConfig, 30)
              .then((res) => {
                if (res.updatedTokens) {
                  setState((prev) => ({
                    ...prev,
                    withingsConfig: { ...prev.withingsConfig, ...res.updatedTokens, lastSyncedAt: new Date().toISOString() },
                  }));
                }
                if (res.biometrics?.length) {
                  handleImportBiometrics(res.biometrics);
                }
              })
              .catch(() => {})
          );
        }
        await Promise.all(tasks);
      } finally {
        setBgSyncing(false);
      }
    },
    [state.intervalsConfig, state.withingsConfig, handleApplyIntervalsSync, handleImportBiometrics, showToast]
  );

  // Handle Withings OAuth redirect (?code=...) once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    const { clientId, clientSecret } = state.withingsConfig || {};
    if (!clientId || !clientSecret) return;

    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, redirectUri);

    (async () => {
      try {
        setBgSyncing(true);
        const tokens = await exchangeWithingsCode({ clientId, clientSecret, code, redirectUri });
        const nextCfg = { ...state.withingsConfig, ...tokens, lastSyncedAt: new Date().toISOString() };
        setState((prev) => ({ ...prev, withingsConfig: nextCfg }));
        const res = await fetchWithingsMeasurements(nextCfg, 30);
        if (res.biometrics?.length) {
          handleImportBiometrics(res.biometrics);
        }
        showToast(`Connected Withings scale! Synced ${res.biometrics.length} days.`);
      } catch (err) {
        showToast(`Withings connect error: ${err.message}`);
      } finally {
        setBgSyncing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync Intervals.icu & Withings on open and when returning to app tab
  useEffect(() => {
    runBackgroundSync(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        runBackgroundSync(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [runBackgroundSync]);

  const handleLogEntry = (entry) => {
    setState((prev) => ({
      ...prev,
      logsByDate: {
        ...prev.logsByDate,
        [selectedDate]: [...(prev.logsByDate[selectedDate] || []), entry],
      },
    }));
    if (entry.type === 'supplement') {
      showToast(`Logged supplement: ${entry.title}`);
    } else {
      showToast(`Logged ${entry.title} (${entry.carbs}g C · ${entry.protein}g P)`);
    }
  };

  const handleDeleteLog = (logId) => {
    setState((prev) => ({
      ...prev,
      logsByDate: {
        ...prev.logsByDate,
        [selectedDate]: (prev.logsByDate[selectedDate] || []).filter((l) => l.id !== logId),
      },
    }));
  };

  const handleLogOnBike = (slot, onBikePlan) => {
    handleLogEntry({
      id: `log-bike-${Date.now()}`,
      slot: slot.slot,
      type: 'on_bike',
      title: `On-Bike Mix & Gels (${onBikePlan.carbsPerHour}g/hr)`,
      detail: `${onBikePlan.bottles}× ${onBikePlan.bottleLabel} · ${onBikePlan.totalSodiumMg}mg sodium`,
      bottles: onBikePlan.bottles,
      carbs: onBikePlan.totalCarbs,
      protein: 0,
      fat: 0,
      kcal: onBikePlan.totalKcal,
      uncertaintyPct: 0,
      micros: { fiber: 0, iron: 0, vitC: 0, calcium: 20, vitD: 0, magnesium: 30, sodium: onBikePlan.totalSodiumMg },
      loggedAt: new Date().toTimeString().slice(0, 5),
    });
  };

  const handleSaveOnBikeLog = ({
    existingId,
    carbs,
    protein = 0,
    fat = 0,
    sodiumMg,
    bottles,
    bottleLabel,
    scannedItems = [],
    durationMin,
    plannedCarbs,
    silent = false,
  }) => {
    const c = Math.max(0, Math.round(Number(carbs) || 0));
    const p = Math.max(0, Math.round(Number(protein) || 0));
    const f = Math.max(0, Math.round(Number(fat) || 0));
    const na = Math.max(0, Math.round(Number(sodiumMg) || 0));
    const hrs = Math.max(0.25, (Number(durationMin) || 60) / 60);
    const rate = Math.round(c / hrs);
    const diff = c - (plannedCarbs || 0);
    const diffNote =
      diff === 0 ? 'on plan' : diff > 0 ? `+${diff}g vs plan` : `${diff}g vs plan`;
    const scannedNote = scannedItems.length > 0 ? `${scannedItems.join(', ')} · ` : '';
    const entry = {
      id: existingId || `log-bike-${Date.now()}`,
      slot: 'on_bike',
      type: 'on_bike',
      title: `Actual Ride Fuel (${rate}g/hr)`,
      detail: `${scannedNote}${bottles}× ${bottleLabel} · ${na}mg sodium · ${diffNote}`,
      bottles,
      carbs: c,
      protein: p,
      fat: f,
      kcal: c * 4 + p * 4 + f * 9,
      uncertaintyPct: 0,
      micros: { fiber: 0, iron: 0, vitC: 0, calcium: 15, vitD: 0, magnesium: 25, sodium: na },
      loggedAt: new Date().toTimeString().slice(0, 5),
    };

    setState((prev) => {
      const dayLogs = prev.logsByDate[selectedDate] || [];
      const exists = existingId && dayLogs.some((l) => l.id === existingId);
      const nextDayLogs = exists
        ? dayLogs.map((l) => (l.id === existingId ? entry : l))
        : [...dayLogs, entry];
      return {
        ...prev,
        logsByDate: {
          ...prev.logsByDate,
          [selectedDate]: nextDayLogs,
        },
      };
    });

    if (!silent) {
      const macroText = p > 0 || f > 0 ? `${c}g C · ${p}g P · ${f}g F` : `${c}g carbs`;
      showToast(
        diff < 0
          ? `Saved ${macroText} ride fuel — +${Math.abs(diff)}g carbs added to remaining meals today.`
          : diff > 0
          ? `Saved ${macroText} ride fuel — remaining meals trimmed by ${diff}g carbs.`
          : `Saved ${macroText} ride fuel (matches plan).`
      );
    }
  };

  const handleQuickLogStaple = (slot, staple) => {
    const scaled = scaleStapleToTargets(staple, slot.targetCarbs, slot.targetProtein);
    const formattedDetail = scaled.resolvedItems
      .map((i) => `${formatFoodAmount(i.grams, units)} ${i.name}`)
      .join(' · ');
    handleLogEntry({
      id: `log-${Date.now()}`,
      slot: slot.slot,
      type: 'staple',
      stapleId: staple.id,
      title: staple.name,
      detail: formattedDetail,
      carbs: scaled.carbs,
      protein: scaled.protein,
      fat: scaled.fat,
      kcal: scaled.kcal,
      uncertaintyPct: 0,
      micros: scaled.micros,
      loggedAt: new Date().toTimeString().slice(0, 5),
    });
  };

  const handleSaveSlotAsStaple = (slot, slotLogs) => {
    const ingredients = slotLogs
      .filter((l) => l.type === 'food' && l.ingredient)
      .map((l) => ({ ...l.ingredient }));
    if (ingredients.length === 0) return;

    const mealName =
      ingredients.length === 1
        ? ingredients[0].name
        : `${slot.label}: ${ingredients.map((i) => i.name.split(' ')[0]).slice(0, 3).join(' + ')}`;

    const newStaple = {
      id: `staple-${Date.now()}`,
      name: mealName,
      mealTypes: [slot.slot],
      dailySlot: null,
      prepNote: `Saved from ${slot.label} log (${ingredients.length} items).`,
      ingredients,
    };
    setState((prev) => ({ ...prev, staples: [newStaple, ...prev.staples] }));
    showToast(`Saved "${mealName}" to your Saved Meals!`);
  };

  const handleSetRideBottleSize = (date, bottleSizeMl) => {
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => (s.date === date ? { ...s, bottleSizeMl } : s)),
    }));
  };

  const handleCompleteRide = (date, actualKj, durationMin) => {
    setState((prev) => {
      const exists = prev.sessions.some((s) => s.date === date);
      const updated = exists
        ? prev.sessions.map((s) =>
            s.date === date ? { ...s, status: 'completed', actualKj, durationMin } : s
          )
        : [
            ...prev.sessions,
            {
              id: `sess-${date}`,
              date,
              title: 'Completed Ride',
              sport: 'Ride',
              status: 'completed',
              durationMin,
              intensity: actualKj >= 1300 ? 'threshold' : 'endurance',
              plannedKj: actualKj,
              actualKj,
              timing: 'evening',
              source: 'manual',
            },
          ];
      return { ...prev, sessions: updated };
    });
    showToast(`Updated ride to ${actualKj} kJ — remaining meal targets recalculated.`);
  };

  const handleSaveSession = (sessionObj) => {
    setState((prev) => {
      const filtered = prev.sessions.filter((s) => s.date !== sessionObj.date);
      return { ...prev, sessions: [...filtered, sessionObj] };
    });
    showToast(`Saved ${sessionObj.title} for ${sessionObj.date}`);
  };

  const handleSaveStaple = (staple) => {
    setState((prev) => {
      const exists = prev.staples.some((s) => s.id === staple.id);
      const baseList = exists
        ? prev.staples.map((s) => (s.id === staple.id ? staple : s))
        : [staple, ...prev.staples];
      const next = staple.dailySlot
        ? baseList.map((s) => (s.id !== staple.id && s.dailySlot === staple.dailySlot ? { ...s, dailySlot: null } : s))
        : baseList;
      return { ...prev, staples: next };
    });
    showToast(`Saved "${staple.name}" to your Saved Meals.`);
  };

  const handleDeleteStaple = (id) => {
    setState((prev) => ({ ...prev, staples: prev.staples.filter((s) => s.id !== id) }));
  };

  const handleSaveSupplement = (supp) => {
    setState((prev) => ({
      ...prev,
      supplements: [supp, ...prev.supplements.filter((s) => s.id !== supp.id)],
    }));
  };

  const handleDeleteSupplement = (id) => {
    setState((prev) => ({
      ...prev,
      supplements: prev.supplements.filter((s) => s.id !== id),
    }));
  };

  const handleToggleDailyStack = (id) => {
    setState((prev) => ({
      ...prev,
      supplements: prev.supplements.map((s) => (s.id === id ? { ...s, inDailyStack: !s.inDailyStack } : s)),
    }));
  };

  const handleLogSupplement = (supp) => {
    handleLogEntry({
      id: `log-supp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      slot: 'supplements',
      type: 'supplement',
      supplementId: supp.id,
      title: supp.name,
      detail: 'Daily supplement',
      carbs: 0,
      protein: 0,
      fat: 0,
      kcal: 0,
      uncertaintyPct: 0,
      micros: {
        fiber: 0,
        iron: Number(supp.micros?.iron || 0),
        vitC: Number(supp.micros?.vitC || 0),
        calcium: Number(supp.micros?.calcium || 0),
        vitD: Number(supp.micros?.vitD || 0),
        magnesium: Number(supp.micros?.magnesium || 0),
        sodium: Number(supp.micros?.sodium || 0),
      },
      loggedAt: new Date().toTimeString().slice(0, 5),
    });
  };

  const handleLogDailyStack = (stackItems) => {
    const newEntries = stackItems.map((supp, idx) => ({
      id: `log-supp-${Date.now()}-${idx}`,
      slot: 'supplements',
      type: 'supplement',
      supplementId: supp.id,
      title: supp.name,
      detail: 'Daily supplement',
      carbs: 0,
      protein: 0,
      fat: 0,
      kcal: 0,
      uncertaintyPct: 0,
      micros: {
        fiber: 0,
        iron: Number(supp.micros?.iron || 0),
        vitC: Number(supp.micros?.vitC || 0),
        calcium: Number(supp.micros?.calcium || 0),
        vitD: Number(supp.micros?.vitD || 0),
        magnesium: Number(supp.micros?.magnesium || 0),
        sodium: Number(supp.micros?.sodium || 0),
      },
      loggedAt: new Date().toTimeString().slice(0, 5),
    }));
    setState((prev) => ({
      ...prev,
      logsByDate: {
        ...prev.logsByDate,
        [selectedDate]: [...(prev.logsByDate[selectedDate] || []), ...newEntries],
      },
    }));
    showToast(`Logged ${newEntries.length} daily supplement${newEntries.length > 1 ? 's' : ''}!`);
  };

  const handleUpdateProfile = (patch) => {
    setState((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
  };

  const handleAddBiometric = (entry) => {
    setState((prev) => {
      const map = new Map(prev.biometrics.map((b) => [b.date, b]));
      map.set(entry.date, { ...(map.get(entry.date) || {}), ...entry });
      return { ...prev, biometrics: Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)) };
    });
  };

  const handleExportBackup = () => {
    const safeCopy = {
      ...state,
      intervalsConfig: { ...state.intervalsConfig, apiKey: '' },
      withingsConfig: { clientId: state.withingsConfig.clientId, clientSecret: '', accessToken: '', refreshToken: '', expiresAt: 0 },
      aiConfig: { ...state.aiConfig, apiKey: '' },
    };
    const blob = new Blob([JSON.stringify(safeCopy, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velofuel-backup-${getIsoDate(0)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported VeloFuel backup (API keys & tokens excluded for safety).');
  };

  const handleImportBackup = (parsed) => {
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...(parsed.profile || {}) },
      staples:
        Array.isArray(parsed.staples) && parsed.staples.length
          ? parsed.staples.map(migrateStaple).filter(Boolean)
          : prev.staples,
      supplements: Array.isArray(parsed.supplements) ? parsed.supplements : prev.supplements,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : prev.sessions,
      biometrics: Array.isArray(parsed.biometrics) ? parsed.biometrics : prev.biometrics,
      logsByDate: parsed.logsByDate || prev.logsByDate,
    }));
  };

  const loggedSupplementIds = useMemo(
    () => new Set(selectedLogs.filter((l) => l.type === 'supplement').map((l) => l.supplementId)),
    [selectedLogs]
  );

  const hasAnyConnectedSync = Boolean(
    state.intervalsConfig.apiKey?.trim() || state.withingsConfig.accessToken || state.withingsConfig.refreshToken
  );

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <img src="./icon-512.jpg" alt="VeloFuel" className="brand-icon" />
          <div>
            <div className="brand-title">VeloFuel</div>
            <div className="brand-sub">Smart Cycling Fuel</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasAnyConnectedSync && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => runBackgroundSync(true)}
              disabled={bgSyncing}
              title="Resync Intervals.icu & Withings now"
              aria-label="Resync now"
            >
              <RefreshCw size={15} className={bgSyncing ? 'spin' : ''} />
            </button>
          )}
          <div className="date-stepper" aria-label="Change date">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSelectedDate((d) => shiftIsoDate(d, -1))}
              aria-label="Previous day"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="date-label"
              onClick={() => setSelectedDate(getIsoDate(0))}
              title="Jump to Today"
            >
              {formatTopDate(selectedDate)}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSelectedDate((d) => shiftIsoDate(d, 1))}
              aria-label="Next day"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      <main className="app-main">
        {activeTab === 'today' && (
          <TodayView
            plan={dailyPlan}
            profile={state.profile}
            units={units}
            session={selectedSession}
            logs={selectedLogs}
            staples={state.staples}
            supplements={state.supplements}
            biometricsSummary={biometricsSummary}
            hasIntervalsConnected={Boolean(state.intervalsConfig.apiKey?.trim())}
            bgSyncing={bgSyncing}
            onResyncNow={() => runBackgroundSync(true)}
            onOpenStapleModal={(slotInfo, remaining) => setStapleModal({ open: true, slotInfo, remaining })}
            onOpenQuickFoodModal={(slotInfo) => setQuickFoodModal({ open: true, slotInfo })}
            onOpenWorkModal={(slotInfo) => setWorkModal({ open: true, slotInfo })}
            onOpenSupplementsModal={() => setSupplementsModalOpen(true)}
            onQuickLogStaple={handleQuickLogStaple}
            onSaveSlotAsStaple={handleSaveSlotAsStaple}
            onLogDailyStack={handleLogDailyStack}
            onSetRideBottleSize={handleSetRideBottleSize}
            onDeleteLog={handleDeleteLog}
            onLogOnBike={handleLogOnBike}
            onSaveOnBikeLog={handleSaveOnBikeLog}
            onCompleteRide={handleCompleteRide}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'staples' && (
          <StaplesView
            staples={state.staples}
            units={units}
            onSaveStaple={handleSaveStaple}
            onDeleteStaple={handleDeleteStaple}
          />
        )}

        {activeTab === 'training' && (
          <TrainingView
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            sessions={state.sessions}
            profile={state.profile}
            biometricsSummary={biometricsSummary}
            onSaveSession={handleSaveSession}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'body' && (
          <BodyView
            profile={state.profile}
            units={units}
            biometricsSummary={biometricsSummary}
            onUpdateProfile={handleUpdateProfile}
            onAddBiometric={handleAddBiometric}
            onImportBiometrics={handleImportBiometrics}
            showToast={showToast}
          />
        )}

        {activeTab === 'sync' && (
          <SyncView
            profile={state.profile}
            onUpdateProfile={handleUpdateProfile}
            intervalsConfig={state.intervalsConfig}
            onUpdateIntervalsConfig={(patch) =>
              setState((prev) => ({ ...prev, intervalsConfig: { ...prev.intervalsConfig, ...patch } }))
            }
            onApplyIntervalsSync={handleApplyIntervalsSync}
            withingsConfig={state.withingsConfig}
            onUpdateWithingsConfig={(patch) =>
              setState((prev) => ({ ...prev, withingsConfig: { ...prev.withingsConfig, ...patch } }))
            }
            onImportBiometrics={handleImportBiometrics}
            aiConfig={state.aiConfig}
            onUpdateAiConfig={(patch) =>
              setState((prev) => ({ ...prev, aiConfig: { ...prev.aiConfig, ...patch } }))
            }
            todayDate={selectedDate}
            todayLogs={selectedLogs}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            showToast={showToast}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {[
          { id: 'today', label: 'Today', icon: Flame },
          { id: 'staples', label: 'Staples', icon: UtensilsCrossed },
          { id: 'training', label: 'Week', icon: Calendar },
          { id: 'body', label: 'Body', icon: Scale },
          { id: 'sync', label: 'Sync', icon: SlidersHorizontal },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={19} strokeWidth={activeTab === tab.id ? 2.3 : 1.9} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <StapleScalerModal
        isOpen={stapleModal.open}
        onClose={() => setStapleModal({ open: false, slotInfo: null, remaining: null })}
        slotInfo={stapleModal.slotInfo}
        staples={state.staples}
        remainingMacros={stapleModal.remaining}
        units={units}
        onLogEntry={handleLogEntry}
      />

      <QuickFoodModal
        isOpen={quickFoodModal.open}
        onClose={() => setQuickFoodModal({ open: false, slotInfo: null })}
        slotInfo={quickFoodModal.slotInfo}
        units={units}
        onLogEntry={handleLogEntry}
      />

      <WorkMealModal
        isOpen={workModal.open}
        onClose={() => setWorkModal({ open: false, slotInfo: null })}
        slotInfo={workModal.slotInfo}
        aiConfig={state.aiConfig}
        onLogEntry={handleLogEntry}
      />

      <SupplementsModal
        isOpen={supplementsModalOpen}
        onClose={() => setSupplementsModalOpen(false)}
        supplements={state.supplements}
        loggedSupplementIds={loggedSupplementIds}
        onSaveSupplement={handleSaveSupplement}
        onDeleteSupplement={handleDeleteSupplement}
        onToggleDailyStack={handleToggleDailyStack}
        onLogSupplement={handleLogSupplement}
      />
    </div>
  );
}
