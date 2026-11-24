import { DEFAULT_UNITS } from './units';

export function getIsoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DEFAULT_PROFILE = {
  name: 'Rider',
  sex: 'male',
  age: 34,
  heightCm: 179,
  ftp: 295,
  grossEfficiencyPct: 22.0,
  preRideLeadHours: 2,
  activityLevel: 'desk', // 'desk' | 'light' | 'active'
  goalMode: 'cut', // 'maintain' | 'cut' | 'carb_load'
  targetLossKgPerWeek: 0.35,
  tdeeAdjustmentKcal: 0,
  proteinGPerKgCut: 2.0,
  proteinGPerKgMaintain: 1.75,
  defaultWeightKg: 74.2,
  defaultBodyFatPct: 14.8,
  units: DEFAULT_UNITS,
  defaultBottleMl: 650,
  electrolyteTabMg: 500,
  defaultSweatRate: 'medium', // 'light' | 'medium' | 'heavy'
  defaultMealTemplate: 'standard_4', // 'standard_4' | 'three_meals' | 'five_meals'
  defaultWorkoutTiming: 'evening', // 'morning' | 'midday' | 'evening'
};

export const ONBOARDING_SUPPLEMENTS = [
  {
    id: 'supp-iron-vitc',
    name: 'Iron + Vitamin C',
    inDailyStack: true,
    note: 'Take away from coffee/tea — Vitamin C boosts iron absorption.',
    micros: { iron: 25, vitC: 500, vitD: 0, calcium: 0, magnesium: 0, sodium: 0 },
  },
  {
    id: 'supp-multi',
    name: 'Daily Multivitamin',
    inDailyStack: true,
    note: 'Covers baseline Vitamin D, B-vitamins & trace minerals.',
    micros: { iron: 8, vitC: 90, vitD: 25, calcium: 200, magnesium: 100, sodium: 0 },
  },
  {
    id: 'supp-vitd3',
    name: 'Vitamin D3 (2000 IU)',
    inDailyStack: true,
    note: 'Supports bone health, immunity & recovery — especially in winter.',
    micros: { iron: 0, vitC: 0, vitD: 50, calcium: 0, magnesium: 0, sodium: 0 },
  },
  {
    id: 'supp-mag',
    name: 'Magnesium Glycinate',
    inDailyStack: true,
    note: 'Take in the evening to support sleep quality & muscle relaxation.',
    micros: { iron: 0, vitC: 0, vitD: 0, calcium: 0, magnesium: 200, sodium: 0 },
  },
];

export const DEFAULT_SUPPLEMENTS = [
  ONBOARDING_SUPPLEMENTS[0],
  ONBOARDING_SUPPLEMENTS[1],
];

