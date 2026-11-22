// Direct Browser Withings Smart Scale Client (OAuth2 + Measure API)
// wbsapi.withings.net allows direct browser CORS, enabling full scale metrics on GitHub Pages without a backend:
// Weight (1), Fat-Free / Lean Mass (5), Fat Ratio % (6), Fat Mass (8), Heart Rate (11), Muscle Mass (76), Hydration (77), Bone Mass (88)

export function buildWithingsAuthUrl({ clientId, redirectUri }) {
  const state = `vf_${Date.now()}`;
  try {
    sessionStorage.setItem('vf_withings_oauth_state', state);
  } catch {
    // ignore storage errors
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    scope: 'user.metrics',
    state,
  });
  return `https://account.withings.com/oauth2_user/authorize2?${params.toString()}`;
}

export async function exchangeWithingsCode({ clientId, clientSecret, code, redirectUri }) {
  const body = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'authorization_code',
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    code: code.trim(),
    redirect_uri: redirectUri,
  });
  const resp = await fetch('https://wbsapi.withings.net/v2/oauth2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await resp.json();
  if (data.status !== 0 || !data.body?.access_token) {
    throw new Error(data.error || `Withings token error (status ${data.status})`);
  }
  return {
    accessToken: data.body.access_token,
    refreshToken: data.body.refresh_token,
    expiresAt: Date.now() + (Number(data.body.expires_in) || 10800) * 1000,
    userId: data.body.userid,
  };
}

export async function refreshWithingsToken({ clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'refresh_token',
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    refresh_token: refreshToken,
  });
  const resp = await fetch('https://wbsapi.withings.net/v2/oauth2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await resp.json();
  if (data.status !== 0 || !data.body?.access_token) {
    throw new Error(data.error || `Withings refresh failed (status ${data.status})`);
  }
  return {
    accessToken: data.body.access_token,
    refreshToken: data.body.refresh_token,
    expiresAt: Date.now() + (Number(data.body.expires_in) || 10800) * 1000,
  };
}

export async function fetchWithingsMeasurements(withingsConfig, daysBack = 30) {
  let { accessToken, refreshToken, expiresAt } = withingsConfig;
  let updatedTokens = null;

  if (!accessToken && !refreshToken) {
    throw new Error('Withings is not connected yet.');
  }

  if ((!accessToken || (expiresAt && Date.now() > expiresAt - 120000)) && refreshToken) {
    updatedTokens = await refreshWithingsToken({
      clientId: withingsConfig.clientId,
      clientSecret: withingsConfig.clientSecret,
      refreshToken,
    });
    accessToken = updatedTokens.accessToken;
  }

  const startDate = Math.floor((Date.now() - daysBack * 86400000) / 1000);
  const body = new URLSearchParams({
    action: 'getmeas',
    meastypes: '1,5,6,8,11,76,77,88',
    category: '1',
    startdate: String(startDate),
  });

  const resp = await fetch('https://wbsapi.withings.net/measure', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = await resp.json();
  if (data.status !== 0) {
    throw new Error(data.error || `Withings API error (status ${data.status})`);
  }

  const groups = Array.isArray(data.body?.measuregrps) ? data.body.measuregrps : [];
  const byDate = new Map();

  for (const grp of groups) {
    const dt = new Date((grp.date || 0) * 1000);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const existing = byDate.get(iso) || { date: iso, source: 'withings-direct' };

    for (const m of grp.measures || []) {
      const val = m.value * Math.pow(10, m.unit);
      if (m.type === 1 && existing.weightKg == null) existing.weightKg = Number(val.toFixed(2));
      if (m.type === 5 && existing.fatFreeMassKg == null) existing.fatFreeMassKg = Number(val.toFixed(2));
      if (m.type === 6 && existing.bodyFatPct == null) existing.bodyFatPct = Number(val.toFixed(1));
      if (m.type === 8 && existing.fatMassKg == null) existing.fatMassKg = Number(val.toFixed(2));
      if (m.type === 11 && existing.restingHr == null) existing.restingHr = Math.round(val);
      if (m.type === 76 && existing.muscleMassKg == null) existing.muscleMassKg = Number(val.toFixed(2));
      if (m.type === 77 && existing.hydrationKg == null) existing.hydrationKg = Number(val.toFixed(2));
      if (m.type === 88 && existing.boneMassKg == null) existing.boneMassKg = Number(val.toFixed(2));
    }

    if (existing.weightKg != null) {
      byDate.set(iso, existing);
    }
  }

  return {
    biometrics: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
    updatedTokens,
  };
}
