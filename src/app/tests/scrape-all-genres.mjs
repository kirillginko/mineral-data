// Script to scrape multiple genre lists from AOTY
// Usage: node src/app/scrape-all-genres.mjs [pages=5] [delay=5000]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Scrape AOTY genre page using Puppeteer
 * @param {string} url - URL to scrape
 * @returns {Promise<Array>} - Array of album objects
 */
async function scrapeWithPuppeteer(url) {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    console.log(`Scraping URL: ${url}`);
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Add user agent to avoid being blocked
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set longer timeout for navigation
    page.setDefaultNavigationTimeout(120000); // 2 minutes
    
    // Navigate to the page and wait for content to load
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      console.log("Page loaded successfully");
    } catch (navError) {
      console.error("Navigation error:", navError.message);
      // Try to continue anyway, we might still have partial content
    }
    
    // Wait for a little bit to ensure JS has time to execute
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take a screenshot for debugging
    const screenshotPath = path.join(process.cwd(), 'debug_screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved debug screenshot to ${screenshotPath}`);
    
    // Try to wait for selectors
    try {
      await page.waitForSelector('.albumListItem, .albumBlock, .albumGridItem', { timeout: 10000 });
      console.log("Found album selectors");
    } catch (_) {
      console.log('Could not find standard album selectors, will try alternatives');
    }
    
    // Extract the data - using a more targeted approach
    const albums = await page.evaluate(() => {
      const results = [];
      
      // Get all album container elements
      const albumContainers = Array.from(document.querySelectorAll('.albumListItem, .albumBlock, .gridItem'));
      console.log(`Found ${albumContainers.length} album containers`);
      
      // Function to check if element is an actual album (not navigation, ads, etc.)
      const isValidAlbum = (element) => {
        // Skip elements with certain classes or content
        const invalidClasses = ['ad', 'sponsor', 'pagination', 'nav', 'menu', 'header', 'footer'];
        const invalidText = ['login', 'sign up', 'search', 'more'];
        
        const hasInvalidClass = invalidClasses.some(cls => 
          element.className.toLowerCase().includes(cls));
        
        const hasInvalidText = invalidText.some(text => 
          element.textContent.toLowerCase().includes(text));
          
        return !hasInvalidClass && !hasInvalidText;
      };
      
      // Extract data from album containers that pass validation
      albumContainers.forEach((container, index) => {
        if (!isValidAlbum(container)) return;
        
        try {
          // Try to find artist and album info using various selectors
          let artist = '';
          let album = '';
          let year = 0;
          let rank = index + 1;
          
          // Check if this is a standard album list item
          const artistElement = container.querySelector('.albumListArtist, .artistTitle, .artist'); 
          const albumElement = container.querySelector('.albumListTitle, .albumTitle, .name');
          const rankElement = container.querySelector('.albumListRank, .rank, .number');
          const yearElement = container.querySelector('.albumListDate, .date, .year');
          
          // Extract artist
          if (artistElement) {
            artist = artistElement.textContent.trim();
          } else {
            // Try alternative ways to find artist
            const links = Array.from(container.querySelectorAll('a'));
            const artistLink = links.find(link => 
              link.href.includes('/artist/') || 
              link.className.includes('artist')
            );
            
            if (artistLink) {
              artist = artistLink.textContent.trim();
            }
          }
          
          // Extract album
          if (albumElement) {
            album = albumElement.textContent.trim();
          } else {
            // Try alternative ways to find album
            const links = Array.from(container.querySelectorAll('a'));
            const albumLink = links.find(link => 
              link.href.includes('/album/') || 
              link.className.includes('album')
            );
            
            if (albumLink) {
              album = albumLink.textContent.trim();
            }
          }
          
          // Extract rank
          if (rankElement) {
            const rankText = rankElement.textContent.trim();
            if (rankText && /^\d+$/.test(rankText)) {
              rank = parseInt(rankText, 10);
            }
          }
          
          // Extract year
          if (yearElement) {
            const yearText = yearElement.textContent.trim();
            const yearMatch = yearText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[0], 10);
            }
          } else {
            // Try to find year in any text
            const fullText = container.textContent;
            const yearMatch = fullText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[0], 10);
            }
          }
          
          // Filter out clearly invalid entries
          if (artist && album && 
              !album.includes('Amazon') && 
              !album.includes('Spotify') && 
              !album.includes('Music') &&
              artist !== 'Unknown Artist') {
            // Add to results
            results.push({ rank, artist, album, year });
          }
          
        } catch (err) {
          console.error(`Error parsing item ${index}`, err);
        }
      });
      
      return results;
    });
    
    console.log(`Found ${albums.length} valid albums on page`);
    return albums;
  } catch (error) {
    console.error('Error scraping with Puppeteer:', error);
    return [];
  } finally {
    await browser.close();
  }
}

/**
 * Scrape multiple genre lists from AOTY
 * @param {number} pagesPerGenre - Number of pages to scrape per genre
 * @param {number} delayBetweenRequests - Delay in ms between requests
 */
