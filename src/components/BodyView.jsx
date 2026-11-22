import { useRef, useState } from 'react';
import { Scale, Upload, TrendingDown, ShieldCheck, Activity, Check } from 'lucide-react';
import { getIsoDate } from '../engine/defaultData';
import { parseWithingsCsv } from '../engine/biometricsEngine';

function WeightTrendChart({ series }) {
  if (!series || series.length < 2) {
    return <p className="muted-text">Add at least 2 morning weigh-ins to visualize your 7-day trend.</p>;
  }
  const recent = series.slice(-21);
  const weights = recent.flatMap((d) => [d.weightKg, d.trendWeightKg]);
  const minW = Math.min(...weights) - 0.4;
  const maxW = Math.max(...weights) + 0.4;
  const range = Math.max(0.8, maxW - minW);

  const width = 440;
  const height = 148;
  const padX = 28;
  const padY = 18;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const xAt = (i) => padX + (i / Math.max(1, recent.length - 1)) * plotW;
  const yAt = (w) => padY + ((maxW - w) / range) * plotH;

  const trendPath = recent
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(pt.trendWeightKg).toFixed(1)}`)
    .join(' ');

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="150" role="img" aria-label="Morning weight and 7-day trend chart">
        {/* Horizontal guide lines */}
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

        {/* 7-day EMA trend line */}
        <path d={trendPath} fill="none" stroke="#147A53" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />

        {/* Raw morning Withings scale dots */}
        {recent.map((pt, i) => (
          <circle
            key={pt.date}
            cx={xAt(i)}
            cy={yAt(pt.weightKg)}
            r="3.4"
            fill="#FFFFFF"
            stroke="#14181C"
            strokeWidth="1.6"
          >
            <title>{`${pt.date}: ${pt.weightKg}kg (7d trend ${pt.trendWeightKg}kg)`}</title>
          </circle>
        ))}

        {/* X labels */}
        <text x={padX} y={height - 3} fontSize="9" fill="#7D8690" fontFamily="JetBrains Mono, monospace">
          {recent[0].date.slice(5)}
        </text>
        <text x={width - padX - 28} y={height - 3} fontSize="9" fill="#7D8690" fontFamily="JetBrains Mono, monospace">
          {recent[recent.length - 1].date.slice(5)}
        </text>
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 2 }}>
        <span>● Raw Morning Scale</span>
        <span style={{ color: 'var(--code-high)', fontWeight: 700 }}>— 7-Day Average Trend (Drives Daily Targets)</span>
      </div>
    </div>
  );
}

export default function BodyView({
  profile,
  biometricsSummary,
  onUpdateProfile,
  onAddBiometric,
  onImportBiometrics,
  showToast,
}) {
  const [date, setDate] = useState(getIsoDate(0));
  const [weightInput, setWeightInput] = useState(biometricsSummary.latestWeightKg);
  const [bfInput, setBfInput] = useState(biometricsSummary.latestBodyFatPct);
  const csvRef = useRef(null);

  const handleLogMorning = (e) => {
    e.preventDefault();
    const w = parseFloat(weightInput);
    const bf = parseFloat(bfInput);
    if (Number.isNaN(w) || w < 35 || w > 180) return;
    onAddBiometric({
      date,
      weightKg: Number(w.toFixed(2)),
      bodyFatPct: !Number.isNaN(bf) && bf > 3 && bf < 55 ? Number(bf.toFixed(1)) : null,
      restingHr: biometricsSummary.latestRestingHr,
      hrv: biometricsSummary.latestHrv,
      source: 'manual',
    });
    showToast(`Saved morning weigh-in (${w.toFixed(1)} kg)`);
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

  return (
    <>
      {/* Goal Mode & Smart Weight Loss Controller */}
      <section className="card">
        <div className="section-header">
          <div>
            <h1 className="section-title" style={{ fontSize: '1.08rem' }}>Body Composition & Cut Coach</h1>
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
                -{profile.targetLossKgPerWeek.toFixed(2)} kg / week
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
              Sweet spot: <strong>0.25–0.40 kg/wk</strong> (daily deficit capped ≤600 kcal on rest days, paused on key sessions).
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
          <span className="section-kicker">Synced via Intervals.icu / CSV</span>
        </div>

        <div className="stat-pair-grid">
          <div className="stat-box">
            <div className="stat-box-label">7-Day Average Weight</div>
            <div className="stat-box-num mono">{biometricsSummary.trendWeightKg.toFixed(1)} kg</div>
            <div className="stat-box-sub mono">
              Today: {biometricsSummary.latestWeightKg.toFixed(1)} kg ·{' '}
              <span style={{ color: biometricsSummary.weeklyRateKg <= 0 ? 'var(--code-high)' : 'var(--code-med)' }}>
                {biometricsSummary.weeklyRateKg > 0 ? '+' : ''}{biometricsSummary.weeklyRateKg} kg/wk
              </span>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-box-label">Lean Mass (Muscle)</div>
            <div className="stat-box-num mono">{biometricsSummary.leanMassKg.toFixed(1)} kg</div>
            <div className="stat-box-sub mono">
              Body fat {biometricsSummary.latestBodyFatPct.toFixed(1)}% ·{' '}
              {biometricsSummary.leanMassDeltaKg >= -0.15 ? 'Protected' : `${biometricsSummary.leanMassDeltaKg} kg`}
            </div>
          </div>
        </div>

        {(biometricsSummary.latestRestingHr || biometricsSummary.latestHrv) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: '0.75rem', color: 'var(--ink-secondary)' }} className="mono">
            {biometricsSummary.latestRestingHr && (
              <span><Activity size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Resting HR {biometricsSummary.latestRestingHr} bpm</span>
            )}
            {biometricsSummary.latestHrv && <span>· HRV {biometricsSummary.latestHrv} ms</span>}
          </div>
        )}

        <WeightTrendChart series={biometricsSummary.series} />
      </section>

      {/* Daily Burn Auto-Check */}
      {biometricsSummary.tdeeSuggestion && (
        <section className="card">
          <div className="section-header">
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {biometricsSummary.tdeeSuggestion.type === 'ontrack' ? (
                <ShieldCheck size={16} color="var(--code-high)" />
              ) : (
                <TrendingDown size={16} color="var(--code-med)" />
              )}
              Daily Burn Auto-Check
            </h2>
            <span className="section-kicker mono">
              Adjust {profile.tdeeAdjustmentKcal >= 0 ? '+' : ''}{profile.tdeeAdjustmentKcal} kcal
            </span>
          </div>
          <p className="muted-text" style={{ marginBottom: 4, fontSize: '0.73rem', opacity: 0.85 }}>
            Compares your real scale trend against your weekly goal and nudges your daily calorie budget if needed.
          </p>
          <p className="muted-text">{biometricsSummary.tdeeSuggestion.message}</p>
          {biometricsSummary.tdeeSuggestion.deltaKcal !== 0 && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              style={{ marginTop: 10 }}
              onClick={() => {
                onUpdateProfile({
                  tdeeAdjustmentKcal: (profile.tdeeAdjustmentKcal || 0) + biometricsSummary.tdeeSuggestion.deltaKcal,
                });
                showToast(`Adjusted daily calorie budget by ${biometricsSummary.tdeeSuggestion.deltaKcal > 0 ? '+' : ''}${biometricsSummary.tdeeSuggestion.deltaKcal} kcal`);
              }}
            >
              <Check size={14} /> Apply {biometricsSummary.tdeeSuggestion.deltaKcal > 0 ? '+' : ''}
              {biometricsSummary.tdeeSuggestion.deltaKcal} kcal Adjustment
            </button>
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
              <label htmlFor="bio-weight">Weight (kg)</label>
              <input
                id="bio-weight"
                type="number"
                step="0.1"
                className="input mono"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="bio-bf">Body Fat % (optional)</label>
              <input
                id="bio-bf"
                type="number"
                step="0.1"
                className="input mono"
                value={bfInput}
                onChange={(e) => setBfInput(e.target.value)}
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
          Tip: If Intervals.icu syncs your Withings weight via Google Health without body fat %, drop in a Withings{' '}
          <code>weight.csv</code> export anytime to unlock Lean Mass tracking.
        </p>
      </section>
    </>
  );
}
