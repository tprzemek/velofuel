import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Search, X, Check, AlertCircle } from 'lucide-react';
import { lookupBarcode } from '../engine/foodDatabase';
import NumericInput from './NumericInput';

export default function BarcodeScannerModal({ isOpen, onClose, onSelectFood }) {
  const readerId = useId().replace(/:/g, '');
  const scannerRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [foundFood, setFoundFood] = useState(null);
  const [grams, setGrams] = useState(100);
  const [role, setRole] = useState('fixed');

  const releaseScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore stop race
      }
      scannerRef.current = null;
    }
  };

  const stopCamera = async () => {
    await releaseScanner();
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      releaseScanner();
    };
  }, []);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleLookup = async (code) => {
    setLoading(true);
    setLookupError('');
    setFoundFood(null);
    try {
      const food = await lookupBarcode(code);
      setFoundFood(food);
      setGrams(food.defaultGrams || 100);
      setRole(food.defaultRole || 'fixed');
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setCameraError('');
    setLookupError('');
    try {
      await stopCamera();
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5Qr = new Html5Qrcode(readerId);
      scannerRef.current = html5Qr;
      setCameraActive(true);
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 130 } },
        async (decodedText) => {
          setManualCode(decodedText);
          await stopCamera();
          handleLookup(decodedText);
        },
        () => {}
      );
    } catch (err) {
      setCameraActive(false);
      setCameraError(
        `Camera unavailable (${err?.message || 'permission needed'}). You can type the barcode digits below instead.`
      );
    }
  };

  if (!isOpen) return null;

  const factor = (Number(grams) || 0) / 100;
  const previewMacros = foundFood
    ? {
        carbs: Math.round(foundFood.per100g.carbs * factor),
        protein: Math.round(foundFood.per100g.protein * factor),
        fat: Math.round(foundFood.per100g.fat * factor),
        kcal: Math.round(
          (foundFood.per100g.carbs * 4 + foundFood.per100g.protein * 4 + foundFood.per100g.fat * 9) * factor
        ),
      }
    : null;

  return (
    <div className="modal-backdrop" onClick={handleClose} role="dialog" aria-modal="true" aria-label="Scan Food Barcode">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Scan Barcode</h2>
            <div className="muted-text" style={{ marginTop: 2 }}>
              Pulls exact nutrition per 100g from Open Food Facts (3M+ products).
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div
          id={readerId}
          style={{
            width: '100%',
            minHeight: cameraActive ? 220 : 0,
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: cameraActive ? 10 : 0,
            background: '#14181C',
          }}
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            className="btn btn-accent"
            style={{ flex: 1 }}
            onClick={cameraActive ? stopCamera : startCamera}
          >
            <Camera size={16} /> {cameraActive ? 'Stop Camera' : 'Open Phone Camera'}
          </button>
        </div>

        {cameraError && (
          <div className="notice-strip" style={{ marginBottom: 10 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{cameraError}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            className="input mono"
            placeholder="Or type barcode digits (e.g. 3168930003632)"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (manualCode.trim()) handleLookup(manualCode.trim());
              }
            }}
            inputMode="numeric"
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !manualCode.trim()}
            onClick={() => manualCode.trim() && handleLookup(manualCode.trim())}
          >
            <Search size={15} /> {loading ? '…' : 'Look up'}
          </button>
        </div>

        {lookupError && (
          <div className="notice-strip" style={{ marginBottom: 10 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{lookupError}</span>
          </div>
        )}

        {foundFood && previewMacros && (
          <div className="card" style={{ background: 'var(--bg-canvas)', boxShadow: 'none' }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{foundFood.name}</div>
            <div className="muted-text mono" style={{ fontSize: '0.72rem', marginTop: 2 }}>
              Per 100g: {foundFood.per100g.carbs}g C · {foundFood.per100g.protein}g P · {foundFood.per100g.fat}g F
            </div>

            <div className="field-grid" style={{ marginTop: 10 }}>
              <div className="field">
                <label htmlFor="bc-grams">Amount (g)</label>
                <NumericInput
                  id="bc-grams"
                  min={1}
                  max={1500}
                  fallback={100}
                  className="input mono"
                  value={grams}
                  onChange={(val) => setGrams(val)}
                />
              </div>
              <div className="field">
                <label htmlFor="bc-role">Portion Behavior</label>
                <select id="bc-role" className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="fixed">Keep same amount</option>
                  <option value="carb">Auto-adjust for ride (Carbs)</option>
                  <option value="protein">Auto-adjust for muscle (Protein)</option>
                </select>
              </div>
            </div>

            <div className="stat-pair-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 10, marginBottom: 12 }}>
              <div className="mini-stat" style={{ background: 'var(--bg-surface)' }}>
                <div className="mini-stat-label">Kcal</div>
                <div className="mini-stat-val mono">{previewMacros.kcal}</div>
              </div>
              <div className="mini-stat" style={{ background: 'var(--bg-surface)' }}>
                <div className="mini-stat-label">Carbs</div>
                <div className="mini-stat-val mono" style={{ color: 'var(--macro-carb)' }}>{previewMacros.carbs}g</div>
              </div>
              <div className="mini-stat" style={{ background: 'var(--bg-surface)' }}>
                <div className="mini-stat-label">Prot</div>
                <div className="mini-stat-val mono" style={{ color: 'var(--macro-protein)' }}>{previewMacros.protein}g</div>
              </div>
              <div className="mini-stat" style={{ background: 'var(--bg-surface)' }}>
                <div className="mini-stat-label">Fat</div>
                <div className="mini-stat-val mono" style={{ color: 'var(--macro-fat)' }}>{previewMacros.fat}g</div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => {
                onSelectFood({
                  ...foundFood,
                  grams: Math.max(5, Number(grams) || 100),
                  role,
                });
                onClose();
              }}
            >
              <Check size={16} /> Add {foundFood.name} ({grams}g)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
