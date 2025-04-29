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

type ScraperSource = "pitchfork" | "aoty";

export default function AlbumScraper() {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<ScraperSource>("aoty");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScraperResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const endpoint =
        source === "pitchfork" ? "scrape-pitchfork" : "scrape-aoty";
      const response = await fetch(
        `/api/${endpoint}?url=${encodeURIComponent(url)}`
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
      <h2 className="text-2xl font-bold mb-6">Album List Scraper</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Source
          </label>
          <div className="flex gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="source"
                value="aoty"
                checked={source === "aoty"}
                onChange={() => setSource("aoty")}
                className="h-4 w-4 text-blue-600"
              />
              <span className="ml-2">Album of the Year</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="source"
                value="pitchfork"
                checked={source === "pitchfork"}
                onChange={() => setSource("pitchfork")}
                className="h-4 w-4 text-blue-600"
              />
              <span className="ml-2">Pitchfork</span>
            </label>
          </div>
        </div>

        <div>
          <label
            htmlFor="url"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            URL
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              source === "aoty"
                ? "https://www.albumoftheyear.org/genre/34-ambient/all/"
                : "https://pitchfork.com/features/lists-and-guides/..."
            }
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
