// Verified USDA Whole-Foods & Popular Cyclist/Grocery Database (offline, instant)
// + Live USDA FoodData Central API (400,000+ Foundation, SR Legacy & Branded foods — same USDA backbone Cronometer uses)
// + Live Open Food Facts v2 API (international packaged brands & barcode lookup)

export const USDA_WHOLE_FOODS = [
  // Breakfast & Grains
  { id: 'usda-oats', name: 'Rolled Oats (dry)', category: 'Grains', defaultGrams: 70, defaultRole: 'carb', servings: [{ label: '½ cup', grams: 40 }, { label: '1 cup', grams: 80 }, { label: '100g', grams: 100 }], per100g: { carbs: 66.3, protein: 16.9, fat: 6.9, fiber: 10.6, iron: 4.7, calcium: 54, vitD: 0, magnesium: 177, sodium: 2 } },
  { id: 'usda-steel-oats', name: 'Steel-Cut Oats (dry)', category: 'Grains', defaultGrams: 70, defaultRole: 'carb', servings: [{ label: '¼ cup', grams: 45 }, { label: '½ cup', grams: 90 }, { label: '100g', grams: 100 }], per100g: { carbs: 67.7, protein: 13.2, fat: 6.5, fiber: 10.1, iron: 4.2, calcium: 52, vitD: 0, magnesium: 138, sodium: 4 } },
  { id: 'usda-granola', name: 'Granola', category: 'Grains', defaultGrams: 50, defaultRole: 'carb', servings: [{ label: '½ cup', grams: 50 }, { label: '1 cup', grams: 100 }], per100g: { carbs: 64.0, protein: 10.5, fat: 14.0, fiber: 7.0, iron: 3.1, calcium: 60, vitD: 0, magnesium: 110, sodium: 180 } },
  { id: 'usda-sourdough', name: 'Sourdough Bread', category: 'Grains', defaultGrams: 80, defaultRole: 'carb', servings: [{ label: '1 slice', grams: 40 }, { label: '2 slices', grams: 80 }, { label: '100g', grams: 100 }], per100g: { carbs: 51.0, protein: 9.2, fat: 1.2, fiber: 2.8, iron: 3.2, calcium: 52, vitD: 0, magnesium: 28, sodium: 520 } },
  { id: 'usda-wholewheat-bread', name: 'Whole Wheat Bread', category: 'Grains', defaultGrams: 70, defaultRole: 'carb', servings: [{ label: '1 slice', grams: 35 }, { label: '2 slices', grams: 70 }, { label: '100g', grams: 100 }], per100g: { carbs: 43.1, protein: 12.5, fat: 3.4, fiber: 6.8, iron: 2.5, calcium: 107, vitD: 0, magnesium: 76, sodium: 450 } },
  { id: 'usda-bagel', name: 'Plain Bagel', category: 'Grains', defaultGrams: 100, defaultRole: 'carb', servings: [{ label: '½ bagel', grams: 50 }, { label: '1 bagel', grams: 100 }], per100g: { carbs: 53.0, protein: 10.5, fat: 1.6, fiber: 2.3, iron: 3.6, calcium: 20, vitD: 0, magnesium: 29, sodium: 430 } },
  { id: 'usda-jasmine-rice', name: 'White / Jasmine Rice (cooked)', category: 'Grains', defaultGrams: 220, defaultRole: 'carb', servings: [{ label: '1 cup', grams: 160 }, { label: '1.5 cups', grams: 240 }, { label: '100g', grams: 100 }], per100g: { carbs: 28.2, protein: 2.7, fat: 0.3, fiber: 0.4, iron: 0.8, calcium: 10, vitD: 0, magnesium: 12, sodium: 2 } },
  { id: 'usda-rice-dry', name: 'White / Jasmine Rice (dry)', category: 'Grains', defaultGrams: 85, defaultRole: 'carb', servings: [{ label: '½ cup', grams: 90 }, { label: '1 cup', grams: 185 }, { label: '100g', grams: 100 }], per100g: { carbs: 79.9, protein: 7.1, fat: 0.7, fiber: 1.3, iron: 0.8, calcium: 28, vitD: 0, magnesium: 25, sodium: 5 } },
  { id: 'usda-brown-rice', name: 'Brown Rice (cooked)', category: 'Grains', defaultGrams: 200, defaultRole: 'carb', servings: [{ label: '1 cup', grams: 195 }, { label: '100g', grams: 100 }], per100g: { carbs: 25.6, protein: 2.7, fat: 1.0, fiber: 1.6, iron: 0.6, calcium: 3, vitD: 0, magnesium: 39, sodium: 4 } },
  { id: 'usda-pasta-dry', name: 'Pasta (dry)', category: 'Grains', defaultGrams: 100, defaultRole: 'carb', servings: [{ label: '1 serving', grams: 85 }, { label: '100g', grams: 100 }, { label: '150g', grams: 150 }], per100g: { carbs: 74.7, protein: 13.0, fat: 1.5, fiber: 3.2, iron: 3.3, calcium: 21, vitD: 0, magnesium: 53, sodium: 6 } },
  { id: 'usda-pasta-cooked', name: 'Pasta (cooked)', category: 'Grains', defaultGrams: 240, defaultRole: 'carb', servings: [{ label: '1 cup', grams: 140 }, { label: '1.5 cups', grams: 210 }, { label: '2 cups', grams: 280 }], per100g: { carbs: 30.9, protein: 5.8, fat: 0.9, fiber: 1.8, iron: 1.3, calcium: 7, vitD: 0, magnesium: 18, sodium: 1 } },
  { id: 'usda-quinoa', name: 'Quinoa (cooked)', category: 'Grains', defaultGrams: 180, defaultRole: 'carb', servings: [{ label: '1 cup', grams: 185 }, { label: '100g', grams: 100 }], per100g: { carbs: 21.3, protein: 4.4, fat: 1.9, fiber: 2.8, iron: 1.5, calcium: 17, vitD: 0, magnesium: 64, sodium: 7 } },
  { id: 'usda-potato', name: 'Potatoes (boiled / roasted)', category: 'Grains', defaultGrams: 260, defaultRole: 'carb', servings: [{ label: '1 medium', grams: 170 }, { label: '1 large', grams: 280 }, { label: '100g', grams: 100 }], per100g: { carbs: 20.1, protein: 2.2, fat: 0.1, fiber: 2.2, iron: 0.8, calcium: 12, vitD: 0, magnesium: 23, sodium: 6 } },
  { id: 'usda-sweet-potato', name: 'Sweet Potato (baked)', category: 'Grains', defaultGrams: 240, defaultRole: 'carb', servings: [{ label: '1 medium', grams: 150 }, { label: '1 large', grams: 250 }, { label: '100g', grams: 100 }], per100g: { carbs: 20.7, protein: 2.0, fat: 0.2, fiber: 3.3, iron: 0.7, calcium: 38, vitD: 0, magnesium: 27, sodium: 36 } },
  { id: 'usda-rice-cakes', name: 'Plain Rice Cakes', category: 'Grains', defaultGrams: 30, defaultRole: 'carb', servings: [{ label: '2 cakes', grams: 18 }, { label: '3 cakes', grams: 27 }, { label: '4 cakes', grams: 36 }], per100g: { carbs: 81.5, protein: 8.2, fat: 2.8, fiber: 4.2, iron: 1.5, calcium: 11, vitD: 0, magnesium: 131, sodium: 326 } },
  { id: 'usda-tortilla', name: 'Flour Tortilla / Wrap', category: 'Grains', defaultGrams: 65, defaultRole: 'carb', servings: [{ label: '1 wrap', grams: 65 }, { label: '2 wraps', grams: 130 }], per100g: { carbs: 50.0, protein: 8.2, fat: 7.5, fiber: 3.0, iron: 3.3, calcium: 120, vitD: 0, magnesium: 24, sodium: 610 } },

  // Fruit & Sweeteners
  { id: 'usda-blueberries', name: 'Blueberries (fresh / frozen)', category: 'Fruit', defaultGrams: 100, defaultRole: 'fixed', servings: [{ label: '½ cup', grams: 75 }, { label: '1 cup', grams: 148 }, { label: '100g', grams: 100 }], per100g: { carbs: 14.5, protein: 0.7, fat: 0.3, fiber: 2.4, iron: 0.3, calcium: 6, vitD: 0, vitC: 9.7, magnesium: 6, sodium: 1 } },
  { id: 'usda-strawberries', name: 'Strawberries', category: 'Fruit', defaultGrams: 120, defaultRole: 'fixed', servings: [{ label: '1 cup', grams: 150 }, { label: '100g', grams: 100 }], per100g: { carbs: 7.7, protein: 0.7, fat: 0.3, fiber: 2.0, iron: 0.4, calcium: 16, vitD: 0, vitC: 58.8, magnesium: 13, sodium: 1 } },
  { id: 'usda-raspberries', name: 'Raspberries', category: 'Fruit', defaultGrams: 100, defaultRole: 'fixed', servings: [{ label: '1 cup', grams: 125 }, { label: '100g', grams: 100 }], per100g: { carbs: 11.9, protein: 1.2, fat: 0.7, fiber: 6.5, iron: 0.7, calcium: 25, vitD: 0, vitC: 26.2, magnesium: 22, sodium: 1 } },
  { id: 'usda-mixed-berries', name: 'Mixed Berries', category: 'Fruit', defaultGrams: 100, defaultRole: 'fixed', servings: [{ label: '½ cup', grams: 75 }, { label: '1 cup', grams: 140 }, { label: '100g', grams: 100 }], per100g: { carbs: 11.5, protein: 0.9, fat: 0.4, fiber: 3.6, iron: 0.5, calcium: 18, vitD: 0, vitC: 30.0, magnesium: 15, sodium: 1 } },
  { id: 'usda-banana', name: 'Banana (medium ~118g)', category: 'Fruit', defaultGrams: 118, defaultRole: 'carb', servings: [{ label: '1 medium', grams: 118 }, { label: '1 large', grams: 136 }, { label: '100g', grams: 100 }], per100g: { carbs: 22.8, protein: 1.1, fat: 0.3, fiber: 2.6, iron: 0.3, calcium: 5, vitD: 0, vitC: 8.7, magnesium: 27, sodium: 1 } },
  { id: 'usda-apple', name: 'Apple', category: 'Fruit', defaultGrams: 180, defaultRole: 'fixed', servings: [{ label: '1 medium', grams: 180 }, { label: '1 large', grams: 220 }], per100g: { carbs: 13.8, protein: 0.3, fat: 0.2, fiber: 2.4, iron: 0.1, calcium: 6, vitD: 0, vitC: 4.6, magnesium: 5, sodium: 1 } },
  { id: 'usda-orange', name: 'Orange', category: 'Fruit', defaultGrams: 150, defaultRole: 'fixed', servings: [{ label: '1 medium', grams: 140 }, { label: '1 large', grams: 185 }], per100g: { carbs: 11.8, protein: 0.9, fat: 0.1, fiber: 2.4, iron: 0.1, calcium: 40, vitD: 0, vitC: 53.2, magnesium: 10, sodium: 0 } },
  { id: 'usda-dates', name: 'Medjool Dates', category: 'Fruit', defaultGrams: 45, defaultRole: 'carb', servings: [{ label: '2 dates', grams: 48 }, { label: '3 dates', grams: 72 }, { label: '100g', grams: 100 }], per100g: { carbs: 75.0, protein: 1.8, fat: 0.2, fiber: 6.7, iron: 0.9, calcium: 64, vitD: 0, vitC: 0, magnesium: 54, sodium: 1 } },
  { id: 'usda-raisins', name: 'Raisins', category: 'Fruit', defaultGrams: 40, defaultRole: 'carb', servings: [{ label: '¼ cup', grams: 40 }, { label: '½ cup', grams: 80 }], per100g: { carbs: 79.2, protein: 3.1, fat: 0.5, fiber: 3.7, iron: 1.9, calcium: 50, vitD: 0, vitC: 2.3, magnesium: 32, sodium: 11 } },
  { id: 'usda-honey', name: 'Honey', category: 'Sweeteners', defaultGrams: 20, defaultRole: 'carb', servings: [{ label: '1 tbsp', grams: 21 }, { label: '2 tbsp', grams: 42 }, { label: '1 tsp', grams: 7 }], per100g: { carbs: 82.4, protein: 0.3, fat: 0, fiber: 0.2, iron: 0.4, calcium: 6, vitD: 0, vitC: 0.5, magnesium: 2, sodium: 4 } },
  { id: 'usda-maple', name: 'Maple Syrup', category: 'Sweeteners', defaultGrams: 25, defaultRole: 'carb', servings: [{ label: '1 tbsp', grams: 20 }, { label: '2 tbsp', grams: 40 }], per100g: { carbs: 67.0, protein: 0, fat: 0.1, fiber: 0, iron: 0.1, calcium: 102, vitD: 0, vitC: 0, magnesium: 21, sodium: 12 } },
  { id: 'usda-jam', name: 'Fruit Jam / Preserves', category: 'Sweeteners', defaultGrams: 25, defaultRole: 'carb', servings: [{ label: '1 tbsp', grams: 20 }, { label: '2 tbsp', grams: 40 }], per100g: { carbs: 68.9, protein: 0.4, fat: 0.1, fiber: 1.1, iron: 0.5, calcium: 20, vitD: 0, vitC: 8.0, magnesium: 4, sodium: 32 } },
  { id: 'usda-oj', name: 'Orange Juice (100%)', category: 'Drinks', defaultGrams: 250, defaultRole: 'carb', servings: [{ label: '1 cup', grams: 248 }, { label: '12 oz', grams: 355 }], per100g: { carbs: 10.4, protein: 0.7, fat: 0.2, fiber: 0.2, iron: 0.2, calcium: 11, vitD: 0, vitC: 50.0, magnesium: 11, sodium: 1 } },

  // Dairy, Plant Milks & Protein
  { id: 'usda-greek-yogurt-0', name: 'Greek Yogurt (0% fat)', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'protein', servings: [{ label: '¾ cup', grams: 170 }, { label: '1 cup', grams: 225 }, { label: '100g', grams: 100 }], per100g: { carbs: 3.6, protein: 10.2, fat: 0.4, fiber: 0, iron: 0.1, calcium: 110, vitD: 0.4, magnesium: 11, sodium: 36 } },
  { id: 'usda-greek-yogurt-2', name: 'Greek Yogurt (2% fat)', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'protein', servings: [{ label: '¾ cup', grams: 170 }, { label: '1 cup', grams: 225 }, { label: '100g', grams: 100 }], per100g: { carbs: 3.9, protein: 9.9, fat: 1.9, fiber: 0, iron: 0.1, calcium: 115, vitD: 0.4, magnesium: 11, sodium: 34 } },
  { id: 'usda-skyr', name: 'Skyr (plain)', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'protein', servings: [{ label: '1 cup', grams: 200 }, { label: '100g', grams: 100 }], per100g: { carbs: 4.0, protein: 11.0, fat: 0.2, fiber: 0, iron: 0.1, calcium: 120, vitD: 0.2, magnesium: 12, sodium: 42 } },
  { id: 'usda-cottage-cheese', name: 'Cottage Cheese (low-fat)', category: 'Dairy & Protein', defaultGrams: 180, defaultRole: 'protein', servings: [{ label: '½ cup', grams: 113 }, { label: '1 cup', grams: 226 }, { label: '100g', grams: 100 }], per100g: { carbs: 3.4, protein: 11.1, fat: 2.3, fiber: 0, iron: 0.1, calcium: 83, vitD: 0.1, magnesium: 9, sodium: 330 } },
  { id: 'usda-milk-semi', name: 'Milk (2% / semi-skimmed)', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'fixed', servings: [{ label: '1 cup', grams: 244 }, { label: '½ cup', grams: 122 }], per100g: { carbs: 4.8, protein: 3.3, fat: 2.0, fiber: 0, iron: 0, calcium: 120, vitD: 1.2, magnesium: 11, sodium: 44 } },
  { id: 'usda-milk-skim', name: 'Skim Milk', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'fixed', servings: [{ label: '1 cup', grams: 245 }, { label: '½ cup', grams: 122 }], per100g: { carbs: 5.0, protein: 3.4, fat: 0.1, fiber: 0, iron: 0, calcium: 122, vitD: 1.2, magnesium: 11, sodium: 42 } },
  { id: 'usda-oat-milk', name: 'Oat Milk', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'fixed', servings: [{ label: '1 cup', grams: 240 }, { label: '½ cup', grams: 120 }], per100g: { carbs: 6.7, protein: 1.0, fat: 1.5, fiber: 0.8, iron: 0.3, calcium: 120, vitD: 1.1, magnesium: 6, sodium: 42 } },
  { id: 'usda-soy-milk', name: 'Soy Milk (unsweetened)', category: 'Dairy & Protein', defaultGrams: 200, defaultRole: 'fixed', servings: [{ label: '1 cup', grams: 240 }, { label: '½ cup', grams: 120 }], per100g: { carbs: 1.8, protein: 3.3, fat: 1.8, fiber: 0.6, iron: 0.6, calcium: 123, vitD: 1.2, magnesium: 25, sodium: 35 } },
  { id: 'usda-whey', name: 'Whey Protein Isolate', category: 'Dairy & Protein', defaultGrams: 30, defaultRole: 'protein', servings: [{ label: '1 scoop', grams: 30 }, { label: '1.5 scoops', grams: 45 }, { label: '2 scoops', grams: 60 }], per100g: { carbs: 4.0, protein: 82.0, fat: 1.5, fiber: 0, iron: 0.5, calcium: 420, vitD: 0, magnesium: 55, sodium: 180 } },
  { id: 'usda-eggs', name: 'Whole Eggs (1 large ≈ 50g)', category: 'Dairy & Protein', defaultGrams: 150, defaultRole: 'protein', servings: [{ label: '1 egg', grams: 50 }, { label: '2 eggs', grams: 100 }, { label: '3 eggs', grams: 150 }], per100g: { carbs: 0.7, protein: 12.6, fat: 9.5, fiber: 0, iron: 1.8, calcium: 56, vitD: 2.0, magnesium: 12, sodium: 142 } },
  { id: 'usda-egg-whites', name: 'Liquid Egg Whites', category: 'Dairy & Protein', defaultGrams: 150, defaultRole: 'protein', servings: [{ label: '½ cup', grams: 122 }, { label: '1 cup', grams: 243 }, { label: '100g', grams: 100 }], per100g: { carbs: 0.7, protein: 10.9, fat: 0.2, fiber: 0, iron: 0.1, calcium: 7, vitD: 0, magnesium: 11, sodium: 166 } },
  { id: 'usda-parmesan', name: 'Parmesan Cheese', category: 'Dairy & Protein', defaultGrams: 15, defaultRole: 'fixed', servings: [{ label: '1 tbsp', grams: 5 }, { label: '2 tbsp', grams: 10 }, { label: '1 oz', grams: 28 }], per100g: { carbs: 4.1, protein: 35.8, fat: 25.8, fiber: 0, iron: 0.8, calcium: 1184, vitD: 0.5, magnesium: 44, sodium: 1529 } },
  { id: 'usda-feta', name: 'Feta Cheese', category: 'Dairy & Protein', defaultGrams: 40, defaultRole: 'fixed', servings: [{ label: '1 oz', grams: 28 }, { label: '¼ cup', grams: 38 }], per100g: { carbs: 4.1, protein: 14.2, fat: 21.3, fiber: 0, iron: 0.7, calcium: 493, vitD: 0.4, magnesium: 19, sodium: 1116 } },

  // Meat, Fish & Plant Proteins
  { id: 'usda-chicken-breast', name: 'Chicken Breast (cooked)', category: 'Meat & Fish', defaultGrams: 160, defaultRole: 'protein', servings: [{ label: '4 oz', grams: 113 }, { label: '6 oz', grams: 170 }, { label: '100g', grams: 100 }], per100g: { carbs: 0, protein: 31.0, fat: 3.6, fiber: 0, iron: 1.0, calcium: 15, vitD: 0.1, magnesium: 29, sodium: 74 } },
  { id: 'usda-chicken-thigh', name: 'Chicken Thigh (cooked, skinless)', category: 'Meat & Fish', defaultGrams: 160, defaultRole: 'protein', servings: [{ label: '1 thigh', grams: 115 }, { label: '6 oz', grams: 170 }, { label: '100g', grams: 100 }], per100g: { carbs: 0, protein: 24.8, fat: 8.2, fiber: 0, iron: 1.3, calcium: 12, vitD: 0.1, magnesium: 24, sodium: 88 } },
  { id: 'usda-turkey-ground', name: 'Lean Ground Turkey (cooked)', category: 'Meat & Fish', defaultGrams: 150, defaultRole: 'protein', servings: [{ label: '4 oz', grams: 113 }, { label: '6 oz', grams: 170 }, { label: '100g', grams: 100 }], per100g: { carbs: 0, protein: 27.4, fat: 6.5, fiber: 0, iron: 1.9, calcium: 24, vitD: 0.3, magnesium: 28, sodium: 92 } },
  { id: 'usda-beef-lean', name: 'Lean Beef / Steak (cooked)', category: 'Meat & Fish', defaultGrams: 150, defaultRole: 'protein', servings: [{ label: '4 oz', grams: 113 }, { label: '6 oz', grams: 170 }, { label: '100g', grams: 100 }], per100g: { carbs: 0, protein: 28.5, fat: 7.8, fiber: 0, iron: 2.9, calcium: 18, vitD: 0.1, magnesium: 24, sodium: 65 } },
  { id: 'usda-salmon', name: 'Salmon Fillet (cooked)', category: 'Meat & Fish', defaultGrams: 150, defaultRole: 'protein', servings: [{ label: '1 fillet', grams: 150 }, { label: '4 oz', grams: 113 }, { label: '100g', grams: 100 }], per100g: { carbs: 0, protein: 22.1, fat: 12.4, fiber: 0, iron: 0.8, calcium: 12, vitD: 11.2, magnesium: 29, sodium: 59 } },
  { id: 'usda-tuna', name: 'Tuna (canned in water)', category: 'Meat & Fish', defaultGrams: 120, defaultRole: 'protein', servings: [{ label: '1 can', grams: 120 }, { label: '100g', grams: 100 }], per100g: { carbs: 0, protein: 25.5, fat: 0.8, fiber: 0, iron: 1.5, calcium: 11, vitD: 1.7, magnesium: 27, sodium: 320 } },
  { id: 'usda-cod', name: 'White Fish / Cod (cooked)', category: 'Meat & Fish', defaultGrams: 160, defaultRole: 'protein', servings: [{ label: '1 fillet', grams: 160 }, { label: '100g', grams: 100 }], per100g: { carbs: 0, protein: 22.8, fat: 0.9, fiber: 0, iron: 0.5, calcium: 14, vitD: 1.2, magnesium: 42, sodium: 78 } },
  { id: 'usda-tofu', name: 'Firm Tofu', category: 'Meat & Fish', defaultGrams: 160, defaultRole: 'protein', servings: [{ label: '½ block', grams: 175 }, { label: '100g', grams: 100 }], per100g: { carbs: 2.3, protein: 15.8, fat: 8.7, fiber: 2.3, iron: 2.7, calcium: 350, vitD: 0, magnesium: 58, sodium: 14 } },
  { id: 'usda-lentils', name: 'Lentils (cooked)', category: 'Meat & Fish', defaultGrams: 180, defaultRole: 'carb', servings: [{ label: '½ cup', grams: 100 }, { label: '1 cup', grams: 198 }], per100g: { carbs: 20.1, protein: 9.0, fat: 0.4, fiber: 7.9, iron: 3.3, calcium: 19, vitD: 0, magnesium: 36, sodium: 2 } },
  { id: 'usda-chickpeas', name: 'Chickpeas (cooked)', category: 'Meat & Fish', defaultGrams: 150, defaultRole: 'carb', servings: [{ label: '½ cup', grams: 82 }, { label: '1 cup', grams: 164 }], per100g: { carbs: 27.4, protein: 8.9, fat: 2.6, fiber: 7.6, iron: 2.9, calcium: 49, vitD: 0, magnesium: 48, sodium: 7 } },

  // Healthy Fats, Nuts & Seeds
  { id: 'usda-peanut-butter', name: 'Peanut Butter', category: 'Fats & Nuts', defaultGrams: 20, defaultRole: 'fixed', servings: [{ label: '1 tbsp', grams: 16 }, { label: '2 tbsp', grams: 32 }], per100g: { carbs: 20.0, protein: 25.0, fat: 50.0, fiber: 6.0, iron: 1.9, calcium: 43, vitD: 0, magnesium: 168, sodium: 150 } },
  { id: 'usda-almond-butter', name: 'Almond Butter', category: 'Fats & Nuts', defaultGrams: 20, defaultRole: 'fixed', servings: [{ label: '1 tbsp', grams: 16 }, { label: '2 tbsp', grams: 32 }], per100g: { carbs: 18.8, protein: 21.0, fat: 55.5, fiber: 10.3, iron: 3.5, calcium: 347, vitD: 0, magnesium: 279, sodium: 7 } },
  { id: 'usda-almonds', name: 'Almonds', category: 'Fats & Nuts', defaultGrams: 25, defaultRole: 'fixed', servings: [{ label: '1 oz (~23)', grams: 28 }, { label: '½ oz', grams: 14 }], per100g: { carbs: 21.6, protein: 21.2, fat: 49.9, fiber: 12.5, iron: 3.7, calcium: 269, vitD: 0, magnesium: 270, sodium: 1 } },
  { id: 'usda-walnuts', name: 'Walnuts', category: 'Fats & Nuts', defaultGrams: 25, defaultRole: 'fixed', servings: [{ label: '1 oz', grams: 28 }, { label: '¼ cup', grams: 30 }], per100g: { carbs: 13.7, protein: 15.2, fat: 65.2, fiber: 6.7, iron: 2.9, calcium: 98, vitD: 0, magnesium: 158, sodium: 2 } },
  { id: 'usda-chia', name: 'Chia Seeds', category: 'Fats & Nuts', defaultGrams: 12, defaultRole: 'fixed', servings: [{ label: '1 tbsp', grams: 12 }, { label: '2 tbsp', grams: 24 }], per100g: { carbs: 42.1, protein: 16.5, fat: 30.7, fiber: 34.4, iron: 7.7, calcium: 631, vitD: 0, magnesium: 335, sodium: 16 } },
  { id: 'usda-flax', name: 'Ground Flaxseed', category: 'Fats & Nuts', defaultGrams: 12, defaultRole: 'fixed', servings: [{ label: '1 tbsp', grams: 7 }, { label: '2 tbsp', grams: 14 }], per100g: { carbs: 28.9, protein: 18.3, fat: 42.2, fiber: 27.3, iron: 5.7, calcium: 255, vitD: 0, magnesium: 392, sodium: 30 } },
  { id: 'usda-avocado', name: 'Avocado', category: 'Fats & Nuts', defaultGrams: 60, defaultRole: 'fixed', servings: [{ label: '½ medium', grams: 75 }, { label: '1 medium', grams: 150 }, { label: '50g', grams: 50 }], per100g: { carbs: 8.5, protein: 2.0, fat: 14.7, fiber: 6.7, iron: 0.6, calcium: 12, vitD: 0, vitC: 10.0, magnesium: 29, sodium: 7 } },
  { id: 'usda-olive-oil', name: 'Extra Virgin Olive Oil', category: 'Fats & Nuts', defaultGrams: 10, defaultRole: 'fixed', servings: [{ label: '1 tsp', grams: 5 }, { label: '1 tbsp', grams: 14 }], per100g: { carbs: 0, protein: 0, fat: 100.0, fiber: 0, iron: 0.6, calcium: 1, vitD: 0, magnesium: 0, sodium: 2 } },
  { id: 'usda-butter', name: 'Butter', category: 'Fats & Nuts', defaultGrams: 10, defaultRole: 'fixed', servings: [{ label: '1 tsp', grams: 5 }, { label: '1 tbsp', grams: 14 }], per100g: { carbs: 0.1, protein: 0.9, fat: 81.1, fiber: 0, iron: 0, calcium: 24, vitD: 0, magnesium: 2, sodium: 11 } },

  // Vegetables & Sauces
  { id: 'usda-broccoli', name: 'Broccoli', category: 'Vegetables', defaultGrams: 120, defaultRole: 'fixed', servings: [{ label: '1 cup', grams: 91 }, { label: '150g', grams: 150 }], per100g: { carbs: 6.6, protein: 2.8, fat: 0.4, fiber: 2.6, iron: 0.7, calcium: 47, vitD: 0, vitC: 89.2, magnesium: 21, sodium: 33 } },
  { id: 'usda-spinach', name: 'Spinach', category: 'Vegetables', defaultGrams: 60, defaultRole: 'fixed', servings: [{ label: '2 cups raw', grams: 60 }, { label: '100g', grams: 100 }], per100g: { carbs: 3.6, protein: 2.9, fat: 0.4, fiber: 2.2, iron: 2.7, calcium: 99, vitD: 0, vitC: 28.1, magnesium: 79, sodium: 79 } },
  { id: 'usda-asparagus', name: 'Asparagus', category: 'Vegetables', defaultGrams: 120, defaultRole: 'fixed', servings: [{ label: '6 spears', grams: 100 }, { label: '150g', grams: 150 }], per100g: { carbs: 3.9, protein: 2.2, fat: 0.1, fiber: 2.1, iron: 2.1, calcium: 24, vitD: 0, vitC: 5.6, magnesium: 14, sodium: 2 } },
  { id: 'usda-mixed-veg', name: 'Mixed Roasted / Steamed Vegetables', category: 'Vegetables', defaultGrams: 150, defaultRole: 'fixed', servings: [{ label: '1 cup', grams: 130 }, { label: '2 cups', grams: 260 }], per100g: { carbs: 7.5, protein: 2.2, fat: 0.4, fiber: 3.0, iron: 0.9, calcium: 38, vitD: 0, vitC: 25.0, magnesium: 22, sodium: 30 } },
  { id: 'usda-tomato-sauce', name: 'Tomato Pasta Sauce', category: 'Sauces', defaultGrams: 140, defaultRole: 'fixed', servings: [{ label: '½ cup', grams: 125 }, { label: '1 cup', grams: 250 }], per100g: { carbs: 7.2, protein: 1.6, fat: 1.5, fiber: 1.8, iron: 0.8, calcium: 18, vitD: 0, vitC: 7.0, magnesium: 16, sodium: 320 } },

  // Popular Everyday Grocery & Cycling Brands (instant offline match)
  { id: 'brand-chobani-0', name: 'Chobani Nonfat Plain Greek Yogurt', category: 'Branded Dairy', defaultGrams: 170, defaultRole: 'protein', servings: [{ label: '1 cup (170g)', grams: 170 }, { label: '100g', grams: 100 }, { label: '250g', grams: 250 }], per100g: { carbs: 3.5, protein: 9.4, fat: 0, fiber: 0, iron: 0, calcium: 112, vitD: 0, magnesium: 11, sodium: 35 } },
  { id: 'brand-fage-0', name: 'Fage Total 0% Greek Yogurt', category: 'Branded Dairy', defaultGrams: 170, defaultRole: 'protein', servings: [{ label: '¾ cup', grams: 170 }, { label: '1 cup', grams: 225 }, { label: '100g', grams: 100 }], per100g: { carbs: 3.0, protein: 10.6, fat: 0, fiber: 0, iron: 0, calcium: 118, vitD: 0, magnesium: 11, sodium: 38 } },
  { id: 'brand-fage-2', name: 'Fage Total 2% Greek Yogurt', category: 'Branded Dairy', defaultGrams: 170, defaultRole: 'protein', servings: [{ label: '¾ cup', grams: 170 }, { label: '1 cup', grams: 225 }, { label: '100g', grams: 100 }], per100g: { carbs: 3.0, protein: 10.0, fat: 2.0, fiber: 0, iron: 0, calcium: 118, vitD: 0, magnesium: 11, sodium: 38 } },
  { id: 'brand-siggis', name: "Siggi's Plain 0% Skyr", category: 'Branded Dairy', defaultGrams: 150, defaultRole: 'protein', servings: [{ label: '1 pot', grams: 150 }, { label: '100g', grams: 100 }], per100g: { carbs: 4.0, protein: 10.7, fat: 0, fiber: 0, iron: 0, calcium: 133, vitD: 0, magnesium: 12, sodium: 43 } },
  { id: 'brand-fairlife-2', name: 'Fairlife 2% Ultra-Filtered Milk', category: 'Branded Dairy', defaultGrams: 240, defaultRole: 'protein', servings: [{ label: '1 cup', grams: 240 }, { label: '½ cup', grams: 120 }], per100g: { carbs: 2.5, protein: 5.4, fat: 1.9, fiber: 0, iron: 0, calcium: 158, vitD: 1.2, magnesium: 12, sodium: 50 } },
  { id: 'brand-fairlife-core', name: 'Fairlife Core Power Protein Shake (26g)', category: 'Branded Dairy', defaultGrams: 414, defaultRole: 'protein', servings: [{ label: '1 bottle', grams: 414 }, { label: '½ bottle', grams: 207 }], per100g: { carbs: 1.7, protein: 6.3, fat: 1.1, fiber: 0, iron: 0, calcium: 157, vitD: 1.0, magnesium: 12, sodium: 58 } },
  { id: 'brand-quaker-oats', name: 'Quaker Old Fashioned Rolled Oats', category: 'Branded Grains', defaultGrams: 80, defaultRole: 'carb', servings: [{ label: '½ cup', grams: 40 }, { label: '1 cup', grams: 80 }, { label: '100g', grams: 100 }], per100g: { carbs: 67.5, protein: 12.5, fat: 7.5, fiber: 10.0, iron: 3.8, calcium: 50, vitD: 0, magnesium: 138, sodium: 0 } },
  { id: 'brand-daves-bread', name: "Dave's Killer Bread 21 Whole Grains", category: 'Branded Grains', defaultGrams: 90, defaultRole: 'carb', servings: [{ label: '1 slice', grams: 45 }, { label: '2 slices', grams: 90 }], per100g: { carbs: 48.9, protein: 11.1, fat: 3.3, fiber: 11.1, iron: 2.7, calcium: 44, vitD: 0, magnesium: 65, sodium: 378 } },
  { id: 'brand-kodiak', name: 'Kodiak Cakes Power Cakes Mix (dry)', category: 'Branded Grains', defaultGrams: 63, defaultRole: 'carb', servings: [{ label: '½ cup', grams: 63 }, { label: '1 cup', grams: 126 }], per100g: { carbs: 58.7, protein: 22.2, fat: 3.2, fiber: 7.9, iron: 3.2, calcium: 111, vitD: 0, magnesium: 60, sodium: 603 } },
  { id: 'brand-clif-bar', name: 'Clif Bar Energy Bar (1 bar = 68g)', category: 'Bike Fuel', defaultGrams: 68, defaultRole: 'carb', servings: [{ label: '½ bar', grams: 34 }, { label: '1 bar', grams: 68 }, { label: '2 bars', grams: 136 }], per100g: { carbs: 64.7, protein: 14.7, fat: 7.4, fiber: 7.4, iron: 5.3, calcium: 294, vitD: 0, magnesium: 132, sodium: 220 } },
  { id: 'brand-clif-bloks', name: 'Clif Bloks Energy Chews (1 pack = 60g)', category: 'Bike Fuel', defaultGrams: 60, defaultRole: 'carb', servings: [{ label: '½ pack (3 chews)', grams: 30 }, { label: '1 pack', grams: 60 }], per100g: { carbs: 80.0, protein: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 167 } },
  { id: 'brand-maurten-gel100', name: 'Maurten Gel 100 (1 packet = 40g)', category: 'Bike Fuel', defaultGrams: 40, defaultRole: 'carb', servings: [{ label: '1 gel', grams: 40 }, { label: '2 gels', grams: 80 }], per100g: { carbs: 62.5, protein: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 50 } },
  { id: 'brand-maurten-mix320', name: 'Maurten Drink Mix 320 (1 sachet = 80g)', category: 'Bike Fuel', defaultGrams: 80, defaultRole: 'carb', servings: [{ label: '1 sachet', grams: 80 }, { label: '½ sachet', grams: 40 }], per100g: { carbs: 98.8, protein: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 250 } },
  { id: 'brand-sis-gel', name: 'SiS GO Isotonic Energy Gel (60ml)', category: 'Bike Fuel', defaultGrams: 60, defaultRole: 'carb', servings: [{ label: '1 gel', grams: 60 }, { label: '2 gels', grams: 120 }], per100g: { carbs: 36.7, protein: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 17 } },
  { id: 'brand-gu-gel', name: 'GU Energy Gel (1 packet = 32g)', category: 'Bike Fuel', defaultGrams: 32, defaultRole: 'carb', servings: [{ label: '1 gel', grams: 32 }, { label: '2 gels', grams: 64 }], per100g: { carbs: 68.8, protein: 0, fat: 0, fiber: 0, iron: 0, calcium: 63, vitD: 0, magnesium: 0, sodium: 188 } },
  { id: 'brand-skratch', name: 'Skratch Labs Sport Hydration Mix (1 scoop = 22g)', category: 'Bike Fuel', defaultGrams: 22, defaultRole: 'carb', servings: [{ label: '1 scoop', grams: 22 }, { label: '2 scoops', grams: 44 }], per100g: { carbs: 90.9, protein: 0, fat: 0, fiber: 0, iron: 0, calcium: 182, vitD: 0, vitC: 164, magnesium: 182, sodium: 1727 } },
  { id: 'brand-kind-bar', name: 'KIND Dark Chocolate Nuts & Sea Salt Bar (40g)', category: 'Branded Snacks', defaultGrams: 40, defaultRole: 'fixed', servings: [{ label: '1 bar', grams: 40 }, { label: '2 bars', grams: 80 }], per100g: { carbs: 40.0, protein: 15.0, fat: 37.5, fiber: 17.5, iron: 3.0, calcium: 125, vitD: 0, magnesium: 160, sodium: 313 } },
  { id: 'brand-rxbar', name: 'RXBAR Protein Bar (1 bar = 52g)', category: 'Branded Snacks', defaultGrams: 52, defaultRole: 'protein', servings: [{ label: '1 bar', grams: 52 }, { label: '½ bar', grams: 26 }], per100g: { carbs: 44.2, protein: 23.1, fat: 17.3, fiber: 9.6, iron: 2.1, calcium: 58, vitD: 0, magnesium: 70, sodium: 500 } },
  { id: 'brand-quest-bar', name: 'Quest Protein Bar (1 bar = 60g)', category: 'Branded Snacks', defaultGrams: 60, defaultRole: 'protein', servings: [{ label: '1 bar', grams: 60 }, { label: '½ bar', grams: 30 }], per100g: { carbs: 36.7, protein: 35.0, fat: 13.3, fiber: 23.3, iron: 1.5, calcium: 167, vitD: 0, magnesium: 40, sodium: 367 } },
  { id: 'brand-on-whey', name: 'Optimum Nutrition Gold Standard Whey (1 scoop = 31g)', category: 'Branded Dairy', defaultGrams: 31, defaultRole: 'protein', servings: [{ label: '1 scoop', grams: 31 }, { label: '2 scoops', grams: 62 }], per100g: { carbs: 9.7, protein: 77.4, fat: 4.8, fiber: 0, iron: 0, calcium: 419, vitD: 0, magnesium: 65, sodium: 419 } },

  // Generic Cycling Fuel
  { id: 'usda-carb-mix', name: 'Carb Drink Mix (powder)', category: 'Bike Fuel', defaultGrams: 60, defaultRole: 'carb', servings: [{ label: '1 scoop (30g)', grams: 30 }, { label: '2 scoops (60g)', grams: 60 }, { label: '90g', grams: 90 }], per100g: { carbs: 95.0, protein: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitD: 0, vitC: 0, magnesium: 40, sodium: 800 } },
  { id: 'usda-gel', name: 'Energy Gel (1 packet ≈ 40g)', category: 'Bike Fuel', defaultGrams: 40, defaultRole: 'carb', servings: [{ label: '1 gel', grams: 40 }, { label: '2 gels', grams: 80 }], per100g: { carbs: 65.0, protein: 0, fat: 0, fiber: 0, iron: 0, calcium: 0, vitD: 0, vitC: 0, magnesium: 20, sodium: 150 } },
];

