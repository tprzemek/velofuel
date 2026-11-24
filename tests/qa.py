import json
import subprocess
import time
from playwright.sync_api import sync_playwright

PORT = 4179
URL = f"http://127.0.0.1:{PORT}/"
FORBIDDEN_JARGON = ["podlogar", "tdee", "ffm", "red-s", "fftwr", "rmr", "7-day ema", "scales carbs", "scales protein"]


def check_no_jargon(page, context_label):
    text = page.locator("body").inner_text().lower()
    for term in FORBIDDEN_JARGON:
        assert term not in text, f"Found forbidden jargon '{term}' on {context_label}"


def clear_and_verify_empty(locator, label):
    locator.click()
    locator.press("Control+A")
    locator.press("Backspace")
    val = locator.input_value()
    assert val == "", f"[{label}] Backspace failed: expected '', got {val!r}"


def get_slot_planned_carbs(page, slot_id):
    pill = page.locator(f".meal-slot[data-slot='{slot_id}'] .planned-pill.carb .planned-pill-num")
    return int(pill.inner_text().replace("g", "").strip())


def run_qa():
    server = subprocess.Popen(
        ["npx", "vite", "preview", "--port", str(PORT), "--host", "127.0.0.1", "--strictPort"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    time.sleep(2.0)

    console_errors = []
    page_errors = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 390, "height": 844})
            page = context.new_page()
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda err: page_errors.append(str(err)))
            nav = page.get_by_role("navigation", name="Main navigation")

            # 1. Fresh launch -> Welcome screen (3 paths, 0 jargon, 0 premature writes) -> Enter Demo Mode -> Today tab checks
            page.goto(URL, wait_until="networkidle")
            page.get_by_role("button", name="Set Up My Profile (2 min)").wait_for(state="visible", timeout=5000)
            assert page.get_by_role("button", name="Set Up My Profile (2 min)").is_visible(), "Expected Welcome primary CTA"
            assert page.get_by_role("button", name="Restore from Cloud Backup").is_visible(), "Expected Cloud Restore CTA"
            assert page.get_by_role("button", name="Explore with Demo Data").is_visible(), "Expected Demo Mode CTA"
            check_no_jargon(page, "Welcome screen")
            untouched_ls = page.evaluate("() => localStorage.getItem('velofuel_state_v1')")
            assert untouched_ls is None, f"Fresh Welcome screen MUST NOT persist defaults prematurely! Got: {untouched_ls}"

            page.get_by_role("button", name="Explore with Demo Data").click()
            assert page.get_by_text("VeloFuel").first.is_visible()
            assert page.locator(".sync-status-pill").is_visible(), "Expected top-bar Sync Status Pill"
            stepper_box = page.locator(".date-stepper").bounding_box()
            assert stepper_box is not None and stepper_box["x"] + stepper_box["width"] <= 390, (
                f"Top-bar date-stepper clipped at 390px: {stepper_box}"
            )
            check_no_jargon(page, "Today tab")

            assert page.locator(".logged-item").count() == 0, "Expected 0 pre-logged meals by default"
            assert page.locator(".hero-ring-wrap svg").is_visible(), "Expected modern SVG calorie ring"
            assert page.locator(".planned-macro-grid").count() == 4, "Expected prominent planned macro grids on all 4 meals"

            left_count = page.locator(".macro-bar-box").filter(has_text="g left").count()
            assert left_count == 3, f"Expected 3 macro boxes showing 'g left', found {left_count}"
            assert page.get_by_text("table salt").first.is_visible()

            # Default bottle size selection persists to Sync default
            bottle_group = page.get_by_role("group", name="Ride bottle size")
            bottle_group.get_by_role("button", name="750 ml").click()
            assert page.get_by_text("2× 750 ml").first.is_visible()
            nav.get_by_role("button", name="Sync").click()
            assert page.get_by_label("Default Ride Bottle").input_value() == "750", "Expected 750 ml saved as default bottle"
            assert page.get_by_label("USDA FoodData Central API Key (Optional)").is_visible()
            nav.get_by_role("button", name="Today").click()
            print("PASS 1: Welcome 3-path entry, empty default meals, modern hero ring, prominent planned numbers, and default bottle size")

            # 2. Tomorrow's Ride Pre-Load belongs inside Dinner card, NOT right below top hero card
            page.get_by_role("button", name="Next day").click()
            assert page.get_by_text("Tomorrow").first.is_visible()
            # Tomorrow (Today+1) precedes Today+2 (VO2max 5x4m), so needsTomorrowPreload is True!
            dinner_card = page.locator(".meal-slot[data-slot='dinner']")
            assert dinner_card.get_by_text("Tomorrow's Ride Pre-Load:").is_visible(), "Expected Tomorrow Pre-Load inside Dinner card!"
            # Verify there is NO Tomorrow Pre-Load banner directly under the hero card outside .meal-slot
            all_preload = page.get_by_text("Tomorrow's Ride Pre-Load:").count()
            assert all_preload == 1, f"Expected exactly 1 Tomorrow Pre-Load notice (inside Dinner), found {all_preload}"
            page.get_by_role("button", name="Previous day").click()
            print("PASS 2: Tomorrow's Ride Pre-Load moved inside Dinner card (not below top Hero)")

            # 3. Customizable Day: Delete Lunch -> verify Dinner macros increase; Add custom snack in between -> Reset meals
            dinner_c_before = get_slot_planned_carbs(page, "dinner")
            breakfast_c_before = get_slot_planned_carbs(page, "breakfast")
            lunch_c_before = get_slot_planned_carbs(page, "lunch")
            snack_c_before = get_slot_planned_carbs(page, "snack")
            total_off_bike_before = breakfast_c_before + lunch_c_before + snack_c_before + dinner_c_before

            page.get_by_role("button", name="Remove Lunch meal slot").click()
            assert page.locator(".meal-slot[data-slot='lunch']").count() == 0, "Lunch slot should be removed"
            dinner_c_after_del = get_slot_planned_carbs(page, "dinner")
            assert dinner_c_after_del > dinner_c_before, (
                f"Deleting Lunch must increase Dinner carbs ({dinner_c_before}g -> {dinner_c_after_del}g)"
            )
            total_after_del = (
                get_slot_planned_carbs(page, "breakfast")
                + get_slot_planned_carbs(page, "snack")
                + dinner_c_after_del
            )
            assert total_after_del == total_off_bike_before, (
                f"Total off-bike carbs should be conserved ({total_off_bike_before}g vs {total_after_del}g)"
            )

            # Add custom snack between meals
            page.get_by_role("button", name="Add Meal", exact=True).click()
            page.get_by_label("Meal or Snack Name").fill("Mid-Morning Espresso & Banana")
            page.get_by_label("Place in Timeline").select_option("1")
            page.get_by_role("button", name="Add & Rebalance Day").click()
            assert page.locator(".meal-slot").nth(1).get_by_text("Mid-Morning Espresso & Banana").is_visible()
            dinner_c_after_add = get_slot_planned_carbs(page, "dinner")
            assert dinner_c_after_add < dinner_c_after_del, "Adding a snack should rebalance Dinner down slightly"

            # Reset default meals
            page.get_by_role("button", name="Reset meals").click()
            assert page.locator(".meal-slot[data-slot='lunch']").count() == 1, "Reset meals should restore Lunch"
            print("PASS 3: Delete meal redistributes exact macros + Add custom snack in between + Reset meals")

            # 4. Training card placement selector + Up/Down + Drag-and-Drop reordering between meals
            placement = page.get_by_label("Workout placement:")
            placement.select_option("0")  # Before Breakfast
            assert page.locator(".meal-slot").nth(0).get_attribute("data-slot") == "on_bike"

            page.get_by_role("button", name="Move Training down").click()
            assert page.locator(".meal-slot").nth(1).get_attribute("data-slot") == "on_bike"

            page.locator(".meal-slot[data-slot='on_bike'] .drag-handle").drag_to(page.locator(".meal-slot[data-slot='lunch']"))
            assert page.locator(".meal-slot").nth(2).get_attribute("data-slot") == "on_bike"
            print("PASS 4: Training card placement dropdown, Up/Down controls, and Drag-and-Drop reordering")

            # 5. Suggested Meal + Daily Supplements stack + EDIT Saved Supplement in place + Add New Supplement
            page.locator(".meal-slot[data-slot='breakfast']").get_by_role("button", name="Suggested Meal").click()
            assert page.get_by_text("Oats & Berries").first.is_visible()
            page.get_by_role("button", name="Log Suggested").click()
            assert page.locator(".meal-slot[data-slot='breakfast'] .logged-item").count() == 1

            page.get_by_role("button", name="Log Daily Stack (2)").click()
            assert page.get_by_text("Iron + Vitamin C").first.is_visible()

            page.get_by_role("button", name="Supplements", exact=True).click()
            supp_dialog = page.get_by_role("dialog", name="Vitamins and Supplements")
            assert supp_dialog.get_by_text("Your Saved Supplements (2)").is_visible()

            # Edit existing saved supplement (Iron + Vitamin C)
            supp_dialog.get_by_role("button", name="Edit Iron + Vitamin C").click()
            assert supp_dialog.get_by_text("Edit Saved Supplement").is_visible()
            supp_dialog.get_by_label("Supplement Name").fill("Iron + Vit C (35mg)")
            supp_iron = supp_dialog.get_by_label("Iron (mg)")
            clear_and_verify_empty(supp_iron, "Edit Supplement Iron input")
            supp_iron.type("35")
            supp_dialog.get_by_role("button", name="Save Supplement Changes").click()

            # Verify no duplicate created and updated values persisted
            assert supp_dialog.get_by_text("Your Saved Supplements (2)").is_visible(), "Editing created a duplicate!"
            assert supp_dialog.get_by_text("Iron + Vit C (35mg)").is_visible()
            assert supp_dialog.get_by_text("35mg Iron").is_visible()

            # Add new supplement as well
            supp_dialog.get_by_label("Supplement Name").fill("Evening Magnesium")
            supp_mg = supp_dialog.get_by_label("Magnesium (mg)")
            clear_and_verify_empty(supp_mg, "New Supplement Magnesium input")
            supp_mg.type("250")
            supp_dialog.get_by_role("button", name="Save & Log Supplement Today").click()
            assert supp_dialog.get_by_text("Your Saved Supplements (3)").is_visible()
            supp_dialog.get_by_role("button", name="Close").click()
            # Verify today's already-logged supplement chip ALSO updated to edited name!
            assert page.get_by_text("Iron + Vit C (35mg)").first.is_visible()
            assert page.get_by_text("Evening Magnesium").first.is_visible()
            print("PASS 5: Suggested Meal + Daily Supplements + Edit Saved Supplement in place + Synced today's log")

            # 6. Reliable Branded Food Search (USDA + Open Food Facts) + Save as Reusable + Work Meal
            page.locator(".meal-slot[data-slot='lunch']").get_by_role("button", name="Scan / Type").click()
            quick_dialog = page.get_by_role("dialog", name="Scan or Add Food")
            scan_cta = quick_dialog.get_by_role("button", name="Scan Barcode → Enter Amount (g)")
            assert scan_cta.is_visible()
            scan_cta.click()
            assert page.get_by_role("dialog", name="Scan Food Barcode").is_visible()
            page.get_by_role("dialog", name="Scan Food Barcode").get_by_role("button", name="Close").click()

            # Search a real grocery brand NOT in local list ("Nature Valley") via USDA + OFF v2
            # Mock OFF v2 search so QA isn't flaky when Open Food Facts returns 503 or USDA DEMO_KEY hits 429
            def handle_off_brand_search(route):
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({
                        "products": [
                            {
                                "code": "0016000264694",
                                "product_name": "Crunchy Oats 'n Honey Granola Bars",
                                "brands": "Nature Valley",
                                "serving_quantity": 42,
                                "serving_size": "2 bars (42g)",
                                "nutriments": {
                                    "carbohydrates_100g": 69.0,
                                    "proteins_100g": 7.1,
                                    "fat_100g": 16.7,
                                    "fiber_100g": 4.8,
                                    "sodium_100g": 0.33,
                                    "iron_100g": 0.0024,
                                },
                            },
                            {
                                "code": "0016000439894",
                                "product_name": "Sweet & Salty Nut Peanut Granola Bar",
                                "brands": "Nature Valley",
                                "serving_quantity": 35,
                                "serving_size": "1 bar (35g)",
                                "nutriments": {
                                    "carbohydrates_100g": 57.1,
                                    "proteins_100g": 11.4,
                                    "fat_100g": 22.9,
                                    "fiber_100g": 5.7,
                                    "sodium_100g": 0.4,
                                },
                            },
                            {
                                "code": "0016000124790",
                                "product_name": "Protein Chewy Bars Peanut Butter Dark Chocolate",
                                "brands": "Nature Valley",
                                "serving_quantity": 40,
                                "serving_size": "1 bar (40g)",
                                "nutriments": {
                                    "carbohydrates_100g": 35.0,
                                    "proteins_100g": 25.0,
                                    "fat_100g": 30.0,
                                    "fiber_100g": 15.0,
                                    "sodium_100g": 0.45,
                                },
                            },
                        ]
                    }),
                )

            page.route("https://world.openfoodfacts.org/api/v2/search*", handle_off_brand_search)
            search_box = quick_dialog.get_by_placeholder("Search foods or brands (Chobani, Clif, oats, Maurten...)")
            search_box.fill("Nature Valley")
            quick_dialog.get_by_role("button", name='Search USDA & brands for "Nature Valley"').click()
            quick_dialog.get_by_text("Online Database (").wait_for(state="visible", timeout=10000)
            assert quick_dialog.locator("button:has-text('+ Log')").count() >= 1, "Expected online USDA/OFF brand results for Nature Valley"

            # Log the first online brand result!
            quick_dialog.locator("button:has-text('+ Log')").first.click()
            page.unroute("https://world.openfoodfacts.org/api/v2/search*", handle_off_brand_search)

            save_reusable = page.get_by_role("button", name="Save Logged Lunch as Reusable Meal")
            assert save_reusable.is_visible()
            save_reusable.click()

            # Test Work Meal Estimator with compound dish + explicit grams
            page.locator(".meal-slot[data-slot='lunch']").get_by_role("button", name="Work Meal").click()
            work_dialog = page.get_by_role("dialog", name="Estimate Work Meal")
            work_dialog.get_by_label("Describe what you ate").fill("butter chicken and 200g jasmine rice")
            work_dialog.get_by_role("button", name="Estimate Macros").click()
            estimate_card = work_dialog.locator(".card")
            assert estimate_card.get_by_text("Chicken Tikka / Butter Chicken").is_visible()
            assert estimate_card.get_by_text("Cooked Rice").is_visible()
            assert estimate_card.get_by_text("Grilled Chicken Breast").count() == 0, "Double-counted chicken on butter chicken!"

            wm_carbs = work_dialog.get_by_label("Carbs (g)")
            clear_and_verify_empty(wm_carbs, "Work meal editable carbs")
            wm_carbs.type("78")
            work_dialog.get_by_role("button", name="Log Work Meal & Auto-Adjust Evening Dinner").click()

            # Saved Meal scaler modal
            page.locator(".meal-slot[data-slot='dinner']").get_by_role("button", name="Saved Dinner").click()
            page.get_by_role("button", name="Log Scaled Home Meal").click()
            print("PASS 6: Live USDA + OFF Brand Search ('Nature Valley'), Save-as-Reusable, Work Meal estimator, Saved Meal scaler")

            # 7. Actual Ride Fuel (Carbs + Protein + Fat + inline Barcode Scan) + Complete Ride
            carbs_box = page.locator(".macro-bar-box").nth(0)
            prot_box = page.locator(".macro-bar-box").nth(1)
            fat_box = page.locator(".macro-bar-box").nth(2)

            def parse_left(box):
                txt = box.locator(".macro-bar-left").inner_text().strip()
                if "over" in txt:
                    return -int(txt.replace("+", "").split("g")[0])
                return int(txt.split("g")[0])

            before_c = parse_left(carbs_box)
            before_p = parse_left(prot_box)
            before_f = parse_left(fat_box)

            page.get_by_role("button", name="Log Actual / Tweak").click()
            page.get_by_role("button", name="Scan Bar / Gel / Mix").click()
            assert page.get_by_role("dialog", name="Scan Food Barcode").is_visible()
            page.get_by_role("dialog", name="Scan Food Barcode").get_by_role("button", name="Close").click()

            ob_carbs = page.get_by_label("Actual Carbs (g)")
            clear_and_verify_empty(ob_carbs, "Actual On-Bike Carbs")
            ob_carbs.type("80")
            ob_prot = page.get_by_label("Protein (g) — bars/mix")
            clear_and_verify_empty(ob_prot, "Actual On-Bike Protein")
            ob_prot.type("10")
            ob_fat = page.get_by_label("Fat (g) — bars/nuts")
            clear_and_verify_empty(ob_fat, "Actual On-Bike Fat")
            ob_fat.type("8")
            page.get_by_role("button", name="Save Actual Ride Fuel").click()

            assert parse_left(carbs_box) == before_c - 80
            assert parse_left(prot_box) == before_p - 10
            assert parse_left(fat_box) == before_f - 8

            page.get_by_role("button", name="Complete").click()
            kj_inp = page.get_by_label("Actual Power Work (kJ)")
            clear_and_verify_empty(kj_inp, "Actual kJ input")
            kj_inp.type("1750")
            ride_carbs_inp = page.get_by_label("Actual Ride Carbs (g)")
            clear_and_verify_empty(ride_carbs_inp, "Complete ride carbs")
            ride_carbs_inp.type("110")
            page.get_by_role("button", name="Save & Recalculate Remaining Meals").click()
            assert page.get_by_text("1750 kJ").first.is_visible()
            assert page.get_by_text("110 /").first.is_visible()
            print("PASS 7: Modifiable actual ride C/P/F + barcode scan + Complete Ride recalculation")

            # 8. Staples, Week, Body, Sync + Mixed Units
            nav.get_by_role("button", name="Staples").click()
            check_no_jargon(page, "Staples tab")
            page.get_by_role("button", name="Edit Oats & Berries").click()
            oats_input = page.get_by_label("Rolled Oats (dry) grams")
            clear_and_verify_empty(oats_input, "Oats grams input")
            oats_input.type("60")
            page.get_by_role("button", name="Save Home Meal (3 items)").click()

            nav.get_by_role("button", name="Week").click()
            check_no_jargon(page, "Week tab")

            nav.get_by_role("button", name="Sync").click()
            check_no_jargon(page, "Sync tab")
            assert page.get_by_text("Direct Withings Smart Scale Sync").is_visible()
            page.get_by_role("button", name="Mixed (lbs · oz · ml/L)").click()

            nav.get_by_role("button", name="Body").click()
            check_no_jargon(page, "Body tab")
            assert page.get_by_text("lbs").first.is_visible()
            assert page.locator("svg[aria-label='Morning weight and 7-day trend chart']").is_visible()
            print("PASS 8: Staples, Week, Sync, Mixed Units, and Body tab verified")

            # 9. Multiple workouts in one day: Completed Morning Gym + Scheduled Evening Ride (UI + Intervals.icu Sync)
            nav.get_by_role("button", name="Today").click()
            hero_kcal_before = int(
                page.locator(".hero-kcal-sub").inner_text().split("/")[1].split("kcal")[0].replace(",", "").strip()
            )
            page.get_by_role("button", name="+ Workout").click()
            page.get_by_role("button", name="+ Gym / Strength").click()
            page.get_by_role("button", name="Add Workout & Recalculate Day").click()

            assert page.locator(".meal-slot.training-card").count() == 2, "Expected 2 workout cards (Gym + Ride)"
            gym_card = page.locator(".meal-slot.training-card", has=page.locator(".meal-slot-name", has_text="Gym / Strength"))
            assert gym_card.get_by_text("Completed").is_visible()
            assert gym_card.get_by_text("+270 kcal").is_visible()
            assert gym_card.get_by_text("Planned Rate").count() == 0, "Gym card must NOT show cycling g/h rate!"
            ride_card = page.locator(".meal-slot.training-card", has=page.locator(".meal-slot-name", has_text="Threshold 3×15m"))
            assert ride_card.is_visible(), "Scheduled Ride card must remain visible alongside completed Gym!"

            hero_kcal_after = int(
                page.locator(".hero-kcal-sub").inner_text().split("/")[1].split("kcal")[0].replace(",", "").strip()
            )
            assert hero_kcal_after > hero_kcal_before, (
                f"Adding Gym workout must increase daily calorie target ({hero_kcal_before} -> {hero_kcal_after})"
            )

            # Verify Week tab shows 2 Workouts on Today
            nav.get_by_role("button", name="Week").click()
            assert page.get_by_text("2 Workouts").first.is_visible()
            nav.get_by_role("button", name="Today").click()

            # Remove only Gym workout -> Ride stays!
            page.get_by_role("button", name="Remove Gym / Strength workout").click()
            assert page.locator(".meal-slot.training-card").count() == 1

            # Mock Intervals.icu returning Completed Morning Gym + Uncompleted Scheduled Evening Ride on Today
            today_iso = page.evaluate(
                "(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()"
            )

            def handle_icu_route(route):
                url = route.request.url
                if "/activities" in url:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=f'[{{"id": 9001, "name": "Morning Strength Gym", "type": "WeightTraining", "start_date_local": "{today_iso}T07:30:00", "moving_time": 2700, "calories": 310}}]',
                    )
                elif "/events" in url:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=f'[{{"id": 8002, "name": "Evening Sweet Spot Ride", "type": "Ride", "start_date_local": "{today_iso}T17:30:00", "moving_time": 5400, "joules": 1150000, "icu_training_load": 88}}]',
                    )
                elif "/wellness" in url:
                    route.fulfill(status=200, content_type="application/json", body="[]")
                else:
                    route.fulfill(status=200, content_type="application/json", body='{"name":"Test Rider","ftp":300}')

            page.route("https://intervals.icu/api/v1/athlete/**", handle_icu_route)
            nav.get_by_role("button", name="Sync").click()
            page.get_by_label("Personal API Key").fill("dummy-test-key")
            page.get_by_role("button", name="Sync Intervals.icu Now").click()
            page.get_by_text("Pulled FTP 300W").wait_for(state="visible", timeout=5000)

            nav.get_by_role("button", name="Today").click()
            assert page.locator(".meal-slot.training-card").count() == 2, (
                "Intervals.icu sync MUST keep BOTH completed Gym AND scheduled Ride!"
            )
            icu_gym = page.locator(".meal-slot.training-card", has=page.locator(".meal-slot-name", has_text="Morning Strength Gym"))
            icu_ride = page.locator(".meal-slot.training-card", has=page.locator(".meal-slot-name", has_text="Evening Sweet Spot Ride"))
            assert icu_gym.get_by_text("Completed").is_visible()
            assert icu_gym.get_by_text("+310 kcal").is_visible()
            assert icu_ride.get_by_text("Scheduled").is_visible()
            assert icu_ride.get_by_text("1150 kJ").is_visible()
            print("PASS 9: Multi-workout day (Completed Gym + Scheduled Ride) verified via both UI and Intervals.icu sync")

            # Switch back to Metric for deterministic gram/kg checks in v11 passes
            nav.get_by_role("button", name="Sync").click()
            page.get_by_role("button", name="Metric (kg · g · ml)").click()
            nav.get_by_role("button", name="Today").click()

            # 10. v11: Live Intra-Day Fuel Wave + Serving-Size Quick-Picks + Whole/Packaged Filter + Recent Foods + 3-Sec Quick Add Macros
            fuel_wave_svg = page.locator("svg[aria-label=\"Today's intra-day fuel balance wave\"]")
            assert fuel_wave_svg.is_visible(), "Expected Intra-Day Fuel Wave SVG on Today tab"
            assert page.locator(".fuel-wave-card.meal-slot").count() == 0, "Fuel Wave card MUST NOT use .meal-slot class"

            page.locator(".meal-slot[data-slot='snack']").get_by_role("button", name="Scan / Type").click()
            qf_dialog = page.get_by_role("dialog", name="Scan or Add Food")
            # Default tab must be Find / Scan
            assert qf_dialog.get_by_role("tab", name="Find / Scan").get_attribute("aria-selected") == "true"

            # Whole Foods / Packaged filter pills
            filter_group = qf_dialog.get_by_role("group", name="Food type filter")
            filter_group.get_by_role("button", name="Packaged").click()
            assert qf_dialog.get_by_text("Chobani Nonfat Plain Greek Yogurt").is_visible()
            filter_group.get_by_role("button", name="Whole Foods").click()
            assert qf_dialog.get_by_text("Rolled Oats (dry)").is_visible()
            filter_group.get_by_role("button", name="All").click()

            # Serving-Size quick-picks & editable NumericInput amount on Rolled Oats (dry)
            qf_dialog.get_by_role("button", name="Choose serving for Rolled Oats (dry)").click()
            oats_servings = qf_dialog.get_by_role("group", name="Serving sizes for Rolled Oats (dry)")
            oats_servings.get_by_role("button", name="1 cup").click()
            oats_amt = qf_dialog.get_by_label("Rolled Oats (dry) amount")
            assert oats_amt.input_value() == "80", f"Expected 80g after 1 cup chip, got {oats_amt.input_value()!r}"
            clear_and_verify_empty(oats_amt, "FoodPickerPanel serving amount")
            oats_amt.type("80")
            qf_dialog.locator(".food-picker-row", has_text="Rolled Oats (dry)").get_by_role("button", name="+ Log").click()
            assert page.locator(".meal-slot[data-slot='snack']").get_by_text("Rolled Oats (dry)").is_visible()

            # Re-open modal -> verify Recent Foods 1-tap strip shows Rolled Oats (dry) (80g), then test Quick Add tab
            page.locator(".meal-slot[data-slot='snack']").get_by_role("button", name="Scan / Type").click()
            qf_dialog = page.get_by_role("dialog", name="Scan or Add Food")
            recent_group = qf_dialog.get_by_role("group", name="Recent foods")
            assert recent_group.get_by_text("Rolled Oats (dry)").is_visible(), "Expected Rolled Oats in Recent Foods strip"

            qf_dialog.get_by_role("tab", name="Quick Add").click()
            check_no_jargon(page, "QuickFoodModal Quick Add tab")
            qf_dialog.get_by_label("Label (optional)").fill("Espresso Pastry")
            qa_c = qf_dialog.get_by_label("Carbs (g)")
            qa_p = qf_dialog.get_by_label("Protein (g)")
            qa_f = qf_dialog.get_by_label("Fat (g)")
            qa_c.type("45")
            clear_and_verify_empty(qa_c, "Quick Add Carbs")
            qa_c.type("45")
            qa_p.type("8")
            clear_and_verify_empty(qa_p, "Quick Add Protein")
            qa_p.type("8")
            qa_f.type("12")
            clear_and_verify_empty(qa_f, "Quick Add Fat")
            qa_f.type("12")
            qf_dialog.get_by_role("button", name="Log Quick Add (320 kcal)").click()
            assert page.locator(".meal-slot[data-slot='snack']").get_by_text("Espresso Pastry").is_visible()
            print("PASS 10: Fuel Wave SVG, Serving-Size Quick-Picks, Whole/Packaged Filter, Recent Foods, and Quick Add Macros")

            # 11. v11: 1-Tap Inline Edit on Logged Food & Saved Meal + Split Saved Meal into Individual Foods
            snack_card = page.locator(".meal-slot[data-slot='snack']")
            snack_card.get_by_role("button", name="Edit Rolled Oats (dry)").click()
            oats_edit_region = snack_card.get_by_role("region", name="Editing Rolled Oats (dry)")
            edit_amt_inp = oats_edit_region.get_by_label("Amount (g)")
            clear_and_verify_empty(edit_amt_inp, "Inline edit food grams")
            edit_amt_inp.type("100")
            oats_edit_region.get_by_role("button", name="Save Edit").click()
            assert snack_card.locator(".logged-item", has_text="Rolled Oats (dry)").get_by_text("100g").is_visible()
            assert snack_card.locator(".logged-item", has_text="Rolled Oats (dry)").get_by_text("66g C").is_visible()

            # Inline edit + Split Saved Meal on Breakfast ("Oats & Berries" logged in PASS 5)
            # Verify 1.25× scale is preserved on Split (not dropped to 1.0×) AND Staples template is untouched
            bf_card = page.locator(".meal-slot[data-slot='breakfast']")
            bf_before_count = bf_card.locator(".logged-item").count()
            bf_snapshot_before = page.evaluate(
                """(() => {
                    const st = JSON.parse(localStorage.getItem('velofuel_state_v1') || '{}');
                    const d = new Date();
                    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    const bfLogs = (st.logsByDate?.[today] || []).filter((l) => l.slot === 'breakfast' && l.type !== 'supplement');
                    const oatsLog = bfLogs.find((l) => l.title === 'Oats & Berries');
                    const template = (st.staples || []).find((s) => s.name === 'Oats & Berries');
                    return {
                        oatsKcal: oatsLog ? oatsLog.kcal : 0,
                        otherKcal: bfLogs.filter((l) => l.id !== oatsLog?.id).reduce((s, l) => s + (l.kcal || 0), 0),
                        templateJson: JSON.stringify(template || null),
                    };
                })()"""
            )
            assert bf_snapshot_before["oatsKcal"] > 100, f"Expected Oats & Berries logged kcal > 100, got {bf_snapshot_before}"
            bf_card.get_by_role("button", name="Edit Oats & Berries").click()
            bf_edit_region = bf_card.get_by_role("region", name="Editing Oats & Berries")
            bf_edit_region.get_by_role("button", name="1.25×").click()
            bf_edit_region.get_by_role("button", name="Split into individual foods").click()
            bf_after_count = bf_card.locator(".logged-item").count()
            assert bf_after_count > bf_before_count, (
                f"Splitting saved meal should unpack multiple foods ({bf_before_count} -> {bf_after_count})"
            )
            bf_snapshot_after = page.evaluate(
                """(() => {
                    const st = JSON.parse(localStorage.getItem('velofuel_state_v1') || '{}');
                    const d = new Date();
                    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    const bfLogs = (st.logsByDate?.[today] || []).filter((l) => l.slot === 'breakfast' && l.type !== 'supplement');
                    const template = (st.staples || []).find((s) => s.name === 'Oats & Berries');
                    return {
                        totalKcal: bfLogs.reduce((s, l) => s + (l.kcal || 0), 0),
                        templateJson: JSON.stringify(template || null),
                    };
                })()"""
            )
            split_kcal = bf_snapshot_after["totalKcal"] - bf_snapshot_before["otherKcal"]
            expected_scaled = bf_snapshot_before["oatsKcal"] * 1.25
            assert expected_scaled * 0.9 <= split_kcal <= expected_scaled * 1.1, (
                f"Expected 1.25x split kcal near {expected_scaled:.0f}, got {split_kcal} (orig {bf_snapshot_before['oatsKcal']})"
            )
            assert bf_snapshot_after["templateJson"] == bf_snapshot_before["templateJson"], (
                "Splitting a logged Saved Meal MUST NOT mutate the Staples template!"
            )

            # Calorie-only Quick Add (425 kcal, empty C/P/F) renamed via inline edit must retain 425 kcal
            snack_card.get_by_role("button", name="Scan / Type").click()
            qf_dialog = page.get_by_role("dialog", name="Scan or Add Food")
            qf_dialog.get_by_role("tab", name="Quick Add").click()
            qf_dialog.get_by_label("Label (optional)").fill("Calorie Only Shake")
            qf_dialog.get_by_label("Calories (kcal — auto or custom)").fill("425")
            qf_dialog.get_by_role("button", name="Log Quick Add (425 kcal)").click()
            assert snack_card.locator(".logged-item", has_text="Calorie Only Shake").get_by_text("425 kcal").is_visible()
            snack_card.get_by_role("button", name="Edit Calorie Only Shake").click()
            cal_edit_region = snack_card.get_by_role("region", name="Editing Calorie Only Shake")
            cal_edit_region.get_by_label("Title").fill("Renamed Calorie Shake")
            cal_edit_region.get_by_role("button", name="Save Edit").click()
            renamed_item = snack_card.locator(".logged-item", has_text="Renamed Calorie Shake")
            assert renamed_item.is_visible(), "Expected renamed calorie-only Quick Add"
            assert renamed_item.get_by_text("425 kcal").is_visible(), "Renaming calorie-only Quick Add MUST retain 425 kcal!"

            check_no_jargon(page, "Today after inline edit & split")
            print("PASS 11: 1-Tap Inline Edit (grams, calorie-only Quick Add, Saved Meal 1.25× scale + Split w/ untouched Staples)")

            # 12. v11: Heat/Conditions + Sweat Rate + DIY Bottle Mix Studio + Pack Your Ride + Hourly Eating Schedule
            icu_ride = page.locator(".meal-slot.training-card", has=page.locator(".meal-slot-name", has_text="Evening Sweet Spot Ride"))
            icu_ride.get_by_role("group", name="Ride conditions").get_by_role("button", name="Hot / Indoor").click()
            icu_ride.get_by_role("group", name="Ride sweat rate").get_by_role("button", name="Heavy").click()
            assert icu_ride.get_by_text("975 ml/h").is_visible() or icu_ride.get_by_text("1.0 L/h").is_visible() or icu_ride.get_by_text("1150 ml/h").is_visible()

            # DIY Bottle Mix Studio toggles
            icu_ride.get_by_role("group", name="Carb mix base").get_by_role("button", name="Malto + Fructose").click()
            assert icu_ride.get_by_text("malto +").first.is_visible()
            icu_ride.get_by_role("group", name="Sodium source").get_by_role("button", name="Sodium Citrate").click()
            assert icu_ride.get_by_text("sodium citrate").first.is_visible()
            icu_ride.get_by_role("button", name="Switch to Spoons").click()
            assert icu_ride.get_by_text("tbsp").first.is_visible()
            assert icu_ride.get_by_text("tsp").first.is_visible()
            icu_ride.get_by_role("button", name="Switch to Grams").click()

            # Collapsible Pack Your Ride + Eating Schedule + Log Pack as Actual Ride Fuel
            icu_ride.get_by_role("button", name="Pack Your Ride & Eating Schedule").click()
            icu_ride.get_by_role("button", name="Add 1 Energy Gels").click()
            icu_ride.get_by_role("button", name="Add 1 Bars / Rice Cakes").click()
            assert icu_ride.get_by_text("Ride Eating Schedule").is_visible()
            assert icu_ride.get_by_text("Energy Gel #1").is_visible()
            assert icu_ride.get_by_text("Bar / Rice Cake #1").is_visible()
            check_no_jargon(page, "Ride Card DIY Studio & Pack Your Ride")
            icu_ride.locator("button:has-text('Log Pack as Actual Ride Fuel')").click()
            assert icu_ride.locator(".logged-item").count() >= 1
            print("PASS 12: Heat/Sweat live scaling, DIY Bottle Mix Studio (Spoons/Grams, Malto, Citrate), and Pack Your Ride + Schedule")

            # 13. v11: Copy Yesterday's Meals & Repeat Yesterday (Meals Only, Never Workouts) + Pack Isolation + Micro Inspector + Body Weekly Check-In
            # Navigate to Tomorrow (where Today is "yesterday" and has logged meals + logged ride fuel + open Pack drawer!)
            page.get_by_role("button", name="Next day").click()
            assert page.get_by_text("Tomorrow").first.is_visible()

            # Verify Today's open Pack Your Ride drawer & gel count did NOT leak onto Tomorrow's ride
            tmrw_ride = page.locator(".meal-slot.training-card").first
            assert tmrw_ride.locator(".ride-pack-drawer").count() == 0, "Today's Pack Your Ride drawer MUST NOT leak open onto Tomorrow!"
            tmrw_ride.get_by_role("button", name="Pack Your Ride & Eating Schedule").click()
            gel_row_text = tmrw_ride.locator(".pack-stepper-row", has_text="Energy Gels").inner_text()
            assert "\n0\n" in f"\n{gel_row_text}\n" or gel_row_text.strip().endswith("0\n+") or "0" in gel_row_text.split("each")[-1], (
                f"Tomorrow's Energy Gels count should start at 0, not Today's count; got: {gel_row_text!r}"
            )
            assert tmrw_ride.get_by_text("Energy Gel #1").count() == 0, "Today's Energy Gel #1 MUST NOT leak into Tomorrow's schedule!"
            tmrw_ride.get_by_role("button", name="Pack Your Ride & Eating Schedule").click()

            assert page.get_by_role("button", name="Copy Yesterday's Meals").is_visible()
            tmrw_bf = page.locator(".meal-slot[data-slot='breakfast']")
            assert tmrw_bf.get_by_role("button", name="Repeat Yesterday").is_visible()
            tmrw_bf.get_by_role("button", name="Repeat Yesterday").click()
            assert tmrw_bf.locator(".logged-item").count() >= 2, "Repeat Yesterday should copy yesterday's Breakfast items"

            # Also verify Copy Yesterday's Meals copies meal items and NEVER copies workouts/on_bike fuel
            tmrw_snack = page.locator(".meal-slot[data-slot='snack']")
            assert tmrw_snack.locator(".logged-item").count() == 0
            page.get_by_role("button", name="Copy Yesterday's Meals").click()
            assert tmrw_snack.locator(".logged-item").count() >= 2
            assert page.locator(".meal-slot.training-card .logged-item").count() == 0, "Copy Yesterday MUST NOT copy workout fuel logs!"

            # Back to Today -> Tap-to-Inspect Micronutrient Contributors
            page.get_by_role("button", name="Previous day").click()
            page.locator(".micro-item-btn", has_text="Iron").click()
            iron_drawer = page.get_by_role("region", name="Iron contributors")
            assert iron_drawer.is_visible()
            assert iron_drawer.get_by_text("Where today's Iron came from").is_visible()
            assert iron_drawer.get_by_text("Pairing tip:").is_visible()
            assert iron_drawer.get_by_text("Iron + Vit C (35mg)").is_visible()
            check_no_jargon(page, "Micronutrient contributor drawer")

            # Body Tab -> Weekly Calorie Check-In + Weigh-in NumericInput verification
            nav.get_by_role("button", name="Body").click()
            checkin_card = page.get_by_role("region", name="Weekly Calorie Check-In")
            assert checkin_card.is_visible(), "Expected Weekly Calorie Check-In card on Body tab"
            assert checkin_card.get_by_text("Avg Logged", exact=True).is_visible()
            assert checkin_card.get_by_text("7-Day Weight Trend", exact=True).is_visible()
            assert checkin_card.get_by_text("Estimated Daily Burn", exact=True).is_visible()
            assert checkin_card.get_by_text("Building Baseline").is_visible()

            bio_w = page.get_by_label("Weight (kg)")
            clear_and_verify_empty(bio_w, "Body weigh-in Weight NumericInput")
            bio_w.type("73.5")
            bio_bf = page.get_by_label("Body Fat % (optional)")
            clear_and_verify_empty(bio_bf, "Body weigh-in Body Fat NumericInput")
            bio_bf.type("14.5")
            check_no_jargon(page, "Body tab Weekly Calorie Check-In (Building)")

            # Seed 5 complete food days + 1 partial day (<45% target) to verify intake-aware Check-In active calculation & partial-day guard
            page.evaluate(
                """(() => {
                    const raw = localStorage.getItem('velofuel_state_v1');
                    if (!raw) return;
                    const st = JSON.parse(raw);
                    const isoShift = (delta) => {
                        const d = new Date();
                        d.setDate(d.getDate() + delta);
                        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    };
                    for (let i = 1; i <= 5; i++) {
                        const dt = isoShift(-i);
                        st.logsByDate[dt] = [{
                            id: `seed-full-${i}`,
                            slot: 'lunch',
                            type: 'quick_add',
                            title: 'Full Day Seed',
                            detail: 'Quick macros',
                            carbs: 320,
                            protein: 150,
                            fat: 80,
                            kcal: 2600,
                            uncertaintyPct: 0,
                            micros: { fiber: 28, iron: 12, vitC: 80, calcium: 900, vitD: 12, magnesium: 350, sodium: 2500 },
                            loggedAt: '13:00'
                        }];
                    }
                    // Add 1 partial day (400 kcal < 45% target) to verify partial-day skipping
                    st.logsByDate[isoShift(-6)] = [{
                        id: 'seed-partial-6',
                        slot: 'breakfast',
                        type: 'quick_add',
                        title: 'Coffee & Toast',
                        detail: 'Quick macros',
                        carbs: 55,
                        protein: 15,
                        fat: 13,
                        kcal: 400,
                        uncertaintyPct: 0,
                        micros: { fiber: 2, iron: 1, vitC: 0, calcium: 100, vitD: 0, magnesium: 20, sodium: 200 },
                        loggedAt: '08:00'
                    }];
                    localStorage.setItem('velofuel_state_v1', JSON.stringify(st));
                })()"""
            )
            page.reload(wait_until="networkidle")
            nav.get_by_role("button", name="Body").click()
            checkin_card = page.get_by_role("region", name="Weekly Calorie Check-In")
            assert checkin_card.get_by_text("1 partial day skipped").is_visible(), "Expected partial logging day guard!"
            assert checkin_card.get_by_text("Building Baseline").count() == 0, "Expected Check-In to unlock with 5+ complete days!"
            keep_btn = checkin_card.get_by_role("button", name="Keep Current Budget")
            assert keep_btn.is_visible(), "Expected Check-In action buttons when burn gap is significant!"
            keep_btn.click()
            assert checkin_card.get_by_text("Checked In").is_visible(), "Clicking Keep Current Budget should conclude Check-In with 'Checked In' badge!"
            assert checkin_card.get_by_role("button", name="Keep Current Budget").count() == 0, "Keep Current Budget button should hide after check-in!"
            assert checkin_card.locator("button:has-text('Apply ')").count() == 0, "Apply button should hide after check-in!"
            check_no_jargon(page, "Body tab Weekly Calorie Check-In (Checked In)")
            print("PASS 13: Copy Yesterday / Repeat Yesterday (meals only), Pack Isolation, Tap-to-Inspect Micros, and Weekly Check-In conclusion")

            # 14. v11 Iteration 2 Regressions: Imperial <1 oz blur preservation & Fuel Wave timeline reorder distribution
            nav.get_by_role("button", name="Sync").click()
            page.get_by_role("button", name="Imperial (lbs · oz · fl oz)").click()
            nav.get_by_role("button", name="Today").click()
            page.locator(".meal-slot[data-slot='lunch']").get_by_role("button", name="Scan / Type").click()
            qf_dialog = page.get_by_role("dialog", name="Scan or Add Food")
            qf_dialog.get_by_placeholder("Search foods or brands (Chobani, Clif, oats, Maurten...)").fill("Extra Virgin Olive Oil")
            qf_dialog.get_by_role("button", name="Choose serving for Extra Virgin Olive Oil").click()
            oil_amt = qf_dialog.get_by_label("Extra Virgin Olive Oil amount")
            oil_before = oil_amt.input_value()
            assert float(oil_before) < 1.0, f"Expected Olive Oil < 1 oz in Imperial mode, got {oil_before!r}"
            oil_amt.focus()
            oil_amt.blur()
            oil_after = oil_amt.input_value()
            assert float(oil_after) < 1.0 and oil_after == oil_before, (
                f"Imperial <1 oz blur MUST NOT clamp up to 1 oz! {oil_before!r} -> {oil_after!r}"
            )
            qf_dialog.get_by_role("button", name="Close").click()

            # Switch back to Metric and reorder Dinner to the top of the timeline -> verify Fuel Wave distributes markers across waking hours
            nav.get_by_role("button", name="Sync").click()
            page.get_by_role("button", name="Metric (kg · g · ml)").click()
            nav.get_by_role("button", name="Today").click()
            for _ in range(8):
                first_slot = page.locator(".meal-slot").first.get_attribute("data-slot")
                if first_slot == "dinner":
                    break
                up_btn = page.locator(".meal-slot[data-slot='dinner']").get_by_role("button", name="Move Dinner up")
                if up_btn.is_disabled():
                    break
                up_btn.click()
            assert page.locator(".meal-slot").first.get_attribute("data-slot") == "dinner", "Expected Dinner moved to top of timeline"
            wk_titles = page.locator("svg[aria-label=\"Today's intra-day fuel balance wave\"] circle title").all_text_contents()
            assert len(wk_titles) >= 1, f"Expected workout markers in Fuel Wave SVG, got {wk_titles}"
            assert not any("~9p" in t for t in wk_titles), (
                f"Fuel Wave markers MUST NOT pile onto ~9p when Dinner is moved to top! Got: {wk_titles}"
            )
            assert len(set(t.split("(~")[-1] for t in wk_titles)) == len(wk_titles), (
                f"Expected distinct waking hours for workout markers, got: {wk_titles}"
            )
            check_no_jargon(page, "PASS 14 regression checks")
            print("PASS 14: Imperial <1 oz blur preservation & Fuel Wave timeline reorder distribution verified")
            context.close()

            # =====================================================================
            # 15. v12: Full 5-Step Real-User Onboarding Wizard (Clean Zero-Demo Launch)
            # =====================================================================
            ctx15 = browser.new_context(viewport={"width": 390, "height": 844})
            p15 = ctx15.new_page()
            p15.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            p15.on("pageerror", lambda err: page_errors.append(str(err)))

            # Stateful mock for GitHub Private Gist API + strict CORS header & PAT audit
            cloud_store = {
                "gist_id": None,
                "content": None,
                "updated_at": "2026-11-24T12:00:00Z",
                "etag": '"etag-v1"',
                "serve_truncated": False,
                "raw_url_called": False,
            }
            cloud_requests = []
            FORBIDDEN_CORS_HEADERS = {"cache-control", "pragma", "x-github-api-version"}

            def make_gist_route_handler():
                def handle_gist(route):
                    req = route.request
                    url = req.url
                    method = req.method
                    headers_lower = {k.lower(): v for k, v in req.headers.items()}
                    body_text = req.post_data or ""

                    # Assert strict browser CORS header safety on every api.github.com request
                    if "api.github.com" in url:
                        for bad in FORBIDDEN_CORS_HEADERS:
                            assert bad not in headers_lower, (
                                f"Forbidden CORS preflight header '{bad}' sent to {url}! Headers: {headers_lower}"
                            )
                        assert headers_lower.get("authorization", "").startswith("Bearer "), (
                            f"Expected Bearer auth header on {url}"
                        )
                        cloud_requests.append({
                            "method": method,
                            "url": url,
                            "headers": headers_lower,
                            "body": body_text,
                        })

                        if method == "GET" and url.rstrip("/").endswith("/gists") or "/gists?" in url:
                            if cloud_store["gist_id"]:
                                listing = [{
                                    "id": cloud_store["gist_id"],
                                    "public": False,
                                    "description": "VeloFuel Cloud Sync Backup",
                                    "updated_at": cloud_store["updated_at"],
                                    "files": {
                                        "velofuel-backup.json": {
                                            "filename": "velofuel-backup.json",
                                            "size": len(cloud_store["content"] or ""),
                                        }
                                    },
                                }]
                            else:
                                listing = []
                            route.fulfill(status=200, content_type="application/json", body=json.dumps(listing))
                            return

                        if method == "GET" and "/gists/" in url:
                            if not cloud_store["gist_id"] or cloud_store["content"] is None:
                                route.fulfill(status=404, content_type="application/json", body='{"message":"Not Found"}')
                                return
                            if headers_lower.get("if-none-match") == cloud_store["etag"]:
                                route.fulfill(status=304, body="")
                                return
                            file_obj = {
                                "filename": "velofuel-backup.json",
                                "truncated": bool(cloud_store["serve_truncated"]),
                                "raw_url": f"https://gist.githubusercontent.com/testuser/{cloud_store['gist_id']}/raw/velofuel-backup.json",
                                "content": (cloud_store["content"][:40] if cloud_store["serve_truncated"] else cloud_store["content"]),
                            }
                            resp_obj = {
                                "id": cloud_store["gist_id"],
                                "public": False,
                                "description": "VeloFuel Cloud Sync Backup",
                                "updated_at": cloud_store["updated_at"],
                                "files": {"velofuel-backup.json": file_obj},
                            }
                            route.fulfill(
                                status=200,
                                content_type="application/json",
                                headers={"ETag": cloud_store["etag"]},
                                body=json.dumps(resp_obj),
                            )
                            return

                        if method == "POST" and url.rstrip("/").endswith("/gists"):
                            parsed_body = json.loads(body_text)
                            assert parsed_body.get("public") is False, "Cloud backup Gist MUST be private (public: false)!"
                            content = parsed_body["files"]["velofuel-backup.json"]["content"]
                            assert isinstance(content, str) and len(content) > 20, "Gist content must be non-empty JSON"
                            assert "ghp_test_token_pass15" not in content, "GitHub PAT MUST NEVER be uploaded to Gist!"
                            cloud_store["gist_id"] = "gist-pass15-001"
                            cloud_store["content"] = content
                            cloud_store["updated_at"] = "2026-11-24T12:05:00Z"
                            cloud_store["etag"] = f'"etag-{len(cloud_requests)}"'
                            route.fulfill(
                                status=201,
                                content_type="application/json",
                                headers={"ETag": cloud_store["etag"]},
                                body=json.dumps({
                                    "id": cloud_store["gist_id"],
                                    "public": False,
                                    "updated_at": cloud_store["updated_at"],
                                }),
                            )
                            return

                        if method == "PATCH" and "/gists/" in url:
                            parsed_body = json.loads(body_text)
                            content = parsed_body["files"]["velofuel-backup.json"]["content"]
                            assert isinstance(content, str) and len(content) > 20, "PATCH content must be non-empty JSON"
                            assert "ghp_test_token_pass15" not in content, "GitHub PAT MUST NEVER be uploaded to Gist!"
                            cloud_store["content"] = content
                            cloud_store["updated_at"] = "2026-11-24T12:10:00Z"
                            cloud_store["etag"] = f'"etag-{len(cloud_requests)}"'
                            route.fulfill(
                                status=200,
                                content_type="application/json",
                                headers={"ETag": cloud_store["etag"]},
                                body=json.dumps({
                                    "id": cloud_store["gist_id"],
                                    "public": False,
                                    "updated_at": cloud_store["updated_at"],
                                }),
                            )
                            return

                    # Headerless raw_url fetch when truncated === true
                    if "gist.githubusercontent.com" in url:
                        assert "authorization" not in headers_lower, (
                            f"raw_url fetch MUST NOT send Authorization header (CORS trap)! Headers: {headers_lower}"
                        )
                        cloud_store["raw_url_called"] = True
                        route.fulfill(status=200, content_type="text/plain", body=cloud_store["content"] or "{}")
                        return

                    route.abort()

                return handle_gist

            p15.route("https://api.github.com/gists**", make_gist_route_handler())
            p15.route("https://gist.githubusercontent.com/**", make_gist_route_handler())

            p15.goto(URL, wait_until="networkidle")
            p15.get_by_role("button", name="Set Up My Profile (2 min)").click()

            # Step 1: Units & Bottles
            p15.get_by_role("button", name="Mixed (lbs · oz · ml/L)").click()
            p15.get_by_role("group", name="Default ride bottle size").get_by_role("button", name="750 ml").click()
            tab_mg = p15.get_by_label("Electrolyte Tablet Sodium (mg per tab)")
            clear_and_verify_empty(tab_mg, "Onboarding Step 1 Tablet Sodium")
            tab_mg.type("600")
            check_no_jargon(p15, "Onboarding Step 1")
            p15.get_by_role("button", name="Next").click()

            # Step 2: You & Your Goal + Live Preview dynamic update on FTP change
            p15.get_by_label("Your Name").fill("Alex")
            p15.get_by_label("Sex").select_option("male")
            age_in = p15.get_by_label("Age")
            clear_and_verify_empty(age_in, "Onboarding Step 2 Age")
            age_in.type("36")
            ht_in = p15.get_by_label("Height (cm)")
            clear_and_verify_empty(ht_in, "Onboarding Step 2 Height")
            ht_in.type("181")
            wt_in = p15.get_by_label("Current Weight (lbs)")
            clear_and_verify_empty(wt_in, "Onboarding Step 2 Weight")
            wt_in.type("165")
            bf_in = p15.get_by_label("Body Fat % (Optional)")
            clear_and_verify_empty(bf_in, "Onboarding Step 2 Body Fat")
            bf_in.type("13.5")
            ftp_in = p15.get_by_label("Cycling FTP (Watts)")
            clear_and_verify_empty(ftp_in, "Onboarding Step 2 FTP")
            ftp_in.type("280")
            p15.get_by_label("Off-Bike Day Job").select_option("light")
            p15.get_by_role("button", name="Smart Fat-Loss Cut").click()

            preview_card = p15.locator(".live-preview-card")
            assert preview_card.get_by_text("Rest Day", exact=True).is_visible()
            assert preview_card.get_by_text("Hard Ride Day (90m)", exact=True).is_visible()
            hard_kcal_280 = int(
                preview_card.locator(".live-preview-col.highlight .live-preview-kcal")
                .inner_text()
                .replace("kcal", "")
                .replace(",", "")
                .strip()
            )
            clear_and_verify_empty(ftp_in, "Onboarding Step 2 FTP live update")
            ftp_in.type("310")
            hard_kcal_310 = int(
                preview_card.locator(".live-preview-col.highlight .live-preview-kcal")
                .inner_text()
                .replace("kcal", "")
                .replace(",", "")
                .strip()
            )
            assert hard_kcal_310 > hard_kcal_280, (
                f"Live Preview Hard Ride Day kcal must rise with FTP ({hard_kcal_280} -> {hard_kcal_310})"
            )
            check_no_jargon(p15, "Onboarding Step 2")
            p15.get_by_role("button", name="Next").click()

            # Step 3: Live Intervals.icu Test & Pull inside Onboarding
            today_iso_15 = p15.evaluate(
                "(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()"
            )
            tmrw_iso_15 = p15.evaluate(
                "(() => { const d = new Date(); d.setDate(d.getDate()+1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()"
            )

            def handle_icu_pass15(route):
                url = route.request.url
                if "/activities" in url:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=f'[{{"id": 5101, "name": "Morning Endurance Spin", "type": "Ride", "start_date_local": "{today_iso_15}T07:00:00", "moving_time": 5400, "icu_joules": 1180000, "icu_training_load": 82}}]',
                    )
                elif "/events" in url:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=f'[{{"id": 5202, "name": "Tempo Intervals", "type": "Ride", "start_date_local": "{tmrw_iso_15}T07:30:00", "moving_time": 4500, "joules": 1020000, "icu_training_load": 78}}]',
                    )
                elif "/wellness" in url:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=f'[{{"id": "{today_iso_15}", "weight": 74.8, "bodyFat": 13.4, "restingHR": 45, "hrv": 82}}]',
                    )
                else:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body='{"name":"Alex","ftp":305,"height":1.82,"sex":"M"}',
                    )

            p15.route("https://intervals.icu/api/v1/athlete/**", handle_icu_pass15)
            p15.get_by_label('Athlete ID (or "0")').fill("0")
            p15.get_by_label("Intervals.icu API Key").fill("test-icu-key-15")
            p15.get_by_role("button", name="Test & Pull My Rides + FTP").click()
            p15.get_by_text("Connected!").wait_for(state="visible", timeout=5000)
            assert p15.get_by_text("FTP 305W").is_visible(), "Expected pulled FTP 305W confirmation in Step 3"
            check_no_jargon(p15, "Onboarding Step 3")
            p15.get_by_role("button", name="Next").click()

            # Step 4: Routine, Sweat Rate & Supplements
            p15.get_by_role("button", name="5 Meals / 2 Snacks").click()
            p15.get_by_role("group", name="Usual workout time").get_by_role("button", name="Morning").click()
            p15.get_by_role("group", name="Default sweat rate").get_by_role("button", name="Heavy").click()
            p15.get_by_label("Daily Multivitamin").uncheck()
            p15.get_by_label("Vitamin D3 (2000 IU)").check()
            p15.get_by_label("Magnesium Glycinate").check()
            check_no_jargon(p15, "Onboarding Step 4")
            p15.get_by_role("button", name="Next").click()

            # Step 5: Lock In Sustaining Cloud Backup & Launch
            p15.get_by_label("GitHub Personal Access Token (Stays on this device)").fill("ghp_test_token_pass15")
            p15.get_by_role("button", name="Connect & Back Up Now").click()
            p15.get_by_text("Cloud Backup Active ✓").wait_for(state="visible", timeout=5000)
            check_no_jargon(p15, "Onboarding Step 5")
            p15.get_by_role("button", name="Launch My VeloFuel").click()

            # Verify clean real-user dashboard
            p15.locator(".hero-ring-wrap svg").wait_for(state="visible", timeout=5000)
            p15.wait_for_timeout(300)
            assert p15.locator(".meal-slot.training-card", has_text="Morning Endurance Spin").is_visible(), (
                "Expected real Intervals ride on Today"
            )
            assert p15.locator(".planned-macro-grid").count() == 5, "Expected 5 meal slots from Step 4 template"
            assert p15.get_by_text("Threshold 3×15m").count() == 0, "Fake demo ride MUST NOT appear!"
            sweat_group = p15.get_by_role("group", name="Ride sweat rate")
            heavy_cls = sweat_group.get_by_role("button", name="Heavy").get_attribute("class") or ""
            assert "chip-active" in heavy_cls, (
                f"Expected Heavy default sweat rate active on ride card, got class={heavy_cls!r}"
            )

            ls_raw_15 = p15.evaluate("() => localStorage.getItem('velofuel_state_v1')")
            assert ls_raw_15 and "ghp_test_token_pass15" not in ls_raw_15, "GitHub PAT MUST NEVER be stored in velofuel_state_v1!"
            st15 = json.loads(ls_raw_15)
            assert st15["profile"]["ftp"] == 305, f"Expected FTP 305, got {st15['profile']['ftp']}"
            assert st15["profile"]["name"] == "Alex"
            assert st15["onboardingCompleted"] is True and st15["isDemoMode"] is False and st15["hasUserData"] is True
            assert not any(str(s.get("id", "")).startswith("sess-") for s in st15["sessions"]), "Zero sess-* demo rides allowed"
            assert not any(b.get("source") == "withings-sample" for b in st15["biometrics"]), "Zero withings-sample rows allowed"

            # Reload and verify returning user skips Welcome and zero demo data resurrects
            p15.reload(wait_until="networkidle")
            p15.locator(".meal-slot.training-card", has_text="Morning Endurance Spin").wait_for(state="visible", timeout=5000)
            assert p15.get_by_role("button", name="Set Up My Profile (2 min)").count() == 0, "Returning user must skip Welcome"
            assert p15.get_by_text("Threshold 3×15m").count() == 0
            print("PASS 15: Full 5-Step Real-User Onboarding Wizard + live Intervals.icu pull + clean zero-demo launch verified")

            # =====================================================================
            # 16. v12: IndexedDB Auto-Recovery After localStorage.clear()
            # =====================================================================
            nav15 = p15.get_by_role("navigation", name="Main navigation")
            p15.locator(".meal-slot[data-slot='lunch']").get_by_role("button", name="Scan / Type").click()
            qf16 = p15.get_by_role("dialog", name="Scan or Add Food")
            qf16.get_by_role("tab", name="Quick Add").click()
            qf16.get_by_label("Label (optional)").fill("Recovery Burrito")
            qf16.get_by_label("Carbs (g)").type("65")
            qf16.get_by_label("Protein (g)").type("35")
            qf16.get_by_label("Fat (g)").type("14")
            qf16.get_by_role("button", name="Log Quick Add (526 kcal)").click()
            assert p15.locator(".meal-slot[data-slot='lunch']").get_by_text("Recovery Burrito").is_visible()

            nav15.get_by_role("button", name="Body").click()
            bw16 = p15.get_by_label("Weight (lbs)")
            clear_and_verify_empty(bw16, "PASS 16 Body Weight")
            bw16.type("164.5")
            p15.get_by_role("button", name="Save Weigh-In").click()
            nav15.get_by_role("button", name="Today").click()

            # Wait briefly for async IndexedDB mirror, then wipe localStorage completely!
            p15.wait_for_timeout(600)
            idb_ok = p15.evaluate(
                """() => new Promise((resolve) => {
                    const req = indexedDB.open('velofuel_durable_db', 1);
                    req.onsuccess = () => {
                        const db = req.result;
                        const tx = db.transaction('current', 'readonly');
                        const getReq = tx.objectStore('current').get('latest');
                        getReq.onsuccess = () => { db.close(); resolve(Boolean(getReq.result && getReq.result.payload)); };
                        getReq.onerror = () => { db.close(); resolve(false); };
                    };
                    req.onerror = () => resolve(false);
                })"""
            )
            assert idb_ok, "Expected velofuel_durable_db IndexedDB to hold mirrored current state!"

            p15.evaluate("() => localStorage.clear()")
            assert p15.evaluate("() => localStorage.getItem('velofuel_state_v1')") is None

            p15.reload(wait_until="networkidle")
            p15.get_by_text("Restored your saved data from durable device storage.").wait_for(state="visible", timeout=5000)
            assert p15.get_by_role("button", name="Set Up My Profile (2 min)").count() == 0, "Recovery must skip Welcome"
            assert p15.locator(".meal-slot[data-slot='lunch']").get_by_text("Recovery Burrito").is_visible(), (
                "Recovery Burrito must be restored from IndexedDB!"
            )
            repaired_ls = p15.evaluate("() => localStorage.getItem('velofuel_state_v1')")
            assert repaired_ls and "Recovery Burrito" in repaired_ls and '"ftp":305' in repaired_ls.replace(" ", "")
            print("PASS 16: IndexedDB auto-recovery after localStorage.clear() restored 100% of logged meals, weigh-ins & profile")

            # =====================================================================
            # 17. v12: Cloud Sync Push + Fresh-Device Restore + Never-Clobber Guard + Truncated raw_url
            # =====================================================================
            nav15.get_by_role("button", name="Sync").click()
            req_count_before_paste = len(cloud_requests)
            p15.get_by_label("GitHub Personal Access Token (Device-only)").fill("ghp_test_token_pass15")
            # Regression: Pasting a PAT in Sync tab without clicking Sync Now must NOT auto-push after 2.8s!
            p15.wait_for_timeout(2800)
            paste_only_reqs = cloud_requests[req_count_before_paste:]
            assert len(paste_only_reqs) == 0, (
                f"Expected 0 cloud requests after merely pasting PAT without clicking Sync Now, got: {paste_only_reqs}"
            )
            # Explicitly establish cloud link via Sync Now, then verify debounced auto-push on new meal
            p15.get_by_role("button", name="Sync Now", exact=True).click()
            p15.locator(".sync-status-pill").get_by_text("Cloud Synced ✓").wait_for(
                state="visible", timeout=5000
            )
            nav15.get_by_role("button", name="Today").click()

            p15.locator(".meal-slot[data-slot='dinner']").get_by_role("button", name="Scan / Type").click()
            qf17 = p15.get_by_role("dialog", name="Scan or Add Food")
            qf17.get_by_role("tab", name="Quick Add").click()
            qf17.get_by_label("Label (optional)").fill("Cloud Sync Pasta")
            qf17.get_by_label("Carbs (g)").type("90")
            qf17.get_by_label("Protein (g)").type("32")
            qf17.get_by_label("Fat (g)").type("10")
            qf17.get_by_role("button", name="Log Quick Add (578 kcal)").click()
            assert p15.locator(".meal-slot[data-slot='dinner']").get_by_text("Cloud Sync Pasta").is_visible()

            # Wait for 2.5s debounced auto-push to update private cloud gist
            p15.wait_for_timeout(3300)
            assert cloud_store["content"] and "Cloud Sync Pasta" in cloud_store["content"], (
                "Expected debounced Cloud Sync PATCH to push 'Cloud Sync Pasta'!"
            )
            assert "ghp_test_token_pass15" not in cloud_store["content"], "PAT must NEVER appear in cloud gist payload"
            assert p15.locator(".sync-status-pill").get_by_text("Cloud Synced ✓").is_visible(), (
                "Expected top-bar badge to show 'Cloud Synced ✓'"
            )

            # Regression: Re-running Setup Wizard from Sync tab preserves existing real Intervals.icu sessions when Step 3 is skipped
            nav15.get_by_role("button", name="Sync").click()
            p15.get_by_role("button", name="Run Setup Wizard / Reset to Clean Real Profile").click()
            for _ in range(4):
                p15.get_by_role("button", name="Next").click()
            p15.get_by_role("button", name="Launch My VeloFuel").click()
            p15.locator(".hero-ring-wrap svg").wait_for(state="visible", timeout=5000)
            p15.wait_for_timeout(300)
            assert p15.locator(".meal-slot.training-card", has_text="Morning Endurance Spin").is_visible(), (
                "Expected existing real Intervals.icu session to be preserved when re-running Setup Wizard without re-pulling Step 3!"
            )
            assert p15.locator(".meal-slot[data-slot='dinner']").get_by_text("Cloud Sync Pasta").is_visible(), (
                "Expected existing real logged meal to be preserved when re-running Setup Wizard!"
            )
            ctx15.close()

            # Device 2: Brand-new wiped browser context (empty localStorage + empty IndexedDB) + truncated: true test!
            cloud_store["serve_truncated"] = True
            cloud_store["raw_url_called"] = False
            req_count_before_dev2 = len(cloud_requests)

            ctx17 = browser.new_context(viewport={"width": 390, "height": 844})
            p17 = ctx17.new_page()
            p17.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            p17.on("pageerror", lambda err: page_errors.append(str(err)))
            p17.route("https://api.github.com/gists**", make_gist_route_handler())
            p17.route("https://gist.githubusercontent.com/**", make_gist_route_handler())

            p17.goto(URL, wait_until="networkidle")
            p17.get_by_role("button", name="Restore from Cloud Backup").wait_for(state="visible", timeout=5000)
            assert p17.get_by_role("button", name="Restore from Cloud Backup").is_visible(), (
                "Wiped Device 2 must show Welcome screen!"
            )
            dev2_mutations_before_restore = [
                r for r in cloud_requests[req_count_before_dev2:] if r["method"] in ("POST", "PATCH")
            ]
            assert len(dev2_mutations_before_restore) == 0, (
                f"Never-Clobber Guard #1 violated! Fired mutations on fresh browser: {dev2_mutations_before_restore}"
            )

            p17.get_by_role("button", name="Restore from Cloud Backup").click()
            p17.get_by_label("GitHub Personal Access Token").fill("ghp_test_token_pass15")
            p17.get_by_role("button", name="Find & Restore My Backup").click()

            p17.locator(".meal-slot[data-slot='dinner']").get_by_text("Cloud Sync Pasta").wait_for(
                state="visible", timeout=5000
            )
            assert cloud_store["raw_url_called"] is True, "Expected headerless raw_url fallback when truncated: true!"
            assert p17.locator(".planned-macro-grid").count() == 5, "Expected 5-meal template restored from cloud!"
            assert p17.locator(".sync-status-pill").get_by_text("Cloud Synced ✓").is_visible()

            # Wait 3.2s and confirm zero clobbering PATCH overwrote cloud data (Never-Clobber #2!)
            p17.wait_for_timeout(3200)
            assert "Cloud Sync Pasta" in (cloud_store["content"] or ""), (
                "Never-Clobber Guard #2 violated: cloud backup lost 'Cloud Sync Pasta'!"
            )
            check_no_jargon(p17, "PASS 17 Cloud Restore dashboard")
            print("PASS 17: Cloud Sync debounced push, PAT paste non-auto-push, wizard re-run Intervals preservation, fresh-device restore, Never-Clobber guard & truncated raw_url verified")

            # =====================================================================
            # 18. v12: Local Daily Snapshots Recovery UI in Sync Tab
            # =====================================================================
            nav17 = p17.get_by_role("navigation", name="Main navigation")
            nav17.get_by_role("button", name="Sync").click()
            p17.get_by_role("button", name="View Local Snapshots (Last 14 Days)").click()
            snap_region = p17.get_by_role("region", name="Local Daily Snapshots")
            assert snap_region.is_visible(), "Expected Local Daily Snapshots drawer to open"
            assert snap_region.locator(".snapshot-row").count() >= 1, "Expected at least today's snapshot row"

            # Seed a distinct prior-day snapshot containing "Snapshot Oatmeal" into IndexedDB snapshots store
            p17.evaluate(
                """() => new Promise((resolve, reject) => {
                    const st = JSON.parse(localStorage.getItem('velofuel_state_v1'));
                    const d = new Date();
                    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    const snapPayload = JSON.parse(JSON.stringify(st));
                    snapPayload.logsByDate[today] = [{
                        id: 'snap-oatmeal-18',
                        slot: 'breakfast',
                        type: 'quick_add',
                        title: 'Snapshot Oatmeal',
                        detail: 'Quick macros',
                        carbs: 62,
                        protein: 18,
                        fat: 8,
                        kcal: 392,
                        uncertaintyPct: 0,
                        micros: { fiber: 8, iron: 3, vitC: 5, calcium: 180, vitD: 1, magnesium: 95, sodium: 120 },
                        loggedAt: '07:30'
                    }];
                    const req = indexedDB.open('velofuel_durable_db', 1);
                    req.onsuccess = () => {
                        const db = req.result;
                        const tx = db.transaction('snapshots', 'readwrite');
                        tx.objectStore('snapshots').put({
                            date: '2026-11-20',
                            savedAt: '2026-11-20T08:00:00Z',
                            summary: { loggedMeals: 1, loggedDays: 1, weighIns: 1, workouts: 1, revision: 2 },
                            payload: snapPayload,
                        });
                        tx.oncomplete = () => { db.close(); resolve(true); };
                        tx.onerror = () => { db.close(); reject(tx.error); };
                    };
                    req.onerror = () => reject(req.error);
                })"""
            )
            # Toggle snapshots drawer closed & open to refresh list, then click 1-tap Restore
            p17.get_by_role("button", name="View Local Snapshots (Last 14 Days)").click()
            p17.get_by_role("button", name="View Local Snapshots (Last 14 Days)").click()
            restore_snap_btn = p17.get_by_role("button", name="Restore snapshot 2026-11-20")
            restore_snap_btn.wait_for(state="visible", timeout=5000)
            restore_snap_btn.click()
            p17.get_by_text("Restored local snapshot from 2026-11-20!").wait_for(state="visible", timeout=5000)

            nav17.get_by_role("button", name="Today").click()
            assert p17.locator(".meal-slot[data-slot='breakfast']").get_by_text("Snapshot Oatmeal").is_visible(), (
                "Expected 'Snapshot Oatmeal' restored on Today from Local Daily Snapshots!"
            )
            check_no_jargon(p17, "PASS 18 Local Daily Snapshots recovery")
            print("PASS 18: Local Daily Snapshots Recovery UI verified (list + 1-tap restore)")
            ctx17.close()

            # =====================================================================
            # 19. v12 Regression Guards: 401 Skip Cloud & Launch, Step 5 Rev-1 Never-Clobber, Demo Mode Sync Now
            # =====================================================================
            # 19A: Step 3 Intervals 401 + Step 5 GitHub 401 + Skip Cloud & Launch must NOT persist rejected credentials
            ctx19a = browser.new_context(viewport={"width": 390, "height": 844})
            p19a = ctx19a.new_page()
            # Ignore ONLY Chromium's native network resource log for intentional 401 mock responses
            p19a.on(
                "console",
                lambda msg: console_errors.append(msg.text)
                if msg.type == "error" and "status of 401" not in msg.text
                else None,
            )
            p19a.on("pageerror", lambda err: page_errors.append(str(err)))
            req19a_icu = []
            req19a_gh = []
            p19a.route(
                "https://intervals.icu/api/v1/athlete/**",
                lambda route: (
                    req19a_icu.append(route.request.url),
                    route.fulfill(status=401, content_type="application/json", body='{"error":"Unauthorized"}'),
                ),
            )
            p19a.route(
                "https://api.github.com/gists**",
                lambda route: (
                    req19a_gh.append(f"{route.request.method} {route.request.url}"),
                    route.fulfill(status=401, content_type="application/json", body='{"message":"Bad credentials"}'),
                ),
            )
            p19a.goto(URL, wait_until="networkidle")
            p19a.get_by_role("button", name="Set Up My Profile (2 min)").click()
            p19a.get_by_role("button", name="Next").click()  # Step 1 -> 2
            p19a.get_by_role("button", name="Next").click()  # Step 2 -> 3
            p19a.get_by_label("Intervals.icu API Key").fill("invalid-icu-key-401")
            p19a.get_by_role("button", name="Test & Pull My Rides + FTP").click()
            p19a.get_by_text("Intervals.icu rejected your credentials").wait_for(state="visible", timeout=5000)
            p19a.get_by_role("button", name="Next").click()  # Step 3 -> 4
            p19a.get_by_role("button", name="Next").click()  # Step 4 -> 5
            p19a.get_by_label("GitHub Personal Access Token (Stays on this device)").fill("ghp_invalid_401_token")
            p19a.get_by_role("button", name="Connect & Back Up Now").click()
            p19a.get_by_text("GitHub token expired or invalid").wait_for(state="visible", timeout=5000)

            gh_count_before_skip = len(req19a_gh)
            icu_count_before_skip = len(req19a_icu)
            p19a.get_by_role("button", name="Skip Cloud & Launch").click()
            p19a.locator(".hero-ring-wrap svg").wait_for(state="visible", timeout=5000)
            p19a.wait_for_timeout(800)

            assert p19a.locator(".sync-status-pill").get_by_text("Saved locally").is_visible(), (
                "Skip Cloud & Launch after 401 MUST stay 'Saved locally' (never 'Sync Error')!"
            )
            cfg19a_raw = p19a.evaluate("() => localStorage.getItem('velofuel_cloud_config_v1')")
            cfg19a = json.loads(cfg19a_raw) if cfg19a_raw else {}
            assert not cfg19a.get("githubToken"), f"Rejected GitHub PAT must NOT be saved: {cfg19a}"
            st19a = json.loads(p19a.evaluate("() => localStorage.getItem('velofuel_state_v1')"))
            assert st19a["intervalsConfig"]["apiKey"] == "", (
                f"Rejected Intervals API key must NOT be saved: {st19a['intervalsConfig']}"
            )
            assert st19a["intervalsConfig"]["autoSync"] is False
            assert len(req19a_gh) == gh_count_before_skip, "Zero extra GitHub requests allowed after Skip Cloud & Launch"
            assert len(req19a_icu) == icu_count_before_skip, "Zero extra Intervals requests allowed after 401 skip"
            ctx19a.close()

            # 19B: Fresh Step 5 encountering an existing revision: 1 cloud backup must NEVER clobber it on Launch!
            ctx19b = browser.new_context(viewport={"width": 390, "height": 844})
            p19b = ctx19b.new_page()
            p19b.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            p19b.on("pageerror", lambda err: page_errors.append(str(err)))
            rev1_backup_payload = json.dumps({
                "schemaVersion": 2,
                "updatedAt": "2026-11-23T10:00:00Z",
                "revision": 1,
                "onboardingCompleted": True,
                "isDemoMode": False,
                "hasUserData": True,
                "profile": {"name": "ExistingUser"},
                "logsByDate": {"2026-11-23": [{"id": "prot-1", "slot": "breakfast", "title": "Protected Rev1 Meal", "carbs": 50, "protein": 20, "fat": 8, "kcal": 352}]},
                "sessions": [],
                "biometrics": [],
            })
            rev1_mutations = []

            def handle_rev1_gist(route):
                req = route.request
                if req.method in ("POST", "PATCH"):
                    rev1_mutations.append(f"{req.method} {req.url}")
                    route.fulfill(status=200, content_type="application/json", body='{"id":"gist-rev1"}')
                    return
                if "/gists/gist-rev1" in req.url:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        headers={"ETag": '"etag-rev1"'},
                        body=json.dumps({
                            "id": "gist-rev1",
                            "public": False,
                            "description": "VeloFuel Cloud Sync Backup",
                            "updated_at": "2026-11-23T10:00:00Z",
                            "files": {
                                "velofuel-backup.json": {
                                    "filename": "velofuel-backup.json",
                                    "truncated": False,
                                    "content": rev1_backup_payload,
                                }
                            },
                        }),
                    )
                    return
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps([{
                        "id": "gist-rev1",
                        "public": False,
                        "description": "VeloFuel Cloud Sync Backup",
                        "updated_at": "2026-11-23T10:00:00Z",
                        "files": {"velofuel-backup.json": {"filename": "velofuel-backup.json"}},
                    }]),
                )

            p19b.route("https://api.github.com/gists**", handle_rev1_gist)
            p19b.goto(URL, wait_until="networkidle")
            p19b.get_by_role("button", name="Set Up My Profile (2 min)").click()
            for _ in range(4):
                p19b.get_by_role("button", name="Next").click()
            p19b.get_by_label("GitHub Personal Access Token (Stays on this device)").fill("ghp_existing_rev1_tok")
            p19b.get_by_role("button", name="Connect & Back Up Now").click()
            p19b.get_by_text("Existing Cloud Backup Found!").wait_for(state="visible", timeout=5000)

            cfg19b_before = p19b.evaluate("() => localStorage.getItem('velofuel_cloud_config_v1')")
            assert not cfg19b_before or not json.loads(cfg19b_before).get("githubToken"), (
                f"existingCloudOffer must NOT eagerly persist cloud config before user clicks Restore: {cfg19b_before}"
            )

            p19b.get_by_role("button", name="Launch My VeloFuel").click()
            p19b.locator(".hero-ring-wrap svg").wait_for(state="visible", timeout=5000)
            p19b.wait_for_timeout(3000)
            assert len(rev1_mutations) == 0, (
                f"Never-Clobber Guard violated: fresh Step 5 Launch clobbered existing rev-1 cloud gist: {rev1_mutations}"
            )
            assert p19b.locator(".sync-status-pill").get_by_text("Saved locally").is_visible()
            ctx19b.close()

            # 19C: Demo Mode Sync Now with no remote gist stays 'Saved locally' (never 'Cloud Synced ✓')
            ctx19c = browser.new_context(viewport={"width": 390, "height": 844})
            p19c = ctx19c.new_page()
            p19c.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            p19c.on("pageerror", lambda err: page_errors.append(str(err)))
            demo_mutations = []

            def handle_empty_gist(route):
                if route.request.method in ("POST", "PATCH"):
                    demo_mutations.append(route.request.method)
                route.fulfill(status=200, content_type="application/json", body="[]")

            p19c.route("https://api.github.com/gists**", handle_empty_gist)
            p19c.goto(URL, wait_until="networkidle")
            p19c.get_by_role("button", name="Explore with Demo Data").click()
            p19c.locator(".hero-ring-wrap svg").wait_for(state="visible", timeout=5000)
            p19c.get_by_role("navigation", name="Main navigation").get_by_role("button", name="Sync").click()
            p19c.get_by_label("GitHub Personal Access Token (Device-only)").fill("ghp_demo_mode_tok")
            p19c.get_by_role("button", name="Sync Now", exact=True).click()
            p19c.get_by_text("Demo Mode data isn't uploaded to cloud").wait_for(state="visible", timeout=5000)
            assert p19c.locator(".sync-status-pill").get_by_text("Saved locally").is_visible(), (
                "Demo Mode Sync Now with no remote gist must stay 'Saved locally' (never 'Cloud Synced ✓')!"
            )
            assert len(demo_mutations) == 0, f"Demo Mode must never POST/PATCH to GitHub Gist: {demo_mutations}"
            check_no_jargon(p19c, "PASS 19C Demo Mode Sync Now")
            ctx19c.close()

            # 19D (4A-ADV): Pasting BOTH PAT + existing Backup Gist ID on Sync tab for real user (rev >= 2, lastSyncedAt == "")
            # must fire 0 GitHub requests over 3.0s+, keep 'Saved locally', and Restore from Cloud cleanly with 0 POST/PATCH!
            ctx19d = browser.new_context(viewport={"width": 390, "height": 844})
            p19d = ctx19d.new_page()
            p19d.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            p19d.on("pageerror", lambda err: page_errors.append(str(err)))
            adv_requests = []
            adv_today_holder = {"iso": ""}

            def handle_adv_gist(route):
                req = route.request
                adv_requests.append({"method": req.method, "url": req.url})
                if req.method in ("POST", "PATCH"):
                    route.fulfill(status=200, content_type="application/json", body='{"id":"gist_rev1_offer"}')
                    return
                today_key = adv_today_holder["iso"] or "2026-11-24"
                offer_payload = json.dumps({
                    "schemaVersion": 2,
                    "updatedAt": "2026-11-23T10:00:00Z",
                    "revision": 1,
                    "onboardingCompleted": True,
                    "isDemoMode": False,
                    "hasUserData": True,
                    "profile": {"name": "Cloud Rider", "ftp": 305},
                    "logsByDate": {
                        today_key: [{
                            "id": "adv-oatmeal-1",
                            "slot": "breakfast",
                            "type": "quick_add",
                            "title": "Existing Cloud Oatmeal",
                            "detail": "Quick macros",
                            "carbs": 60,
                            "protein": 20,
                            "fat": 8,
                            "kcal": 392,
                            "uncertaintyPct": 0,
                            "loggedAt": "07:30",
                        }]
                    },
                    "sessions": [],
                    "biometrics": [],
                })
                if "/gists/gist_rev1_offer" in req.url:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        headers={"ETag": '"etag-adv-rev1"'},
                        body=json.dumps({
                            "id": "gist_rev1_offer",
                            "public": False,
                            "description": "VeloFuel Cloud Sync Backup",
                            "updated_at": "2026-11-23T10:00:00Z",
                            "files": {
                                "velofuel-backup.json": {
                                    "filename": "velofuel-backup.json",
                                    "truncated": False,
                                    "content": offer_payload,
                                }
                            },
                        }),
                    )
                    return
                route.fulfill(status=200, content_type="application/json", body="[]")

            p19d.route("https://api.github.com/gists**", handle_adv_gist)
            p19d.goto(URL, wait_until="networkidle")
            p19d.get_by_role("button", name="Set Up My Profile (2 min)").wait_for(state="visible", timeout=5000)
            adv_today_holder["iso"] = p19d.evaluate(
                "() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }"
            )
            p19d.get_by_role("button", name="Set Up My Profile (2 min)").click()
            for _ in range(4):
                p19d.get_by_role("button", name="Next").click()
            p19d.get_by_role("button", name="Skip Cloud & Launch").click()
            p19d.locator(".hero-ring-wrap svg").wait_for(state="visible", timeout=5000)

            nav19d = p19d.get_by_role("navigation", name="Main navigation")
            nav19d.get_by_role("button", name="Sync").click()
            ftp19d = p19d.locator("#prof-ftp")
            clear_and_verify_empty(ftp19d, "PASS 19D FTP")
            ftp19d.type("275")
            p19d.wait_for_timeout(200)
            st19d = json.loads(p19d.evaluate("() => localStorage.getItem('velofuel_state_v1')"))
            assert int(st19d.get("revision", 0)) >= 2, f"Expected local rev >= 2 before 4A-ADV paste, got {st19d.get('revision')}"

            # Paste BOTH PAT and existing rev-1 Backup Gist ID WITHOUT clicking Sync Now or Restore from Cloud
            p19d.locator("#cloud-gh-token").fill("ghp_adv_4a_tok")
            p19d.locator("#cloud-gist-id").fill("gist_rev1_offer")
            p19d.wait_for_timeout(3200)

            assert len(adv_requests) == 0, (
                f"4A-ADV regression violated! Expected 0 GitHub requests after pasting PAT+GistID, got: {adv_requests}"
            )
            assert p19d.locator(".sync-status-pill").get_by_text("Saved locally").is_visible(), (
                "4A-ADV regression violated! Sync pill must remain 'Saved locally' before explicit Sync/Restore!"
            )

            # Now explicitly click Restore from Cloud -> must restore 'Existing Cloud Oatmeal' with 0 POST/PATCH
            p19d.get_by_role("button", name="Restore from Cloud", exact=True).click()
            p19d.locator(".meal-slot[data-slot='breakfast']").get_by_text("Existing Cloud Oatmeal").wait_for(
                state="visible", timeout=5000
            )
            adv_mutations = [r for r in adv_requests if r["method"] in ("POST", "PATCH")]
            assert len(adv_mutations) == 0, f"4A-ADV Restore from Cloud must issue 0 POST/PATCH, got: {adv_mutations}"
            assert p19d.locator(".sync-status-pill").get_by_text("Cloud Synced ✓").is_visible()

            # Editing #cloud-gist-id on an already-synced device must reset lastSyncedAt & pause auto-sync
            nav19d.get_by_role("button", name="Sync").click()
            p19d.locator("#cloud-gist-id").fill("gist_other_backup")
            assert p19d.locator(".sync-status-pill").get_by_text("Saved locally").is_visible(), (
                "Editing #cloud-gist-id on synced device must return status pill to 'Saved locally'!"
            )
            cfg19d_after_edit = json.loads(p19d.evaluate("() => localStorage.getItem('velofuel_cloud_config_v1')"))
            assert cfg19d_after_edit.get("lastSyncedAt") == "", (
                f"Editing #cloud-gist-id must clear lastSyncedAt, got: {cfg19d_after_edit}"
            )
            check_no_jargon(p19d, "PASS 19D 4A-ADV")
            ctx19d.close()
            print("PASS 19: v12 Regression guards verified (401 Skip Cloud & Launch isolation, rev-1 existingCloudOffer Never-Clobber, Demo Mode Sync Now status, 4A-ADV PAT+GistID paste non-auto-push & Restore)")

            # 20. Exiting Demo Mode: Demo Mode bar -> Back to Start Screen & Set Up My Profile
            ctx20 = browser.new_context(viewport={"width": 390, "height": 844})
            p20 = ctx20.new_page()
            p20.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            p20.on("pageerror", lambda err: page_errors.append(str(err)))
            p20.goto(URL, wait_until="networkidle")
            p20.get_by_role("button", name="Explore with Demo Data").click()
            demo_bar = p20.get_by_role("region", name="Demo Mode")
            demo_bar.wait_for(state="visible", timeout=5000)
            assert demo_bar.get_by_role("button", name="Set Up My Profile").is_visible()
            assert demo_bar.get_by_role("button", name="Start Screen").is_visible()

            # Click Start Screen -> returns directly to the first Welcome screen with all 3 choices
            demo_bar.get_by_role("button", name="Start Screen").click()
            p20.get_by_role("button", name="Set Up My Profile (2 min)").wait_for(state="visible", timeout=5000)
            assert p20.get_by_role("button", name="Restore from Cloud Backup").is_visible()
            assert p20.get_by_role("button", name="Explore with Demo Data").is_visible()

            # Re-enter Demo -> click Set Up My Profile directly on the banner -> opens Step 1 of Setup Wizard
            p20.get_by_role("button", name="Explore with Demo Data").click()
            p20.get_by_role("region", name="Demo Mode").get_by_role("button", name="Set Up My Profile").click()
            p20.get_by_text("Step 1 of 5").wait_for(state="visible", timeout=5000)
            check_no_jargon(p20, "PASS 20 Demo Mode Exit")
            ctx20.close()
            print("PASS 20: Demo Mode exit bar verified (Start Screen & direct Set Up My Profile)")

            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)

    assert not console_errors, f"Console errors detected: {console_errors}"
    assert not page_errors, f"Uncaught page errors detected: {page_errors}"
    print("ALL 20 QA SUITES PASSED (0 console errors, 0 page errors)!")


if __name__ == "__main__":
    run_qa()
