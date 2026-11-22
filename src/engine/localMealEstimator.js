// Client-side USDA/NCCDB work-meal estimator & direct AI fallback (works 100% offline & in standalone HTML preview!)

const LOCAL_FOOD_DB = [
  { keys: ['chicken breast', 'grilled chicken', 'roast chicken', 'chicken'], name: 'Grilled Chicken Breast', grams: 150, p: 46, c: 0, f: 5, fiber: 0, iron: 1.5, calcium: 22, vitD: 0.2, magnesium: 42, sodium: 320 },
  { keys: ['chicken thigh', 'teriyaki chicken', 'fried chicken', 'crispy chicken'], name: 'Chicken Thigh / Sauced Chicken', grams: 160, p: 36, c: 10, f: 16, fiber: 0, iron: 1.8, calcium: 20, vitD: 0.2, magnesium: 36, sodium: 620 },
  { keys: ['salmon', 'grilled salmon', 'baked salmon'], name: 'Salmon Fillet', grams: 150, p: 34, c: 0, f: 18, fiber: 0, iron: 1.2, calcium: 18, vitD: 14, magnesium: 45, sodium: 280 },
  { keys: ['tuna', 'tuna salad'], name: 'Tuna', grams: 130, p: 32, c: 2, f: 6, fiber: 0, iron: 1.8, calcium: 18, vitD: 3.5, magnesium: 40, sodium: 420 },
  { keys: ['turkey', 'roast turkey'], name: 'Sliced Turkey Breast', grams: 120, p: 30, c: 2, f: 3, fiber: 0, iron: 1.4, calcium: 16, vitD: 0.2, magnesium: 32, sodium: 540 },
  { keys: ['steak', 'beef', 'bolognese', 'meatball', 'burger', 'ground beef'], name: 'Lean Beef / Steak', grams: 150, p: 38, c: 3, f: 16, fiber: 0, iron: 3.8, calcium: 22, vitD: 0.2, magnesium: 34, sodium: 380 },
  { keys: ['pork', 'ham', 'pulled pork', 'bacon'], name: 'Pork / Ham', grams: 140, p: 32, c: 4, f: 15, fiber: 0, iron: 1.4, calcium: 18, vitD: 0.8, magnesium: 30, sodium: 680 },
  { keys: ['tofu', 'tempeh', 'edamame'], name: 'Tofu / Soy Protein', grams: 150, p: 18, c: 5, f: 9, fiber: 2, iron: 3.2, calcium: 240, vitD: 0, magnesium: 65, sodium: 220 },
  { keys: ['egg', 'eggs', 'omelette', 'omelet', 'frittata'], name: 'Eggs (2 large)', grams: 100, p: 13, c: 1, f: 10, fiber: 0, iron: 1.8, calcium: 56, vitD: 2.2, magnesium: 12, sodium: 180 },
  { keys: ['shrimp', 'prawns', 'cod', 'white fish', 'fish'], name: 'White Fish / Shrimp', grams: 150, p: 32, c: 1, f: 3, fiber: 0, iron: 0.9, calcium: 45, vitD: 2.5, magnesium: 52, sodium: 340 },
  { keys: ['greek yogurt', 'yogurt', 'skyr', 'cottage cheese'], name: 'Greek Yogurt / Cottage Cheese', grams: 180, p: 18, c: 9, f: 4, fiber: 0, iron: 0.2, calcium: 210, vitD: 0.5, magnesium: 20, sodium: 180 },
  { keys: ['cheese', 'parmesan', 'cheddar', 'feta', 'mozzarella'], name: 'Cheese', grams: 35, p: 9, c: 1, f: 10, fiber: 0, iron: 0.2, calcium: 250, vitD: 0.3, magnesium: 10, sodium: 260 },
  { keys: ['white rice', 'jasmine rice', 'basmati', 'brown rice', 'rice'], name: 'Cooked Rice', grams: 200, p: 5, c: 56, f: 1, fiber: 1.4, iron: 1.2, calcium: 20, vitD: 0, magnesium: 24, sodium: 180 },
  { keys: ['pasta', 'spaghetti', 'penne', 'noodles', 'ramen', 'udon', 'mac'], name: 'Cooked Pasta / Noodles', grams: 220, p: 11, c: 64, f: 2, fiber: 3.5, iron: 2.4, calcium: 18, vitD: 0, magnesium: 38, sodium: 240 },
  { keys: ['quinoa', 'couscous', 'farro', 'bulgur', 'grain bowl'], name: 'Quinoa / Grain Base', grams: 185, p: 8, c: 39, f: 3, fiber: 5, iron: 2.8, calcium: 32, vitD: 0, magnesium: 118, sodium: 180 },
  { keys: ['potato', 'potatoes', 'sweet potato', 'mash', 'fries', 'wedges'], name: 'Potatoes / Sweet Potato', grams: 220, p: 4, c: 42, f: 4, fiber: 5, iron: 1.6, calcium: 40, vitD: 0, magnesium: 50, sodium: 260 },
  { keys: ['sourdough', 'bread', 'roll', 'baguette', 'toast', 'ciabatta', 'bagel', 'bun'], name: 'Bread / Roll', grams: 75, p: 7, c: 38, f: 2, fiber: 2.8, iron: 2.2, calcium: 55, vitD: 0, magnesium: 24, sodium: 380 },
  { keys: ['sandwich', 'panini', 'sub', 'wrap', 'burrito', 'pita', 'tortilla'], name: 'Sandwich / Wrap Base', grams: 130, p: 12, c: 52, f: 7, fiber: 4, iron: 2.8, calcium: 95, vitD: 0, magnesium: 40, sodium: 640 },
  { keys: ['pizza'], name: 'Pizza (2 slices)', grams: 220, p: 24, c: 68, f: 22, fiber: 4.5, iron: 3.2, calcium: 360, vitD: 0.4, magnesium: 46, sodium: 1180 },
  { keys: ['sushi', 'poke'], name: 'Sushi / Poke Bowl', grams: 320, p: 24, c: 68, f: 9, fiber: 3, iron: 2.2, calcium: 45, vitD: 4, magnesium: 65, sodium: 920 },
  { keys: ['curry', 'tikka', 'butter chicken', 'stir fry', 'stir-fry'], name: 'Curry / Stir-Fry Sauce & Mix', grams: 220, p: 18, c: 22, f: 16, fiber: 3.5, iron: 2.5, calcium: 65, vitD: 0, magnesium: 45, sodium: 780 },
  { keys: ['soup', 'chili', 'stew', 'lentil', 'beans', 'chickpeas', 'hummus'], name: 'Soup / Legumes / Beans', grams: 240, p: 14, c: 34, f: 6, fiber: 9, iron: 4.2, calcium: 65, vitD: 0, magnesium: 72, sodium: 620 },
  { keys: ['oats', 'oatmeal', 'porridge', 'granola', 'muesli'], name: 'Oats / Granola Bowl', grams: 80, p: 10, c: 52, f: 6, fiber: 7, iron: 3.2, calcium: 45, vitD: 0, magnesium: 105, sodium: 90 },
  { keys: ['salad', 'greens', 'spinach', 'arugula', 'lettuce', 'mixed greens'], name: 'Mixed Salad Greens', grams: 120, p: 3, c: 7, f: 1, fiber: 3.2, iron: 2.4, calcium: 80, vitD: 0, magnesium: 46, sodium: 60 },
  { keys: ['broccoli', 'veggies', 'vegetables', 'roasted veg', 'carrots', 'peppers', 'zucchini', 'asparagus'], name: 'Roasted / Steamed Vegetables', grams: 150, p: 4, c: 12, f: 4, fiber: 4.8, iron: 1.4, calcium: 65, vitD: 0, magnesium: 38, sodium: 190 },
  { keys: ['banana'], name: 'Banana', grams: 120, p: 1, c: 27, f: 0, fiber: 3.1, iron: 0.3, calcium: 6, vitD: 0, magnesium: 32, sodium: 1 },
  { keys: ['apple', 'orange', 'berries', 'fruit', 'grapes', 'pear'], name: 'Fresh Fruit', grams: 150, p: 1, c: 21, f: 0, fiber: 3.8, iron: 0.3, calcium: 18, vitD: 0, magnesium: 14, sodium: 2 },
  { keys: ['avocado', 'guacamole'], name: 'Avocado', grams: 75, p: 2, c: 6, f: 11, fiber: 5, iron: 0.4, calcium: 9, vitD: 0, magnesium: 22, sodium: 8 },
  { keys: ['olive oil', 'dressing', 'vinaigrette', 'mayo', 'mayonnaise', 'pesto', 'aioli', 'sauce', 'butter', 'cream'], name: 'Cooking Oil / Dressing / Sauce', grams: 20, p: 0, c: 2, f: 14, fiber: 0, iron: 0.1, calcium: 6, vitD: 0, magnesium: 2, sodium: 240 },
  { keys: ['nuts', 'almonds', 'walnuts', 'peanut butter', 'seeds'], name: 'Nuts / Seeds', grams: 30, p: 6, c: 6, f: 15, fiber: 3, iron: 1.1, calcium: 60, vitD: 0, magnesium: 75, sodium: 60 },
  { keys: ['cookie', 'cake', 'brownie', 'pastry', 'croissant', 'muffin', 'dessert'], name: 'Bakery Pastry / Dessert', grams: 85, p: 5, c: 44, f: 15, fiber: 1.5, iron: 1.5, calcium: 40, vitD: 0.2, magnesium: 18, sodium: 280 },
  { keys: ['latte', 'cappuccino', 'flat white', 'milk'], name: 'Milk Coffee / Latte', grams: 240, p: 8, c: 12, f: 6, fiber: 0, iron: 0.1, calcium: 260, vitD: 2.5, magnesium: 24, sodium: 110 },
];