async function scrapeAllGenres(pagesPerGenre = 5, delayBetweenRequests = 5000) {
  try {
    // Read the list of genres to scrape
    const genreFilePath = path.join(__dirname, 'data', 'genre-urls.json');
    const genreData = JSON.parse(await fs.readFile(genreFilePath, 'utf-8'));
    
    if (!genreData.genres || !Array.isArray(genreData.genres)) {
      throw new Error('Invalid genre data format - expected array of genres');
    }
    
    console.log(`Found ${genreData.genres.length} genres to scrape`);
    console.log(`Will scrape ${pagesPerGenre} pages per genre with ${delayBetweenRequests}ms delay between requests`);
    
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'src', 'app', 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    // Process each genre
    for (const [index, genre] of genreData.genres.entries()) {
      console.log(`\n[${index + 1}/${genreData.genres.length}] Processing genre: ${genre.name} (ID: ${genre.id})`);
      console.log(`Base URL: ${genre.url}`);
      
      // Array to hold all albums for this genre
      let genreAlbums = [];
      
      // Try direct HTTP request first (old way)
      try {
        console.log(`Trying HTTP request for ${genre.name}...`);
        const response = await fetch(genre.url);
        const html = await response.text();
        
        // Look for album blocks in the HTML
        const albumMatches = html.match(/<div class="albumListItem"[^>]*>/g);
        const alternativeMatches = html.match(/<div class="albumBlock"[^>]*>/g);
        
        console.log(`Found ${albumMatches?.length || 0} primary album matches and ${alternativeMatches?.length || 0} alternative matches in HTML`);
      } catch (htmlError) {
        console.error("Error fetching HTML:", htmlError.message);
      }
      
      // Scrape each page for this genre
      for (let page = 1; page <= pagesPerGenre; page++) {
        // Construct the page URL - for first page, use base URL
        // For subsequent pages, add page number
        const pageUrl = page === 1 ? genre.url : `${genre.url}${page}/`;
        
        console.log(`\nScraping ${genre.name} page ${page}/${pagesPerGenre}: ${pageUrl}`);
        
        try {
          const albums = await scrapeWithPuppeteer(pageUrl);
          
          console.log(`Retrieved ${albums.length} ${genre.name} albums from page ${page}`);
          
          // Add to our collection, adjust ranks to maintain proper ordering
          if (albums.length > 0) {
            const pageOffset = (page - 1) * 25;
            const processedAlbums = albums.map(album => ({
              ...album,
              rank: pageOffset + album.rank, // Keep original rank if available, or calculate
              genre: genre.name // Add genre to each album for reference
            }));
            
            genreAlbums = [...genreAlbums, ...processedAlbums];
          } else {
            console.warn(`No albums found on ${genre.name} page ${page}`);
          }
          
          // Simple delay to avoid overwhelming the server
          if (page < pagesPerGenre) {
            console.log(`Waiting ${delayBetweenRequests/1000} seconds before next request...`);
            await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
          }
          
        } catch (pageError) {
          console.error(`Failed to scrape ${genre.name} page ${page}:`, pageError);
        }
      }
      
      console.log(`\nCompleted scraping ${genre.name}: found ${genreAlbums.length} albums across ${pagesPerGenre} pages`);
      
      // If we didn't find any albums with Puppeteer, try using the previous method
      if (genreAlbums.length === 0) {
        console.warn(`No albums found for ${genre.name}, trying fallback to previous implementation...`);
        
        try {
          // Try to use the existing data file if it exists
          const existingDataPath = path.join(dataDir, `${genre.name}-albums.json`);
          try {
            const existingData = JSON.parse(await fs.readFile(existingDataPath, 'utf-8'));
            if (existingData.albums && existingData.albums.length > 0) {
              console.log(`Found ${existingData.albums.length} albums in existing data file`);
              genreAlbums = existingData.albums;
            }
          } catch (_) {
            console.log("No existing data file found or error reading it.");
          }
          
          // If still no albums, create a sample entry for debugging
          if (genreAlbums.length === 0) {
            console.log("Creating sample entry for debugging");
            genreAlbums = [
              { 
                rank: 1, 
                artist: "Sample Artist", 
                album: "Sample Album (Scraper Debug Entry)", 
                year: new Date().getFullYear(),
                genre: genre.name
              }
            ];
          }
        } catch (fallbackError) {
          console.error("Error with fallback approach:", fallbackError);
        }
      }
      
      if (genreAlbums.length > 0) {
        // Save results for this genre
        const filename = `${genre.name}-albums.json`;
        const outputPath = path.join(dataDir, filename);
        
        await fs.writeFile(outputPath, JSON.stringify({ 
          genre: genre.name,
          genreId: genre.id,
          sourceUrl: genre.url,
          albums: genreAlbums,
          timestamp: new Date().toISOString(),
          totalAlbums: genreAlbums.length,
          pagesScraped: pagesPerGenre
        }, null, 2));
        
        console.log(`Saved ${genre.name} data to ${outputPath}`);
      } else {
        console.log(`No albums found for ${genre.name}, skipping file creation`);
      }
      
      // Delay between genres to avoid getting blocked
      if (index < genreData.genres.length - 1) {
        const genreDelay = delayBetweenRequests * 2; // Longer delay between genres
        console.log(`\nWaiting ${genreDelay/1000} seconds before processing next genre...`);
        await new Promise(resolve => setTimeout(resolve, genreDelay));
      }
    }
    
    console.log('\nAll genre scraping completed successfully!');
    
  } catch (error) {
    console.error('Error in scrape-all-genres script:', error);
  }
}

// Get parameters from command line arguments
const args = process.argv.slice(2);
const pages = args[0] ? parseInt(args[0], 10) : 5;
const delay = args[1] ? parseInt(args[1], 10) : 5000;

// Run the scraper
scrapeAllGenres(pages, delay).catch(console.error); 