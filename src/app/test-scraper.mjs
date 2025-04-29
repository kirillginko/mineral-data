// This is a test script to validate Puppeteer can access albumoftheyear.org
// Run with: node src/app/test-scraper.mjs

import puppeteer from 'puppeteer';
import fs from 'fs';

async function testScraper() {
  console.log('Starting test scraper...');
  
  const browser = await puppeteer.launch({
    headless: false, // Use a visible browser for debugging
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920x1080'
    ]
  });

  try {
    const url = 'https://www.albumoftheyear.org/genre/34-ambient/all/';
    console.log(`Navigating to: ${url}`);
    
    const page = await browser.newPage();
    
    // Enable request interception to see what's happening
    await page.setRequestInterception(true);
    
    // Log all requests for debugging
    page.on('request', request => {
      console.log(`Request: ${request.method()} ${request.url().substring(0, 100)}...`);
      request.continue();
    });
    
    // Log console messages from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Cache-Control': 'max-age=0'
    });
    
    // Navigation with longer timeout
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 90000  // 90 seconds
    });
    
    // Check if we hit Cloudflare
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'test-screenshot.png' });
    console.log('Screenshot saved to test-screenshot.png');
    
    // Wait for user to verify (if using headless: false)
    console.log('Waiting 5 seconds for manual verification...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Detailed debugging of the page structure
    const pageStructure = await page.evaluate(() => {
      // First check for album list rows
      const albumRows = document.querySelectorAll('.albumListRow');
      console.log(`Found ${albumRows.length} albumListRow elements`);
      
      // Get sample of album rows HTML
      const sampleRows = Array.from(albumRows).slice(0, 3).map(row => row.outerHTML);
      
      // Check for album covers
      const albumCovers = document.querySelectorAll('.albumListCover');
      console.log(`Found ${albumCovers.length} albumListCover elements`);
      
      // Get sample of album covers HTML
      const sampleCovers = Array.from(albumCovers).slice(0, 3).map(cover => cover.outerHTML);
      
      // Find all elements with 'album' in class name
      const albumElements = document.querySelectorAll('[class*="album" i]');
      console.log(`Found ${albumElements.length} elements with 'album' in class name`);
      
      // Try to find actual album data
      const albumData = [];
      albumRows.forEach((row, index) => {
        try {
          const rank = row.querySelector('.albumListRank')?.textContent?.trim();
          const title = row.querySelector('.albumListTitle')?.textContent?.trim();
          const date = row.querySelector('.albumListDate')?.textContent?.trim();
          
          if (title) {
            albumData.push({ rank, title, date });
          }
        } catch (e) {
          console.error(`Error parsing row ${index}:`, e);
        }
      });
      
      // Get all class names in the document
      const allClasses = new Set();
      document.querySelectorAll('*').forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(cls => allClasses.add(cls));
        }
      });
      
      return {
        albumRowsCount: albumRows.length,
        albumCoversCount: albumCovers.length,
        albumElementsCount: albumElements.length,
        sampleRows,
        sampleCovers,
        albumData: albumData.slice(0, 5), // Just show first 5 for sample
        allClasses: Array.from(allClasses).filter(cls => 
          cls.toLowerCase().includes('album') || 
          cls.toLowerCase().includes('artist') || 
          cls.toLowerCase().includes('list')
        )
      };
    });
    
    // Log the structure details
    console.log('=== Page Structure Analysis ===');
    console.log(`Album Rows: ${pageStructure.albumRowsCount}`);
    console.log(`Album Covers: ${pageStructure.albumCoversCount}`);
    console.log(`Album Elements: ${pageStructure.albumElementsCount}`);
    
    console.log('\n=== Album-related Classes ===');
    console.log(pageStructure.allClasses);
    
    console.log('\n=== Sample Album Data ===');
    console.log(JSON.stringify(pageStructure.albumData, null, 2));
    
    if (pageStructure.sampleRows.length > 0) {
      console.log('\n=== Sample Row HTML ===');
      console.log(pageStructure.sampleRows[0].substring(0, 500) + '...');
    }
    
    if (pageStructure.sampleCovers.length > 0) {
      console.log('\n=== Sample Cover HTML ===');
      console.log(pageStructure.sampleCovers[0].substring(0, 500) + '...');
    }
    
    // Save full HTML for analysis
    const html = await page.content();
    fs.writeFileSync('page-content.html', html);
    console.log('Full HTML saved to page-content.html');
    
    console.log('\nTest completed successfully');
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    // Keep browser open a bit longer if debugging
    console.log('Keeping browser open for 5 more seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Close the browser
    await browser.close();
    console.log('Browser closed');
  }
}

testScraper().catch(console.error); 