export function isPackagedFood(item) {
  if (!item) return false;
  if (String(item.id || '').startsWith('brand-')) return true;
  if (/^branded|bike fuel/i.test(String(item.category || ''))) return true;
  if (item.source === 'USDA Branded' || item.source === 'Open Food Facts' || Boolean(item.brand)) return true;
  return false;
}

export function getFoodServings(item) {
  if (!item) return [{ label: '100g', grams: 100 }];
  if (Array.isArray(item.servings) && item.servings.length > 0) {
    const validServings = item.servings
      .filter(
        (s) =>
          s &&
          typeof s.label === 'string' &&
          s.label.trim() &&
          Number.isFinite(Number(s.grams)) &&
          Number(s.grams) > 0
      )
      .map((s) => ({ label: s.label.trim(), grams: Math.round(Number(s.grams)) }));
    if (validServings.length > 0) {
      return validServings;
    }
  }
  const matched = USDA_WHOLE_FOODS.find(
    (f) => f.id === item.id || f.name.toLowerCase() === String(item.name || '').toLowerCase()
  );
  if (matched?.servings?.length) return matched.servings;

  const baseG = Math.max(10, Math.round(Number(item.defaultGrams || item.grams) || 100));
  const list = [];
  if (item.servingLabel) {
    list.push({ label: item.servingLabel, grams: baseG });
  } else if (baseG !== 100) {
    list.push({ label: '1 serving', grams: baseG });
  }
  if (baseG >= 40 && baseG !== 100) {
    const half = Math.round(baseG / 2);
    if (half >= 15) list.push({ label: '½ serving', grams: half });
  }
  if (!list.some((s) => s.grams === 100)) {
    list.push({ label: '100g', grams: 100 });
  }
  if (baseG <= 90 && !list.some((s) => s.grams === baseG * 2)) {
    list.push({ label: '2 servings', grams: baseG * 2 });
  }
  return list.slice(0, 4);
}

