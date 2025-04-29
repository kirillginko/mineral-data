// Script to scrape genre data directly with Puppeteer
// Usage: node src/app/scrape-with-puppeteer.mjs [pages=4] [delay=5000]

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
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    console.log(`Scraping URL: ${url}`);
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Add user agent to avoid being blocked
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to the page and wait for content to load
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for the album items to be loaded
    await page.waitForSelector('.albumListItem, .albumBlock, .albumGridItem', { timeout: 10000 })
      .catch(() => console.log('Could not find standard album selectors, will try alternatives'));
    
    // Extract the data
    const albums = await page.evaluate(() => {
      const results = [];
      
      // Try primary selectors first
      const primaryItems = document.querySelectorAll('.albumListItem');
      if (primaryItems.length > 0) {
        primaryItems.forEach((item, index) => {
          try {
            // Get rank if available
            const rankElement = item.querySelector('.albumListRank');
            const rank = rankElement ? parseInt(rankElement.textContent.trim(), 10) : index + 1;
            
            // Get artist name
            const artist = item.querySelector('.albumListArtist')?.textContent.trim() || '';
            
            // Get album name
            const album = item.querySelector('.albumListTitle')?.textContent.trim() || '';
            
            // Get year
            let year = 0;
            const dateText = item.querySelector('.albumListDate')?.textContent.trim() || '';
            const yearMatch = dateText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[0], 10);
            }
            
            if (artist && album) {
              results.push({ rank, artist, album, year });
            }
          } catch (err) {
            console.error(`Error parsing item ${index}`, err);
          }
        });
      }
      
      // If no results with primary selectors, try alternatives
      if (results.length === 0) {
        const alternativeItems = document.querySelectorAll('.albumBlock, .albumGridItem');
        alternativeItems.forEach((item, index) => {
          try {
            const artist = item.querySelector('.artistTitle, .albumBlockArtist')?.textContent.trim() || '';
            const album = item.querySelector('.albumTitle, .albumBlockTitle')?.textContent.trim() || '';
            
            let year = 0;
            const dateText = item.querySelector('.albumDate, .albumBlockDate, .albumYear')?.textContent.trim() || '';
            const yearMatch = dateText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[0], 10);
            }
            
            if (artist && album) {
              results.push({ rank: index + 1, artist, album, year });
            }
          } catch (err) {
            console.error(`Error parsing alternative item ${index}`, err);
          }
        });
      }
      
      // Final fallback for schema markup
      if (results.length === 0) {
        const schemaItems = document.querySelectorAll('[itemtype="http://schema.org/MusicAlbum"]');
        schemaItems.forEach((item, index) => {
          try {
            const artist = item.querySelector('[itemprop="byArtist"], .artist')?.textContent.trim() || '';
            const album = item.querySelector('[itemprop="name"], .name')?.textContent.trim() || '';
            
            let year = 0;
            const dateText = item.textContent;
            const yearMatch = dateText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
              year = parseInt(yearMatch[0], 10);
            }
            
            if (artist && album) {
              results.push({ rank: index + 1, artist, album, year });
            }
          } catch (err) {
            console.error(`Error parsing schema item ${index}`, err);
          }
        });
      }
      
      return results;
    });
    
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
async function scrapeAllGenres(pagesPerGenre = 4, delayBetweenRequests = 5000) {
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
    console.error('Error in scrape-with-puppeteer script:', error);
  }
}

// Get parameters from command line arguments
const args = process.argv.slice(2);
const pages = args[0] ? parseInt(args[0], 10) : 4;
const delay = args[1] ? parseInt(args[1], 10) : 5000;

// Run the scraper
scrapeAllGenres(pages, delay).catch(console.error); 