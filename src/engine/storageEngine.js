// VeloFuel v12 — 3-Tier Sustaining Data Storage Engine
// Tier 1: Schema-versioned flat-superset localStorage ('velofuel_state_v1')
// Tier 2: Durable IndexedDB ('velofuel_durable_db' -> 'current' + rolling 14-day 'snapshots') + StorageManager.persist()
// Tier 3: Private GitHub Gist Cloud Sync (browser CORS-safe, local-only PAT, Never-Clobber-Cloud guard)

import {
  DEFAULT_PROFILE,
  DEFAULT_STAPLES,
  DEFAULT_SUPPLEMENTS,
  createDefaultBiometrics,
  createDefaultLogs,
  createDefaultSessions,
  getIsoDate,
  isSampleBiometric,
  isSampleSession,
  migrateStaple,
} from './defaultData';
import { getUnits } from './units';

export const STORAGE_KEY = 'velofuel_state_v1';
export const CLOUD_CONFIG_KEY = 'velofuel_cloud_config_v1';
export const IDB_NAME = 'velofuel_durable_db';
export const IDB_VERSION = 1;
export const SCHEMA_VERSION = 2;
export const MAX_SNAPSHOTS = 14;

export const GIST_DESCRIPTION = 'VeloFuel Cloud Sync Backup';
export const GIST_FILENAME = 'velofuel-backup.json';
export const GITHUB_CLASSIC_PAT_URL =
  'https://github.com/settings/tokens/new?scopes=gist&description=VeloFuel%20Cloud%20Sync';

const DEFAULT_INTERVALS_CONFIG = { athleteId: '0', apiKey: '', autoSync: true };
const DEFAULT_WITHINGS_CONFIG = {
  clientId: '',
  clientSecret: '',
  accessToken: '',
  refreshToken: '',
  expiresAt: 0,
};
const DEFAULT_AI_CONFIG = { provider: 'auto', apiKey: '' };
const DEFAULT_CLOUD_CONFIG = {
  githubToken: '',
  gistId: '',
  autoSync: true,
  syncThirdPartyKeys: false,
  etag: '',
  lastSyncedAt: '',
  lastSyncedRevision: 0,
  lastError: '',
  rateLimitResetAt: 0,
};

// ---------------------------------------------------------------------------
// Envelope Normalization & User-Data Classification
// ---------------------------------------------------------------------------

export function computeHasUserData(state) {
  if (!state || typeof state !== 'object') return false;
  if (state.onboardingCompleted && !state.isDemoMode) return true;

  const logs = state.logsByDate || {};
  if (Object.values(logs).some((dayLogs) => Array.isArray(dayLogs) && dayLogs.length > 0)) {
    return true;
  }
  if (Array.isArray(state.biometrics) && state.biometrics.some((b) => b && !isSampleBiometric(b))) {
    return true;
  }
  if (Array.isArray(state.sessions) && state.sessions.some((s) => s && !isSampleSession(s))) {
    return true;
  }
  if (state.customMealsByDate && Object.keys(state.customMealsByDate).length > 0) return true;
  if (state.timelineOrderByDate && Object.keys(state.timelineOrderByDate).length > 0) return true;
  if (state.intervalsConfig?.apiKey?.trim()) return true;
  if (state.withingsConfig?.accessToken || state.withingsConfig?.refreshToken) return true;
  if (state.aiConfig?.apiKey?.trim() || state.profile?.usdaApiKey?.trim()) return true;

  const p = state.profile || {};
  if (
    (p.name && p.name !== DEFAULT_PROFILE.name) ||
    (typeof p.ftp === 'number' && p.ftp !== DEFAULT_PROFILE.ftp) ||
    (typeof p.heightCm === 'number' && p.heightCm !== DEFAULT_PROFILE.heightCm) ||
    (typeof p.age === 'number' && p.age !== DEFAULT_PROFILE.age) ||
    (p.sex && p.sex !== DEFAULT_PROFILE.sex) ||
    (p.defaultSweatRate && p.defaultSweatRate !== DEFAULT_PROFILE.defaultSweatRate) ||
    (p.defaultMealTemplate && p.defaultMealTemplate !== DEFAULT_PROFILE.defaultMealTemplate)
  ) {
    return true;
  }
  return false;
}

export function createDemoEnvelope() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    revision: 1,
    hasUserData: false,
    onboardingCompleted: false,
    isDemoMode: true,
    cloudSyncMeta: { gistId: '', includeApiKeys: false, lastSyncedAt: '' },
    profile: { ...DEFAULT_PROFILE, units: getUnits(DEFAULT_PROFILE) },
    staples: DEFAULT_STAPLES,
    supplements: DEFAULT_SUPPLEMENTS,
    sessions: createDefaultSessions(),
    biometrics: createDefaultBiometrics(),
    logsByDate: createDefaultLogs(),
    customMealsByDate: {},
    timelineOrderByDate: {},
    intervalsConfig: { ...DEFAULT_INTERVALS_CONFIG },
    withingsConfig: { ...DEFAULT_WITHINGS_CONFIG },
    aiConfig: { ...DEFAULT_AI_CONFIG },
  };
}

