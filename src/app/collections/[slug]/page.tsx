import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { getArtworks } from "@/lib/sheet";
import {
  artworksInCollection,
  buildCollectionSlugMaps,
  collectionArtDetailQueryString,
  uniqueCollectionNames,
} from "@/lib/collection-routes";
import { SITE_PRODUCT_NAME } from "@/lib/site";
import { CollectionMapClient } from "../CollectionMapClient";
import { getArtSlugFromPageSearchParams } from "@/app/home/home-filter-url";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickHero(artworks: ReturnType<typeof artworksInCollection>): {
  url: string | null;
} {
  for (const a of artworks) {
    const url = a.image ?? a.images?.[0];
    if (url) return { url };
  }
  return { url: null };
}

export async function generateStaticParams() {
  const artworks = await getArtworks();
  const { slugToName } = buildCollectionSlugMaps(artworks);
  return [...slugToName.keys()].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artworks = await getArtworks();
  const { slugToName } = buildCollectionSlugMaps(artworks);
  const name = slugToName.get(slug);
  if (!name) return {};

  const inCollection = artworksInCollection(name, artworks);
  const siteUrl = env.NEXT_PUBLIC_SITE_URL();
  const url = new URL(`/collections/${slug}`, siteUrl).toString();
  const count = inCollection.length;
  const title = `${name} — Collection`;
  const description =
    count === 1
      ? `One artwork in the “${name}” collection on Creative Waco’s Public Art Map.`
      : `${count.toLocaleString()} artworks in the “${name}” collection on Creative Waco’s Public Art Map.`;

  const hero = pickHero(inCollection);
  return {
    title: { absolute: `${title} · ${SITE_PRODUCT_NAME}` },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      images: hero.url ? [{ url: hero.url }] : undefined,
    },
    twitter: {
      card: hero.url ? "summary_large_image" : "summary",
      title,
      description,
      images: hero.url ? [hero.url] : undefined,
    },
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const artworks = await getArtworks();
  const { slugToName, nameToSlug } = buildCollectionSlugMaps(artworks);
  const collectionName = slugToName.get(slug);
  if (!collectionName) notFound();

  const inCollection = artworksInCollection(collectionName, artworks);

  const names = uniqueCollectionNames(artworks);
  const idx = Math.max(0, names.indexOf(collectionName));
  const prevName = names[(idx - 1 + names.length) % names.length];
  const nextName = names[(idx + 1) % names.length];
  const prevSlug = nameToSlug.get(prevName);
  const nextSlug = nameToSlug.get(nextName);
  const prevCollectionHref =
    prevSlug && names.length > 1 ? `/collections/${prevSlug}` : undefined;
  const nextCollectionHref =
    nextSlug && names.length > 1 ? `/collections/${nextSlug}` : undefined;

  const siteUrl = env.NEXT_PUBLIC_SITE_URL();
  const canonicalUrl = new URL(`/collections/${slug}`, siteUrl).toString();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Collection",
    name: collectionName,
    url: canonicalUrl,
    numberOfItems: inCollection.length,
    hasPart: inCollection.map((a) => ({
      "@type": "VisualArtwork",
      name: a.title,
      url: new URL(`/art/${a.slug}`, siteUrl).toString(),
    })),
  };

  const mapboxStyleUrl = env.NEXT_PUBLIC_MAPBOX_STYLE_URL();
  const initialArtSlug = getArtSlugFromPageSearchParams(sp);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CollectionMapClient
        collectionName={collectionName}
        artworks={inCollection}
        mapboxStyleUrl={mapboxStyleUrl}
        collectionQueryString={collectionArtDetailQueryString(collectionName)}
        initialArtSlug={initialArtSlug}
        prevCollectionHref={prevCollectionHref}
        nextCollectionHref={nextCollectionHref}
      />
    </>
  );
}
