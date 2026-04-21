import { HomeClient } from "./home/HomeClient";
import { env } from "@/lib/env";
import { getArtworks } from "@/lib/sheet";

export default function Home() {
  const mapboxStyleUrl = env.NEXT_PUBLIC_MAPBOX_STYLE_URL();
  return <HomeServer mapboxStyleUrl={mapboxStyleUrl} />;
}

async function HomeServer({ mapboxStyleUrl }: { mapboxStyleUrl: string }) {
  const artworks = await getArtworks();
  return (
    <HomeClient artworks={artworks} mapboxStyleUrl={mapboxStyleUrl} />
  );
}
