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

            # 1. Load Today tab — check remaining macros left, practical sodium, bottle size selector
            page.goto(URL, wait_until="networkidle")
            assert page.get_by_text("VeloFuel").first.is_visible()
            check_no_jargon(page, "Today tab")

            # Verify "g left" macro readouts exist for Carbs, Protein, Fat
            left_count = page.locator(".macro-bar-box").filter(has_text="g left").count()
            assert left_count == 3, f"Expected 3 macro boxes showing 'g left', found {left_count}"

            # Verify practical sodium helper shows table salt / electrolyte tabs
            assert page.get_by_text("table salt").first.is_visible()

            # Per-ride bottle size selector changes bottle count & label
            bottle_group = page.get_by_role("group", name="Ride bottle size")
            bottle_group.get_by_role("button", name="500 ml").click()
            assert page.get_by_text("3× 500 ml").first.is_visible()
            bottle_group.get_by_role("button", name="950 ml").click()
            assert page.get_by_text("2× 950 ml").first.is_visible()
            print("PASS 1: Today hero macros-left, practical sodium helper, and per-ride bottle size selector")

            # 2. 1-Tap Usual Breakfast & Supplements (Daily Stack + Manual Add + Vit C)
            page.get_by_role("button", name="Remove Oats & Berries").click()
            usual_btn = page.get_by_role("button", name="Log Usual Breakfast: Oats & Berries")
            assert usual_btn.is_visible(), "Expected 1-tap Log Usual Breakfast button after clearing breakfast"
            usual_btn.click()
            assert page.get_by_role("button", name="Remove Oats & Berries").is_visible()

            # Log Daily Supplements stack (Iron + Vit C, Multivitamin)
            page.get_by_role("button", name="Log Daily Stack (2)").click()
            assert page.get_by_text("Iron + Vitamin C").first.is_visible()

            # Open Supplements modal, test Backspace-to-empty on Iron, add custom supplement
            page.get_by_role("button", name="Supplements", exact=True).click()
            supp_iron = page.get_by_label("Iron (mg)")
            clear_and_verify_empty(supp_iron, "Supplement Iron input")
            supp_iron.type("15")
            page.get_by_label("Supplement Name").fill("Evening Magnesium")
            page.get_by_role("button", name="Save & Log Supplement Today").click()
            page.get_by_role("dialog", name="Vitamins and Supplements").get_by_role("button", name="Close").click()
            assert page.get_by_text("Evening Magnesium").first.is_visible()
            print("PASS 2: 1-tap usual breakfast + Daily Supplements stack + custom supplement modal")

            # 3. Barcode-first Quick Food + Save logged meal as Reusable Meal + Home Staple Scaler + Work AI + Complete Ride
            page.get_by_role("button", name="Scan / Add").nth(1).click()
            scan_cta = page.get_by_role("button", name="Scan Barcode → Enter Amount (g)")
            assert scan_cta.is_visible(), "Expected primary Scan Barcode CTA in FoodPickerPanel"
            scan_cta.click()
            assert page.get_by_role("dialog", name="Scan Food Barcode").is_visible()
            page.get_by_role("dialog", name="Scan Food Barcode").get_by_role("button", name="Close").click()
            page.get_by_role("button", name="+ Log").first.click()

            # Save that logged lunch item as a reusable meal
            save_reusable = page.get_by_role("button", name="Save Logged Lunch as Reusable Meal")
            assert save_reusable.is_visible(), "Expected 'Save Logged Lunch as Reusable Meal' button"
            save_reusable.click()

            # Home Staple Scaler modal
            page.get_by_role("button", name="Home Staple").first.click()
            scaler_input = page.get_by_label("Rolled Oats (dry) grams")
            clear_and_verify_empty(scaler_input, "StapleScalerModal grams input")
            scaler_input.type("85")
            assert scaler_input.input_value() == "85"
            page.get_by_role("button", name="Log Scaled Home Meal").click()

            # Work Meal AI modal
            page.get_by_role("button", name="Work AI").first.click()
            page.get_by_role("dialog", name="Estimate Work Meal").locator(".chip").first.click()
            page.get_by_role("button", name="Log Work Meal & Auto-Adjust Evening Dinner").click()

            # Complete ride kJ override
            page.get_by_role("button", name="Complete").click()
            kj_inp = page.get_by_label("Actual Power Work (kJ)")
            clear_and_verify_empty(kj_inp, "Actual kJ input")
            kj_inp.type("1750")
            page.get_by_role("button", name="Save & Recalculate Remaining Meals").click()
            assert page.get_by_text("1750 kJ").first.is_visible()
            print("PASS 3: Barcode-first flow, save-as-reusable-meal, scaler, Work AI, and Complete Ride")

            # 4. Staples tab — Edit Oats & Berries, verify Backspace-to-empty, daily pin & plain labels
            nav.get_by_role("button", name="Staples").click()
            check_no_jargon(page, "Staples tab")
            page.get_by_role("button", name="Edit Oats & Berries").click()

            oats_input = page.get_by_label("Rolled Oats (dry) grams")
            clear_and_verify_empty(oats_input, "Oats grams input")
            oats_input.type("60")
            assert oats_input.input_value() == "60", f"Expected '60', got {oats_input.input_value()!r}"

            # Check plain-English portion behavior dropdown
            role_select = page.get_by_label("Rolled Oats (dry) portion behavior")
            options_text = role_select.locator("option").all_inner_texts()
            assert options_text == [
                "Keep same amount",
                "Auto-adjust for ride (Carbs)",
                "Auto-adjust for muscle (Protein)",
            ], f"Unexpected portion labels: {options_text}"

            # Remove Milk freely
            page.get_by_role("button", name="Remove Milk (2% / semi-skimmed)").click()
            assert page.get_by_text("Ingredients (2)").is_visible()

            # Search USDA whole foods & add Banana
            page.get_by_placeholder("Or search foods (oats, berries, skyr, brand...)").fill("banana")
            page.get_by_role("button", name="+ Add").first.click()
            assert page.get_by_text("Ingredients (3)").is_visible()

            # Write Custom Food freely
            page.get_by_role("button", name="Write Custom Food").click()
            page.get_by_label("Food Name").fill("Homemade Granola")
            page.get_by_label("Your Usual Amount (g)").fill("45")
            page.get_by_label("Carbs / 100g").fill("62")
            page.get_by_label("Protein / 100g").fill("11")
            page.get_by_label("Fat / 100g").fill("14")
            page.get_by_role("button", name="Add Custom Food").click()
            assert page.get_by_text("Ingredients (4)").is_visible()

            page.get_by_role("button", name="Save Home Meal (4 items)").click()
            assert page.get_by_text("60g Rolled Oats (dry)").is_visible()
            print("PASS 4: Staples editing, daily pin, Backspace-to-empty, remove/search/custom add")

            # 5. Week tab
            nav.get_by_role("button", name="Week").click()
            check_no_jargon(page, "Week tab")
            page.get_by_role("button", name="Edit").first.click()
            page.get_by_role("button", name="Save & Update Carb Code").click()
            print("PASS 5: Week tab & workout editor")

            # 6. Sync tab — Units (Metric/Imperial/Mixed), Auto-Sync, Direct Withings, NumericInputs
            nav.get_by_role("button", name="Sync").click()
            check_no_jargon(page, "Sync tab")
            assert page.get_by_text("Direct Withings Smart Scale Sync").is_visible()
            assert page.get_by_text("Auto-sync completed workouts & FTP on app open").is_visible()

            tab_inp = page.get_by_label("Electrolyte Tablet Sodium (mg per tab)")
            clear_and_verify_empty(tab_inp, "Electrolyte tab mg input")
            tab_inp.type("750")
            tab_inp.blur()
            assert tab_inp.input_value() == "750"

            ftp_inp = page.get_by_label("FTP (Watts)")
            clear_and_verify_empty(ftp_inp, "FTP input")
            ftp_inp.type("310")
            ftp_inp.blur()
            assert ftp_inp.input_value() == "310"

            ge_inp = page.get_by_label("Riding Efficiency (%)")
            clear_and_verify_empty(ge_inp, "Riding Efficiency input")
            ge_inp.type("23")
            ge_inp.blur()
            assert ge_inp.input_value() == "23"

            # Switch to Mixed Units (lbs weight, oz food, ml/L liquids) and verify across tabs
            page.get_by_role("button", name="Mixed (lbs · oz · ml/L)").click()
            nav.get_by_role("button", name="Body").click()
            check_no_jargon(page, "Body tab (Mixed units)")
            assert page.get_by_text("lbs").first.is_visible(), "Expected lbs on Body tab in Mixed units"
            assert page.locator("svg[aria-label='Morning weight and 7-day trend chart']").is_visible()

            nav.get_by_role("button", name="Staples").click()
            assert page.get_by_text("oz").first.is_visible(), "Expected oz on Staples tab in Mixed units"

            nav.get_by_role("button", name="Today").click()
            assert page.get_by_role("group", name="Ride bottle size").get_by_role("button", name="650 ml").is_visible(), (
                "Expected ml bottles on Today tab in Mixed units"
            )
            print("PASS 6: Sync tab, Mixed Units across Body/Staples/Today, Direct Withings UI, and numeric inputs")

            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)

    assert not console_errors, f"Console errors detected: {console_errors}"
    assert not page_errors, f"Uncaught page errors detected: {page_errors}"
    print("ALL QA CHECKS PASSED (0 console errors, 0 page errors)!")


if __name__ == "__main__":
    run_qa()
