import { useMemo, useState } from 'react';
import { Scale, Check, X, Sparkles } from 'lucide-react';
import { computeStapleNutrition, scaleStapleToTargets } from '../engine/fuelingEngine';

export default function StapleScalerModal({
  isOpen,
  onClose,
  slotInfo,
  staples,
  remainingMacros,
  onLogEntry,
}) {
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
    carbOverride: null,
    proteinOverride: null,
  });

  const activeState =
    selectionState.slotKey === slotKey
      ? selectionState
      : {
          slotKey,
          stapleId: matchingStaples[0]?.id || '',
          balanceDayMode: slotKey === 'dinner',
          carbOverride: null,
          proteinOverride: null,
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

  const carbGrams = activeState.carbOverride ?? autoScaled.carbGrams;
  const proteinGrams = activeState.proteinOverride ?? autoScaled.proteinGrams;
  const liveCalc = computeStapleNutrition(selectedStaple, carbGrams, proteinGrams);

  const handleSave = () => {
    onLogEntry({
      id: `log-${Date.now()}`,
      slot: slotInfo.slot,
      type: 'staple',
      stapleId: selectedStaple.id,
      title: selectedStaple.name,
      detail: liveCalc.detail,
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
            <h2 className="modal-title">Scale Home Staple · {slotInfo.label}</h2>
            <div className="muted-text" style={{ marginTop: 2 }}>
              Target: <strong className="mono">{targetCarbs}g C</strong> ·{' '}
              <strong className="mono">{targetProtein}g P</strong>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
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
                    carbOverride: null,
                    proteinOverride: null,
                  })
                }
              >
                {balanceDayMode ? 'Switch to fixed dinner target' : 'Auto-balance remaining day'}
              </button>
            </div>
          </div>
        )}

        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="staple-select">Choose from your regular meals</label>
          <select
            id="staple-select"
            className="select"
            value={selectedStaple.id}
            onChange={(e) =>
              setSelectionState({
                ...activeState,
                slotKey,
                stapleId: e.target.value,
                carbOverride: null,
                proteinOverride: null,
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
              Kitchen Scale Weights
            </span>
          </div>

          <div className="range-row" style={{ marginBottom: 12 }}>
            <div className="range-head">
              <span>
                <strong>Carb Lever:</strong> {selectedStaple.carbLever.name}
              </span>
              <strong className="mono" style={{ fontSize: '0.96rem', color: 'var(--code-high)' }}>
                {carbGrams}g
              </strong>
            </div>
            <input
              type="range"
              min={selectedStaple.carbLever.minGrams}
              max={selectedStaple.carbLever.maxGrams}
              step={5}
              value={carbGrams}
              onChange={(e) =>
                setSelectionState({
                  ...activeState,
                  slotKey,
                  carbOverride: Number(e.target.value),
                })
              }
            />
          </div>

          <div className="range-row" style={{ marginBottom: 10 }}>
            <div className="range-head">
              <span>
                <strong>Protein Anchor:</strong> {selectedStaple.proteinAnchor.name}
              </span>
              <strong className="mono" style={{ fontSize: '0.96rem', color: 'var(--macro-protein)' }}>
                {proteinGrams}g
              </strong>
            </div>
            <input
              type="range"
              min={selectedStaple.proteinAnchor.minGrams}
              max={selectedStaple.proteinAnchor.maxGrams}
              step={5}
              value={proteinGrams}
              onChange={(e) =>
                setSelectionState({
                  ...activeState,
                  slotKey,
                  proteinOverride: Number(e.target.value),
                })
              }
            />
          </div>

          <div className="muted-text" style={{ fontSize: '0.74rem' }}>
            <strong>Base included:</strong> {selectedStaple.baseFixed.label}
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
