import { useState } from 'react';
import { Search, ScanBarcode, Plus, Check, Globe } from 'lucide-react';
import { searchLocalWholeFoods, searchPackagedFoods } from '../engine/foodDatabase';
import { foodDisplayToGrams, foodUnitLabel, formatFoodAmount } from '../engine/units';
import BarcodeScannerModal from './BarcodeScannerModal';

export default function FoodPickerPanel({ onAddIngredient, buttonLabel = 'Add', units }) {
  const [query, setQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState([]);
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Free-form custom food inputs
  const foodUnit = foodUnitLabel(units);
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState(foodUnit === 'g' ? '100' : foodUnit === 'oz' ? '3.5' : '0.25');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customProt, setCustomProt] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [customRole, setCustomRole] = useState('fixed');

  const localResults = searchLocalWholeFoods(query);

  const handleSearchOnline = async () => {
    if (query.trim().length < 2) return;
    setSearchingOnline(true);
    try {
      const found = await searchPackagedFoods(query.trim());
      setOnlineResults(found);
    } catch {
      setOnlineResults([]);
    } finally {
      setSearchingOnline(false);
    }
  };

  const emitFood = (item, overrideGrams, overrideRole) => {
    const grams = Math.max(1, Number(overrideGrams ?? item.grams ?? item.defaultGrams) || 100);
    const role = overrideRole ?? item.role ?? item.defaultRole ?? 'fixed';
    onAddIngredient({
      id: `ing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: item.name,
      grams,
      minGrams: Math.max(5, Math.round((grams * 0.4) / 5) * 5),
      maxGrams: Math.max(grams + 80, Math.round((grams * 2.2) / 5) * 5),
      role,
      per100g: {
        carbs: Number(item.per100g?.carbs || 0),
        protein: Number(item.per100g?.protein || 0),
        fat: Number(item.per100g?.fat || 0),
        fiber: Number(item.per100g?.fiber || 0),
        iron: Number(item.per100g?.iron || 0),
        vitC: Number(item.per100g?.vitC || 0),
        calcium: Number(item.per100g?.calcium || 0),
        vitD: Number(item.per100g?.vitD || 0),
        magnesium: Number(item.per100g?.magnesium || 0),
        sodium: Number(item.per100g?.sodium || 0),
      },
    });
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const grams = Math.max(1, foodDisplayToGrams(Number(customAmount) || 100, units));
    emitFood(
      {
        name: customName.trim(),
        per100g: {
          carbs: Number(customCarbs) || 0,
          protein: Number(customProt) || 0,
          fat: Number(customFat) || 0,
        },
      },
      grams,
      customRole
    );
    setCustomName('');
    setCustomCarbs('');
    setCustomProt('');
    setCustomFat('');
    setShowCustom(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Primary Barcode-First CTA */}
      <button
        type="button"
        className="btn btn-accent btn-block"
        onClick={() => setScannerOpen(true)}
        title="Scan barcode with phone camera"
      >
        <ScanBarcode size={16} /> Scan Barcode → Enter Amount ({foodUnit})
      </button>

      {/* Search + Custom bar */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }}
          />
          <input
            className="input"
            style={{ paddingLeft: 30 }}
            placeholder="Or search foods (oats, berries, skyr, brand...)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 2) setOnlineResults([]);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchOnline();
              }
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {query.trim().length >= 2 && (
          <button
            type="button"
            className="btn btn-sm btn-soft"
            disabled={searchingOnline}
            onClick={handleSearchOnline}
          >
            <Globe size={13} /> {searchingOnline ? 'Searching packaged foods…' : `Search brands for "${query.trim()}"`}
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setShowCustom((v) => !v)}
        >
          <Plus size={13} /> {showCustom ? 'Close Custom Food' : 'Write Custom Food'}
        </button>
      </div>

      {/* Free-form Custom Food entry (div, not form, so it never nests inside parent meal forms) */}
      {showCustom && (
        <div
          className="card"
          style={{ background: 'var(--bg-canvas)', boxShadow: 'none', padding: 12 }}
        >
          <div style={{ fontWeight: 800, fontSize: '0.8rem', marginBottom: 8 }}>
            Custom Food (per 100g from label)
          </div>
          <div className="field-grid">
            <div className="field full">
              <label htmlFor="cf-name">Food Name</label>
              <input
                id="cf-name"
                className="input"
                placeholder="e.g., My local bakery rye bread"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="cf-g">Your Usual Amount ({foodUnit})</label>
              <input
                id="cf-g"
                type="number"
                step={foodUnit === 'g' ? '1' : '0.1'}
                className="input mono"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                min={0.1}
                max={1500}
              />
            </div>
            <div className="field">
              <label htmlFor="cf-role">Portion Behavior</label>
              <select
                id="cf-role"
                className="select"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
              >
                <option value="fixed">Keep same amount</option>
                <option value="carb">Auto-adjust for ride (Carbs)</option>
                <option value="protein">Auto-adjust for muscle (Protein)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="cf-c">Carbs / 100g</label>
              <input
                id="cf-c"
                type="number"
                step="0.1"
                className="input mono"
                placeholder="0"
                value={customCarbs}
                onChange={(e) => setCustomCarbs(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="cf-p">Protein / 100g</label>
              <input
                id="cf-p"
                type="number"
                step="0.1"
                className="input mono"
                placeholder="0"
                value={customProt}
                onChange={(e) => setCustomProt(e.target.value)}
              />
            </div>
            <div className="field full">
              <label htmlFor="cf-f">Fat / 100g</label>
              <input
                id="cf-f"
                type="number"
                step="0.1"
                className="input mono"
                placeholder="0"
                value={customFat}
                onChange={(e) => setCustomFat(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm btn-block"
            style={{ marginTop: 10 }}
            disabled={!customName.trim()}
            onClick={handleAddCustom}
          >
            <Check size={14} /> Add Custom Food
          </button>
        </div>
      )}

      {/* Online Open Food Facts packaged results */}
      {onlineResults.length > 0 && (
        <div>
          <div className="section-kicker" style={{ marginBottom: 6 }}>
            Packaged &amp; Branded (Open Food Facts)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {onlineResults.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 10,
                  background: 'var(--bg-canvas)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{item.name}</div>
                  <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                    /100g: {item.per100g.carbs}C · {item.per100g.protein}P · {item.per100g.fat}F
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-accent"
                  onClick={() => emitFood(item)}
                >
                  + {buttonLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Built-in Verified USDA Whole Foods */}
      <div>
        <div className="section-kicker" style={{ marginBottom: 6 }}>
          {query.trim() ? 'Verified Whole Foods (USDA)' : 'Quick-Pick Whole Foods (USDA)'}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            maxHeight: 210,
            overflowY: 'auto',
          }}
        >
          {localResults.length === 0 ? (
            <div className="muted-text" style={{ fontSize: '0.76rem' }}>
              No whole-food match. Tap <strong>Search brands</strong>, <strong>Scan Barcode</strong>, or{' '}
              <strong>Write Custom Food</strong> above.
            </div>
          ) : (
            localResults.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 10,
                  background: 'var(--bg-canvas)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{item.name}</div>
                  <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                    /100g: {item.per100g.carbs}C · {item.per100g.protein}P · {item.per100g.fat}F · default {formatFoodAmount(item.defaultGrams, units)}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => emitFood(item)}
                >
                  + {buttonLabel}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={scannerOpen}
        units={units}
        onClose={() => setScannerOpen(false)}
        onSelectFood={(food) => emitFood(food, food.grams, food.role)}
      />
    </div>
  );
}
