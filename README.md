# Album List Scraper

A Next.js application for scraping album lists from music websites like Album of the Year and Pitchfork, allowing you to extract artist names, album titles, and release years into structured JSON data.

## Features

- 🔍 Scrape album lists from Album of the Year and Pitchfork
- 📊 Extract artist, album, and year information
- 💾 Save results as JSON files
- 🌐 Simple web interface for easy usage
- 🛠️ Robust error handling and fallback scraping approaches

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000/scraper](http://localhost:3000/scraper) with your browser

## How to Use

1. Navigate to the Scraper page at `/scraper`
2. Select your source (Album of the Year or Pitchfork)
3. Enter a URL in the input field:
   - For Album of the Year: `https://www.albumoftheyear.org/genre/34-ambient/all/`
   - For Pitchfork: `https://pitchfork.com/features/lists-and-guides/the-50-best-idm-albums-of-all-time/`
4. Click "Scrape Albums"
5. The application will extract album information and display it in a table
6. Results are automatically saved to the `src/app/data` directory as JSON files

## API Usage

You can also use the scraper API directly:

For Album of the Year:

```
GET /api/scrape-aoty?url=https://www.albumoftheyear.org/genre/34-ambient/all/
```

For Pitchfork:

```
GET /api/scrape-pitchfork?url=https://pitchfork.com/features/lists-and-guides/the-50-best-idm-albums-of-all-time/
```

## Technical Details

The scraper uses a combination of approaches:

1. Specialized parsers for each website:
   - `aoty-scraper.ts` for Album of the Year
   - `pitchfork-scraper.ts` for Pitchfork
2. A generic fallback scraper using Cheerio (`scraper.ts`)

All scraper implementations handle different page layouts and content structures, with fallback mechanisms to ensure the most comprehensive data extraction possible.

## Additional Notes

- The scrapers respect each website's HTML structure but may need updates if website layouts change
- For dynamic JavaScript-rendered content, consider uncommenting and using the Puppeteer implementation (requires `npm install puppeteer`)
