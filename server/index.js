import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(express.json({ limit: '15mb' }));

// CORS for dev when Vite runs on 5173
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasServerGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasServerOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Intervals.icu REST API Proxy (Wellness/Withings + Completed + Planned Rides)
// ---------------------------------------------------------------------------
function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function inferIntensityFromIntervals(item) {
  const ifVal = Number(item.icu_intensity || item.intensity || 0) / (item.icu_intensity > 2 ? 100 : 1);
  const name = `${item.name || ''} ${item.description || ''}`.toLowerCase();
  const durationMin = Math.round((item.moving_time || item.elapsed_time || item.moving_time_secs || 0) / 60);

  if (name.includes('race') || name.includes('crit') || name.includes('gran fondo')) return 'race';
  if (name.includes('vo2') || name.includes('anaerobic') || ifVal >= 0.94) return 'vo2max';
  if (name.includes('threshold') || name.includes('ftp') || ifVal >= 0.89) return 'threshold';
  if (name.includes('sweet spot') || name.includes('sweetspot') || name.includes('sst') || ifVal >= 0.83) return 'sweetspot';
  if (name.includes('tempo') || ifVal >= 0.76) return 'tempo';
  if (name.includes('recovery') || name.includes('easy') || (ifVal > 0 && ifVal < 0.58)) return 'recovery';
  if (durationMin >= 150) return 'endurance';
  if (item.icu_training_load && durationMin > 0) {
    const tssPerHour = (item.icu_training_load / durationMin) * 60;
    if (tssPerHour >= 85) return 'threshold';
    if (tssPerHour >= 70) return 'sweetspot';
    if (tssPerHour >= 58) return 'tempo';
    if (tssPerHour < 40) return 'recovery';
  }
  return durationMin > 0 ? 'endurance' : 'rest';
}