export function searchLocalWholeFoods(query, filter = 'all') {
  const q = String(query || '').trim().toLowerCase();
  const pool =
    filter === 'whole'
      ? USDA_WHOLE_FOODS.filter((item) => !isPackagedFood(item))
      : filter === 'packaged'
      ? USDA_WHOLE_FOODS.filter((item) => isPackagedFood(item))
      : USDA_WHOLE_FOODS;
  if (!q) return pool.slice(0, 14);
  const terms = q.split(/\s+/).filter(Boolean);
  return pool
    .filter((item) => {
      const hay = `${item.name} ${item.category}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    })
    .slice(0, 14);
}

function smartTitleCase(str) {
  const s = String(str || '').trim();
  if (!s) return '';
  // Only normalize shouting ALL-CAPS descriptions from USDA Branded labels
  if (s === s.toUpperCase() && s.length > 4) {
    return s
      .toLowerCase()
      .replace(/(^|[\s,/-])([a-z])/g, (_, sep, ch) => `${sep}${ch.toUpperCase()}`);
  }
  return s;
}

function pickDefaultRole(carbs, protein) {
  if (carbs >= 40 && carbs > protein * 2) return 'carb';
  if (protein >= 18 && protein > carbs) return 'protein';
  return 'fixed';
}

function normalizeUsdaFood(f, allowZeroMacro = false) {
  if (!f || !Array.isArray(f.foodNutrients)) return null;
  const byId = {};
  for (const n of f.foodNutrients) {
    const id = Number(n.nutrientId ?? n.nutrient?.id);
    const val = Number(n.value ?? n.amount);
    if (id && Number.isFinite(val)) {
      byId[id] = val;
    }
  }
  const carbs = Number(byId[1005] ?? 0);
  const protein = Number(byId[1003] ?? 0);
  const fat = Number(byId[1004] ?? 0);
  if (!allowZeroMacro && carbs === 0 && protein === 0 && fat === 0) return null;

  const rawDesc = smartTitleCase(f.description || '');
  if (!rawDesc) return null;

  const rawBrand = smartTitleCase(f.brandName || f.brandOwner || '');
  const brand = rawBrand && !/^none$/i.test(rawBrand) ? rawBrand : '';
  const displayName =
    brand && !rawDesc.toLowerCase().includes(brand.toLowerCase())
      ? `${rawDesc} (${brand})`
      : rawDesc;

  const servingUnit = String(f.servingSizeUnit || '').toLowerCase();
  const rawServing = Number(f.servingSize);
  const servingGrams =
    Number.isFinite(rawServing) && rawServing > 0 && (servingUnit === 'g' || servingUnit === 'ml' || servingUnit === 'grm')
      ? rawServing
      : 100;
  const clampedServingG = Math.min(350, Math.max(15, Math.round(servingGrams)));
  const rawHousehold = String(f.householdServingFullText || '').trim();
  const householdLabel = rawHousehold ? smartTitleCase(rawHousehold).slice(0, 26) : '';

  const servings = [];
  const pushServing = (label, grams) => {
    const g = Math.round(Number(grams));
    if (!label || !Number.isFinite(g) || g < 5 || g > 1000) return;
    if (!servings.some((s) => s.grams === g)) {
      servings.push({ label, grams: g });
    }
  };
  if (householdLabel) {
    pushServing(householdLabel, clampedServingG);
  } else if (clampedServingG !== 100) {
    pushServing('1 serving', clampedServingG);
  }
  if (Array.isArray(f.foodMeasures)) {
    for (const m of f.foodMeasures.slice(0, 3)) {
      const mLabel = String(m.disseminationText || m.measureUnitName || '').trim();
      const mGrams = Number(m.gramWeight);
      if (mLabel && mGrams > 0 && !/quantity not specified/i.test(mLabel)) {
        pushServing(mLabel.slice(0, 24), mGrams);
      }
    }
  }
  pushServing('100g', 100);

  const sourceTag =
    f.dataType === 'Branded'
      ? 'USDA Branded'
      : f.dataType === 'Foundation' || f.dataType === 'SR Legacy'
      ? 'USDA Verified'
      : 'USDA FNDDS';

  return {
    id: `usda-fdc-${f.fdcId}`,
    barcode: f.gtinUpc || '',
    name: displayName,
    brand,
    source: sourceTag,
    defaultGrams: clampedServingG,
    servingLabel: householdLabel || '',
    servings: servings.slice(0, 4),
    defaultRole: pickDefaultRole(carbs, protein),
    per100g: {
      carbs: Number(carbs.toFixed(1)),
      protein: Number(protein.toFixed(1)),
      fat: Number(fat.toFixed(1)),
      fiber: Number((byId[1079] || 0).toFixed(1)),
      iron: Number((byId[1089] || 0).toFixed(1)),
      calcium: Math.round(byId[1087] || 0),
      vitD: Number((byId[1114] || 0).toFixed(1)),
      vitC: Math.round(byId[1162] || 0),
      magnesium: Math.round(byId[1090] || 0),
      sodium: Math.round(byId[1093] || 0),
    },
    perServingMicros: {
      iron: Number((((byId[1089] || 0) * servingGrams) / 100).toFixed(1)),
      calcium: Math.round(((byId[1087] || 0) * servingGrams) / 100),
      vitD: Number((((byId[1114] || 0) * servingGrams) / 100).toFixed(1)),
      vitC: Math.round(((byId[1162] || 0) * servingGrams) / 100),
      magnesium: Math.round(((byId[1090] || 0) * servingGrams) / 100),
      sodium: Math.round(((byId[1093] || 0) * servingGrams) / 100),
    },
  };
}

function normalizeOpenFoodFactsProduct(p, allowZeroMacro = false) {
  if (!p) return null;
  const n = p.nutriments || {};
  const carbs = Number(n.carbohydrates_100g ?? 0);
  const protein = Number(n.proteins_100g ?? 0);
  const fat = Number(n.fat_100g ?? 0);
  if ([carbs, protein, fat].some((v) => Number.isNaN(v))) return null;
  if (!allowZeroMacro && carbs === 0 && protein === 0 && fat === 0) return null;

  const brand = p.brands ? String(p.brands).split(',')[0].trim() : '';
  const baseName = String(p.product_name || p.product_name_en || '').trim();
  if (!baseName) return null;

  const displayName =
    brand && !baseName.toLowerCase().includes(brand.toLowerCase())
      ? `${baseName} (${brand})`
      : baseName;

  const servingSizeRaw = String(p.serving_size || '').trim();
  let parsedServingG = Number(p.serving_quantity) || 0;
  if (!parsedServingG && servingSizeRaw) {
    const m = servingSizeRaw.match(/(\d+(?:\.\d+)?)\s*(?:g|ml)\b/i);
    if (m) parsedServingG = Number(m[1]);
  }
  const servingGrams = parsedServingG > 0 ? parsedServingG : 100;
  const clampedServingG = Math.min(350, Math.max(15, Math.round(servingGrams)));
  const cleanServingLabel = servingSizeRaw
    ? servingSizeRaw.replace(/\(\s*\d+(?:\.\d+)?\s*(?:g|ml)\s*\)/i, '').trim().slice(0, 24)
    : '';
  const servings = [];
  if (cleanServingLabel && !/^\d+\s*(?:g|ml)$/i.test(cleanServingLabel)) {
    servings.push({ label: cleanServingLabel, grams: clampedServingG });
  } else if (clampedServingG !== 100) {
    servings.push({ label: '1 serving', grams: clampedServingG });
  }
  if (!servings.some((s) => s.grams === 100)) {
    servings.push({ label: '100g', grams: 100 });
  }
  if (clampedServingG <= 90 && !servings.some((s) => s.grams === clampedServingG * 2)) {
    servings.push({ label: '2 servings', grams: clampedServingG * 2 });
  }

  return {
    id: `off-${p.code || Date.now()}`,
    barcode: p.code || '',
    name: displayName,
    brand,
    source: 'Open Food Facts',
    defaultGrams: clampedServingG,
    servingLabel: cleanServingLabel,
    servings: servings.slice(0, 4),
    defaultRole: pickDefaultRole(carbs, protein),
    per100g: {
      carbs: Number(carbs.toFixed(1)),
      protein: Number(protein.toFixed(1)),
      fat: Number(fat.toFixed(1)),
      fiber: Number((Number(n.fiber_100g) || 0).toFixed(1)),
      iron: Number(((Number(n.iron_100g) || 0) * 1000).toFixed(1)),
      calcium: Math.round((Number(n.calcium_100g) || 0) * 1000),
      vitD: Number(((Number(n['vitamin-d_100g']) || 0) * 1000000).toFixed(1)),
      vitC: Math.round((Number(n['vitamin-c_100g']) || 0) * 1000),
      magnesium: Math.round((Number(n.magnesium_100g) || 0) * 1000),
      sodium: Math.round((Number(n.sodium_100g) || (Number(n.salt_100g) || 0) / 2.5) * 1000),
    },
    perServingMicros: {
      iron: Number(((Number(n.iron_serving) || 0) * 1000).toFixed(1)),
      calcium: Math.round((Number(n.calcium_serving) || 0) * 1000),
      vitD: Number(((Number(n['vitamin-d_serving']) || 0) * 1000000).toFixed(1)),
      vitC: Math.round((Number(n['vitamin-c_serving']) || 0) * 1000),
      magnesium: Math.round((Number(n.magnesium_serving) || 0) * 1000),
      sodium: Math.round((Number(n.sodium_serving) || 0) * 1000),
    },
  };
}

async function fetchWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchUsdaFdc(query, apiKey, pageSize = 10) {
  const key = (apiKey || '').trim() || 'DEMO_KEY';
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=${pageSize}&api_key=${encodeURIComponent(key)}`;
  const resp = await fetchWithTimeout(url, 6000);
  if (resp.status === 429) {
    return { items: [], rateLimited: true };
  }
  if (!resp.ok) {
    return { items: [], error: `USDA HTTP ${resp.status}` };
  }
  const data = await resp.json();
  const foods = Array.isArray(data.foods) ? data.foods : [];
  return {
    items: foods.map((f) => normalizeUsdaFood(f)).filter(Boolean),
    rateLimited: false,
  };
}

async function searchOffV2ByBrand(query) {
  const slug = String(query || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  if (!slug) return [];

  const firstWord = slug.split('-')[0];
  const trySlug = async (tag) => {
    const resp = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v2/search?brands_tags=${encodeURIComponent(tag)}&sort_by=unique_scans_n&page_size=8&fields=code,product_name,product_name_en,brands,serving_quantity,serving_size,nutriments`,
      5000
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const list = Array.isArray(data.products) ? data.products : [];
    return list.map((p) => normalizeOpenFoodFactsProduct(p)).filter(Boolean);
  };

  const primary = await trySlug(slug);
  if (primary.length > 0 || !firstWord || firstWord === slug) return primary;

  // If user typed "Chobani strawberry", query brand "chobani" and rank items matching the rest of the words
  const broad = await trySlug(firstWord);
  const restTerms = slug.split('-').slice(1).filter((t) => t.length >= 2);
  if (restTerms.length === 0) return broad;
  const matched = broad.filter((item) => {
    const hay = item.name.toLowerCase();
    return restTerms.some((t) => hay.includes(t));
  });
  return matched.length > 0 ? matched : broad.slice(0, 4);
}

export async function lookupBarcode(barcode, { allowZeroMacro = false, usdaApiKey = '' } = {}) {
  const clean = String(barcode || '').replace(/[^\d]/g, '');
  if (clean.length < 6) {
    throw new Error('Enter a valid barcode (at least 6 digits).');
  }

  // 1. Open Food Facts v2 product endpoint (global barcode coverage + full CORS)
  try {
    const resp = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json?fields=code,product_name,product_name_en,brands,serving_quantity,serving_size,nutriments`,
      5000
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.status === 1 && data.product) {
        const normalized = normalizeOpenFoodFactsProduct(data.product, allowZeroMacro);
        if (normalized) return normalized;
      }
    }
  } catch {
    // fall through to USDA FDC barcode fallback
  }

  // 2. Fallback to USDA FoodData Central GTIN/UPC lookup (strong US grocery coverage)
  try {
    const key = (usdaApiKey || '').trim() || 'DEMO_KEY';
    const resp = await fetchWithTimeout(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(clean)}&dataType=Branded&pageSize=3&api_key=${encodeURIComponent(key)}`,
      6000
    );
    if (resp.ok) {
      const data = await resp.json();
      const foods = Array.isArray(data.foods) ? data.foods : [];
      const exact = foods.find((f) => String(f.gtinUpc || '').replace(/^0+/, '') === clean.replace(/^0+/, '')) || foods[0];
      const normalized = normalizeUsdaFood(exact, allowZeroMacro);
      if (normalized) return normalized;
    }
  } catch {
    // ignore and show clear user message below
  }

  throw new Error(`Barcode ${clean} wasn't found in Open Food Facts or USDA FoodData Central. You can add it manually below.`);
}

export async function searchPackagedFoods(query, { usdaApiKey = '' } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) {
    return { results: [], sources: [], warning: '' };
  }

  const hasPersonalUsdaKey = Boolean((usdaApiKey || '').trim());
  let usdaItems = [];
  let usdaRateLimited = false;
  let offItems = [];

  if (hasPersonalUsdaKey) {
    // Personal USDA API key (1,000 req/hr): query USDA FDC first, then Open Food Facts if < 3 hits
    try {
      const usdaRes = await searchUsdaFdc(q, usdaApiKey, 12);
      usdaItems = usdaRes.items || [];
      usdaRateLimited = Boolean(usdaRes.rateLimited);
    } catch {
      usdaItems = [];
    }
    if (usdaItems.length < 3 || usdaRateLimited) {
      try {
        offItems = await searchOffV2ByBrand(q);
      } catch {
        offItems = [];
      }
    }
  } else {
    // Shared DEMO_KEY has a strict 10 req/6hr IP limit: query Open Food Facts v2 first (matching lookupBarcode),
    // and fall back to USDA DEMO_KEY only when Open Food Facts returns < 3 hits.
    try {
      offItems = await searchOffV2ByBrand(q);
    } catch {
      offItems = [];
    }
    if (offItems.length < 3) {
      try {
        const usdaRes = await searchUsdaFdc(q, '', 12);
        usdaItems = usdaRes.items || [];
        usdaRateLimited = Boolean(usdaRes.rateLimited);
      } catch {
        usdaItems = [];
      }
    }
  }

  const merged = [];
  const seen = new Set();
  const pushUnique = (item) => {
    const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  };

  for (const item of usdaItems) pushUnique(item);
  for (const item of offItems) pushUnique(item);

  const sources = [];
  if (usdaItems.length > 0) sources.push('USDA FoodData Central');
  if (offItems.length > 0) sources.push('Open Food Facts');

  let warning = '';
  if (usdaRateLimited && merged.length === 0) {
    warning =
      'USDA shared demo search hit its hourly limit. Add your own free USDA API key in Sync (takes 10 sec) for 1,000 searches/hr, or scan the package barcode.';
  } else if (usdaRateLimited) {
    warning = 'Showing Open Food Facts matches (add a free personal USDA key in Sync for unlimited USDA Branded search).';
  } else if (merged.length === 0) {
    warning = `No online matches for "${q}". Try a shorter brand name (e.g. "Chobani" or "Clif"), scan the barcode, or tap Write Custom Food.`;
  }

  return {
    results: merged.slice(0, 12),
    sources,
    warning,
  };
}
