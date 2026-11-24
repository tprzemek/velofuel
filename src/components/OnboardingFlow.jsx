import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Check,
  CheckCircle2,
  Cloud,
  CloudDownload,
  Droplets,
  ExternalLink,
  Pill,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Upload,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  DEFAULT_PROFILE,
  ONBOARDING_SUPPLEMENTS,
  getIsoDate,
  isSampleBiometric,
} from '../engine/defaultData';
import {
  BOTTLE_SIZE_OPTIONS,
  MEAL_TEMPLATE_PRESETS,
  SWEAT_RATE_OPTIONS,
  buildTimelineOrderForProfile,
  computeDailyPlan,
  getDefaultMealSlotsForProfile,
} from '../engine/fuelingEngine';
import { computeBiometricsSummary, parseWithingsCsv } from '../engine/biometricsEngine';
import { syncIntervalsDirect } from '../engine/intervalsClient';
import {
  GITHUB_CLASSIC_PAT_URL,
  createCleanUserEnvelope,
  loadCloudConfig,
  pullCloudGist,
  reconcileCloudSync,
  saveCloudConfig,
} from '../engine/storageEngine';
import {
  UNIT_PRESETS,
  cmToInches,
  displayToKg,
  formatLiquid,
  formatWeightRate,
  getUnits,
  inchesToCm,
  kgToDisplay,
} from '../engine/units';
import NumericInput from './NumericInput';

const STEP_TITLES = [
  'Units & Bottles',
  'You & Your Goal',
  'Training & Scale',
  'Routine & Supplements',
  'Cloud Backup',
];

function detectPresetKey(units) {
  if (units.weight === 'kg' && units.food === 'g' && units.liquid === 'ml') return 'metric';
  if (units.weight === 'lbs' && units.food === 'oz' && units.liquid === 'floz') return 'imperial';
  if (units.weight === 'lbs' && units.food === 'oz' && units.liquid === 'ml') return 'mixed';
  return 'custom';
}

