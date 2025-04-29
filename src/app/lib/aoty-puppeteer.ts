import puppeteer, { Page } from 'puppeteer';
import { Album, ScrapedData } from './scraper';

/**
 * Scrapes Album of the Year using Puppeteer to bypass Cloudflare protection
 * @param url The base URL to scrape
 * @param pages The number of pages to scrape (defaults to 1)
 */
export async function scrapeAlbumOfTheYearWithPuppeteer(url: string, pages: number = 1): Promise<ScrapedData> {
  console.log('Starting Puppeteer with URL:', url);
  
  // Validate the URL format
  try {
    new URL(url);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid URL syntax';
    console.error('Invalid URL format:', url, errorMessage);
    throw new Error(`Invalid URL format: ${url} - ${errorMessage}`);
  }
  
  // Launch browser with more realistic settings
  const browser = await puppeteer.launch({
    headless: false, // Use non-headless mode to better bypass protections
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920x1080',
      '--disable-features=IsolateOrigins,site-per-process', // Disable site isolation
      '--disable-web-security', // Disable CORS and other web security features
      '--disable-blink-features=AutomationControlled', // Hide automation
      `--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
    ],
    // @ts-expect-error - ignoreHTTPSErrors is valid but may not be in type definition
    ignoreHTTPSErrors: true,
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });

  let allAlbums: Album[] = [];

  try {
    const page = await browser.newPage();
    
    // Configure the page to better mimic a real browser
    await page.evaluateOnNewDocument(() => {
      // Overwrite the navigator properties used for bot detection
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });
      
      // Create a false plugins array
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {
              type: 'application/pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format'
            },
            name: 'Chrome PDF Plugin',
            filename: 'internal-pdf-viewer',
            description: 'Portable Document Format',
            length: 1
          }
        ]
      });
      
      // Overwrite languages and platform
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      // Add a chrome object to window
      const chromeObj = {
        runtime: {} as Record<string, unknown>,
        loadTimes: function() { return {}; },
        csi: function() { return {}; },
        app: {} as Record<string, unknown>
      };
      
      // @ts-expect-error - Chrome object doesn't exist on Window type but is used for fingerprinting
      window.chrome = chromeObj;
      
      // Prevent iframe detection technique
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function() {
          return window;
        }
      });
    });
    
    // Set more realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set realistic extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Google Chrome";v="120", "Chromium";v="120", "Not=A?Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Referer': 'https://www.google.com/'
    });
    
    // Enable JavaScript
    await page.setJavaScriptEnabled(true);
    
    // Add random mouse movements to appear more human-like
    await addRandomMouseMovements(page);
    
    // First, visit the base URL
    console.log(`Initial navigation to: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 120000 // Increased timeout to 2 minutes
    });
    
    // Handle Cloudflare initially
    await bypassCloudflare(page);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './aoty-initial.png', fullPage: true });
    console.log('Saved initial screenshot to aoty-initial.png');
    
    // Process each page
    for (let currentPage = 1; currentPage <= pages; currentPage++) {
      console.log(`Processing page ${currentPage} of ${pages}`);
      
      // Random scrolling to mimic human behavior
      await simulateRealisticScrolling(page);
      
      // Take a screenshot for this page
      if (currentPage % 2 === 0 || currentPage === 1 || currentPage === pages) {
        await page.screenshot({ path: `./aoty-page-${currentPage}.png`, fullPage: true });
        console.log(`Saved screenshot for page ${currentPage}`);
      }
      
      // Extract album data for the current page
      const pageAlbums = await extractAlbumData(page, currentPage);
      console.log(`Found ${pageAlbums.length} albums on page ${currentPage}`);
      
      // Add this page's albums to our collection
      allAlbums = [...allAlbums, ...pageAlbums];
      
      // Check if we need to navigate to the next page
      if (currentPage < pages) {
        // Look for next page button using various common selectors
        const hasNextPage = await page.evaluate(() => {
          const nextSelectors = [
            'a[rel="next"]',                  // Standard rel attribute
            '.pager-next:not(.inactive) a',   // Pager with 'next' class
            '.pagination-next:not(.disabled) a', // Bootstrap-style pagination
            'a.next:not(.disabled)',          // Simple 'next' class
            'a[href*="page/"]',               // Links containing 'page/' in href
            'li.next a',                      // List item with 'next' class
            '.pagination a:contains(Next)',   // jQuery-style selector - REMOVED
            '.pagination a:contains(next)',   // jQuery-style selector - REMOVED
            'a.page-link[aria-label="Next"]', // Bootstrap page-link with aria-label
            'a[title="Next Page"]',           // Anchor with "Next Page" title
            '[class*="pagination"] a:last-child', // Last anchor in pagination element
            '.pagination [aria-label="Next page"]', // Aria-label for next page
            'button.next-page',               // Button with next-page class
            '[class*="next"][class*="page"]'  // Element with both "next" and "page" in class
          ];
          
          // Look for next text in links
          const allLinks = Array.from(document.querySelectorAll('a'));
          const nextLinks = allLinks.filter(link => {
            const text = link.textContent?.toLowerCase() || '';
            return text.includes('next') || text === '>' || text === '→';
          });
          
          // Log what we find for debugging
          const found = [];
          for (const selector of nextSelectors) {
            try {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                found.push(`Found ${elements.length} elements matching: ${selector}`);
              }
            } catch (e) {
              console.log(`Invalid selector: ${selector}`);
            }
          }
          
          if (nextLinks.length > 0) {
            found.push(`Found ${nextLinks.length} links with 'next' in text`);
          }
          
          if (found.length > 0) {
            console.log('Next page elements found:', found.join(', '));
            return true;
          } else {
            console.log('No next page elements found');
            return false;
          }
        });
        
        if (!hasNextPage) {
          console.log(`No 'Next' button found after page ${currentPage}. Stopping pagination.`);
          break;
        }
        
        // Click the next page button - trying different selectors
        console.log('Attempting to click Next button...');
        
        // Try each selector in sequence
        const nextSelectors = [
          'a[rel="next"]',
          '.pager-next:not(.inactive) a',
          '.pagination-next:not(.disabled) a',
          'a.next:not(.disabled)',
          'li.next a',
          'a.page-link[aria-label="Next"]',
          'a[title="Next Page"]',
          '[class*="pagination"] a:last-child',
          '.pagination [aria-label="Next page"]',
          'button.next-page',
          '[class*="next"][class*="page"]'
        ];
        
        let clickSuccess = false;
        
        for (const selector of nextSelectors) {
          try {
            // Wait for the element to be visible
            await page.waitForSelector(selector, { visible: true, timeout: 3000 })
              .catch(() => null); // Catch and ignore timeout errors
            
            // Make sure element exists before clicking
            const element = await page.$(selector);
            if (!element) continue;
            
            // Add some human-like delay and mouse movement
            await addRandomMouseMovements(page);
            await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
            
            // Click the element
            await element.click();
            console.log(`Successfully clicked next button using selector: ${selector}`);
            clickSuccess = true;
            break;
          } catch (_) {
            // Continue to the next selector if this one fails
            continue;
          }
        }
        
        // If no selector worked, try finding links with "Next" in their text
        if (!clickSuccess) {
          try {
            // Evaluate returns the element handle or null
            const nextLink = await page.evaluateHandle(() => {
              const links = Array.from(document.querySelectorAll('a'));
              return links.find(link => {
                const text = link.textContent?.toLowerCase() || '';
                return text.includes('next') || text === '>' || text === '→';
              });
            });
            
            // Check if we found an element
            const isNull = await page.evaluate(el => el === null, nextLink);
            if (!isNull) {
              await nextLink.asElement()?.click();
              console.log('Clicked on link with "Next" text');
              clickSuccess = true;
            }
          } catch (_) {
            console.log('Could not find or click link with "Next" text');
          }
        }
        
        if (!clickSuccess) {
          console.log('Could not click any next button. Trying direct URL navigation...');
          
          // Fall back to URL-based navigation if clicking failed
          try {
            // Get the current URL and modify it for the next page
            const currentUrl = page.url();
            let nextUrl = '';
            
            // Handle different pagination formats
            if (currentUrl.includes('/page/')) {
              // Format: /page/X/
              const pageNumMatch = currentUrl.match(/\/page\/(\d+)/);
              if (pageNumMatch) {
                const pageNum = parseInt(pageNumMatch[1], 10);
                nextUrl = currentUrl.replace(`/page/${pageNum}`, `/page/${pageNum + 1}`);
              } else {
                nextUrl = currentUrl.replace(/\/?$/, '/page/2/');
              }
            } else if (currentUrl.includes('?page=')) {
              // Format: ?page=X
              const pageNumMatch = currentUrl.match(/\?page=(\d+)/);
              if (pageNumMatch) {
                const pageNum = parseInt(pageNumMatch[1], 10);
                nextUrl = currentUrl.replace(`?page=${pageNum}`, `?page=${pageNum + 1}`);
              } else {
                nextUrl = `${currentUrl}&page=2`;
              }
            } else if (currentUrl.match(/\/\d+\//)) {
              // Format: /X/
              const pageNumMatch = currentUrl.match(/\/(\d+)\/$/);
              if (pageNumMatch) {
                const pageNum = parseInt(pageNumMatch[1], 10);
                nextUrl = currentUrl.replace(`/${pageNum}/`, `/${pageNum + 1}/`);
              } else {
                // If no match, just append /2/
                nextUrl = currentUrl.replace(/\/?$/, '/2/');
              }
            } else {
              // Default: append page/X/
              nextUrl = currentUrl.replace(/\/?$/, '/page/2/');
            }
            
            console.log(`Navigating to constructed URL: ${nextUrl}`);
            await page.goto(nextUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          } catch (_) {
            console.error('Failed to navigate to next page');
            break;
          }
        }
        
        // Wait for the page to load
        await page.waitForFunction('document.readyState === "complete"', { timeout: 30000 });
        
        // Add a realistic delay between page loads (5-10 seconds)
        const delay = 5000 + Math.random() * 5000;
        console.log(`Waiting ${Math.round(delay/1000)} seconds before processing next page...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Check for Cloudflare protection on each new page
        await bypassCloudflare(page);
      }
    }
    
    console.log(`Total albums found across ${Math.min(pages, allAlbums.length > 0 ? Math.ceil(allAlbums.length / 25) : 1)} pages: ${allAlbums.length}`);
    
    // Take additional screenshots and debug info if no albums were found
    if (allAlbums.length === 0) {
      console.log('No albums found, gathering debug info...');
      await page.screenshot({ path: './aoty-no-albums.png', fullPage: true });
      
      // Log the page HTML for debugging
      const html = await page.content();
      console.log('Page HTML structure (truncated):');
      console.log(html.substring(0, 1000) + '...');
    }
    
    return { albums: allAlbums };
  } catch (error) {
    console.error('Error scraping with Puppeteer:', error);
    throw error;
  } finally {
    // Close browser after a short delay to ensure screenshots are saved
    setTimeout(async () => {
      await browser.close();
      console.log('Browser closed');
    }, 2000);
  }
}

/**
 * Helper function to add random mouse movements to appear more human-like
 */
async function addRandomMouseMovements(page: Page): Promise<void> {
  // Perform 5-10 random mouse movements
  const movements = 5 + Math.floor(Math.random() * 5);
  
  for (let i = 0; i < movements; i++) {
    const x = Math.floor(Math.random() * 1000);
    const y = Math.floor(Math.random() * 800);
    
    await page.mouse.move(x, y);
    
    // Random pause between movements
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  }
}

/**
 * Helper function to simulate realistic scrolling behavior
 */
async function simulateRealisticScrolling(page: Page): Promise<void> {
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
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    }
    
    // Scroll back up randomly
    for (let i = 0; i < 3; i++) {
      const upStep = Math.floor(Math.random() * currentPosition);
      currentPosition -= upStep;
      if (currentPosition < 0) currentPosition = 0;
      window.scrollTo(0, currentPosition);
      
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 800));
    }
  });
  
  // Give some time for the page to stabilize after scrolling
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Helper function to bypass Cloudflare protection
 */
async function bypassCloudflare(page: Page): Promise<void> {
  // Wait for initial page load
  await page.waitForFunction('true', { timeout: 5000 });
  
  // Check if we're on a Cloudflare challenge page
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);
  
  if (pageTitle.includes('Just a moment') || 
      pageTitle.includes('Cloudflare') ||
      pageTitle.includes('Attention Required') ||
      pageTitle.includes('Security Check')) {
    console.log('Cloudflare protection detected, attempting to bypass...');
    
    // Click on any visible captcha checkbox if present
    try {
      const captchaCheckbox = await page.$('input[type="checkbox"]');
      if (captchaCheckbox) {
        console.log('Captcha checkbox found, attempting to click it');
        await captchaCheckbox.click();
      }
    } catch (_) {
      // Intentionally ignoring error, just logging it happened
      console.log('No captcha checkbox found or unable to click it');
    }
    
    // Wait for Cloudflare challenge to resolve with multiple attempts
    for (let i = 0; i < 5; i++) {
      console.log(`Waiting attempt ${i+1}/5...`);
      
      // Add random mouse movements and scrolling to appear more human-like
      await addRandomMouseMovements(page);
      await simulateRealisticScrolling(page);
      
      // Wait longer between attempts
      await page.waitForFunction('true', { timeout: 10000 });
      
      const newTitle = await page.title();
      if (!newTitle.includes('Just a moment') && 
          !newTitle.includes('Cloudflare') &&
          !newTitle.includes('Attention Required') &&
          !newTitle.includes('Security Check')) {
        console.log('Successfully bypassed Cloudflare!');
        break;
      }
      
      // If we're still on Cloudflare after multiple attempts, try reloading
      if (i === 3) {
        console.log('Still on Cloudflare page, attempting to reload...');
        await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
      }
    }
    
    // Additional waiting time to ensure page is fully loaded
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

/**
 * Helper function to extract album data from the current page
 */
async function extractAlbumData(page: Page, currentPage: number): Promise<Album[]> {
  return page.evaluate((page: number) => {
    console.log(`Extracting data from page ${page}`);
    
    const results: Array<{
      rank: number;
      artist: string;
      album: string;
      year: number;
    }> = [];
    
    // Try to find items using the classes found from our testing
    const albumRows = document.querySelectorAll('.albumListRow');
    console.log(`Found ${albumRows.length} albumListRow elements on page ${page}`);
    
    if (albumRows.length > 0) {
      albumRows.forEach((item, index) => {
        const rankElement = item.querySelector('.albumListRank');
        const titleElement = item.querySelector('.albumListTitle');
        const artistElement = item.querySelector('.albumListArtist, .artist');
        const dateElement = item.querySelector('.albumListDate');
        
        let artist = '';
        let album = '';
        
        if (titleElement) {
          const titleText = titleElement.textContent?.trim() || '';
          
          if (!artistElement && titleText.includes(' - ')) {
            const parts = titleText.split(' - ');
            artist = parts[0].trim();
            album = parts[1].trim();
          } else {
            album = titleText;
            artist = artistElement?.textContent?.trim() || '';
          }
          
          // Get rank if available, or calculate based on page & index
          let rank = 0;
          if (rankElement && rankElement.textContent) {
            rank = parseInt(rankElement.textContent.trim(), 10);
          }
          
          if (!rank || isNaN(rank)) {
            // If no rank or invalid, calculate based on current page and position
            const itemsPerPage = 25; // Typical count for AOTY
            rank = ((page - 1) * itemsPerPage) + index + 1;
          }
          
          // Get year from date element or try to extract from text
          let year = 0;
          if (dateElement) {
            const dateText = dateElement.textContent || '';
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
      console.log('No results from primary selector, trying alternatives...');
      
      // Check for other album list formats
      const albumItems = document.querySelectorAll('.albumListItem, .albumBlock, .albumGridItem');
      console.log(`Found ${albumItems.length} items with alternative selectors`);
      
      if (albumItems.length > 0) {
        albumItems.forEach((item, index) => {
          const artist = item.querySelector('.artistTitle, .albumBlockArtist, [class*="Artist"]')?.textContent?.trim() || '';
          const album = item.querySelector('.albumTitle, .albumBlockTitle, [class*="Title"]')?.textContent?.trim() || '';
          
          // Get year if available
          let year = 0;
          const dateElement = item.querySelector('.albumDate, .albumBlockDate, .albumYear, [class*="Date"]');
          if (dateElement) {
            const dateText = dateElement.textContent || '';
            const yearMatch = dateText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[0], 10);
            }
          }
          
          if (artist && album) {
            // Calculate rank based on page and position
            const rank = ((page - 1) * 25) + index + 1;
            results.push({ rank, artist, album, year });
          }
        });
      }
    }
    
    // Final fallback - look for any elements that might be album entries
    if (results.length === 0) {
      console.log('Still no results, trying final fallback...');
      
      // Look for album covers with details
      const albumElements = document.querySelectorAll('[class*="album"], [class*="Album"], [itemtype*="MusicAlbum"]');
      console.log(`Found ${albumElements.length} general album elements`);
      
      albumElements.forEach((item, index) => {
        // Only process if it looks like an album entry (has image or title-like elements)
        const hasImage = !!item.querySelector('img');
        const hasTitleElement = !!item.querySelector('[class*="title"], [class*="Title"], h2, h3, h4');
        
        if ((hasImage || hasTitleElement) && !item.classList.contains('albumList')) {
          let artist = '';
          let album = '';
          
          // Try to get artist and album names from various potential elements
          const artistElement = item.querySelector('[class*="artist"], [class*="Artist"], [itemprop="byArtist"]');
          const albumElement = item.querySelector('[class*="title"], [class*="Title"], [itemprop="name"]');
          
          if (artistElement) {
            artist = artistElement.textContent?.trim() || '';
          }
          
          if (albumElement) {
            album = albumElement.textContent?.trim() || '';
          }
          
          // If we only have one element with text that contains a separator, split it
          if ((!artist || !album) && (artistElement || albumElement)) {
            const combinedText = (artistElement || albumElement)?.textContent?.trim() || '';
            
            if (combinedText.includes(' - ')) {
              const parts = combinedText.split(' - ');
              artist = artist || parts[0].trim();
              album = album || parts[1].trim();
            }
          }
          
          // Extract year if available
          let year = 0;
          const itemText = item.textContent || '';
          const yearMatch = itemText.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) {
            year = parseInt(yearMatch[0], 10);
          }
          
          if (artist && album) {
            // Calculate rank based on page and position
            const rank = ((page - 1) * 25) + index + 1;
            results.push({ rank, artist, album, year });
          }
        }
      });
    }
    
    console.log(`Extracted ${results.length} albums from page ${page}`);
    return results;
  }, currentPage);
} 