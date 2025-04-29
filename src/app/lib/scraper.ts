import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFile } from 'fs/promises';
import path from 'path';

// Types for our album data
export interface Album {
  rank?: number;
  artist: string;
  album: string;
  year: number;
}

export interface ScrapedData {
  albums: Album[];
}

/**
 * Scrapes a Pitchfork list page using Cheerio (for static content)
 */
export async function scrapeWithCheerio(url: string): Promise<ScrapedData> {
  try {
    // Fetch the HTML content
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const albums: Album[] = [];
    
    // Selectors will need to be adjusted based on Pitchfork's actual HTML structure
    $('.list-item, .ranking-item, .article-item').each((index, element) => {
      // These selectors are likely to change based on Pitchfork's actual HTML
      const artist = $(element).find('.artist-name, .title-artist').text().trim();
      const album = $(element).find('.album-title, .title-work').text().trim();
      
      // Extract year - may be in different formats
      const yearText = $(element).find('.year, .pub-date').text().trim();
      // If year is in a format like (1998) or [1998], extract just the number
      const yearMatch = yearText.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0], 10) : 0;
      
      if (artist && album) {
        albums.push({
          rank: index + 1,
          artist,
          album,
          year
        });
      }
    });

    return { albums };
  } catch (error) {
    console.error('Error scraping with Cheerio:', error);
    throw error;
  }
}

/**
 * Saves the scraped data to a JSON file
 */
export async function saveToJson(data: ScrapedData, filename: string): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), 'src', 'app', 'data', filename);
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return filePath;
  } catch (error) {
    console.error('Error saving to JSON:', error);
    throw error;
  }
}

// For Puppeteer implementation, you'll need to install it first:
// npm install puppeteer
/*
import puppeteer from 'puppeteer';

export async function scrapeWithPuppeteer(url: string): Promise<ScrapedData> {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Wait for the content to be loaded
    await page.waitForSelector('.list-item, .ranking-item, .article-item');
    
    // Extract the data
    const albums = await page.evaluate(() => {
      const items = document.querySelectorAll('.list-item, .ranking-item, .article-item');
      return Array.from(items).map((item, index) => {
        const artist = item.querySelector('.artist-name, .title-artist')?.textContent?.trim() || '';
        const album = item.querySelector('.album-title, .title-work')?.textContent?.trim() || '';
        
        // Extract year
        const yearElement = item.querySelector('.year, .pub-date');
        let year = 0;
        if (yearElement) {
          const yearMatch = yearElement.textContent?.match(/\d{4}/);
          year = yearMatch ? parseInt(yearMatch[0], 10) : 0;
        }
        
        return { rank: index + 1, artist, album, year };
      }).filter(item => item.artist && item.album);
    });
    
    return { albums };
  } catch (error) {
    console.error('Error scraping with Puppeteer:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
*/ 