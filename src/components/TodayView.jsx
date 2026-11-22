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
} from 'lucide-react';
import { sumDailyLogs } from '../engine/fuelingEngine';

export default function TodayView({
  plan,
  session,
  logs,
  biometricsSummary,
  onOpenStapleModal,
  onOpenQuickFoodModal,
  onOpenWorkModal,
  onDeleteLog,
  onLogOnBike,
  onCompleteRide,
  onNavigateTab,
}) {
  const [editingActual, setEditingActual] = useState(false);
  const [actualKjInput, setActualKjInput] = useState(session?.actualKj || plan.exerciseKj || 0);
  const [actualMinInput, setActualMinInput] = useState(session?.durationMin || 60);

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

  const handleSaveCompletedRide = (e) => {
    e.preventDefault();
    onCompleteRide(plan.date, Number(actualKjInput) || 0, Number(actualMinInput) || 0);
    setEditingActual(false);
  };

  const microsList = [
    { key: 'iron', label: 'Iron', unit: 'mg', val: totals.micros.iron, target: plan.microTargets.iron },
    { key: 'calcium', label: 'Calcium', unit: 'mg', val: totals.micros.calcium, target: plan.microTargets.calcium },
    { key: 'vitD', label: 'Vit D', unit: 'µg', val: totals.micros.vitD, target: plan.microTargets.vitD },
    { key: 'magnesium', label: 'Magnesium', unit: 'mg', val: totals.micros.magnesium, target: plan.microTargets.magnesium },
    { key: 'sodium', label: 'Sodium', unit: 'mg', val: totals.micros.sodium, target: plan.microTargets.sodium },
    { key: 'fiber', label: 'Fiber', unit: 'g', val: totals.micros.fiber, target: plan.microTargets.fiber },
  ];

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
                  <strong className="mono" style={{ color: '#fff' }}>{remaining.kcal} kcal</strong> remaining
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
              <span className="macro-bar-gkg mono">{plan.targets.carbsPerKg}g/kg · {plan.targets.carbsPct}%</span>
            </div>
            <div className="macro-bar-val mono">
              {totals.carbs}<span>/{plan.targets.carbs}g</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill fill-carb" style={{ width: `${pct(totals.carbs, plan.targets.carbs)}%` }} />
            </div>
          </div>

          <div className="macro-bar-box">
            <div className="macro-bar-head">
              <span className="macro-bar-name">Protein</span>
              <span className="macro-bar-gkg mono">{plan.targets.proteinPerKg}g/kg · {plan.targets.proteinPct}%</span>
            </div>
            <div className="macro-bar-val mono">
              {totals.protein}<span>/{plan.targets.protein}g</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill fill-protein" style={{ width: `${pct(totals.protein, plan.targets.protein)}%` }} />
            </div>
          </div>

          <div className="macro-bar-box">
            <div className="macro-bar-head">
              <span className="macro-bar-name">Fat</span>
              <span className="macro-bar-gkg mono">{plan.targets.fatPerKg}g/kg · {plan.targets.fatPct}%</span>
            </div>
            <div className="macro-bar-val mono">
              {totals.fat}<span>/{plan.targets.fat}g</span>
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
            <div className="section-kicker" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Bike size={13} />
              {session?.status === 'completed' ? 'Completed Session' : session?.durationMin > 0 ? 'Planned Session' : 'Recovery / Rest'}
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

          {session?.durationMin > 0 && (
            <button
              type="button"
              className={`btn btn-sm ${session.status === 'completed' ? 'btn-soft' : 'btn-primary'}`}
              onClick={() => {
                setActualKjInput(session.actualKj || plan.exerciseKj);
                setActualMinInput(session.durationMin);
                setEditingActual((v) => !v);
              }}
            >
              <CheckCircle2 size={14} />
              {session.status === 'completed' ? 'Edit kJ' : 'Complete'}
            </button>
          )}
        </div>

        {editingActual && (
          <form onSubmit={handleSaveCompletedRide} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-hairline)' }}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="actual-kj">Actual Power Work (kJ)</label>
                <input
                  id="actual-kj"
                  type="number"
                  className="input mono"
                  value={actualKjInput}
                  onChange={(e) => setActualKjInput(e.target.value)}
                  min={0}
                  max={8000}
                />
              </div>
              <div className="field">
                <label htmlFor="actual-min">Duration (min)</label>
                <input
                  id="actual-min"
                  type="number"
                  className="input mono"
                  value={actualMinInput}
                  onChange={(e) => setActualMinInput(e.target.value)}
                  min={0}
                  max={720}
                />
              </div>
            </div>
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
                <div className="mini-stat-label">Total Ride Fuel</div>
                <div className="mini-stat-val mono">{plan.onBikePlan.totalCarbs} g</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Fluids · Na+</div>
                <div className="mini-stat-val mono">
                  {plan.onBikePlan.bottles}× · {plan.onBikePlan.sodiumMgPerHr}mg
                </div>
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
          <h2 className="section-title">Carb-Coded Meal Timeline</h2>
          <span className="section-kicker">Home Scale + Work AI</span>
        </div>

        <div className="meal-list">
          {plan.meals.map((slot) => {
            const slotLogs = logs.filter((l) => l.slot === slot.slot);
            const isOnBike = slot.slot === 'on_bike';
            const codeClass = slot.carbCode.toLowerCase();

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
                  <span>Target: <strong>{slot.targetCarbs}g C</strong></span>
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
                            <span style={{ color: 'var(--macro-protein)' }}>{entry.protein}g P</span>
                            <span style={{ color: 'var(--macro-fat)' }}>{entry.fat}g F</span>
                            <span style={{ color: 'var(--ink-muted)' }}>{entry.kcal} kcal</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => onDeleteLog(entry.id)}
                          aria-label={`Remove ${entry.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="meal-actions">
                  {isOnBike ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-accent"
                      onClick={() => onLogOnBike(slot, plan.onBikePlan)}
                    >
                      <Zap size={14} /> Log Planned Ride Fuel ({slot.targetCarbs}g C)
                    </button>
                  ) : (
                    <>
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
                        onClick={() => onOpenQuickFoodModal(slot)}
                      >
                        <ScanBarcode size={14} /> Scan / Add
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
              </div>
            );
          })}
        </div>
      </section>

      {/* Key Endurance Vitamins & Minerals */}
      <section className="card" aria-label="Key Vitamins and Minerals">
        <div className="section-header">
          <h2 className="section-title">Key Vitamins &amp; Minerals</h2>
          <span className="section-kicker">Daily Recovery Basics</span>
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
