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

            # 1. Load Today tab — verify NO meals listed by default, modern hero ring, prominent planned numbers
            page.goto(URL, wait_until="networkidle")
            assert page.get_by_text("VeloFuel").first.is_visible()
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
            print("PASS 1: Empty default meals, modern hero ring, prominent planned numbers, and default bottle size")

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
            search_box = quick_dialog.get_by_placeholder("Search foods or brands (Chobani, Clif, oats, Maurten...)")
            search_box.fill("Nature Valley")
            quick_dialog.get_by_role("button", name='Search USDA & brands for "Nature Valley"').click()
            quick_dialog.get_by_text("Online Database (").wait_for(state="visible", timeout=10000)
            assert quick_dialog.locator("button:has-text('+ Log')").count() >= 1, "Expected online USDA/OFF brand results for Nature Valley"

            # Log the first online brand result!
            quick_dialog.locator("button:has-text('+ Log')").first.click()

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

            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)

    assert not console_errors, f"Console errors detected: {console_errors}"
    assert not page_errors, f"Uncaught page errors detected: {page_errors}"
    print("ALL 14 QA SUITES PASSED (0 console errors, 0 page errors)!")


if __name__ == "__main__":
    run_qa()
