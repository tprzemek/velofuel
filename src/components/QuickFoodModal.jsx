import { X } from 'lucide-react';
import FoodPickerPanel from './FoodPickerPanel';

export default function QuickFoodModal({ isOpen, onClose, slotInfo, onLogEntry }) {
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
      detail: `${ing.grams}g`,
      carbs,
      protein,
      fat,
      kcal,
      uncertaintyPct: 0,
      micros: {
        fiber: Number(((p.fiber || 0) * f).toFixed(1)),
        iron: Number(((p.iron || 0) * f).toFixed(1)),
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
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Add or Scan Food">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-head">
          <div>
            <h2 className="modal-title">Add / Scan Food · {slotInfo.label}</h2>
            <div className="muted-text" style={{ marginTop: 2 }}>
              Search USDA whole foods, packaged brands, scan a barcode, or type a custom item.
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <FoodPickerPanel onAddIngredient={handleAddSingleFood} buttonLabel="Log" />
      </div>
    </div>
  );
}