export default function OnboardingFlow({
  initialMode = 'welcome', // 'welcome' | 'wizard'
  canCancel = false,
  existingState = null,
  persistentGranted = false,
  onCancel,
  onEnterDemoMode,
  onRestoreFromCloud,
  onCompleteOnboarding,
}) {
  const existingProfile = existingState?.profile || DEFAULT_PROFILE;
  const existingUnits = getUnits(existingProfile);
  const existingCloud = useMemo(() => loadCloudConfig(), []);
  const latestRealWeight = useMemo(() => {
    const real = (existingState?.biometrics || [])
      .filter((b) => b && !isSampleBiometric(b) && typeof b.weightKg === 'number')
      .sort((a, b) => a.date.localeCompare(b.date));
    return real.length > 0 ? real[real.length - 1] : null;
  }, [existingState]);

  const [mode, setMode] = useState(initialMode); // 'welcome' | 'restore' | 'wizard'
  const [step, setStep] = useState(1);

  // Cloud Restore (Welcome Path #2)
  const [restoreToken, setRestoreToken] = useState(existingCloud.githubToken || '');
  const [restoreGistId, setRestoreGistId] = useState(existingCloud.gistId || '');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  // Step 1: Units & Bottles
  const [units, setUnits] = useState(existingUnits);
  const [defaultBottleMl, setDefaultBottleMl] = useState(existingProfile.defaultBottleMl || 650);
  const [electrolyteTabMg, setElectrolyteTabMg] = useState(existingProfile.electrolyteTabMg ?? 500);

  // Step 2: You & Your Goal
  const [name, setName] = useState(
    existingProfile.name && existingProfile.name !== 'Rider' ? existingProfile.name : ''
  );
  const [sex, setSex] = useState(existingProfile.sex || 'male');
  const [age, setAge] = useState(existingProfile.age || 34);
  const [heightCm, setHeightCm] = useState(existingProfile.heightCm || 179);
  const [weightKg, setWeightKg] = useState(
    latestRealWeight?.weightKg || existingProfile.defaultWeightKg || 74.2
  );
  const [bodyFatPct, setBodyFatPct] = useState(
    latestRealWeight?.bodyFatPct ?? existingProfile.defaultBodyFatPct ?? 15
  );
  const [ftp, setFtp] = useState(existingProfile.ftp || 250);
  const [activityLevel, setActivityLevel] = useState(existingProfile.activityLevel || 'desk');
  const [goalMode, setGoalMode] = useState(existingProfile.goalMode || 'cut');
  const [targetLossKgPerWeek, setTargetLossKgPerWeek] = useState(
    existingProfile.targetLossKgPerWeek || 0.35
  );

  // Step 3: Training & Scale
  const [icuAthleteId, setIcuAthleteId] = useState(existingState?.intervalsConfig?.athleteId || '0');
  const [icuApiKey, setIcuApiKey] = useState(existingState?.intervalsConfig?.apiKey || '');
  const [icuTesting, setIcuTesting] = useState(false);
  const [icuError, setIcuError] = useState('');
  const [icuResult, setIcuResult] = useState(null);

  const [logMorningWeightNow, setLogMorningWeightNow] = useState(true);
  const [scaleWeightKg, setScaleWeightKg] = useState(
    latestRealWeight?.weightKg || existingProfile.defaultWeightKg || 74.2
  );
  const [scaleBodyFatPct, setScaleBodyFatPct] = useState(
    latestRealWeight?.bodyFatPct ?? existingProfile.defaultBodyFatPct ?? ''
  );
  const [csvEntries, setCsvEntries] = useState([]);
  const [csvNotice, setCsvNotice] = useState('');
  const csvInputRef = useRef(null);

  // Step 4: Routine & Supplements
  const [mealTemplate, setMealTemplate] = useState(existingProfile.defaultMealTemplate || 'standard_4');
  const [workoutTiming, setWorkoutTiming] = useState(existingProfile.defaultWorkoutTiming || 'evening');
  const [sweatRate, setSweatRate] = useState(existingProfile.defaultSweatRate || 'medium');
  const [selectedSuppIds, setSelectedSuppIds] = useState(() => {
    if (canCancel && Array.isArray(existingState?.supplements)) {
      const activeNames = new Set(
        existingState.supplements.filter((s) => s.inDailyStack).map((s) => s.name.toLowerCase())
      );
      const matched = ONBOARDING_SUPPLEMENTS.filter((s) =>
        activeNames.has(s.name.toLowerCase())
      ).map((s) => s.id);
      return matched.length > 0 ? matched : ['supp-iron-vitc', 'supp-multi'];
    }
    return ['supp-iron-vitc', 'supp-multi'];
  });

  // Step 5: Cloud Backup
  const [ghToken, setGhToken] = useState(existingCloud.githubToken || '');
  const [syncThirdPartyKeys, setSyncThirdPartyKeys] = useState(
    Boolean(existingCloud.syncThirdPartyKeys)
  );
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [cloudConnected, setCloudConnected] = useState(
    Boolean(existingCloud.githubToken && existingCloud.lastSyncedAt)
  );
  const [cloudGistId, setCloudGistId] = useState(existingCloud.gistId || '');
  const [cloudEtag, setCloudEtag] = useState(existingCloud.etag || '');
  const [cloudLastSyncedAt, setCloudLastSyncedAt] = useState(existingCloud.lastSyncedAt || '');
  const [existingCloudOffer, setExistingCloudOffer] = useState(null);

  const presetKey = detectPresetKey(units);
  const todayIso = getIsoDate(0);

  // Live Step 2 preview calculations using real fuelingEngine (zero duplicated math!)
  const draftProfile = useMemo(
    () => ({
      ...DEFAULT_PROFILE,
      ...(existingState?.profile || {}),
      name: name.trim() || 'Rider',
      sex,
      age: Number(age) || 34,
      heightCm: Number(heightCm) || 179,
      ftp: Number(ftp) || 250,
      activityLevel,
      goalMode,
      targetLossKgPerWeek: Number(targetLossKgPerWeek) || 0.35,
      defaultWeightKg: Number(weightKg) || 74,
      defaultBodyFatPct: Number(bodyFatPct) || 15,
      units,
      defaultBottleMl: Number(defaultBottleMl) || 650,
      electrolyteTabMg: Number(electrolyteTabMg) || 500,
      defaultSweatRate: sweatRate,
      defaultMealTemplate: mealTemplate,
      defaultWorkoutTiming: workoutTiming,
      defaultTimelineOrder: buildTimelineOrderForProfile(
        getDefaultMealSlotsForProfile({ defaultMealTemplate: mealTemplate }),
        workoutTiming
      ),
    }),
    [
      existingState?.profile,
      name,
      sex,
      age,
      heightCm,
      ftp,
      activityLevel,
      goalMode,
      targetLossKgPerWeek,
      weightKg,
      bodyFatPct,
      units,
      defaultBottleMl,
      electrolyteTabMg,
      sweatRate,
      mealTemplate,
      workoutTiming,
    ]
  );

  const livePreview = useMemo(() => {
    const bio = computeBiometricsSummary([], draftProfile);
    const restPlan = computeDailyPlan({
      date: todayIso,
      profile: draftProfile,
      biometricsSummary: bio,
      todaySessions: [],
      tomorrowSessions: [],
      yesterdaySessions: [],
    });
    const hardSession = {
      id: 'preview-hard-90',
      date: todayIso,
      title: '90m Threshold Ride',
      sport: 'Ride',
      status: 'planned',
      durationMin: 90,
      intensity: 'threshold',
      plannedKj: 0,
      actualKj: 0,
      timing: workoutTiming,
      source: 'preview',
    };
    const hardPlan = computeDailyPlan({
      date: todayIso,
      profile: draftProfile,
      biometricsSummary: bio,
      todaySessions: [hardSession],
      tomorrowSessions: [],
      yesterdaySessions: [],
    });
    return { restPlan, hardPlan };
  }, [draftProfile, todayIso, workoutTiming]);

  const pacePctBw = useMemo(() => {
    const w = Math.max(40, Number(weightKg) || 74);
    return Number(((Number(targetLossKgPerWeek || 0.35) / w) * 100).toFixed(2));
  }, [weightKg, targetLossKgPerWeek]);

  const paceZoneLabel =
    targetLossKgPerWeek <= 0.22
      ? 'Gentle · Easiest for high training volume'
      : targetLossKgPerWeek <= 0.45
      ? 'Recommended Safe Zone · Protects power & muscle'
      : 'Faster Pace · Best for lighter training weeks';

  const handleSelectUnitPreset = (key) => {
    setUnits({ ...UNIT_PRESETS[key] });
  };

  const handleSyncWeightChange = (val) => {
    const kg = displayToKg(val, units);
    setWeightKg(kg);
    setScaleWeightKg(kg);
  };

  const handleSyncBodyFatChange = (val) => {
    setBodyFatPct(val);
    setScaleBodyFatPct(val);
  };

  const handleTestIntervals = async () => {
    if (!icuApiKey.trim()) {
      setIcuError('Paste your Intervals.icu API key first (intervals.icu → Settings → Developer Settings).');
      return;
    }
    setIcuTesting(true);
    setIcuError('');
    setIcuResult(null);
    try {
      const data = await syncIntervalsDirect({
        athleteId: icuAthleteId || '0',
        apiKey: icuApiKey.trim(),
        daysBack: 28,
        daysForward: 7,
      });
      setIcuResult(data);
      // Auto-fill Step 2 physiology immediately
      if (data.profilePatch) {
        if (data.profilePatch.name && !name.trim()) setName(data.profilePatch.name);
        if (data.profilePatch.ftp) setFtp(data.profilePatch.ftp);
        if (data.profilePatch.heightCm) setHeightCm(data.profilePatch.heightCm);
        if (data.profilePatch.age) setAge(data.profilePatch.age);
        if (data.profilePatch.sex) setSex(data.profilePatch.sex);
      }
      const latestWellness = [...(data.biometrics || [])]
        .reverse()
        .find((b) => typeof b.weightKg === 'number');
      if (latestWellness) {
        setWeightKg(latestWellness.weightKg);
        setScaleWeightKg(latestWellness.weightKg);
        if (typeof latestWellness.bodyFatPct === 'number') {
          setBodyFatPct(latestWellness.bodyFatPct);
          setScaleBodyFatPct(latestWellness.bodyFatPct);
        }
      }
    } catch (err) {
      setIcuResult(null);
      setIcuError(err.message || 'Could not reach Intervals.icu right now.');
    } finally {
      setIcuTesting(false);
    }
  };

  const handleWithingsCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseWithingsCsv(String(reader.result || ''));
      if (parsed.length === 0) {
        setCsvNotice('Could not find weight rows in that CSV. Export weight.csv from Withings web.');
      } else {
        setCsvEntries(parsed);
        const last = parsed[parsed.length - 1];
        if (last?.weightKg) {
          setWeightKg(last.weightKg);
          setScaleWeightKg(last.weightKg);
        }
        if (typeof last?.bodyFatPct === 'number') {
          setBodyFatPct(last.bodyFatPct);
          setScaleBodyFatPct(last.bodyFatPct);
        }
        setCsvNotice(`Loaded ${parsed.length} real weigh-ins from Withings CSV!`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleSupp = (id) => {
    setSelectedSuppIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const buildWizardResult = ({ skipCloud = false } = {}) => {
    // Combine real biometrics: Intervals wellness + Withings CSV + Step 3 manual weigh-in (ZERO withings-sample!)
    const bioMap = new Map();
    if (canCancel && Array.isArray(existingState?.biometrics)) {
      existingState.biometrics
        .filter((b) => b && !isSampleBiometric(b))
        .forEach((b) => bioMap.set(b.date, b));
    }
    (icuResult?.biometrics || []).forEach((b) => {
      bioMap.set(b.date, { ...(bioMap.get(b.date) || {}), ...b });
    });
    csvEntries.forEach((b) => {
      bioMap.set(b.date, { ...(bioMap.get(b.date) || {}), ...b });
    });
    if (logMorningWeightNow && Number(scaleWeightKg) > 25) {
      const cur = bioMap.get(todayIso) || {};
      bioMap.set(todayIso, {
        ...cur,
        date: todayIso,
        weightKg: Number(Number(scaleWeightKg).toFixed(2)),
        bodyFatPct:
          scaleBodyFatPct !== '' && Number(scaleBodyFatPct) > 3 && Number(scaleBodyFatPct) < 60
            ? Number(Number(scaleBodyFatPct).toFixed(1))
            : cur.bodyFatPct ?? null,
        source: cur.source || 'manual',
      });
    }
    const realBiometrics = Array.from(bioMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Real sessions: Intervals synced sessions + any non-sample existing sessions (ZERO sess-*!)
    const icuSessions = [
      ...(icuResult?.completedSessions || []),
      ...(icuResult?.plannedSessions || []),
    ];

    // Daily supplements matching Step 4 checkboxes
    const chosenSupplements = ONBOARDING_SUPPLEMENTS.map((s) => ({
      ...s,
      inDailyStack: selectedSuppIds.includes(s.id),
    }));
    // Preserve any custom supplements from existing real user
    if (canCancel && Array.isArray(existingState?.supplements)) {
      const knownIds = new Set(chosenSupplements.map((s) => s.id));
      existingState.supplements.forEach((s) => {
        if (!knownIds.has(s.id)) chosenSupplements.push(s);
      });
    }

    const validIcuKey = icuError ? '' : icuApiKey.trim();

    return {
      profile: draftProfile,
      intervalsConfig: {
        athleteId: icuAthleteId.trim() || '0',
        apiKey: validIcuKey,
        autoSync: Boolean(validIcuKey),
      },
      intervalsSyncData: icuResult,
      sessions: icuSessions,
      biometrics: realBiometrics,
      supplements: chosenSupplements,
      cloudConnection:
        !skipCloud && cloudConnected && !existingCloudOffer && ghToken.trim()
          ? {
              githubToken: ghToken.trim(),
              gistId: cloudGistId,
              etag: cloudEtag,
              lastSyncedAt: cloudLastSyncedAt || loadCloudConfig().lastSyncedAt || '',
              syncThirdPartyKeys,
            }
          : null,
    };
  };

  const handleConnectAndBackupStep5 = async () => {
    if (!ghToken.trim()) {
      setCloudError('Paste your GitHub Personal Access Token first.');
      return;
    }
    setCloudBusy(true);
    setCloudError('');
    setCloudConnected(false);
    setExistingCloudOffer(null);

    try {
      const wizardData = buildWizardResult({ skipCloud: true });
      const isFreshRealSetup =
        !canCancel || Boolean(existingState?.isDemoMode) || !existingState?.hasUserData;
      const candidateEnvelope = createCleanUserEnvelope({
        profile: wizardData.profile,
        sessions: wizardData.sessions,
        biometrics: wizardData.biometrics,
        supplements: wizardData.supplements,
        intervalsConfig: wizardData.intervalsConfig,
        logsByDate: canCancel ? existingState?.logsByDate || {} : {},
        staples: canCancel ? existingState?.staples : undefined,
        revision: isFreshRealSetup ? 1 : Math.max(1, Number(existingState?.revision || 0) + 1),
      });

      const tempConfig = {
        ...loadCloudConfig(),
        githubToken: ghToken.trim(),
        gistId: cloudGistId || '',
        syncThirdPartyKeys,
        autoSync: true,
      };

      // Check remote first (Never-Clobber-Cloud Guard!)
      // Do NOT save cloud config eagerly when an existing backup is found — persist ONLY if user clicks Restore!
      const pullCheck = await pullCloudGist(tempConfig.githubToken, tempConfig.gistId);
      if (
        pullCheck.status === 'ok' &&
        pullCheck.envelope?.hasUserData &&
        !pullCheck.envelope?.isDemoMode &&
        isFreshRealSetup &&
        !cloudGistId.trim()
      ) {
        setExistingCloudOffer({
          envelope: pullCheck.envelope,
          gistId: pullCheck.gistId,
          etag: pullCheck.etag,
          updatedAt: pullCheck.updatedAt,
          githubToken: tempConfig.githubToken,
          syncThirdPartyKeys,
        });
        setCloudConnected(false);
        return;
      }

      const res = await reconcileCloudSync({
        localEnvelope: candidateEnvelope,
        cloudConfig: tempConfig,
        allowCreate: true,
        preferRemoteOnEmpty: true,
        forcePushIfLocalHasData: !isFreshRealSetup,
      });

      if (res.action === 'pulled' && res.remoteEnvelope) {
        setExistingCloudOffer({
          envelope: res.remoteEnvelope,
          gistId: res.gistId,
          etag: res.etag,
          updatedAt: res.updatedAt,
          githubToken: tempConfig.githubToken,
          syncThirdPartyKeys,
        });
        setCloudConnected(false);
        return;
      }

      const syncedAt = res.updatedAt || new Date().toISOString();
      saveCloudConfig({
        githubToken: tempConfig.githubToken,
        gistId: res.gistId || cloudGistId,
        syncThirdPartyKeys,
        autoSync: true,
        etag: res.etag || '',
        lastSyncedAt: syncedAt,
        lastSyncedRevision: candidateEnvelope.revision,
        lastError: '',
      });
      setCloudGistId(res.gistId || cloudGistId);
      setCloudEtag(res.etag || '');
      setCloudLastSyncedAt(syncedAt);
      setCloudConnected(true);
    } catch (err) {
      setCloudConnected(false);
      setCloudError(err.message || 'Could not connect to GitHub Gist.');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleRestoreFromWelcome = async () => {
    if (!restoreToken.trim()) {
      setRestoreError('Paste your GitHub Personal Access Token first.');
      return;
    }
    setRestoreBusy(true);
    setRestoreError('');
    try {
      const res = await pullCloudGist(restoreToken.trim(), restoreGistId.trim());
      if (res.status !== 'ok' || !res.envelope) {
        setRestoreError(
          'No VeloFuel private backup gist was found on that GitHub account. Double-check your token has the "gist" permission or start a new profile.'
        );
        return;
      }
      saveCloudConfig({
        githubToken: restoreToken.trim(),
        gistId: res.gistId,
        etag: res.etag || '',
        autoSync: true,
        lastSyncedAt: res.updatedAt || new Date().toISOString(),
        lastSyncedRevision: Number(res.envelope.revision) || 1,
        lastError: '',
      });
      onRestoreFromCloud({
        envelope: res.envelope,
        gistId: res.gistId,
        etag: res.etag || '',
      });
    } catch (err) {
      setRestoreError(err.message || 'Could not restore from GitHub.');
    } finally {
      setRestoreBusy(false);
    }
  };

  const handleLaunch = ({ skipCloud = false } = {}) => {
    const wizardData = buildWizardResult({ skipCloud });
    onCompleteOnboarding(wizardData);
  };

  // -------------------------------------------------------------------------
  // MODE 1: FRESH-DEVICE WELCOME SCREEN
  // -------------------------------------------------------------------------
  if (mode === 'welcome') {
    return (
      <div className="welcome-shell">
        <div className="welcome-card">
          <div className="welcome-brand">
            <img src="./icon-512.jpg" alt="VeloFuel" className="welcome-logo" />
            <div>
              <h1 className="welcome-title">VeloFuel</h1>
              <p className="welcome-subtitle">Smart Cycling Nutrition Built Around Your Rides</p>
            </div>
          </div>

          <p className="welcome-lead">
            Your daily calories, carbs, and bottle fuel adapt automatically to every ride, rest day, and morning weigh-in — with automatic durable backup so your logs never vanish.
          </p>

          <div className="welcome-highlights">
            <div className="welcome-pill">
              <Bike size={15} color="var(--code-high)" />
              <span>Ride-synced daily carb &amp; bottle targets</span>
            </div>
            <div className="welcome-pill">
              <ShieldCheck size={15} color="var(--code-high)" />
              <span>3-tier durable storage + private cloud sync</span>
            </div>
            <div className="welcome-pill">
              <Sparkles size={15} color="var(--code-med)" />
              <span>Zero fake demo data on your real profile</span>
            </div>
          </div>

          <div className="welcome-actions">
            <button
              type="button"
              className="btn btn-accent btn-block welcome-cta"
              onClick={() => {
                setStep(1);
                setMode('wizard');
              }}
            >
              Set Up My Profile (2 min) <ArrowRight size={16} />
            </button>

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => {
                setRestoreError('');
                setMode('restore');
              }}
            >
              <CloudDownload size={16} /> Restore from Cloud Backup
            </button>

            <button
              type="button"
              className="btn btn-block"
              onClick={onEnterDemoMode}
            >
              Explore with Demo Data
            </button>
          </div>

          <p className="muted-text" style={{ textAlign: 'center', marginTop: 12, fontSize: '0.73rem' }}>
            All personal data stays in your browser and your own private GitHub backup — never sold or shared.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // MODE 2: RESTORE FROM CLOUD BACKUP (RETURNING USER ON NEW / WIPED DEVICE)
  // -------------------------------------------------------------------------
  if (mode === 'restore') {
    return (
      <div className="welcome-shell">
        <div className="welcome-card">
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginBottom: 12 }}
            onClick={() => setMode('welcome')}
          >
            <ArrowLeft size={14} /> Back
          </button>

          <h1 className="section-title" style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloudDownload size={18} color="var(--code-high)" /> Restore from Cloud Backup
          </h1>
          <p className="muted-text" style={{ marginTop: 6, marginBottom: 14 }}>
            Paste your GitHub Personal Access Token (<strong>gist</strong> permission). VeloFuel will automatically find your private <strong>VeloFuel Cloud Sync Backup</strong> and restore all your meals, staples, weigh-ins, and settings without overwriting anything.
          </p>

          <div className="field-grid">
            <div className="field full">
              <label htmlFor="restore-gh-token">GitHub Personal Access Token</label>
              <input
                id="restore-gh-token"
                type="password"
                className="input mono"
                placeholder="ghp_... or github_pat_..."
                value={restoreToken}
                onChange={(e) => setRestoreToken(e.target.value)}
              />
            </div>
            <div className="field full">
              <label htmlFor="restore-gist-id">Backup Gist ID (Optional — auto-found if blank)</label>
              <input
                id="restore-gist-id"
                className="input mono"
                placeholder="Leave blank to find automatically"
                value={restoreGistId}
                onChange={(e) => setRestoreGistId(e.target.value)}
              />
            </div>
          </div>

          {restoreError && (
            <div className="notice-strip" style={{ marginTop: 10 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{restoreError}</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-accent btn-block"
            style={{ marginTop: 14 }}
            disabled={restoreBusy}
            onClick={handleRestoreFromWelcome}
          >
            <CloudDownload size={16} /> {restoreBusy ? 'Searching & Restoring…' : 'Find & Restore My Backup'}
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // MODE 3: 5-STEP GUIDED REAL-USER ONBOARDING WIZARD
  // -------------------------------------------------------------------------
  return (
    <div className="welcome-shell onboarding-mode">
      <div className="onboarding-container">
        <div className="onboarding-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="./icon-512.jpg" alt="VeloFuel" className="brand-icon" />
              <div>
                <div className="section-kicker">Step {step} of 5</div>
                <h1 className="onboarding-step-title">{STEP_TITLES[step - 1]}</h1>
              </div>
            </div>
            {canCancel && (
              <button
                type="button"
                className="icon-btn"
                onClick={onCancel}
                aria-label="Close setup wizard"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="onboarding-progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={5}>
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className={`onboarding-progress-seg ${idx <= step ? 'filled' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* STEP 1 — UNITS & BOTTLES */}
        {step === 1 && (
          <section className="card onboarding-step-card">
            <h2 className="section-title">How do you measure weight, food &amp; bottles?</h2>
            <p className="muted-text" style={{ marginTop: 4, marginBottom: 12 }}>
              Pick Metric, Imperial, or Mixed (many cyclists weigh in lbs/oz but mix bottles in ml/L). You can switch anytime without altering saved data.
            </p>

            <div className="onboarding-option-stack" style={{ marginBottom: 14 }}>
              {[
                { key: 'metric', title: 'All Metric (kg · g · ml)', desc: 'Kilograms, grams, milliliters & centimeters' },
                { key: 'imperial', title: 'All Imperial (lbs · oz · fl oz)', desc: 'Pounds, ounces, fluid ounces & inches' },
                { key: 'mixed', title: 'Mixed (lbs · oz · ml/L)', desc: 'Pounds & ounces for body/food, ml/L for bottles' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`onboarding-option-card ${presetKey === opt.key ? 'active' : ''}`}
                  onClick={() => handleSelectUnitPreset(opt.key)}
                >
                  <div>
                    <div className="onboarding-option-title">{opt.title}</div>
                    <div className="onboarding-option-desc">{opt.desc}</div>
                  </div>
                  {presetKey === opt.key && <Check size={16} color="var(--code-high)" />}
                </button>
              ))}
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label>Default Ride Bottle Size</label>
              <div className="chip-row" role="group" aria-label="Default ride bottle size">
                {BOTTLE_SIZE_OPTIONS.map((ml) => (
                  <button
                    key={ml}
                    type="button"
                    className={`chip ${defaultBottleMl === ml ? 'active' : ''}`}
                    onClick={() => setDefaultBottleMl(ml)}
                  >
                    {formatLiquid(ml, units)}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="onb-tab-mg">Electrolyte Tablet Sodium (mg per tab)</label>
              <NumericInput
                id="onb-tab-mg"
                className="input mono"
                min={100}
                max={1500}
                fallback={500}
                value={electrolyteTabMg}
                onChange={setElectrolyteTabMg}
              />
              <span className="muted-text" style={{ fontSize: '0.72rem' }}>
                Typical tablets are 300–500 mg (LMNT / Precision 1000 mg). Used for practical bottle salt recipes.
              </span>
            </div>
          </section>
        )}

        {/* STEP 2 — YOU & YOUR GOAL + LIVE PREVIEW */}
        {step === 2 && (
          <section className="card onboarding-step-card">
            <h2 className="section-title">Tell us about you &amp; your goal</h2>
            <p className="muted-text" style={{ marginTop: 4, marginBottom: 12 }}>
              Day-1 numbers are a smart starting estimate that adapts over time from your real weigh-ins and food logs.
            </p>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="onb-name">Your Name</label>
                <input
                  id="onb-name"
                  className="input"
                  placeholder="e.g. Alex"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="onb-sex">Sex</label>
                <select
                  id="onb-sex"
                  className="select"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="onb-age">Age</label>
                <NumericInput
                  id="onb-age"
                  className="input mono"
                  min={14}
                  max={95}
                  fallback={34}
                  value={age}
                  onChange={setAge}
                />
              </div>
              <div className="field">
                <label htmlFor="onb-height">
                  Height ({units.height === 'in' ? 'in' : 'cm'})
                </label>
                <NumericInput
                  id="onb-height"
                  className="input mono"
                  step={units.height === 'in' ? 0.5 : 1}
                  min={units.height === 'in' ? 48 : 130}
                  max={units.height === 'in' ? 90 : 230}
                  fallback={units.height === 'in' ? 70 : 179}
                  value={units.height === 'in' ? cmToInches(heightCm) : heightCm}
                  onChange={(val) =>
                    setHeightCm(units.height === 'in' ? inchesToCm(val) : Math.round(val))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="onb-weight">Current Weight ({units.weight})</label>
                <NumericInput
                  id="onb-weight"
                  className="input mono"
                  step={0.1}
                  min={units.weight === 'lbs' ? 75 : 35}
                  max={units.weight === 'lbs' ? 400 : 185}
                  fallback={units.weight === 'lbs' ? 165 : 74}
                  value={kgToDisplay(weightKg, units)}
                  onChange={handleSyncWeightChange}
                />
              </div>
              <div className="field">
                <label htmlFor="onb-bf">Body Fat % (Optional)</label>
                <NumericInput
                  id="onb-bf"
                  className="input mono"
                  step={0.1}
                  min={4}
                  max={55}
                  fallback={15}
                  value={bodyFatPct}
                  onChange={handleSyncBodyFatChange}
                />
              </div>
              <div className="field">
                <label htmlFor="onb-ftp">Cycling FTP (Watts)</label>
                <NumericInput
                  id="onb-ftp"
                  className="input mono"
                  min={80}
                  max={600}
                  fallback={250}
                  value={ftp}
                  onChange={setFtp}
                />
                <span className="muted-text" style={{ fontSize: '0.68rem' }}>
                  Auto-filled if you connect Intervals.icu in Step 3.
                </span>
              </div>
              <div className="field">
                <label htmlFor="onb-activity">Off-Bike Day Job</label>
                <select
                  id="onb-activity"
                  className="select"
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value)}
                >
                  <option value="desk">Desk / Office</option>
                  <option value="light">Lightly Active</option>
                  <option value="active">On Feet All Day</option>
                </select>
              </div>
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Primary Goal</label>
              <div className="chip-row" role="group" aria-label="Primary goal">
                {[
                  { id: 'cut', label: 'Smart Fat-Loss Cut' },
                  { id: 'maintain', label: 'Maintain & Perform' },
                  { id: 'carb_load', label: 'Race Carb Load' },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`chip ${goalMode === g.id ? 'active' : ''}`}
                    onClick={() => setGoalMode(g.id)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {goalMode === 'cut' && (
              <div className="safe-zone-box" style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <label htmlFor="onb-pace" style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                    Weekly Fat-Loss Pace
                  </label>
                  <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--code-high)' }}>
                    {formatWeightRate(-targetLossKgPerWeek, units)} ({pacePctBw}%/wk)
                  </span>
                </div>
                <input
                  id="onb-pace"
                  type="range"
                  min={0.15}
                  max={0.55}
                  step={0.05}
                  value={targetLossKgPerWeek}
                  onChange={(e) => setTargetLossKgPerWeek(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--code-high)', marginTop: 6 }}
                />
                <div className="safe-zone-bar" aria-hidden="true">
                  <span className="safe-zone-track" />
                  <span className="safe-zone-green" />
                </div>
                <div className="muted-text" style={{ fontSize: '0.71rem', marginTop: 4 }}>
                  {paceZoneLabel}
                </div>
              </div>
            )}

            {/* Live Preview Card: Rest Day vs Hard Ride Day */}
            <div className="live-preview-card" aria-label="Live daily targets preview">
              <div className="section-kicker" style={{ marginBottom: 6 }}>
                Live Fuel Preview (Updates as you type)
              </div>
              <div className="live-preview-grid">
                <div className="live-preview-col">
                  <div className="live-preview-label">Rest Day</div>
                  <div className="live-preview-kcal mono">
                    {livePreview.restPlan.targets.kcal.toLocaleString()} kcal
                  </div>
                  <div className="live-preview-macros mono">
                    {livePreview.restPlan.targets.carbs}g carbs · {livePreview.restPlan.targets.protein}g protein
                  </div>
                </div>
                <div className="live-preview-col highlight">
                  <div className="live-preview-label">Hard Ride Day (90m)</div>
                  <div className="live-preview-kcal mono">
                    {livePreview.hardPlan.targets.kcal.toLocaleString()} kcal
                  </div>
                  <div className="live-preview-macros mono">
                    {livePreview.hardPlan.targets.carbs}g carbs
                    {livePreview.hardPlan.onBikePlan?.carbsPerHour
                      ? ` · ${livePreview.hardPlan.onBikePlan.carbsPerHour}g/hr on bike`
                      : ''}
                  </div>
                </div>
              </div>
              <p className="muted-text" style={{ fontSize: '0.71rem', marginTop: 6 }}>
                Targets automatically climb on training days to protect power &amp; recovery, and ease back on rest days.
              </p>
            </div>
          </section>
        )}

        {/* STEP 3 — CONNECT TRAINING & SCALE */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <section className="card onboarding-step-card">
              <div className="section-header">
                <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bike size={16} color="var(--code-high)" /> Intervals.icu Auto-Sync (Optional)
                </h2>
                <span className="section-kicker">Skippable</span>
              </div>
              <p className="muted-text" style={{ marginBottom: 10 }}>
                Pull your real FTP, completed rides, upcoming workouts, and wellness weight automatically. Find your key at{' '}
                <strong>intervals.icu → Settings → Developer Settings</strong>.
              </p>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="onb-icu-id">Athlete ID (or &quot;0&quot;)</label>
                  <input
                    id="onb-icu-id"
                    className="input mono"
                    placeholder="0"
                    value={icuAthleteId}
                    onChange={(e) => setIcuAthleteId(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="onb-icu-key">Intervals.icu API Key</label>
                  <input
                    id="onb-icu-key"
                    type="password"
                    className="input mono"
                    placeholder="Paste API key"
                    value={icuApiKey}
                    onChange={(e) => setIcuApiKey(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn btn-accent btn-block"
                style={{ marginTop: 10 }}
                disabled={icuTesting}
                onClick={handleTestIntervals}
              >
                <RefreshCw size={15} className={icuTesting ? 'spin' : ''} />{' '}
                {icuTesting ? 'Testing & Pulling…' : 'Test & Pull My Rides + FTP'}
              </button>

              {icuError && (
                <div className="notice-strip" style={{ marginTop: 10 }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{icuError}</span>
                </div>
              )}

              {icuResult && (
                <div className="notice-strip green" style={{ marginTop: 10 }}>
                  <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Connected!</strong> Pulled{' '}
                    {icuResult.diagnostics?.pulledFtp ? (
                      <>
                        <strong>FTP {icuResult.diagnostics.pulledFtp}W</strong> +{' '}
                      </>
                    ) : null}
                    <strong>
                      {(icuResult.diagnostics?.completedCount || 0) +
                        (icuResult.diagnostics?.plannedCount || 0)}
                    </strong>{' '}
                    rides ({icuResult.diagnostics?.completedCount || 0} completed,{' '}
                    {icuResult.diagnostics?.plannedCount || 0} planned). Step 2 physiology updated automatically.
                  </div>
                </div>
              )}
            </section>

            <section className="card onboarding-step-card">
              <div className="section-header">
                <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Scale size={16} color="var(--code-high)" /> Morning Scale (Optional)
                </h2>
                <span className="section-kicker">Clears sample weights</span>
              </div>
              <p className="muted-text" style={{ marginBottom: 10 }}>
                Start your weight trend with today&apos;s real morning weigh-in or import a Withings CSV. You can also link automatic Direct Withings Sync anytime in the Sync tab.
              </p>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="onb-scale-weight">Today&apos;s Morning Weight ({units.weight})</label>
                  <NumericInput
                    id="onb-scale-weight"
                    className="input mono"
                    step={0.1}
                    min={units.weight === 'lbs' ? 75 : 35}
                    max={units.weight === 'lbs' ? 400 : 185}
                    fallback={kgToDisplay(weightKg, units)}
                    value={kgToDisplay(scaleWeightKg, units)}
                    onChange={(val) => setScaleWeightKg(displayToKg(val, units))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="onb-scale-bf">Body Fat % (Optional)</label>
                  <NumericInput
                    id="onb-scale-bf"
                    className="input mono"
                    step={0.1}
                    min={4}
                    max={55}
                    allowEmpty
                    value={scaleBodyFatPct}
                    onChange={setScaleBodyFatPct}
                  />
                </div>
              </div>

              <label className="onboarding-checkbox" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={logMorningWeightNow}
                  onChange={(e) => setLogMorningWeightNow(e.target.checked)}
                />
                <span>Save as today&apos;s real morning weigh-in</span>
              </label>

              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleWithingsCsvFile}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => csvInputRef.current?.click()}
                >
                  <Upload size={14} /> Upload Withings weight.csv
                </button>
                {csvNotice && (
                  <span className="muted-text" style={{ fontSize: '0.74rem', color: 'var(--code-high)', fontWeight: 600 }}>
                    {csvNotice}
                  </span>
                )}
              </div>
            </section>
          </div>
        )}

        {/* STEP 4 — DAILY ROUTINE & SUPPLEMENTS */}
        {step === 4 && (
          <section className="card onboarding-step-card">
            <h2 className="section-title">Daily Routine &amp; Supplements</h2>
            <p className="muted-text" style={{ marginTop: 4, marginBottom: 12 }}>
              Set your default daily meal layout, usual ride time, sweat rate, and daily vitamin stack. Everything stays editable anytime.
            </p>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>Default Meal Template</label>
              <div className="onboarding-option-stack">
                {Object.values(MEAL_TEMPLATE_PRESETS).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`onboarding-option-card ${mealTemplate === preset.id ? 'active' : ''}`}
                    onClick={() => setMealTemplate(preset.id)}
                  >
                    <div>
                      <div className="onboarding-option-title">{preset.label}</div>
                      <div className="onboarding-option-desc">{preset.description}</div>
                    </div>
                    {mealTemplate === preset.id && <Check size={16} color="var(--code-high)" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>Usual Workout Time</label>
              <div className="chip-row" role="group" aria-label="Usual workout time">
                {[
                  { id: 'morning', label: 'Morning' },
                  { id: 'midday', label: 'Midday' },
                  { id: 'evening', label: 'Evening' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip ${workoutTiming === t.id ? 'active' : ''}`}
                    onClick={() => setWorkoutTiming(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Droplets size={13} color="var(--macro-protein)" /> Default Sweat Rate
              </label>
              <div className="chip-row" role="group" aria-label="Default sweat rate">
                {SWEAT_RATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`chip ${sweatRate === opt.value ? 'active' : ''}`}
                    onClick={() => setSweatRate(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="muted-text" style={{ fontSize: '0.72rem' }}>
                Heavy sweaters get higher hourly fluid &amp; sodium bottle targets automatically.
              </span>
            </div>

            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Pill size={13} color="var(--code-high)" /> Daily Supplement Stack (1-tap logging)
              </label>
              <div className="onboarding-supp-list">
                {ONBOARDING_SUPPLEMENTS.map((supp) => {
                  const checked = selectedSuppIds.includes(supp.id);
                  return (
                    <label key={supp.id} className={`onboarding-supp-row ${checked ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSupp(supp.id)}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{supp.name}</div>
                        <div className="muted-text" style={{ fontSize: '0.71rem' }}>{supp.note}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* STEP 5 — LOCK IN SUSTAINING CLOUD BACKUP */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <section className="card onboarding-step-card">
              <div className="notice-strip green" style={{ marginBottom: 12 }}>
                <ShieldCheck size={17} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>On-Device Protection Active ✓</strong>
                  <div style={{ marginTop: 2, fontSize: '0.75rem' }}>
                    Every change mirrors automatically to Local + Durable IndexedDB storage with 14 days of rolling local recovery snapshots
                    {persistentGranted ? ' (persistent storage granted).' : '.'}
                  </div>
                </div>
              </div>

              <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Cloud size={16} color="var(--code-high)" /> Private GitHub Cloud Backup (Free, Optional)
              </h2>
              <p className="muted-text" style={{ marginTop: 4, marginBottom: 10 }}>
                Safari and iPhone Home Screen apps use separate local storage containers. Linking a free private GitHub Gist keeps your logs synced automatically across browsers and devices with full version history.
              </p>

              <div className="notice-strip slate" style={{ flexDirection: 'column', gap: 6, marginBottom: 12, fontSize: '0.75rem' }}>
                <div>
                  <strong>1.</strong>{' '}
                  <a
                    href={GITHUB_CLASSIC_PAT_URL}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--code-high)', fontWeight: 700 }}
                  >
                    Create a private gist-only GitHub token (1-click) <ExternalLink size={11} style={{ verticalAlign: '-1px' }} />
                  </a>{' '}
                  — pre-checks only <code>gist</code> (zero code/repo access).
                </div>
                <div>
                  <strong>2.</strong> Copy your token (<code>ghp_...</code> or <code>github_pat_...</code>) and paste it below. Your GitHub token never leaves this device.
                </div>
                <div>
                  <strong>3.</strong> Tap <strong>Connect &amp; Back Up Now</strong> to link your private backup.
                </div>
              </div>

              <div className="field">
                <label htmlFor="onb-gh-token">GitHub Personal Access Token (Stays on this device)</label>
                <input
                  id="onb-gh-token"
                  type="password"
                  className="input mono"
                  placeholder="ghp_... or github_pat_..."
                  value={ghToken}
                  onChange={(e) => {
                    setGhToken(e.target.value);
                    setCloudConnected(false);
                    setCloudLastSyncedAt('');
                    setExistingCloudOffer(null);
                    setCloudError('');
                  }}
                />
              </div>

              <label className="onboarding-checkbox" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={syncThirdPartyKeys}
                  onChange={(e) => setSyncThirdPartyKeys(e.target.checked)}
                />
                <span>
                  Also include Intervals.icu, Withings &amp; food API keys inside my private backup (leave unchecked to keep keys on this device only)
                </span>
              </label>

              <button
                type="button"
                className="btn btn-primary btn-block"
                style={{ marginTop: 12 }}
                disabled={cloudBusy}
                onClick={handleConnectAndBackupStep5}
              >
                <Cloud size={15} /> {cloudBusy ? 'Connecting & Backing Up…' : 'Connect & Back Up Now'}
              </button>

              {cloudError && (
                <div className="notice-strip" style={{ marginTop: 10 }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{cloudError}</span>
                </div>
              )}

              {existingCloudOffer && (
                <div className="notice-strip green" style={{ marginTop: 10, flexDirection: 'column', gap: 8 }}>
                  <div>
                    <strong>Existing Cloud Backup Found!</strong> We protected your existing backup from being overwritten. Want to restore it instead?
                  </div>
                  <button
                    type="button"
                    className="btn btn-accent btn-sm"
                    onClick={() => {
                      saveCloudConfig({
                        githubToken: existingCloudOffer.githubToken || ghToken.trim(),
                        gistId: existingCloudOffer.gistId,
                        etag: existingCloudOffer.etag || '',
                        syncThirdPartyKeys: Boolean(
                          existingCloudOffer.syncThirdPartyKeys ?? syncThirdPartyKeys
                        ),
                        autoSync: true,
                        lastSyncedAt: existingCloudOffer.updatedAt || new Date().toISOString(),
                        lastSyncedRevision: Number(existingCloudOffer.envelope?.revision) || 1,
                        lastError: '',
                      });
                      onRestoreFromCloud({
                        envelope: existingCloudOffer.envelope,
                        gistId: existingCloudOffer.gistId,
                        etag: existingCloudOffer.etag,
                      });
                    }}
                  >
                    <CloudDownload size={14} /> Restore Existing Cloud Backup
                  </button>
                </div>
              )}

              {cloudConnected && !existingCloudOffer && (
                <div className="notice-strip green" style={{ marginTop: 10 }}>
                  <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    <strong>Cloud Backup Active ✓</strong> — Automatic private backup is ready across devices.
                  </span>
                </div>
              )}
            </section>

            <button
              type="button"
              className="btn btn-accent btn-block welcome-cta"
              onClick={() => handleLaunch({ skipCloud: false })}
            >
              Launch My VeloFuel <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* FOOTER NAVIGATION */}
        <div className="onboarding-footer">
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (step > 1) {
                setStep((s) => s - 1);
              } else if (canCancel) {
                onCancel?.();
              } else {
                setMode('welcome');
              }
            }}
          >
            <ArrowLeft size={15} /> {step === 1 ? (canCancel ? 'Cancel' : 'Welcome') : 'Back'}
          </button>

          {step < 5 ? (
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => setStep((s) => Math.min(5, s + 1))}
            >
              Next <ArrowRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => handleLaunch({ skipCloud: true })}
            >
              Skip Cloud &amp; Launch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