export function createCleanUserEnvelope(overrides = {}) {
  const baseProfile = {
    ...DEFAULT_PROFILE,
    ...(overrides.profile || {}),
    units: getUnits(overrides.profile || DEFAULT_PROFILE),
  };
  const next = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    revision: Math.max(1, Number(overrides.revision) || 1),
    hasUserData: true,
    onboardingCompleted: true,
    isDemoMode: false,
    cloudSyncMeta: {
      gistId: '',
      includeApiKeys: false,
      lastSyncedAt: '',
      ...(overrides.cloudSyncMeta || {}),
    },
    profile: baseProfile,
    staples: Array.isArray(overrides.staples) && overrides.staples.length > 0 ? overrides.staples : DEFAULT_STAPLES,
    supplements: Array.isArray(overrides.supplements) ? overrides.supplements : DEFAULT_SUPPLEMENTS,
    sessions: Array.isArray(overrides.sessions) ? overrides.sessions : [],
    biometrics: Array.isArray(overrides.biometrics) ? overrides.biometrics : [],
    logsByDate: overrides.logsByDate && typeof overrides.logsByDate === 'object' ? overrides.logsByDate : {},
    customMealsByDate:
      overrides.customMealsByDate && typeof overrides.customMealsByDate === 'object'
        ? overrides.customMealsByDate
        : {},
    timelineOrderByDate:
      overrides.timelineOrderByDate && typeof overrides.timelineOrderByDate === 'object'
        ? overrides.timelineOrderByDate
        : {},
    intervalsConfig: { ...DEFAULT_INTERVALS_CONFIG, ...(overrides.intervalsConfig || {}) },
    withingsConfig: { ...DEFAULT_WITHINGS_CONFIG, ...(overrides.withingsConfig || {}) },
    aiConfig: { ...DEFAULT_AI_CONFIG, ...(overrides.aiConfig || {}) },
  };
  next.hasUserData = computeHasUserData(next);
  return next;
}

const isPlainObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const KNOWN_STATE_KEYS = [
  'schemaVersion',
  'profile',
  'logsByDate',
  'sessions',
  'biometrics',
  'staples',
  'supplements',
  'intervalsConfig',
  'withingsConfig',
  'aiConfig',
  'onboardingCompleted',
  'isDemoMode',
];

export function normalizeAppState(parsed, { preserveEmptyCollections = false } = {}) {
  if (!isPlainObj(parsed)) return null;
  if (!KNOWN_STATE_KEYS.some((k) => k in parsed)) return null;

  const isV2 = Number(parsed.schemaVersion) >= 2;
  const isLegacyV1 = !isV2 && parsed.onboardingCompleted === undefined;
  const onboardingCompleted = isLegacyV1 ? true : Boolean(parsed.onboardingCompleted);
  const isDemoMode = isLegacyV1 ? false : Boolean(parsed.isDemoMode);

  // CRITICAL: Never resurrect demo rides/weights for v2 or onboarded real users!
  const allowEmpty = preserveEmptyCollections || isV2 || (onboardingCompleted && !isDemoMode);

  const migratedStaples =
    Array.isArray(parsed.staples) && parsed.staples.length > 0
      ? parsed.staples.map(migrateStaple).filter(Boolean)
      : DEFAULT_STAPLES;

  const sessions = Array.isArray(parsed.sessions)
    ? allowEmpty || parsed.sessions.length > 0
      ? parsed.sessions
      : createDefaultSessions()
    : allowEmpty
    ? []
    : createDefaultSessions();

  const biometrics = Array.isArray(parsed.biometrics)
    ? allowEmpty || parsed.biometrics.length > 0
      ? parsed.biometrics
      : createDefaultBiometrics()
    : allowEmpty
    ? []
    : createDefaultBiometrics();

  const parsedProfile = isPlainObj(parsed.profile) ? parsed.profile : null;

  const normalized = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt:
      typeof parsed.updatedAt === 'string' && parsed.updatedAt
        ? parsed.updatedAt
        : new Date().toISOString(),
    revision: Number.isFinite(Number(parsed.revision)) ? Math.max(1, Math.round(Number(parsed.revision))) : 1,
    onboardingCompleted,
    isDemoMode,
    hasUserData: false,
    cloudSyncMeta: {
      gistId: '',
      includeApiKeys: false,
      lastSyncedAt: '',
      ...(isPlainObj(parsed.cloudSyncMeta) ? parsed.cloudSyncMeta : {}),
    },
    profile: {
      ...DEFAULT_PROFILE,
      ...(parsedProfile || {}),
      units: getUnits(parsedProfile),
    },
    staples: migratedStaples.length > 0 ? migratedStaples : DEFAULT_STAPLES,
    supplements: Array.isArray(parsed.supplements) ? parsed.supplements : DEFAULT_SUPPLEMENTS,
    sessions,
    biometrics,
    logsByDate: isPlainObj(parsed.logsByDate) ? parsed.logsByDate : createDefaultLogs(),
    customMealsByDate: isPlainObj(parsed.customMealsByDate) ? parsed.customMealsByDate : {},
    timelineOrderByDate: isPlainObj(parsed.timelineOrderByDate) ? parsed.timelineOrderByDate : {},
    intervalsConfig: {
      ...DEFAULT_INTERVALS_CONFIG,
      ...(isPlainObj(parsed.intervalsConfig) ? parsed.intervalsConfig : {}),
    },
    withingsConfig: {
      ...DEFAULT_WITHINGS_CONFIG,
      ...(isPlainObj(parsed.withingsConfig) ? parsed.withingsConfig : {}),
    },
    aiConfig: {
      ...DEFAULT_AI_CONFIG,
      ...(isPlainObj(parsed.aiConfig) ? parsed.aiConfig : {}),
    },
  };

  // Never allow githubToken to leak into app state
  if ('githubToken' in normalized) {
    delete normalized.githubToken;
  }

  normalized.hasUserData = Boolean(parsed.hasUserData) || computeHasUserData(normalized);
  return normalized;
}

