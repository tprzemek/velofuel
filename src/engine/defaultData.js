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
  grossEfficiencyPct: 22.0, // Tim Podlogar: 18-24% range (23.9% => 1 kJ = 1 kcal; ~22% typical trained amateur)
  preRideLeadHours: 2, // Hours between pre-ride meal and ride start (1h -> ~1g/kg, 2h -> ~2g/kg, 3h -> ~3g/kg)
  activityLevel: 'desk', // 'desk' | 'light' | 'active'
  goalMode: 'cut', // 'maintain' | 'cut' | 'carb_load'
  targetLossKgPerWeek: 0.35, // sustainable fat loss while preserving muscle & watts
  tdeeAdjustmentKcal: 0, // adaptive TDEE calibration offset
  proteinGPerKgCut: 2.0,
  proteinGPerKgMaintain: 1.75,
  defaultWeightKg: 74.2,
  defaultBodyFatPct: 14.8,
};

// Modular Home Staple Meals — "Keep your current menu, just scale the carb & protein levers"
export const DEFAULT_STAPLES = [
  {
    id: 'staple-oats-whey',
    name: 'Oats, Whey & Berries Bowl',
    mealTypes: ['breakfast', 'snack'],
    prepNote: 'Your regular morning bowl. Oats scale up on interval days and trim back on rest days.',
    carbLever: {
      name: 'Rolled Oats (dry)',
      unit: 'g',
      minGrams: 35,
      maxGrams: 135,
      defaultGrams: 75,
      per100g: { carbs: 66.3, protein: 16.9, fat: 6.9, fiber: 10.6, iron: 4.7, calcium: 54, vitD: 0, magnesium: 177, sodium: 2 },
    },
    proteinAnchor: {
      name: 'Whey Isolate / Greek Yogurt',
      unit: 'g',
      minGrams: 25,
      maxGrams: 55,
      defaultGrams: 35,
      per100g: { carbs: 4.0, protein: 82.0, fat: 1.5, fiber: 0, iron: 0.5, calcium: 420, vitD: 0, magnesium: 55, sodium: 180 },
    },
    baseFixed: {
      label: 'Blueberries (80g), Banana (½), Cinnamon & Chia (10g)',
      carbs: 24,
      protein: 3,
      fat: 3.5,
      micros: { fiber: 6.2, iron: 1.1, calcium: 72, vitD: 0, magnesium: 52, sodium: 4 },
    },
  },
  {
    id: 'staple-eggs-sourdough',
    name: 'Eggs, Sourdough Toast & Avocado',
    mealTypes: ['breakfast', 'lunch'],
    prepNote: 'Ideal for Rest or Easy Z2 days (higher fat/satiety) — add extra sourdough on moderate days.',
    carbLever: {
      name: 'Sourdough Bread',
      unit: 'g',
      minGrams: 45,
      maxGrams: 160,
      defaultGrams: 90,
      per100g: { carbs: 51.0, protein: 9.2, fat: 1.2, fiber: 2.8, iron: 3.2, calcium: 52, vitD: 0, magnesium: 28, sodium: 520 },
    },
    proteinAnchor: {
      name: 'Whole Eggs + Egg Whites',
      unit: 'g',
      minGrams: 120,
      maxGrams: 280,
      defaultGrams: 190,
      per100g: { carbs: 0.8, protein: 12.2, fat: 6.2, fiber: 0, iron: 1.5, calcium: 42, vitD: 1.8, magnesium: 12, sodium: 145 },
    },
    baseFixed: {
      label: 'Avocado (45g), Spinach (50g) & Cherry Tomatoes',
      carbs: 7,
      protein: 2.5,
      fat: 7.0,
      micros: { fiber: 4.8, iron: 1.8, calcium: 58, vitD: 0, magnesium: 54, sodium: 45 },
    },
  },
  {
    id: 'staple-chicken-rice',
    name: 'Chicken, Jasmine Rice & Greens',
    mealTypes: ['lunch', 'dinner'],
    prepNote: 'Classic WorldTour recovery plate. Jasmine rice scales cleanly from 120g (rest) to 380g (pre-load).',
    carbLever: {
      name: 'Cooked Jasmine Rice',
      unit: 'g',
      minGrams: 110,
      maxGrams: 420,
      defaultGrams: 230,
      per100g: { carbs: 28.2, protein: 2.7, fat: 0.3, fiber: 0.4, iron: 0.8, calcium: 10, vitD: 0, magnesium: 12, sodium: 2 },
    },
    proteinAnchor: {
      name: 'Chicken Breast (cooked)',
      unit: 'g',
      minGrams: 110,
      maxGrams: 230,
      defaultGrams: 160,
      per100g: { carbs: 0, protein: 31.0, fat: 3.6, fiber: 0, iron: 1.0, calcium: 15, vitD: 0.1, magnesium: 29, sodium: 74 },
    },
    baseFixed: {
      label: 'Broccoli & Peppers (150g), Olive Oil (8g) & Soy/Herbs',
      carbs: 10,
      protein: 4,
      fat: 8.5,
      micros: { fiber: 4.4, iron: 1.4, calcium: 68, vitD: 0, magnesium: 36, sodium: 380 },
    },
  },
  {
    id: 'staple-salmon-potatoes',
    name: 'Baked Salmon, Baby Potatoes & Veg',
    mealTypes: ['dinner'],
    prepNote: 'Anti-inflammatory omega-3 + Vitamin D recovery dinner. Potatoes scale smoothly for next-day carb load.',
    carbLever: {
      name: 'Roasted Baby Potatoes',
      unit: 'g',
      minGrams: 140,
      maxGrams: 480,
      defaultGrams: 280,
      per100g: { carbs: 20.1, protein: 2.2, fat: 0.1, fiber: 2.2, iron: 0.8, calcium: 12, vitD: 0, magnesium: 23, sodium: 6 },
    },
    proteinAnchor: {
      name: 'Atlantic Salmon Fillet',
      unit: 'g',
      minGrams: 120,
      maxGrams: 220,
      defaultGrams: 160,
      per100g: { carbs: 0, protein: 22.1, fat: 12.4, fiber: 0, iron: 0.8, calcium: 12, vitD: 11.2, magnesium: 29, sodium: 59 },
    },
    baseFixed: {
      label: 'Asparagus & Green Beans (140g) + Lemon Olive Oil (5g)',
      carbs: 8,
      protein: 3,
      fat: 5.2,
      micros: { fiber: 3.6, iron: 2.2, calcium: 42, vitD: 0, magnesium: 26, sodium: 180 },
    },
  },
  {
    id: 'staple-pasta-turkey',
    name: 'High-Carb Pasta & Lean Turkey Bolognese',
    mealTypes: ['dinner', 'lunch'],
    prepNote: 'Go-to dinner the night before Threshold/VO2max intervals or long weekend rides.',
    carbLever: {
      name: 'Dry Pasta (weighed dry)',
      unit: 'g',
      minGrams: 55,
      maxGrams: 165,
      defaultGrams: 105,
      per100g: { carbs: 74.7, protein: 13.0, fat: 1.5, fiber: 3.2, iron: 3.3, calcium: 21, vitD: 0, magnesium: 53, sodium: 6 },
    },
    proteinAnchor: {
      name: 'Lean Ground Turkey (cooked)',
      unit: 'g',
      minGrams: 100,
      maxGrams: 210,
      defaultGrams: 140,
      per100g: { carbs: 0, protein: 27.4, fat: 6.5, fiber: 0, iron: 1.9, calcium: 24, vitD: 0.3, magnesium: 28, sodium: 92 },
    },
    baseFixed: {
      label: 'Crushed Tomato Sauce (150g), Herbs & Parmesan (12g)',
      carbs: 11,
      protein: 5.5,
      fat: 4.5,
      micros: { fiber: 2.8, iron: 1.4, calcium: 165, vitD: 0.1, magnesium: 28, sodium: 420 },
    },
  },
  {
    id: 'staple-recovery-shake',
    name: 'Post-Ride Greek Yogurt, Banana & Honey',
    mealTypes: ['snack', 'breakfast'],
    prepNote: 'Fast 3:1 carb-to-protein glycogen reload within 45 min after hard sessions.',
    carbLever: {
      name: 'Banana + Honey / Granola Mix',
      unit: 'g',
      minGrams: 60,
      maxGrams: 220,
      defaultGrams: 135,
      per100g: { carbs: 36.0, protein: 1.8, fat: 1.0, fiber: 2.8, iron: 0.5, calcium: 12, vitD: 0, magnesium: 34, sodium: 5 },
    },
    proteinAnchor: {
      name: '0% Greek Yogurt / Skyr',
      unit: 'g',
      minGrams: 150,
      maxGrams: 320,
      defaultGrams: 230,
      per100g: { carbs: 3.8, protein: 10.3, fat: 0.4, fiber: 0, iron: 0.1, calcium: 115, vitD: 0.4, magnesium: 11, sodium: 36 },
    },
    baseFixed: {
      label: 'Pinch of Sea Salt & Berries (50g)',
      carbs: 6,
      protein: 0.5,
      fat: 0.2,
      micros: { fiber: 1.4, iron: 0.2, calcium: 12, vitD: 0, magnesium: 8, sodium: 260 },
    },
  },
];

// Realistic 7-day cycling week centered around today
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

// 14 days of realistic Withings morning scale readings (showing steady fat loss + normal glycogen water noise)
export function createDefaultBiometrics() {
  const series = [
    { offset: -13, w: 75.1, bf: 15.4, rhr: 48, hrv: 72 },
    { offset: -12, w: 74.9, bf: 15.3, rhr: 47, hrv: 75 },
    { offset: -11, w: 75.3, bf: 15.3, rhr: 49, hrv: 68 }, // post high-carb water bump
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
  const today = getIsoDate(0);
  return {
    [today]: [
      {
        id: 'log-sample-bfast',
        slot: 'breakfast',
        type: 'staple',
        stapleId: 'staple-oats-whey',
        title: 'Oats, Whey & Berries Bowl',
        detail: '95g Rolled Oats · 38g Whey Isolate + Berries & Banana',
        carbs: 89,
        protein: 50,
        fat: 11,
        kcal: 655,
        uncertaintyPct: 0,
        micros: { fiber: 16.3, iron: 5.8, calcium: 283, vitD: 0, magnesium: 241, sodium: 74 },
        loggedAt: '07:35',
      },
    ],
  };
}
