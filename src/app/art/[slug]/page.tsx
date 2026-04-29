import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { env } from "@/lib/env";
import { haversineDistanceKm, kmToMiles } from "@/lib/geo";
import { mapboxStaticSnapshotUrl } from "@/lib/mapbox-static";
import { getArtworks } from "@/lib/sheet";
import { ArtworkDetail } from "@/components/ArtworkDetail";
import { SiteBrandBar } from "@/components/SiteBrandBar";
import shellStyles from "../art-detail-shell.module.css";
import nearbyStyles from "../nearby-art.module.css";
import Image from "next/image";
import {
  artworkDocumentTitle,
  artworkMetaDescriptionFull,
  truncateMetaDescription,
} from "@/lib/artwork-metadata";
import { SITE_ORG_NAME, SITE_PRODUCT_NAME } from "@/lib/site";
import { filterArtworksByHomeUrlQuery } from "@/lib/home-filter-match";
import { buildCollectionSlugMaps } from "@/lib/collection-routes";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artworks = await getArtworks();
  const artwork = artworks.find((a) => a.slug === slug) ?? null;
  if (!artwork) return {};

  const siteUrl = env.NEXT_PUBLIC_SITE_URL();
  const url = new URL(`/art/${artwork.slug}`, siteUrl).toString();
  const fullDescription = artworkMetaDescriptionFull(artwork);
  const description = truncateMetaDescription(fullDescription, 160);
  const ogDescription = truncateMetaDescription(fullDescription, 200);
  const pageTitle = artworkDocumentTitle(artwork);

  return {
    title: { absolute: pageTitle },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: pageTitle,
      description: ogDescription,
      url,
      images: artwork.image ? [{ url: artwork.image }] : undefined,
    },
    twitter: {
      card: artwork.image ? "summary_large_image" : "summary",
      title: pageTitle,
      description,
      images: artwork.image ? [artwork.image] : undefined,
    },
  };
}

