import { useState } from 'react';
import { Plus, Scale, Trash2, Check, Pencil, X, Pin } from 'lucide-react';
import { computeStapleNutrition, scaleStapleToTargets } from '../engine/fuelingEngine';
import { foodDisplayToGrams, foodUnitLabel, formatFoodAmount, gramsToFoodDisplay } from '../engine/units';
import FoodPickerPanel from './FoodPickerPanel';
import NumericInput from './NumericInput';

const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'snack', label: 'Snack' },
  { id: 'dinner', label: 'Dinner' },
];

const PORTION_MODES = [
  { value: 'fixed', label: 'Keep same amount' },
  { value: 'carb', label: 'Auto-adjust for ride (Carbs)' },
  { value: 'protein', label: 'Auto-adjust for muscle (Protein)' },
];

export default function StaplesView({ staples, units, usdaApiKey = '', onSaveStaple, onDeleteStaple }) {
  const [editor, setEditor] = useState(null);
  const foodUnit = foodUnitLabel(units);

  const openNew = () => {
    setEditor({
      id: `staple-${Date.now()}`,
      name: '',
      mealTypes: ['breakfast'],
      dailySlot: '',
      prepNote: '',
      ingredients: [],
    });
  };

  const openEdit = (staple) => {
    setEditor({
      id: staple.id,
      name: staple.name,
      mealTypes: Array.isArray(staple.mealTypes) && staple.mealTypes.length ? [...staple.mealTypes] : ['dinner'],
      dailySlot: staple.dailySlot || '',
      prepNote: staple.prepNote || '',
      ingredients: (staple.ingredients || []).map((i) => ({ ...i })),
    });
  };

  const toggleSlot = (slotId) => {
    setEditor((prev) => {
      const has = prev.mealTypes.includes(slotId);
      const next = has ? prev.mealTypes.filter((s) => s !== slotId) : [...prev.mealTypes, slotId];
      return { ...prev, mealTypes: next.length ? next : [slotId] };
    });
  };

  const addIngredient = (ing) => {
    setEditor((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, ing],
    }));
  };

  const updateIngredient = (ingId, patch) => {
    setEditor((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) => (i.id === ingId ? { ...i, ...patch } : i)),
    }));
  };

  const removeIngredient = (ingId) => {
    setEditor((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((i) => i.id !== ingId),
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!editor || !editor.name.trim() || editor.ingredients.length === 0) return;
    const sanitized = editor.ingredients.map((i) => {
      const g = Math.max(1, Number(i.grams) || 50);
      return {
        ...i,
        grams: g,
        minGrams: Math.max(5, Math.round((g * 0.4) / 5) * 5),
        maxGrams: Math.max(g + 80, Math.round((g * 2.2) / 5) * 5),
      };
    });
    const finalMealTypes =
      editor.dailySlot && !editor.mealTypes.includes(editor.dailySlot)
        ? [...editor.mealTypes, editor.dailySlot]
        : editor.mealTypes;

    onSaveStaple({
      id: editor.id,
      name: editor.name.trim(),
      mealTypes: finalMealTypes,
      dailySlot: editor.dailySlot || null,
      prepNote: editor.prepNote.trim() || `${sanitized.length} ingredients — adjusts automatically to your rides.`,
      ingredients: sanitized,
    });
    setEditor(null);
  };

  const editorTotals = editor ? computeStapleNutrition(editor) : null;

  return (
    <>
      <section className="card">
        <div className="section-header">
          <div>
            <h1 className="section-title" style={{ fontSize: '1.08rem' }}>Your Saved Meals</h1>
            <p className="muted-text" style={{ marginTop: 3 }}>
              Save the meals you eat regularly — scan barcodes to build them fast, and <strong>pin your everyday meals</strong>{' '}
              (like breakfast) for 1-tap logging on Today.
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={editor ? () => setEditor(null) : openNew}>
          {editor ? (
            <>
              <X size={16} /> Close Meal Editor
            </>
          ) : (
            <>
              <Plus size={16} /> Create New Saved Meal
            </>
          )}
        </button>
      </section>

      {/* Flexible Meal Builder / Editor */}
      {editor && (
        <section className="card" style={{ borderColor: 'var(--code-high)' }}>
          <form onSubmit={handleSave}>
            <div className="section-header">
              <h2 className="section-title">
                {staples.some((s) => s.id === editor.id) ? 'Edit Saved Meal' : 'New Saved Meal'}
              </h2>
              <button type="button" className="icon-btn" onClick={() => setEditor(null)} aria-label="Close editor">
                <X size={16} />
              </button>
            </div>

            <div className="field" style={{ marginBottom: 10 }}>
              <label htmlFor="ed-name">Meal Name</label>
              <input
                id="ed-name"
                className="input"
                placeholder="e.g., Morning Oats & Berries"
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                required
              />
            </div>

            <div className="field-grid" style={{ marginBottom: 12 }}>
              <div className="field full">
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
                  Usually eaten for
                </span>
                <div className="chip-row" style={{ marginTop: 4 }}>
                  {MEAL_SLOTS.map((s) => {
                    const active = editor.mealTypes.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className="chip"
                        style={
                          active
                            ? { background: 'var(--bg-carbon)', color: '#fff', borderColor: 'var(--bg-carbon)' }
                            : undefined
                        }
                        onClick={() => toggleSlot(s.id)}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field full">
                <label htmlFor="ed-daily-slot">Pin for 1-Tap Daily Logging (optional)</label>
                <select
                  id="ed-daily-slot"
                  className="select"
                  value={editor.dailySlot || ''}
                  onChange={(e) => setEditor({ ...editor, dailySlot: e.target.value })}
                >
                  <option value="">Not pinned (pick manually)</option>
                  <option value="breakfast">My Usual Daily Breakfast</option>
                  <option value="lunch">My Usual Daily Lunch</option>
                  <option value="snack">My Usual Daily Snack</option>
                  <option value="dinner">My Usual Daily Dinner</option>
                </select>
              </div>
            </div>

            {/* Current Ingredients in this Meal */}
            <div style={{ marginBottom: 12 }}>
              <div className="section-header" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                  Ingredients ({editor.ingredients.length})
                </span>
                {editorTotals && editor.ingredients.length > 0 && (
                  <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)' }}>
                    {editorTotals.kcal} kcal · {editorTotals.carbs}C · {editorTotals.protein}P · {editorTotals.fat}F
                  </span>
                )}
              </div>

              <p className="muted-text" style={{ fontSize: '0.73rem', marginBottom: 8 }}>
                Enter your normal portion in {foodUnit}. Set your main carb (like oats or rice) to{' '}
                <strong>Auto-adjust for ride</strong> so VeloFuel gives you more on hard ride days and less on rest days.
              </p>

              {editor.ingredients.length === 0 ? (
                <div className="notice-strip slate" style={{ fontSize: '0.76rem' }}>
                  No ingredients yet — scan a barcode below, search foods, or write a custom item.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {editor.ingredients.map((ing) => (
                    <div
                      key={ing.id}
                      style={{
                        background: 'var(--bg-canvas)',
                        borderRadius: 11,
                        padding: '10px 11px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 7,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.83rem' }}>{ing.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                            {Math.round(((ing.per100g?.carbs || 0) * (Number(ing.grams) || 0)) / 100)}C ·{' '}
                            {Math.round(((ing.per100g?.protein || 0) * (Number(ing.grams) || 0)) / 100)}P ·{' '}
                            {Math.round(((ing.per100g?.fat || 0) * (Number(ing.grams) || 0)) / 100)}F
                          </span>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => removeIngredient(ing.id)}
                            aria-label={`Remove ${ing.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <NumericInput
                            aria-label={`${ing.name} grams`}
                            className="input mono"
                            style={{ width: 74, padding: '6px 8px', fontSize: '0.82rem', background: 'var(--bg-surface)' }}
                            value={gramsToFoodDisplay(ing.grams, units)}
                            min={foodUnit === 'g' ? 1 : 0.1}
                            max={foodUnit === 'g' ? 1500 : 100}
                            step={foodUnit === 'g' ? 1 : 0.1}
                            fallback={foodUnit === 'g' ? 50 : 2}
                            onChange={(val) => {
                              const canonicalG = Math.max(1, foodDisplayToGrams(val, units));
                              updateIngredient(ing.id, {
                                grams: canonicalG,
                                minGrams: Math.max(5, Math.round((canonicalG * 0.4) / 5) * 5),
                                maxGrams: Math.max(canonicalG + 80, Math.round((canonicalG * 2.2) / 5) * 5),
                              });
                            }}
                          />
                          <span style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', fontWeight: 600 }}>{foodUnit}</span>
                        </div>

                        <select
                          aria-label={`${ing.name} portion behavior`}
                          className="select"
                          style={{ padding: '6px 8px', fontSize: '0.76rem', background: 'var(--bg-surface)', flex: 1 }}
                          value={ing.role || 'fixed'}
                          onChange={(e) => updateIngredient(ing.id, { role: e.target.value })}
                        >
                          {PORTION_MODES.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="divider" />

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, marginBottom: 8 }}>
                Add Ingredient (Scan Barcode · Search · Custom)
              </div>
              <FoodPickerPanel onAddIngredient={addIngredient} buttonLabel="Add" units={units} usdaApiKey={usdaApiKey} />
            </div>

            <button
              type="submit"
              className="btn btn-accent btn-block"
              disabled={!editor.name.trim() || editor.ingredients.length === 0}
            >
              <Check size={16} /> Save Home Meal ({editor.ingredients.length} items)
            </button>
          </form>
        </section>
      )}

      {/* Existing Staples List */}
      {staples.map((staple) => {
        const restScale = scaleStapleToTargets(staple, 45, 40);
        const modScale = scaleStapleToTargets(staple, 85, 40);
        const highScale = scaleStapleToTargets(staple, 125, 40);
        const primaryCarb = (staple.ingredients || []).find((i) => i.role === 'carb');
        const primaryProt = (staple.ingredients || []).find((i) => i.role === 'protein');

        return (
          <article className="card" key={staple.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <h2 className="session-title">{staple.name}</h2>
                  {staple.dailySlot && (
                    <span className="carb-badge high" style={{ fontSize: '0.62rem' }}>
                      <Pin size={10} /> Daily {staple.dailySlot}
                    </span>
                  )}
                </div>
                <div className="muted-text" style={{ marginTop: 3, fontSize: '0.75rem' }}>
                  {(staple.ingredients || []).map((i) => `${formatFoodAmount(i.grams, units)} ${i.name}`).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => openEdit(staple)}
                  aria-label={`Edit ${staple.name}`}
                >
                  <Pencil size={13} /> Edit
                </button>
                {staples.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => onDeleteStaple(staple.id)}
                    aria-label={`Delete ${staple.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: 8, fontSize: '0.73rem', color: 'var(--ink-secondary)' }}>
              <Scale size={12} style={{ verticalAlign: '-2px', marginRight: 5, color: 'var(--code-high)' }} />
              {primaryCarb || primaryProt ? (
                <>
                  Portion adjusts automatically for your ride:{' '}
                  <strong>
                    {[primaryCarb?.name, primaryProt?.name].filter(Boolean).join(' + ')}
                  </strong>
                </>
              ) : (
                <>Always keeps the same portion sizes (tap Edit to let an ingredient adjust with rides)</>
              )}
            </div>

            <div className="staple-preview-grid">
              {[
                ['REST DAY', 'low', restScale],
                ['MED DAY', 'med', modScale],
                ['HARD DAY', 'high', highScale],
              ].map(([lbl, cls, sc]) => {
                const carbVal = primaryCarb ? sc.gramsById[primaryCarb.id] : null;
                return (
                  <div className="staple-tier" key={lbl}>
                    <span className={`carb-badge ${cls}`} style={{ marginBottom: 6 }}>
                      {lbl}
                    </span>
                    <div className="mono" style={{ fontWeight: 800, fontSize: '0.84rem' }}>
                      {carbVal != null ? formatFoodAmount(carbVal, units) : `${sc.kcal} kcal`}
                    </div>
                    <div style={{ color: 'var(--ink-muted)', fontSize: '0.67rem' }}>
                      {primaryCarb ? primaryCarb.name.split(' ')[0] : 'total'}
                    </div>
                    <div className="mono" style={{ marginTop: 4, fontSize: '0.7rem', color: 'var(--ink-secondary)' }}>
                      {sc.carbs}C · {sc.protein}P
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </>
  );
}