// ---------------------------------------------------------------------------
// Tier 1: LocalStorage (Flat-Superset Envelope)
// ---------------------------------------------------------------------------

export function readLocalEnvelope() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { status: 'empty', envelope: null };
    }
    const parsed = JSON.parse(raw);
    const envelope = normalizeAppState(parsed);
    if (!envelope) {
      return { status: 'corrupted', envelope: null, error: 'Saved browser data could not be parsed.' };
    }
    return { status: 'ok', envelope };
  } catch (err) {
    return {
      status: 'corrupted',
      envelope: null,
      error: err?.message || 'Unable to read local browser storage.',
    };
  }
}

export function writeLocalEnvelope(envelope) {
  try {
    const safe = { ...envelope };
    delete safe.githubToken;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return { ok: true };
  } catch (err) {
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      String(err?.message || '').toLowerCase().includes('quota');
    return {
      ok: false,
      error: isQuota
        ? 'Browser quick-storage is full — your data is still mirrored to durable storage & cloud backup.'
        : err?.message || 'Could not write to browser storage.',
    };
  }
}

// ---------------------------------------------------------------------------
// Tier 2: Durable IndexedDB ('velofuel_durable_db') + StorageManager.persist()
// ---------------------------------------------------------------------------

let cachedDbPromise = null;

function resetCachedDb() {
  if (cachedDbPromise) {
    cachedDbPromise
      .then((db) => {
        try {
          db?.close?.();
        } catch {
          // ignore close errors
        }
      })
      .catch(() => {});
  }
  cachedDbPromise = null;
}

function isWebKitDisconnectError(err) {
  const name = String(err?.name || '');
  const msg = String(err?.message || '');
  return (
    name === 'UnknownError' ||
    name === 'InvalidStateError' ||
    msg.includes('Connection to Indexed Database server lost') ||
    msg.includes('database connection is closing')
  );
}

function openDurableDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = new Promise((resolve, reject) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('current')) {
          db.createObjectStore('current', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'date' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onclose = () => {
          cachedDbPromise = null;
        };
        db.onversionchange = () => {
          try {
            db.close();
          } catch {
            // ignore
          }
          cachedDbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        cachedDbPromise = null;
        reject(req.error || new Error('IndexedDB open failed'));
      };
      req.onblocked = () => {
        cachedDbPromise = null;
        reject(new Error('IndexedDB open blocked'));
      };
    } catch (err) {
      cachedDbPromise = null;
      reject(err);
    }
  });

  return cachedDbPromise;
}

async function withIdbRetry(operation) {
  let attempt = 0;
  while (attempt < 2) {
    attempt += 1;
    try {
      const db = await openDurableDb();
      if (!db) return null;
      return await operation(db);
    } catch (err) {
      if (attempt === 1 && isWebKitDisconnectError(err)) {
        resetCachedDb();
        continue;
      }
      throw err;
    }
  }
  return null;
}

