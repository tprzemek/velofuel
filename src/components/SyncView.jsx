import { useRef, useState } from 'react';
import { RefreshCw, UploadCloud, Sparkles, Download, Upload, CheckCircle2, AlertCircle, User } from 'lucide-react';
import { sumDailyLogs } from '../engine/fuelingEngine';
import { pushWellnessDirect, syncIntervalsDirect } from '../engine/intervalsClient';

export default function SyncView({
  profile,
  onUpdateProfile,
  intervalsConfig,
  onUpdateIntervalsConfig,
  onApplyIntervalsSync,
  aiConfig,
  onUpdateAiConfig,
  todayDate,
  todayLogs,
  onExportBackup,
  onImportBackup,
  showToast,
}) {
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [syncReport, setSyncReport] = useState(null);
  const [syncError, setSyncError] = useState('');
  const backupRef = useRef(null);

  const handleSyncIntervals = async () => {
    if (!intervalsConfig.apiKey?.trim()) {
      setSyncError('Paste your Intervals.icu personal API Key first (from intervals.icu/settings → Developer Settings).');
      return;
    }
    setSyncing(true);
    setSyncError('');
    const payload = {
      athleteId: intervalsConfig.athleteId || '0',
      apiKey: intervalsConfig.apiKey.trim(),
      daysBack: 28,
      daysForward: 7,
    };
    try {
      let data;
      try {
        const resp = await fetch('./api/intervals/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error('no-backend');
        data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || 'Intervals.icu sync failed');
      } catch (backendErr) {
        if (backendErr.message && backendErr.message.includes('rejected')) throw backendErr;
        // Direct browser-to-Intervals.icu sync (works on GitHub Pages / static HTTPS!)
        data = await syncIntervalsDirect(payload);
      }
      onApplyIntervalsSync(data);
      setSyncReport(data.diagnostics);
      showToast('Synced your Withings scale & rides from Intervals.icu!');
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handlePushCalories = async () => {
    if (!intervalsConfig.apiKey?.trim()) {
      showToast('Enter your Intervals.icu API key first.');
      return;
    }
    const totals = sumDailyLogs(todayLogs);
    const payload = {
      athleteId: intervalsConfig.athleteId || '0',
      apiKey: intervalsConfig.apiKey.trim(),
      date: todayDate,
      kcalConsumed: totals.kcal,
      carbs: totals.carbs,
      protein: totals.protein,
      fat: totals.fat,
    };
    setPushing(true);
    try {
      try {
        const resp = await fetch('./api/intervals/wellness-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error('no-backend');
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || 'Push failed');
      } catch {
        await pushWellnessDirect(payload);
      }
      showToast(`Pushed ${totals.kcal} kcal & ${totals.carbs}g carbs to Intervals.icu (${todayDate})`);
    } catch (err) {
      showToast(`Push error: ${err.message}`);
    } finally {
      setPushing(false);
    }
  };

  const handleRestoreFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        onImportBackup(parsed);
        showToast('Restored VeloFuel backup successfully.');
      } catch {
        showToast('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      {/* Intervals.icu Hub Sync (Withings + Workouts) */}
      <section className="card">
        <div className="section-header">
          <div>
            <h1 className="section-title" style={{ fontSize: '1.08rem' }}>Intervals.icu Hub Sync</h1>
            <p className="muted-text" style={{ marginTop: 3 }}>
              Pulls your <strong>Withings morning scale</strong> (via Google Health → Intervals.icu), completed power rides, and next 7 days of planned workouts in one tap.
            </p>
          </div>
        </div>

        <div className="field-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="icu-id">Athlete ID (or "0")</label>
            <input
              id="icu-id"
              className="input mono"
              placeholder="0 or i12345"
              value={intervalsConfig.athleteId}
              onChange={(e) => onUpdateIntervalsConfig({ athleteId: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="icu-key">Personal API Key</label>
            <input
              id="icu-key"
              type="password"
              className="input mono"
              placeholder="From Developer Settings"
              value={intervalsConfig.apiKey}
              onChange={(e) => onUpdateIntervalsConfig({ apiKey: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-accent"
            style={{ flex: 1 }}
            disabled={syncing}
            onClick={handleSyncIntervals}
          >
            <RefreshCw size={15} /> {syncing ? 'Syncing…' : 'Sync Intervals.icu Now'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={pushing}
            onClick={handlePushCalories}
            title="Push today's logged calories & macros back to Intervals.icu wellness"
          >
            <UploadCloud size={15} /> Push Log
          </button>
        </div>

        {syncError && (
          <div className="notice-strip" style={{ marginTop: 10 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{syncError}</span>
          </div>
        )}

        {syncReport && (
          <div className="notice-strip green" style={{ marginTop: 10 }}>
            <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              Pulled <strong>{syncReport.wellnessCount}</strong> Withings/wellness days,{' '}
              <strong>{syncReport.completedCount}</strong> completed rides, and{' '}
              <strong>{syncReport.plannedCount}</strong> planned workouts.
              {!syncReport.hasBodyFat && (
                <div style={{ marginTop: 4 }}>
                  Note: Body fat % was not present in Intervals.icu wellness — upload a Withings CSV on the Body tab if you want Lean Mass % tracked too.
                </div>
              )}
              {syncReport.stravaRestrictedCount > 0 && (
                <div style={{ marginTop: 4 }}>
                  Note: {syncReport.stravaRestrictedCount} Strava-only rides were hidden by Strava API rules. Connect Garmin/Wahoo directly to Intervals.icu or tap Complete on Today to enter kJ.
                </div>
              )}
            </div>
          </div>
        )}

        <p className="muted-text" style={{ marginTop: 10, fontSize: '0.73rem' }}>
          Where to find your key: open <strong>intervals.icu → Settings → Developer Settings</strong> and copy your API key. Keys stay stored locally in your browser.
        </p>
      </section>

      {/* AI Vision / Text Estimator Configuration */}
      <section className="card">
        <div className="section-header">
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={15} color="var(--code-high)" /> Work-Meal AI Estimator
          </h2>
        </div>
        <p className="muted-text" style={{ marginBottom: 10 }}>
          Text estimation works immediately with VeloFuel’s built-in USDA/NCCDB parser (zero API key needed). Add a Gemini or OpenAI key below to unlock full <strong>phone camera plate photo</strong> Vision AI.
        </p>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="ai-provider">Provider</label>
            <select
              id="ai-provider"
              className="select"
              value={aiConfig.provider}
              onChange={(e) => onUpdateAiConfig({ provider: e.target.value })}
            >
              <option value="auto">Auto (Built-in USDA / Server Key)</option>
              <option value="gemini">Google Gemini 2.5 Flash (Vision)</option>
              <option value="openai">OpenAI GPT-4o-mini (Vision)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ai-key">API Key (Optional)</label>
            <input
              id="ai-key"
              type="password"
              className="input mono"
              placeholder="Optional for photo AI"
              value={aiConfig.apiKey}
              onChange={(e) => onUpdateAiConfig({ apiKey: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Athlete Profile */}
      <section className="card">
        <div className="section-header">
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={15} /> Athlete Profile & Physiology
          </h2>
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="prof-ftp">FTP (Watts)</label>
            <input
              id="prof-ftp"
              type="number"
              className="input mono"
              value={profile.ftp}
              onChange={(e) => onUpdateProfile({ ftp: Number(e.target.value) || 250 })}
            />
          </div>
          <div className="field">
            <label htmlFor="prof-height">Height (cm)</label>
            <input
              id="prof-height"
              type="number"
              className="input mono"
              value={profile.heightCm}
              onChange={(e) => onUpdateProfile({ heightCm: Number(e.target.value) || 175 })}
            />
          </div>
          <div className="field">
            <label htmlFor="prof-age">Age</label>
            <input
              id="prof-age"
              type="number"
              className="input mono"
              value={profile.age}
              onChange={(e) => onUpdateProfile({ age: Number(e.target.value) || 30 })}
            />
          </div>
          <div className="field">
            <label htmlFor="prof-sex">Sex</label>
            <select
              id="prof-sex"
              className="select"
              value={profile.sex}
              onChange={(e) => onUpdateProfile({ sex: e.target.value })}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="prof-act">Off-Bike Day Job</label>
            <select
              id="prof-act"
              className="select"
              value={profile.activityLevel}
              onChange={(e) => onUpdateProfile({ activityLevel: e.target.value })}
            >
              <option value="desk">Desk / Office (1.25× non-ride hrs)</option>
              <option value="light">Lightly Active (1.35× non-ride hrs)</option>
              <option value="active">On Feet All Day (1.45× non-ride hrs)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="prof-prot">Cut Protein (g/kg)</label>
            <input
              id="prof-prot"
              type="number"
              step="0.1"
              min="1.6"
              max="2.4"
              className="input mono"
              value={profile.proteinGPerKgCut}
              onChange={(e) => onUpdateProfile({ proteinGPerKgCut: Number(e.target.value) || 2.0 })}
            />
          </div>
          <div className="field">
            <label htmlFor="prof-ge">Riding Efficiency (%)</label>
            <input
              id="prof-ge"
              type="number"
              step="0.5"
              min="18"
              max="25"
              className="input mono"
              value={profile.grossEfficiencyPct ?? 22}
              onChange={(e) => onUpdateProfile({ grossEfficiencyPct: Number(e.target.value) || 22 })}
            />
          </div>
          <div className="field">
            <label htmlFor="prof-lead">Pre-Ride Meal Timing</label>
            <select
              id="prof-lead"
              className="select"
              value={profile.preRideLeadHours ?? 2}
              onChange={(e) => onUpdateProfile({ preRideLeadHours: Number(e.target.value) })}
            >
              <option value={1}>~1 hr before (~1 g/kg carbs)</option>
              <option value={2}>~2 hrs before (~2 g/kg carbs)</option>
              <option value={3}>3+ hrs before (~3 g/kg carbs)</option>
            </select>
          </div>
        </div>
        <p className="muted-text" style={{ marginTop: 8, fontSize: '0.72rem' }}>
          Riding Efficiency sets how many calories your body burns per kJ on your power meter (22% is typical for most riders; 24% is 1:1).
        </p>
      </section>

      {/* Phone PWA Backup / Restore */}
      <section className="card">
        <div className="section-header">
          <h2 className="section-title">Backup & Phone Install</h2>
        </div>
        <p className="muted-text" style={{ marginBottom: 10 }}>
          Install to your phone home screen via Safari <strong>Share → Add to Home Screen</strong> or Chrome{' '}
          <strong>Install App</strong>. Export a JSON snapshot anytime to move devices.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" style={{ flex: 1 }} onClick={onExportBackup}>
            <Download size={14} /> Export JSON
          </button>
          <input ref={backupRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleRestoreFile} />
          <button type="button" className="btn" style={{ flex: 1 }} onClick={() => backupRef.current?.click()}>
            <Upload size={14} /> Restore JSON
          </button>
        </div>
      </section>
    </>
  );
}
