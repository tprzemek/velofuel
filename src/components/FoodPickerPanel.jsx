import { useState } from 'react';
import { Search, ScanBarcode, Plus, Check, Globe, Clock, SlidersHorizontal } from 'lucide-react';
import {
  getFoodServings,
  isPackagedFood,
  searchLocalWholeFoods,
  searchPackagedFoods,
} from '../engine/foodDatabase';
import {
  foodDisplayToGrams,
  foodUnitLabel,
  formatFoodAmount,
  gramsToFoodDisplay,
} from '../engine/units';
import BarcodeScannerModal from './BarcodeScannerModal';
import NumericInput from './NumericInput';

export default function FoodPickerPanel({
  onAddIngredient,
  buttonLabel = 'Add',
  units,
  usdaApiKey = '',
  recentFoods = [],
}) {
  const [query, setQuery] = useState('');
  const [foodFilter, setFoodFilter] = useState('all'); // 'all' | 'whole' | 'packaged'
  const [onlineResults, setOnlineResults] = useState([]);
  const [onlineSources, setOnlineSources] = useState([]);
  const [onlineWarning, setOnlineWarning] = useState('');
  const [hasSearchedOnline, setHasSearchedOnline] = useState(false);
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Per-item expanded portion / household serving state
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [gramsByItemId, setGramsByItemId] = useState({});

  // Free-form custom food inputs (NumericInput backed)
  const foodUnit = foodUnitLabel(units);
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState(foodUnit === 'g' ? 100 : foodUnit === 'oz' ? 3.5 : 0.25);
  const [customCarbs, setCustomCarbs] = useState('');
  const [customProt, setCustomProt] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [customRole, setCustomRole] = useState('fixed');

  const localResults = searchLocalWholeFoods(query, foodFilter);
  const filteredOnlineResults =
    foodFilter === 'whole'
      ? onlineResults.filter((item) => !isPackagedFood(item))
      : foodFilter === 'packaged'
      ? onlineResults.filter((item) => isPackagedFood(item))
      : onlineResults;

  const handleSearchOnline = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setSearchingOnline(true);
    setOnlineWarning('');
    setHasSearchedOnline(true);
    try {
      const { results, sources, warning } = await searchPackagedFoods(q, { usdaApiKey });
      setOnlineResults(results);
      setOnlineSources(sources);
      setOnlineWarning(warning || '');
    } catch {
      setOnlineResults([]);
      setOnlineSources([]);
      setOnlineWarning('Could not reach USDA / Open Food Facts right now. Check your connection or tap Write Custom Food.');
    } finally {
      setSearchingOnline(false);
    }
  };

  const emitFood = (item, overrideGrams, overrideRole) => {
    const chosenGrams =
      overrideGrams ?? gramsByItemId[item.id] ?? item.grams ?? item.defaultGrams ?? 100;
    const grams = Math.max(1, Math.round(Number(chosenGrams) || 100));
    const role = overrideRole ?? item.role ?? item.defaultRole ?? 'fixed';
    onAddIngredient({
      id: `ing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: item.name,
      grams,
      minGrams: Math.max(5, Math.round((grams * 0.4) / 5) * 5),
      maxGrams: Math.max(grams + 80, Math.round((grams * 2.2) / 5) * 5),
      role,
      servings: getFoodServings(item),
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

  const handleAddCustom = () => {
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

  const renderFoodRow = (item, isOnline = false) => {
    const activeGrams = gramsByItemId[item.id] ?? item.defaultGrams ?? 100;
    const isExpanded = expandedItemId === item.id;
    const servings = getFoodServings(item);
    const f = activeGrams / 100;
    const prevC = Math.round((item.per100g?.carbs || 0) * f);
    const prevP = Math.round((item.per100g?.protein || 0) * f);
    const prevF = Math.round((item.per100g?.fat || 0) * f);
    const prevKcal = prevC * 4 + prevP * 4 + prevF * 9;

    return (
      <div key={item.id} className="food-picker-row">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span>{item.name}</span>
              {item.source && (
                <span
                  className="carb-badge low"
                  style={{ fontSize: '0.58rem', padding: '1px 6px', fontWeight: 700 }}
                >
                  {item.source}
                </span>
              )}
            </div>
            <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 2 }}>
              /100g: {item.per100g.carbs}C · {item.per100g.protein}P · {item.per100g.fat}F ·{' '}
              <strong>{formatFoodAmount(activeGrams, units)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{ padding: '4px 7px', fontSize: '0.68rem' }}
              onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
              aria-expanded={isExpanded}
              aria-label={`Choose serving for ${item.name}`}
              title="Choose household serving or exact weight"
            >
              <SlidersHorizontal size={12} /> {isExpanded ? 'Hide' : 'Serving'}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${isOnline ? 'btn-accent' : ''}`}
              onClick={() => emitFood(item, activeGrams)}
            >
              + {buttonLabel}
            </button>
          </div>
        </div>

        {/* Unit-first Household Serving Quick-Picks + Editable Weight */}
        {isExpanded && (
          <div className="serving-picker-drawer">
            <div className="serving-chips-row" role="group" aria-label={`Serving sizes for ${item.name}`}>
              {servings.map((srv) => {
                const isActive = Math.round(activeGrams) === Math.round(srv.grams);
                return (
                  <button
                    key={`${srv.label}-${srv.grams}`}
                    type="button"
                    className={`chip ${isActive ? 'chip-active' : ''}`}
                    style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                    onClick={() =>
                      setGramsByItemId((prev) => ({ ...prev, [item.id]: srv.grams }))
                    }
                  >
                    {srv.label} <span className="mono">({formatFoodAmount(srv.grams, units)})</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <label
                  htmlFor={`fp-amt-${item.id}`}
                  style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--ink-secondary)' }}
                >
                  Amount ({foodUnit}):
                </label>
                <NumericInput
                  id={`fp-amt-${item.id}`}
                  aria-label={`${item.name} amount`}
                  className="input mono"
                  style={{ width: 72, padding: '4px 7px', fontSize: '0.78rem', fontWeight: 700 }}
                  min={foodUnit === 'g' ? 1 : 0.1}
                  max={foodUnit === 'g' ? 2000 : 120}
                  step={foodUnit === 'g' ? 1 : 0.1}
                  fallback={gramsToFoodDisplay(item.defaultGrams || 100, units)}
                  value={gramsToFoodDisplay(activeGrams, units)}
                  onChange={(val) =>
                    setGramsByItemId((prev) => ({
                      ...prev,
                      [item.id]: Math.max(1, foodDisplayToGrams(val, units)),
                    }))
                  }
                />
              </div>
              <div className="mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-primary)' }}>
                <span style={{ color: 'var(--macro-carb)' }}>{prevC}g C</span> ·{' '}
                <span style={{ color: 'var(--macro-protein)' }}>{prevP}g P</span> ·{' '}
                <span style={{ color: 'var(--macro-fat)' }}>{prevF}g F</span> · {prevKcal} kcal
              </div>
            </div>
          </div>
        )}
      </div>
    );
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

      {/* Recent Foods 1-Tap Strip (remembers last-used portion) */}
      {recentFoods.length > 0 && !query.trim() && (
        <div>
          <div className="section-kicker" style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> Recent Foods (1-tap)
          </div>
          <div className="recent-foods-strip" role="group" aria-label="Recent foods">
            {recentFoods.map((rf) => (
              <button
                key={rf.id}
                type="button"
                className="chip"
                style={{ whiteSpace: 'nowrap', fontSize: '0.72rem', padding: '4px 9px' }}
                onClick={() => emitFood(rf, rf.defaultGrams)}
                title={`Log ${rf.name} (${formatFoodAmount(rf.defaultGrams, units)})`}
              >
                + {rf.name}{' '}
                <span className="mono" style={{ opacity: 0.72 }}>
                  ({formatFoodAmount(rf.defaultGrams, units)})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

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
            placeholder="Search foods or brands (Chobani, Clif, oats, Maurten...)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 2) {
                setOnlineResults([]);
                setOnlineSources([]);
                setOnlineWarning('');
                setHasSearchedOnline(false);
              }
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

      {/* Filter Pills: All · Whole Foods · Packaged */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div className="chip-row" role="group" aria-label="Food type filter">
          {[
            { id: 'all', label: 'All' },
            { id: 'whole', label: 'Whole Foods' },
            { id: 'packaged', label: 'Packaged' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`chip ${foodFilter === tab.id ? 'chip-active' : ''}`}
              style={{ padding: '3px 9px', fontSize: '0.7rem' }}
              onClick={() => setFoodFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setShowCustom((v) => !v)}
        >
          <Plus size={13} /> {showCustom ? 'Close Custom Food' : 'Write Custom Food'}
        </button>
      </div>

      {query.trim().length >= 2 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm btn-soft"
            disabled={searchingOnline}
            onClick={handleSearchOnline}
          >
            <Globe size={13} />{' '}
            {searchingOnline
              ? 'Searching USDA & Brands…'
              : `Search USDA & brands for "${query.trim()}"`}
          </button>
        </div>
      )}

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
              <NumericInput
                id="cf-g"
                step={foodUnit === 'g' ? 1 : 0.1}
                className="input mono"
                value={customAmount}
                onChange={setCustomAmount}
                min={0.1}
                max={1500}
                fallback={foodUnit === 'g' ? 100 : 3.5}
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
              <NumericInput
                id="cf-c"
                step={0.1}
                className="input mono"
                placeholder="0"
                min={0}
                max={100}
                allowEmpty
                value={customCarbs}
                onChange={setCustomCarbs}
              />
            </div>
            <div className="field">
              <label htmlFor="cf-p">Protein / 100g</label>
              <NumericInput
                id="cf-p"
                step={0.1}
                className="input mono"
                placeholder="0"
                min={0}
                max={100}
                allowEmpty
                value={customProt}
                onChange={setCustomProt}
              />
            </div>
            <div className="field full">
              <label htmlFor="cf-f">Fat / 100g</label>
              <NumericInput
                id="cf-f"
                step={0.1}
                className="input mono"
                placeholder="0"
                min={0}
                max={100}
                allowEmpty
                value={customFat}
                onChange={setCustomFat}
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

      {/* Online USDA FoodData Central + Open Food Facts results */}
      {hasSearchedOnline && onlineWarning && (
        <div className="notice-strip slate" style={{ fontSize: '0.75rem', padding: '8px 10px' }}>
          <span>{onlineWarning}</span>
        </div>
      )}

      {filteredOnlineResults.length > 0 && (
        <div>
          <div className="section-kicker" style={{ marginBottom: 6 }}>
            Online Database ({onlineSources.length > 0 ? onlineSources.join(' + ') : 'USDA + Brands'}) · {filteredOnlineResults.length} found
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
            {filteredOnlineResults.map((item) => renderFoodRow(item, true))}
          </div>
        </div>
      )}

      {/* Built-in Verified Whole Foods & Popular Brands */}
      <div>
        <div className="section-kicker" style={{ marginBottom: 6 }}>
          {query.trim()
            ? 'Instant Matches (USDA + Popular Brands)'
            : foodFilter === 'packaged'
            ? 'Popular Grocery & Cycling Brands'
            : 'Quick-Pick Whole Foods (USDA)'}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            maxHeight: 230,
            overflowY: 'auto',
          }}
        >
          {localResults.length === 0 ? (
            <div className="muted-text" style={{ fontSize: '0.76rem' }}>
              No instant match. Tap <strong>Search USDA &amp; brands</strong> above, <strong>Scan Barcode</strong>, or{' '}
              <strong>Write Custom Food</strong>.
            </div>
          ) : (
            localResults.map((item) => renderFoodRow(item, false))
          )}
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={scannerOpen}
        units={units}
        usdaApiKey={usdaApiKey}
        onClose={() => setScannerOpen(false)}
        onSelectFood={(food) => emitFood(food, food.grams, food.role)}
      />
    </div>
  );
}