// Flexible Ingredient-List Home Staples — add, edit, or remove ANY ingredient freely!
// role: 'carb' (auto-scales with ride demand), 'protein' (auto-scales to hit protein), or 'fixed' (stays at set grams)
export const DEFAULT_STAPLES = [
  {
    id: 'staple-oats-berries',
    name: 'Oats & Berries',
    mealTypes: ['breakfast'],
    dailySlot: 'breakfast',
    prepNote: 'Simple everyday breakfast. Oats automatically scale up on hard ride days and trim back on rest days.',
    ingredients: [
      {
        id: 'ing-oats',
        name: 'Rolled Oats (dry)',
        grams: 75,
        minGrams: 35,
        maxGrams: 140,
        role: 'carb',
        per100g: { carbs: 66.3, protein: 16.9, fat: 6.9, fiber: 10.6, iron: 4.7, calcium: 54, vitD: 0, vitC: 0, magnesium: 177, sodium: 2 },
      },
      {
        id: 'ing-berries',
        name: 'Blueberries (fresh / frozen)',
        grams: 100,
        minGrams: 50,
        maxGrams: 200,
        role: 'fixed',
        per100g: { carbs: 14.5, protein: 0.7, fat: 0.3, fiber: 2.4, iron: 0.3, calcium: 6, vitD: 0, vitC: 9.7, magnesium: 6, sodium: 1 },
      },
      {
        id: 'ing-milk',
        name: 'Milk (2% / semi-skimmed)',
        grams: 200,
        minGrams: 100,
        maxGrams: 350,
        role: 'fixed',
        per100g: { carbs: 4.8, protein: 3.3, fat: 2.0, fiber: 0, iron: 0, calcium: 120, vitD: 1.2, vitC: 0, magnesium: 11, sodium: 44 },
      },
    ],
  },
  {
    id: 'staple-eggs-sourdough',
    name: 'Eggs, Sourdough & Avocado',
    mealTypes: ['breakfast', 'lunch'],
    prepNote: 'Great for Rest or Easy Z2 days — sourdough scales up when you need extra carbs.',
    ingredients: [
      {
        id: 'ing-sourdough',
        name: 'Sourdough Bread',
        grams: 90,
        minGrams: 45,
        maxGrams: 160,
        role: 'carb',
        per100g: { carbs: 51.0, protein: 9.2, fat: 1.2, fiber: 2.8, iron: 3.2, calcium: 52, vitD: 0, magnesium: 28, sodium: 520 },
      },
      {
        id: 'ing-eggs',
        name: 'Whole Eggs',
        grams: 150,
        minGrams: 100,
        maxGrams: 250,
        role: 'protein',
        per100g: { carbs: 0.7, protein: 12.6, fat: 9.5, fiber: 0, iron: 1.8, calcium: 56, vitD: 2.0, magnesium: 12, sodium: 142 },
      },
      {
        id: 'ing-avocado',
        name: 'Avocado',
        grams: 50,
        minGrams: 25,
        maxGrams: 100,
        role: 'fixed',
        per100g: { carbs: 8.5, protein: 2.0, fat: 14.7, fiber: 6.7, iron: 0.6, calcium: 12, vitD: 0, magnesium: 29, sodium: 7 },
      },
    ],
  },
  {
    id: 'staple-chicken-rice',
    name: 'Chicken, Jasmine Rice & Broccoli',
    mealTypes: ['lunch', 'dinner'],
    prepNote: 'Classic cycling recovery dinner — rice scales smoothly from 120g on rest days to 400g on hard days.',
    ingredients: [
      {
        id: 'ing-rice',
        name: 'White / Jasmine Rice (cooked)',
        grams: 230,
        minGrams: 110,
        maxGrams: 420,
        role: 'carb',
        per100g: { carbs: 28.2, protein: 2.7, fat: 0.3, fiber: 0.4, iron: 0.8, calcium: 10, vitD: 0, magnesium: 12, sodium: 2 },
      },
      {
        id: 'ing-chicken',
        name: 'Chicken Breast (cooked)',
        grams: 160,
        minGrams: 100,
        maxGrams: 230,
        role: 'protein',
        per100g: { carbs: 0, protein: 31.0, fat: 3.6, fiber: 0, iron: 1.0, calcium: 15, vitD: 0.1, magnesium: 29, sodium: 74 },
      },
      {
        id: 'ing-broccoli',
        name: 'Broccoli',
        grams: 140,
        minGrams: 60,
        maxGrams: 250,
        role: 'fixed',
        per100g: { carbs: 6.6, protein: 2.8, fat: 0.4, fiber: 2.6, iron: 0.7, calcium: 47, vitD: 0, magnesium: 21, sodium: 33 },
      },
      {
        id: 'ing-oil',
        name: 'Extra Virgin Olive Oil',
        grams: 8,
        minGrams: 0,
        maxGrams: 25,
        role: 'fixed',
        per100g: { carbs: 0, protein: 0, fat: 100.0, fiber: 0, iron: 0.6, calcium: 1, vitD: 0, magnesium: 0, sodium: 2 },
      },
    ],
  },
  {
    id: 'staple-salmon-potatoes',
    name: 'Baked Salmon & Baby Potatoes',
    mealTypes: ['dinner'],
    prepNote: 'Omega-3 + Vitamin D recovery dinner. Potatoes scale up when tomorrow is a hard ride.',
    ingredients: [
      {
        id: 'ing-potatoes',
        name: 'Potatoes (roasted)',
        grams: 280,
        minGrams: 140,
        maxGrams: 480,
        role: 'carb',
        per100g: { carbs: 20.1, protein: 2.2, fat: 0.1, fiber: 2.2, iron: 0.8, calcium: 12, vitD: 0, magnesium: 23, sodium: 6 },
      },
      {
        id: 'ing-salmon',
        name: 'Salmon Fillet (cooked)',
        grams: 160,
        minGrams: 110,
        maxGrams: 220,
        role: 'protein',
        per100g: { carbs: 0, protein: 22.1, fat: 12.4, fiber: 0, iron: 0.8, calcium: 12, vitD: 11.2, magnesium: 29, sodium: 59 },
      },
      {
        id: 'ing-asparagus',
        name: 'Asparagus',
        grams: 130,
        minGrams: 60,
        maxGrams: 240,
        role: 'fixed',
        per100g: { carbs: 3.9, protein: 2.2, fat: 0.1, fiber: 2.1, iron: 2.1, calcium: 24, vitD: 0, magnesium: 14, sodium: 2 },
      },
    ],
  },
  {
    id: 'staple-pasta-turkey',
    name: 'Pasta & Lean Turkey Bolognese',
    mealTypes: ['dinner', 'lunch'],
    prepNote: 'Easy night-before-intervals meal.',
    ingredients: [
      {
        id: 'ing-pasta',
        name: 'Pasta (dry)',
        grams: 105,
        minGrams: 55,
        maxGrams: 165,
        role: 'carb',
        per100g: { carbs: 74.7, protein: 13.0, fat: 1.5, fiber: 3.2, iron: 3.3, calcium: 21, vitD: 0, magnesium: 53, sodium: 6 },
      },
      {
        id: 'ing-turkey',
        name: 'Lean Ground Turkey (cooked)',
        grams: 140,
        minGrams: 100,
        maxGrams: 210,
        role: 'protein',
        per100g: { carbs: 0, protein: 27.4, fat: 6.5, fiber: 0, iron: 1.9, calcium: 24, vitD: 0.3, magnesium: 28, sodium: 92 },
      },
      {
        id: 'ing-sauce',
        name: 'Tomato Pasta Sauce',
        grams: 140,
        minGrams: 80,
        maxGrams: 250,
        role: 'fixed',
        per100g: { carbs: 7.2, protein: 1.6, fat: 1.5, fiber: 1.8, iron: 0.8, calcium: 18, vitD: 0, magnesium: 16, sodium: 320 },
      },
    ],
  },
  {
    id: 'staple-yogurt-banana',
    name: 'Greek Yogurt, Banana & Honey',
    mealTypes: ['snack', 'breakfast'],
    prepNote: 'Fast recovery snack after a ride.',
    ingredients: [
      {
        id: 'ing-gy',
        name: 'Greek Yogurt (0% fat)',
        grams: 220,
        minGrams: 140,
        maxGrams: 340,
        role: 'protein',
        per100g: { carbs: 3.6, protein: 10.2, fat: 0.4, fiber: 0, iron: 0.1, calcium: 110, vitD: 0.4, magnesium: 11, sodium: 36 },
      },
      {
        id: 'ing-banana',
        name: 'Banana',
        grams: 120,
        minGrams: 60,
        maxGrams: 220,
        role: 'carb',
        per100g: { carbs: 22.8, protein: 1.1, fat: 0.3, fiber: 2.6, iron: 0.3, calcium: 5, vitD: 0, magnesium: 27, sodium: 1 },
      },
      {
        id: 'ing-honey',
        name: 'Honey',
        grams: 20,
        minGrams: 5,
        maxGrams: 50,
        role: 'carb',
        per100g: { carbs: 82.4, protein: 0.3, fat: 0, fiber: 0.2, iron: 0.4, calcium: 6, vitD: 0, magnesium: 2, sodium: 4 },
      },
    ],
  },
];