export async function requestPersistentStorage() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage) {
      return { supported: false, persisted: false };
    }
    let already = false;
    if (typeof navigator.storage.persisted === 'function') {
      already = await navigator.storage.persisted();
    }
    if (already) return { supported: true, persisted: true };
    if (typeof navigator.storage.persist === 'function') {
      const granted = await navigator.storage.persist();
      return { supported: true, persisted: Boolean(granted) };
    }
    return { supported: false, persisted: false };
  } catch {
    return { supported: false, persisted: false };
  }
}

export async function readIndexedDbCurrent() {
  try {
    const record = await withIdbRetry(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction('current', 'readonly');
          const req = tx.objectStore('current').get('latest');
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        })
    );
    if (!record || !record.payload) return null;
    return normalizeAppState(record.payload, { preserveEmptyCollections: true });
  } catch {
    return null;
  }
}

export function buildSnapshotSummary(envelope) {
  const logsByDate = envelope?.logsByDate || {};
  let loggedMeals = 0;
  let loggedDays = 0;
  Object.values(logsByDate).forEach((list) => {
    if (Array.isArray(list) && list.length > 0) {
      loggedDays += 1;
      loggedMeals += list.length;
    }
  });
  const weighIns = Array.isArray(envelope?.biometrics)
    ? envelope.biometrics.filter((b) => b && !isSampleBiometric(b)).length
    : 0;
  const workouts = Array.isArray(envelope?.sessions)
    ? envelope.sessions.filter((s) => s && !isSampleSession(s)).length
    : 0;
  return {
    loggedMeals,
    loggedDays,
    weighIns,
    workouts,
    revision: Number(envelope?.revision) || 1,
    profileName: envelope?.profile?.name || 'Rider',
  };
}

export async function writeIndexedDbMirror(envelope, todayIso = getIsoDate(0)) {
  try {
    const safePayload = { ...envelope };
    delete safePayload.githubToken;
    const savedAt = new Date().toISOString();
    const summary = buildSnapshotSummary(safePayload);

    await withIdbRetry(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(['current', 'snapshots'], 'readwrite');
          const currentStore = tx.objectStore('current');
          const snapStore = tx.objectStore('snapshots');

          currentStore.put({ id: 'latest', savedAt, payload: safePayload });
          snapStore.put({
            date: todayIso,
            savedAt,
            summary,
            payload: safePayload,
          });

          const keysReq = snapStore.getAllKeys();
          keysReq.onsuccess = () => {
            const keys = Array.isArray(keysReq.result)
              ? [...keysReq.result].map(String).sort((a, b) => b.localeCompare(a))
              : [];
            if (keys.length > MAX_SNAPSHOTS) {
              keys.slice(MAX_SNAPSHOTS).forEach((oldDate) => {
                snapStore.delete(oldDate);
              });
            }
          };

          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
          tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'));
        })
    );

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Could not mirror to durable device storage.' };
  }
}

export async function listLocalSnapshots() {
  try {
    const rows = await withIdbRetry(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction('snapshots', 'readonly');
          const req = tx.objectStore('snapshots').getAll();
          req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
          req.onerror = () => reject(req.error);
        })
    );
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r) => r && r.date && r.payload)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, MAX_SNAPSHOTS)
      .map((r) => ({
        date: String(r.date),
        savedAt: r.savedAt || r.payload?.updatedAt || '',
        summary: r.summary || buildSnapshotSummary(r.payload),
        payload: normalizeAppState(r.payload, { preserveEmptyCollections: true }),
      }))
      .filter((r) => Boolean(r.payload));
  } catch {
    return [];
  }
}

export async function bootstrapStorage() {
  const lsResult = readLocalEnvelope();
  const [idbEnvelope, persistRes] = await Promise.all([
    readIndexedDbCurrent(),
    requestPersistentStorage(),
  ]);

  const persistentGranted = Boolean(persistRes?.persisted);

  // Case 1: Tier 1 empty or corrupted, Tier 2 valid -> automatic recovery!
  if (lsResult.status !== 'ok' && idbEnvelope) {
    const repairRes = writeLocalEnvelope(idbEnvelope);
    return {
      source: 'indexeddb',
      recoveredFrom: 'indexeddb',
      envelope: idbEnvelope,
      persistentGranted,
      tier1Warning: repairRes.ok ? '' : repairRes.error,
    };
  }

  // Case 2: Both Tier 1 and Tier 2 valid -> arbitrate carefully
  // Tier 2 wins ONLY if idb.revision > ls.revision strictly OR (!ls.hasUserData && idb.hasUserData).
  // Equal revision => Tier 1 wins (preserves direct localStorage edits + reload in QA PASS 13!).
  if (lsResult.status === 'ok' && idbEnvelope) {
    const lsEnv = lsResult.envelope;
    const idbRev = Number(idbEnvelope.revision) || 0;
    const lsRev = Number(lsEnv.revision) || 0;
    const preferIdb = idbRev > lsRev || (!lsEnv.hasUserData && idbEnvelope.hasUserData);

    if (preferIdb) {
      const repairRes = writeLocalEnvelope(idbEnvelope);
      return {
        source: 'indexeddb',
        recoveredFrom: 'indexeddb',
        envelope: idbEnvelope,
        persistentGranted,
        tier1Warning: repairRes.ok ? '' : repairRes.error,
      };
    }

    // Mirror Tier 1 into Tier 2 quietly so both tiers stay in sync
    await writeIndexedDbMirror(lsEnv, getIsoDate(0));
    return {
      source: 'localStorage',
      envelope: lsEnv,
      persistentGranted,
      tier1Warning: '',
    };
  }

  // Case 3: Tier 1 valid, Tier 2 empty -> mirror Tier 1 into Tier 2 immediately
  if (lsResult.status === 'ok') {
    await writeIndexedDbMirror(lsResult.envelope, getIsoDate(0));
    return {
      source: 'localStorage',
      envelope: lsResult.envelope,
      persistentGranted,
      tier1Warning: '',
    };
  }

  // Case 4: Both empty -> fresh device (show Welcome; do NOT persist empty defaults yet!)
  return {
    source: 'fresh',
    envelope: null,
    persistentGranted,
    tier1Warning: lsResult.status === 'corrupted' ? lsResult.error : '',
  };
}

