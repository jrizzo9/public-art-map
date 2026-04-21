import type { Artwork } from "@/types/artwork";
import { getSiteUrl } from "@/lib/env";

export function VisualArtworkJsonLd({ artwork }: { artwork: Artwork }) {
  const site = getSiteUrl();
  const url = `${site}/art/${artwork.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: artwork.title,
    url,
    ...(artwork.image ? { image: artwork.image } : {}),
    ...(artwork.description ? { description: artwork.description } : {}),
    ...(artwork.address
      ? {
          contentLocation: {
            "@type": "Place",
            address: artwork.address,
            geo: {
              "@type": "GeoCoordinates",
              latitude: artwork.lat,
              longitude: artwork.lng,
            },
          },
        }
      : {
          geo: {
            "@type": "GeoCoordinates",
            latitude: artwork.lat,
            longitude: artwork.lng,
          },
        }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