function extractPortionMultiplier(clause) {
  const lower = clause.toLowerCase();
  const gramMatch = lower.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (gramMatch) return { explicitGrams: Number(gramMatch[1]), mult: 1 };

  const numMatch = lower.match(/(\d+(?:\.\d+)?)\s*(cup|cups|slice|slices|piece|pieces|scoop|scoops|bowl|bowls|egg|eggs)\b/);
  if (numMatch) {
    const qty = Number(numMatch[1]);
    const unit = numMatch[2];
    if (unit.startsWith('cup')) return { mult: Math.min(Math.max(qty * 0.85, 0.35), 3) };
    if (unit.startsWith('egg')) return { mult: Math.min(Math.max(qty / 2, 0.5), 3) };
    if (unit.startsWith('slice') || unit.startsWith('piece')) return { mult: Math.min(Math.max(qty * 0.55, 0.4), 3) };
    return { mult: Math.min(Math.max(qty, 0.5), 2.5) };
  }

  if (/\b(half|1\/2|tiny|little|bit of|light|small)\b/.test(lower)) return { mult: 0.68 };
  if (/\b(double|extra|huge|massive|two|2x)\b/.test(lower)) return { mult: 1.55 };
  if (/\b(large|big|generous|heaping|loaded|full plate)\b/.test(lower)) return { mult: 1.32 };
  return { mult: 1.0 };
}

