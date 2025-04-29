import axios from 'axios';
import * as cheerio from 'cheerio';
import { Album, ScrapedData } from './scraper';

/**
 * Specialized scraper for Album of the Year (albumoftheyear.org) genre pages
 */
export async function scrapeAlbumOfTheYear(url: string): Promise<ScrapedData> {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const albums: Album[] = [];
    
    // Get page title for logging
    const pageTitle = $('title').text().trim();
    console.log(`Scraping AOTY page: ${pageTitle}`);
    
    // AOTY lists albums in a consistent format with albumListItem class
    $('.albumListItem').each((index, element) => {
      try {
        // Get rank if available
        const rankText = $(element).find('.albumListRank').text().trim();
        const rank = rankText ? parseInt(rankText, 10) : index + 1;
        
        // Get artist name
        const artist = $(element).find('.albumListArtist').text().trim();
        
        // Get album name
        const album = $(element).find('.albumListTitle').text().trim();
        
        // Get year - AOTY typically has this in the release date section
        let year = 0;
        const dateText = $(element).find('.albumListDate').text().trim();
        const yearMatch = dateText.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          year = parseInt(yearMatch[0], 10);
        }
        
        if (artist && album) {
          albums.push({ rank, artist, album, year });
        }
      } catch (err) {
        console.warn(`Error parsing item ${index}:`, err);
      }
    });
    
    // If the primary selector didn't work, try some alternative selectors
    // as the site might have different layouts for different pages
    if (albums.length === 0) {
      $('.albumBlock, .albumGridItem').each((index, element) => {
        try {
          // Get artist name - might be in different elements
          const artist = $(element).find('.artistTitle, .albumBlockArtist').text().trim();
          
          // Get album name
          const album = $(element).find('.albumTitle, .albumBlockTitle').text().trim();
          
          // Get year
          let year = 0;
          const dateText = $(element).find('.albumDate, .albumBlockDate, .albumYear').text().trim();
          const yearMatch = dateText.match(/\b(19|20)\d{2}\b/);
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
    
    // Final fallback for any layout changes
    if (albums.length === 0) {
      $('[itemtype="http://schema.org/MusicAlbum"]').each((index, element) => {
        try {
          const artist = $(element).find('[itemprop="byArtist"], .artist').text().trim();
          const album = $(element).find('[itemprop="name"], .name').text().trim();
          
          let year = 0;
          const dateText = $(element).text();
          const yearMatch = dateText.match(/\b(19|20)\d{2}\b/);
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
          console.warn(`Error parsing item ${index} in schema fallback:`, err);
        }
      });
    }

    console.log(`Found ${albums.length} albums`);
    return { albums };
  } catch (error) {
    console.error('Error scraping Album of the Year:', error);
    throw error;
  }
} 