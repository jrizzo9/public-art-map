import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { getArtworkBySlug } from "@/lib/sheet";
import { ArtworkDetail } from "@/components/ArtworkDetail";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artwork = await getArtworkBySlug(slug);
  if (!artwork) return {};

  const siteUrl = env.NEXT_PUBLIC_SITE_URL();
  const canonical = new URL(`/art/${artwork.slug}`, siteUrl).toString();

  return {
    title: artwork.title,
    robots: { index: false, follow: true },
    alternates: { canonical },
  };
}

export default async function EmbedArtPage({ params }: Props) {
  const { slug } = await params;
  const artwork = await getArtworkBySlug(slug);
  if (!artwork) notFound();

  return (
    <main style={{ padding: 12 }}>
      <ArtworkDetail artwork={artwork} variant="embed" />
    </main>
  );
}

