import { useState } from 'react';
import { Plus, Scale, Trash2, Check, Pencil, X } from 'lucide-react';
import { computeStapleNutrition, scaleStapleToTargets } from '../engine/fuelingEngine';
import FoodPickerPanel from './FoodPickerPanel';

const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'snack', label: 'Snack' },
  { id: 'dinner', label: 'Dinner' },
];

const ROLE_CYCLE = {
  fixed: { next: 'carb', label: 'Fixed', color: 'var(--ink-secondary)', bg: 'var(--bg-subtle)' },
  carb: { next: 'protein', label: 'Scales Carbs ↕', color: 'var(--code-high)', bg: 'var(--code-high-bg)' },
  protein: { next: 'fixed', label: 'Scales Protein ↕', color: 'var(--macro-protein)', bg: 'rgba(37,94,138,0.12)' },
};

export default function StaplesView({ staples, onSaveStaple, onDeleteStaple }) {
  const [editor, setEditor] = useState(null); // null or { id, name, mealTypes, prepNote, ingredients }

  const openNew = () => {
    setEditor({
      id: `staple-${Date.now()}`,
      name: '',
      mealTypes: ['breakfast'],
      prepNote: '',
      ingredients: [],
    });
  };

  const openEdit = (staple) => {
    setEditor({
      id: staple.id,
      name: staple.name,
      mealTypes: Array.isArray(staple.mealTypes) && staple.mealTypes.length ? [...staple.mealTypes] : ['dinner'],
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
    onSaveStaple({
      id: editor.id,
      name: editor.name.trim(),
      mealTypes: editor.mealTypes,
      prepNote: editor.prepNote.trim() || `${editor.ingredients.length} ingredients — scales automatically to your day.`,
      ingredients: editor.ingredients,
    });
    setEditor(null);
  };

  const editorTotals = editor ? computeStapleNutrition(editor) : null;

  return (
    <>
      <section className="card">
        <div className="section-header">
          <div>
            <h1 className="section-title" style={{ fontSize: '1.08rem' }}>Your Home Staple Menu</h1>
            <p className="muted-text" style={{ marginTop: 3 }}>
              Build your real meals freely — just Oats &amp; Berries, or a full dinner. Search whole foods,{' '}
              <strong>scan barcodes</strong>, or write custom items, and choose which ingredients scale with your rides.
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
              <Plus size={16} /> Create New Home Meal
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
                {staples.some((s) => s.id === editor.id) ? 'Edit Home Meal' : 'New Home Meal'}
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

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-secondary)', marginBottom: 6 }}>
                Usually eaten for
              </div>
              <div className="chip-row">
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

            {/* Current Ingredients in this Meal */}
            <div style={{ marginBottom: 12 }}>
              <div className="section-header" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 800 }}>
                  Ingredients ({editor.ingredients.length})
                </span>
                {editorTotals && editor.ingredients.length > 0 && (
                  <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)' }}>
                    {editorTotals.kcal} kcal · {editorTotals.carbs}C · {editorTotals.protein}P · {editorTotals.fat}F
                  </span>
                )}
              </div>

              {editor.ingredients.length === 0 ? (
                <div className="notice-strip slate" style={{ fontSize: '0.76rem' }}>
                  No ingredients yet — search below, scan a barcode, or write a custom food to add what you eat.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {editor.ingredients.map((ing) => {
                    const roleMeta = ROLE_CYCLE[ing.role] || ROLE_CYCLE.fixed;
                    return (
                      <div
                        key={ing.id}
                        style={{
                          background: 'var(--bg-canvas)',
                          borderRadius: 11,
                          padding: '9px 10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{ing.name}</span>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => removeIngredient(ing.id)}
                            aria-label={`Remove ${ing.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              min={1}
                              max={1500}
                              step={5}
                              className="input mono"
                              style={{ width: 78, padding: '5px 8px', fontSize: '0.8rem' }}
                              value={ing.grams}
                              onChange={(e) => {
                                const g = Math.max(1, Number(e.target.value) || 0);
                                updateIngredient(ing.id, {
                                  grams: g,
                                  minGrams: Math.max(5, Math.round((g * 0.4) / 5) * 5),
                                  maxGrams: Math.max(g + 80, Math.round((g * 2.2) / 5) * 5),
                                });
                              }}
                            />
                            <span style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>g</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => updateIngredient(ing.id, { role: roleMeta.next })}
                            style={{
                              border: 'none',
                              borderRadius: 999,
                              padding: '4px 10px',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              background: roleMeta.bg,
                              color: roleMeta.color,
                            }}
                            title="Tap to change whether this ingredient auto-scales on hard vs rest days"
                          >
                            {roleMeta.label}
                          </button>

                          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginLeft: 'auto' }}>
                            {Math.round((ing.per100g.carbs * ing.grams) / 100)}C ·{' '}
                            {Math.round((ing.per100g.protein * ing.grams) / 100)}P ·{' '}
                            {Math.round((ing.per100g.fat * ing.grams) / 100)}F
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="muted-text" style={{ fontSize: '0.71rem' }}>
                    Tip: Tap any badge (<strong>Fixed</strong> / <strong>Scales Carbs ↕</strong> /{' '}
                    <strong>Scales Protein ↕</strong>) to choose which ingredients adjust automatically for your ride.
                  </div>
                </div>
              )}
            </div>

            <div className="divider" />

            {/* Add Ingredients via Search / Barcode / Custom */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, marginBottom: 8 }}>
                Add Ingredient (Search · Barcode · Custom)
              </div>
              <FoodPickerPanel onAddIngredient={addIngredient} buttonLabel="Add" />
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

        return (
          <article className="card" key={staple.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <h2 className="session-title">{staple.name}</h2>
                <div className="muted-text" style={{ marginTop: 3, fontSize: '0.75rem' }}>
                  {(staple.ingredients || []).map((i) => i.name).join(' · ')}
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
              {primaryCarb ? (
                <>
                  Auto-scales <strong>{primaryCarb.name}</strong>
                  {(staple.ingredients || []).some((i) => i.role === 'protein') && (
                    <>
                      {' '}
                      +{' '}
                      <strong>
                        {(staple.ingredients || []).find((i) => i.role === 'protein')?.name}
                      </strong>
                    </>
                  )}
                </>
              ) : (
                <>Fixed portion meal (tap Edit to let any carb or protein item auto-scale)</>
              )}
            </div>

            <div className="staple-preview-grid">
              {[
                ['REST', 'low', restScale],
                ['MED', 'med', modScale],
                ['HIGH', 'high', highScale],
              ].map(([lbl, cls, sc]) => {
                const carbVal = primaryCarb ? sc.gramsById[primaryCarb.id] : null;
                return (
                  <div className="staple-tier" key={lbl}>
                    <span className={`carb-badge ${cls}`} style={{ marginBottom: 6 }}>
                      {lbl}
                    </span>
                    <div className="mono" style={{ fontWeight: 800, fontSize: '0.84rem' }}>
                      {carbVal != null ? `${carbVal}g` : `${sc.kcal} kcal`}
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
