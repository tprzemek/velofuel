import { useState } from 'react';
import { X, Zap, Search } from 'lucide-react';
import { formatFoodAmount } from '../engine/units';
import FoodPickerPanel from './FoodPickerPanel';
import NumericInput from './NumericInput';

export default function QuickFoodModal({
  isOpen,
  onClose,
  slotInfo,
  units,
  usdaApiKey = '',
  recentFoods = [],
  onLogEntry,
}) {
  const [mode, setMode] = useState('find'); // 'find' | 'quick'
  const [qaName, setQaName] = useState('');
  const [qaCarbs, setQaCarbs] = useState('');
  const [qaProtein, setQaProtein] = useState('');
  const [qaFat, setQaFat] = useState('');
  const [qaKcalOverride, setQaKcalOverride] = useState('');
  const [qaSodium, setQaSodium] = useState('');

  if (!isOpen || !slotInfo) return null;

  const resetAndClose = () => {
    setMode('find');
    setQaName('');
    setQaCarbs('');
    setQaProtein('');
    setQaFat('');
    setQaKcalOverride('');
    setQaSodium('');
    onClose();
  };

  const handleAddSingleFood = (ing) => {
    const f = (ing.grams || 100) / 100;
    const p = ing.per100g || {};
    const carbs = Math.round((p.carbs || 0) * f);
    const protein = Math.round((p.protein || 0) * f);
    const fat = Math.round((p.fat || 0) * f);
    const kcal = carbs * 4 + protein * 4 + fat * 9;

    onLogEntry({
      id: `log-food-${Date.now()}`,
      slot: slotInfo.slot,
      type: 'food',
      title: ing.name,
      detail: formatFoodAmount(ing.grams, units),
      ingredient: ing,
      carbs,
      protein,
      fat,
      kcal,
      uncertaintyPct: 0,
      micros: {
        fiber: Number(((p.fiber || 0) * f).toFixed(1)),
        iron: Number(((p.iron || 0) * f).toFixed(1)),
        vitC: Math.round((p.vitC || 0) * f),
        calcium: Math.round((p.calcium || 0) * f),
        vitD: Number(((p.vitD || 0) * f).toFixed(1)),
        magnesium: Math.round((p.magnesium || 0) * f),
        sodium: Math.round((p.sodium || 0) * f),
      },
      loggedAt: new Date().toTimeString().slice(0, 5),
    });
    resetAndClose();
  };

  const cNum = Math.max(0, Math.round(Number(qaCarbs) || 0));
  const pNum = Math.max(0, Math.round(Number(qaProtein) || 0));
  const fNum = Math.max(0, Math.round(Number(qaFat) || 0));
  const autoKcal = cNum * 4 + pNum * 4 + fNum * 9;
  const effectiveKcal =
    qaKcalOverride !== '' && Number.isFinite(Number(qaKcalOverride))
      ? Math.max(0, Math.round(Number(qaKcalOverride)))
      : autoKcal;
  const naNum = Math.max(0, Math.round(Number(qaSodium) || 0));
  const canLogQuickAdd = cNum > 0 || pNum > 0 || fNum > 0 || effectiveKcal > 0;

  const handleLogQuickAdd = () => {
    if (!canLogQuickAdd) return;
    const title = qaName.trim() || 'Quick Add';
    const detailParts = ['Quick macros'];
    if (naNum > 0) detailParts.push(`${naNum}mg sodium`);
    onLogEntry({
      id: `log-quick-${Date.now()}`,
      slot: slotInfo.slot,
      type: 'quick_add',
      title,
      detail: detailParts.join(' · '),
      carbs: cNum,
      protein: pNum,
      fat: fNum,
      kcal: effectiveKcal,
      uncertaintyPct: 0,
      micros: {
        fiber: 0,
        iron: 0,
        vitC: 0,
        calcium: 0,
        vitD: 0,
        magnesium: 0,
        sodium: naNum,
      },
      loggedAt: new Date().toTimeString().slice(0, 5),
    });
    resetAndClose();
  };

  return (
    <div className="modal-backdrop" onClick={resetAndClose} role="dialog" aria-modal="true" aria-label="Scan or Add Food">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Scan / Add Food · {slotInfo.label}</h2>
            <div className="muted-text" style={{ marginTop: 2 }}>
              {mode === 'find'
                ? 'Scan a barcode, search USDA & branded foods, pick a household serving, or quick-add macros.'
                : 'Know the numbers? Enter carbs, protein, fat, or just calories in 3 seconds.'}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={resetAndClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* 2-Tab Segmented Toggle: Find / Scan (default) | Quick Add */}
        <div className="segmented segmented-2" role="tablist" aria-label="Food logging mode" style={{ marginBottom: 12 }}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'find'}
            className={`seg-btn ${mode === 'find' ? 'active' : ''}`}
            onClick={() => setMode('find')}
          >
            <Search size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Find / Scan
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'quick'}
            className={`seg-btn ${mode === 'quick' ? 'active' : ''}`}
            onClick={() => setMode('quick')}
          >
            <Zap size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Quick Add
          </button>
        </div>

        {mode === 'find' ? (
          <FoodPickerPanel
            onAddIngredient={handleAddSingleFood}
            buttonLabel="Log"
            units={units}
            usdaApiKey={usdaApiKey}
            recentFoods={recentFoods}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="field">
              <label htmlFor="qa-name">Label (optional)</label>
              <input
                id="qa-name"
                className="input"
                placeholder="e.g., Coffee shop wrap, rice bowl — optional"
                value={qaName}
                onChange={(e) => setQaName(e.target.value)}
              />
            </div>

            <div className="quick-add-macro-row">
              <div className="field">
                <label htmlFor="qa-carbs" style={{ color: 'var(--macro-carb)' }}>Carbs (g)</label>
                <NumericInput
                  id="qa-carbs"
                  className="input mono"
                  placeholder="0"
                  min={0}
                  max={600}
                  allowEmpty
                  value={qaCarbs}
                  onChange={(v) => {
                    setQaCarbs(v);
                    setQaKcalOverride('');
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="qa-protein" style={{ color: 'var(--macro-protein)' }}>Protein (g)</label>
                <NumericInput
                  id="qa-protein"
                  className="input mono"
                  placeholder="0"
                  min={0}
                  max={300}
                  allowEmpty
                  value={qaProtein}
                  onChange={(v) => {
                    setQaProtein(v);
                    setQaKcalOverride('');
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="qa-fat" style={{ color: 'var(--macro-fat)' }}>Fat (g)</label>
                <NumericInput
                  id="qa-fat"
                  className="input mono"
                  placeholder="0"
                  min={0}
                  max={250}
                  allowEmpty
                  value={qaFat}
                  onChange={(v) => {
                    setQaFat(v);
                    setQaKcalOverride('');
                  }}
                />
              </div>
            </div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="qa-kcal">Calories (kcal — auto or custom)</label>
                <NumericInput
                  id="qa-kcal"
                  className="input mono"
                  placeholder="0"
                  min={0}
                  max={5000}
                  allowEmpty
                  value={qaKcalOverride !== '' ? qaKcalOverride : autoKcal > 0 ? autoKcal : ''}
                  onChange={setQaKcalOverride}
                />
              </div>
              <div className="field">
                <label htmlFor="qa-sodium">Sodium (mg, optional)</label>
                <NumericInput
                  id="qa-sodium"
                  className="input mono"
                  placeholder="0"
                  min={0}
                  max={10000}
                  allowEmpty
                  value={qaSodium}
                  onChange={setQaSodium}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!canLogQuickAdd}
              onClick={handleLogQuickAdd}
            >
              <Zap size={15} /> Log Quick Add ({effectiveKcal} kcal)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
