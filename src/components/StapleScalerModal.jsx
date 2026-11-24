import { useMemo, useState } from 'react';
import { Scale, Check, X, Sparkles } from 'lucide-react';
import { computeStapleNutrition, scaleStapleToTargets } from '../engine/fuelingEngine';
import { foodDisplayToGrams, foodUnitLabel, formatFoodAmount, gramsToFoodDisplay } from '../engine/units';
import NumericInput from './NumericInput';

function createStapleLogId() {
  return `log-${Date.now()}`;
}

export default function StapleScalerModal({
  isOpen,
  onClose,
  slotInfo,
  staples,
  remainingMacros,
  units,
  onLogEntry,
}) {
  const foodUnit = foodUnitLabel(units);

  const matchingStaples = useMemo(() => {
    if (!slotInfo) return staples;
    const preferred = staples.filter((s) => s.mealTypes?.includes(slotInfo.slot));
    return preferred.length > 0 ? [...preferred, ...staples.filter((s) => !preferred.includes(s))] : staples;
  }, [staples, slotInfo]);

  const slotKey = slotInfo?.slot || '';
  const [selectionState, setSelectionState] = useState({
    slotKey: '',
    stapleId: '',
    balanceDayMode: null,
    gramsOverrides: {},
  });

  const activeState =
    selectionState.slotKey === slotKey
      ? selectionState
      : {
          slotKey,
          stapleId: matchingStaples[0]?.id || '',
          balanceDayMode: slotKey === 'dinner',
          gramsOverrides: {},
        };

  const selectedStaple = useMemo(
    () => matchingStaples.find((s) => s.id === activeState.stapleId) || matchingStaples[0],
    [matchingStaples, activeState.stapleId]
  );

  const balanceDayMode = activeState.balanceDayMode ?? slotKey === 'dinner';

  const targetCarbs = useMemo(() => {
    if (!slotInfo) return 60;
    if (balanceDayMode && remainingMacros) {
      return Math.max(20, Math.round(remainingMacros.carbs));
    }
    return slotInfo.targetCarbs;
  }, [balanceDayMode, remainingMacros, slotInfo]);

  const targetProtein = useMemo(() => {
    if (!slotInfo) return 40;
    if (balanceDayMode && remainingMacros) {
      return Math.max(20, Math.round(remainingMacros.protein));
    }
    return slotInfo.targetProtein;
  }, [balanceDayMode, remainingMacros, slotInfo]);

  const autoScaled = useMemo(() => {
    if (!selectedStaple) return null;
    return scaleStapleToTargets(selectedStaple, targetCarbs, targetProtein);
  }, [selectedStaple, targetCarbs, targetProtein]);

  if (!isOpen || !slotInfo || !selectedStaple || !autoScaled) return null;

  const mergedGrams = { ...autoScaled.gramsById, ...(activeState.gramsOverrides || {}) };
  const liveCalc = computeStapleNutrition(selectedStaple, mergedGrams);

  const setIngredientGrams = (ingId, valGrams) => {
    setSelectionState({
      ...activeState,
      slotKey,
      gramsOverrides: {
        ...(activeState.gramsOverrides || {}),
        [ingId]: Math.max(0, Number(valGrams) || 0),
      },
    });
  };

  const handleSave = () => {
    const formattedDetail = liveCalc.resolvedItems
      .map((i) => `${formatFoodAmount(i.grams, units)} ${i.name}`)
      .join(' · ');

    onLogEntry({
      id: createStapleLogId(),
      slot: slotInfo.slot,
      type: 'staple',
      stapleId: selectedStaple.id,
      resolvedItems: liveCalc.resolvedItems,
      title: selectedStaple.name,
      detail: formattedDetail,
      carbs: liveCalc.carbs,
      protein: liveCalc.protein,
      fat: liveCalc.fat,
      kcal: liveCalc.kcal,
      uncertaintyPct: 0,
      micros: liveCalc.micros,
      loggedAt: new Date().toTimeString().slice(0, 5),
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Scale Home Staple Meal">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Scale Saved Meal · {slotInfo.label}</h2>
            <div className="muted-text" style={{ marginTop: 2 }}>
              Target: <strong className="mono">{targetCarbs}g C</strong> ·{' '}
              <strong className="mono">{targetProtein}g P</strong>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {slotInfo.slot === 'dinner' && remainingMacros && (
          <div className="notice-strip green" style={{ marginBottom: 12 }}>
            <Sparkles size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>
                {balanceDayMode ? 'Auto-Balancing Remaining Day' : 'Using Standard Dinner Slot Target'}
              </div>
              <div style={{ marginTop: 2 }}>
                Remaining budget: <span className="mono">{Math.max(0, remainingMacros.carbs)}g C</span> ·{' '}
                <span className="mono">{Math.max(0, remainingMacros.protein)}g P</span>
                {remainingMacros.carbUncertainty > 0 && ` (±${remainingMacros.carbUncertainty}g from work meal)`}
              </div>
              <button
                type="button"
                className="btn btn-sm"
                style={{ marginTop: 7 }}
                onClick={() =>
                  setSelectionState({
                    ...activeState,
                    slotKey,
                    balanceDayMode: !balanceDayMode,
                    gramsOverrides: {},
                  })
                }
              >
                {balanceDayMode ? 'Switch to fixed dinner target' : 'Auto-balance remaining day'}
              </button>
            </div>
          </div>
        )}

        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="staple-select">Choose from your Saved Meals</label>
          <select
            id="staple-select"
            className="select"
            value={selectedStaple.id}
            onChange={(e) =>
              setSelectionState({
                ...activeState,
                slotKey,
                stapleId: e.target.value,
                gramsOverrides: {},
              })
            }
          >
            {matchingStaples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="card" style={{ background: 'var(--bg-canvas)', boxShadow: 'none', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Scale size={15} color="var(--code-high)" />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Kitchen Scale Weights ({foodUnit})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {(selectedStaple.ingredients || []).map((ing) => {
              const g = mergedGrams[ing.id] ?? ing.grams;
              const maxG = Math.max(ing.maxGrams || ing.grams * 2, g + 40, 150);
              const accent =
                ing.role === 'carb'
                  ? 'var(--code-high)'
                  : ing.role === 'protein'
                  ? 'var(--macro-protein)'
                  : 'var(--ink-primary)';

              return (
                <div className="range-row" key={ing.id}>
                  <div className="range-head">
                    <span style={{ fontSize: '0.8rem' }}>
                      <strong>{ing.name}</strong>
                      {ing.role === 'carb' && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--code-high)', marginLeft: 5, fontWeight: 700 }}>
                          auto-carbs
                        </span>
                      )}
                      {ing.role === 'protein' && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--macro-protein)', marginLeft: 5, fontWeight: 700 }}>
                          auto-protein
                        </span>
                      )}
                    </span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <NumericInput
                        aria-label={`${ing.name} grams`}
                        min={0}
                        max={foodUnit === 'g' ? 1500 : 100}
                        step={foodUnit === 'g' ? 1 : 0.1}
                        fallback={0}
                        className="input mono"
                        style={{ width: 66, padding: '3px 6px', fontSize: '0.82rem', fontWeight: 700, color: accent }}
                        value={gramsToFoodDisplay(g, units)}
                        onChange={(val) => setIngredientGrams(ing.id, foodDisplayToGrams(val, units))}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>{foodUnit}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxG}
                    step={5}
                    value={g}
                    onChange={(e) => setIngredientGrams(ing.id, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="stat-pair-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 14 }}>
          <div className="mini-stat">
            <div className="mini-stat-label">Kcal</div>
            <div className="mini-stat-val mono">{liveCalc.kcal}</div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">Carbs</div>
            <div className="mini-stat-val mono" style={{ color: 'var(--macro-carb)' }}>
              {liveCalc.carbs}g
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">Protein</div>
            <div className="mini-stat-val mono" style={{ color: 'var(--macro-protein)' }}>
              {liveCalc.protein}g
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">Fat</div>
            <div className="mini-stat-val mono" style={{ color: 'var(--macro-fat)' }}>
              {liveCalc.fat}g
            </div>
          </div>
        </div>

        <button type="button" className="btn btn-primary btn-block" onClick={handleSave}>
          <Check size={16} /> Log Scaled Home Meal ({liveCalc.kcal} kcal)
        </button>
      </div>
    </div>
  );
}
