import { useState, useRef } from 'react';
import { Camera, Sparkles, X, Check, AlertCircle, Utensils } from 'lucide-react';
import { estimateMealLocally } from '../engine/localMealEstimator';

const QUICK_WORK_PRESETS = [
  'Cafeteria grilled chicken, 1.5 cups white rice, roasted veggies',
  'Turkey avocado sourdough sandwich, side salad, apple',
  'Salmon poke bowl with rice, edamame and spicy mayo',
  'Large pasta bolognese with parmesan and bread roll',
];

export default function WorkMealModal({
  isOpen,
  onClose,
  slotInfo,
  aiConfig,
  onLogEntry,
}) {
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoMime, setPhotoMime] = useState('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [portionScale, setPortionScale] = useState(1.0);
  const fileRef = useRef(null);

  if (!isOpen || !slotInfo) return null;

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoMime(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const estimateWithGeminiDirect = async (apiKey, queryText, imgDataUrl, mime) => {
    const prompt = `You are a cycling nutrition coach estimating a meal eaten at work where exact weights are unknown. Return ONLY valid JSON with: title (max 45 chars), items ([{name, estimatedGrams, carbs, protein, fat, kcal}]), carbs, protein, fat, kcal, uncertaintyPct (15-28), micros ({fiber, iron, calcium, vitD, magnesium, sodium}), notes (1 short plain-English sentence). Account realistically for cafeteria/restaurant cooking oil and sauces. Meal description: "${queryText || 'Analyze the uploaded meal photo.'}"`;
    const parts = [{ text: prompt }];
    if (imgDataUrl) {
      parts.push({
        inline_data: {
          mime_type: mime || 'image/jpeg',
          data: imgDataUrl.replace(/^data:[^;]+;base64,/, ''),
        },
      });
    }
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      }
    );
    if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}`);
    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Empty AI response');
    return { ...JSON.parse(raw), engine: 'gemini-2.5-flash (direct)' };
  };

  const handleEstimate = async (overrideText) => {
    const queryText = overrideText !== undefined ? overrideText : description;
    if (!queryText.trim() && !photoDataUrl) {
      setError('Describe what you ate or snap a photo of your plate.');
      return;
    }
    setLoading(true);
    setError('');
    setWarning('');
    try {
      let result = null;
      const hasLocalNodeApi = window.location.port === '3001' || window.location.port === '5173';
      if (hasLocalNodeApi) {
        try {
          const resp = await fetch('./api/estimate-meal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: queryText,
              imageBase64: photoDataUrl || '',
              imageMimeType: photoMime,
              contextHint: 'work cafeteria meal',
              aiProvider: aiConfig?.provider || 'auto',
              aiApiKey: aiConfig?.apiKey || '',
            }),
          });
          const ct = resp.headers.get('content-type') || '';
          if (resp.ok && ct.includes('application/json')) {
            const data = await resp.json();
            if (data.ok) {
              result = data.estimate;
              if (data.warning) setWarning(data.warning);
            }
          }
        } catch {
          // fall through to direct browser estimation
        }
      }
      if (!result && aiConfig?.apiKey?.trim() && (aiConfig.provider === 'gemini' || aiConfig.provider === 'auto')) {
        try {
          result = await estimateWithGeminiDirect(aiConfig.apiKey.trim(), queryText, photoDataUrl, photoMime);
        } catch (aiErr) {
          setWarning(`Vision AI error (${aiErr.message}) — used built-in food estimator instead.`);
        }
      }
      if (!result) {
        result = estimateMealLocally(queryText, Boolean(photoDataUrl), 'work cafeteria meal');
      }
      setEstimate(result);
      setPortionScale(1.0);
    } finally {
      setLoading(false);
    }
  };

  const scaled = estimate
    ? {
        carbs: Math.round((estimate.carbs || 0) * portionScale),
        protein: Math.round((estimate.protein || 0) * portionScale),
        fat: Math.round((estimate.fat || 0) * portionScale),
        kcal: Math.round((estimate.kcal || 0) * portionScale),
        uncertaintyPct: estimate.uncertaintyPct || 20,
      }
    : null;

  const handleConfirm = () => {
    if (!estimate || !scaled) return;
    const itemSummary = (estimate.items || [])
      .map((i) => `${i.name} (~${Math.round((i.estimatedGrams || 0) * portionScale)}g)`)
      .join(' · ');

    const micros = estimate.micros || {};
    onLogEntry({
      id: `log-work-${Date.now()}`,
      slot: slotInfo.slot,
      type: 'work_estimate',
      title: estimate.title || 'Work Meal (Estimated)',
      detail: itemSummary || description || 'Estimated work meal',
      carbs: scaled.carbs,
      protein: scaled.protein,
      fat: scaled.fat,
      kcal: scaled.kcal,
      uncertaintyPct: scaled.uncertaintyPct,
      micros: {
        fiber: Number(((micros.fiber || 0) * portionScale).toFixed(1)),
        iron: Number(((micros.iron || 0) * portionScale).toFixed(1)),
        calcium: Math.round((micros.calcium || 0) * portionScale),
        vitD: Number(((micros.vitD || 0) * portionScale).toFixed(1)),
        magnesium: Math.round((micros.magnesium || 0) * portionScale),
        sodium: Math.round((micros.sodium || 0) * portionScale),
      },
      loggedAt: new Date().toTimeString().slice(0, 5),
    });

    setDescription('');
    setPhotoDataUrl('');
    setEstimate(null);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Estimate Work Meal">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Work Meal Estimator · {slotInfo.label}</h2>
            <div className="muted-text" style={{ marginTop: 2 }}>
              No scale needed — logs with a ±% confidence band so Home Dinner compensates.
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="field" style={{ marginBottom: 10 }}>
          <label htmlFor="work-meal-text">Describe your plate (text or voice dictate on phone)</label>
          <textarea
            id="work-meal-text"
            className="textarea"
            placeholder="e.g., Cafeteria grilled chicken breast, ~1.5 cups jasmine rice, roasted broccoli with olive oil, small sourdough roll..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="chip-row" style={{ marginBottom: 12 }}>
          {QUICK_WORK_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="chip"
              onClick={() => {
                setDescription(preset);
                handleEstimate(preset);
              }}
            >
              {preset.slice(0, 34)}…
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
          />
          <button
            type="button"
            className="btn"
            style={{ flex: 1 }}
            onClick={() => fileRef.current?.click()}
          >
            <Camera size={16} /> {photoDataUrl ? 'Replace Plate Photo' : 'Snap / Upload Photo'}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            style={{ flex: 1 }}
            disabled={loading}
            onClick={() => handleEstimate()}
          >
            <Sparkles size={16} /> {loading ? 'Estimating…' : 'Estimate Macros'}
          </button>
        </div>

        {photoDataUrl && (
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <img src={photoDataUrl} alt="Uploaded work meal plate" className="photo-preview" />
            <button
              type="button"
              className="btn btn-sm"
              style={{ position: 'absolute', top: 8, right: 8 }}
              onClick={() => setPhotoDataUrl('')}
            >
              Remove
            </button>
          </div>
        )}

        {error && (
          <div className="notice-strip" style={{ marginBottom: 10 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        {warning && (
          <div className="notice-strip slate" style={{ marginBottom: 10 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{warning}</span>
          </div>
        )}

        {estimate && scaled && (
          <div className="card" style={{ background: 'var(--bg-canvas)', boxShadow: 'none', marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.88rem' }}>
                <Utensils size={15} color="var(--code-med)" />
                <span>{estimate.title}</span>
              </div>
              <span className="est-tag mono">±{scaled.uncertaintyPct}% est</span>
            </div>

            <div className="stat-pair-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 10 }}>
              <div className="mini-stat" style={{ background: 'var(--bg-surface)' }}>
                <div className="mini-stat-label">Kcal</div>
                <div className="mini-stat-val mono">{scaled.kcal}</div>
              </div>
              <div className="mini-stat" style={{ background: 'var(--bg-surface)' }}>
                <div className="mini-stat-label">Carbs</div>
                <div className="mini-stat-val mono" style={{ color: 'var(--macro-carb)' }}>
                  {scaled.carbs}g
                </div>
              </div>
              <div className="mini-stat" style={{ background: 'var(--bg-surface)' }}>
                <div className="mini-stat-label">Protein</div>
                <div className="mini-stat-val mono" style={{ color: 'var(--macro-protein)' }}>
                  {scaled.protein}g
                </div>
              </div>
              <div className="mini-stat" style={{ background: 'var(--bg-surface)' }}>
                <div className="mini-stat-label">Fat</div>
                <div className="mini-stat-val mono" style={{ color: 'var(--macro-fat)' }}>
                  {scaled.fat}g
                </div>
              </div>
            </div>

            {estimate.items?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                {estimate.items.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      color: 'var(--ink-secondary)',
                    }}
                  >
                    <span>
                      {item.name} (~{Math.round((item.estimatedGrams || 0) * portionScale)}g)
                    </span>
                    <span className="mono">
                      {Math.round((item.carbs || 0) * portionScale)}C · {Math.round((item.protein || 0) * portionScale)}P ·{' '}
                      {Math.round((item.fat || 0) * portionScale)}F
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="range-row" style={{ marginBottom: 10 }}>
              <div className="range-head">
                <span style={{ fontWeight: 700, fontSize: '0.76rem' }}>Portion Reality Check</span>
                <span className="mono" style={{ fontWeight: 700 }}>
                  {Math.round(portionScale * 100)}% {portionScale < 0.9 ? '(Smaller)' : portionScale > 1.1 ? '(Heaping)' : '(Standard)'}
                </span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.5}
                step={0.05}
                value={portionScale}
                onChange={(e) => setPortionScale(Number(e.target.value))}
              />
            </div>

            {estimate.notes && (
              <p className="muted-text" style={{ fontSize: '0.73rem', marginBottom: 10 }}>
                {estimate.notes}
              </p>
            )}

            <div style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginBottom: 10 }}>
              Engine: <span className="mono">{estimate.engine}</span>
            </div>

            <button type="button" className="btn btn-primary btn-block" onClick={handleConfirm}>
              <Check size={16} /> Log Work Meal & Auto-Adjust Evening Dinner
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