// Seamlessly migrate any previously saved legacy staples into the flexible ingredients[] format
export function migrateStaple(staple) {
  if (!staple) return null;
  if (Array.isArray(staple.ingredients) && staple.ingredients.length > 0) {
    return staple;
  }
  const ingredients = [];
  if (staple.carbLever) {
    ingredients.push({
      id: `${staple.id}-carb`,
      name: staple.carbLever.name,
      grams: staple.carbLever.defaultGrams || 80,
      minGrams: staple.carbLever.minGrams || 30,
      maxGrams: staple.carbLever.maxGrams || 300,
      role: 'carb',
      per100g: staple.carbLever.per100g || { carbs: 50, protein: 5, fat: 1 },
    });
  }
  if (staple.proteinAnchor) {
    ingredients.push({
      id: `${staple.id}-prot`,
      name: staple.proteinAnchor.name,
      grams: staple.proteinAnchor.defaultGrams || 140,
      minGrams: staple.proteinAnchor.minGrams || 50,
      maxGrams: staple.proteinAnchor.maxGrams || 250,
      role: 'protein',
      per100g: staple.proteinAnchor.per100g || { carbs: 0, protein: 25, fat: 4 },
    });
  }
  if (staple.baseFixed) {
    ingredients.push({
      id: `${staple.id}-base`,
      name: staple.baseFixed.label || 'Toppings & Veg',
      grams: 100,
      minGrams: 50,
      maxGrams: 200,
      role: 'fixed',
      per100g: {
        carbs: staple.baseFixed.carbs || 0,
        protein: staple.baseFixed.protein || 0,
        fat: staple.baseFixed.fat || 0,
        ...(staple.baseFixed.micros || {}),
      },
    });
  }
  return {
    id: staple.id,
    name: staple.name,
    mealTypes: staple.mealTypes || ['dinner'],
    prepNote: staple.prepNote || '',
    ingredients,
  };
}

