// Flexible Metric / Imperial / Mixed unit formatting & conversion helpers
// Canonical internal storage is ALWAYS kg, g, ml, cm so switching units never alters saved data.

export const DEFAULT_UNITS = {
  weight: 'kg', // 'kg' | 'lbs'
  food: 'g',    // 'g' | 'oz' | 'lbs'
  liquid: 'ml', // 'ml' | 'floz'
  height: 'cm', // 'cm' | 'in'
};

export const UNIT_PRESETS = {
  metric: { weight: 'kg', food: 'g', liquid: 'ml', height: 'cm' },
  imperial: { weight: 'lbs', food: 'oz', liquid: 'floz', height: 'in' },
  mixed: { weight: 'lbs', food: 'oz', liquid: 'ml', height: 'cm' },
};

export function getUnits(profile) {
  return { ...DEFAULT_UNITS, ...(profile?.units || {}) };
}

// Body weight
export function kgToDisplay(kg, units) {
  const u = units?.weight || 'kg';
  if (kg == null || Number.isNaN(Number(kg))) return 0;
  return u === 'lbs' ? Number((kg * 2.20462).toFixed(1)) : Number(Number(kg).toFixed(1));
}

export function displayToKg(val, units) {
  const u = units?.weight || 'kg';
  const n = Number(val);
  if (Number.isNaN(n)) return 0;
  return u === 'lbs' ? Number((n / 2.20462).toFixed(2)) : Number(n.toFixed(2));
}

export function formatWeight(kg, units) {
  const u = units?.weight || 'kg';
  return `${kgToDisplay(kg, units).toFixed(1)} ${u}`;
}

export function formatWeightRate(kgPerWk, units) {
  const u = units?.weight || 'kg';
  const val = u === 'lbs' ? kgPerWk * 2.20462 : kgPerWk;
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2)} ${u}/wk`;
}

// Food portion (canonical grams)
export function gramsToFoodDisplay(grams, units) {
  const u = units?.food || 'g';
  const g = Number(grams) || 0;
  if (u === 'oz') return Number((g / 28.3495).toFixed(1));
  if (u === 'lbs') return Number((g / 453.592).toFixed(2));
  return Math.round(g);
}

export function foodDisplayToGrams(val, units) {
  const u = units?.food || 'g';
  const n = Number(val) || 0;
  if (u === 'oz') return Math.round(n * 28.3495);
  if (u === 'lbs') return Math.round(n * 453.592);
  return Math.round(n);
}

export function foodUnitLabel(units) {
  return units?.food || 'g';
}

export function formatFoodAmount(grams, units) {
  const u = units?.food || 'g';
  const val = gramsToFoodDisplay(grams, units);
  return u === 'g' ? `${val}g` : `${val} ${u}`;
}

// Liquids & Bottles (canonical ml)
export function formatLiquid(ml, units) {
  const u = units?.liquid || 'ml';
  const m = Number(ml) || 0;
  if (u === 'floz') {
    return `${Math.round(m / 29.5735)} oz`;
  }
  if (m >= 1000 && m % 100 === 0) {
    return `${(m / 1000).toFixed(1)} L`;
  }
  return `${Math.round(m)} ml`;
}

// Practical sodium -> table salt / electrolyte tablet helper
// Table salt (NaCl) is ~38.8% sodium => 1g salt ≈ 388 mg sodium; 1/4 tsp ≈ 1.5g salt ≈ 580 mg sodium
export function formatSodiumPractical(mg, tabletMg = 500) {
  const amount = Math.max(0, Math.round(Number(mg) || 0));
  if (amount < 150) return 'no extra salt needed';
  const saltG = Number((amount / 388).toFixed(1));
  const tabs = Math.max(0.5, Math.round((amount / tabletMg) * 2) / 2);
  const tabLabel = tabs === 1 ? '1 electrolyte tab' : `${tabs} electrolyte tabs`;
  return `≈ ${saltG}g table salt or ${tabLabel}`;
}
