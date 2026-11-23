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
            nav.get_by_role("button", name="Today").click()
            print("PASS 1: Empty default meals, modern hero ring, prominent planned numbers, and default bottle size")

            # 2. Training card placement selector + Up/Down + Drag-and-Drop reordering between meals
            placement = page.get_by_label("Workout placement:")
            placement.select_option("0")  # Before Breakfast
            assert page.locator(".meal-slot").nth(0).get_attribute("data-slot") == "on_bike"

            page.get_by_role("button", name="Move Training down").click()
            assert page.locator(".meal-slot").nth(1).get_attribute("data-slot") == "on_bike"

            # HTML5 Drag-and-Drop training card via drag handle onto lunch card
            page.locator(".meal-slot[data-slot='on_bike'] .drag-handle").drag_to(page.locator(".meal-slot[data-slot='lunch']"))
            assert page.locator(".meal-slot").nth(2).get_attribute("data-slot") == "on_bike"
            print("PASS 2: Training card placement dropdown, Up/Down controls, and Drag-and-Drop reordering")

            # 3. Suggested Meal option + Daily Supplements stack + custom supplement modal
            page.locator(".meal-slot[data-slot='breakfast']").get_by_role("button", name="Suggested Meal").click()
            assert page.get_by_text("Oats & Berries").first.is_visible()
            page.get_by_role("button", name="Log Suggested").click()
            assert page.locator(".meal-slot[data-slot='breakfast'] .logged-item").count() == 1

            page.get_by_role("button", name="Log Daily Stack (2)").click()
            assert page.get_by_text("Iron + Vitamin C").first.is_visible()

            page.get_by_role("button", name="Supplements", exact=True).click()
            supp_iron = page.get_by_label("Iron (mg)")
            clear_and_verify_empty(supp_iron, "Supplement Iron input")
            supp_iron.type("15")
            page.get_by_label("Supplement Name").fill("Evening Magnesium")
            page.get_by_role("button", name="Save & Log Supplement Today").click()
            page.get_by_role("dialog", name="Vitamins and Supplements").get_by_role("button", name="Close").click()
            assert page.get_by_text("Evening Magnesium").first.is_visible()
            print("PASS 3: Suggested Meal drawer + Daily Supplements stack + custom supplement modal")

            # 4. Scan / Type + Save as Reusable + Work Meal accurate estimation & editable macros
            page.locator(".meal-slot[data-slot='lunch']").get_by_role("button", name="Scan / Type").click()
            scan_cta = page.get_by_role("button", name="Scan Barcode → Enter Amount (g)")
            assert scan_cta.is_visible()
            scan_cta.click()
            assert page.get_by_role("dialog", name="Scan Food Barcode").is_visible()
            page.get_by_role("dialog", name="Scan Food Barcode").get_by_role("button", name="Close").click()
            page.get_by_role("button", name="+ Log").first.click()

            save_reusable = page.get_by_role("button", name="Save Logged Lunch as Reusable Meal")
            assert save_reusable.is_visible()
            save_reusable.click()

            # Test Work Meal Estimator with real custom text (compound dish + explicit grams, verify no double counting + editable macros!)
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
            print("PASS 4: Scan/Type, Save-as-Reusable, accurate & editable Work Meal estimator (zero double-count), and Saved Meal scaler")

            # 5. Actual Ride Fuel (Carbs + Protein + Fat + inline Barcode Scan) + Complete Ride
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

            # Complete ride kJ + actual carbs
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
            print("PASS 5: Modifiable actual ride C/P/F + barcode scan + Complete Ride recalculation")

            # 6. Staples, Week, Body, Sync + Mixed Units
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
            print("PASS 6: Staples, Week, Sync, Mixed Units, and Body tab verified")

            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)

    assert not console_errors, f"Console errors detected: {console_errors}"
    assert not page_errors, f"Uncaught page errors detected: {page_errors}"
    print("ALL QA CHECKS PASSED (0 console errors, 0 page errors)!")


if __name__ == "__main__":
    run_qa()
