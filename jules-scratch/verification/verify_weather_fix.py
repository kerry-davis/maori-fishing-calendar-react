from playwright.sync_api import sync_playwright, expect, TimeoutError

def run(playwright):
    """
    This script verifies that the weather forecast loads correctly after
    selecting a date, setting a location, and scrolling.
    """
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    try:
        # 1. Arrange: Go to the application's homepage.
        page.goto("http://localhost:5173", timeout=30000)

        # 2. Act: Click on a date in the calendar to open the lunar modal.
        expect(page.get_by_role("button", name="15")).to_be_visible(timeout=15000)
        page.get_by_role("button", name="15").click()

        # Wait for the modal to appear
        lunar_modal_body = page.locator("div.lunar-modal-body")
        expect(lunar_modal_body).to_be_visible(timeout=10000)

        # 3. Set a location to trigger the weather fetch.
        location_input = lunar_modal_body.get_by_placeholder("Enter a location")
        location_input.fill("Wellington")
        suggestion_text = "Wellington, Wellington City, Wellington, 6011, New Zealand / Aotearoa"
        suggestion_to_click = page.get_by_text(suggestion_text)
        expect(suggestion_to_click).to_be_visible(timeout=15000)
        suggestion_to_click.click()

        # 4. Assert: Wait for the weather forecast to be visible.
        try:
            # Scroll to the weather forecast section header
            weather_header = lunar_modal_body.get_by_role("heading", name="Weather Forecast")
            weather_header.scroll_into_view_if_needed()
            expect(weather_header).to_be_visible(timeout=5000)

            # Wait for loading text to disappear.
            loading_text = lunar_modal_body.get_by_text("Loading weather...")
            expect(loading_text).to_be_hidden(timeout=15000)

            # Check for the temperature label.
            temperature_label = lunar_modal_body.get_by_text("Temperature:")
            expect(temperature_label).to_be_visible(timeout=5000)

            # 5. Screenshot: Capture the final result for visual verification.
            page.screenshot(path="jules-scratch/verification/verification.png")
            print("Screenshot saved to jules-scratch/verification/verification.png")

        except Exception as e:
            print(f"An exception occurred during assertion: {e}")
            print("Dumping page content:")
            print(page.content())
            page.screenshot(path="jules-scratch/verification/failure.png")
            print("Failure screenshot saved to jules-scratch/verification/failure.png")
            raise

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)