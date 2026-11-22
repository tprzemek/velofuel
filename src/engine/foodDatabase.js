// Verified USDA Whole-Foods Database (offline, instant) + Open Food Facts (3M+ packaged foods & barcode lookup) + optional USDA FDC API

export const USDA_WHOLE_FOODS = [
  // Breakfast & Grains
  { id: 'usda-oats', name: 'Rolled Oats (dry)', category: 'Grains', defaultGrams: 70, defaultRole: 'carb', per100g: { carbs: 66.3, protein: 16.9, fat: 6.9, fiber: 10.6, iron: 4.7, calcium: 54, vitD: 0, magnesium: 177, sodium: 2 } },
  { id: 'usda-steel-oats', name: 'Steel-Cut Oats (dry)', category: 'Grains', defaultGrams: 70, defaultRole: 'carb', per100g: { carbs: 67.7, protein: 13.2, fat: 6.5, fiber: 10.1, iron: 4.2, calcium: 52, vitD: 0, magnesium: 138, sodium: 4 } },
  { id: 'usda-granola', name: 'Granola', category: 'Grains', defaultGrams: 50, defaultRole: 'carb', per100g: { carbs: 64.0, protein: 10.5, fat: 14.0, fiber: 7.0, iron: 3.1, calcium: 60, vitD: 0, magnesium: 110, sodium: 180 } },
  { id: 'usda-sourdough', name: 'Sourdough Bread', category: 'Grains', defaultGrams: 80, defaultRole: 'carb', per100g: { carbs: 51.0, protein: 9.2, fat: 1.2, fiber: 2.8, iron: 3.2, calcium: 52, vitD: 0, magnesium: 28, sodium: 520 } },
  { id: 'usda-wholewheat-bread', name: 'Whole Wheat Bread', category: 'Grains', defaultGrams: 70, defaultRole: 'carb', per100g: { carbs: 43.1, protein: 12.5, fat: 3.4, fiber: 6.8, iron: 2.5, calcium: 107, vitD: 0, magnesium: 76, sodium: 450 } },
  { id: 'usda-bagel', name: 'Plain Bagel', category: 'Grains', defaultGrams: 100, defaultRole: 'carb', per100g: { carbs: 53.0, protein: 10.5, fat: 1.6, fiber: 2.3, iron: 3.6, calcium: 20, vitD: 0, magnesium: 29, sodium: 430 } },
  { id: 'usda-jasmine-rice', name: 'White / Jasmine Rice (cooked)', category: 'Grains', defaultGrams: 220, defaultRole: 'carb', per100g: { carbs: 28.2, protein: 2.7, fat: 0.3, fiber: 0.4, iron: 0.8, calcium: 10, vitD: 0, magnesium: 12, sodium: 2 } },
  { id: 'usda-rice-dry', name: 'White / Jasmine Rice (dry)', category: 'Grains', defaultGrams: 85, defaultRole: 'carb', per100g: { carbs: 79.9, protein: 7.1, fat: 0.7, fiber: 1.3, iron: 0.8, calcium: 28, vitD: 0, magnesium: 25, sodium: 5 } },
  { id: 'usda-brown-rice', name: 'Brown Rice (cooked)', category: 'Grains', defaultGrams: 200, defaultRole: 'carb', per100g: { carbs: 25.6, protein: 2.7, fat: 1.0, fiber: 1.6, iron: 0.6, calcium: 3, vitD: 0, magnesium: 39, sodium: 4 } },
  { id: 'usda-pasta-dry', name: 'Pasta (dry)', category: 'Grains', defaultGrams: 100, defaultRole: 'carb', per100g: { carbs: 74.7, protein: 13.0, fat: 1.5, fiber: 3.2, iron: 3.3, calcium: 21, vitD: 0, magnesium: 53, sodium: 6 } },
  { id: 'usda-pasta-cooked', name: 'Pasta (cooked)', category: 'Grains', defaultGrams: 240, defaultRole: 'carb', per100g: { carbs: 30.9, protein: 5.8, fat: 0.9, fiber: 1.8, iron: 1.3, calcium: 7, vitD: 0, magnesium: 18, sodium: 1 } },
  { id: 'usda-quinoa', name: 'Quinoa (cooked)', category: 'Grains', defaultGrams: 180, defaultRole: 'carb', per100g: { carbs: 21.3, protein: 4.4, fat: 1.9, fiber: 2.8, iron: 1.5, calcium: 17, vitD: 0, magnesium: 64, sodium: 7 } },
  { id: 'usda-potato', name: 'Potatoes (boiled / roasted)', category: 'Grains', defaultGrams: 260, defaultRole: 'carb', per100g: { carbs: 20.1, protein: 2.2, fat: 0.1, fiber: 2.2, iron: 0.8, calcium: 12, vitD: 0, magnesium: 23, sodium: 6 } },
  { id: 'usda-sweet-potato', name: 'Sweet Potato (baked)', category: 'Grains', defaultGrams: 240, defaultRole: 'carb', per100g: { carbs: 20.7, protein: 2.0, fat: 0.2, fiber: 3.3, iron: 0.7, calcium: 38, vitD: 0, magnesium: 27, sodium: 36 } },
  { id: 'usda-rice-cakes', name: 'Plain Rice Cakes', category: 'Grains', defaultGrams: 30, defaultRole: 'carb', per100g: { carbs: 81.5, protein: 8.2, fat: 2.8, fiber: 4.2, iron: 1.5, calcium: 11, vitD: 0, magnesium: 131, sodium: 326 } },
  { id: 'usda-tortilla', name: 'Flour Tortilla / Wrap', category: 'Grains', defaultGrams: 65, defaultRole: 'carb', per100g: { carbs: 50.0, protein: 8.2, fat: 7.5, fiber: 3.0, iron: 3.3, calcium: 120, vitD: 0, magnesium: 24, sodium: 610 } },

  // Fruit & Sweeteners
  { id: 'usda-blueberries', name: 'Blueberries (fresh / frozen)', category: 'Fruit', defaultGrams: 100, defaultRole: 'fixed', per100g: { carbs: 14.5, protein: 0.7, fat: 0.3, fiber: 2.4, iron: 0.3, calcium: 6, vitD: 0, magnesium: 6, sodium: 1 } },
  { id: 'usda-strawberries', name: 'Strawberries', category: 'Fruit', defaultGrams: 120, defaultRole: 'fixed', per100g: { carbs: 7.7, protein: 0.7, fat: 0.3, fiber: 2.0, iron: 0.4, calcium: 16, vitD: 0, magnesium: 13, sodium: 1 } },
  { id: 'usda-raspberries', name: 'Raspberries', category: 'Fruit', defaultGrams: 100, defaultRole: 'fixed', per100g: { carbs: 11.9, protein: 1.2, fat: 0.7, fiber: 6.5, iron: 0.7, calcium: 25, vitD: 0, magnesium: 22, sodium: 1 } },
  { id: 'usda-mixed-berries', name: 'Mixed Berries', category: 'Fruit', defaultGrams: 100, defaultRole: 'fixed', per100g: { carbs: 11.5, protein: 0.9, fat: 0.4, fiber: 3.6, iron: 0.5, calcium: 18, vitD: 0, magnesium: 15, sodium: 1 } },
  { id: 'usda-banana', name: 'Banana (medium ~118g)', category: 'Fruit', defaultGrams: 118, defaultRole: 'carb', per100g: { carbs: 22.8, protein: 1.1, fat: 0.3, fiber: 2.6, iron: 0.3, calcium: 5, vitD: 0, magnesium: 27, sodium: 1 } },
  { id: 'usda-apple', name: 'Apple', category: 'Fruit', defaultGrams: 180, defaultRole: 'fixed', per100g: { carbs: 13.8, protein: 0.3, fat: 0.2, fiber: 2.4, iron: 0.1, calcium: 6, vitD: 0, magnesium: 5, sodium: 1 } },
  { id: 'usda-orange', name: 'Orange', category: 'Fruit', defaultGrams: 150, defaultRole: 'fixed', per100g: { carbs: 11.8, protein: 0.9, fat: 0.1, fiber: 2.4, iron: 0.1, calcium: 40, vitD: 0, magnesium: 10, sodium: 0 } },
  { id: 'usda-dates', name: 'Medjool Dates', category: 'Fruit', defaultGrams: 45, defaultRole: 'carb', per100g: { carbs: 75.0, protein: 1.8, fat: 0.2, fiber: 6.7, iron: 0.9, calcium: 64, vitD: 0, magnesium: 54, sodium: 1 } },
  { id: 'usda-raisins', name: 'Raisins', category: 'Fruit', defaultGrams: 40, defaultRole: 'carb', per100g: { carbs: 79.2, protein: 3.1, fat: 0.5, fiber: 3.7, iron: 1.9, calcium: 50, vitD: 0, magnesium: 32, sodium: 11 } },
  { id: 'usda-honey', name: 'Honey', category: 'Sweeteners', defaultGrams: 20, defaultRole: 'carb', per100g: { carbs: 82.4, protein: 0.3, fat: 0, fiber: 0.2, iron: 0.4, calcium: 6, vitD: 0, magnesium: 2, sodium: 4 } },
  { id: 'usda-maple', name: 'Maple Syrup', category: 'Sweeteners', defaultGrams: 25, defaultRole: 'carb', per100g: { carbs: 67.0, protein: 0, fat: 0.1, fiber: 0, iron: 0.1, calcium: 102, vitD: 0, magnesium: 21, sodium: 12 } },
  { id: 'usda-jam', name: 'Fruit Jam / Preserves', category: 'Sweeteners', defaultGrams: 25, defaultRole: 'carb', per100g: { carbs: 68.9, protein: 0.4, fat: 0.1, fiber: 1.1, iron: 0.5, calcium: 20, vitD: 0, magnesium: 4, sodium: 32 } },
  { id: 'usda-oj', name: 'Orange Juice (100%)', category: 'Drinks', defaultGrams: 250, defaultRole: 'carb', per100g: { carbs: 10.4, protein: 0.7, fat: 0.2, fiber: 0.2, iron: 0.2, calcium: 11, vitD: 0, magnesium: 11, sodium: 1 } },

  // Dairy, Plant Milks & Protein
  { id: 'usda-greek-yogurt-0', name: 'Greek Yogurt (0% fat)', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'protein', per100g: { carbs: 3.6, protein: 10.2, fat: 0.4, fiber: 0, iron: 0.1, calcium: 110, vitD: 0.4, magnesium: 11, sodium: 36 } },
  { id: 'usda-greek-yogurt-2', name: 'Greek Yogurt (2% fat)', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'protein', per100g: { carbs: 3.9, protein: 9.9, fat: 1.9, fiber: 0, iron: 0.1, calcium: 115, vitD: 0.4, magnesium: 11, sodium: 34 } },
  { id: 'usda-skyr', name: 'Skyr (plain)', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'protein', per100g: { carbs: 4.0, protein: 11.0, fat: 0.2, fiber: 0, iron: 0.1, calcium: 120, vitD: 0.2, magnesium: 12, sodium: 42 } },
  { id: 'usda-cottage-cheese', name: 'Cottage Cheese (low-fat)', category: 'Dairy & Protein', defaultGrams: 180, defaultRole: 'protein', per100g: { carbs: 3.4, protein: 11.1, fat: 2.3, fiber: 0, iron: 0.1, calcium: 83, vitD: 0.1, magnesium: 9, sodium: 330 } },
  { id: 'usda-milk-semi', name: 'Milk (2% / semi-skimmed)', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'fixed', per100g: { carbs: 4.8, protein: 3.3, fat: 2.0, fiber: 0, iron: 0, calcium: 120, vitD: 1.2, magnesium: 11, sodium: 44 } },
  { id: 'usda-milk-skim', name: 'Skim Milk', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'fixed', per100g: { carbs: 5.0, protein: 3.4, fat: 0.1, fiber: 0, iron: 0, calcium: 122, vitD: 1.2, magnesium: 11, sodium: 42 } },
  { id: 'usda-oat-milk', name: 'Oat Milk', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'fixed', per100g: { carbs: 6.7, protein: 1.0, fat: 1.5, fiber: 0.8, iron: 0.3, calcium: 120, vitD: 1.1, magnesium: 6, sodium: 42 } },
  { id: 'usda-soy-milk', name: 'Soy Milk (unsweetened)', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'fixed', per100g: { carbs: 1.8, protein: 3.3, fat: 1.8, fiber: 0.6, iron: 0.6, calcium: 123, vitD: 1.2, magnesium: 25, sodium: 35 } },
  { id: 'usda-whey', name: 'Whey Protein Isolate', category: 'Dairy & Protein', defaultGrams: 30, defaultRole: 'protein', per100g: { carbs: 4.0, protein: 82.0, fat: 1.5, fiber: 0, iron: 0.5, calcium: 420, vitD: 0, magnesium: 55, sodium: 180 } },
  { id: 'usda-eggs', name: 'Whole Eggs (1 large ≈ 50g)', category: 'Dairy & Protein', defaultGrams: 150, defaultRole: 'protein', per100g: { carbs: 0.7, protein: 12.6, fat: 9.5, fiber: 0, iron: 1.8, calcium: 56, vitD: 2.0, magnesium: 12, sodium: 142 } },
  { id: 'usda-egg-whites', name: 'Liquid Egg Whites', category: 'Dairy & Protein', defaultGrams: 150, defaultRole: 'protein', per100g: { carbs: 0.7, protein: 10.9, fat: 0.2, fiber: 0, iron: 0.1, calcium: 7, vitD: 0, magnesium: 11, sodium: 166 } },
  { id: 'usda-parmesan', name: 'Parmesan Cheese', category: 'Dairy & Protein', defaultGrams: 15, defaultRole: 'fixed', per100g: { carbs: 4.1, protein: 35.8, fat: 25.8, fiber: 0, iron: 0.8, calcium: 1184, vitD: 0.5, magnesium: 44, sodium: 1529 } },
  { id: 'usda-feta', name: 'Feta Cheese', category: 'Dairy & Protein', defaultGrams: 40, defaultRole: 'fixed', per100g: { carbs: 4.1, protein: 14.2, fat: 21.3, fiber: 0, iron: 0.7, calcium: 493, vitD: 0.4, magnesium: 19, sodium: 1116 } },

  // Meat, Fish & Plant Proteins
  { id: 'usda-chicken-breast', name: 'Chicken Breast (cooked)', category: 'Meat & Fish', defaultGrams: 160, defaultRole: 'protein', per100g: { carbs: 0, protein: 31.0, fat: 3.6, fiber: 0, iron: 1.0, calcium: 15, vitD: 0.1, magnesium: 29, sodium: 74 } },
  { id: 'usda-chicken-thigh', name: 'Chicken Thigh (cooked, skinless)', category: 'Meat & Fish', defaultGrams: 160, defaultRole: 'protein', per100g: { carbs: 0, protein: 24.8, fat: 8.2, fiber: 0, iron: 1.3, calcium: 12, vitD: 0.1, magnesium: 24, sodium: 88 } },
  { id: 'usda-turkey-ground', name: 'Lean Ground Turkey (cooked)', category: 'Meat & Fish', defaultGrams: 150, defaultRole: 'protein', per100g: { carbs: 0, protein: 27.4, fat: 6.5, fiber: 0, iron: 1.9, calcium: 24, vitD: 0.3, magnesium: 28, sodium: 92 } },
  { id: 'usda-beef-lean', name: 'Lean Beef / Steak (cooked)', category: 'Meat & Fish', defaultGrams: 150, defaultRole: 'protein', per100g: { carbs: 0, protein: 28.5, fat: 7.8, fiber: 0, iron: 2.9, calcium: 18, vitD: 0.1, magnesium: 24, sodium: 65 } },
  { id: 'usda-salmon', name: 'Salmon Fillet (cooked)', category: 'Meat & Fish', defaultGrams: 150, defaultRole: 'protein', per100g: { carbs: 0, protein: 22.1, fat: 12.4, fiber: 0, iron: 0.8, calcium: 12, vitD: 11.2, magnesium: 29, sodium: 59 } },
  { id: 'usda-tuna', name: 'Tuna (canned in water)', category: 'Meat & Fish', defaultGrams: 120, defaultRole: 'protein', per100g: { carbs: 0, protein: 25.5, fat: 0.8, fiber: 0, iron: 1.5, calcium: 11, vitD: 1.7, magnesium: 27, sodium: 320 } },
  { id: 'usda-cod', name: 'White Fish / Cod (cooked)', category: 'Meat & Fish', defaultGrams: 160, defaultRole: 'protein', per100g: { carbs: 0, protein: 22.8, fat: 0.9, fiber: 0, iron: 0.5, calcium: 14, vitD: 1.2, magnesium: 42, sodium: 78 } },
  { id: 'usda-tofu', name: 'Firm Tofu', category: 'Meat & Fish', defaultGrams: 160, defaultRole: 'protein', per100g: { carbs: 2.3, protein: 15.8, fat: 8.7, fiber: 2.3, iron: 2.7, calcium: 350, vitD: 0, magnesium: 58, sodium: 14 } },
  { id: 'usda-lentils', name: 'Lentils (cooked)', category: 'Meat & Fish', defaultGrams: 180, defaultRole: 'carb', per100g: { carbs: 20.1, protein: 9.0, fat: 0.4, fiber: 7.9, iron: 3.3, calcium: 19, vitD: 0, magnesium: 36, sodium: 2 } },
  { id: 'usda-chickpeas', name: 'Chickpeas (cooked)', category: 'Meat & Fish', defaultGrams: 150, defaultRole: 'carb', per100g: { carbs: 27.4, protein: 8.9, fat: 2.6, fiber: 7.6, iron: 2.9, calcium: 49, vitD: 0, magnesium: 48, sodium: 7 } },

  // Healthy Fats, Nuts & Seeds
  { id: 'usda-peanut-butter', name: 'Peanut Butter', category: 'Fats & Nuts', defaultGrams: 20, defaultRole: 'fixed', per100g: { carbs: 20.0, protein: 25.0, fat: 50.0, fiber: 6.0, iron: 1.9, calcium: 43, vitD: 0, magnesium: 168, sodium: 150 } },
  { id: 'usda-almond-butter', name: 'Almond Butter', category: 'Fats & Nuts', defaultGrams: 20, defaultRole: 'fixed', per100g: { carbs: 18.8, protein: 21.0, fat: 55.5, fiber: 10.3, iron: 3.5, calcium: 347, vitD: 0, magnesium: 279, sodium: 7 } },
  { id: 'usda-almonds', name: 'Almonds', category: 'Fats & Nuts', defaultGrams: 25, defaultRole: 'fixed', per100g: { carbs: 21.6, protein: 21.2, fat: 49.9, fiber: 12.5, iron: 3.7, calcium: 269, vitD: 0, magnesium: 270, sodium: 1 } },
  { id: 'usda-walnuts', name: 'Walnuts', category: 'Fats & Nuts', defaultGrams: 25, defaultRole: 'fixed', per100g: { carbs: 13.7, protein: 15.2, fat: 65.2, fiber: 6.7, iron: 2.9, calcium: 98, vitD: 0, magnesium: 158, sodium: 2 } },
  { id: 'usda-chia', name: 'Chia Seeds', category: 'Fats & Nuts', defaultGrams: 12, defaultRole: 'fixed', per100g: { carbs: 42.1, protein: 16.5, fat: 30.7, fiber: 34.4, iron: 7.7, calcium: 631, vitD: 0, magnesium: 335, sodium: 16 } },
  { id: 'usda-flax', name: 'Ground Flaxseed', category: 'Fats & Nuts', defaultGrams: 12, defaultRole: 'fixed', per100g: { carbs: 28.9, protein: 18.3, fat: 42.2, fiber: 27.3, iron: 5.7, calcium: 255, vitD: 0, magnesium: 392, sodium: 30 } },
  { id: 'usda-avocado', name: 'Avocado', category: 'Fats & Nuts', defaultGrams: 60, defaultRole: 'fixed', per100g: { carbs: 8.5, protein: 2.0, fat: 14.7, fiber: 6.7, iron: 0.6, calcium: 12, vitD: 0, magnesium: 29, sodium: 7 } },
  { id: 'usda-olive-oil', name: 'Extra Virgin Olive Oil', category: 'Fats & Nuts', defaultGrams: 10, defaultRole: 'fixed', per100g: { carbs: 0, protein: 0, fat: 100.0, fiber: 0, iron: 0.6, calcium: 1, vitD: 0, magnesium: 0, sodium: 2 } },
  { id: 'usda-butter', name: 'Butter', category: 'Fats & Nuts', defaultGrams: 10, defaultRole: 'fixed', per100g: { carbs: 0.1, protein: 0.9, fat: 81.1, fiber: 0, iron: 0, calcium: 24, vitD: 0, magnesium: 2, sodium: 11 } },

  // Vegetables & Sauces
  { id: 'usda-broccoli', name: 'Broccoli', category: 'Vegetables', defaultGrams: 120, defaultRole: 'fixed', per100g: { carbs: 6.6, protein: 2.8, fat: 0.4, fiber: 2.6, iron: 0.7, calcium: 47, vitD: 0, magnesium: 21, sodium: 33 } },
  { id: 'usda-spinach', name: 'Spinach', category: 'Vegetables', defaultGrams: 60, defaultRole: 'fixed', per100g: { carbs: 3.6, protein: 2.9, fat: 0.4, fiber: 2.2, iron: 2.7, calcium: 99, vitD: 0, magnesium: 79, sodium: 79 } },
  { id: 'usda-asparagus', name: 'Asparagus', category: 'Vegetables', defaultGrams: 120, defaultRole: 'fixed', per100g: { carbs: 3.9, protein: 2.2, fat: 0.1, fiber: 2.1, iron: 2.1, calcium: 24, vitD: 0, magnesium: 14, sodium: 2 } },
  { id: 'usda-mixed-veg', name: 'Mixed Roasted / Steamed Vegetables', category: 'Vegetables', defaultGrams: 150, defaultRole: 'fixed', per100g: { carbs: 7.5, protein: 2.2, fat: 0.4, fiber: 3.0, iron: 0.9, calcium: 38, vitD: 0, magnesium: 22, sodium: 30 } },
  { id: 'usda-tomato-sauce', name: 'Tomato Pasta Sauce', category: 'Sauces', defaultGrams: 140, defaultRole: 'fixed', per100g: { carbs: 7.2, protein: 1.6, fat: 1.5, fiber: 1.8, iron: 0.8, calcium: 18, vitD: 0, magnesium: 16, sodium: 320 } },

  // Cycling Fuel
  { id: 'usda-carb-mix', name: 'Carb Drink Mix (powder)', category: 'Bike Fuel', defaultGrams: 60, defaultRole: 'carb', per100g: { carbs: 95.0, protein: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitD: 0, magnesium: 40, sodium: 800 } },
  { id: 'usda-gel', name: 'Energy Gel (1 packet ≈ 40g)', category: 'Bike Fuel', defaultGrams: 40, defaultRole: 'carb', per100g: { carbs: 65.0, protein: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitD: 0, magnesium: 20, sodium: 150 } },
];

