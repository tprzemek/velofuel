import { useState } from 'react';
import { Plus, Scale, Trash2, Check } from 'lucide-react';
import { scaleStapleToTargets } from '../engine/fuelingEngine';

const CARB_PRESETS = [
  { label: 'Cooked Jasmine / White Rice', carbs: 28.2, protein: 2.7, fat: 0.3, min: 100, max: 420 },
  { label: 'Dry Pasta', carbs: 74.7, protein: 13.0, fat: 1.5, min: 50, max: 170 },
  { label: 'Rolled Oats (dry)', carbs: 66.3, protein: 16.9, fat: 6.9, min: 35, max: 140 },
  { label: 'Sourdough Bread', carbs: 51.0, protein: 9.2, fat: 1.2, min: 45, max: 160 },
  { label: 'Roasted Potatoes', carbs: 20.1, protein: 2.2, fat: 0.1, min: 140, max: 480 },
  { label: 'Cooked Quinoa', carbs: 21.3, protein: 4.4, fat: 1.9, min: 100, max: 350 },
];

const PROTEIN_PRESETS = [
  { label: 'Chicken Breast (cooked)', carbs: 0, protein: 31.0, fat: 3.6, min: 100, max: 240 },
  { label: 'Salmon Fillet', carbs: 0, protein: 22.1, fat: 12.4, min: 110, max: 220 },
  { label: 'Lean Ground Beef / Turkey', carbs: 0, protein: 27.4, fat: 6.5, min: 100, max: 220 },
  { label: 'Whole Eggs + Whites', carbs: 0.8, protein: 12.2, fat: 6.2, min: 120, max: 280 },
  { label: '0% Greek Yogurt / Skyr', carbs: 3.8, protein: 10.3, fat: 0.4, min: 150, max: 340 },
  { label: 'Whey Isolate', carbs: 4.0, protein: 82.0, fat: 1.5, min: 25, max: 55 },
  { label: 'Firm Tofu', carbs: 2.0, protein: 15.0, fat: 8.0, min: 130, max: 280 },
];

