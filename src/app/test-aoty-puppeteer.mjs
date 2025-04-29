import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testAOTYPuppeteerScraper() {
  try {
    // Import the scraper dynamically
    const { scrapeAlbumOfTheYearWithPuppeteer } = await import('../lib/aoty-puppeteer.js');
    
    // Set parameters
    const url = 'https://www.albumoftheyear.org/ratings/user-highest-rated/2022/';
    const pages = 4; // Try to get 4 pages (~ 100 albums)
    
    console.log(`Testing AOTY Puppeteer Scraper on ${url} for ${pages} pages...`);
    
    // Run the scraper
    const result = await scrapeAlbumOfTheYearWithPuppeteer(url, pages);
    
    // Process results
    const albums = result.albums || [];
    console.log(`Total albums retrieved: ${albums.length}`);
    
    if (albums.length > 0) {
      // Show the first 5 albums
      console.log('\nFirst 5 albums:');
      albums.slice(0, 5).forEach(album => {
        console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year})`);
      });
      
      // Show some middle albums if available
      if (albums.length > 20) {
        console.log('\nSome middle albums:');
        const middleIndex = Math.floor(albums.length / 2);
        albums.slice(middleIndex - 2, middleIndex + 3).forEach(album => {
          console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year})`);
        });
      }
      
      // Show the last 5 albums
      console.log('\nLast 5 albums:');
      albums.slice(-5).forEach(album => {
        console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year})`);
      });
      
      // Count albums per page
      const albumsPerPage = {};
      albums.forEach(album => {
        const page = Math.floor((album.rank - 1) / 25) + 1;
        albumsPerPage[page] = (albumsPerPage[page] || 0) + 1;
      });
      
      console.log('\nAlbums per page:');
      Object.entries(albumsPerPage).forEach(([page, count]) => {
        console.log(`Page ${page}: ${count} albums`);
      });
      
      // Save to file
      const dataDir = join(__dirname, 'data');
      await fs.mkdir(dataDir, { recursive: true });
      
      // Generate a filename based on the URL
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      const filenameBase = `aoty-${pathSegments.join('-')}-${pages}pages-albums`;
      const filepath = join(dataDir, `${filenameBase}.json`);
      
      await fs.writeFile(filepath, JSON.stringify(albums, null, 2));
      console.log(`\nSaved ${albums.length} albums to ${filepath}`);
      
      // Also save to a simple name for easy reference
      const simpleFilepath = join(dataDir, 'top-albums-2022-puppeteer.json');
      await fs.writeFile(simpleFilepath, JSON.stringify(albums, null, 2));
      console.log(`Also saved to ${simpleFilepath}`);
    } else {
      console.log('No albums found! Please check the URL and selectors.');
    }
    
    console.log('\nScraper test completed');
  } catch (error) {
    console.error('Error in AOTY Puppeteer scraper test:', error);
  }
}

// Run the test
testAOTYPuppeteerScraper(); 