import AlbumScraper from "@/app/components/AlbumScraper";
import Link from "next/link";

export const metadata = {
  title: "Album List Scraper",
  description: "Scrape album lists from Album of the Year and Pitchfork",
};

export default function ScraperPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Album List Scraper
      </h1>
      <p className="mb-6 text-center text-gray-600 max-w-2xl mx-auto">
        Enter a URL from Album of the Year or Pitchfork to scrape album, artist,
        and year information. The scraped data will be saved as a JSON file.
      </p>

      <div className="text-center mb-8">
        <Link
          href="/scraper/debug"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Advanced Debug Mode →
        </Link>
      </div>

      <AlbumScraper />
    </div>
  );
}
