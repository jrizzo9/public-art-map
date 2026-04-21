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

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artworks = await getArtworks();
  const artwork = artworks.find((a) => a.slug === slug) ?? null;
  if (!artwork) return {};

  const siteUrl = env.NEXT_PUBLIC_SITE_URL();
  const url = new URL(`/art/${artwork.slug}`, siteUrl).toString();

  return {
    title: artwork.title,
    description: artwork.description?.slice(0, 160) || "Public art detail page.",
    alternates: { canonical: url },
    openGraph: {
      title: artwork.title,
      description: artwork.description?.slice(0, 200) || "Public art detail page.",
      url,
      images: artwork.image ? [{ url: artwork.image }] : undefined,
    },
  };
}

export default async function ArtPage({ params }: Props) {
  const { slug } = await params;
  const artworks = await getArtworks();
  const artwork = artworks.find((a) => a.slug === slug) ?? null;
  if (!artwork) notFound();

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
      <div
        className={`${shellStyles.bg} ${detailMapBgUrl ? shellStyles.bgWithMap : shellStyles.bgFallback}`}
        aria-hidden
        style={
          detailMapBgUrl
            ? { backgroundImage: `url(${JSON.stringify(detailMapBgUrl)})` }
            : undefined
        }
      />

      <SiteBrandBar titleAs="p" />

      <main className={shellStyles.panel}>
        <header className={shellStyles.backRow}>
          <Link
            href="/"
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
            <ArtworkDetail artwork={artwork} variant="panel" />
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
                          alt=""
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

