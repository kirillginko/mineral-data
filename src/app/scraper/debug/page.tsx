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

export default function ScraperDebugPage() {
  const [url, setUrl] = useState(
    "https://www.albumoftheyear.org/genre/34-ambient/all/"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScraperResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [showDebug, setShowDebug] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);
    setDebugInfo("");

    try {
      // Clear previous debug info
      console.clear();
      console.log("Scraping URL:", url);

      // Start capturing console logs
      const originalConsoleLog = console.log;
      const logs: string[] = [];

      // Override console.log with type-safe version
      console.log = function (...args: unknown[]) {
        logs.push(
          args
            .map((arg) =>
              typeof arg === "object"
                ? JSON.stringify(arg, null, 2)
                : String(arg)
            )
            .join(" ")
        );
        originalConsoleLog(...args);
      };

      // Call the API
      const response = await fetch(
        `/api/scrape-aoty?url=${encodeURIComponent(url)}`
      );
      const data = await response.json();

      // Restore console.log
      console.log = originalConsoleLog;

      // Set debug info
      setDebugInfo(logs.join("\n"));

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
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Album Scraper Debugger
      </h1>

      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div>
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Album of the Year URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.albumoftheyear.org/genre/34-ambient/all/"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? "Scraping..." : "Scrape & Debug"}
            </button>

            <button
              type="button"
              onClick={() => setShowDebug(!showDebug)}
              className="bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              {showDebug ? "Hide Debug Info" : "Show Debug Info"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {showDebug && debugInfo && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Debug Information</h3>
            <pre className="p-4 bg-gray-50 border border-gray-200 rounded-md overflow-x-auto text-sm whitespace-pre-wrap">
              {debugInfo}
            </pre>
          </div>
        )}

        {result && (
          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-2">Scraping Results</h3>
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
                        {result.data.albums.map(
                          (album: Album, index: number) => (
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
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