// ---------------------------------------------------------------------------
// Tier 3: Private GitHub Gist Cloud Sync (Local-Only PAT, CORS-Safe Headers)
// ---------------------------------------------------------------------------

export function loadCloudConfig() {
  try {
    const raw = window.localStorage.getItem(CLOUD_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CLOUD_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CLOUD_CONFIG,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
    };
  } catch {
    return { ...DEFAULT_CLOUD_CONFIG };
  }
}

export function saveCloudConfig(patch) {
  const next = {
    ...loadCloudConfig(),
    ...(patch && typeof patch === 'object' ? patch : {}),
  };
  try {
    window.localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors for cloud config metadata
  }
  return next;
}

export function clearCloudConfig() {
  const empty = { ...DEFAULT_CLOUD_CONFIG };
  try {
    window.localStorage.removeItem(CLOUD_CONFIG_KEY);
  } catch {
    // ignore
  }
  return empty;
}

export function prepareCloudPayload(envelope, { syncThirdPartyKeys = false } = {}) {
  const base = normalizeAppState(envelope, { preserveEmptyCollections: true });
  if (!base) return null;

  const payload = {
    ...base,
    keysIncluded: Boolean(syncThirdPartyKeys),
    profile: { ...base.profile },
    intervalsConfig: { ...base.intervalsConfig },
    withingsConfig: { ...base.withingsConfig },
    aiConfig: { ...base.aiConfig },
    cloudSyncMeta: {
      ...(base.cloudSyncMeta || {}),
      includeApiKeys: Boolean(syncThirdPartyKeys),
    },
  };

  // GitHub PAT is NEVER placed into the uploaded gist payload
  delete payload.githubToken;

  if (!syncThirdPartyKeys) {
    payload.profile.usdaApiKey = '';
    payload.intervalsConfig.apiKey = '';
    payload.withingsConfig = {
      ...payload.withingsConfig,
      clientSecret: '',
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
    };
    payload.aiConfig.apiKey = '';
  }

  return payload;
}

export function mergeRemoteEnvelopeWithLocalSecrets(remoteEnvelope, localState) {
  const remote = normalizeAppState(remoteEnvelope, { preserveEmptyCollections: true });
  if (!remote) return null;
  if (!localState || typeof localState !== 'object') return remote;

  const preserveKeys = remoteEnvelope?.keysIncluded === false;
  return {
    ...remote,
    profile: {
      ...remote.profile,
      usdaApiKey:
        !preserveKeys && remote.profile.usdaApiKey
          ? remote.profile.usdaApiKey
          : localState.profile?.usdaApiKey || remote.profile.usdaApiKey || '',
    },
    intervalsConfig: {
      ...remote.intervalsConfig,
      apiKey:
        !preserveKeys && remote.intervalsConfig.apiKey
          ? remote.intervalsConfig.apiKey
          : localState.intervalsConfig?.apiKey || remote.intervalsConfig.apiKey || '',
    },
    withingsConfig: {
      ...remote.withingsConfig,
      clientId: remote.withingsConfig.clientId || localState.withingsConfig?.clientId || '',
      clientSecret:
        !preserveKeys && remote.withingsConfig.clientSecret
          ? remote.withingsConfig.clientSecret
          : localState.withingsConfig?.clientSecret || remote.withingsConfig.clientSecret || '',
      accessToken:
        !preserveKeys && remote.withingsConfig.accessToken
          ? remote.withingsConfig.accessToken
          : localState.withingsConfig?.accessToken || remote.withingsConfig.accessToken || '',
      refreshToken:
        !preserveKeys && remote.withingsConfig.refreshToken
          ? remote.withingsConfig.refreshToken
          : localState.withingsConfig?.refreshToken || remote.withingsConfig.refreshToken || '',
      expiresAt:
        !preserveKeys && remote.withingsConfig.expiresAt
          ? remote.withingsConfig.expiresAt
          : localState.withingsConfig?.expiresAt || remote.withingsConfig.expiresAt || 0,
    },
    aiConfig: {
      ...remote.aiConfig,
      apiKey:
        !preserveKeys && remote.aiConfig.apiKey
          ? remote.aiConfig.apiKey
          : localState.aiConfig?.apiKey || remote.aiConfig.apiKey || '',
    },
  };
}

