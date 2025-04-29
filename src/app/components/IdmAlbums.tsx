"use client";

import { useEffect, useState } from "react";

interface Album {
  rank: number;
  artist: string;
  album: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

export function IdmAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const response = await fetch("/api/scrape-idm");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status} - ${
              (data as ErrorResponse).error || "Unknown error"
            }`
          );
        }

        console.log("API Response:", data);

        if (Array.isArray(data) && data.length > 0) {
          setAlbums(data);
        } else {
          throw new Error("No albums found in the response");
        }
      } catch (err) {
        console.error("Error fetching albums:", err);
        setError(err instanceof Error ? err.message : "Failed to load albums");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-500 font-bold">Error:</div>
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">Loading albums...</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Top 50 IDM Albums</h1>
      <div className="space-y-4">
        {albums.map((album) => (
          <div key={album.rank} className="border p-4 rounded-lg">
            <div className="font-bold">#{album.rank}</div>
            <div className="text-lg">{album.artist}</div>
            <div className="text-gray-600">{album.album}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
