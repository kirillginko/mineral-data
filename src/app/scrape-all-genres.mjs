// Script to scrape multiple genre lists from AOTY
// Usage: node src/app/scrape-all-genres.mjs [pages=4] [delay=5000]

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    const dataDir = path.join(process.cwd(), 'data');
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
          const response = await fetch(
            `http://localhost:3000/api/scrape-aoty?url=${encodeURIComponent(pageUrl)}&pages=1`,
            { method: 'GET' }
          );
          
          if (!response.ok) {
            const error = await response.json();
            console.error(`Error on ${genre.name} page ${page}:`, error);
            continue; // Try next page even if this one fails
          }
          
          const result = await response.json();
          const albums = result.data?.albums || [];
          
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
    console.error('Error in scrape-all-genres script:', error);
  }
}

// Get parameters from command line arguments
const args = process.argv.slice(2);
const pages = args[0] ? parseInt(args[0], 10) : 4;
const delay = args[1] ? parseInt(args[1], 10) : 5000;

// Run the scraper
scrapeAllGenres(pages, delay).catch(console.error); 