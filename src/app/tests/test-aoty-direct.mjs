// Direct test for AOTY with a different URL structure
// Run with: node src/app/test-aoty-direct.mjs

import fs from 'fs/promises';

async function testDirectPagination() {
  try {
    // Different URL structure that has known pagination support
    // Using the "top rated albums of 2022" which should have 100+ entries
    const url = 'https://www.albumoftheyear.org/ratings/user-highest-rated/2022/';
    const pages = 4; // Each page should have 25 albums
    
    console.log('Testing AOTY scraper with a different URL structure...');
    console.log(`URL: ${url}`);
    console.log(`Pages: ${pages}`);
    
    const response = await fetch(
      `http://localhost:3000/api/scrape-aoty?url=${encodeURIComponent(url)}&pages=${pages}`,
      { method: 'GET' }
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error('API returned an error:', error);
      return;
    }
    
    const result = await response.json();
    const albums = result.data?.albums || [];
    
    console.log(`\nSuccessfully retrieved ${albums.length} albums!`);
    console.log(`Data saved to: ${result.filePath}`);
    
    // Show first 5 albums
    console.log('\nFirst 5 albums:');
    albums.slice(0, 5).forEach(album => {
      console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year || 'Unknown'})`);
    });
    
    // Show some middle albums if we have enough
    if (albums.length > 50) {
      const midIndex = Math.floor(albums.length / 2);
      console.log('\nSome middle albums:');
      albums.slice(midIndex - 2, midIndex + 3).forEach(album => {
        console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year || 'Unknown'})`);
      });
    }
    
    // Show last 5 albums
    console.log('\nLast 5 albums:');
    albums.slice(-5).forEach(album => {
      console.log(`${album.rank}. ${album.artist} - ${album.album} (${album.year || 'Unknown'})`);
    });
    
    // Save local copy
    await fs.writeFile('top-albums-2022.json', JSON.stringify(result.data, null, 2));
    console.log('\nAlso saved data to top-albums-2022.json');
    
    // Print count by page to verify pagination worked correctly
    const pageCounts = {};
    albums.forEach(album => {
      const page = Math.ceil(album.rank / 25);
      pageCounts[page] = (pageCounts[page] || 0) + 1;
    });
    
    console.log('\nAlbums per page:');
    Object.entries(pageCounts)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([page, count]) => {
        console.log(`Page ${page}: ${count} albums`);
      });
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error running test:', error);
  }
}

testDirectPagination().catch(console.error); 