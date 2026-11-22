import { useEffect, useMemo, useState } from 'react';
import {
  Flame,
  UtensilsCrossed,
  Calendar,
  Scale,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  DEFAULT_PROFILE,
  DEFAULT_STAPLES,
  createDefaultBiometrics,
  createDefaultLogs,
  createDefaultSessions,
  getIsoDate,
  migrateStaple,
} from './engine/defaultData';
import { computeBiometricsSummary } from './engine/biometricsEngine';
import { computeDailyPlan } from './engine/fuelingEngine';
import TodayView from './components/TodayView';
import StaplesView from './components/StaplesView';
import TrainingView from './components/TrainingView';
import BodyView from './components/BodyView';
import SyncView from './components/SyncView';
import StapleScalerModal from './components/StapleScalerModal';
import WorkMealModal from './components/WorkMealModal';
import QuickFoodModal from './components/QuickFoodModal';

const STORAGE_KEY = 'velofuel_state_v1';

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
        profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
        staples: migratedStaples.length ? migratedStaples : DEFAULT_STAPLES,
        sessions: Array.isArray(parsed.sessions) && parsed.sessions.length ? parsed.sessions : createDefaultSessions(),
        biometrics: Array.isArray(parsed.biometrics) && parsed.biometrics.length ? parsed.biometrics : createDefaultBiometrics(),
        logsByDate: parsed.logsByDate || createDefaultLogs(),
        intervalsConfig: { athleteId: '0', apiKey: '', ...(parsed.intervalsConfig || {}) },
        aiConfig: { provider: 'auto', apiKey: '', ...(parsed.aiConfig || {}) },
      };
    }
  } catch {
    // ignore corrupted storage
  }
  return {
    profile: DEFAULT_PROFILE,
    staples: DEFAULT_STAPLES,
    sessions: createDefaultSessions(),
    biometrics: createDefaultBiometrics(),
    logsByDate: createDefaultLogs(),
    intervalsConfig: { athleteId: '0', apiKey: '' },
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

  // Modals
  const [stapleModal, setStapleModal] = useState({ open: false, slotInfo: null, remaining: null });
  const [quickFoodModal, setQuickFoodModal] = useState({ open: false, slotInfo: null });
  const [workModal, setWorkModal] = useState({ open: false, slotInfo: null });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(window.__vfToastTimer);
    window.__vfToastTimer = window.setTimeout(() => setToast(''), 3200);
  };

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

  const selectedLogs = state.logsByDate[selectedDate] || [];

  const handleLogEntry = (entry) => {
    setState((prev) => ({
      ...prev,
      logsByDate: {
        ...prev.logsByDate,
        [selectedDate]: [...(prev.logsByDate[selectedDate] || []), entry],
      },
    }));
    showToast(`Logged ${entry.title} (${entry.carbs}g C · ${entry.protein}g P)`);
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
      detail: `${onBikePlan.bottles} bottles · ${onBikePlan.totalSodiumMg}mg sodium`,
      carbs: onBikePlan.totalCarbs,
      protein: 0,
      fat: 0,
      kcal: onBikePlan.totalKcal,
      uncertaintyPct: 0,
      micros: { fiber: 0, iron: 0, calcium: 20, vitD: 0, magnesium: 30, sodium: onBikePlan.totalSodiumMg },
      loggedAt: new Date().toTimeString().slice(0, 5),
    });
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
      const next = exists
        ? prev.staples.map((s) => (s.id === staple.id ? staple : s))
        : [staple, ...prev.staples];
      return { ...prev, staples: next };
    });
    showToast(`Saved "${staple.name}" to your Home Staples.`);
  };

  const handleDeleteStaple = (id) => {
    setState((prev) => ({ ...prev, staples: prev.staples.filter((s) => s.id !== id) }));
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

  const handleImportBiometrics = (entries) => {
    setState((prev) => {
      const map = new Map(prev.biometrics.map((b) => [b.date, b]));
      entries.forEach((e) => {
        const cur = map.get(e.date) || {};
        map.set(e.date, {
          ...cur,
          ...e,
          bodyFatPct: e.bodyFatPct ?? cur.bodyFatPct ?? null,
          restingHr: e.restingHr ?? cur.restingHr ?? null,
          hrv: e.hrv ?? cur.hrv ?? null,
        });
      });
      return { ...prev, biometrics: Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)) };
    });
  };

  const handleApplyIntervalsSync = (syncData) => {
    if (syncData.biometrics?.length) {
      handleImportBiometrics(syncData.biometrics);
    }
    setState((prev) => {
      const sessMap = new Map(prev.sessions.map((s) => [s.date, s]));
      (syncData.plannedSessions || []).forEach((s) => {
        const existing = sessMap.get(s.date);
        if (!existing || existing.status !== 'completed') {
          sessMap.set(s.date, s);
        }
      });
      (syncData.completedSessions || []).forEach((s) => {
        sessMap.set(s.date, s);
      });
      return { ...prev, sessions: Array.from(sessMap.values()) };
    });
  };

  const handleExportBackup = () => {
    const safeCopy = {
      ...state,
      intervalsConfig: { ...state.intervalsConfig, apiKey: '' },
      aiConfig: { ...state.aiConfig, apiKey: '' },
    };
    const blob = new Blob([JSON.stringify(safeCopy, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velofuel-backup-${getIsoDate(0)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported VeloFuel backup (API keys excluded for safety).');
  };

  const handleImportBackup = (parsed) => {
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...(parsed.profile || {}) },
      staples:
        Array.isArray(parsed.staples) && parsed.staples.length
          ? parsed.staples.map(migrateStaple).filter(Boolean)
          : prev.staples,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : prev.sessions,
      biometrics: Array.isArray(parsed.biometrics) ? parsed.biometrics : prev.biometrics,
      logsByDate: parsed.logsByDate || prev.logsByDate,
    }));
  };

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
            session={selectedSession}
            logs={selectedLogs}
            biometricsSummary={biometricsSummary}
            onOpenStapleModal={(slotInfo, remaining) => setStapleModal({ open: true, slotInfo, remaining })}
            onOpenQuickFoodModal={(slotInfo) => setQuickFoodModal({ open: true, slotInfo })}
            onOpenWorkModal={(slotInfo) => setWorkModal({ open: true, slotInfo })}
            onDeleteLog={handleDeleteLog}
            onLogOnBike={handleLogOnBike}
            onCompleteRide={handleCompleteRide}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'staples' && (
          <StaplesView
            staples={state.staples}
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
        onLogEntry={handleLogEntry}
      />

      <QuickFoodModal
        isOpen={quickFoodModal.open}
        onClose={() => setQuickFoodModal({ open: false, slotInfo: null })}
        slotInfo={quickFoodModal.slotInfo}
        onLogEntry={handleLogEntry}
      />

      <WorkMealModal
        isOpen={workModal.open}
        onClose={() => setWorkModal({ open: false, slotInfo: null })}
        slotInfo={workModal.slotInfo}
        aiConfig={state.aiConfig}
        onLogEntry={handleLogEntry}
      />
    </div>
  );
}
