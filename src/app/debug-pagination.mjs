// Debug script for AOTY pagination issues
// Run with: node src/app/debug-pagination.mjs

import fs from 'fs/promises';

async function debugPagination() {
  try {
    // Define the base URL of your Next.js app
    const baseUrl = 'http://localhost:3000';
    
    // The URL to scrape
    const targetUrl = 'https://www.albumoftheyear.org/genre/34-ambient/all/';
    
    // Number of pages to scrape
    const pages = 4;
    
    console.log('=== Debugging AOTY Pagination ===');
    console.log(`Target: ${targetUrl}`);
    console.log(`Pages requested: ${pages}`);
    console.log('Starting API request...');
    
    const startTime = Date.now();
    
    // Make the API request using native fetch
    const response = await fetch(
      `${baseUrl}/api/scrape-aoty?url=${encodeURIComponent(targetUrl)}&pages=${pages}`,
      { method: 'GET' }
    );
    
    const responseTime = Date.now() - startTime;
    console.log(`API response time: ${responseTime / 1000} seconds`);
    
    const result = await response.json();
    
    // Save full response for inspection
    await fs.writeFile('debug-response.json', JSON.stringify(result, null, 2));
    console.log('Full API response saved to debug-response.json');
    
    if (response.ok) {
      const albums = result.data?.albums || [];
      console.log(`\nAlbums retrieved: ${albums.length}`);
      
      // Analyze rank distribution to check pagination
      const rankCounts = {};
      albums.forEach(album => {
        const rank = album.rank;
        if (!rankCounts[rank]) {
          rankCounts[rank] = 0;
        }
        rankCounts[rank]++;
      });
      
      // Check for duplicate ranks (might indicate pagination issues)
      const duplicateRanks = Object.entries(rankCounts)
        .filter(([, count]) => count > 1)
        .map(([rank, count]) => `Rank ${rank}: ${count} occurrences`);
      
      if (duplicateRanks.length > 0) {
        console.log('\n⚠️ FOUND DUPLICATE RANKS:');
        duplicateRanks.forEach(msg => console.log(msg));
      } else {
        console.log('\n✅ No duplicate ranks found');
      }
      
      // Check rank ranges to verify pagination
      const ranks = albums.map(album => album.rank).sort((a, b) => a - b);
      const lowestRank = ranks[0];
      const highestRank = ranks[ranks.length - 1];
      
      console.log(`\nRank range: ${lowestRank} to ${highestRank}`);
      console.log(`Expected rank range for ${pages} pages: 1 to ~${pages * 25}`);
      
      // Sample from beginning, middle, and end
      console.log('\nSamples from data:');
      console.log('FIRST 3 ALBUMS:');
      albums.slice(0, 3).forEach(album => {
        console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year || 'N/A'})`);
      });
      
      if (albums.length > 30) {
        const midPoint = Math.floor(albums.length / 2);
        console.log('\nMIDDLE 3 ALBUMS:');
        albums.slice(midPoint - 1, midPoint + 2).forEach(album => {
          console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year || 'N/A'})`);
        });
      }
      
      console.log('\nLAST 3 ALBUMS:');
      albums.slice(-3).forEach(album => {
        console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year || 'N/A'})`);
      });
    } else {
      console.error('API returned an error:', result.error);
      console.error('Message:', result.message || 'No additional message');
    }
  } catch (error) {
    console.error('Script error:', error);
  }
}

debugPagination().catch(console.error); 