// This is a test script to validate Puppeteer can access albumoftheyear.org
// Run with: node --experimental-modules src/app/test-scraper.js

import puppeteer from "puppeteer";

async function testScraper() {
  console.log("Starting test scraper...");

  const browser = await puppeteer.launch({
    headless: false, // Use a visible browser for debugging
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1920x1080",
    ],
  });

  try {
    const url = "https://www.albumoftheyear.org/genre/34-ambient/all/";
    console.log(`Navigating to: ${url}`);

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      Connection: "keep-alive",
    });

    // Navigation with longer timeout
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 90000, // 90 seconds
    });

    // Check if we hit Cloudflare
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    // Take a screenshot for verification
    await page.screenshot({ path: "test-screenshot.png" });
    console.log("Screenshot saved to test-screenshot.png");

    // Wait for user to verify (if using headless: false)
    console.log("Waiting 5 seconds for manual verification...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check for album elements
    const albumElements = await page.evaluate(() => {
      const items = document.querySelectorAll(
        ".albumListItem, .albumBlock, .albumGridItem"
      );
      return items.length;
    });

    console.log(`Found ${albumElements} album elements on the page`);

    // List all classes that contain 'album' in their name
    const albumClasses = await page.evaluate(() => {
      const uniqueClasses = new Set();
      document.querySelectorAll("*").forEach((el) => {
        if (el.className && typeof el.className === "string") {
          el.className.split(" ").forEach((cls) => {
            if (cls.toLowerCase().includes("album")) {
              uniqueClasses.add(cls);
            }
          });
        }
      });
      return Array.from(uniqueClasses);
    });

    console.log("Album-related classes found:", albumClasses);

    console.log("Test completed successfully");
  } catch (error) {
    console.error("Error during test:", error);
  } finally {
    // Close the browser
    await browser.close();
    console.log("Browser closed");
  }
}

testScraper().catch(console.error);
