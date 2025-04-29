import { NextRequest, NextResponse } from 'next/server';
import { scrapeWithCheerio, saveToJson, ScrapedData } from '@/app/lib/scraper';
import { scrapePitchforkList } from '@/app/lib/pitchfork-scraper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get URL from the query parameter
    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
      return NextResponse.json(
        { error: 'Missing URL parameter' },
        { status: 400 }
      );
    }
    
    // Validate the URL is from Pitchfork
    if (!url.includes('pitchfork.com')) {
      return NextResponse.json(
        { error: 'URL must be from pitchfork.com' },
        { status: 400 }
      );
    }
    
    // Try the specialized Pitchfork scraper first, then fall back to the generic one if needed
    let data: ScrapedData;
    
    try {
      data = await scrapePitchforkList(url);
      
      // If specialized scraper didn't find anything, fall back to the generic scraper
      if (data.albums.length === 0) {
        console.log('Specialized scraper found no albums, trying generic scraper...');
        data = await scrapeWithCheerio(url);
      }
    } catch (error) {
      console.log('Error with specialized scraper, falling back to generic scraper:', error);
      data = await scrapeWithCheerio(url);
    }
    
    // Only save if we found some albums
    if (data.albums.length > 0) {
      // Generate filename from URL
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.replace(/\//g, '-').slice(1);
      const filename = `${pathname || 'pitchfork'}-albums.json`;
      
      // Save to JSON file
      const filePath = await saveToJson(data, filename);
      
      return NextResponse.json({
        success: true,
        message: `Successfully scraped ${data.albums.length} albums`,
        data,
        filePath
      });
    } else {
      return NextResponse.json(
        { 
          error: 'No albums found at the provided URL. The page structure might not match our scraper.',
          data 
        },
        { status: 404 }
      );
    }
    
  } catch (error) {
    console.error('Error in scrape-pitchfork API:', error);
    return NextResponse.json(
      { error: 'Failed to scrape the URL', message: (error as Error).message },
      { status: 500 }
    );
  }
} 