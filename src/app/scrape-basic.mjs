// Basic script to scrape genre lists from AOTY
// Usage: node src/app/scrape-basic.mjs [pages=5] [delay=5000]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Simple scraper for Album of the Year
 * @param {string} url - URL to scrape
 * @returns {Promise<Array>} - Array of album objects
 */
async function scrapeAlbums(url) {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    console.log(`Scraping URL: ${url}`);
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to the page
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log("Page loaded");
    
    // Wait a moment for JavaScript to execute
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'latest-page.png', fullPage: true });
    
    // Extract data with a simple approach
    const albums = await page.evaluate(() => {
      // Find all album links - they typically contain '/album/' in the URL
      const albumLinks = Array.from(document.querySelectorAll('a[href*="/album/"]'));
      console.log(`Found ${albumLinks.length} album links`);
      
      // Get unique album links (to avoid duplicates)
      const uniqueAlbumLinks = [...new Set(albumLinks.map(link => link.href))];
      console.log(`Found ${uniqueAlbumLinks.length} unique album links`);
      
      // Process each link
      const results = [];
      const processed = new Set(); // Track processed albums to avoid duplicates
      
      albumLinks.forEach((link, index) => {
        try {
          // Try to extract artist and album title from the link or nearby elements
          let artist = '';
          let album = link.textContent.trim();
          
          // Skip if this is not an album link
          if (!album || album.length < 2 || 
              album.includes('Login') || 
              album.includes('Sign up') ||
              album.includes('Search')) {
            return;
          }
          
          // Try to find artist - often it's in a parent element or previous sibling
          const parent = link.parentElement;
          if (parent) {
            // Look for artist in sibling elements
            const siblings = Array.from(parent.children);
            const artistElem = siblings.find(el => 
              el.className.includes('artist') || 
              (el.tagName === 'A' && el.href && el.href.includes('/artist/'))
            );
            
            if (artistElem) {
              artist = artistElem.textContent.trim();
            } else {
              // If no specific artist element, look in the parent's text
              const parentText = parent.textContent.trim();
              
              // Sometimes format is "Artist - Album"
              if (parentText.includes(' - ')) {
                const parts = parentText.split(' - ');
                if (parts.length >= 2) {
                  artist = parts[0].trim();
                  // Only use this album name if it seems more complete
                  if (parts[1].trim().length > album.length) {
                    album = parts[1].trim();
                  }
                }
              }
            }
          }
          
          // If still no artist, try the grandparent
          if (!artist && parent && parent.parentElement) {
            const grandparent = parent.parentElement;
            const artistElem = grandparent.querySelector('.artist, a[href*="/artist/"]');
            if (artistElem) {
              artist = artistElem.textContent.trim();
            }
          }
          
          // Clean up artist name - remove rank number (e.g., "1. Artist Name")
          if (artist) {
            // Remove rank number prefixes like "1. " or "#1. "
            artist = artist.replace(/^(#?\d+\.?\s+)/, '');
          }
          
          // Fix album name - remove artist prefix if the album starts with artist name
          if (artist && album.startsWith(artist)) {
            album = album.substring(artist.length).trim();
            // Remove separators at the beginning
            album = album.replace(/^[:\-–—]?\s*/, '');
          }
          
          // Extract year if possible
          let year = 0;
          const yearMatch = album.match(/\((\d{4})\)/) || album.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) {
            year = parseInt(yearMatch[1] || yearMatch[0], 10);
            // Remove year from album title if it's in parentheses
            album = album.replace(/\(\d{4}\)/, '').trim();
          }
          
          // Only add valid entries
          if (artist && album && !processed.has(`${artist}-${album}`)) {
            processed.add(`${artist}-${album}`);
            results.push({
              rank: index + 1,
              artist,
              album,
              year
            });
          }
        } catch (err) {
          console.error(`Error processing album ${index}:`, err);
        }
      });
      
      return results;
    });
    
    console.log(`Found ${albums.length} albums on page`);
    return albums;
  } catch (error) {
    console.error('Error scraping:', error);
    return [];
  } finally {
    await browser.close();
  }
}

/**
 * Process a single genre
 * @param {Object} genre - The genre to process
 * @param {number} pages - Number of pages to scrape
 * @param {number} delay - Delay between page requests
 * @param {string} dataDir - Directory to save data
 * @returns {Promise<number>} - Number of albums found
 */
async function processGenre(genre, pages, delay, dataDir) {
  console.log(`\n=== Processing genre: ${genre.name} (${pages} pages) ===`);
  
  // Array to hold all albums
  let allAlbums = [];
  
  // Scrape each page
  for (let page = 1; page <= pages; page++) {
    const pageUrl = page === 1 ? genre.url : `${genre.url}${page}/`;
    console.log(`\nScraping page ${page}/${pages}: ${pageUrl}`);
    
    const albums = await scrapeAlbums(pageUrl);
    
    if (albums.length > 0) {
      // Add page offset to ranks
      const pageOffset = (page - 1) * 25;
      const processedAlbums = albums.map(album => ({
        ...album,
        rank: pageOffset + album.rank,
        genre: genre.name
      }));
      
      allAlbums = [...allAlbums, ...processedAlbums];
      console.log(`Added ${processedAlbums.length} albums from page ${page}`);
    } else {
      console.warn(`No albums found on page ${page}`);
    }
    
    // Delay before next page
    if (page < pages) {
      console.log(`Waiting ${delay/1000} seconds before next page...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.log(`\nTotal albums found for ${genre.name}: ${allAlbums.length}`);
  
  if (allAlbums.length > 0) {
    // Save to JSON file
    const outputPath = path.join(dataDir, `${genre.name}-albums.json`);
    await fs.writeFile(outputPath, JSON.stringify({
      genre: genre.name,
      genreId: genre.id,
      sourceUrl: genre.url,
      albums: allAlbums,
      timestamp: new Date().toISOString(),
      totalAlbums: allAlbums.length,
      pagesScraped: pages
    }, null, 2));
    
    console.log(`Saved ${genre.name} data to ${outputPath}`);
  } else {
    console.error(`No albums found for ${genre.name}, skipping file creation`);
  }
  
  return allAlbums.length;
}

/**
 * Main function to run the scraper
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const pages = args[0] ? parseInt(args[0], 10) : 5;
    const delay = args[1] ? parseInt(args[1], 10) : 5000;
    const genreDelay = delay * 2; // Longer delay between genres
    
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'src', 'app', 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    // Read the genre-urls.json to get all genres
    const genreFilePath = path.join(__dirname, 'data', 'genre-urls.json');
    const genreData = JSON.parse(await fs.readFile(genreFilePath, 'utf-8'));
    
    if (!genreData.genres || !Array.isArray(genreData.genres)) {
      throw new Error('Invalid genre data format');
    }
    
    console.log(`Found ${genreData.genres.length} genres to scrape`);
    console.log(`Will scrape ${pages} pages per genre with ${delay}ms delay between requests`);
    
    // Process each genre one by one
    for (const [index, genre] of genreData.genres.entries()) {
      console.log(`\n[${index + 1}/${genreData.genres.length}] Starting genre: ${genre.name} (ID: ${genre.id})`);
      
      await processGenre(genre, pages, delay, dataDir);
      
      // Delay between genres to avoid overloading the server
      if (index < genreData.genres.length - 1) {
        console.log(`\nWaiting ${genreDelay/1000} seconds before processing next genre...`);
        await new Promise(resolve => setTimeout(resolve, genreDelay));
      }
    }
    
    console.log('\nAll genre scraping completed successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main().catch(console.error); 