// Strict browser-CORS-safe headers ONLY:
// NEVER send Cache-Control, Pragma, User-Agent, or X-GitHub-Api-Version!
function buildGitHubHeaders(token, { method = 'GET', etag = '' } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${String(token || '').trim()}`,
  };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }
  if (method === 'GET' && etag) {
    headers['If-None-Match'] = etag;
  }
  return headers;
}

function createGitHubApiError(res, contextLabel) {
  const status = res.status;
  const retryAfter = Number(res.headers?.get?.('retry-after') || 0);
  const remaining = res.headers?.get?.('x-ratelimit-remaining');
  const resetEpoch = Number(res.headers?.get?.('x-ratelimit-reset') || 0);

  let message = `${contextLabel} failed (HTTP ${status}).`;
  let rateLimitResetAt = 0;

  if (status === 401) {
    message = 'GitHub token expired or invalid — reconnect your token in Sync.';
  } else if (status === 403 || status === 429) {
    if (retryAfter > 0) {
      rateLimitResetAt = Date.now() + retryAfter * 1000;
      message = `GitHub sync paused briefly (rate limit). Will retry in ${retryAfter}s.`;
    } else if (remaining === '0' && resetEpoch > 0) {
      rateLimitResetAt = resetEpoch * 1000;
      message = 'GitHub API hourly limit reached — sync paused until reset.';
    } else {
      message = 'GitHub rejected access — make sure your token includes the "gist" permission.';
    }
  } else if (status === 404) {
    message = 'Backup Gist not found (deleted or token lacks "gist" permission).';
  } else if (status === 422) {
    message = 'GitHub could not validate the backup upload (HTTP 422).';
  }

  const err = new Error(message);
  err.status = status;
  err.rateLimitResetAt = rateLimitResetAt;
  return err;
}

export async function findVeloFuelGist(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) throw new Error('Paste your GitHub Personal Access Token first.');

  const res = await fetch('https://api.github.com/gists?per_page=100', {
    method: 'GET',
    headers: buildGitHubHeaders(cleanToken, { method: 'GET' }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw createGitHubApiError(res, 'Finding cloud backup');
  }

  const gists = await res.json();
  if (!Array.isArray(gists)) return null;

  const matches = gists.filter((g) => {
    if (!g || g.public !== false) return false;
    const hasFile = Boolean(g.files && g.files[GIST_FILENAME]);
    const hasDesc = String(g.description || '').trim() === GIST_DESCRIPTION;
    return hasFile || hasDesc;
  });

  if (matches.length === 0) return null;

  matches.sort(
    (a, b) =>
      (b.updated_at ? Date.parse(b.updated_at) || 0 : 0) -
      (a.updated_at ? Date.parse(a.updated_at) || 0 : 0)
  );
  return matches[0];
}

export async function pullCloudGist(token, gistId = '', { etag = '' } = {}) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) throw new Error('Paste your GitHub Personal Access Token first.');

  let targetId = String(gistId || '').trim();
  if (!targetId) {
    const found = await findVeloFuelGist(cleanToken);
    if (!found?.id) {
      return { status: 'not_found', gistId: '', envelope: null, etag: '' };
    }
    targetId = found.id;
  }

  const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(targetId)}`, {
    method: 'GET',
    headers: buildGitHubHeaders(cleanToken, { method: 'GET', etag }),
    cache: 'no-store',
  });

  if (res.status === 304) {
    return { status: 'not_modified', gistId: targetId, envelope: null, etag };
  }
  if (res.status === 404) {
    return { status: 'not_found', gistId: targetId, envelope: null, etag: '' };
  }
  if (!res.ok) {
    throw createGitHubApiError(res, 'Loading cloud backup');
  }

  const nextEtag = res.headers?.get?.('etag') || '';
  const gist = await res.json();
  const files = gist?.files || {};
  const file =
    files[GIST_FILENAME] ||
    Object.values(files).find((f) => f && String(f.filename || '').endsWith('.json'));

  if (!file) {
    return { status: 'not_found', gistId: gist.id || targetId, envelope: null, etag: nextEtag };
  }

  let rawContent = typeof file.content === 'string' ? file.content : '';
  // GitHub truncates inline file.content above 1 MB -> fetch raw_url with ZERO custom headers!
  if (file.truncated === true && file.raw_url) {
    const rawRes = await fetch(file.raw_url, { cache: 'no-store' });
    if (!rawRes.ok) {
      throw new Error(`Could not download full backup file (HTTP ${rawRes.status}).`);
    }
    rawContent = await rawRes.text();
  }

  if (!rawContent || !rawContent.trim()) {
    return { status: 'empty', gistId: gist.id || targetId, envelope: null, etag: nextEtag };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('Cloud backup file contains invalid JSON.');
  }

  const envelope = normalizeAppState(parsed, { preserveEmptyCollections: true });
  if (!envelope) {
    throw new Error('Cloud backup file is not a valid VeloFuel backup.');
  }
  // Preserve keysIncluded marker for mergeRemoteEnvelopeWithLocalSecrets
  if (parsed.keysIncluded === false) {
    envelope.keysIncluded = false;
  } else if (parsed.keysIncluded === true) {
    envelope.keysIncluded = true;
  }

  return {
    status: 'ok',
    gistId: gist.id || targetId,
    etag: nextEtag,
    updatedAt: gist.updated_at || envelope.updatedAt,
    envelope,
  };
}

