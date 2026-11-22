import subprocess
import sys
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

            # 1. Load Today tab
            page.goto(URL, wait_until="networkidle")
            assert page.get_by_text("VeloFuel").first.is_visible()
            check_no_jargon(page, "Today tab")
            print("PASS 1: Today tab loaded cleanly (zero jargon)")

            # 2. Staples tab — Edit Oats & Berries, verify Backspace-to-empty & plain labels
            page.get_by_role("button", name="Staples").click()
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
            page.get_by_placeholder("Search foods (oats, berries, skyr, brand...)").fill("banana")
            page.get_by_role("button", name="+ Add").first.click()
            assert page.get_by_text("Ingredients (3)").is_visible()

            # Write Custom Food freely
            page.get_by_role("button", name="Write Custom Food").click()
            page.get_by_label("Food Name").fill("Homemade Granola")
            page.get_by_label("Your Usual Grams").fill("45")
            page.get_by_label("Carbs / 100g").fill("62")
            page.get_by_label("Protein / 100g").fill("11")
            page.get_by_label("Fat / 100g").fill("14")
            page.get_by_role("button", name="Add Custom Food").click()
            assert page.get_by_text("Ingredients (4)").is_visible()

            # Save edited meal and verify persistence
            page.get_by_role("button", name="Save Home Meal (4 items)").click()
            assert page.get_by_text("60g Rolled Oats (dry)").is_visible()
            print("PASS 2: Staples editing, Backspace-to-empty, plain dropdown, remove/search/custom add")

            # 3. Today tab — Scale Home Staple, Quick Scan/Add, Work AI, Complete Ride
            nav = page.get_by_role("navigation", name="Main navigation")
            nav.get_by_role("button", name="Today").click()
            page.get_by_role("button", name="Home Staple").first.click()
            scaler_input = page.get_by_label("Rolled Oats (dry) grams")
            clear_and_verify_empty(scaler_input, "StapleScalerModal grams input")
            scaler_input.type("85")
            assert scaler_input.input_value() == "85"
            page.get_by_role("button", name="Log Scaled Home Meal").click()

            # Quick Scan / Add modal
            page.get_by_role("button", name="Scan / Add").first.click()
            page.get_by_role("button", name="Scan", exact=True).click()
            assert page.get_by_text("Scan Barcode").is_visible()
            page.get_by_role("dialog", name="Scan Food Barcode").get_by_role("button", name="Close").click()
            page.get_by_role("button", name="+ Log").first.click()

            # Work Meal AI modal
            page.get_by_role("button", name="Work AI").first.click()
            page.locator(".chip").first.click()
            page.get_by_role("button", name="Log Work Meal & Auto-Adjust Evening Dinner").click()

            # Complete ride kJ override
            page.get_by_role("button", name="Complete").click()
            kj_inp = page.get_by_label("Actual Power Work (kJ)")
            clear_and_verify_empty(kj_inp, "Actual kJ input")
            kj_inp.type("1750")
            page.get_by_role("button", name="Save & Recalculate Remaining Meals").click()
            assert page.get_by_text("1750 kJ").first.is_visible()
            print("PASS 3: Today Home Staple scaler, Barcode modal, Quick Add, Work AI, and Complete Ride")

            # 4. Week tab
            nav.get_by_role("button", name="Week").click()
            check_no_jargon(page, "Week tab")
            page.get_by_role("button", name="Edit").first.click()
            page.get_by_role("button", name="Save & Update Carb Code").click()
            print("PASS 4: Week tab & workout editor")

            # 5. Body tab
            nav.get_by_role("button", name="Body").click()
            check_no_jargon(page, "Body tab")
            page.get_by_role("button", name="Maintain").click()
            page.get_by_role("button", name="Carb Load").click()
            page.get_by_role("button", name="Lean Cut").click()
            assert page.locator("svg[aria-label='Morning weight and 7-day trend chart']").is_visible()
            print("PASS 5: Body tab, goal modes, and SVG weight trend chart")

            # 6. Sync tab — test NumericInput Backspace on FTP & Riding Efficiency
            nav.get_by_role("button", name="Sync").click()
            check_no_jargon(page, "Sync tab")
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
            print("PASS 6: Sync tab numeric inputs (FTP & Riding Efficiency Backspace + save)")

            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)

    assert not console_errors, f"Console errors detected: {console_errors}"
    assert not page_errors, f"Uncaught page errors detected: {page_errors}"
    print("ALL QA CHECKS PASSED (0 console errors, 0 page errors)!")


if __name__ == "__main__":
    run_qa()