app.post('/api/intervals/sync', async (req, res) => {
  try {
    const { athleteId = '0', apiKey, daysBack = 28, daysForward = 7 } = req.body || {};
    if (!apiKey || !String(apiKey).trim()) {
      return res.status(400).json({ error: 'Intervals.icu API Key is required.' });
    }

    const id = encodeURIComponent(String(athleteId || '0').trim() || '0');
    const authHeader = 'Basic ' + Buffer.from(`API_KEY:${String(apiKey).trim()}`).toString('base64');
    const headers = { Authorization: authHeader, Accept: 'application/json' };

    const today = new Date();
    const oldestWellness = formatDate(addDays(today, -Math.min(Math.max(daysBack, 7), 90)));
    const newestToday = formatDate(today);
    const oldestActs = formatDate(addDays(today, -14));
    const newestEvents = formatDate(addDays(today, Math.min(Math.max(daysForward, 3), 21)));

    const base = `https://intervals.icu/api/v1/athlete/${id}`;

    const [wellnessRes, activitiesRes, eventsRes] = await Promise.all([
      fetch(`${base}/wellness?oldest=${oldestWellness}&newest=${newestToday}`, { headers }),
      fetch(`${base}/activities?oldest=${oldestActs}&newest=${newestToday}`, { headers }),
      fetch(`${base}/events?oldest=${oldestActs}&newest=${newestEvents}&category=WORKOUT`, { headers }),
    ]);

    if (wellnessRes.status === 401 || wellnessRes.status === 403) {
      return res.status(401).json({
        error: 'Intervals.icu rejected the credentials. Verify your Athlete ID (or use "0") and API Key from Settings → Developer Settings.',
      });
    }

    const wellnessRaw = wellnessRes.ok ? await wellnessRes.json() : [];
    const activitiesRaw = activitiesRes.ok ? await activitiesRes.json() : [];
    const eventsRaw = eventsRes.ok ? await eventsRes.json() : [];

    // Normalize Withings / Google Health wellness records
    const biometrics = (Array.isArray(wellnessRaw) ? wellnessRaw : [])
      .filter((w) => w && (w.weight || w.bodyFat || w.restingHR || w.hrv))
      .map((w) => ({
        date: w.id,
        weightKg: typeof w.weight === 'number' ? Number(w.weight.toFixed(2)) : null,
        bodyFatPct: typeof w.bodyFat === 'number' ? Number(w.bodyFat.toFixed(1)) : null,
        restingHr: typeof w.restingHR === 'number' ? Math.round(w.restingHR) : null,
        hrv: typeof w.hrv === 'number' ? Math.round(w.hrv) : null,
        sleepHrs: typeof w.sleepSecs === 'number' ? Number((w.sleepSecs / 3600).toFixed(1)) : null,
        kcalConsumed: typeof w.kcalConsumed === 'number' ? Math.round(w.kcalConsumed) : null,
        source: 'intervals.icu',
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    let stravaRestrictedCount = 0;

    // Normalize completed activities
    const completedSessions = (Array.isArray(activitiesRaw) ? activitiesRaw : [])
      .filter((a) => {
        if (!a) return false;
        if (a.source === 'STRAVA' && !a.moving_time && !a.icu_joules) {
          stravaRestrictedCount += 1;
          return false;
        }
        return true;
      })
      .map((a) => {
        const date = String(a.start_date_local || a.start_date || '').slice(0, 10);
        const durationMin = Math.round((a.moving_time || a.elapsed_time || 0) / 60);
        const actualKj = a.icu_joules
          ? Math.round(a.icu_joules / 1000)
          : a.calories
          ? Math.round(a.calories)
          : 0;
        const startHour = Number(String(a.start_date_local || '09:00').slice(11, 13)) || 9;
        return {
          id: `icu-act-${a.id}`,
          date,
          title: a.name || a.type || 'Completed Ride',
          sport: a.type || 'Ride',
          status: 'completed',
          durationMin,
          intensity: inferIntensityFromIntervals(a),
          actualKj,
          plannedKj: actualKj,
          tss: Math.round(a.icu_training_load || 0),
          timing: startHour < 11 ? 'morning' : startHour < 15 ? 'midday' : 'evening',
          source: 'intervals.icu',
        };
      })
      .filter((s) => s.date);

    // Normalize planned workouts
    const plannedSessions = (Array.isArray(eventsRaw) ? eventsRaw : [])
      .filter((e) => e && e.start_date_local)
      .map((e) => {
        const date = String(e.start_date_local).slice(0, 10);
        const durationMin = Math.round((e.moving_time || e.workout_doc?.duration || 0) / 60);
        const plannedKj = e.joules
          ? Math.round(e.joules / 1000)
          : e.icu_joules
          ? Math.round(e.icu_joules / 1000)
          : 0;
        const startHour = Number(String(e.start_date_local || '17:00').slice(11, 13)) || 17;
        return {
          id: `icu-evt-${e.id}`,
          date,
          title: e.name || 'Planned Workout',
          sport: e.type || 'Ride',
          status: 'planned',
          durationMin: durationMin || 60,
          intensity: inferIntensityFromIntervals(e),
          plannedKj,
          actualKj: 0,
          tss: Math.round(e.icu_training_load || 0),
          timing: startHour < 11 ? 'morning' : startHour < 15 ? 'midday' : 'evening',
          source: 'intervals.icu',
        };
      });

    const hasWeight = biometrics.some((b) => b.weightKg != null);
    const hasBodyFat = biometrics.some((b) => b.bodyFatPct != null);
    const hasHrv = biometrics.some((b) => b.hrv != null);

    res.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      biometrics,
      completedSessions,
      plannedSessions,
      diagnostics: {
        wellnessCount: biometrics.length,
        completedCount: completedSessions.length,
        plannedCount: plannedSessions.length,
        hasWeight,
        hasBodyFat,
        hasHrv,
        stravaRestrictedCount,
      },
    });
  } catch (err) {
    res.status(500).json({ error: `Intervals.icu sync failed: ${err.message}` });
  }
});

// Optional push of daily kcal/carbs back to Intervals.icu wellness
app.post('/api/intervals/wellness-push', async (req, res) => {
  try {
    const { athleteId = '0', apiKey, date, kcalConsumed, carbs, protein, fat } = req.body || {};
    if (!apiKey || !date) {
      return res.status(400).json({ error: 'API key and date are required.' });
    }
    const id = encodeURIComponent(String(athleteId || '0').trim() || '0');
    const authHeader = 'Basic ' + Buffer.from(`API_KEY:${String(apiKey).trim()}`).toString('base64');
    const resp = await fetch(`https://intervals.icu/api/v1/athlete/${id}/wellness/${date}`, {
      method: 'PUT',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kcalConsumed: Math.round(kcalConsumed || 0),
        carbohydrates: Math.round(carbs || 0),
        protein: Math.round(protein || 0),
        fatTotal: Math.round(fat || 0),
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(resp.status).json({ error: txt || 'Failed to update Intervals.icu wellness.' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Work Meal Text / Photo AI Estimator (Gemini / OpenAI + Built-in Local NLP)
// ---------------------------------------------------------------------------
const LOCAL_FOOD_DB = [
  // Proteins
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
  // Carbs & Grains
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
  // Fruit & Veg
  { keys: ['salad', 'greens', 'spinach', 'arugula', 'lettuce', 'mixed greens'], name: 'Mixed Salad Greens', grams: 120, p: 3, c: 7, f: 1, fiber: 3.2, iron: 2.4, calcium: 80, vitD: 0, magnesium: 46, sodium: 60 },
  { keys: ['broccoli', 'veggies', 'vegetables', 'roasted veg', 'carrots', 'peppers', 'zucchini', 'asparagus'], name: 'Roasted / Steamed Vegetables', grams: 150, p: 4, c: 12, f: 4, fiber: 4.8, iron: 1.4, calcium: 65, vitD: 0, magnesium: 38, sodium: 190 },
  { keys: ['banana'], name: 'Banana', grams: 120, p: 1, c: 27, f: 0, fiber: 3.1, iron: 0.3, calcium: 6, vitD: 0, magnesium: 32, sodium: 1 },
  { keys: ['apple', 'orange', 'berries', 'fruit', 'grapes', 'pear'], name: 'Fresh Fruit', grams: 150, p: 1, c: 21, f: 0, fiber: 3.8, iron: 0.3, calcium: 18, vitD: 0, magnesium: 14, sodium: 2 },
  // Fats, Sauces & Treats
  { keys: ['avocado', 'guacamole'], name: 'Avocado', grams: 75, p: 2, c: 6, f: 11, fiber: 5, iron: 0.4, calcium: 9, vitD: 0, magnesium: 22, sodium: 8 },
  { keys: ['olive oil', 'dressing', 'vinaigrette', 'mayo', 'mayonnaise', 'pesto', 'aioli', 'sauce', 'butter', 'cream'], name: 'Cooking Oil / Dressing / Sauce', grams: 20, p: 0, c: 2, f: 14, fiber: 0, iron: 0.1, calcium: 6, vitD: 0, magnesium: 2, sodium: 240 },
  { keys: ['nuts', 'almonds', 'walnuts', 'peanut butter', 'seeds'], name: 'Nuts / Seeds', grams: 30, p: 6, c: 6, f: 15, fiber: 3, iron: 1.1, calcium: 60, vitD: 0, magnesium: 75, sodium: 60 },
  { keys: ['cookie', 'cake', 'brownie', 'pastry', 'croissant', 'muffin', 'dessert'], name: 'Bakery Pastry / Dessert', grams: 85, p: 5, c: 44, f: 15, fiber: 1.5, iron: 1.5, calcium: 40, vitD: 0.2, magnesium: 18, sodium: 280 },
  { keys: ['latte', 'cappuccino', 'flat white', 'milk'], name: 'Milk Coffee / Latte', grams: 240, p: 8, c: 12, f: 6, fiber: 0, iron: 0.1, calcium: 260, vitD: 2.5, magnesium: 24, sodium: 110 },
];

function extractPortionMultiplier(clause) {
  const lower = clause.toLowerCase();
  // Explicit grams e.g. "200g"
  const gramMatch = lower.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (gramMatch) return { explicitGrams: Number(gramMatch[1]), mult: 1 };

  // Explicit cups / slices / pieces
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

function runLocalMealEstimator(text = '', hasImage = false, contextHint = '') {
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

  // Cafeteria / restaurant hidden oil allowance if not explicitly mentioned
  const mentionsOil = usedNames.has('Cooking Oil / Dressing / Sauce');
  const isCafeteriaOrRestaurant = /cafeteria|canteen|work|restaurant|takeout|buffet|hot bar|bowl|plate/i.test(
    `${cleanText} ${contextHint}`
  );
  if (matchedItems.length > 0 && !mentionsOil && isCafeteriaOrRestaurant) {
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

  // Fallback if photo-only or unrecognized phrasing
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
    engine: hasImage ? 'local-nlp (add Gemini/OpenAI key in Sync for full photo Vision AI)' : 'local-usda-estimator',
    notes:
      isCafeteriaOrRestaurant && !mentionsOil
        ? 'Added a realistic ~10g fat margin for cafeteria cooking oils & sauces so your evening home meal compensates accurately.'
        : 'Estimated using USDA/NCCDB standard portion references. Fine-tune sliders or grams if your portion looked bigger/smaller.',
  };
}

async function runGeminiEstimator({ apiKey, text, imageBase64, imageMimeType }) {
  const prompt = `You are a WorldTour pro cycling sports nutritionist estimating an athlete's work/restaurant meal where exact weights are unknown.
Analyze the meal description and/or photo and return ONLY valid JSON matching this schema:
{
  "title": "short meal title (max 45 chars)",
  "items": [
    { "name": "item name", "estimatedGrams": 150, "carbs": 40, "protein": 25, "fat": 8, "kcal": 332 }
  ],
  "carbs": 65,
  "protein": 38,
  "fat": 18,
  "kcal": 574,
  "uncertaintyPct": 18,
  "micros": { "fiber": 6, "iron": 3.0, "calcium": 120, "vitD": 1.2, "magnesium": 60, "sodium": 820 },
  "notes": "1 concise sentence noting hidden oil/sauce assumptions or carb density"
}
Always account realistically for restaurant/cafeteria cooking oil and sauces. Meal description: "${text || 'Analyze the uploaded meal photo.'}"`;

  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: imageMimeType || 'image/jpeg',
        data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
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
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${errText.slice(0, 180)}`);
  }
  const data = await resp.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Gemini returned empty response');
  const parsed = JSON.parse(raw);
  return { ...parsed, engine: 'gemini-2.5-flash' };
}

async function runOpenAiEstimator({ apiKey, text, imageBase64, imageMimeType }) {
  const userContent = [
    {
      type: 'text',
      text: `You are a pro cycling sports nutritionist estimating an athlete's work/restaurant meal. Return ONLY valid JSON with fields: title, items ([{name, estimatedGrams, carbs, protein, fat, kcal}]), carbs, protein, fat, kcal, uncertaintyPct (12-30), micros ({fiber, iron, calcium, vitD, magnesium, sodium}), notes. Include realistic cooking oil/sauce. Meal: "${text || 'Analyze the photo.'}"`,
    },
  ];
  if (imageBase64) {
    const dataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}`;
    userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
  }

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI API ${resp.status}: ${errText.slice(0, 180)}`);
  }
  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('OpenAI returned empty response');
  const parsed = JSON.parse(raw);
  return { ...parsed, engine: 'gpt-4o-mini' };
}

app.post('/api/estimate-meal', async (req, res) => {
  try {
    const { text = '', imageBase64 = '', imageMimeType = 'image/jpeg', contextHint = '', aiProvider = 'auto', aiApiKey = '' } =
      req.body || {};

    const geminiKey = (aiProvider === 'gemini' || aiProvider === 'auto') ? (aiApiKey || process.env.GEMINI_API_KEY || '') : '';
    const openAiKey = (aiProvider === 'openai' || aiProvider === 'auto') ? (aiApiKey || process.env.OPENAI_API_KEY || '') : '';

    if (aiProvider === 'gemini' && geminiKey) {
      const result = await runGeminiEstimator({ apiKey: geminiKey, text, imageBase64, imageMimeType });
      return res.json({ ok: true, estimate: result });
    }
    if (aiProvider === 'openai' && openAiKey) {
      const result = await runOpenAiEstimator({ apiKey: openAiKey, text, imageBase64, imageMimeType });
      return res.json({ ok: true, estimate: result });
    }
    if (aiProvider === 'auto') {
      if (process.env.GEMINI_API_KEY) {
        const result = await runGeminiEstimator({ apiKey: process.env.GEMINI_API_KEY, text, imageBase64, imageMimeType });
        return res.json({ ok: true, estimate: result });
      }
      if (process.env.OPENAI_API_KEY) {
        const result = await runOpenAiEstimator({ apiKey: process.env.OPENAI_API_KEY, text, imageBase64, imageMimeType });
        return res.json({ ok: true, estimate: result });
      }
    }

    const estimate = runLocalMealEstimator(text, Boolean(imageBase64), contextHint);
    res.json({ ok: true, estimate });
  } catch (err) {
    // Graceful fallback to local estimator with error note
    const fallback = runLocalMealEstimator(req.body?.text || '', Boolean(req.body?.imageBase64), req.body?.contextHint || '');
    res.json({
      ok: true,
      warning: `AI provider error (${err.message}) — fell back to built-in USDA estimator.`,
      estimate: fallback,
    });
  }
});

// Serve built PWA in production / preview mode
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VeloFuel server listening on http://localhost:${PORT}`);
});