export default function StaplesView({ staples, onAddStaple, onDeleteStaple }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [mealSlot, setMealSlot] = useState('dinner');
  const [carbIdx, setCarbIdx] = useState(0);
  const [protIdx, setProtIdx] = useState(0);
  const [baseLabel, setBaseLabel] = useState('Mixed Veg (150g) & Olive Oil (8g)');
  const [baseFat, setBaseFat] = useState(8);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const c = CARB_PRESETS[carbIdx];
    const p = PROTEIN_PRESETS[protIdx];

    onAddStaple({
      id: `staple-custom-${Date.now()}`,
      name: name.trim(),
      mealTypes: [mealSlot],
      prepNote: 'Custom home staple meal — scales automatically to your daily Carb Code.',
      carbLever: {
        name: c.label,
        unit: 'g',
        minGrams: c.min,
        maxGrams: c.max,
        defaultGrams: Math.round((c.min + c.max) / 2),
        per100g: { carbs: c.carbs, protein: c.protein, fat: c.fat, fiber: 3, iron: 1.5, calcium: 25, vitD: 0, magnesium: 35, sodium: 40 },
      },
      proteinAnchor: {
        name: p.label,
        unit: 'g',
        minGrams: p.min,
        maxGrams: p.max,
        defaultGrams: Math.round((p.min + p.max) / 2),
        per100g: { carbs: p.carbs, protein: p.protein, fat: p.fat, fiber: 0, iron: 1.4, calcium: 35, vitD: 1.0, magnesium: 26, sodium: 85 },
      },
      baseFixed: {
        label: baseLabel.trim() || 'Vegetables & Seasoning',
        carbs: 9,
        protein: 3,
        fat: Number(baseFat) || 6,
        micros: { fiber: 4.5, iron: 1.6, calcium: 60, vitD: 0, magnesium: 36, sodium: 240 },
      },
    });
    setName('');
    setShowAdd(false);
  };

  return (
    <>
      <section className="card">
        <div className="section-header">
          <div>
            <h1 className="section-title" style={{ fontSize: '1.08rem' }}>Your Home Staple Menu</h1>
            <p className="muted-text" style={{ marginTop: 3 }}>
              Keep eating the exact meals you already love. VeloFuel holds your protein floor steady and scales only your{' '}
              <strong>Carb Lever</strong> to match Rest, Moderate, or High-Intensity days.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus size={16} /> {showAdd ? 'Close Meal Builder' : 'Add Your Regular Home Meal'}
        </button>

        {showAdd && (
          <form onSubmit={handleCreate} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-hairline)' }}>
            <div className="field-grid">
              <div className="field full">
                <label htmlFor="staple-name">Meal Name</label>
                <input
                  id="staple-name"
                  className="input"
                  placeholder="e.g., Steak, Sweet Potato & Greens"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="staple-slot">Usual Slot</label>
                <select id="staple-slot" className="select" value={mealSlot} onChange={(e) => setMealSlot(e.target.value)}>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="snack">Snack / Recovery</option>
                  <option value="dinner">Dinner</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="staple-oil">Added Oil / Fat (g)</label>
                <input
                  id="staple-oil"
                  type="number"
                  className="input mono"
                  value={baseFat}
                  onChange={(e) => setBaseFat(e.target.value)}
                  min={0}
                  max={30}
                />
              </div>

              <div className="field full">
                <label htmlFor="staple-carb">Carb Lever (Scales with Training)</label>
                <select id="staple-carb" className="select" value={carbIdx} onChange={(e) => setCarbIdx(Number(e.target.value))}>
                  {CARB_PRESETS.map((c, i) => (
                    <option key={c.label} value={i}>{c.label} ({c.carbs}g C / 100g)</option>
                  ))}
                </select>
              </div>

              <div className="field full">
                <label htmlFor="staple-prot">Protein Anchor (Protects Muscle)</label>
                <select id="staple-prot" className="select" value={protIdx} onChange={(e) => setProtIdx(Number(e.target.value))}>
                  {PROTEIN_PRESETS.map((p, i) => (
                    <option key={p.label} value={i}>{p.label} ({p.protein}g P / 100g)</option>
                  ))}
                </select>
              </div>

              <div className="field full">
                <label htmlFor="staple-base">Fixed Veg / Toppings</label>
                <input
                  id="staple-base"
                  className="input"
                  value={baseLabel}
                  onChange={(e) => setBaseLabel(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-accent btn-block" style={{ marginTop: 12 }}>
              <Check size={16} /> Save to My Staples
            </button>
          </form>
        )}
      </section>

      {staples.map((staple) => {
        const restScale = scaleStapleToTargets(staple, 45, 42);
        const modScale = scaleStapleToTargets(staple, 85, 42);
        const highScale = scaleStapleToTargets(staple, 125, 42);

        return (
          <article className="card" key={staple.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <h2 className="session-title">{staple.name}</h2>
                <p className="muted-text" style={{ marginTop: 3, fontSize: '0.76rem' }}>
                  {staple.prepNote}
                </p>
              </div>
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

            <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--ink-secondary)' }}>
              <Scale size={12} style={{ verticalAlign: '-2px', marginRight: 5, color: 'var(--code-high)' }} />
              <strong>Levers:</strong> {staple.carbLever.name} + {staple.proteinAnchor.name}
            </div>

            <div className="staple-preview-grid">
              <div className="staple-tier">
                <span className="carb-badge low" style={{ marginBottom: 6 }}>REST</span>
                <div className="mono" style={{ fontWeight: 800, fontSize: '0.84rem' }}>{restScale.carbGrams}g</div>
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.67rem' }}>carb lever</div>
                <div className="mono" style={{ marginTop: 4, fontSize: '0.7rem', color: 'var(--ink-secondary)' }}>
                  {restScale.carbs}C · {restScale.protein}P
                </div>
              </div>
              <div className="staple-tier">
                <span className="carb-badge med" style={{ marginBottom: 6 }}>MED</span>
                <div className="mono" style={{ fontWeight: 800, fontSize: '0.84rem' }}>{modScale.carbGrams}g</div>
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.67rem' }}>carb lever</div>
                <div className="mono" style={{ marginTop: 4, fontSize: '0.7rem', color: 'var(--ink-secondary)' }}>
                  {modScale.carbs}C · {modScale.protein}P
                </div>
              </div>
              <div className="staple-tier">
                <span className="carb-badge high" style={{ marginBottom: 6 }}>HIGH</span>
                <div className="mono" style={{ fontWeight: 800, fontSize: '0.84rem' }}>{highScale.carbGrams}g</div>
                <div style={{ color: 'var(--ink-muted)', fontSize: '0.67rem' }}>carb lever</div>
                <div className="mono" style={{ marginTop: 4, fontSize: '0.7rem', color: 'var(--ink-secondary)' }}>
                  {highScale.carbs}C · {highScale.protein}P
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
}
