import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { scrapeAlbumOfTheYearWithPuppeteer } from '@/app/lib/aoty-puppeteer';

/**
 * API endpoint for scraping Album of the Year website
 * @param req Request object
 * @returns JSON response with scraped data
 */
export async function GET(req: NextRequest) {
  try {
    // Get URL parameter
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
      return NextResponse.json(
        { error: 'Missing required parameter: url' },
        { status: 400 }
      );
    }

    // Get pages parameter (optional)
    const pages = parseInt(req.nextUrl.searchParams.get('pages') || '1', 10);
    if (isNaN(pages) || pages < 1 || pages > 10) {
      return NextResponse.json(
        { error: 'Invalid pages parameter: must be between 1-10' },
        { status: 400 }
      );
    }

    // Validate that the URL is from albumoftheyear.org
    if (!url.includes('albumoftheyear.org')) {
      return NextResponse.json(
        { error: 'URL must be from albumoftheyear.org domain' },
        { status: 400 }
      );
    }

    // Execute the scraper
    console.log(`Starting AOTY scraper with URL: ${url}, pages: ${pages}`);
    const data = await scrapeAlbumOfTheYearWithPuppeteer(url, pages);

    // Create output directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'public', 'data');
    await fs.mkdir(dataDir, { recursive: true });

    // Generate filename from URL pathname
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname
      .split('/')
      .filter(segment => segment)
      .join('-')
      .replace(/[^\w-]/g, '_');
    
    // Add optional year segment if present
    const year = url.match(/\b(19|20)\d{2}\b/)?.[0] || '';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    
    const filename = `aoty_${pathSegments}${year ? `_${year}` : ''}_${timestamp}.json`;
    const filePath = path.join(dataDir, filename);

    // Write data to file
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    
    // Return success response with data and file info
    return NextResponse.json({ 
      success: true,
      data,
      filePath: `/data/${filename}`,
      albumCount: data.albums.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error scraping AOTY:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
} 