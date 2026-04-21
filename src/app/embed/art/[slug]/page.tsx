import { ArtMap } from "@/components/ArtMap";
import { ArtworkDetailPanel } from "@/components/ArtworkDetailPanel";
import { getSiteUrl } from "@/lib/env";
import { getArtworkBySlug } from "@/lib/sheet";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artwork = await getArtworkBySlug(slug);
  const site = getSiteUrl();

  if (!artwork) {
    return {
      title: "Artwork not found",
      robots: { index: false, follow: false },
    };
  }

  const description =
    artwork.description?.replace(/\s+/g, " ").trim().slice(0, 160) ??
    `${artwork.title} — public art in Waco, Texas.`;

  return {
    title: artwork.title,
    description,
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${site}/art/${artwork.slug}`,
    },
    openGraph: {
      title: artwork.title,
      description,
      url: `${site}/art/${artwork.slug}`,
      siteName: "Creative Waco Public Art Map",
      locale: "en_US",
      type: "website",
      ...(artwork.image ? { images: [{ url: artwork.image }] } : {}),
    },
  };
}

export default async function EmbedArtPage({ params }: Props) {
  const { slug } = await params;
  const artwork = await getArtworkBySlug(slug);

  if (!artwork) {
    notFound();
  }

  const site = getSiteUrl();

  return (
    <div className="space-y-6">
      <ArtworkDetailPanel artwork={artwork} compact />
      <ArtMap artworks={[artwork]} selectedSlug={artwork.slug} className="h-[240px] w-full rounded-lg" />
      <p className="text-center text-xs text-zinc-500">
        <Link href={`${site}/art/${artwork.slug}`} className="text-emerald-800 underline">
          View full page
        </Link>
      </p>
    </div>
  );
}