export function searchLocalWholeFoods(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return USDA_WHOLE_FOODS.slice(0, 14);
  const terms = q.split(/\s+/).filter(Boolean);
  return USDA_WHOLE_FOODS.filter((item) => {
    const hay = `${item.name} ${item.category}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  }).slice(0, 12);
}

function normalizeOpenFoodFactsProduct(p) {
  if (!p || !p.nutriments) return null;
  const n = p.nutriments;
  const carbs = Number(n.carbohydrates_100g ?? 0);
  const protein = Number(n.proteins_100g ?? 0);
  const fat = Number(n.fat_100g ?? 0);
  if ([carbs, protein, fat].some((v) => Number.isNaN(v))) return null;
  if (carbs === 0 && protein === 0 && fat === 0) return null;

  const brand = p.brands ? String(p.brands).split(',')[0].trim() : '';
  const baseName = String(p.product_name || p.product_name_en || '').trim();
  if (!baseName) return null;

  const displayName = brand && !baseName.toLowerCase().includes(brand.toLowerCase())
    ? `${baseName} (${brand})`
    : baseName;

  // Smart default scaling role based on macro dominance
  let defaultRole = 'fixed';
  if (carbs >= 40 && carbs > protein * 2) defaultRole = 'carb';
  else if (protein >= 18 && protein > carbs) defaultRole = 'protein';

  const servingGrams = Number(p.serving_quantity) || 100;

  return {
    id: `off-${p.code || Date.now()}`,
    barcode: p.code || '',
    name: displayName,
    brand,
    source: 'Open Food Facts',
    defaultGrams: Math.min(300, Math.max(15, Math.round(servingGrams))),
    defaultRole,
    per100g: {
      carbs: Number(carbs.toFixed(1)),
      protein: Number(protein.toFixed(1)),
      fat: Number(fat.toFixed(1)),
      fiber: Number((Number(n.fiber_100g) || 0).toFixed(1)),
      iron: Number(((Number(n.iron_100g) || 0) * 1000).toFixed(1)),
      calcium: Math.round((Number(n.calcium_100g) || 0) * 1000),
      vitD: Number(((Number(n['vitamin-d_100g']) || 0) * 1000000).toFixed(1)),
      magnesium: Math.round((Number(n.magnesium_100g) || 0) * 1000),
      sodium: Math.round((Number(n.sodium_100g) || (Number(n.salt_100g) || 0) / 2.5) * 1000),
    },
  };
}

export async function lookupBarcode(barcode) {
  const clean = String(barcode || '').replace(/[^\d]/g, '');
  if (clean.length < 6) {
    throw new Error('Enter a valid barcode (at least 6 digits).');
  }
  const resp = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json?fields=code,product_name,product_name_en,brands,serving_quantity,nutriments`
  );
  if (!resp.ok) throw new Error(`Product lookup failed (HTTP ${resp.status}).`);
  const data = await resp.json();
  if (data.status !== 1 || !data.product) {
    throw new Error(`Barcode ${clean} wasn't found in Open Food Facts. You can add it as a Custom Food below.`);
  }
  const normalized = normalizeOpenFoodFactsProduct(data.product);
  if (!normalized) {
    throw new Error(`Found "${data.product.product_name || clean}" but nutrition per 100g is incomplete. Add it via Custom Food.`);
  }
  return normalized;
}

export async function searchPackagedFoods(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const resp = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&fields=code,product_name,product_name_en,brands,serving_quantity,nutriments`
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  const list = Array.isArray(data.products) ? data.products : [];
  const results = [];
  const seen = new Set();
  for (const p of list) {
    const item = normalizeOpenFoodFactsProduct(p);
    if (item && !seen.has(item.name.toLowerCase())) {
      seen.add(item.name.toLowerCase());
      results.push(item);
    }
  }
  return results.slice(0, 6);
}
