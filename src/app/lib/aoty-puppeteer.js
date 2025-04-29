import puppeteer from "puppeteer";

/**
 * Scrapes Album of the Year using Puppeteer to bypass Cloudflare protection
 * @param {string} url The base URL to scrape
 * @param {number} pages The number of pages to scrape (defaults to 1)
 * @returns {Promise<{ albums: Array<{ rank: number, artist: string, album: string, year: number }> }>}
 */
export async function scrapeAlbumOfTheYearWithPuppeteer(url, pages = 1) {
  console.log("Starting Puppeteer with URL:", url);

  // Validate the URL format
  try {
    new URL(url);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Invalid URL syntax";
    console.error("Invalid URL format:", url, errorMessage);
    throw new Error(`Invalid URL format: ${url} - ${errorMessage}`);
  }

  // Launch browser with more realistic settings
  const browser = await puppeteer.launch({
    headless: false, // Use non-headless mode to better bypass protections
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1920x1080",
      "--disable-features=IsolateOrigins,site-per-process", // Disable site isolation
      "--disable-web-security", // Disable CORS and other web security features
      "--disable-blink-features=AutomationControlled", // Hide automation
      `--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    ],
    ignoreHTTPSErrors: true,
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  });

  let allAlbums = [];

  try {
    const page = await browser.newPage();

    // Configure the page to better mimic a real browser
    await page.evaluateOnNewDocument(() => {
      // Overwrite the navigator properties used for bot detection
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });

      // Create a false plugins array
      Object.defineProperty(navigator, "plugins", {
        get: () => [
          {
            0: {
              type: "application/pdf",
              suffixes: "pdf",
              description: "Portable Document Format",
            },
            name: "Chrome PDF Plugin",
            filename: "internal-pdf-viewer",
            description: "Portable Document Format",
            length: 1,
          },
        ],
      });

      // Overwrite languages and platform
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });

      // Add a chrome object to window
      const chromeObj = {
        runtime: {},
        loadTimes: function () {
          return {};
        },
        csi: function () {
          return {};
        },
        app: {},
      };

      window.chrome = chromeObj;

      // Prevent iframe detection technique
      Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
        get: function () {
          return window;
        },
      });
    });

    // Set more realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set realistic extra HTTP headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      Connection: "keep-alive",
      "Cache-Control": "max-age=0",
      "sec-ch-ua":
        '"Google Chrome";v="120", "Chromium";v="120", "Not=A?Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      Referer: "https://www.google.com/",
    });

    // Enable JavaScript
    await page.setJavaScriptEnabled(true);

    // Add random mouse movements to appear more human-like
    await addRandomMouseMovements(page);

    // First, visit the base URL
    console.log(`Initial navigation to: ${url}`);
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 120000, // Increased timeout to 2 minutes
    });

    // Handle Cloudflare initially
    await bypassCloudflare(page);

    // Take a screenshot for debugging
    await page.screenshot({ path: "./aoty-initial.png", fullPage: true });
    console.log("Saved initial screenshot to aoty-initial.png");

    // Process each page
    for (let currentPage = 1; currentPage <= pages; currentPage++) {
      console.log(`Processing page ${currentPage} of ${pages}`);

      // Random scrolling to mimic human behavior
      await simulateRealisticScrolling(page);

      // Take a screenshot for this page
      if (currentPage % 2 === 0 || currentPage === 1 || currentPage === pages) {
        await page.screenshot({
          path: `./aoty-page-${currentPage}.png`,
          fullPage: true,
        });
        console.log(`Saved screenshot for page ${currentPage}`);
      }

      // Extract album data for the current page
      const pageAlbums = await extractAlbumData(page, currentPage);
      console.log(`Found ${pageAlbums.length} albums on page ${currentPage}`);

      // Add this page's albums to our collection
      allAlbums = [...allAlbums, ...pageAlbums];

      // Check if we need to navigate to the next page
      if (currentPage < pages) {
        // Look for the specific pagination elements
        console.log(
          "Looking for pagination elements with class pageSelectSmall..."
        );

        try {
          // Take a screenshot of the bottom of the page first
          await page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight)
          );
          await page.screenshot({
            path: `./aoty-page-${currentPage}-bottom.png`,
          });

          // Wait a moment after scrolling
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Check if the pagination elements exist
          const hasPagination = await page.evaluate(() => {
            const pageElements = document.querySelectorAll(".pageSelectSmall");
            console.log(
              `Found ${pageElements.length} pagination elements with class pageSelectSmall`
            );

            // Log them for debugging
            if (pageElements.length > 0) {
              const details = Array.from(pageElements).map((el) => ({
                text: el.textContent,
                html: el.outerHTML,
              }));
              console.log("Pagination elements:", JSON.stringify(details));
            }

            return pageElements.length > 0;
          });

          if (hasPagination) {
            // Try to find the next page number
            const nextPageNum = currentPage + 1;
            console.log(`Looking for page number ${nextPageNum} in pagination`);

            // Try to click the next page number
            const clickResult = await page.evaluate((nextNum) => {
              // Look for the exact page number
              const nextElement = Array.from(
                document.querySelectorAll(".pageSelectSmall")
              ).find((el) => el.textContent?.trim() === nextNum.toString());

              if (nextElement) {
                console.log(`Found element for page ${nextNum}, clicking it`);
                nextElement.click();
                return true;
              }

              // If no exact match, try to find "next" or ">" elements
              const nextButtons = Array.from(
                document.querySelectorAll(
                  ".pageSelectSmall + a, .paginationNext, .next"
                )
              );
              if (nextButtons.length > 0) {
                console.log("Found next button, clicking it");
                nextButtons[0].click();
                return true;
              }

              return false;
            }, nextPageNum);

            if (clickResult) {
              console.log(
                `Successfully clicked pagination element for page ${nextPageNum}`
              );

              // Wait for page to load after clicking
              await page
                .waitForNavigation({
                  waitUntil: "networkidle2",
                  timeout: 30000,
                })
                .catch((e) =>
                  console.log(
                    `Navigation timeout, but continuing: ${e.message}`
                  )
                );

              // Add a delay before proceeding
              await new Promise((resolve) => setTimeout(resolve, 3000));

              // Check for Cloudflare protection
              await bypassCloudflare(page);

              continue;
            }
          }

          // If we couldn't find or click pagination elements, fall back to URL construction
          console.log(
            "Couldn't interact with pagination, falling back to URL construction"
          );

          // AOTY-specific direct pagination override
          console.log(`Constructing next page URL (page ${currentPage + 1})`);

          const currentUrl = page.url();
          let nextUrl;

          // Special case for first page to second page
          if (currentPage === 1) {
            if (currentUrl.endsWith("/")) {
              nextUrl = `${currentUrl}2/`;
            } else {
              nextUrl = `${currentUrl}/2/`;
            }
            console.log(`First page, navigating to: ${nextUrl}`);
          } else {
            // For subsequent pages (page 2 to page 3, etc.)
            const pagePattern = /\/(\d+)\/$/;
            const match = currentUrl.match(pagePattern);

            if (match) {
              const pageNum = parseInt(match[1], 10);
              nextUrl = currentUrl.replace(pagePattern, `/${pageNum + 1}/`);
              console.log(`Page ${currentPage}, navigating to: ${nextUrl}`);
            } else {
              // Fallback if no match is found
              nextUrl = currentUrl.replace(/\/$/, "") + `/${currentPage + 1}/`;
              console.log(`Fallback: navigating to ${nextUrl}`);
            }
          }

          try {
            // Navigate to the next page
            console.log(`Navigating to: ${nextUrl}`);
            await page.goto(nextUrl, {
              waitUntil: "networkidle2",
              timeout: 60000,
            });

            // Add realistic delay between page loads (3-6 seconds)
            const delay = 3000 + Math.random() * 3000;
            console.log(
              `Waiting ${Math.round(
                delay / 1000
              )} seconds before processing next page...`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));

            // Check for Cloudflare protection on each new page
            await bypassCloudflare(page);
          } catch (error) {
            console.error(
              `Failed to navigate to page ${currentPage + 1}:`,
              error.message
            );
            console.log("Stopping pagination due to navigation error");
            break;
          }

          continue; // Skip the rest of the loop and continue to the next iteration
        } catch (error) {
          console.error("Error interacting with pagination:", error);
          console.log("Stopping pagination due to interaction error");
          break;
        }
      }
    }

    console.log(
      `Total albums found across ${Math.min(
        pages,
        allAlbums.length > 0 ? Math.ceil(allAlbums.length / 25) : 1
      )} pages: ${allAlbums.length}`
    );

    // Take additional screenshots and debug info if no albums were found
    if (allAlbums.length === 0) {
      console.log("No albums found, gathering debug info...");
      await page.screenshot({ path: "./aoty-no-albums.png", fullPage: true });

      // Log the page HTML for debugging
      const html = await page.content();
      console.log("Page HTML structure (truncated):");
      console.log(html.substring(0, 1000) + "...");
    }

    return { albums: allAlbums };
  } catch (error) {
    console.error("Error scraping with Puppeteer:", error);
    throw error;
  } finally {
    // Close browser after a short delay to ensure screenshots are saved
    setTimeout(async () => {
      await browser.close();
      console.log("Browser closed");
    }, 2000);
  }
}

/**
 * Helper function to add random mouse movements to appear more human-like
 * @param {import('puppeteer').Page} page
 */
async function addRandomMouseMovements(page) {
  // Perform 5-10 random mouse movements
  const movements = 5 + Math.floor(Math.random() * 5);

  for (let i = 0; i < movements; i++) {
    const x = Math.floor(Math.random() * 1000);
    const y = Math.floor(Math.random() * 800);

    await page.mouse.move(x, y);

    // Random pause between movements
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000)
    );
  }
}

/**
 * Helper function to simulate realistic scrolling behavior
 * @param {import('puppeteer').Page} page
 */
async function simulateRealisticScrolling(page) {
  await page.evaluate(async () => {
    const totalHeight = document.body.scrollHeight;
    // Initial scroll position
    let currentPosition = 0;

    while (currentPosition < totalHeight) {
      // Scroll down by a random amount
      const scrollStep = Math.floor(100 + Math.random() * 300);
      currentPosition += scrollStep;
      window.scrollTo(0, currentPosition);

      // Add random pauses to simulate reading
      await new Promise((resolve) =>
        setTimeout(resolve, 800 + Math.random() * 1200)
      );
    }

    // Scroll back up randomly
    for (let i = 0; i < 3; i++) {
      const upStep = Math.floor(Math.random() * currentPosition);
      currentPosition -= upStep;
      if (currentPosition < 0) currentPosition = 0;
      window.scrollTo(0, currentPosition);

      await new Promise((resolve) =>
        setTimeout(resolve, 500 + Math.random() * 800)
      );
    }
  });

  // Give some time for the page to stabilize after scrolling
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Helper function to bypass Cloudflare protection
 * @param {import('puppeteer').Page} page
 */
async function bypassCloudflare(page) {
  // Wait for initial page load
  await page.waitForFunction("true", { timeout: 5000 });

  // Check if we're on a Cloudflare challenge page
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);

  if (
    pageTitle.includes("Just a moment") ||
    pageTitle.includes("Cloudflare") ||
    pageTitle.includes("Attention Required") ||
    pageTitle.includes("Security Check")
  ) {
    console.log("Cloudflare protection detected, attempting to bypass...");

    // Click on any visible captcha checkbox if present
    try {
      const captchaCheckbox = await page.$('input[type="checkbox"]');
      if (captchaCheckbox) {
        console.log("Captcha checkbox found, attempting to click it");
        await captchaCheckbox.click();
      }
    } catch {
      // Intentionally ignoring error, just logging it happened
      console.log("No captcha checkbox found or unable to click it");
    }

    // Wait for Cloudflare challenge to resolve with multiple attempts
    for (let i = 0; i < 5; i++) {
      console.log(`Waiting attempt ${i + 1}/5...`);

      // Add random mouse movements and scrolling to appear more human-like
      await addRandomMouseMovements(page);
      await simulateRealisticScrolling(page);

      // Wait longer between attempts
      await page.waitForFunction("true", { timeout: 10000 });

      const newTitle = await page.title();
      if (
        !newTitle.includes("Just a moment") &&
        !newTitle.includes("Cloudflare") &&
        !newTitle.includes("Attention Required") &&
        !newTitle.includes("Security Check")
      ) {
        console.log("Successfully bypassed Cloudflare!");
        break;
      }

      // If we're still on Cloudflare after multiple attempts, try reloading
      if (i === 3) {
        console.log("Still on Cloudflare page, attempting to reload...");
        await page.reload({ waitUntil: "networkidle2", timeout: 60000 });
      }
    }

    // Additional waiting time to ensure page is fully loaded
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

/**
 * Helper function to extract album data from the current page
 * @param {import('puppeteer').Page} page
 * @param {number} currentPage
 */
async function extractAlbumData(page, currentPage) {
  return page.evaluate((page) => {
    console.log(`Extracting data from page ${page}`);

    const results = [];

    // Try to find items using the classes found from our testing
    const albumRows = document.querySelectorAll(".albumListRow");
    console.log(
      `Found ${albumRows.length} albumListRow elements on page ${page}`
    );

    if (albumRows.length > 0) {
      albumRows.forEach((item, index) => {
        const rankElement = item.querySelector(".albumListRank");
        const titleElement = item.querySelector(".albumListTitle");
        const artistElement = item.querySelector(".albumListArtist, .artist");
        const dateElement = item.querySelector(".albumListDate");

        let artist = "";
        let album = "";

        if (titleElement) {
          const titleText = titleElement.textContent?.trim() || "";

          if (!artistElement && titleText.includes(" - ")) {
            const parts = titleText.split(" - ");
            artist = parts[0].trim();
            album = parts[1].trim();
          } else {
            album = titleText;
            artist = artistElement?.textContent?.trim() || "";
          }

          // Get rank if available, or calculate based on page & index
          let rank = 0;
          if (rankElement && rankElement.textContent) {
            rank = parseInt(rankElement.textContent.trim(), 10);
          }

          if (!rank || isNaN(rank)) {
            // If no rank or invalid, calculate based on current page and position
            const itemsPerPage = 25; // Typical count for AOTY
            rank = (page - 1) * itemsPerPage + index + 1;
          }

          // Get year from date element or try to extract from text
          let year = 0;
          if (dateElement) {
            const dateText = dateElement.textContent || "";
            const yearMatch = dateText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[0], 10);
            }
          }

          if (artist && album) {
            results.push({ rank, artist, album, year });
          }
        }
      });
    }

    // If no results yet, try additional approaches
    if (results.length === 0) {
      console.log("No results from primary selector, trying alternatives...");

      // Check for other album list formats
      const albumItems = document.querySelectorAll(
        ".albumListItem, .albumBlock, .albumGridItem"
      );
      console.log(
        `Found ${albumItems.length} items with alternative selectors`
      );

      if (albumItems.length > 0) {
        albumItems.forEach((item, index) => {
          const artist =
            item
              .querySelector(
                '.artistTitle, .albumBlockArtist, [class*="Artist"]'
              )
              ?.textContent?.trim() || "";
          const album =
            item
              .querySelector('.albumTitle, .albumBlockTitle, [class*="Title"]')
              ?.textContent?.trim() || "";

          // Get year if available
          let year = 0;
          const dateElement = item.querySelector(
            '.albumDate, .albumBlockDate, .albumYear, [class*="Date"]'
          );
          if (dateElement) {
            const dateText = dateElement.textContent || "";
            const yearMatch = dateText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[0], 10);
            }
          }

          if (artist && album) {
            // Calculate rank based on page and position
            const rank = (page - 1) * 25 + index + 1;
            results.push({ rank, artist, album, year });
          }
        });
      }
    }

    // Final fallback - look for any elements that might be album entries
    if (results.length === 0) {
      console.log("Still no results, trying final fallback...");

      // Look for album covers with details
      const albumElements = document.querySelectorAll(
        '[class*="album"], [class*="Album"], [itemtype*="MusicAlbum"]'
      );
      console.log(`Found ${albumElements.length} general album elements`);

      albumElements.forEach((item, index) => {
        // Only process if it looks like an album entry (has image or title-like elements)
        const hasImage = !!item.querySelector("img");
        const hasTitleElement = !!item.querySelector(
          '[class*="title"], [class*="Title"], h2, h3, h4'
        );

        if (
          (hasImage || hasTitleElement) &&
          !item.classList.contains("albumList")
        ) {
          let artist = "";
          let album = "";

          // Try to get artist and album names from various potential elements
          const artistElement = item.querySelector(
            '[class*="artist"], [class*="Artist"], [itemprop="byArtist"]'
          );
          const albumElement = item.querySelector(
            '[class*="title"], [class*="Title"], [itemprop="name"]'
          );

          if (artistElement) {
            artist = artistElement.textContent?.trim() || "";
          }

          if (albumElement) {
            album = albumElement.textContent?.trim() || "";
          }

          // If we only have one element with text that contains a separator, split it
          if ((!artist || !album) && (artistElement || albumElement)) {
            const combinedText =
              (artistElement || albumElement)?.textContent?.trim() || "";

            if (combinedText.includes(" - ")) {
              const parts = combinedText.split(" - ");
              artist = artist || parts[0].trim();
              album = album || parts[1].trim();
            }
          }

          // Extract year if available
          let year = 0;
          const itemText = item.textContent || "";
          const yearMatch = itemText.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) {
            year = parseInt(yearMatch[0], 10);
          }

          if (artist && album) {
            // Calculate rank based on page and position
            const rank = (page - 1) * 25 + index + 1;
            results.push({ rank, artist, album, year });
          }
        }
      });
    }

    console.log(`Extracted ${results.length} albums from page ${page}`);
    return results;
  }, currentPage);
}
