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
import { computeBiometricsSummary, computeWeeklyCheckIn } from './engine/biometricsEngine';
import { computeDailyPlan, DEFAULT_MEAL_SLOTS, scaleStapleToTargets } from './engine/fuelingEngine';
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
        customMealsByDate: parsed.customMealsByDate || {},
        timelineOrderByDate: parsed.timelineOrderByDate || {},
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
    customMealsByDate: {},
    timelineOrderByDate: {},
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

  const sessionsByDate = useMemo(() => {
    const map = new Map();
    state.sessions.forEach((s) => {
      if (!s || !s.date) return;
      const list = map.get(s.date) || [];
      list.push(s);
      map.set(s.date, list);
    });
    return map;
  }, [state.sessions]);

  const selectedSessions = useMemo(
    () => sessionsByDate.get(selectedDate) || [],
    [sessionsByDate, selectedDate]
  );
  const tomorrowSessions = useMemo(
    () => sessionsByDate.get(shiftIsoDate(selectedDate, 1)) || [],
    [sessionsByDate, selectedDate]
  );
  const yesterdaySessions = useMemo(
    () => sessionsByDate.get(shiftIsoDate(selectedDate, -1)) || [],
    [sessionsByDate, selectedDate]
  );

  const selectedDayMeals = state.customMealsByDate?.[selectedDate] || null;
  const selectedDayOrder = state.timelineOrderByDate?.[selectedDate] || null;

  const dailyPlan = useMemo(
    () =>
      computeDailyPlan({
        date: selectedDate,
        profile: state.profile,
        biometricsSummary,
        todaySessions: selectedSessions,
        tomorrowSessions,
        yesterdaySessions,
        dayMeals: selectedDayMeals,
        dayTimelineOrder: selectedDayOrder,
      }),
    [
      selectedDate,
      state.profile,
      biometricsSummary,
      selectedSessions,
      tomorrowSessions,
      yesterdaySessions,
      selectedDayMeals,
      selectedDayOrder,
    ]
  );

  const selectedLogs = useMemo(
    () => state.logsByDate[selectedDate] || [],
    [state.logsByDate, selectedDate]
  );

  const yesterdayDate = useMemo(() => shiftIsoDate(selectedDate, -1), [selectedDate]);
  const isCopyableMealLog = useCallback(
    (l) =>
      Boolean(
        l &&
          l.type !== 'on_bike' &&
          l.type !== 'supplement' &&
          l.slot !== 'on_bike' &&
          !String(l.slot || '').startsWith('workout-')
      ),
    []
  );
  const yesterdayMealLogs = useMemo(
    () => (state.logsByDate[yesterdayDate] || []).filter(isCopyableMealLog),
    [state.logsByDate, yesterdayDate, isCopyableMealLog]
  );

  const recentFoods = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (let offset = 0; offset >= -13; offset -= 1) {
      const iso = shiftIsoDate(selectedDate, offset);
      const dayLogs = state.logsByDate[iso] || [];
      for (let i = dayLogs.length - 1; i >= 0; i -= 1) {
        const entry = dayLogs[i];
        if (!entry || entry.type !== 'food' || !entry.ingredient) continue;
        const ing = entry.ingredient;
        const key = String(ing.name || entry.title || '').trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        list.push({
          id: ing.id || `recent-${key}`,
          name: ing.name || entry.title,
          defaultGrams: Math.max(1, Math.round(Number(ing.grams) || 100)),
          defaultRole: ing.role || 'fixed',
          servings: ing.servings,
          per100g: ing.per100g || {},
        });
        if (list.length >= 8) return list;
      }
    }
    return list;
  }, [state.logsByDate, selectedDate]);

  const weeklyCheckIn = useMemo(
    () => computeWeeklyCheckIn(state.biometrics, state.profile, state.logsByDate, state.sessions),
    [state.biometrics, state.profile, state.logsByDate, state.sessions]
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
        // Index previous sessions by id so we preserve per-workout user tweaks
        const prevById = new Map(prev.sessions.map((s) => [s.id, s]));
        const incomingIcu = [
          ...(syncData.completedSessions || []),
          ...(syncData.plannedSessions || []),
        ];
        const syncedDates = new Set(incomingIcu.map((s) => s.date));

        // Keep user-created manual sessions (and sample sessions on dates outside Intervals.icu data);
        // drop stale icu-* sessions (so paired/deleted Intervals events don't duplicate) and replace demo placeholders on synced dates
        const retainedManual = prev.sessions.filter((s) => {
          if (s.source === 'intervals.icu' || String(s.id || '').startsWith('icu-')) return false;
          if (syncedDates.has(s.date) && /^sess-(m\d|p\d|0)$/.test(String(s.id || ''))) return false;
          return true;
        });

        const mergedIcu = incomingIcu.map((s) => {
          const existing =
            prevById.get(s.id) || (s.pairedEventId ? prevById.get(s.pairedEventId) : null);
          return {
            ...s,
            bottleSizeMl: existing?.bottleSizeMl,
            timelineOrder: existing?.timelineOrder,
            heatLevel: existing?.heatLevel,
            sweatRate: existing?.sweatRate,
            carbBase: existing?.carbBase,
            saltSource: existing?.saltSource,
          };
        });

        const nextLogsByDate = { ...prev.logsByDate };
        (syncData.completedSessions || []).forEach((s) => {
          // If a completed ride from Intervals.icu recorded actual carbs_ingested and user hasn't logged fuel yet, auto-log it
          if (s.carbsIngested > 0) {
            const dayLogs = nextLogsByDate[s.date] || [];
            const logId = `log-bike-icu-${s.id}`;
            const alreadyLogged = dayLogs.some((l) => l.id === logId || l.slot === 'on_bike');
            if (!alreadyLogged) {
              nextLogsByDate[s.date] = [
                ...dayLogs,
                {
                  id: logId,
                  slot: 'on_bike',
                  type: 'on_bike',
                  title: `Actual Fuel · ${s.title}`,
                  detail: `${s.carbsIngested}g carbs synced from Intervals.icu`,
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
          sessions: [...retainedManual, ...mergedIcu],
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

  const handleUpdateLog = (logId, patch) => {
    const existing = (state.logsByDate[selectedDate] || []).find((l) => l.id === logId);
    if (!existing) return;
    const updatedTitle = patch.title || existing.title || 'item';
    setState((prev) => {
      const dayLogs = prev.logsByDate[selectedDate] || [];
      const nextLogs = dayLogs.map((l) => (l.id === logId ? { ...l, ...patch } : l));
      return {
        ...prev,
        logsByDate: {
          ...prev.logsByDate,
          [selectedDate]: nextLogs,
        },
      };
    });
    showToast(`Updated ${updatedTitle}`);
  };

  const handleSplitStapleLog = (logId, overrideTargetKcal = null) => {
    const dayLogs = state.logsByDate[selectedDate] || [];
    const target = dayLogs.find((l) => l.id === logId);
    if (!target || target.type !== 'staple') return;

    const template = state.staples.find((s) => s.id === target.stapleId || s.name === target.title);
    const rawItems =
      Array.isArray(target.resolvedItems) && target.resolvedItems.length > 0
        ? target.resolvedItems
        : template?.ingredients || [];
    if (rawItems.length === 0) {
      showToast('No individual ingredients available to split for this meal.');
      return;
    }

    // Preserve any portion multiplier the user may have applied before splitting
    const rawKcal = rawItems.reduce((sum, ing) => {
      const f = (Number(ing.grams) || 0) / 100;
      const p = ing.per100g || {};
      return sum + ((p.carbs || 0) * 4 + (p.protein || 0) * 4 + (p.fat || 0) * 9) * f;
    }, 0);
    const effectiveTargetKcal =
      overrideTargetKcal != null &&
      Number.isFinite(Number(overrideTargetKcal)) &&
      Number(overrideTargetKcal) > 0
        ? Number(overrideTargetKcal)
        : target.kcal;
    const ratio = rawKcal > 10 && effectiveTargetKcal > 0 ? effectiveTargetKcal / rawKcal : 1;
    const nowTime = new Date().toTimeString().slice(0, 5);
    const ts = Date.now();

    const unpackedEntries = rawItems.map((ing, idx) => {
      const grams = Math.max(1, Math.round((Number(ing.grams) || 50) * ratio));
      const f = grams / 100;
      const p = ing.per100g || {};
      const carbs = Math.round((p.carbs || 0) * f);
      const protein = Math.round((p.protein || 0) * f);
      const fat = Math.round((p.fat || 0) * f);
      const kcal = carbs * 4 + protein * 4 + fat * 9;
      const clonedIngredient = {
        ...ing,
        id: `ing-split-${ts}-${idx}`,
        grams,
        per100g: { ...p },
      };
      return {
        id: `log-food-${ts}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        slot: target.slot,
        type: 'food',
        title: ing.name,
        detail: formatFoodAmount(grams, units),
        ingredient: clonedIngredient,
        carbs,
        protein,
        fat,
        kcal,
        uncertaintyPct: 0,
        micros: {
          fiber: Number(((p.fiber || 0) * f).toFixed(1)),
          iron: Number(((p.iron || 0) * f).toFixed(1)),
          vitC: Math.round((p.vitC || 0) * f),
          calcium: Math.round((p.calcium || 0) * f),
          vitD: Number(((p.vitD || 0) * f).toFixed(1)),
          magnesium: Math.round((p.magnesium || 0) * f),
          sodium: Math.round((p.sodium || 0) * f),
        },
        loggedAt: target.loggedAt || nowTime,
      };
    });

    setState((prev) => {
      const current = prev.logsByDate[selectedDate] || [];
      const nextLogs = [];
      for (const item of current) {
        if (item.id === logId) {
          nextLogs.push(...unpackedEntries);
        } else {
          nextLogs.push(item);
        }
      }
      return {
        ...prev,
        logsByDate: {
          ...prev.logsByDate,
          [selectedDate]: nextLogs,
        },
      };
    });
    showToast(`Split "${target.title}" into ${unpackedEntries.length} editable foods.`);
  };

  const handleCopyYesterdayMeal = (slotId, slotLabel = 'meal') => {
    const prevDate = shiftIsoDate(selectedDate, -1);
    const sourceItems = (state.logsByDate[prevDate] || []).filter(
      (l) => isCopyableMealLog(l) && l.slot === slotId
    );
    if (sourceItems.length === 0) return;

    const ts = Date.now();
    const nowTime = new Date().toTimeString().slice(0, 5);
    const cloned = sourceItems.map((item, idx) => ({
      ...item,
      id: `log-copy-${ts}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      ingredient: item.ingredient ? { ...item.ingredient, per100g: { ...(item.ingredient.per100g || {}) } } : undefined,
      resolvedItems: Array.isArray(item.resolvedItems)
        ? item.resolvedItems.map((ri) => ({ ...ri, per100g: { ...(ri.per100g || {}) } }))
        : undefined,
      micros: { ...(item.micros || {}) },
      loggedAt: nowTime,
    }));

    setState((prev) => ({
      ...prev,
      logsByDate: {
        ...prev.logsByDate,
        [selectedDate]: [...(prev.logsByDate[selectedDate] || []), ...cloned],
      },
    }));
    showToast(`Copied ${slotLabel} from yesterday (${cloned.length} item${cloned.length > 1 ? 's' : ''}).`);
  };

  const handleCopyYesterdayDay = () => {
    const prevDate = shiftIsoDate(selectedDate, -1);
    const sourceItems = (state.logsByDate[prevDate] || []).filter(isCopyableMealLog);
    if (sourceItems.length === 0) return;

    const validMealSlotIds = new Set(dailyPlan.meals.filter((m) => !m.isWorkout).map((m) => m.slot));
    const fallbackSlot = dailyPlan.meals.find((m) => !m.isWorkout)?.slot || 'breakfast';
    const ts = Date.now();
    const nowTime = new Date().toTimeString().slice(0, 5);

    const cloned = sourceItems.map((item, idx) => ({
      ...item,
      id: `log-copy-${ts}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      slot: validMealSlotIds.has(item.slot) ? item.slot : fallbackSlot,
      ingredient: item.ingredient ? { ...item.ingredient, per100g: { ...(item.ingredient.per100g || {}) } } : undefined,
      resolvedItems: Array.isArray(item.resolvedItems)
        ? item.resolvedItems.map((ri) => ({ ...ri, per100g: { ...(ri.per100g || {}) } }))
        : undefined,
      micros: { ...(item.micros || {}) },
      loggedAt: nowTime,
    }));

    setState((prev) => ({
      ...prev,
      logsByDate: {
        ...prev.logsByDate,
        [selectedDate]: [...(prev.logsByDate[selectedDate] || []), ...cloned],
      },
    }));
    showToast(`Copied ${cloned.length} meal item${cloned.length > 1 ? 's' : ''} from yesterday (workouts skipped).`);
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
    slotId = 'on_bike',
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
      slot: slotId || 'on_bike',
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
      resolvedItems: scaled.resolvedItems,
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

  const handleSetRideBottleSize = (date, bottleSizeMl, asDefault = true, sessionId = null) => {
    setState((prev) => ({
      ...prev,
      profile: asDefault ? { ...prev.profile, defaultBottleMl: bottleSizeMl } : prev.profile,
      sessions: prev.sessions.map((s) => {
        const matches = sessionId ? s.id === sessionId : s.date === date;
        return matches ? { ...s, bottleSizeMl: asDefault ? undefined : bottleSizeMl } : s;
      }),
    }));
    if (asDefault) {
      showToast(`Saved ${bottleSizeMl} ml as your default bottle size.`);
    }
  };

  const handleUpdateSessionFuelSettings = (date, sessionId, patch) => {
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        const matches = sessionId ? s.id === sessionId : s.date === date;
        return matches ? { ...s, ...patch } : s;
      }),
    }));
  };

  const handleReorderTimeline = (date, newOrder) => {
    const idx = newOrder.indexOf('on_bike');
    const ratio = idx >= 0 ? idx / Math.max(newOrder.length - 1, 1) : -1;
    const inferredTiming =
      ratio >= 0 ? (ratio <= 0.3 ? 'morning' : ratio <= 0.6 ? 'midday' : 'evening') : undefined;
    const hasCustomSlots = newOrder.some((id) => id.startsWith('custom-') || id.startsWith('workout-'));
    setState((prev) => ({
      ...prev,
      profile: hasCustomSlots ? prev.profile : { ...prev.profile, defaultTimelineOrder: newOrder },
      timelineOrderByDate: {
        ...(prev.timelineOrderByDate || {}),
        [date]: newOrder,
      },
      sessions: prev.sessions.map((s) =>
        s.date === date
          ? { ...s, timelineOrder: newOrder, ...(inferredTiming ? { timing: inferredTiming } : {}) }
          : s
      ),
    }));
  };

  const handleDeleteMealSlot = (date, slotId, slotLabel) => {
    const currentMeals = state.customMealsByDate?.[date] || DEFAULT_MEAL_SLOTS;
    if (currentMeals.length <= 1) {
      showToast('Keep at least one meal slot for the day.');
      return;
    }
    const remainingMeals = currentMeals.filter((m) => m.id !== slotId);
    const currentOrder = dailyPlan.meals.map((m) => m.slot);
    const nextOrder = currentOrder.filter((id) => id !== slotId);

    setState((prev) => ({
      ...prev,
      customMealsByDate: {
        ...(prev.customMealsByDate || {}),
        [date]: remainingMeals,
      },
      timelineOrderByDate: {
        ...(prev.timelineOrderByDate || {}),
        [date]: nextOrder,
      },
      logsByDate: {
        ...prev.logsByDate,
        [date]: (prev.logsByDate[date] || []).filter((l) => l.slot !== slotId),
      },
    }));
    showToast(
      `Removed ${slotLabel || 'meal'} — macros redistributed across your ${remainingMeals.length} remaining meal${
        remainingMeals.length > 1 ? 's' : ''
      }.`
    );
  };

  const handleAddMealSlot = (date, { label, size = 'snack', insertIndex }) => {
    const cleanLabel = String(label || '').trim();
    if (!cleanLabel) return;
    const newId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const newMeal = {
      id: newId,
      label: cleanLabel,
      kind: 'custom',
      size: size === 'meal' ? 'meal' : 'snack',
      location: 'Custom',
    };
    const currentMeals = state.customMealsByDate?.[date] || DEFAULT_MEAL_SLOTS;
    const nextMeals = [...currentMeals, newMeal];
    const currentOrder = dailyPlan.meals.map((m) => m.slot);
    const clampedIdx = Math.min(Math.max(0, Number(insertIndex ?? currentOrder.length)), currentOrder.length);
    const nextOrder = [...currentOrder];
    nextOrder.splice(clampedIdx, 0, newId);

    setState((prev) => ({
      ...prev,
      customMealsByDate: {
        ...(prev.customMealsByDate || {}),
        [date]: nextMeals,
      },
      timelineOrderByDate: {
        ...(prev.timelineOrderByDate || {}),
        [date]: nextOrder,
      },
    }));
    showToast(`Added "${cleanLabel}" — daily macros rebalanced across ${nextMeals.length} meals.`);
  };

  const handleResetDayMeals = (date) => {
    setState((prev) => {
      const nextCustom = { ...(prev.customMealsByDate || {}) };
      const nextOrders = { ...(prev.timelineOrderByDate || {}) };
      delete nextCustom[date];
      delete nextOrders[date];
      return {
        ...prev,
        customMealsByDate: nextCustom,
        timelineOrderByDate: nextOrders,
      };
    });
    showToast('Restored default Breakfast, Lunch, Snack & Dinner for this day.');
  };

  const handleCompleteRide = (date, actualKj, durationMin, sessionId = null, actualKcal = 0) => {
    setState((prev) => {
      const targetId = sessionId || prev.sessions.find((s) => s.date === date)?.id;
      const exists = Boolean(targetId && prev.sessions.some((s) => s.id === targetId));
      const updated = exists
        ? prev.sessions.map((s) =>
            s.id === targetId
              ? {
                  ...s,
                  status: 'completed',
                  actualKj: actualKj || 0,
                  actualKcal: actualKcal || s.actualKcal || 0,
                  durationMin,
                }
              : s
          )
        : [
            ...prev.sessions,
            {
              id: `manual-${date}-${Date.now()}`,
              date,
              title: 'Completed Workout',
              sport: actualKj > 0 ? 'Ride' : 'Workout',
              status: 'completed',
              durationMin,
              intensity: actualKj >= 1300 ? 'threshold' : 'endurance',
              plannedKj: actualKj || 0,
              actualKj: actualKj || 0,
              plannedKcal: actualKcal || 0,
              actualKcal: actualKcal || 0,
              timing: 'evening',
              source: 'manual',
            },
          ];
      return { ...prev, sessions: updated };
    });
    showToast(
      actualKj > 0
        ? `Updated ride to ${actualKj} kJ — remaining meal targets recalculated.`
        : `Updated workout (${actualKcal || durationMin} ${actualKcal > 0 ? 'kcal' : 'min'}) — daily targets recalculated.`
    );
  };

  const handleSaveSession = (sessionObj) => {
    setState((prev) => {
      // If switching to Rest Day explicitly for a single-session edit, clear active sessions on that date only if editing
      if (sessionObj.intensity === 'rest' || sessionObj.sport === 'Rest') {
        const filtered = prev.sessions.filter((s) => s.id !== sessionObj.id);
        return { ...prev, sessions: filtered };
      }
      const exists = prev.sessions.some((s) => s.id === sessionObj.id);
      const nextSessions = exists
        ? prev.sessions.map((s) => (s.id === sessionObj.id ? { ...s, ...sessionObj } : s))
        : [...prev.sessions, sessionObj];
      return { ...prev, sessions: nextSessions };
    });
    showToast(`Saved ${sessionObj.title} for ${sessionObj.date}`);
  };

  const handleDeleteSession = (sessionId, title = 'Workout') => {
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => s.id !== sessionId),
    }));
    showToast(`Removed ${title} — daily fuel targets recalculated.`);
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

  const handleSaveSupplement = (supp, { isEdit = false } = {}) => {
    setState((prev) => {
      const exists = prev.supplements.some((s) => s.id === supp.id);
      const nextSupps = exists
        ? prev.supplements.map((s) => (s.id === supp.id ? supp : s))
        : [supp, ...prev.supplements];
      // Also update today's logged entry if this saved supplement was already logged today
      const todayLogs = prev.logsByDate[selectedDate] || [];
      const hasLogged = todayLogs.some((l) => l.type === 'supplement' && l.supplementId === supp.id);
      const nextLogsByDate = hasLogged
        ? {
            ...prev.logsByDate,
            [selectedDate]: todayLogs.map((l) =>
              l.type === 'supplement' && l.supplementId === supp.id
                ? {
                    ...l,
                    title: supp.name,
                    micros: {
                      fiber: 0,
                      iron: Number(supp.micros?.iron || 0),
                      vitC: Number(supp.micros?.vitC || 0),
                      calcium: Number(supp.micros?.calcium || 0),
                      vitD: Number(supp.micros?.vitD || 0),
                      magnesium: Number(supp.micros?.magnesium || 0),
                      sodium: Number(supp.micros?.sodium || 0),
                    },
                  }
                : l
            ),
          }
        : prev.logsByDate;
      return {
        ...prev,
        supplements: nextSupps,
        logsByDate: nextLogsByDate,
      };
    });
    if (isEdit) {
      showToast(`Updated "${supp.name}"!`);
    }
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
      profile: { ...state.profile, usdaApiKey: '' },
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
      customMealsByDate: parsed.customMealsByDate || prev.customMealsByDate,
      timelineOrderByDate: parsed.timelineOrderByDate || prev.timelineOrderByDate,
    }));
  };

  const loggedSupplementIds = useMemo(
    () => new Set(selectedLogs.filter((l) => l.type === 'supplement').map((l) => l.supplementId)),
    [selectedLogs]
  );

  const hasAnyConnectedSync = Boolean(
    state.intervalsConfig.apiKey?.trim() || state.withingsConfig.accessToken || state.withingsConfig.refreshToken
  );

  const isDayCustomized = Boolean(state.customMealsByDate?.[selectedDate]);
  const usdaApiKey = state.profile.usdaApiKey || '';

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
            usdaApiKey={usdaApiKey}
            sessions={selectedSessions}
            logs={selectedLogs}
            yesterdayMealLogs={yesterdayMealLogs}
            staples={state.staples}
            supplements={state.supplements}
            biometricsSummary={biometricsSummary}
            hasIntervalsConnected={Boolean(state.intervalsConfig.apiKey?.trim())}
            bgSyncing={bgSyncing}
            isDayCustomized={isDayCustomized}
            onResyncNow={() => runBackgroundSync(true)}
            onOpenStapleModal={(slotInfo, remaining) => setStapleModal({ open: true, slotInfo, remaining })}
            onOpenQuickFoodModal={(slotInfo) => setQuickFoodModal({ open: true, slotInfo })}
            onOpenWorkModal={(slotInfo) => setWorkModal({ open: true, slotInfo })}
            onOpenSupplementsModal={() => setSupplementsModalOpen(true)}
            onQuickLogStaple={handleQuickLogStaple}
            onSaveSlotAsStaple={handleSaveSlotAsStaple}
            onLogDailyStack={handleLogDailyStack}
            onSetRideBottleSize={handleSetRideBottleSize}
            onUpdateSessionFuelSettings={handleUpdateSessionFuelSettings}
            onReorderTimeline={handleReorderTimeline}
            onDeleteMealSlot={handleDeleteMealSlot}
            onAddMealSlot={handleAddMealSlot}
            onResetDayMeals={handleResetDayMeals}
            onDeleteLog={handleDeleteLog}
            onUpdateLog={handleUpdateLog}
            onSplitStapleLog={handleSplitStapleLog}
            onCopyYesterdayMeal={handleCopyYesterdayMeal}
            onCopyYesterdayDay={handleCopyYesterdayDay}
            onLogOnBike={handleLogOnBike}
            onSaveOnBikeLog={handleSaveOnBikeLog}
            onCompleteRide={handleCompleteRide}
            onSaveSession={handleSaveSession}
            onDeleteSession={handleDeleteSession}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'staples' && (
          <StaplesView
            staples={state.staples}
            units={units}
            usdaApiKey={usdaApiKey}
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
            onDeleteSession={handleDeleteSession}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'body' && (
          <BodyView
            profile={state.profile}
            units={units}
            biometricsSummary={biometricsSummary}
            weeklyCheckIn={weeklyCheckIn}
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
        usdaApiKey={usdaApiKey}
        recentFoods={recentFoods}
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
        usdaApiKey={usdaApiKey}
        onSaveSupplement={handleSaveSupplement}
        onDeleteSupplement={handleDeleteSupplement}
        onToggleDailyStack={handleToggleDailyStack}
        onLogSupplement={handleLogSupplement}
      />
    </div>
  );
}
