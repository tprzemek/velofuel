// Accurate, transparent on-device USDA/restaurant meal estimator
// Uses longest-match-first non-overlapping span consumption (prevents double-counting like "butter chicken" or "chicken thigh")
// and parses per-item quantities (g, oz, lbs, cups, slices, pieces, bowls, tbsp, eggs, small/large).

const FOOD_ENTRIES = [
  // Multi-word composed dishes FIRST (longest match wins so sub-words never double-count)
  { keys: ['chicken burrito bowl', 'burrito bowl'], name: 'Chicken Burrito Bowl', grams: 430, c: 58, p: 42, f: 16, fiber: 11, iron: 4.1, calcium: 190, vitD: 0.3, vitC: 18, magnesium: 92, sodium: 1150 },
  { keys: ['steak burrito bowl', 'beef burrito bowl'], name: 'Steak Burrito Bowl', grams: 430, c: 56, p: 40, f: 19, fiber: 11, iron: 5.2, calcium: 185, vitD: 0.3, vitC: 18, magnesium: 88, sodium: 1180 },
  { keys: ['chicken burrito', 'beef burrito', 'steak burrito', 'burrito'], name: 'Burrito', grams: 380, c: 68, p: 32, f: 22, fiber: 9, iron: 4.4, calcium: 240, vitD: 0.4, vitC: 12, magnesium: 78, sodium: 1260 },
  { keys: ['salmon poke bowl', 'poke bowl', 'tuna poke bowl'], name: 'Poke Bowl (Fish & Rice)', grams: 380, c: 64, p: 30, f: 13, fiber: 4, iron: 2.6, calcium: 65, vitD: 9.5, vitC: 12, magnesium: 82, sodium: 980 },
  { keys: ['chicken caesar salad', 'caesar salad with chicken'], name: 'Chicken Caesar Salad', grams: 320, c: 16, p: 38, f: 22, fiber: 4, iron: 2.8, calcium: 210, vitD: 0.5, vitC: 14, magnesium: 52, sodium: 920 },
  { keys: ['caesar salad'], name: 'Caesar Salad', grams: 220, c: 14, p: 9, f: 18, fiber: 3.5, iron: 1.8, calcium: 180, vitD: 0.3, vitC: 12, magnesium: 32, sodium: 640 },
  { keys: ['greek salad'], name: 'Greek Salad with Feta & Olives', grams: 250, c: 12, p: 9, f: 17, fiber: 4, iron: 1.8, calcium: 210, vitD: 0.2, vitC: 28, magnesium: 34, sodium: 720 },
  { keys: ['cobb salad'], name: 'Cobb Salad', grams: 340, c: 12, p: 34, f: 26, fiber: 5, iron: 3.0, calcium: 160, vitD: 1.5, vitC: 16, magnesium: 48, sodium: 940 },
  { keys: ['tuna salad sandwich'], name: 'Tuna Salad Sandwich', grams: 240, c: 42, p: 28, f: 18, fiber: 3.5, iron: 3.2, calcium: 110, vitD: 2.5, vitC: 4, magnesium: 48, sodium: 860 },
  { keys: ['chicken salad sandwich', 'club sandwich', 'turkey sandwich', 'turkey avocado sandwich', 'ham sandwich', 'blt sandwich'], name: 'Deli Sandwich', grams: 250, c: 46, p: 28, f: 15, fiber: 4, iron: 3.0, calcium: 130, vitD: 0.4, vitC: 8, magnesium: 46, sodium: 980 },
  { keys: ['grilled cheese', 'cheese toastie'], name: 'Grilled Cheese Sandwich', grams: 160, c: 34, p: 16, f: 22, fiber: 2, iron: 2.0, calcium: 340, vitD: 0.5, vitC: 0, magnesium: 28, sodium: 780 },
  { keys: ['butter chicken', 'chicken tikka masala', 'tikka masala'], name: 'Chicken Tikka / Butter Chicken', grams: 260, c: 16, p: 32, f: 20, fiber: 2.5, iron: 2.6, calcium: 90, vitD: 0.3, vitC: 12, magnesium: 48, sodium: 890 },
  { keys: ['chicken curry', 'thai curry', 'green curry', 'red curry', 'massaman curry', 'curry'], name: 'Curry Dish', grams: 280, c: 22, p: 24, f: 18, fiber: 4, iron: 2.8, calcium: 75, vitD: 0.2, vitC: 16, magnesium: 54, sodium: 860 },
  { keys: ['pad thai'], name: 'Pad Thai Noodles', grams: 350, c: 68, p: 22, f: 18, fiber: 3.5, iron: 2.8, calcium: 90, vitD: 0.4, vitC: 10, magnesium: 62, sodium: 1240 },
  { keys: ['fried rice', 'egg fried rice', 'chicken fried rice'], name: 'Fried Rice', grams: 300, c: 62, p: 18, f: 14, fiber: 2.5, iron: 2.2, calcium: 45, vitD: 0.5, vitC: 8, magnesium: 42, sodium: 1020 },
  { keys: ['chicken stir fry', 'beef stir fry', 'stir fry', 'stir-fry'], name: 'Stir-Fry with Sauce', grams: 300, c: 24, p: 32, f: 14, fiber: 4.5, iron: 3.0, calcium: 75, vitD: 0.2, vitC: 42, magnesium: 58, sodium: 980 },
  { keys: ['pasta bolognese', 'spaghetti bolognese', 'bolognese'], name: 'Pasta Bolognese', grams: 360, c: 66, p: 28, f: 14, fiber: 5, iron: 4.2, calcium: 95, vitD: 0.2, vitC: 12, magnesium: 58, sodium: 780 },
  { keys: ['pasta carbonara', 'carbonara'], name: 'Pasta Carbonara', grams: 340, c: 64, p: 24, f: 26, fiber: 3, iron: 2.6, calcium: 210, vitD: 1.0, vitC: 0, magnesium: 45, sodium: 920 },
  { keys: ['mac and cheese', 'mac & cheese'], name: 'Mac & Cheese', grams: 300, c: 54, p: 20, f: 24, fiber: 2.5, iron: 2.0, calcium: 320, vitD: 0.4, vitC: 0, magnesium: 38, sodium: 940 },
  { keys: ['lasagna', 'lasagne'], name: 'Lasagna', grams: 320, c: 42, p: 26, f: 20, fiber: 3.5, iron: 3.2, calcium: 290, vitD: 0.4, vitC: 10, magnesium: 44, sodium: 960 },
  { keys: ['risotto'], name: 'Risotto', grams: 300, c: 58, p: 12, f: 14, fiber: 2, iron: 1.4, calcium: 150, vitD: 0.2, vitC: 4, magnesium: 32, sodium: 760 },
  { keys: ['ramen', 'tonkotsu ramen', 'miso ramen'], name: 'Ramen Bowl', grams: 500, c: 66, p: 28, f: 20, fiber: 4, iron: 3.5, calcium: 80, vitD: 1.0, vitC: 6, magnesium: 52, sodium: 1680 },
  { keys: ['pho', 'beef pho', 'chicken pho'], name: 'Pho Noodle Soup', grams: 520, c: 58, p: 30, f: 8, fiber: 3, iron: 3.4, calcium: 60, vitD: 0.2, vitC: 12, magnesium: 44, sodium: 1450 },
  { keys: ['bibimbap'], name: 'Bibimbap Rice Bowl', grams: 420, c: 68, p: 26, f: 14, fiber: 6, iron: 4.0, calcium: 105, vitD: 1.2, vitC: 22, magnesium: 74, sodium: 1050 },
  { keys: ['fish and chips', 'fish & chips'], name: 'Fish & Chips', grams: 360, c: 64, p: 32, f: 34, fiber: 5, iron: 2.2, calcium: 65, vitD: 3.5, vitC: 18, magnesium: 64, sodium: 980 },
  { keys: ['chicken schnitzel', 'pork schnitzel', 'schnitzel', 'katsu'], name: 'Breaded Schnitzel / Katsu', grams: 200, c: 22, p: 36, f: 22, fiber: 1.2, iron: 2.2, calcium: 40, vitD: 0.3, vitC: 0, magnesium: 38, sodium: 760 },
  { keys: ['cheeseburger', 'hamburger', 'beef burger', 'chicken burger', 'burger'], name: 'Burger', grams: 240, c: 36, p: 29, f: 24, fiber: 2.5, iron: 4.0, calcium: 180, vitD: 0.4, vitC: 4, magnesium: 42, sodium: 960 },
  { keys: ['quesadilla'], name: 'Quesadilla', grams: 230, c: 40, p: 22, f: 24, fiber: 3, iron: 2.6, calcium: 320, vitD: 0.4, vitC: 6, magnesium: 40, sodium: 880 },
  { keys: ['shawarma', 'doner kebab', 'kebab', 'gyro', 'gyros', 'souvlaki'], name: 'Shawarma / Kebab Wrap', grams: 320, c: 46, p: 32, f: 22, fiber: 5, iron: 3.8, calcium: 140, vitD: 0.3, vitC: 16, magnesium: 56, sodium: 1120 },
  { keys: ['falafel wrap', 'falafel'], name: 'Falafel', grams: 160, c: 36, p: 13, f: 16, fiber: 7, iron: 3.2, calcium: 80, vitD: 0, vitC: 6, magnesium: 72, sodium: 580 },
  { keys: ['pierogi', 'dumplings', 'gyoza'], name: 'Dumplings / Pierogi (6 pcs)', grams: 210, c: 44, p: 14, f: 10, fiber: 3, iron: 2.2, calcium: 55, vitD: 0.2, vitC: 4, magnesium: 34, sodium: 680 },
  { keys: ['protein shake', 'whey shake', 'recovery shake'], name: 'Protein Shake', grams: 350, c: 12, p: 28, f: 3, fiber: 1, iron: 0.8, calcium: 320, vitD: 1.0, vitC: 0, magnesium: 48, sodium: 220 },
  { keys: ['smoothie', 'acai bowl'], name: 'Fruit Smoothie / Bowl', grams: 350, c: 56, p: 8, f: 4, fiber: 6, iron: 1.2, calcium: 120, vitD: 0.5, vitC: 48, magnesium: 42, sodium: 85 },
  { keys: ['peanut butter'], name: 'Peanut Butter', grams: 32, c: 6, p: 8, f: 16, fiber: 2, iron: 0.6, calcium: 15, vitD: 0, vitC: 0, magnesium: 52, sodium: 120 },
  { keys: ['sweet potato', 'sweet potatoes'], name: 'Sweet Potato', grams: 200, c: 41, p: 4, f: 1, fiber: 6.5, iron: 1.4, calcium: 72, vitD: 0, vitC: 36, magnesium: 52, sodium: 72 },
  { keys: ['french fries', 'fries', 'chips', 'potato wedges'], name: 'Fries / Wedges', grams: 150, c: 48, p: 5, f: 18, fiber: 4.5, iron: 1.2, calcium: 24, vitD: 0, vitC: 14, magnesium: 44, sodium: 420 },
  { keys: ['mashed potatoes', 'mashed potato', 'mash'], name: 'Mashed Potatoes', grams: 200, c: 34, p: 4, f: 8, fiber: 3, iron: 0.8, calcium: 55, vitD: 0.2, vitC: 14, magnesium: 36, sodium: 460 },
  { keys: ['cottage cheese'], name: 'Cottage Cheese', grams: 180, c: 6, p: 20, f: 4, fiber: 0, iron: 0.2, calcium: 150, vitD: 0.2, vitC: 0, magnesium: 16, sodium: 590 },
  { keys: ['greek yogurt', 'skyr'], name: 'Greek Yogurt / Skyr', grams: 200, c: 8, p: 20, f: 2, fiber: 0, iron: 0.2, calcium: 220, vitD: 0.5, vitC: 0, magnesium: 22, sodium: 75 },
  { keys: ['chicken thigh', 'chicken thighs', 'teriyaki chicken', 'fried chicken', 'crispy chicken', 'bbq chicken', 'rotisserie chicken'], name: 'Chicken Thigh / Sauced Chicken', grams: 160, c: 8, p: 36, f: 16, fiber: 0, iron: 1.8, calcium: 20, vitD: 0.2, vitC: 0, magnesium: 36, sodium: 580 },
  { keys: ['chicken breast', 'grilled chicken', 'roast chicken', 'baked chicken', 'poached chicken', 'chicken'], name: 'Grilled Chicken Breast', grams: 150, c: 0, p: 45, f: 5, fiber: 0, iron: 1.5, calcium: 22, vitD: 0.2, vitC: 0, magnesium: 42, sodium: 300 },
  { keys: ['tuna salad'], name: 'Tuna Salad (with Mayo)', grams: 150, c: 3, p: 26, f: 14, fiber: 0.5, iron: 1.5, calcium: 22, vitD: 2.4, vitC: 2, magnesium: 32, sodium: 540 },
  { keys: ['egg salad'], name: 'Egg Salad', grams: 140, c: 3, p: 14, f: 18, fiber: 0.5, iron: 1.8, calcium: 55, vitD: 2.0, vitC: 2, magnesium: 14, sodium: 460 },
  { keys: ['spicy mayo', 'mayonnaise', 'mayo', 'aioli'], name: 'Mayo / Aioli', grams: 20, c: 1, p: 0, f: 14, fiber: 0, iron: 0.1, calcium: 4, vitD: 0.1, vitC: 0, magnesium: 1, sodium: 150 },
  { keys: ['olive oil', 'sesame oil', 'vinaigrette', 'salad dressing', 'dressing', 'pesto', 'butter', 'ghee', 'cream sauce', 'gravy', 'sauce'], name: 'Oil / Dressing / Sauce', grams: 18, c: 2, p: 0, f: 13, fiber: 0, iron: 0.1, calcium: 8, vitD: 0, vitC: 0, magnesium: 2, sodium: 210 },
  { keys: ['white rice', 'jasmine rice', 'basmati rice', 'basmati', 'brown rice', 'steamed rice', 'rice'], name: 'Cooked Rice', grams: 200, c: 56, p: 5, f: 1, fiber: 1.4, iron: 1.2, calcium: 20, vitD: 0, vitC: 0, magnesium: 24, sodium: 120 },
  { keys: ['white fish', 'cod', 'haddock', 'tilapia', 'sea bass', 'halibut', 'mackerel', 'trout', 'shrimp', 'prawns', 'fish'], name: 'Fish / Seafood', grams: 150, c: 0, p: 33, f: 4, fiber: 0, iron: 1.0, calcium: 45, vitD: 4.0, vitC: 0, magnesium: 52, sodium: 320 },
  { keys: ['salmon', 'smoked salmon'], name: 'Salmon Fillet', grams: 150, c: 0, p: 34, f: 18, fiber: 0, iron: 1.2, calcium: 18, vitD: 15, vitC: 0, magnesium: 45, sodium: 280 },
  { keys: ['tuna'], name: 'Tuna', grams: 130, c: 0, p: 32, f: 2, fiber: 0, iron: 1.8, calcium: 16, vitD: 3.0, vitC: 0, magnesium: 38, sodium: 380 },
  { keys: ['turkey', 'turkey breast'], name: 'Turkey Breast', grams: 130, c: 1, p: 34, f: 3, fiber: 0, iron: 1.5, calcium: 18, vitD: 0.2, vitC: 0, magnesium: 34, sodium: 480 },
  { keys: ['steak', 'ribeye', 'sirloin', 'beef', 'brisket', 'meatballs', 'meatball', 'ground beef', 'mince'], name: 'Beef / Steak', grams: 160, c: 2, p: 40, f: 17, fiber: 0, iron: 4.0, calcium: 22, vitD: 0.2, vitC: 0, magnesium: 36, sodium: 380 },
  { keys: ['pork', 'pork chop', 'pulled pork', 'ham', 'prosciutto', 'sausage', 'bacon', 'chorizo', 'ribs'], name: 'Pork / Ham / Sausage', grams: 140, c: 3, p: 30, f: 18, fiber: 0, iron: 1.5, calcium: 20, vitD: 0.8, vitC: 0, magnesium: 28, sodium: 720 },
  { keys: ['lamb', 'duck'], name: 'Lamb / Duck', grams: 150, c: 0, p: 35, f: 20, fiber: 0, iron: 3.2, calcium: 22, vitD: 0.2, vitC: 0, magnesium: 34, sodium: 320 },
  { keys: ['tofu', 'tempeh', 'seitan', 'edamame'], name: 'Tofu / Edamame', grams: 150, c: 6, p: 20, f: 9, fiber: 3, iron: 3.4, calcium: 240, vitD: 0, vitC: 2, magnesium: 68, sodium: 210 },
  { keys: ['omelette', 'omelet', 'scrambled eggs', 'fried eggs', 'boiled eggs', 'poached eggs', 'eggs', 'egg', 'frittata'], name: 'Eggs (2 large)', grams: 100, c: 1, p: 13, f: 10, fiber: 0, iron: 1.8, calcium: 56, vitD: 2.2, vitC: 0, magnesium: 12, sodium: 180 },
  { keys: ['yogurt', 'yoghurt'], name: 'Yogurt', grams: 170, c: 12, p: 10, f: 4, fiber: 0, iron: 0.1, calcium: 200, vitD: 0.4, vitC: 0, magnesium: 20, sodium: 90 },
  { keys: ['cheese', 'parmesan', 'cheddar', 'feta', 'mozzarella', 'brie', 'gouda', 'halloumi'], name: 'Cheese', grams: 35, c: 1, p: 9, f: 10, fiber: 0, iron: 0.2, calcium: 250, vitD: 0.3, vitC: 0, magnesium: 10, sodium: 260 },
  { keys: ['pasta', 'spaghetti', 'penne', 'fusilli', 'tagliatelle', 'gnocchi', 'noodles', 'udon', 'soba'], name: 'Cooked Pasta / Noodles', grams: 220, c: 64, p: 11, f: 2, fiber: 3.5, iron: 2.4, calcium: 18, vitD: 0, vitC: 0, magnesium: 38, sodium: 220 },
  { keys: ['quinoa', 'couscous', 'farro', 'bulgur', 'barley', 'grain bowl', 'buckwheat'], name: 'Quinoa / Grain Base', grams: 185, c: 39, p: 8, f: 3, fiber: 5, iron: 2.8, calcium: 32, vitD: 0, vitC: 0, magnesium: 118, sodium: 160 },
  { keys: ['potatoes', 'potato', 'baked potato', 'roasted potatoes'], name: 'Potatoes', grams: 220, c: 44, p: 5, f: 2, fiber: 4.5, iron: 1.6, calcium: 28, vitD: 0, vitC: 24, magnesium: 48, sodium: 220 },
  { keys: ['sourdough', 'bread roll', 'bread', 'toast', 'baguette', 'ciabatta', 'focaccia', 'bagel', 'bun', 'naan', 'pita', 'flatbread', 'roll'], name: 'Bread / Roll', grams: 80, c: 40, p: 8, f: 2, fiber: 2.8, iron: 2.2, calcium: 55, vitD: 0, vitC: 0, magnesium: 24, sodium: 390 },
  { keys: ['sandwich', 'panini', 'sub', 'wrap', 'tortilla', 'tacos', 'taco'], name: 'Sandwich / Wrap / Tacos', grams: 180, c: 48, p: 16, f: 10, fiber: 4, iron: 2.8, calcium: 110, vitD: 0.2, vitC: 4, magnesium: 42, sodium: 680 },
  { keys: ['pizza'], name: 'Pizza (2 slices)', grams: 220, c: 68, p: 24, f: 22, fiber: 4.5, iron: 3.2, calcium: 360, vitD: 0.4, vitC: 6, magnesium: 46, sodium: 1180 },
  { keys: ['sushi', 'maki', 'nigiri'], name: 'Sushi Roll (8 pcs)', grams: 260, c: 56, p: 18, f: 6, fiber: 2.5, iron: 1.8, calcium: 38, vitD: 3.0, vitC: 4, magnesium: 48, sodium: 780 },
  { keys: ['lentils', 'lentil', 'dal', 'chickpeas', 'black beans', 'kidney beans', 'beans', 'chili', 'hummus'], name: 'Beans / Lentils / Hummus', grams: 180, c: 32, p: 14, f: 4, fiber: 10, iron: 4.4, calcium: 62, vitD: 0, vitC: 4, magnesium: 74, sodium: 420 },
  { keys: ['soup', 'stew', 'goulash', 'chowder'], name: 'Soup / Stew', grams: 320, c: 28, p: 14, f: 9, fiber: 4.5, iron: 2.2, calcium: 65, vitD: 0.2, vitC: 12, magnesium: 38, sodium: 920 },
  { keys: ['oats', 'oatmeal', 'porridge', 'granola', 'muesli', 'cereal'], name: 'Oats / Granola', grams: 80, c: 52, p: 11, f: 6, fiber: 7, iron: 3.4, calcium: 52, vitD: 0, vitC: 0, magnesium: 110, sodium: 85 },
  { keys: ['pancakes', 'pancake', 'waffles', 'waffle', 'french toast'], name: 'Pancakes / Waffles', grams: 160, c: 54, p: 10, f: 12, fiber: 2, iron: 2.4, calcium: 180, vitD: 0.8, vitC: 0, magnesium: 24, sodium: 540 },
  { keys: ['side salad', 'mixed salad', 'green salad', 'salad', 'spinach', 'arugula', 'lettuce', 'kale', 'mixed greens'], name: 'Side Salad / Greens', grams: 120, c: 6, p: 3, f: 1, fiber: 3, iron: 2.2, calcium: 75, vitD: 0, vitC: 24, magnesium: 42, sodium: 50 },
  { keys: ['roasted veggies', 'roasted vegetables', 'steamed veggies', 'broccoli', 'veggies', 'vegetables', 'carrots', 'peppers', 'zucchini', 'asparagus', 'cauliflower', 'green beans', 'corn', 'peas', 'mushrooms', 'tomatoes'], name: 'Vegetables', grams: 150, c: 12, p: 4, f: 3, fiber: 4.5, iron: 1.4, calcium: 58, vitD: 0, vitC: 46, magnesium: 36, sodium: 160 },
  { keys: ['banana'], name: 'Banana', grams: 120, c: 27, p: 1, f: 0, fiber: 3.1, iron: 0.3, calcium: 6, vitD: 0, vitC: 10, magnesium: 32, sodium: 1 },
  { keys: ['apple', 'orange', 'berries', 'blueberries', 'strawberries', 'grapes', 'pear', 'mango', 'pineapple', 'fruit'], name: 'Fresh Fruit', grams: 150, c: 21, p: 1, f: 0, fiber: 3.5, iron: 0.3, calcium: 20, vitD: 0, vitC: 42, magnesium: 14, sodium: 2 },
  { keys: ['avocado', 'guacamole'], name: 'Avocado / Guacamole', grams: 75, c: 6, p: 2, f: 11, fiber: 5, iron: 0.4, calcium: 9, vitD: 0, vitC: 8, magnesium: 22, sodium: 45 },
  { keys: ['almonds', 'walnuts', 'cashews', 'peanuts', 'nuts', 'seeds', 'trail mix'], name: 'Nuts / Seeds', grams: 30, c: 6, p: 6, f: 15, fiber: 3, iron: 1.1, calcium: 58, vitD: 0, vitC: 0, magnesium: 74, sodium: 60 },
  { keys: ['energy bar', 'protein bar', 'granola bar', 'clif bar', 'bar'], name: 'Energy / Protein Bar', grams: 60, c: 34, p: 12, f: 7, fiber: 4, iron: 1.8, calcium: 120, vitD: 0.4, vitC: 0, magnesium: 42, sodium: 190 },
  { keys: ['croissant', 'muffin', 'cookie', 'cake', 'brownie', 'pastry', 'donut', 'doughnut', 'dessert', 'danish'], name: 'Pastry / Dessert', grams: 85, c: 44, p: 5, f: 17, fiber: 1.5, iron: 1.5, calcium: 42, vitD: 0.2, vitC: 0, magnesium: 18, sodium: 290 },
  { keys: ['chocolate', 'dark chocolate'], name: 'Chocolate', grams: 30, c: 15, p: 2, f: 11, fiber: 2.5, iron: 2.2, calcium: 22, vitD: 0, vitC: 0, magnesium: 48, sodium: 10 },
  { keys: ['latte', 'cappuccino', 'flat white', 'mocha', 'iced coffee', 'milk'], name: 'Milk Coffee / Latte', grams: 240, c: 13, p: 8, f: 6, fiber: 0, iron: 0.1, calcium: 260, vitD: 2.4, vitC: 0, magnesium: 24, sodium: 110 },
  { keys: ['orange juice', 'apple juice', 'juice', 'soda', 'cola', 'coke'], name: 'Juice / Sweet Drink', grams: 250, c: 28, p: 1, f: 0, fiber: 0.4, iron: 0.2, calcium: 22, vitD: 0, vitC: 60, magnesium: 14, sodium: 15 },
];

