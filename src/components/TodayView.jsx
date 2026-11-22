import { useState } from 'react';
import {
  Bike,
  CheckCircle2,
  Flame,
  Scale,
  Camera,
  Trash2,
  Droplets,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Zap,
  ScanBarcode,
  Pill,
  BookmarkPlus,
  Sparkles,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { BOTTLE_SIZE_OPTIONS, scaleStapleToTargets, sumDailyLogs } from '../engine/fuelingEngine';
import { formatLiquid, formatSodiumPractical } from '../engine/units';
import NumericInput from './NumericInput';

export default function TodayView({
  plan,
  profile,
  units,
  session,
  logs,
  staples = [],
  supplements = [],
  biometricsSummary,
  hasIntervalsConnected = false,
  bgSyncing = false,
  onResyncNow,
  onOpenStapleModal,
  onOpenQuickFoodModal,
  onOpenWorkModal,
  onOpenSupplementsModal,
  onQuickLogStaple,
  onSaveSlotAsStaple,
  onLogDailyStack,
  onSetRideBottleSize,
  onDeleteLog,
  onLogOnBike,
  onSaveOnBikeLog,
  onCompleteRide,
  onNavigateTab,
}) {
  const existingOnBikeLog = logs.find((l) => l.slot === 'on_bike' && l.type === 'on_bike') || null;
  const loggedOnBikeCarbs = logs
    .filter((l) => l.slot === 'on_bike')
    .reduce((sum, l) => sum + (Number(l.carbs) || 0), 0);

  const [editingActual, setEditingActual] = useState(false);
  const [actualKjInput, setActualKjInput] = useState(session?.actualKj || plan.exerciseKj || 0);
  const [actualMinInput, setActualMinInput] = useState(session?.durationMin || 60);
  const [actualRideCarbsInput, setActualRideCarbsInput] = useState(
    existingOnBikeLog?.carbs ?? plan.onBikePlan?.totalCarbs ?? 0
  );
  const [syncRideCarbsOnComplete, setSyncRideCarbsOnComplete] = useState(true);

  const [editingOnBike, setEditingOnBike] = useState(false);
  const [editingOnBikeId, setEditingOnBikeId] = useState(null);
  const [onBikeCarbsInput, setOnBikeCarbsInput] = useState(plan.onBikePlan?.totalCarbs ?? 0);
  const [onBikeSodiumInput, setOnBikeSodiumInput] = useState(plan.onBikePlan?.totalSodiumMg ?? 0);
  const [onBikeBottlesInput, setOnBikeBottlesInput] = useState(plan.onBikePlan?.bottles ?? 1);

  const totals = sumDailyLogs(logs);
  const remaining = {
    kcal: plan.targets.kcal - totals.kcal,
    carbs: plan.targets.carbs - totals.carbs,
    protein: plan.targets.protein - totals.protein,
    fat: plan.targets.fat - totals.fat,
    carbUncertainty: totals.carbUncertainty,
    kcalUncertainty: totals.kcalUncertainty,
  };

  const pct = (val, target) => Math.min(100, Math.max(0, Math.round((val / Math.max(target, 1)) * 100)));

  const openOnBikeEditor = (entry = null) => {
    setEditingOnBikeId(entry?.id || existingOnBikeLog?.id || null);
    setOnBikeCarbsInput(entry?.carbs ?? existingOnBikeLog?.carbs ?? plan.onBikePlan?.totalCarbs ?? 0);
    setOnBikeSodiumInput(
      entry?.micros?.sodium ?? existingOnBikeLog?.micros?.sodium ?? plan.onBikePlan?.totalSodiumMg ?? 0
    );
    setOnBikeBottlesInput(entry?.bottles ?? existingOnBikeLog?.bottles ?? plan.onBikePlan?.bottles ?? 1);
    setEditingOnBike(true);
  };

  const handleSaveOnBikeCustom = (e) => {
    e.preventDefault();
    const carbs = Math.max(0, Math.round(Number(onBikeCarbsInput) || 0));
    const sodiumMg = Math.max(0, Math.round(Number(onBikeSodiumInput) || 0));
    const bottles = Math.max(0, Number(onBikeBottlesInput) || 0);
    onSaveOnBikeLog({
      existingId: editingOnBikeId,
      carbs,
      sodiumMg,
      bottles,
      bottleLabel: plan.onBikePlan?.bottleLabel || formatLiquid(profile?.defaultBottleMl || 650, units),
      durationMin: session?.durationMin || 0,
      plannedCarbs: plan.onBikePlan?.totalCarbs || 0,
    });
    setEditingOnBike(false);
    setEditingOnBikeId(null);
  };

  const handleSaveCompletedRide = (e) => {
    e.preventDefault();
    const kj = Number(actualKjInput) || 0;
    const mins = Number(actualMinInput) || 0;
    onCompleteRide(plan.date, kj, mins);
    if (syncRideCarbsOnComplete) {
      const carbs = Math.max(0, Math.round(Number(actualRideCarbsInput) || 0));
      onSaveOnBikeLog({
        existingId: existingOnBikeLog?.id || null,
        carbs,
        sodiumMg: existingOnBikeLog?.micros?.sodium ?? plan.onBikePlan?.totalSodiumMg ?? 0,
        bottles: existingOnBikeLog?.bottles ?? plan.onBikePlan?.bottles ?? 1,
        bottleLabel: plan.onBikePlan?.bottleLabel || formatLiquid(profile?.defaultBottleMl || 650, units),
        durationMin: mins,
        plannedCarbs: plan.onBikePlan?.totalCarbs || 0,
        silent: true,
      });
    }
    setEditingActual(false);
  };

  const microsList = [
    { key: 'iron', label: 'Iron', unit: 'mg', val: totals.micros.iron, target: plan.microTargets.iron },
    { key: 'vitC', label: 'Vit C', unit: 'mg', val: totals.micros.vitC, target: plan.microTargets.vitC },
    { key: 'calcium', label: 'Calcium', unit: 'mg', val: totals.micros.calcium, target: plan.microTargets.calcium },
    { key: 'vitD', label: 'Vit D', unit: 'µg', val: totals.micros.vitD, target: plan.microTargets.vitD },
    { key: 'magnesium', label: 'Magnesium', unit: 'mg', val: totals.micros.magnesium, target: plan.microTargets.magnesium },
    { key: 'sodium', label: 'Sodium', unit: 'mg', val: totals.micros.sodium, target: plan.microTargets.sodium },
    { key: 'fiber', label: 'Fiber', unit: 'g', val: totals.micros.fiber, target: plan.microTargets.fiber },
  ];

  const sodiumRemainingMg = Math.max(0, plan.microTargets.sodium - totals.micros.sodium);
  const dailyStack = supplements.filter((s) => s.inDailyStack);
  const loggedSuppEntries = logs.filter((l) => l.type === 'supplement');
  const loggedSuppIds = new Set(loggedSuppEntries.map((l) => l.supplementId));
  const unloggedDailyStack = dailyStack.filter((s) => !loggedSuppIds.has(s.id));

  const formatLeftLabel = (diff) =>
    diff >= 0 ? `${diff}g left` : `+${Math.abs(diff)}g over`;

  return (
    <>
      {/* Hero Daily Periodized Fuel Target */}
      <section className="card-carbon" aria-label="Daily Fuel Target">
        <div className="hero-top">
          <div>
            <span className={`carb-badge-dark ${plan.categoryMeta.color}`}>
              <Flame size={12} /> {plan.categoryMeta.badge} CARB · {plan.categoryMeta.label}
            </span>
            <div className="hero-kcal mono">
              {totals.kcal.toLocaleString()}
              <span style={{ fontSize: '1.05rem', fontWeight: 500, color: 'rgba(248,247,244,0.52)' }}>
                {' '}/ {plan.targets.kcal.toLocaleString()} kcal
              </span>
            </div>
            <div className="hero-kcal-sub">
              {remaining.kcal >= 0 ? (
                <>
                  <strong className="mono" style={{ color: '#fff' }}>{remaining.kcal} kcal</strong> left today
                </>
              ) : (
                <>
                  <strong className="mono" style={{ color: '#F7C77D' }}>+{Math.abs(remaining.kcal)} kcal</strong> over target
                </>
              )}
              {totals.hasEstimates && (
                <span className="mono" style={{ color: '#F4BE76' }}> · ±{totals.kcalUncertainty} est band</span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="hero-goal-pill"
            onClick={() => onNavigateTab('body')}
            style={{ cursor: 'pointer' }}
          >
            {plan.plannedDeficit > 40
              ? `Cut -${plan.plannedDeficit}`
              : plan.plannedDeficit < -40
              ? `Load +${Math.abs(plan.plannedDeficit)}`
              : 'Fuel 100%'}
          </button>
        </div>

        <div className="macro-bars">
          <div className="macro-bar-box">
            <div className="macro-bar-head">
              <span className="macro-bar-name">Carbs</span>
              <span className="macro-bar-gkg mono">{plan.targets.carbsPerKg}g/kg</span>
            </div>
            <div className="macro-bar-val mono">
              {totals.carbs}<span>/{plan.targets.carbs}g</span>
            </div>
            <div
              className="mono"
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                marginTop: 2,
                color: remaining.carbs >= 0 ? '#6CE0AE' : '#F7C77D',
              }}
            >
              {formatLeftLabel(remaining.carbs)}
            </div>
            <div className="progress-track">
              <div className="progress-fill fill-carb" style={{ width: `${pct(totals.carbs, plan.targets.carbs)}%` }} />
            </div>
          </div>

          <div className="macro-bar-box">
            <div className="macro-bar-head">
              <span className="macro-bar-name">Protein</span>
              <span className="macro-bar-gkg mono">{plan.targets.proteinPerKg}g/kg</span>
            </div>
            <div className="macro-bar-val mono">
              {totals.protein}<span>/{plan.targets.protein}g</span>
            </div>
            <div
              className="mono"
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                marginTop: 2,
                color: remaining.protein >= 0 ? '#85C5F2' : '#F7C77D',
              }}
            >
              {formatLeftLabel(remaining.protein)}
            </div>
            <div className="progress-track">
              <div className="progress-fill fill-protein" style={{ width: `${pct(totals.protein, plan.targets.protein)}%` }} />
            </div>
          </div>

          <div className="macro-bar-box">
            <div className="macro-bar-head">
              <span className="macro-bar-name">Fat</span>
              <span className="macro-bar-gkg mono">{plan.targets.fatPerKg}g/kg</span>
            </div>
            <div className="macro-bar-val mono">
              {totals.fat}<span>/{plan.targets.fat}g</span>
            </div>
            <div
              className="mono"
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                marginTop: 2,
                color: remaining.fat >= 0 ? '#F4BE76' : '#F2A194',
              }}
            >
              {formatLeftLabel(remaining.fat)}
            </div>
            <div className="progress-track">
              <div className="progress-fill fill-fat" style={{ width: `${pct(totals.fat, plan.targets.fat)}%` }} />
            </div>
          </div>
        </div>

        <div className="hero-footer">
          <div>{plan.deficitStrategyNote}</div>
          <div className="ea-row">
            <span className={`ea-chip ${plan.energyAvailability < 34 ? 'warn' : ''}`}>
              <ShieldCheck size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {plan.energyAvailability < 34 ? 'Low-Fuel Guard Active' : 'Recovery Fuel: Healthy'}
            </span>
            <span className="mono" style={{ fontSize: '0.68rem', color: 'rgba(248,247,244,0.62)' }}>
              Off-bike burn ({plan.nonExerciseHours}h): {plan.offBikeTdee} kcal
            </span>
          </div>
        </div>
      </section>

      {/* Tomorrow's Ride Pre-Load Banner */}
      {plan.needsTomorrowPreload && (
        <div className="notice-strip green">
          <Zap size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Tomorrow&apos;s Ride Pre-Load:</strong> Tomorrow is{' '}
            <strong>{plan.tomorrowTitle || plan.tomorrowCategory}</strong>. Tonight’s dinner carbs are automatically
            boosted so you wake up ready to ride hard.
          </div>
        </div>
      )}

      {/* Water Weight Notice from Withings Scale */}
      {biometricsSummary.glycogenNotice && (
        <div className="notice-strip">
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{biometricsSummary.glycogenNotice}</div>
        </div>
      )}

      {/* Today's Session + On-Bike Fuel Card */}
      <section className="card" aria-label="Today's Cycling Session">
        <div className="session-card-head">
          <div>
            <div className="section-kicker" style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <Bike size={13} />
              {session?.status === 'completed' ? 'Completed Session' : session?.durationMin > 0 ? 'Planned Session' : 'Recovery / Rest'}
              {session?.source === 'intervals.icu' && session?.status === 'completed' && (
                <span className="carb-badge high" style={{ fontSize: '0.58rem', padding: '2px 6px' }}>
                  Auto-pulled · Intervals.icu
                </span>
              )}
            </div>
            <h2 className="session-title" style={{ marginTop: 3 }}>
              {session?.title || 'Rest & Mobility Day'}
            </h2>
            <div className="session-meta mono">
              {session?.durationMin > 0
                ? `${session.durationMin} min · ${plan.exerciseKj} kJ (~${plan.exerciseKcal} kcal burned)`
                : '0 kJ on bike · Smart cut & muscle repair'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            {hasIntervalsConnected && onResyncNow && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={onResyncNow}
                disabled={bgSyncing}
                title="Pull latest completed ride kJ & duration from Intervals.icu"
              >
                <RefreshCw size={13} className={bgSyncing ? 'spin' : ''} />
              </button>
            )}
            {session?.durationMin > 0 && (
              <button
                type="button"
                className={`btn btn-sm ${session.status === 'completed' ? 'btn-soft' : 'btn-primary'}`}
                onClick={() => {
                  setActualKjInput(session.actualKj || plan.exerciseKj);
                  setActualMinInput(session.durationMin);
                  setActualRideCarbsInput(
                    existingOnBikeLog?.carbs ?? session.carbsIngested ?? plan.onBikePlan?.totalCarbs ?? 0
                  );
                  setEditingActual((v) => !v);
                }}
              >
                <CheckCircle2 size={14} />
                {session.status === 'completed' ? 'Edit Ride' : 'Complete'}
              </button>
            )}
          </div>
        </div>

        {editingActual && (
          <form onSubmit={handleSaveCompletedRide} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-hairline)' }}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="actual-kj">Actual Power Work (kJ)</label>
                <NumericInput
                  id="actual-kj"
                  className="input mono"
                  value={actualKjInput}
                  onChange={setActualKjInput}
                  min={0}
                  max={8000}
                  fallback={0}
                />
              </div>
              <div className="field">
                <label htmlFor="actual-min">Duration (min)</label>
                <NumericInput
                  id="actual-min"
                  className="input mono"
                  value={actualMinInput}
                  onChange={setActualMinInput}
                  min={0}
                  max={720}
                  fallback={60}
                />
              </div>
              <div className="field full">
                <label htmlFor="actual-ride-carbs">
                  Actual On-Bike Carbs Consumed (g){' '}
                  <span style={{ fontWeight: 500, color: 'var(--ink-muted)' }}>
                    (prescribed: {plan.onBikePlan?.totalCarbs || 0}g)
                  </span>
                </label>
                <NumericInput
                  id="actual-ride-carbs"
                  className="input mono"
                  value={actualRideCarbsInput}
                  onChange={setActualRideCarbsInput}
                  min={0}
                  max={1000}
                  fallback={0}
                />
              </div>
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                marginTop: 8,
                fontSize: '0.75rem',
                color: 'var(--ink-secondary)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={syncRideCarbsOnComplete}
                onChange={(e) => setSyncRideCarbsOnComplete(e.target.checked)}
              />
              Log actual on-bike carbs &amp; recalculate what&apos;s left today
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="submit" className="btn btn-accent btn-sm" style={{ flex: 1 }}>
                Save & Recalculate Remaining Meals
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setEditingActual(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {plan.onBikePlan && (
          <>
            <div className="on-bike-grid">
              <div className="mini-stat">
                <div className="mini-stat-label">On-Bike Carbs</div>
                <div className="mini-stat-val mono" style={{ color: 'var(--code-high)' }}>
                  {plan.onBikePlan.carbsPerHour} g/h
                </div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">
                  {existingOnBikeLog ? 'Actual / Plan' : 'Total Ride Fuel'}
                </div>
                <div className="mini-stat-val mono">
                  {existingOnBikeLog
                    ? `${loggedOnBikeCarbs} / ${plan.onBikePlan.totalCarbs}g`
                    : `${plan.onBikePlan.totalCarbs} g`}
                </div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Bottles Needed</div>
                <div className="mini-stat-val mono">
                  {plan.onBikePlan.bottles}× {plan.onBikePlan.bottleLabel}
                </div>
              </div>
            </div>

            {/* Per-Ride Bottle Size Selector */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
                Bottle size for this ride:
              </span>
              <div className="chip-row" role="group" aria-label="Ride bottle size">
                {BOTTLE_SIZE_OPTIONS.map((ml) => {
                  const active = plan.onBikePlan.bottleSizeMl === ml;
                  return (
                    <button
                      key={ml}
                      type="button"
                      className="chip mono"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.7rem',
                        ...(active
                          ? { background: 'var(--bg-carbon)', color: '#fff', borderColor: 'var(--bg-carbon)' }
                          : {}),
                      }}
                      onClick={() => onSetRideBottleSize(plan.date, ml)}
                    >
                      {formatLiquid(ml, units)}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="muted-text" style={{ marginTop: 8, fontSize: '0.75rem' }}>
              <Droplets size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              {plan.onBikePlan.note}
            </p>
          </>
        )}

        {(plan.timingCoaching?.preRideCue || plan.timingCoaching?.postRideCue) && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {plan.timingCoaching.preRideCue && (
              <p className="muted-text" style={{ fontSize: '0.74rem' }}>
                <strong>Pre-Ride:</strong> {plan.timingCoaching.preRideCue}
              </p>
            )}
            {plan.timingCoaching.postRideCue && (
              <p className="muted-text" style={{ fontSize: '0.74rem' }}>
                <strong>Post-Ride:</strong> {plan.timingCoaching.postRideCue}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Meal-by-Meal Carb Coded Timeline */}
      <section aria-label="Meal Plan and Food Log">
        <div className="section-header" style={{ padding: '0 2px' }}>
          <h2 className="section-title">Daily Meal Timeline</h2>
          <span className="section-kicker">Barcode · Saved Meals · Work AI</span>
        </div>

        <div className="meal-list">
          {plan.meals.map((slot) => {
            const slotLogs = logs.filter((l) => l.slot === slot.slot);
            const isOnBike = slot.slot === 'on_bike';
            const codeClass = slot.carbCode.toLowerCase();
            const pinnedStaple = !isOnBike ? staples.find((s) => s.dailySlot === slot.slot) : null;
            const pinnedPreview = pinnedStaple
              ? scaleStapleToTargets(pinnedStaple, slot.targetCarbs, slot.targetProtein)
              : null;
            const canSaveAsStaple =
              !isOnBike && slotLogs.length > 0 && slotLogs.some((l) => l.type === 'food' && l.ingredient);
            const onBikeDelta = isOnBike ? (Number(onBikeCarbsInput) || 0) - slot.targetCarbs : 0;

            return (
              <div className="meal-slot" key={slot.slot}>
                <div className="meal-slot-head">
                  <div className="meal-slot-title-group">
                    <span className="meal-slot-name">{slot.label}</span>
                    <span className={`carb-badge ${codeClass}`}>{slot.carbCode}</span>
                  </div>
                  <span className="meal-slot-time">{slot.timeHint}</span>
                </div>

                <div className="meal-target-line mono">
                  <span>
                    Prescribed: <strong>{slot.targetCarbs}g C</strong>
                  </span>
                  {!isOnBike && (
                    <>
                      <span><strong>{slot.targetProtein}g P</strong></span>
                      <span>{slot.targetFat}g F</span>
                    </>
                  )}
                  <span style={{ color: 'var(--ink-muted)' }}>{slot.targetKcal} kcal</span>
                </div>

                {slotLogs.length > 0 && (
                  <div className="meal-entries">
                    {slotLogs.map((entry) => (
                      <div className="logged-item" key={entry.id}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="logged-item-title">
                            {entry.title}{' '}
                            {entry.uncertaintyPct > 0 && (
                              <span className="est-tag mono">±{entry.uncertaintyPct}% work est</span>
                            )}
                          </div>
                          <div className="logged-item-detail">{entry.detail}</div>
                          <div className="logged-item-macros mono">
                            <span style={{ color: 'var(--macro-carb)' }}>{entry.carbs}g C</span>
                            {(!isOnBike || entry.protein > 0) && (
                              <span style={{ color: 'var(--macro-protein)' }}>{entry.protein}g P</span>
                            )}
                            {(!isOnBike || entry.fat > 0) && (
                              <span style={{ color: 'var(--macro-fat)' }}>{entry.fat}g F</span>
                            )}
                            <span style={{ color: 'var(--ink-muted)' }}>{entry.kcal} kcal</span>
                            {isOnBike && entry.micros?.sodium > 0 && (
                              <span style={{ color: 'var(--ink-secondary)' }}>{entry.micros.sodium}mg Na</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          {isOnBike && entry.type === 'on_bike' && (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => openOnBikeEditor(entry)}
                              aria-label="Edit actual ride fuel"
                              title="Modify actual carbs or sodium consumed"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => onDeleteLog(entry.id)}
                            aria-label={`Remove ${entry.title}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline Actual On-Bike Fuel Editor (modify carbs, sodium, bottles -> recalculates day) */}
                {isOnBike && editingOnBike && (
                  <form
                    onSubmit={handleSaveOnBikeCustom}
                    style={{
                      marginTop: 10,
                      padding: 11,
                      borderRadius: 11,
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-strong)',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', marginBottom: 8 }}>
                      Actual Ride Fuel Consumed
                    </div>
                    <div className="field-grid">
                      <div className="field">
                        <label htmlFor="onbike-carbs">Actual Carbs (g)</label>
                        <NumericInput
                          id="onbike-carbs"
                          className="input mono"
                          min={0}
                          max={1200}
                          fallback={0}
                          value={onBikeCarbsInput}
                          onChange={setOnBikeCarbsInput}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="onbike-sodium">Actual Sodium (mg)</label>
                        <NumericInput
                          id="onbike-sodium"
                          className="input mono"
                          min={0}
                          max={10000}
                          fallback={0}
                          value={onBikeSodiumInput}
                          onChange={setOnBikeSodiumInput}
                        />
                      </div>
                      <div className="field full">
                        <label htmlFor="onbike-bottles">
                          Bottles Drunk ({plan.onBikePlan?.bottleLabel})
                        </label>
                        <NumericInput
                          id="onbike-bottles"
                          className="input mono"
                          min={0}
                          max={12}
                          step={0.5}
                          fallback={1}
                          value={onBikeBottlesInput}
                          onChange={setOnBikeBottlesInput}
                        />
                      </div>
                    </div>

                    <div className="chip-row" style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="chip mono"
                        onClick={() => setOnBikeCarbsInput((v) => Math.max(0, (Number(v) || 0) - 25))}
                      >
                        -25g (1 gel)
                      </button>
                      <button
                        type="button"
                        className="chip mono"
                        onClick={() => setOnBikeCarbsInput((v) => (Number(v) || 0) + 25)}
                      >
                        +25g (1 gel)
                      </button>
                      <button
                        type="button"
                        className="chip mono"
                        onClick={() =>
                          setOnBikeSodiumInput((v) => (Number(v) || 0) + (profile?.electrolyteTabMg || 500))
                        }
                      >
                        +1 tab (+{profile?.electrolyteTabMg || 500}mg Na)
                      </button>
                    </div>

                    <div className="muted-text" style={{ marginTop: 8, fontSize: '0.73rem' }}>
                      Sodium: <strong>{formatSodiumPractical(onBikeSodiumInput, profile?.electrolyteTabMg || 500)}</strong>
                      <br />
                      {onBikeDelta < 0 ? (
                        <span style={{ color: 'var(--code-high)', fontWeight: 700 }}>
                          {Math.abs(onBikeDelta)}g less than planned → +{Math.abs(onBikeDelta)}g carbs added to what&apos;s left for your meals today.
                        </span>
                      ) : onBikeDelta > 0 ? (
                        <span style={{ color: 'var(--code-med)', fontWeight: 700 }}>
                          +{onBikeDelta}g more than planned → remaining meals today trimmed by {onBikeDelta}g carbs.
                        </span>
                      ) : (
                        <span>Matches today&apos;s prescribed ride fuel.</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button type="submit" className="btn btn-accent btn-sm" style={{ flex: 1 }}>
                        Save Actual Ride Fuel
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => setEditingOnBike(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* 1-Tap Log Usual Pinned Daily Meal (e.g. everyday breakfast) */}
                {pinnedStaple && pinnedPreview && slotLogs.length === 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-soft btn-block"
                    style={{ marginTop: 9, justifyContent: 'space-between' }}
                    onClick={() => onQuickLogStaple(slot, pinnedStaple)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={14} /> Log Usual {slot.label}: <strong>{pinnedStaple.name}</strong>
                    </span>
                    <span className="mono" style={{ fontSize: '0.7rem' }}>
                      {pinnedPreview.carbs}C · {pinnedPreview.protein}P
                    </span>
                  </button>
                )}

                <div className="meal-actions">
                  {isOnBike ? (
                    <>
                      {!existingOnBikeLog && (
                        <button
                          type="button"
                          className="btn btn-sm btn-accent"
                          onClick={() => onLogOnBike(slot, plan.onBikePlan)}
                        >
                          <Zap size={14} /> Log Planned ({slot.targetCarbs}g C)
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => openOnBikeEditor(existingOnBikeLog)}
                      >
                        <Pencil size={13} /> {existingOnBikeLog ? 'Modify Actual' : 'Log Actual / Tweak'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onOpenQuickFoodModal(slot)}
                      >
                        <ScanBarcode size={14} /> Scan Gel / Mix
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-accent"
                        onClick={() => onOpenQuickFoodModal(slot)}
                      >
                        <ScanBarcode size={14} /> Scan / Add
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => onOpenStapleModal(slot, remaining)}
                      >
                        <Scale size={14} />
                        {slot.slot === 'dinner' ? 'Auto-Scale Dinner' : 'Home Staple'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onOpenWorkModal(slot)}
                      >
                        <Camera size={14} /> Work AI
                      </button>
                    </>
                  )}
                </div>

                {canSaveAsStaple && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ marginTop: 7, width: '100%', fontSize: '0.74rem' }}
                    onClick={() => onSaveSlotAsStaple(slot, slotLogs)}
                  >
                    <BookmarkPlus size={14} /> Save Logged {slot.label} as Reusable Meal
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Key Endurance Vitamins, Minerals, Practical Sodium & Supplements */}
      <section className="card" aria-label="Key Vitamins and Minerals">
        <div className="section-header">
          <h2 className="section-title">Key Vitamins &amp; Minerals</h2>
          <button
            type="button"
            className="btn btn-sm btn-soft"
            onClick={onOpenSupplementsModal}
          >
            <Pill size={13} /> Supplements
          </button>
        </div>

        <div className="micro-grid">
          {microsList.map((m) => {
            const p = pct(m.val, m.target);
            return (
              <div className="micro-item" key={m.key}>
                <div className="micro-name">{m.label}</div>
                <div className="micro-val mono">
                  {m.val}
                  <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', fontWeight: 500 }}>
                    /{m.target}{m.unit}
                  </span>
                </div>
                <div className="progress-track light" style={{ height: 4 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${p}%`,
                      background: p >= 70 ? 'var(--code-high)' : p >= 35 ? 'var(--code-med)' : 'var(--code-low)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Practical Sodium Helper (Table Salt / Electrolyte Tabs) */}
        <div
          className={`notice-strip ${sodiumRemainingMg <= 150 ? 'green' : 'slate'}`}
          style={{ marginTop: 10, fontSize: '0.76rem' }}
        >
          <Droplets size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            {sodiumRemainingMg <= 150 ? (
              <>
                <strong>Sodium covered:</strong> Today&apos;s logged food &amp; ride drinks already meet your{' '}
                <span className="mono">{plan.microTargets.sodium} mg</span> target — no extra salt needed.
              </>
            ) : (
              <>
                <strong>Sodium left today: {sodiumRemainingMg} mg</strong> ({formatSodiumPractical(sodiumRemainingMg, profile?.electrolyteTabMg || 500)}).
                Scanned packaged foods count automatically — only add extra salt or tabs if your home-cooked meals were unsalted.
              </>
            )}
          </div>
        </div>

        {/* Daily Supplements Quick-Log Bar */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-hairline)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
              Daily Supplements
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {unloggedDailyStack.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-accent"
                  onClick={() => onLogDailyStack(unloggedDailyStack)}
                >
                  <Pill size={13} /> Log Daily Stack ({unloggedDailyStack.length})
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm"
                onClick={onOpenSupplementsModal}
              >
                + Add / Scan
              </button>
            </div>
          </div>

          {loggedSuppEntries.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {loggedSuppEntries.map((entry) => (
                <span
                  key={entry.id}
                  className="chip"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--code-high-bg)', color: 'var(--code-high)', borderColor: 'transparent' }}
                >
                  <CheckCircle2 size={12} /> {entry.title}
                  <button
                    type="button"
                    onClick={() => onDeleteLog(entry.id)}
                    aria-label={`Remove ${entry.title}`}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'inherit' }}
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="muted-text" style={{ marginTop: 5, fontSize: '0.72rem' }}>
              Saved stack: {dailyStack.length > 0 ? dailyStack.map((s) => s.name).join(' · ') : 'None yet — tap + Add / Scan'}.
            </p>
          )}
        </div>

        <button
          type="button"
          className="btn btn-soft btn-sm"
          style={{ marginTop: 10, width: '100%' }}
          onClick={() => onNavigateTab('training')}
        >
          View 7-Day Periodized Carb Wave <ArrowRight size={14} />
        </button>
      </section>
    </>
  );
}
