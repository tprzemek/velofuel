import { useState, useRef } from 'react';
import { Camera, Sparkles, X, Check, AlertCircle, Utensils } from 'lucide-react';
import { estimateMealLocally } from '../engine/localMealEstimator';
import NumericInput from './NumericInput';

const QUICK_WORK_PRESETS = [
  'Grilled chicken breast, 1.5 cups jasmine rice, roasted broccoli',
  'Turkey avocado sandwich, side salad, apple',
  'Salmon poke bowl with spicy mayo',
  'Pasta bolognese with parmesan and bread roll',
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
  const [manualOverride, setManualOverride] = useState(null);
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

  const buildAiPrompt = (queryText) =>
    `You are a cycling nutrition coach estimating a meal eaten at work where exact weights are unknown. Return ONLY valid JSON with: title (max 45 chars), items ([{name, estimatedGrams, carbs, protein, fat, kcal}]), carbs, protein, fat, kcal, uncertaintyPct (15-25), micros ({fiber, iron, vitC, calcium, vitD, magnesium, sodium}), notes (1 short plain-English sentence). Account realistically for restaurant/cafeteria cooking oil and sauces. Meal description: "${queryText || 'Analyze the uploaded meal photo.'}"`;

  const estimateWithGeminiDirect = async (apiKey, queryText, imgDataUrl, mime) => {
    const parts = [{ text: buildAiPrompt(queryText) }];
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
    return { ...JSON.parse(raw), engine: 'Gemini 2.5 Flash AI' };
  };

  const estimateWithOpenAiDirect = async (apiKey, queryText, imgDataUrl) => {
    const content = [{ type: 'text', text: buildAiPrompt(queryText) }];
    if (imgDataUrl) {
      content.push({ type: 'image_url', image_url: { url: imgDataUrl } });
    }
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content }],
      }),
    });
    if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}`);
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty AI response');
    return { ...JSON.parse(raw), engine: 'OpenAI GPT-4o-mini AI' };
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
    setManualOverride(null);
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
      if (!result && aiConfig?.apiKey?.trim()) {
        try {
          if (aiConfig.provider === 'openai') {
            result = await estimateWithOpenAiDirect(aiConfig.apiKey.trim(), queryText, photoDataUrl);
          } else {
            result = await estimateWithGeminiDirect(aiConfig.apiKey.trim(), queryText, photoDataUrl, photoMime);
          }
        } catch (aiErr) {
          setWarning(`AI API error (${aiErr.message}) — fell back to built-in USDA food matcher.`);
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

  const baseScaled = estimate
    ? {
        carbs: Math.round((estimate.carbs || 0) * portionScale),
        protein: Math.round((estimate.protein || 0) * portionScale),
        fat: Math.round((estimate.fat || 0) * portionScale),
        uncertaintyPct: estimate.uncertaintyPct || 20,
      }
    : null;

  const finalMacros = baseScaled
    ? (() => {
        const carbs = manualOverride?.carbs ?? baseScaled.carbs;
        const protein = manualOverride?.protein ?? baseScaled.protein;
        const fat = manualOverride?.fat ?? baseScaled.fat;
        return {
          carbs,
          protein,
          fat,
          kcal: Math.round(carbs * 4 + protein * 4 + fat * 9),
          uncertaintyPct: baseScaled.uncertaintyPct,
        };
      })()
    : null;

  const handleConfirm = () => {
    if (!estimate || !finalMacros) return;
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
      carbs: finalMacros.carbs,
      protein: finalMacros.protein,
      fat: finalMacros.fat,
      kcal: finalMacros.kcal,
      uncertaintyPct: finalMacros.uncertaintyPct,
      micros: {
        fiber: Number(((micros.fiber || 0) * portionScale).toFixed(1)),
        iron: Number(((micros.iron || 0) * portionScale).toFixed(1)),
        vitC: Math.round((micros.vitC || 0) * portionScale),
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
    setManualOverride(null);
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
              Describe your meal or upload a plate photo — edit any macro directly if needed.
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="field" style={{ marginBottom: 10 }}>
          <label htmlFor="work-meal-text">Describe what you ate (include rough amounts like 200g, 2 slices, 1.5 cups)</label>
          <textarea
            id="work-meal-text"
            className="textarea"
            placeholder="e.g., Chicken burrito bowl, OR 200g grilled chicken, 1.5 cups rice, broccoli..."
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
            <Camera size={16} /> {photoDataUrl ? 'Replace Photo' : 'Plate Photo'}
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

        {estimate && finalMacros && (
          <div className="card" style={{ background: 'var(--bg-canvas)', boxShadow: 'none', marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.88rem' }}>
                <Utensils size={15} color="var(--code-med)" />
                <span>{estimate.title}</span>
              </div>
              <span className="est-tag mono">±{finalMacros.uncertaintyPct}% est</span>
            </div>

            {estimate.unrecognizedFallback && (
              <div className="notice-strip" style={{ marginBottom: 10, fontSize: '0.74rem' }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  Offline matcher didn&apos;t recognize that dish name — adjust the Carbs, Protein, and Fat boxes below (or add a free Gemini key on Sync for real AI).
                </span>
              </div>
            )}

            {/* Directly editable Carbs / Protein / Fat + live Kcal */}
            <div className="field-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
              <div className="mini-stat" style={{ background: 'var(--bg-surface)', padding: '6px 8px' }}>
                <div className="mini-stat-label">Kcal</div>
                <div className="mini-stat-val mono" style={{ fontSize: '0.95rem', marginTop: 4 }}>{finalMacros.kcal}</div>
              </div>
              <div className="field">
                <label htmlFor="wm-carbs" style={{ fontSize: '0.66rem', color: 'var(--macro-carb)' }}>Carbs (g)</label>
                <NumericInput
                  id="wm-carbs"
                  min={0}
                  max={600}
                  fallback={0}
                  className="input mono"
                  style={{ padding: '5px 6px', fontSize: '0.86rem', fontWeight: 700 }}
                  value={finalMacros.carbs}
                  onChange={(val) => setManualOverride((prev) => ({ ...(prev || {}), carbs: val }))}
                />
              </div>
              <div className="field">
                <label htmlFor="wm-prot" style={{ fontSize: '0.66rem', color: 'var(--macro-protein)' }}>Prot (g)</label>
                <NumericInput
                  id="wm-prot"
                  min={0}
                  max={300}
                  fallback={0}
                  className="input mono"
                  style={{ padding: '5px 6px', fontSize: '0.86rem', fontWeight: 700 }}
                  value={finalMacros.protein}
                  onChange={(val) => setManualOverride((prev) => ({ ...(prev || {}), protein: val }))}
                />
              </div>
              <div className="field">
                <label htmlFor="wm-fat" style={{ fontSize: '0.66rem', color: 'var(--macro-fat)' }}>Fat (g)</label>
                <NumericInput
                  id="wm-fat"
                  min={0}
                  max={250}
                  fallback={0}
                  className="input mono"
                  style={{ padding: '5px 6px', fontSize: '0.86rem', fontWeight: 700 }}
                  value={finalMacros.fat}
                  onChange={(val) => setManualOverride((prev) => ({ ...(prev || {}), fat: val }))}
                />
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
                <span style={{ fontWeight: 700, fontSize: '0.76rem' }}>Portion Size Slider</span>
                <span className="mono" style={{ fontWeight: 700 }}>
                  {Math.round(portionScale * 100)}% {portionScale < 0.9 ? '(Smaller)' : portionScale > 1.1 ? '(Larger)' : '(Standard)'}
                </span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.5}
                step={0.05}
                value={portionScale}
                onChange={(e) => {
                  setPortionScale(Number(e.target.value));
                  setManualOverride(null);
                }}
              />
            </div>

            {estimate.notes && (
              <p className="muted-text" style={{ fontSize: '0.73rem', marginBottom: 8 }}>
                {estimate.notes}
              </p>
            )}

            <div style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginBottom: 10 }}>
              Based on: <span className="mono">{estimate.engine}</span>
            </div>

            <button type="button" className="btn btn-primary btn-block" onClick={handleConfirm}>
              <Check size={16} /> Log Work Meal &amp; Auto-Adjust Evening Dinner
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
