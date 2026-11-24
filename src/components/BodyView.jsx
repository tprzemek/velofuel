import { useRef, useState } from 'react';
import { Scale, Upload, TrendingDown, ShieldCheck, Activity, Check } from 'lucide-react';
import { getIsoDate } from '../engine/defaultData';
import { parseWithingsCsv } from '../engine/biometricsEngine';
import { displayToKg, formatWeight, formatWeightRate, kgToDisplay } from '../engine/units';
import NumericInput from './NumericInput';

function WeightTrendChart({ series, units }) {
  if (!series || series.length < 2) {
    return <p className="muted-text">Add at least 2 morning weigh-ins to visualize your 7-day trend.</p>;
  }
  const u = units?.weight || 'kg';
  const recent = series.slice(-21).map((d) => ({
    ...d,
    dispW: kgToDisplay(d.weightKg, units),
    dispTrend: kgToDisplay(d.trendWeightKg, units),
  }));
  const weights = recent.flatMap((d) => [d.dispW, d.dispTrend]);
  const margin = u === 'lbs' ? 0.9 : 0.4;
  const minW = Math.min(...weights) - margin;
  const maxW = Math.max(...weights) + margin;
  const range = Math.max(u === 'lbs' ? 1.8 : 0.8, maxW - minW);

  const width = 440;
  const height = 148;
  const padX = 34;
  const padY = 18;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const xAt = (i) => padX + (i / Math.max(1, recent.length - 1)) * plotW;
  const yAt = (w) => padY + ((maxW - w) / range) * plotH;

  const trendPath = recent
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(pt.dispTrend).toFixed(1)}`)
    .join(' ');

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="150" role="img" aria-label="Morning weight and 7-day trend chart">
        {[0, 0.5, 1].map((frac) => {
          const y = padY + frac * plotH;
          const label = (maxW - frac * range).toFixed(1);
          return (
            <g key={frac}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="rgba(20,24,28,0.08)" strokeDasharray="3 3" />
              <text x={2} y={y + 3} fontSize="9.5" fill="#7D8690" fontFamily="JetBrains Mono, monospace">
                {label}
              </text>
            </g>
          );
        })}

        <path d={trendPath} fill="none" stroke="#147A53" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />

        {recent.map((pt, i) => (
          <circle
            key={pt.date}
            cx={xAt(i)}
            cy={yAt(pt.dispW)}
            r="3.4"
            fill="#FFFFFF"
            stroke="#14181C"
            strokeWidth="1.6"
          >
            <title>{`${pt.date}: ${pt.dispW} ${u} (7d avg ${pt.dispTrend} ${u})`}</title>
          </circle>
        ))}

        <text x={padX} y={height - 3} fontSize="9" fill="#7D8690" fontFamily="JetBrains Mono, monospace">
          {recent[0].date.slice(5)}
        </text>
        <text x={width - padX - 28} y={height - 3} fontSize="9" fill="#7D8690" fontFamily="JetBrains Mono, monospace">
          {recent[recent.length - 1].date.slice(5)}
        </text>
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 2 }}>
        <span>● Raw Morning Scale ({u})</span>
        <span style={{ color: 'var(--code-high)', fontWeight: 700 }}>— 7-Day Average Trend (Drives Daily Targets)</span>
      </div>
    </div>
  );
}

export default function BodyView({
  profile,
  units,
  biometricsSummary,
  weeklyCheckIn = null,
  onUpdateProfile,
  onAddBiometric,
  onImportBiometrics,
  showToast,
}) {
  const weightUnit = units?.weight || 'kg';
  const [date, setDate] = useState(getIsoDate(0));
  const [weightInput, setWeightInput] = useState(kgToDisplay(biometricsSummary.latestWeightKg, units));
  const [bfInput, setBfInput] = useState(biometricsSummary.latestBodyFatPct);
  const csvRef = useRef(null);

  const handleLogMorning = (e) => {
    e.preventDefault();
    const rawW = Number(weightInput);
    const bf = bfInput === '' || bfInput == null ? NaN : Number(bfInput);
    const weightKg = displayToKg(rawW, units);
    if (Number.isNaN(weightKg) || weightKg < 35 || weightKg > 180) return;
    onAddBiometric({
      date,
      weightKg,
      bodyFatPct: !Number.isNaN(bf) && bf > 3 && bf < 55 ? Number(bf.toFixed(1)) : null,
      restingHr: biometricsSummary.latestRestingHr,
      hrv: biometricsSummary.latestHrv,
      source: 'manual',
    });
    showToast(`Saved morning weigh-in (${formatWeight(weightKg, units)})`);
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseWithingsCsv(String(reader.result || ''));
      if (parsed.length === 0) {
        showToast('No valid rows found in CSV. Export weight.csv from Withings web.');
        return;
      }
      onImportBiometrics(parsed);
      showToast(`Imported ${parsed.length} Withings scale readings!`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const wPerKg = Number((profile.ftp / Math.max(biometricsSummary.trendWeightKg, 45)).toFixed(2));
  const hasExtendedScaleMetrics =
    biometricsSummary.latestMuscleMassKg != null ||
    biometricsSummary.latestHydrationKg != null ||
    biometricsSummary.latestBoneMassKg != null;

  return (
    <>
      {/* Goal Mode & Smart Weight Loss Controller */}
      <section className="card">
        <div className="section-header">
          <div>
            <h1 className="section-title" style={{ fontSize: '1.08rem' }}>Body Composition &amp; Cut Coach</h1>
            <p className="muted-text" style={{ marginTop: 3 }}>
              Lose fat on Rest/Easy days while keeping protein high and hard rides 100% fueled.
            </p>
          </div>
          <span className="carb-badge high mono">{wPerKg} W/kg</span>
        </div>

        <div className="segmented" style={{ marginTop: 10 }}>
          {[
            { id: 'cut', label: 'Lean Cut' },
            { id: 'maintain', label: 'Maintain' },
            { id: 'carb_load', label: 'Carb Load' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`seg-btn ${profile.goalMode === mode.id ? 'active' : ''}`}
              onClick={() => onUpdateProfile({ goalMode: mode.id })}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {profile.goalMode === 'cut' && (
          <div className="range-row" style={{ marginTop: 14 }}>
            <div className="range-head">
              <span style={{ fontWeight: 700 }}>Target Fat-Loss Pace</span>
              <strong className="mono" style={{ color: 'var(--code-high)' }}>
                {formatWeightRate(-profile.targetLossKgPerWeek, units)}
              </strong>
            </div>
            <input
              type="range"
              min={0.15}
              max={0.55}
              step={0.05}
              value={profile.targetLossKgPerWeek}
              onChange={(e) => onUpdateProfile({ targetLossKgPerWeek: Number(e.target.value) })}
            />
            <p className="muted-text" style={{ fontSize: '0.73rem' }}>
              Sweet spot: <strong>{weightUnit === 'lbs' ? '0.55–0.90 lbs/wk' : '0.25–0.40 kg/wk'}</strong> (daily deficit capped ≤600 kcal on rest days, paused on key sessions).
            </p>
            {biometricsSummary.latestBodyFatPct <= (profile.sex === 'female' ? 16.5 : 8.5) && (
              <div className="notice-strip" style={{ marginTop: 6 }}>
                <span>
                  <strong>Lean Floor Caution:</strong> At {biometricsSummary.latestBodyFatPct.toFixed(1)}% body fat, further cutting often impairs recovery &amp; hormones even when calories look adequate. Consider switching to <strong>Maintain</strong>.
                </span>
              </div>
            )}
          </div>
        )}

        {profile.goalMode === 'carb_load' && (
          <p className="muted-text" style={{ marginTop: 12, fontSize: '0.75rem' }}>
            <strong>24-Hour Race Carb Load:</strong> One focused day (~10 g/kg carbs, low fat &amp; low fiber) after a short opener spin fills your energy stores without multi-day heaviness.
          </p>
        )}
      </section>

      {/* Withings Morning Telemetry & 7-Day Average Chart */}
      <section className="card">
        <div className="section-header">
          <h2 className="section-title">Withings Morning Weigh-Ins</h2>
          <span className="section-kicker">Direct Withings · Intervals.icu · CSV</span>
        </div>

        <div className="stat-pair-grid">
          <div className="stat-box">
            <div className="stat-box-label">7-Day Average Weight</div>
            <div className="stat-box-num mono">{formatWeight(biometricsSummary.trendWeightKg, units)}</div>
            <div className="stat-box-sub mono">
              Today: {formatWeight(biometricsSummary.latestWeightKg, units)} ·{' '}
              <span style={{ color: biometricsSummary.weeklyRateKg <= 0 ? 'var(--code-high)' : 'var(--code-med)' }}>
                {formatWeightRate(biometricsSummary.weeklyRateKg, units)}
              </span>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-box-label">Lean Mass (Muscle)</div>
            <div className="stat-box-num mono">{formatWeight(biometricsSummary.leanMassKg, units)}</div>
            <div className="stat-box-sub mono">
              Body fat {biometricsSummary.latestBodyFatPct.toFixed(1)}% ·{' '}
              {biometricsSummary.leanMassDeltaKg >= -0.15
                ? 'Protected'
                : formatWeight(biometricsSummary.leanMassDeltaKg, units)}
            </div>
          </div>
        </div>

        {hasExtendedScaleMetrics && (
          <div className="on-bike-grid" style={{ marginTop: 10 }}>
            {biometricsSummary.latestMuscleMassKg != null && (
              <div className="mini-stat">
                <div className="mini-stat-label">Muscle Mass</div>
                <div className="mini-stat-val mono">{formatWeight(biometricsSummary.latestMuscleMassKg, units)}</div>
              </div>
            )}
            {biometricsSummary.latestHydrationKg != null && (
              <div className="mini-stat">
                <div className="mini-stat-label">Body Water</div>
                <div className="mini-stat-val mono">{formatWeight(biometricsSummary.latestHydrationKg, units)}</div>
              </div>
            )}
            {biometricsSummary.latestBoneMassKg != null && (
              <div className="mini-stat">
                <div className="mini-stat-label">Bone Mass</div>
                <div className="mini-stat-val mono">{formatWeight(biometricsSummary.latestBoneMassKg, units)}</div>
              </div>
            )}
          </div>
        )}

        {(biometricsSummary.latestRestingHr || biometricsSummary.latestHrv) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: '0.75rem', color: 'var(--ink-secondary)' }} className="mono">
            {biometricsSummary.latestRestingHr && (
              <span><Activity size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Resting HR {biometricsSummary.latestRestingHr} bpm</span>
            )}
            {biometricsSummary.latestHrv && <span>· HRV {biometricsSummary.latestHrv} ms</span>}
          </div>
        )}

        <WeightTrendChart series={biometricsSummary.series} units={units} />
      </section>

      {/* Intake-Aware Smart Weekly Calorie Check-In */}
      {weeklyCheckIn && (
        <section className="card" aria-label="Weekly Calorie Check-In">
          <div className="section-header" style={{ flexWrap: 'wrap', gap: 6 }}>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {weeklyCheckIn.status === 'on_track' ? (
                <ShieldCheck size={16} color="var(--code-high)" />
              ) : (
                <TrendingDown size={16} color="var(--code-med)" />
              )}
              Weekly Calorie Check-In
            </h2>
            <span
              className={`carb-badge ${
                weeklyCheckIn.status === 'on_track'
                  ? 'high'
                  : weeklyCheckIn.status === 'ready'
                  ? 'med'
                  : 'low'
              }`}
            >
              {weeklyCheckIn.statusLabel}
            </span>
          </div>

          <p className="muted-text" style={{ fontSize: '0.73rem', marginBottom: 10 }}>
            Compares what you actually logged against your 7-day weight trend — no guilt on high days, and skipped or partial days are ignored automatically.
          </p>

          <div className="on-bike-grid" style={{ marginBottom: 10 }}>
            <div className="mini-stat">
              <div className="mini-stat-label">Avg Logged</div>
              <div className="mini-stat-val mono">
                {weeklyCheckIn.avgLoggedKcal != null ? `${weeklyCheckIn.avgLoggedKcal.toLocaleString()} kcal` : '—'}
              </div>
            </div>
            <div className="mini-stat">
              <div className="mini-stat-label">7-Day Weight Trend</div>
              <div className="mini-stat-val mono">
                {formatWeightRate(weeklyCheckIn.weeklyRateKg, units)}
              </div>
            </div>
            <div className="mini-stat">
              <div className="mini-stat-label">Estimated Daily Burn</div>
              <div className="mini-stat-val mono">
                {weeklyCheckIn.estimatedDailyBurn != null ? `${weeklyCheckIn.estimatedDailyBurn.toLocaleString()} kcal` : '—'}
              </div>
            </div>
          </div>

          <p className="muted-text">{weeklyCheckIn.message}</p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 8,
              fontSize: '0.7rem',
              color: 'var(--ink-muted)',
            }}
            className="mono"
          >
            <span>
              {weeklyCheckIn.completeDays} complete food day{weeklyCheckIn.completeDays === 1 ? '' : 's'}
              {weeklyCheckIn.partialDaysSkipped > 0
                ? ` · ${weeklyCheckIn.partialDaysSkipped} partial day${weeklyCheckIn.partialDaysSkipped === 1 ? '' : 's'} skipped`
                : ''}
            </span>
            <span>
              Budget offset: {profile.tdeeAdjustmentKcal >= 0 ? '+' : ''}
              {profile.tdeeAdjustmentKcal || 0} kcal
              {profile.lastCheckInDate ? ` · Checked ${profile.lastCheckInDate.slice(5)}` : ''}
            </span>
          </div>

          {weeklyCheckIn.suggestedAdjustmentKcal !== 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  const delta = weeklyCheckIn.suggestedAdjustmentKcal;
                  onUpdateProfile({
                    tdeeAdjustmentKcal: (profile.tdeeAdjustmentKcal || 0) + delta,
                    lastCheckInDate: getIsoDate(0),
                  });
                  showToast(
                    `Updated daily calorie budget by ${delta > 0 ? '+' : ''}${delta} kcal/day`
                  );
                }}
              >
                <Check size={14} /> Apply {weeklyCheckIn.suggestedAdjustmentKcal > 0 ? '+' : ''}
                {weeklyCheckIn.suggestedAdjustmentKcal} kcal/day
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  onUpdateProfile({ lastCheckInDate: getIsoDate(0) });
                  showToast('Kept your current daily calorie budget.');
                }}
              >
                Keep Current Budget
              </button>
            </div>
          )}
        </section>
      )}

      {/* Quick Morning Entry + Withings CSV Import */}
      <section className="card">
        <div className="section-header">
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Scale size={15} /> Log Morning Weigh-In or Withings CSV
          </h2>
        </div>

        <form onSubmit={handleLogMorning}>
          <div className="field-grid">
            <div className="field full">
              <label htmlFor="bio-date">Date</label>
              <input id="bio-date" type="date" className="input mono" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bio-weight">Weight ({weightUnit})</label>
              <NumericInput
                id="bio-weight"
                step={0.1}
                min={weightUnit === 'lbs' ? 75 : 35}
                max={weightUnit === 'lbs' ? 400 : 180}
                fallback={kgToDisplay(biometricsSummary.latestWeightKg, units)}
                className="input mono"
                value={weightInput}
                onChange={setWeightInput}
              />
            </div>
            <div className="field">
              <label htmlFor="bio-bf">Body Fat % (optional)</label>
              <NumericInput
                id="bio-bf"
                step={0.1}
                min={3}
                max={55}
                allowEmpty
                className="input mono"
                value={bfInput}
                onChange={setBfInput}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Save Weigh-In
            </button>
            <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleCsvUpload} />
            <button type="button" className="btn" onClick={() => csvRef.current?.click()}>
              <Upload size={14} /> Withings CSV
            </button>
          </div>
        </form>
        <p className="muted-text" style={{ marginTop: 8, fontSize: '0.73rem' }}>
          Tip: Connect your Withings scale directly on the <strong>Sync</strong> tab to automatically pull Body Fat %, Muscle Mass, Body Water, and Bone Mass every morning — or upload a Withings <code>weight.csv</code> export anytime.
        </p>
      </section>
    </>
  );
}
