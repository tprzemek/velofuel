import { useRef, useState } from 'react';
import { X, Pill, Plus, ScanBarcode, Check, Trash2, Star, Pencil } from 'lucide-react';
import { ONBOARDING_SUPPLEMENTS } from '../engine/defaultData';
import NumericInput from './NumericInput';
import BarcodeScannerModal from './BarcodeScannerModal';

const QUICK_SUPPLEMENTS = [
  ...ONBOARDING_SUPPLEMENTS.map((s) => ({ name: s.name, micros: s.micros })),
  {
    name: 'Electrolyte Tablet (500mg Na)',
    micros: { iron: 0, vitC: 0, vitD: 0, calcium: 20, magnesium: 25, sodium: 500 },
  },
];

export default function SupplementsModal({
  isOpen,
  onClose,
  supplements = [],
  loggedSupplementIds = new Set(),
  usdaApiKey = '',
  onSaveSupplement,
  onDeleteSupplement,
  onToggleDailyStack,
  onLogSupplement,
}) {
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [iron, setIron] = useState(0);
  const [vitC, setVitC] = useState(0);
  const [vitD, setVitD] = useState(0);
  const [calcium, setCalcium] = useState(0);
  const [magnesium, setMagnesium] = useState(0);
  const [sodium, setSodium] = useState(0);
  const [inDailyStack, setInDailyStack] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const formRef = useRef(null);

  if (!isOpen) return null;

  const isEditing = Boolean(editingId);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setIron(0);
    setVitC(0);
    setVitD(0);
    setCalcium(0);
    setMagnesium(0);
    setSodium(0);
    setInDailyStack(true);
  };

  const startEdit = (supp) => {
    setEditingId(supp.id);
    setName(supp.name || '');
    setIron(supp.micros?.iron || 0);
    setVitC(supp.micros?.vitC || 0);
    setVitD(supp.micros?.vitD || 0);
    setCalcium(supp.micros?.calcium || 0);
    setMagnesium(supp.micros?.magnesium || 0);
    setSodium(supp.micros?.sodium || 0);
    setInDailyStack(Boolean(supp.inDailyStack));
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  };

  const applyTemplate = (tpl) => {
    setEditingId(null);
    setName(tpl.name);
    setIron(tpl.micros.iron || 0);
    setVitC(tpl.micros.vitC || 0);
    setVitD(tpl.micros.vitD || 0);
    setCalcium(tpl.micros.calcium || 0);
    setMagnesium(tpl.micros.magnesium || 0);
    setSodium(tpl.micros.sodium || 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const suppPayload = {
      id: editingId || `supp-${Date.now()}`,
      name: name.trim(),
      inDailyStack,
      micros: {
        iron: Number(iron) || 0,
        vitC: Number(vitC) || 0,
        vitD: Number(vitD) || 0,
        calcium: Number(calcium) || 0,
        magnesium: Number(magnesium) || 0,
        sodium: Number(sodium) || 0,
      },
    };
    onSaveSupplement(suppPayload, { isEdit: isEditing });
    if (!isEditing) {
      onLogSupplement(suppPayload);
    }
    resetForm();
  };

  const formatMicrosSummary = (m = {}) => {
    const parts = [];
    if (m.iron > 0) parts.push(`${m.iron}mg Iron`);
    if (m.vitC > 0) parts.push(`${m.vitC}mg Vit C`);
    if (m.vitD > 0) parts.push(`${m.vitD}µg Vit D`);
    if (m.calcium > 0) parts.push(`${m.calcium}mg Ca`);
    if (m.magnesium > 0) parts.push(`${m.magnesium}mg Mg`);
    if (m.sodium > 0) parts.push(`${m.sodium}mg Na`);
    return parts.length > 0 ? parts.join(' · ') : 'Custom supplement';
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Vitamins and Supplements">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Pill size={17} color="var(--code-high)" /> Vitamins &amp; Supplements
            </h2>
            <div className="muted-text" style={{ marginTop: 2 }}>
              Save what you take daily (e.g. Iron + Vit C, Multivitamin) and edit doses anytime.
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Saved Supplements List */}
        {supplements.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="section-kicker" style={{ marginBottom: 6 }}>
              Your Saved Supplements ({supplements.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {supplements.map((s) => {
                const isLogged = loggedSupplementIds.has(s.id);
                const currentlyEditing = editingId === s.id;
                return (
                  <div
                    key={s.id}
                    style={{
                      background: currentlyEditing ? 'var(--code-high-bg)' : 'var(--bg-canvas)',
                      border: currentlyEditing ? '1px solid var(--code-high)' : '1px solid transparent',
                      borderRadius: 11,
                      padding: '9px 11px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        {s.name}
                        {s.inDailyStack && (
                          <span className="carb-badge high" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                            Daily
                          </span>
                        )}
                      </div>
                      <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-secondary)', marginTop: 2 }}>
                        {formatMicrosSummary(s.micros)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onToggleDailyStack(s.id)}
                        title={s.inDailyStack ? 'Remove from Daily Stack' : 'Add to Daily Stack'}
                        aria-label={`Toggle daily stack for ${s.name}`}
                      >
                        <Star
                          size={15}
                          fill={s.inDailyStack ? 'var(--code-med)' : 'none'}
                          color={s.inDailyStack ? 'var(--code-med)' : 'var(--ink-muted)'}
                        />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => startEdit(s)}
                        title={`Edit ${s.name}`}
                        aria-label={`Edit ${s.name}`}
                      >
                        <Pencil size={14} color={currentlyEditing ? 'var(--code-high)' : undefined} />
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${isLogged ? 'btn-soft' : 'btn-primary'}`}
                        onClick={() => onLogSupplement(s)}
                      >
                        {isLogged ? <><Check size={13} /> Logged</> : '+ Log'}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          if (editingId === s.id) resetForm();
                          onDeleteSupplement(s.id);
                        }}
                        aria-label={`Delete ${s.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="divider" />

        {/* Add or Edit Supplement (Barcode Scan or Manual) */}
        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="section-header" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: isEditing ? 'var(--code-high)' : 'var(--ink-primary)' }}>
              {isEditing ? 'Edit Saved Supplement' : 'Add a Supplement'}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-accent"
              onClick={() => setScannerOpen(true)}
            >
              <ScanBarcode size={14} /> Scan Bottle Barcode
            </button>
          </div>

          {!isEditing && (
            <div className="chip-row" style={{ marginBottom: 10 }}>
              {QUICK_SUPPLEMENTS.map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  className="chip"
                  onClick={() => applyTemplate(tpl)}
                >
                  + {tpl.name}
                </button>
              ))}
            </div>
          )}

          <div className="field-grid">
            <div className="field full">
              <label htmlFor="supp-name">Supplement Name</label>
              <input
                id="supp-name"
                className="input"
                placeholder="e.g., Iron Bisglycinate + Vitamin C"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="supp-iron">Iron (mg)</label>
              <NumericInput id="supp-iron" min={0} max={200} step={0.5} fallback={0} className="input mono" value={iron} onChange={setIron} />
            </div>
            <div className="field">
              <label htmlFor="supp-vitc">Vitamin C (mg)</label>
              <NumericInput id="supp-vitc" min={0} max={3000} fallback={0} className="input mono" value={vitC} onChange={setVitC} />
            </div>
            <div className="field">
              <label htmlFor="supp-vitd">Vitamin D (µg)</label>
              <NumericInput id="supp-vitd" min={0} max={500} step={0.5} fallback={0} className="input mono" value={vitD} onChange={setVitD} />
            </div>
            <div className="field">
              <label htmlFor="supp-ca">Calcium (mg)</label>
              <NumericInput id="supp-ca" min={0} max={2500} fallback={0} className="input mono" value={calcium} onChange={setCalcium} />
            </div>
            <div className="field">
              <label htmlFor="supp-mg">Magnesium (mg)</label>
              <NumericInput id="supp-mg" min={0} max={1500} fallback={0} className="input mono" value={magnesium} onChange={setMagnesium} />
            </div>
            <div className="field">
              <label htmlFor="supp-na">Sodium (mg)</label>
              <NumericInput id="supp-na" min={0} max={4000} fallback={0} className="input mono" value={sodium} onChange={setSodium} />
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              marginBottom: 12,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={inDailyStack}
              onChange={(e) => setInDailyStack(e.target.checked)}
            />
            Include in my Daily Stack (1-tap log on Today)
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!name.trim()}>
              {isEditing ? (
                <>
                  <Check size={15} /> Save Supplement Changes
                </>
              ) : (
                <>
                  <Plus size={15} /> Save &amp; Log Supplement Today
                </>
              )}
            </button>
            {isEditing && (
              <button type="button" className="btn" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <BarcodeScannerModal
          isOpen={scannerOpen}
          mode="supplement"
          usdaApiKey={usdaApiKey}
          onClose={() => setScannerOpen(false)}
          onSelectFood={(product) => {
            const m = product.perServingMicros || product.per100g || {};
            setName(product.name || '');
            setIron(m.iron || 0);
            setVitC(m.vitC || 0);
            setVitD(m.vitD || 0);
            setCalcium(m.calcium || 0);
            setMagnesium(m.magnesium || 0);
            setSodium(m.sodium || 0);
          }}
        />
      </div>
    </div>
  );
}
