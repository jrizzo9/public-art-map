import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getArtworks } from "@/lib/sheet";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL();
  const artworks = await getArtworks();

  return [
    { url: new URL("/", baseUrl).toString() },
    ...artworks.map((a) => ({
      url: new URL(`/art/${a.slug}`, baseUrl).toString(),
    })),
  ];
}

