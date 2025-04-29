import { Suspense } from "react";
import { IdmAlbums } from "./components/IdmAlbums";

export default function Home() {
  return (
    <main className="container mx-auto">
      <Suspense fallback={<div>Loading...</div>}>
        <IdmAlbums />
      </Suspense>
    </main>
  );
}