export async function pushCloudGist(token, gistId = '', payload) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) throw new Error('Paste your GitHub Personal Access Token first.');
  if (!isPlainObj(payload) || Object.keys(payload).length === 0) {
    throw new Error('Refusing to upload empty backup payload.');
  }

  const safePayload = { ...payload };
  delete safePayload.githubToken;
  if (Object.keys(safePayload).length === 0) {
    throw new Error('Refusing to upload empty backup payload.');
  }

  const serialized = JSON.stringify(safePayload, null, 2);
  if (!serialized || serialized.trim().length <= 2) {
    throw new Error('Refusing to upload empty backup content.');
  }

  const targetId = String(gistId || '').trim();
  const isUpdate = Boolean(targetId);
  const url = isUpdate
    ? `https://api.github.com/gists/${encodeURIComponent(targetId)}`
    : 'https://api.github.com/gists';

  const body = isUpdate
    ? {
        description: GIST_DESCRIPTION,
        files: {
          [GIST_FILENAME]: {
            content: serialized,
          },
        },
      }
    : {
        description: GIST_DESCRIPTION,
        public: false,
        files: {
          [GIST_FILENAME]: {
            content: serialized,
          },
        },
      };

  const res = await fetch(url, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: buildGitHubHeaders(cleanToken, { method: isUpdate ? 'PATCH' : 'POST' }),
    cache: 'no-store',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw createGitHubApiError(res, isUpdate ? 'Updating cloud backup' : 'Creating cloud backup');
  }

  const data = await res.json();
  return {
    ok: true,
    gistId: data?.id || targetId,
    updatedAt: data?.updated_at || new Date().toISOString(),
    etag: res.headers?.get?.('etag') || '',
  };
}

function isRemoteStrictlyNewer(remoteEnv, localEnv) {
  const rRev = Number(remoteEnv?.revision) || 0;
  const lRev = Number(localEnv?.revision) || 0;
  if (rRev !== lRev) return rRev > lRev;
  const rTs = remoteEnv?.updatedAt ? Date.parse(remoteEnv.updatedAt) || 0 : 0;
  const lTs = localEnv?.updatedAt ? Date.parse(localEnv.updatedAt) || 0 : 0;
  return rTs > lTs;
}

function isLocalStrictlyNewer(localEnv, remoteEnv) {
  const rRev = Number(remoteEnv?.revision) || 0;
  const lRev = Number(localEnv?.revision) || 0;
  if (lRev !== rRev) return lRev > rRev;
  const rTs = remoteEnv?.updatedAt ? Date.parse(remoteEnv.updatedAt) || 0 : 0;
  const lTs = localEnv?.updatedAt ? Date.parse(localEnv.updatedAt) || 0 : 0;
  return lTs > rTs;
}

