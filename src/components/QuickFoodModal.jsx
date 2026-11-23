import { X } from 'lucide-react';
import { formatFoodAmount } from '../engine/units';
import FoodPickerPanel from './FoodPickerPanel';

export default function QuickFoodModal({ isOpen, onClose, slotInfo, units, usdaApiKey = '', onLogEntry }) {
  if (!isOpen || !slotInfo) return null;

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
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Scan or Add Food">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Scan / Add Food · {slotInfo.label}</h2>
            <div className="muted-text" style={{ marginTop: 2 }}>
              Scan a barcode, search USDA &amp; branded foods, or type a custom item. Save logged foods as a reusable meal anytime.
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <FoodPickerPanel onAddIngredient={handleAddSingleFood} buttonLabel="Log" units={units} usdaApiKey={usdaApiKey} />
      </div>
    </div>
  );
}