export function estimateMealLocally(text = '', hasImage = false, contextHint = 'work cafeteria meal') {
  const cleanText = String(text || '').trim();
  const clauses = cleanText
    .split(/[,+&;\n]|\band\b|\bwith\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const matchedItems = [];
  const usedNames = new Set();

  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    const portion = extractPortionMultiplier(lower);

    for (const food of LOCAL_FOOD_DB) {
      const hit = food.keys.some((k) => {
        const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return re.test(lower);
      });
      if (hit && !usedNames.has(food.name)) {
        usedNames.add(food.name);
        const factor = portion.explicitGrams ? portion.explicitGrams / food.grams : portion.mult;
        const grams = Math.round(food.grams * factor);
        const protein = Math.round(food.p * factor);
        const carbs = Math.round(food.c * factor);
        const fat = Math.round(food.f * factor);
        const kcal = Math.round(protein * 4 + carbs * 4 + fat * 9);
        matchedItems.push({
          name: food.name,
          estimatedGrams: grams,
          carbs,
          protein,
          fat,
          kcal,
          micros: {
            fiber: Number((food.fiber * factor).toFixed(1)),
            iron: Number((food.iron * factor).toFixed(1)),
            calcium: Math.round(food.calcium * factor),
            vitD: Number((food.vitD * factor).toFixed(1)),
            magnesium: Math.round(food.magnesium * factor),
            sodium: Math.round(food.sodium * factor),
          },
        });
      }
    }
  }

  const mentionsOil = usedNames.has('Cooking Oil / Dressing / Sauce');
  const isCafeteria = /cafeteria|canteen|work|restaurant|takeout|buffet|hot bar|bowl|plate/i.test(
    `${cleanText} ${contextHint}`
  );
  if (matchedItems.length > 0 && !mentionsOil && isCafeteria) {
    matchedItems.push({
      name: 'Estimated Cooking Oil / Cafeteria Prep',
      estimatedGrams: 12,
      carbs: 1,
      protein: 0,
      fat: 10,
      kcal: 94,
      micros: { fiber: 0, iron: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 220 },
    });
  }

  if (matchedItems.length === 0) {
    matchedItems.push({
      name: hasImage ? 'Work Plate Estimate (Add description or AI key for vision detail)' : 'Mixed Work Meal (General Estimate)',
      estimatedGrams: 420,
      carbs: 62,
      protein: 32,
      fat: 18,
      kcal: 538,
      micros: { fiber: 6, iron: 3.2, calcium: 110, vitD: 1.0, magnesium: 65, sodium: 780 },
    });
  }

  const totals = matchedItems.reduce(
    (acc, item) => ({
      carbs: acc.carbs + item.carbs,
      protein: acc.protein + item.protein,
      fat: acc.fat + item.fat,
      kcal: acc.kcal + item.kcal,
      micros: {
        fiber: Number((acc.micros.fiber + (item.micros?.fiber || 0)).toFixed(1)),
        iron: Number((acc.micros.iron + (item.micros?.iron || 0)).toFixed(1)),
        calcium: Math.round(acc.micros.calcium + (item.micros?.calcium || 0)),
        vitD: Number((acc.micros.vitD + (item.micros?.vitD || 0)).toFixed(1)),
        magnesium: Math.round(acc.micros.magnesium + (item.micros?.magnesium || 0)),
        sodium: Math.round(acc.micros.sodium + (item.micros?.sodium || 0)),
      },
    }),
    { carbs: 0, protein: 0, fat: 0, kcal: 0, micros: { fiber: 0, iron: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 0 } }
  );

  const uncertaintyPct = matchedItems.length >= 2 && cleanText.length > 15 ? 18 : 25;

  return {
    title: cleanText ? cleanText.slice(0, 56) + (cleanText.length > 56 ? '…' : '') : 'Estimated Work Meal',
    items: matchedItems,
    ...totals,
    uncertaintyPct,
    engine: hasImage ? 'on-device-usda (add Gemini/OpenAI key in Sync for full photo Vision AI)' : 'on-device-usda-estimator',
    notes:
      isCafeteria && !mentionsOil
        ? 'Added a realistic ~10g fat margin for cafeteria cooking oils & sauces so your evening home meal compensates accurately.'
        : 'Estimated on-device using USDA/NCCDB portion references. Fine-tune the portion slider if your plate looked bigger or smaller.',
  };
}