// Strict Never-Clobber-Cloud Reconciliation:
// Always inspects remote first; NEVER overwrites non-empty cloud data with empty/demo defaults.
export async function reconcileCloudSync({
  localEnvelope,
  cloudConfig,
  allowCreate = true,
  preferRemoteOnEmpty = true,
  forcePushIfLocalHasData = false,
  useEtag = false,
}) {
  const cfg = cloudConfig || loadCloudConfig();
  const token = String(cfg.githubToken || '').trim();
  if (!token) return { action: 'unconfigured', gistId: '' };

  if (cfg.rateLimitResetAt && Date.now() < cfg.rateLimitResetAt) {
    return { action: 'rate_limited', gistId: cfg.gistId || '' };
  }

  const localHasData = Boolean(
    localEnvelope && localEnvelope.hasUserData && !localEnvelope.isDemoMode
  );

  // Step 1: Always check remote first!
  const pullRes = await pullCloudGist(token, cfg.gistId || '', {
    etag: useEtag ? cfg.etag || '' : '',
  });

  if (pullRes.status === 'not_modified') {
    // Remote unchanged since last sync — push only if local has newer user changes
    const localRev = Number(localEnvelope?.revision) || 0;
    const syncedRev = Number(cfg.lastSyncedRevision) || 0;
    if (localHasData && (localRev > syncedRev || forcePushIfLocalHasData)) {
      const payload = prepareCloudPayload(localEnvelope, {
        syncThirdPartyKeys: Boolean(cfg.syncThirdPartyKeys),
      });
      const pushRes = await pushCloudGist(token, pullRes.gistId, payload);
      return {
        action: 'pushed',
        gistId: pushRes.gistId,
        updatedAt: pushRes.updatedAt,
        etag: pushRes.etag,
        revision: localRev,
      };
    }
    return { action: 'noop', gistId: pullRes.gistId, etag: pullRes.etag };
  }

  if (pullRes.status === 'not_found' && cfg.gistId) {
    const err = new Error(
      'Linked Backup Gist was not found (deleted on GitHub or token lacks "gist" permission). Clear the Gist ID in Sync to start a new backup.'
    );
    err.status = 404;
    throw err;
  }

  const remoteEnv = pullRes.status === 'ok' ? pullRes.envelope : null;
  const remoteHasData = Boolean(remoteEnv && remoteEnv.hasUserData && !remoteEnv.isDemoMode);
  const resolvedGistId = pullRes.status === 'ok' || pullRes.status === 'empty' ? pullRes.gistId || '' : '';

  // Step 2: NEVER clobber non-empty cloud data with an empty or demo local browser!
  if (remoteHasData) {
    if (preferRemoteOnEmpty && !localHasData) {
      const merged = mergeRemoteEnvelopeWithLocalSecrets(remoteEnv, localEnvelope);
      return {
        action: 'pulled',
        remoteEnvelope: merged,
        gistId: resolvedGistId,
        updatedAt: pullRes.updatedAt,
        etag: pullRes.etag,
      };
    }
    if (isRemoteStrictlyNewer(remoteEnv, localEnvelope)) {
      const merged = mergeRemoteEnvelopeWithLocalSecrets(remoteEnv, localEnvelope);
      return {
        action: 'pulled',
        remoteEnvelope: merged,
        gistId: resolvedGistId,
        updatedAt: pullRes.updatedAt,
        etag: pullRes.etag,
      };
    }
    if (localHasData && (isLocalStrictlyNewer(localEnvelope, remoteEnv) || forcePushIfLocalHasData)) {
      const payload = prepareCloudPayload(localEnvelope, {
        syncThirdPartyKeys: Boolean(cfg.syncThirdPartyKeys),
      });
      const pushRes = await pushCloudGist(token, resolvedGistId, payload);
      return {
        action: 'pushed',
        gistId: pushRes.gistId,
        updatedAt: pushRes.updatedAt,
        etag: pushRes.etag,
        revision: Number(localEnvelope.revision) || 1,
      };
    }
    return { action: 'noop', gistId: resolvedGistId, etag: pullRes.etag };
  }

  // Step 3: No non-empty cloud backup exists yet -> create or update only if local has real user data
  if (localHasData && (allowCreate || resolvedGistId)) {
    const payload = prepareCloudPayload(localEnvelope, {
      syncThirdPartyKeys: Boolean(cfg.syncThirdPartyKeys),
    });
    const pushRes = await pushCloudGist(token, resolvedGistId, payload);
    return {
      action: 'pushed',
      gistId: pushRes.gistId,
      updatedAt: pushRes.updatedAt,
      etag: pushRes.etag,
      revision: Number(localEnvelope.revision) || 1,
    };
  }

  if (!localHasData && !remoteHasData) {
    return {
      action: 'noop',
      reason: localEnvelope?.isDemoMode ? 'demo_mode' : 'empty_local',
      gistId: '',
      etag: '',
    };
  }

  return { action: 'noop', gistId: resolvedGistId, etag: pullRes.etag || '' };
}

// Serialized single-flight queue so rapid edits never send concurrent PATCHes
export function createSingleFlightQueue() {
  let chain = Promise.resolve();
  return function enqueue(taskFn) {
    const run = chain.then(() => taskFn());
    chain = run.catch(() => {});
    return run;
  };
}
