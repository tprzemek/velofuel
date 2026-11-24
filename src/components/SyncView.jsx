import { useRef, useState } from 'react';
import {
  RefreshCw,
  UploadCloud,
  Sparkles,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  User,
  Ruler,
  Scale,
  ExternalLink,
  Copy,
  Cloud,
  CloudDownload,
  History,
  ShieldCheck,
  Wand2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { BOTTLE_SIZE_OPTIONS, sumDailyLogs } from '../engine/fuelingEngine';
import { pushWellnessDirect, syncIntervalsDirect } from '../engine/intervalsClient';
import { buildWithingsAuthUrl, fetchWithingsMeasurements } from '../engine/withingsClient';
import { GITHUB_CLASSIC_PAT_URL, listLocalSnapshots } from '../engine/storageEngine';
import { formatLiquid, getUnits, UNIT_PRESETS } from '../engine/units';
import NumericInput from './NumericInput';

export default function SyncView({
  profile,
  onUpdateProfile,
  intervalsConfig,
  onUpdateIntervalsConfig,
  onApplyIntervalsSync,
  withingsConfig,
  onUpdateWithingsConfig,
  onImportBiometrics,
  aiConfig,
  onUpdateAiConfig,
  todayDate,
  todayLogs,
  onExportBackup,
  onImportBackup,
  cloudConfig,
  cloudStatus,
  cloudError,
  persistentGranted,
  storageWarning,
  isDemoMode,
  onUpdateCloudConfig,
  onManualCloudSync,
  onManualCloudRestore,
  onDisconnectCloud,
  onRestoreSnapshot,
  onOpenSetupWizard,
  onReturnToWelcome,
  showToast,
}) {
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [syncReport, setSyncReport] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [withingsSyncing, setWithingsSyncing] = useState(false);
  const [withingsError, setWithingsError] = useState('');
  const [withingsReport, setWithingsReport] = useState(null);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const backupRef = useRef(null);

  const units = getUnits(profile);
  const redirectUri = `${window.location.origin}${window.location.pathname}`;
  const isStandalonePwa =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true);

  const loadSnapshotsList = async () => {
    setSnapshotsLoading(true);
    try {
      const list = await listLocalSnapshots();
      setSnapshots(list);
    } finally {
      setSnapshotsLoading(false);
    }
  };

  const handleToggleSnapshots = () => {
    const nextOpen = !snapshotsOpen;
    setSnapshotsOpen(nextOpen);
    if (nextOpen) {
      loadSnapshotsList();
    }
  };

  const updateUnits = (patch) => {
    onUpdateProfile({ units: { ...units, ...patch } });
  };

  const applyPreset = (presetKey) => {
    onUpdateProfile({ units: { ...UNIT_PRESETS[presetKey] } });
    showToast(`Switched units to ${presetKey === 'metric' ? 'All Metric' : presetKey === 'imperial' ? 'All Imperial' : 'Mixed (L/ml + lbs/oz)'}`);
  };

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
    const hasLocalNodeApi = window.location.port === '3001' || window.location.port === '5173';
    try {
      let data = null;
      if (hasLocalNodeApi) {
        try {
          const resp = await fetch('./api/intervals/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const ct = resp.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const parsed = await resp.json();
            if (!resp.ok || !parsed.ok) throw new Error(parsed.error || 'Intervals.icu sync failed');
            data = parsed;
          }
        } catch (backendErr) {
          if (backendErr.message && backendErr.message.includes('rejected')) throw backendErr;
        }
      }
      if (!data) {
        data = await syncIntervalsDirect(payload);
      }
      onApplyIntervalsSync(data);
      setSyncReport(data.diagnostics);
      showToast(
        data.diagnostics?.pulledFtp
          ? `Synced Intervals.icu (FTP ${data.diagnostics.pulledFtp}W + ${data.diagnostics.completedCount} rides)`
          : 'Synced your rides & wellness from Intervals.icu!'
      );
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
    const hasLocalNodeApi = window.location.port === '3001' || window.location.port === '5173';
    try {
      let pushed = false;
      if (hasLocalNodeApi) {
        try {
          const resp = await fetch('./api/intervals/wellness-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const ct = resp.headers.get('content-type') || '';
          if (resp.ok && ct.includes('application/json')) pushed = true;
        } catch {
          // fall through to direct browser push
        }
      }
      if (!pushed) {
        await pushWellnessDirect(payload);
      }
      showToast(`Pushed ${totals.kcal} kcal & ${totals.carbs}g carbs to Intervals.icu (${todayDate})`);
    } catch (err) {
      showToast(`Push error: ${err.message}`);
    } finally {
      setPushing(false);
    }
  };

  const handleConnectWithings = () => {
    if (!withingsConfig.clientId?.trim() || !withingsConfig.clientSecret?.trim()) {
      setWithingsError('Enter both your Withings Client ID and Client Secret first.');
      return;
    }
    setWithingsError('');
    const authUrl = buildWithingsAuthUrl({
      clientId: withingsConfig.clientId,
      redirectUri,
    });
    window.location.href = authUrl;
  };

  const handleSyncWithingsNow = async () => {
    setWithingsSyncing(true);
    setWithingsError('');
    try {
      const res = await fetchWithingsMeasurements(withingsConfig, 30);
      if (res.updatedTokens) {
        onUpdateWithingsConfig(res.updatedTokens);
      }
      onUpdateWithingsConfig({ lastSyncedAt: new Date().toISOString() });
      if (res.biometrics.length > 0) {
        onImportBiometrics(res.biometrics);
      }
      setWithingsReport({
        count: res.biometrics.length,
        hasFat: res.biometrics.some((b) => b.bodyFatPct != null),
        hasMuscle: res.biometrics.some((b) => b.muscleMassKg != null),
        hasWater: res.biometrics.some((b) => b.hydrationKg != null),
      });
      showToast(`Synced ${res.biometrics.length} Withings scale days directly!`);
    } catch (err) {
      setWithingsError(err.message);
    } finally {
      setWithingsSyncing(false);
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

  const isWithingsConnected = Boolean(withingsConfig?.accessToken || withingsConfig?.refreshToken);
  const hasCloudToken = Boolean(cloudConfig?.githubToken?.trim());
  const statusBadgeText =
    cloudStatus === 'synced'
      ? 'Cloud Synced ✓'
      : cloudStatus === 'syncing'
      ? 'Syncing…'
      : cloudStatus === 'error'
      ? 'Sync Error'
      : 'Saved locally';
  const statusBadgeClass =
    cloudStatus === 'synced'
      ? 'high'
      : cloudStatus === 'error'
      ? 'low'
      : 'med';

  return (
    <>
      {/* Cloud Sync & Durable Storage (3-Tier Sustaining Storage) */}
      <section className="card" aria-label="Cloud Sync and Durable Storage">
        <div className="section-header">
          <h1 className="section-title" style={{ fontSize: '1.08rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Cloud size={16} color="var(--code-high)" /> Cloud Sync &amp; Durable Storage
          </h1>
          <span className={`carb-badge ${statusBadgeClass}`} style={{ fontSize: '0.66rem' }}>
            {statusBadgeText}
          </span>
        </div>

        <div className="notice-strip green" style={{ marginTop: 8, marginBottom: 10 }}>
          <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: '0.76rem' }}>
            <strong>On-Device Durable Mirror Active</strong> (LocalStorage + IndexedDB + rolling 14-day snapshots
            {persistentGranted ? ' · Persistent storage granted' : ''}).
            {isDemoMode && (
              <div style={{ marginTop: 3 }}>
                Currently exploring <strong>Demo Mode</strong> — run the Setup Wizard below whenever you are ready for your real profile.
              </div>
            )}
          </div>
        </div>

        {storageWarning && (
          <div className="notice-strip" style={{ marginBottom: 10 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{storageWarning}</span>
          </div>
        )}

        <p className="muted-text" style={{ marginBottom: 10 }}>
          Sync automatically across your phone, laptop, and Home Screen app using a free private <strong>GitHub Gist</strong> in your own GitHub account. Your GitHub token stays strictly on this device and is never uploaded.
        </p>

        <div className="notice-strip slate" style={{ marginBottom: 10, flexDirection: 'column', gap: 5, fontSize: '0.74rem' }}>
          <div>
            <strong>1-click setup:</strong>{' '}
            <a
              href={GITHUB_CLASSIC_PAT_URL}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--code-high)', fontWeight: 700 }}
            >
              Create private gist-only GitHub token <ExternalLink size={11} style={{ verticalAlign: '-1px' }} />
            </a>{' '}
            (only <code>gist</code> scope — zero repo access), then paste below.
          </div>
          <div>
            {isStandalonePwa ? (
              <>
                <strong>Home Screen App Active ✓</strong> — Exempt from Safari&apos;s 7-day browser cleanup. Keep Cloud Sync linked so your logs follow you anywhere.
              </>
            ) : (
              <>
                <strong>iPhone / Safari Tip:</strong> Regular Safari tabs and Home Screen apps store data in separate containers. Add VeloFuel to your Home Screen AND link Cloud Sync so your logs are always safe and synced.
              </>
            )}
          </div>
        </div>

        <div className="field-grid">
          <div className="field full">
            <label htmlFor="cloud-gh-token">GitHub Personal Access Token (Device-only)</label>
            <input
              id="cloud-gh-token"
              type="password"
              className="input mono"
              placeholder="ghp_... or github_pat_..."
              value={cloudConfig?.githubToken || ''}
              onChange={(e) => onUpdateCloudConfig({ githubToken: e.target.value })}
            />
          </div>
          <div className="field full">
            <label htmlFor="cloud-gist-id">Backup Gist ID (Optional — auto-found if blank)</label>
            <input
              id="cloud-gist-id"
              className="input mono"
              placeholder="Auto-finds or creates private VeloFuel Cloud Sync Backup"
              value={cloudConfig?.gistId || ''}
              onChange={(e) => onUpdateCloudConfig({ gistId: e.target.value })}
            />
          </div>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginTop: 10,
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer',
            lineHeight: 1.35,
          }}
        >
          <input
            type="checkbox"
            checked={Boolean(cloudConfig?.syncThirdPartyKeys)}
            onChange={(e) => onUpdateCloudConfig({ syncThirdPartyKeys: e.target.checked })}
            style={{ marginTop: 2 }}
          />
          <span>
            Also sync Intervals.icu, Withings &amp; food API keys inside my private backup (leave unchecked to keep keys on this device only)
          </span>
        </label>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-accent"
            style={{ flex: 1, minWidth: 120 }}
            disabled={cloudStatus === 'syncing'}
            onClick={onManualCloudSync}
          >
            <RefreshCw size={14} className={cloudStatus === 'syncing' ? 'spin' : ''} />{' '}
            {cloudStatus === 'syncing' ? 'Syncing…' : 'Sync Now'}
          </button>
          <button
            type="button"
            className="btn"
            style={{ flex: 1, minWidth: 135 }}
            disabled={cloudStatus === 'syncing'}
            onClick={onManualCloudRestore}
          >
            <CloudDownload size={14} /> Restore from Cloud
          </button>
          {hasCloudToken && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={onDisconnectCloud}
            >
              Disconnect
            </button>
          )}
        </div>

        {cloudConfig?.lastSyncedAt && (
          <p className="muted-text" style={{ marginTop: 8, fontSize: '0.72rem' }}>
            Last cloud sync: {new Date(cloudConfig.lastSyncedAt).toLocaleString()}
          </p>
        )}

        {cloudError && (
          <div className="notice-strip" style={{ marginTop: 10 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{cloudError}</span>
          </div>
        )}

        {/* Collapsible Rolling 14-Day Local Snapshots Drawer */}
        <div className="snapshot-drawer-wrap">
          <button
            type="button"
            className="btn btn-sm btn-block"
            style={{ justifyContent: 'space-between' }}
            aria-expanded={snapshotsOpen}
            onClick={handleToggleSnapshots}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <History size={14} /> View Local Snapshots (Last 14 Days)
            </span>
            {snapshotsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {snapshotsOpen && (
            <div className="snapshot-list" role="region" aria-label="Local Daily Snapshots">
              {snapshotsLoading ? (
                <p className="muted-text" style={{ fontSize: '0.76rem', margin: 0 }}>
                  Loading local snapshots…
                </p>
              ) : snapshots.length === 0 ? (
                <p className="muted-text" style={{ fontSize: '0.76rem', margin: 0 }}>
                  No local daily snapshots saved yet. Snapshots appear automatically as you log meals or weigh-ins.
                </p>
              ) : (
                snapshots.map((snap) => (
                  <div key={snap.date} className="snapshot-row">
                    <div>
                      <div className="snapshot-date mono">{snap.date}</div>
                      <div className="muted-text" style={{ fontSize: '0.71rem' }}>
                        {snap.summary?.loggedMeals || 0} logged items · {snap.summary?.weighIns || 0} weigh-ins ·{' '}
                        {snap.summary?.workouts || 0} workouts
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      aria-label={`Restore snapshot ${snap.date}`}
                      onClick={async () => {
                        await onRestoreSnapshot(snap);
                        loadSnapshotsList();
                      }}
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* Units & Defaults (Metric / Imperial / Mixed) */}
      <section className="card">
        <div className="section-header">
          <h2 className="section-title" style={{ fontSize: '1.08rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ruler size={16} /> Units &amp; Bottle Defaults
          </h2>
        </div>
        <p className="muted-text" style={{ marginBottom: 10 }}>
          Choose Metric, Imperial, or mix them freely (e.g. liters/ml for bottles and oz/lbs for food &amp; weight).
        </p>

        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button type="button" className="chip" onClick={() => applyPreset('metric')}>
            All Metric (kg · g · ml)
          </button>
          <button type="button" className="chip" onClick={() => applyPreset('imperial')}>
            All Imperial (lbs · oz · fl oz)
          </button>
          <button type="button" className="chip" onClick={() => applyPreset('mixed')}>
            Mixed (lbs · oz · ml/L)
          </button>
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="unit-weight">Body Weight</label>
            <select
              id="unit-weight"
              className="select"
              value={units.weight}
              onChange={(e) => updateUnits({ weight: e.target.value })}
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lbs">Pounds (lbs)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="unit-food">Food Portions</label>
            <select
              id="unit-food"
              className="select"
              value={units.food}
              onChange={(e) => updateUnits({ food: e.target.value })}
            >
              <option value="g">Grams (g)</option>
              <option value="oz">Ounces (oz)</option>
              <option value="lbs">Pounds (lbs)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="unit-liquid">Bottles &amp; Liquids</label>
            <select
              id="unit-liquid"
              className="select"
              value={units.liquid}
              onChange={(e) => updateUnits({ liquid: e.target.value })}
            >
              <option value="ml">Milliliters / Liters (ml / L)</option>
              <option value="floz">Fluid Ounces (fl oz)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="unit-bottle">Default Ride Bottle</label>
            <select
              id="unit-bottle"
              className="select"
              value={profile.defaultBottleMl || 650}
              onChange={(e) => onUpdateProfile({ defaultBottleMl: Number(e.target.value) })}
            >
              {BOTTLE_SIZE_OPTIONS.map((ml) => (
                <option key={ml} value={ml}>
                  {formatLiquid(ml, units)}
                </option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="unit-tab-mg">Electrolyte Tablet Sodium (mg per tab)</label>
            <NumericInput
              id="unit-tab-mg"
              min={100}
              max={1500}
              fallback={500}
              className="input mono"
              value={profile.electrolyteTabMg ?? 500}
              onChange={(val) => onUpdateProfile({ electrolyteTabMg: val })}
            />
          </div>
        </div>
      </section>

      {/* Intervals.icu Auto-Sync (FTP + Completed & Planned Rides) */}
      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="section-title" style={{ fontSize: '1.02rem' }}>Intervals.icu Auto-Sync</h2>
            <p className="muted-text" style={{ marginTop: 3 }}>
              Automatically pulls your <strong>FTP, height, age, completed power rides, and upcoming workouts</strong>{' '}
              whenever you open VeloFuel.
            </p>
          </div>
        </div>

        <div className="field-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="icu-id">Athlete ID (or &quot;0&quot;)</label>
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

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 10,
            fontSize: '0.79rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={intervalsConfig.autoSync !== false}
            onChange={(e) => onUpdateIntervalsConfig({ autoSync: e.target.checked })}
          />
          Auto-sync completed workouts &amp; FTP on app open
        </label>

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
              Pulled {syncReport.pulledFtp ? <><strong>FTP {syncReport.pulledFtp}W</strong>, </> : null}
              <strong>{syncReport.wellnessCount}</strong> wellness days,{' '}
              <strong>{syncReport.completedCount}</strong> completed rides, and{' '}
              <strong>{syncReport.plannedCount}</strong> planned workouts.
              {syncReport.stravaRestrictedCount > 0 && (
                <div style={{ marginTop: 4 }}>
                  Note: {syncReport.stravaRestrictedCount} Strava-only rides were hidden by Strava API rules. Connect Garmin/Wahoo directly to Intervals.icu or tap Complete on Today.
                </div>
              )}
            </div>
          </div>
        )}

        <p className="muted-text" style={{ marginTop: 10, fontSize: '0.73rem' }}>
          Find your key at <strong>intervals.icu → Settings → Developer Settings</strong>. Keys stay stored locally on your device.
        </p>
      </section>

      {/* Direct Withings Smart Scale Sync */}
      <section className="card">
        <div className="section-header">
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Scale size={15} color="var(--code-high)" /> Direct Withings Smart Scale Sync
          </h2>
          {isWithingsConnected && (
            <span className="carb-badge high" style={{ fontSize: '0.62rem' }}>Connected</span>
          )}
        </div>
        <p className="muted-text" style={{ marginBottom: 10 }}>
          Intervals.icu via Google Health often drops Body Fat %, Muscle Mass, Body Water, and Bone Mass. Connect Withings directly to pull <strong>every morning scale metric automatically</strong>.
        </p>

        <div className="notice-strip slate" style={{ marginBottom: 10, flexDirection: 'column', gap: 6, fontSize: '0.74rem' }}>
          <div>
            <strong>One-time setup (2 min, free):</strong>
          </div>
          <div>
            1. Open{' '}
            <a
              href="https://developer.withings.com/dashboard/"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--code-high)', fontWeight: 700 }}
            >
              developer.withings.com <ExternalLink size={11} style={{ verticalAlign: '-1px' }} />
            </a>{' '}
            → Create App (Public API, Personal use).
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>2. Set Callback URL to:</span>
            <code style={{ background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 6, fontSize: '0.7rem' }}>
              {redirectUri}
            </code>
            <button
              type="button"
              className="btn btn-sm"
              style={{ padding: '3px 7px', fontSize: '0.68rem' }}
              onClick={() => {
                navigator.clipboard?.writeText(redirectUri);
                showToast('Copied Withings Callback URL!');
              }}
            >
              <Copy size={11} /> Copy
            </button>
          </div>
          <div>3. Paste your Client ID &amp; Secret below and tap <strong>Connect Withings Scale</strong>.</div>
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="withings-cid">Withings Client ID</label>
            <input
              id="withings-cid"
              className="input mono"
              placeholder="Paste Client ID"
              value={withingsConfig?.clientId || ''}
              onChange={(e) => onUpdateWithingsConfig({ clientId: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="withings-sec">Client Secret</label>
            <input
              id="withings-sec"
              type="password"
              className="input mono"
              placeholder="Paste Client Secret"
              value={withingsConfig?.clientSecret || ''}
              onChange={(e) => onUpdateWithingsConfig({ clientSecret: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {isWithingsConnected ? (
            <>
              <button
                type="button"
                className="btn btn-accent"
                style={{ flex: 1 }}
                disabled={withingsSyncing}
                onClick={handleSyncWithingsNow}
              >
                <RefreshCw size={14} /> {withingsSyncing ? 'Syncing Scale…' : 'Sync Withings Now'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onUpdateWithingsConfig({ accessToken: '', refreshToken: '', expiresAt: 0 });
                  showToast('Disconnected Withings scale.');
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={handleConnectWithings}
            >
              <Scale size={14} /> Connect Withings Scale
            </button>
          )}
        </div>

        {withingsError && (
          <div className="notice-strip" style={{ marginTop: 10 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{withingsError}</span>
          </div>
        )}

        {withingsReport && (
          <div className="notice-strip green" style={{ marginTop: 10 }}>
            <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              Pulled <strong>{withingsReport.count}</strong> days directly from Withings (
              {[
                'Weight',
                withingsReport.hasFat && 'Body Fat %',
                withingsReport.hasMuscle && 'Muscle Mass',
                withingsReport.hasWater && 'Body Water',
              ]
                .filter(Boolean)
                .join(' · ')}
              ).
            </div>
          </div>
        )}
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

      {/* Food Database (USDA FoodData Central — same USDA backbone as Cronometer) */}
      <section className="card">
        <div className="section-header">
          <h2 className="section-title">Food Search Database (USDA + Brands)</h2>
          <span className="section-kicker">Works out of the box</span>
        </div>
        <p className="muted-text" style={{ marginBottom: 10 }}>
          VeloFuel searches <strong>USDA FoodData Central</strong> (400,000+ whole &amp; branded grocery foods) +{' '}
          <strong>Open Food Facts</strong> directly with zero setup. If you search heavily, paste a free personal USDA key from{' '}
          <a
            href="https://fdc.nal.usda.gov/api-key-signup"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--code-high)', fontWeight: 700 }}
          >
            fdc.nal.usda.gov <ExternalLink size={11} style={{ verticalAlign: '-1px' }} />
          </a>{' '}
          for 1,000 searches/hour.
        </p>
        <div className="field">
          <label htmlFor="usda-api-key">USDA FoodData Central API Key (Optional)</label>
          <input
            id="usda-api-key"
            type="password"
            className="input mono"
            placeholder="Optional — uses built-in demo key by default"
            value={profile.usdaApiKey || ''}
            onChange={(e) => onUpdateProfile({ usdaApiKey: e.target.value })}
          />
        </div>
      </section>

      {/* Athlete Profile */}
      <section className="card">
        <div className="section-header">
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={15} /> Athlete Profile &amp; Physiology
          </h2>
          <span className="section-kicker">Auto-filled by Intervals.icu</span>
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="prof-ftp">FTP (Watts)</label>
            <NumericInput
              id="prof-ftp"
              min={80}
              max={600}
              fallback={250}
              className="input mono"
              value={profile.ftp}
              onChange={(val) => onUpdateProfile({ ftp: val })}
            />
          </div>
          <div className="field">
            <label htmlFor="prof-height">Height (cm)</label>
            <NumericInput
              id="prof-height"
              min={130}
              max={230}
              fallback={175}
              className="input mono"
              value={profile.heightCm}
              onChange={(val) => onUpdateProfile({ heightCm: val })}
            />
          </div>
          <div className="field">
            <label htmlFor="prof-age">Age</label>
            <NumericInput
              id="prof-age"
              min={14}
              max={95}
              fallback={30}
              className="input mono"
              value={profile.age}
              onChange={(val) => onUpdateProfile({ age: val })}
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
            <NumericInput
              id="prof-prot"
              step={0.1}
              min={1.4}
              max={2.5}
              fallback={2.0}
              className="input mono"
              value={profile.proteinGPerKgCut}
              onChange={(val) => onUpdateProfile({ proteinGPerKgCut: val })}
            />
          </div>
          <div className="field">
            <label htmlFor="prof-ge">Riding Efficiency (%)</label>
            <NumericInput
              id="prof-ge"
              step={0.5}
              min={18}
              max={25}
              fallback={22}
              className="input mono"
              value={profile.grossEfficiencyPct ?? 22}
              onChange={(val) => onUpdateProfile({ grossEfficiencyPct: val })}
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
          <h2 className="section-title">Backup &amp; Phone Install</h2>
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

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={onOpenSetupWizard}
          >
            <Wand2 size={14} /> Run Setup Wizard / Reset to Clean Real Profile
          </button>
          {onReturnToWelcome && (
            <button
              type="button"
              className="btn btn-block"
              onClick={onReturnToWelcome}
            >
              Back to Start Screen (Switch Profile / Restore Cloud)
            </button>
          )}
          <p className="muted-text" style={{ marginTop: 0, fontSize: '0.72rem' }}>
            Pre-fills your current real settings and strips all sample rides &amp; fake weigh-ins cleanly.
          </p>
        </div>
      </section>
    </>
  );
}
