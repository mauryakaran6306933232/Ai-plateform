import asyncio
from playwright.async_api import async_playwright

async def main():
    print("Testing Playwright...")
    try:
        async with async_playwright() as p:
            print("Launching Chromium...")
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox'])
            print("✅ Browser launched!")
            
            page = await browser.new_page()
            print("Navigating to Google...")
            await page.goto("https://www.google.com", timeout=30000)
            title = await page.title()
            print(f"✅ Page title: {title}")
            
            await browser.close()
            print("✅ Test passed! Playwright is working.")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        print("\nTo fix this, run:")
        print("  python -m playwright install chromium")

asyncio.run(main())