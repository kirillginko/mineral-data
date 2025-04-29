// Simple test script for AOTY pagination
// Run with: node src/app/test-scraper-simple.mjs

import fs from 'fs/promises';

async function testScraperWithPagination() {
  try {
    // Using localhost:3000 as the base URL - make sure Next.js is running
    // Use rock genre URL as specified
    const baseUrl = 'https://www.albumoftheyear.org/genre/7-rock/all/';
    const totalPages = 4; // Try to get 4 pages
    
    console.log('Testing AOTY scraper with multi-page approach...');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Target pages: ${totalPages}`);
    
    // Array to hold all albums
    let allAlbums = [];
    
    // Scrape each page individually to avoid Cloudflare blocking pagination
    for (let page = 1; page <= totalPages; page++) {
      // Construct the page URL - for first page, use base URL
      // For subsequent pages, add page number
      const pageUrl = page === 1 ? baseUrl : `${baseUrl}${page}/`;
      
      console.log(`\nScraping page ${page}/${totalPages}: ${pageUrl}`);
      
      try {
        const response = await fetch(
          `http://localhost:3000/api/scrape-aoty?url=${encodeURIComponent(pageUrl)}&pages=1`,
          { method: 'GET' }
        );
        
        if (!response.ok) {
          const error = await response.json();
          console.error(`Error on page ${page}:`, error);
          continue; // Try next page even if this one fails
        }
        
        const result = await response.json();
        const albums = result.data?.albums || [];
        
        console.log(`Retrieved ${albums.length} albums from page ${page}`);
        
        // Add to our collection, adjust ranks to maintain order
        if (albums.length > 0) {
          const pageOffset = (page - 1) * 25;
          const processedAlbums = albums.map(album => ({
            ...album,
            rank: pageOffset + album.rank // Keep original rank if available, or calculate
          }));
          
          allAlbums = [...allAlbums, ...processedAlbums];
        }
        
        // Simple delay to avoid overwhelming the server
        console.log(`Waiting 5 seconds before next request...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (pageError) {
        console.error(`Failed to scrape page ${page}:`, pageError);
      }
    }
    
    console.log(`\nScraped a total of ${allAlbums.length} albums across ${totalPages} pages.`);
    
    // Show first 5 albums
    if (allAlbums.length > 0) {
      console.log('\nFirst 5 albums:');
      allAlbums.slice(0, 5).forEach(album => {
        console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year || 'Unknown'})`);
      });
      
      // Show some middle albums to verify middle pages worked
      if (allAlbums.length > 30) {
        const midIndex = Math.floor(allAlbums.length / 2);
        console.log('\nSome middle albums:');
        allAlbums.slice(midIndex - 2, midIndex + 3).forEach(album => {
          console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year || 'Unknown'})`);
        });
      }
      
      // Show last 5 albums to verify pagination worked
      console.log('\nLast 5 albums:');
      allAlbums.slice(-5).forEach(album => {
        console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year || 'Unknown'})`);
      });
      
      // Save a local copy for inspection
      const filename = 'rock-albums-multi-page.json';
      await fs.writeFile(filename, JSON.stringify({ albums: allAlbums }, null, 2));
      console.log(`\nSaved data to ${filename}`);
    } else {
      console.log('No albums retrieved. Check if the server is running and the API is working correctly.');
    }
  } catch (error) {
    console.error('Error running test:', error);
  }
}

testScraperWithPagination().catch(console.error); 