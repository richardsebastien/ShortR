from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()

    # Register a new user
    page.goto("http://localhost:3000/register.html")
    page.wait_for_selector('#email')
    page.fill('#email', "test@example.com")
    page.wait_for_selector('#password')
    page.fill('#password', "password123")
    page.wait_for_selector('button')
    page.click('button')
    page.wait_for_url("http://localhost:3000/login.html")

    # Log in
    page.goto("http://localhost:3000/login.html")
    page.wait_for_selector('#email')
    page.fill('#email', "test@example.com")
    page.wait_for_selector('#password')
    page.fill('#password', "password123")
    page.wait_for_selector('button')
    page.click('button')
    page.wait_for_url("http://localhost:3000/dashboard.html")


    # Create a short URL
    page.goto("http://localhost:3000/")
    page.wait_for_selector('input[name="target"]')
    page.fill('input[name="target"]', "https://www.google.com")
    page.wait_for_selector('button[type="submit"]')
    page.click('button[type="submit"]')
    page.wait_for_selector('#result-code')
    code = page.inner_text('#result-code')

    # Go to private stats page
    page.goto(f"http://localhost:3000/private-stats.html#{code}")
    page.wait_for_selector("#map")

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()