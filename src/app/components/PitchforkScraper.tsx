"use client";

import { useState } from "react";
import { Album } from "@/app/lib/scraper";

interface ScraperResult {
  success: boolean;
  message: string;
  data: {
    albums: Album[];
  };
  filePath: string;
}

export default function PitchforkScraper() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScraperResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `/api/scrape-pitchfork?url=${encodeURIComponent(url)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Failed to scrape the URL"
        );
      }

      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Pitchfork Album Scraper</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="url"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Pitchfork URL
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://pitchfork.com/features/lists-and-guides/..."
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isLoading ? "Scraping..." : "Scrape Albums"}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-2">Results</h3>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
            <p className="mb-2 text-green-700">{result.message}</p>
            <p className="mb-2">
              Saved to:{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">
                {result.filePath}
              </code>
            </p>

            {result.data?.albums && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">
                  Albums Found: {result.data.albums.length}
                </h4>
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rank
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Artist
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Album
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Year
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.data.albums.map((album: Album, index: number) => (
                        <tr key={index}>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {album.rank || index + 1}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {album.artist}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {album.album}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {album.year || "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
