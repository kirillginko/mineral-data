import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { scrapeAlbumOfTheYearWithPuppeteer } from "./lib/aoty-puppeteer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Test function for the AOTY puppeteer scraper
 */
async function testAOTYPuppeteerScraper() {
  try {
    // Initialize directories
    const dataDir = path.join(__dirname, "..", "..", "data");
    await fs.mkdir(dataDir, { recursive: true });

    // Set the URL to scrape and number of pages
    // Using the specified rock genre page as requested by the user
    const url = "https://www.albumoftheyear.org/genre/7-rock/all/";
    const pagesToScrape = 4;

    console.log(`Starting scrape of ${url} for ${pagesToScrape} pages...`);

    // Call the scraper function
    const results = await scrapeAlbumOfTheYearWithPuppeteer(url, pagesToScrape);

    console.log(`Total albums retrieved: ${results.albums.length}`);

    // Display some sample results
    if (results.albums.length > 0) {
      console.log("\nFirst 5 albums:");
      results.albums.slice(0, 5).forEach((album) => {
        console.log(
          `${album.rank}. ${album.artist} - ${album.album} (${
            album.year || "N/A"
          })`
        );
      });

      if (results.albums.length > 10) {
        console.log("\nSome middle albums:");
        const middleStart = Math.floor(results.albums.length / 2) - 2;
        results.albums.slice(middleStart, middleStart + 5).forEach((album) => {
          console.log(
            `${album.rank}. ${album.artist} - ${album.album} (${
              album.year || "N/A"
            })`
          );
        });
      }

      if (results.albums.length > 5) {
        console.log("\nLast 5 albums:");
        results.albums.slice(-5).forEach((album) => {
          console.log(
            `${album.rank}. ${album.artist} - ${album.album} (${
              album.year || "N/A"
            })`
          );
        });
      }

      // Count albums per page
      const albumsPerPage = {};
      results.albums.forEach((album) => {
        const page = Math.floor((album.rank - 1) / 25) + 1;
        albumsPerPage[page] = (albumsPerPage[page] || 0) + 1;
      });

      console.log("\nAlbums per page:");
      Object.entries(albumsPerPage).forEach(([page, count]) => {
        console.log(`Page ${page}: ${count} albums`);
      });
    }

    // Save the results to a JSON file
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname
      .split("/")
      .filter((segment) => segment);

    // Create a detailed filename with timestamp and path info
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const pathInfo = pathSegments.join("-").replace(/[^\w-]/g, "_");
    const detailedFilename = `aoty_${pathInfo}_${timestamp}.json`;

    // Create a simpler filename for easier reference
    const year =
      pathSegments.find((segment) => /^\d{4}$/.test(segment)) || "unknown";
    const category = pathSegments
      .filter((segment) => !/^\d{4}$/.test(segment))
      .join("-")
      .replace(/[^\w-]/g, "_");
    const simpleFilename = `aoty_${category}_${year}.json`;

    // Save to both filenames
    const detailedPath = path.join(dataDir, detailedFilename);
    await fs.writeFile(detailedPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${detailedPath}`);

    const simplePath = path.join(dataDir, simpleFilename);
    await fs.writeFile(simplePath, JSON.stringify(results, null, 2));
    console.log(`Results also saved to: ${simplePath}`);

    return results;
  } catch (error) {
    console.error("Error in test function:", error);
    throw error;
  }
}

// Execute the test function
testAOTYPuppeteerScraper()
  .then(() => {
    console.log("Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
