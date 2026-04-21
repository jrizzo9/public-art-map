import { HomeExplorer } from "@/components/HomeExplorer";
import { getArtworks } from "@/lib/sheet";

/** Route segment cache (seconds). Align `REVALIDATE_SECONDS` for sheet fetch with this value if desired. */
export const revalidate = 300;

export default async function HomePage() {
  const artworks = await getArtworks();

  return <HomeExplorer artworks={artworks} />;
}