// Pre-build flattened keyword index sorted longest-first so compound dishes always match before single words
const SORTED_KEYWORDS = FOOD_ENTRIES.flatMap((food) =>
  food.keys.map((key) => ({ key, food }))
).sort((a, b) => b.key.length - a.key.length);

function extractLocalQuantity(prefixText, food) {
  const snippet = prefixText.slice(-28).toLowerCase();

  const gramMatch = snippet.match(/(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*(?:of\s*)?$/);
  if (gramMatch) return { explicitGrams: Number(gramMatch[1]), mult: 1 };

  const ozMatch = snippet.match(/(\d+(?:\.\d+)?)\s*(?:oz|ounces?)\s*(?:of\s*)?$/);
  if (ozMatch) return { explicitGrams: Math.round(Number(ozMatch[1]) * 28.35), mult: 1 };

  const unitMatch = snippet.match(/(\d+(?:\.\d+)?)\s*(cups?|slices?|pieces?|pcs?|scoops?|bowls?|tbsp|tablespoons?|plates?|rolls?|tacos?)\s*(?:of\s*)?$/);
  if (unitMatch) {
    const qty = Number(unitMatch[1]);
    const unit = unitMatch[2];
    if (unit.startsWith('cup')) return { mult: Math.min(Math.max(qty * 0.85, 0.35), 3.5) };
    if (unit.startsWith('tbsp') || unit.startsWith('tablespoon')) {
      return { explicitGrams: Math.round(qty * 15), mult: 1 };
    }
    if (unit.startsWith('slice') || unit.startsWith('piece') || unit.startsWith('pc') || unit.startsWith('taco')) {
      const baseCount = food.name.includes('2 slices') ? 2 : food.name.includes('6 pcs') ? 6 : food.name.includes('8 pcs') ? 8 : 2;
      return { mult: Math.min(Math.max(qty / baseCount, 0.35), 4) };
    }
    return { mult: Math.min(Math.max(qty, 0.4), 3) };
  }

  // Plain leading count before item (e.g. "3 eggs", "2 bananas", "2 rolls")
  const countMatch = snippet.match(/\b(\d+(?:\.\d+)?)\s*$/);
  if (countMatch) {
    const qty = Number(countMatch[1]);
    if (qty > 0 && qty <= 12) {
      if (food.name.includes('(2 large)') || food.name.includes('(2 slices)')) {
        return { mult: Math.min(Math.max(qty / 2, 0.5), 4) };
      }
      return { mult: Math.min(Math.max(qty, 0.5), 4) };
    }
  }

  if (/\b(half|1\/2|tiny|little|bit of|light|small)\s*(?:a\s*|an\s*|of\s*)?$/.test(snippet)) return { mult: 0.68 };
  if (/\b(double|extra|huge|massive|2x)\s*(?:a\s*|an\s*|of\s*)?$/.test(snippet)) return { mult: 1.55 };
  if (/\b(large|big|generous|heaping|loaded|full)\s*(?:a\s*|an\s*|of\s*)?$/.test(snippet)) return { mult: 1.32 };

  return { mult: 1.0 };
}

export function estimateMealLocally(text = '', hasImage = false, contextHint = 'work cafeteria meal') {
  const cleanText = String(text || '').trim();
  const lowerText = cleanText.toLowerCase();

  // Track occupied character indices so compound phrases consume their words and never double-count
  const occupied = new Array(lowerText.length).fill(false);
  const foundMatches = [];

  for (const { key, food } of SORTED_KEYWORDS) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'gi');
    let m;
    while ((m = re.exec(lowerText)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      let overlaps = false;
      for (let i = start; i < end; i += 1) {
        if (occupied[i]) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        for (let i = start; i < end; i += 1) occupied[i] = true;
        foundMatches.push({ start, end, matchedPhrase: m[0], food });
      }
    }
  }

  foundMatches.sort((a, b) => a.start - b.start);

  const matchedItems = [];
  const usedNames = new Set();

  for (const hit of foundMatches) {
    if (usedNames.has(hit.food.name)) continue;
    usedNames.add(hit.food.name);

    const prefix = cleanText.slice(0, hit.start);
    const portion = extractLocalQuantity(prefix, hit.food);
    const factor = portion.explicitGrams ? portion.explicitGrams / hit.food.grams : portion.mult;

    const grams = Math.max(5, Math.round(hit.food.grams * factor));
    const carbs = Math.round(hit.food.c * factor);
    const protein = Math.round(hit.food.p * factor);
    const fat = Math.round(hit.food.f * factor);
    const kcal = Math.round(carbs * 4 + protein * 4 + fat * 9);

    matchedItems.push({
      name: hit.food.name,
      estimatedGrams: grams,
      carbs,
      protein,
      fat,
      kcal,
      micros: {
        fiber: Number(((hit.food.fiber || 0) * factor).toFixed(1)),
        iron: Number(((hit.food.iron || 0) * factor).toFixed(1)),
        vitC: Math.round((hit.food.vitC || 0) * factor),
        calcium: Math.round((hit.food.calcium || 0) * factor),
        vitD: Number(((hit.food.vitD || 0) * factor).toFixed(1)),
        magnesium: Math.round((hit.food.magnesium || 0) * factor),
        sodium: Math.round((hit.food.sodium || 0) * factor),
      },
    });
  }

  const mentionsOilOrComposedFat =
    usedNames.has('Oil / Dressing / Sauce') ||
    usedNames.has('Mayo / Aioli') ||
    matchedItems.some((i) => i.fat >= 16);

  const isCafeteria = /cafeteria|canteen|work|restaurant|takeout|buffet|hot bar/i.test(
    `${cleanText} ${contextHint}`
  );

  if (matchedItems.length > 0 && !mentionsOilOrComposedFat && isCafeteria) {
    matchedItems.push({
      name: 'Estimated Restaurant Cooking Oil',
      estimatedGrams: 10,
      carbs: 0,
      protein: 0,
      fat: 9,
      kcal: 81,
      micros: { fiber: 0, iron: 0, vitC: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 180 },
    });
  }

  const unrecognizedFallback = matchedItems.length === 0;
  if (unrecognizedFallback) {
    matchedItems.push({
      name: hasImage
        ? 'Unanalyzed Photo (Add free Gemini key in Sync for plate vision)'
        : 'Unrecognized Meal — Edit Carbs/Protein/Fat below',
      estimatedGrams: 400,
      carbs: 55,
      protein: 30,
      fat: 16,
      kcal: 484,
      micros: { fiber: 5, iron: 2.5, vitC: 10, calcium: 100, vitD: 0.5, magnesium: 50, sodium: 720 },
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
        vitC: Math.round(acc.micros.vitC + (item.micros?.vitC || 0)),
        calcium: Math.round(acc.micros.calcium + (item.micros?.calcium || 0)),
        vitD: Number((acc.micros.vitD + (item.micros?.vitD || 0)).toFixed(1)),
        magnesium: Math.round(acc.micros.magnesium + (item.micros?.magnesium || 0)),
        sodium: Math.round(acc.micros.sodium + (item.micros?.sodium || 0)),
      },
    }),
    { carbs: 0, protein: 0, fat: 0, kcal: 0, micros: { fiber: 0, iron: 0, vitC: 0, calcium: 0, vitD: 0, magnesium: 0, sodium: 0 } }
  );

  const uncertaintyPct = unrecognizedFallback ? 30 : matchedItems.length >= 2 ? 16 : 22;

  return {
    title: cleanText ? cleanText.slice(0, 56) + (cleanText.length > 56 ? '…' : '') : 'Estimated Work Meal',
    items: matchedItems,
    ...totals,
    uncertaintyPct,
    unrecognizedFallback,
    engine: hasImage
      ? 'Built-In Food Matcher (add Gemini/OpenAI key in Sync for photo AI)'
      : 'Built-In USDA Food Matcher (80+ dishes)',
    notes: unrecognizedFallback
      ? 'Could not match those exact words in the offline list — tweak the Carbs/Protein/Fat boxes below, or add a free Gemini API key in Sync for full AI estimation.'
      : 'Matched each food against USDA reference portions. You can scale the slider or directly edit Carbs, Protein, and Fat below.',
  };
}
