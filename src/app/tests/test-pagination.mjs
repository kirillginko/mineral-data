// Test script for AOTY scraper with pagination
// Run with: node src/app/test-pagination.mjs

import fetch from 'node-fetch';
import fs from 'fs/promises';

async function testPagination() {
  try {
    // Define the base URL of your Next.js app
    const baseUrl = 'http://localhost:3000';
    
    // The target AOTY URL to scrape - using Ambient genre as an example
    const targetUrl = 'https://www.albumoftheyear.org/genre/34-ambient/all/';
    
    // Number of pages to scrape
    const pages = 4; // Will get ~100 albums (25 per page)
    
    console.log(`Testing pagination scraper with ${pages} pages from ${targetUrl}`);
    
    // Call the API endpoint with pagination
    const response = await fetch(
      `${baseUrl}/api/scrape-aoty?url=${encodeURIComponent(targetUrl)}&pages=${pages}`,
      { method: 'GET' }
    );
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`Success! Scraped ${result.data.albums.length} albums from ${pages} pages`);
      console.log(`Data saved to: ${result.filePath}`);
      
      // Save the results to a local file for inspection
      await fs.writeFile(
        'pagination-test-results.json', 
        JSON.stringify(result.data, null, 2)
      );
      console.log('Results also saved to pagination-test-results.json');
      
      // Show the first 5 albums for quick verification
      console.log('\nSample of scraped albums:');
      result.data.albums.slice(0, 5).forEach(album => {
        console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year || 'Unknown Year'})`);
      });
      
      // Show the last 5 albums to verify we have data from later pages
      console.log('\nSample of albums from later pages:');
      const lastFive = result.data.albums.slice(-5);
      lastFive.forEach(album => {
        console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year || 'Unknown Year'})`);
      });
      
      console.log(`\nTotal albums: ${result.data.albums.length}`);
    } else {
      console.error('Error from API:', result.error);
      console.error('Message:', result.message || 'No additional message');
    }
  } catch (error) {
    console.error('Script error:', error);
  }
}

testPagination().catch(console.error); 