export default async function ArtPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const artworks = await getArtworks();
  const artwork = artworks.find((a) => a.slug === slug) ?? null;
  if (!artwork) notFound();

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null) continue;
    if (Array.isArray(v)) for (const item of v) qs.append(k, String(item));
    else qs.set(k, String(v));
  }

  const filtered = filterArtworksByHomeUrlQuery(artworks, qs);

  const { nameToSlug } = buildCollectionSlugMaps(artworks);
  const collTrim = artwork.collection?.trim();
  const collectionDetailHref =
    collTrim && nameToSlug.has(collTrim)
      ? `/collections/${nameToSlug.get(collTrim)!}`
      : undefined;

  const pool = filtered.some((a) => a.slug === artwork.slug) ? filtered : artworks;
  const idx = Math.max(0, pool.findIndex((a) => a.slug === artwork.slug));
  const prev = pool[(idx - 1 + pool.length) % pool.length];
  const next = pool[(idx + 1) % pool.length];
  const queryString = qs.toString();
  const prevHref = prev ? `/art/${prev.slug}${queryString ? `?${queryString}` : ""}` : undefined;
  const nextHref = next ? `/art/${next.slug}${queryString ? `?${queryString}` : ""}` : undefined;

  const siteUrl = env.NEXT_PUBLIC_SITE_URL();
  const canonicalUrl = new URL(`/art/${artwork.slug}`, siteUrl).toString();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: artwork.title,
    description: artwork.description ?? undefined,
    image: artwork.image ? [artwork.image] : undefined,
    url: canonicalUrl,
    creator: artwork.artist
      ? { "@type": "Person", name: artwork.artist }
      : undefined,
    dateCreated: artwork.year != null ? String(artwork.year) : undefined,
    contentLocation: {
      "@type": "Place",
      name: artwork.address ?? undefined,
      address: artwork.address ?? undefined,
      geo: {
        "@type": "GeoCoordinates",
        latitude: artwork.lat,
        longitude: artwork.lng,
      },
    },
    provider: { "@type": "Organization", name: SITE_ORG_NAME },
    isPartOf: { "@type": "WebSite", name: SITE_PRODUCT_NAME, url: siteUrl },
  };

  const nearby =
    artworks.length > 1
      ? artworks
          .filter((a) => a.slug !== artwork.slug)
          .map((a) => {
            const km = haversineDistanceKm(
              { lat: artwork.lat, lng: artwork.lng },
              { lat: a.lat, lng: a.lng },
            );
            return { artwork: a, km, miles: kmToMiles(km) };
          })
          .sort((a, b) => a.km - b.km)
          .slice(0, 6)
      : [];

  const mapboxToken = env.NEXT_PUBLIC_MAPBOX_TOKEN();
  const mapboxStyleUrl = env.NEXT_PUBLIC_MAPBOX_STYLE_URL();
  const detailMapBgUrl =
    mapboxToken &&
    Number.isFinite(artwork.lat) &&
    Number.isFinite(artwork.lng)
      ? mapboxStaticSnapshotUrl({
          lat: artwork.lat,
          lng: artwork.lng,
          styleUrl: mapboxStyleUrl,
          accessToken: mapboxToken,
        })
      : null;

  return (
    <div className={shellStyles.shell}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div
        className={`${shellStyles.bg} ${detailMapBgUrl ? shellStyles.bgWithMap : shellStyles.bgFallback}`}
        aria-hidden
      >
        {detailMapBgUrl ? (
          <img
            src={detailMapBgUrl}
            alt=""
            className={shellStyles.bgMapImg}
            loading="eager"
            decoding="async"
          />
        ) : null}
      </div>

      <SiteBrandBar titleAs="p" />

      <main className={shellStyles.panel}>
        <header className={shellStyles.backRow}>
          <Link
            href="/?fs=1"
            className={shellStyles.backLink}
            transitionTypes={["nav-back"]}
          >
            ← Map
          </Link>
        </header>

        <ViewTransition
          enter={{
            "nav-forward": "nav-forward",
            "nav-back": "nav-back",
            default: "none",
          }}
          exit={{
            "nav-forward": "nav-forward",
            "nav-back": "nav-back",
            default: "none",
          }}
          default="none"
        >
          <div className={shellStyles.panelInner}>
            <ArtworkDetail
              artwork={artwork}
              variant="panel"
              prevHref={prevHref}
              nextHref={nextHref}
              collectionDetailHref={collectionDetailHref}
            />
          </div>
        </ViewTransition>
      </main>

      {nearby.length ? (
        <section className={shellStyles.nearbyWrap} aria-label="Nearby art">
          <div className={nearbyStyles.section}>
            <div className={nearbyStyles.headerRow}>
              <h2 className={nearbyStyles.title}>Nearby art</h2>
              <p className={nearbyStyles.subtitle}>Sorted by distance</p>
            </div>

            <div className={nearbyStyles.grid}>
              {nearby.map(({ artwork: a, miles }) => (
                <div key={a.slug} className={nearbyStyles.card}>
                  <Link
                    href={`/art/${a.slug}`}
                    className={nearbyStyles.mainLink}
                    transitionTypes={["nav-forward"]}
                  >
                    <div className={nearbyStyles.thumbWrap} aria-hidden>
                      {a.image ? (
                        <Image
                          src={a.image}
                          alt={a.title}
                          fill
                          sizes="(max-width: 720px) 45vw, 250px"
                          className={nearbyStyles.thumb}
                        />
                      ) : (
                        <div className={nearbyStyles.thumbFallback}>Photo soon</div>
                      )}
                    </div>

                    <div className={nearbyStyles.content}>
                      <div className={nearbyStyles.titleRow}>
                        <p className={nearbyStyles.cardTitle}>{a.title}</p>
                        <span className={nearbyStyles.distanceText}>
                          {miles < 10
                            ? `${miles.toFixed(1)} mi`
                            : `${Math.round(miles)} mi`}
                        </span>
                      </div>
                      <div className={nearbyStyles.meta}>
                        {(a.artist || a.year != null) && (
                          <div>
                            {[a.artist, a.year != null ? String(a.year) : null]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

