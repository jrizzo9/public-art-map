import { ArtMap } from "@/components/ArtMap";
import { ArtworkDetailPanel } from "@/components/ArtworkDetailPanel";
import { VisualArtworkJsonLd } from "@/components/VisualArtworkJsonLd";
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
    twitter: {
      card: artwork.image ? "summary_large_image" : "summary",
      title: artwork.title,
      description,
      ...(artwork.image ? { images: [artwork.image] } : {}),
    },
  };
}

export default async function ArtDetailPage({ params }: Props) {
  const { slug } = await params;
  const artwork = await getArtworkBySlug(slug);

  if (!artwork) {
    notFound();
  }

  return (
    <>
      <VisualArtworkJsonLd artwork={artwork} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 lg:flex-row lg:gap-12">
        <div className="flex-1">
          <nav className="mb-6 text-sm text-zinc-600">
            <Link href="/" className="font-medium text-emerald-800 hover:underline">
              ← Map
            </Link>
          </nav>
          <ArtworkDetailPanel artwork={artwork} />
        </div>
        <div className="lg:w-[min(100%,440px)] lg:shrink-0">
          <ArtMap
            artworks={[artwork]}
            selectedSlug={artwork.slug}
            className="h-[320px] w-full rounded-xl lg:sticky lg:top-24 lg:h-[min(480px,calc(100vh-8rem))]"
          />
        </div>
      </div>
    </>
  );
}