export function createDefaultSessions() {
  return [
    {
      id: 'sess-m2',
      date: getIsoDate(-2),
      title: 'Zone 2 Aerobic Base',
      sport: 'Ride',
      status: 'completed',
      durationMin: 95,
      intensity: 'endurance',
      plannedKj: 1020,
      actualKj: 1065,
      tss: 74,
      timing: 'morning',
      source: 'manual',
    },
    {
      id: 'sess-m1',
      date: getIsoDate(-1),
      title: 'Rest & Mobility Day',
      sport: 'Rest',
      status: 'completed',
      durationMin: 0,
      intensity: 'rest',
      plannedKj: 0,
      actualKj: 0,
      tss: 0,
      timing: 'morning',
      source: 'manual',
    },
    {
      id: 'sess-0',
      date: getIsoDate(0),
      title: 'Threshold 3×15m @ 98% FTP',
      sport: 'Ride',
      status: 'planned',
      durationMin: 105,
      intensity: 'threshold',
      plannedKj: 1480,
      actualKj: 0,
      tss: 112,
      timing: 'evening',
      source: 'manual',
    },
    {
      id: 'sess-p1',
      date: getIsoDate(1),
      title: 'Easy Recovery Spin',
      sport: 'Ride',
      status: 'planned',
      durationMin: 55,
      intensity: 'recovery',
      plannedKj: 460,
      actualKj: 0,
      tss: 32,
      timing: 'morning',
      source: 'manual',
    },
    {
      id: 'sess-p2',
      date: getIsoDate(2),
      title: 'VO2max 5×4m Intervals',
      sport: 'Ride',
      status: 'planned',
      durationMin: 90,
      intensity: 'vo2max',
      plannedKj: 1320,
      actualKj: 0,
      tss: 104,
      timing: 'evening',
      source: 'manual',
    },
    {
      id: 'sess-p3',
      date: getIsoDate(3),
      title: 'Full Rest Day',
      sport: 'Rest',
      status: 'planned',
      durationMin: 0,
      intensity: 'rest',
      plannedKj: 0,
      actualKj: 0,
      tss: 0,
      timing: 'morning',
      source: 'manual',
    },
    {
      id: 'sess-p4',
      date: getIsoDate(4),
      title: 'Long Group Endurance + Climbs',
      sport: 'Ride',
      status: 'planned',
      durationMin: 215,
      intensity: 'endurance',
      plannedKj: 2480,
      actualKj: 0,
      tss: 186,
      timing: 'morning',
      source: 'manual',
    },
  ];
}

export function createDefaultBiometrics() {
  const series = [
    { offset: -13, w: 75.1, bf: 15.4, rhr: 48, hrv: 72 },
    { offset: -12, w: 74.9, bf: 15.3, rhr: 47, hrv: 75 },
    { offset: -11, w: 75.3, bf: 15.3, rhr: 49, hrv: 68 },
    { offset: -10, w: 74.8, bf: 15.2, rhr: 47, hrv: 76 },
    { offset: -9, w: 74.7, bf: 15.2, rhr: 46, hrv: 79 },
    { offset: -8, w: 74.9, bf: 15.1, rhr: 48, hrv: 74 },
    { offset: -7, w: 74.6, bf: 15.1, rhr: 47, hrv: 77 },
    { offset: -6, w: 74.5, bf: 15.0, rhr: 46, hrv: 80 },
    { offset: -5, w: 74.8, bf: 15.0, rhr: 49, hrv: 70 },
    { offset: -4, w: 74.4, bf: 14.9, rhr: 47, hrv: 78 },
    { offset: -3, w: 74.3, bf: 14.9, rhr: 46, hrv: 81 },
    { offset: -2, w: 74.5, bf: 14.8, rhr: 47, hrv: 76 },
    { offset: -1, w: 74.1, bf: 14.8, rhr: 45, hrv: 83 },
    { offset: 0, w: 74.2, bf: 14.7, rhr: 46, hrv: 81 },
  ];
  return series.map((item) => ({
    date: getIsoDate(item.offset),
    weightKg: item.w,
    bodyFatPct: item.bf,
    restingHr: item.rhr,
    hrv: item.hrv,
    sleepHrs: 7.6,
    source: 'withings-sample',
  }));
}

export function createDefaultLogs() {
  return {};
}

export function isSampleSession(session) {
  if (!session || !session.id) return false;
  return /^sess-(m\d+|p\d+|0)$/.test(String(session.id));
}

export function isSampleBiometric(entry) {
  if (!entry) return false;
  return entry.source === 'withings-sample';
}

export function stripDemoData(state) {
  if (!state || typeof state !== 'object') return state;
  return {
    ...state,
    sessions: Array.isArray(state.sessions)
      ? state.sessions.filter((s) => !isSampleSession(s))
      : [],
    biometrics: Array.isArray(state.biometrics)
      ? state.biometrics.filter((b) => !isSampleBiometric(b))
      : [],
  };
}
