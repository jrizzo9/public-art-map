import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { env } from "@/lib/env";
import { mapboxStaticSnapshotUrl } from "@/lib/mapbox-static";
import { getArtworkBySlug } from "@/lib/sheet";
import { ArtworkDetail } from "@/components/ArtworkDetail";
import { BrandLogo } from "@/components/BrandLogo";
import shellStyles from "../art-detail-shell.module.css";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artwork = await getArtworkBySlug(slug);
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
  const artwork = await getArtworkBySlug(slug);
  if (!artwork) notFound();

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

      <BrandLogo
        className={shellStyles.brandLogo}
        imgClassName={shellStyles.brandLogoImg}
      />

      <main className={shellStyles.panel}>
        <header className={shellStyles.backRow}>
          <Link
            href="/"
            className={shellStyles.backLink}
            transitionTypes={["nav-back"]}
          >
            ← Map
          </Link>
          <p className={shellStyles.productTitle}>Waco Public Art Map</p>
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
    </div>
  );
}

