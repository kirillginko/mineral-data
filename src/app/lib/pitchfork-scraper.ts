import axios from 'axios';
import * as cheerio from 'cheerio';
import { Album, ScrapedData } from './scraper';

/**
 * Specialized scraper for Pitchfork's "The 50 Best..." or similar list articles
 */
export async function scrapePitchforkList(url: string): Promise<ScrapedData> {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const albums: Album[] = [];
    
    // Get article title to determine type of content
    const articleTitle = $('.article__header-inner h1').text().trim();
    console.log(`Scraping article: ${articleTitle}`);
    
    // Specific selectors for Pitchfork list articles
    // Each entry typically has a number, artist name, album name, and year
    $('.body__list-item').each((index, element) => {
      try {
        // Extract rank - often a number at the beginning
        let rank = index + 1;
        const rankText = $(element).find('.list-item-number, h2').text().trim();
        const rankMatch = rankText.match(/^(\d+)[:.]/);
        if (rankMatch) {
          rank = parseInt(rankMatch[1], 10);
        }
        
        // Artist and album might be in different elements
        // or formatted like "Artist: Album Title"
        let artist = '';
        let album = '';
        
        // Try different common patterns
        const headingText = $(element).find('h2').text().trim();
        
        // Pattern: "XX. Artist Name: Album Title"
        const splitHeading = headingText.replace(/^\d+[:.]\s*/, '').split(':');
        
        if (splitHeading.length > 1) {
          artist = splitHeading[0].trim();
          album = splitHeading[1].trim();
        } else {
          // Try to find separate elements for artist and album
          artist = $(element).find('.artist-name, .title-artist, h3').first().text().trim();
          album = $(element).find('.album-title, .title-work, h3').eq(1).text().trim();
          
          // If still not found, look for specific formatting clues
          if (!artist || !album) {
            const allText = $(element).text();
            
            // Look for patterns like "Artist Name / Album Title" or "Artist Name - Album Title"
            const splitBySlash = allText.split(/\s*\/\s*/);
            const splitByDash = allText.split(/\s*[-–—]\s*/);
            
            if (splitBySlash.length > 1) {
              artist = splitBySlash[0].trim();
              album = splitBySlash[1].trim();
            } else if (splitByDash.length > 1) {
              artist = splitByDash[0].trim();
              album = splitByDash[1].trim();
            }
          }
        }
        
        // Extract year - look for 4-digit numbers in text
        let year = 0;
        const yearMatch = $(element).text().match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          year = parseInt(yearMatch[0], 10);
        }
        
        // Clean up artist and album further
        artist = artist.replace(/^\d+[:.]\s*/, ''); // Remove any leading numbers
        
        if (artist && album) {
          albums.push({
            rank,
            artist,
            album,
            year
          });
        }
      } catch (err) {
        console.warn(`Error parsing item ${index}:`, err);
      }
    });
    
    // If we couldn't find anything with the specialized selectors,
    // try some more generic ones for different Pitchfork layouts
    if (albums.length === 0) {
      $('div[data-type="list-item"], div.list-entry, div.expert-review, div.review').each((index, element) => {
        try {
          // Many Pitchfork layouts have the artist and album close to an image
          const artist = $(element).find('h2, .title-artist, .artist-name').first().text().trim();
          const album = $(element).find('h3, .title-work, .album-title').first().text().trim();
          
          // Extract year - look for 4-digit numbers in text
          let year = 0;
          const yearMatch = $(element).text().match(/\b(19|20)\d{2}\b/);
          if (yearMatch) {
            year = parseInt(yearMatch[0], 10);
          }
          
          if (artist && album) {
            albums.push({
              rank: index + 1,
              artist,
              album,
              year
            });
          }
        } catch (err) {
          console.warn(`Error parsing item ${index} in fallback:`, err);
        }
      });
    }

    console.log(`Found ${albums.length} albums`);
    return { albums };
  } catch (error) {
    console.error('Error scraping Pitchfork list:', error);
    throw error;
  }
} 