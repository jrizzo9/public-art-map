import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtworkDetail } from "@/components/ArtworkDetail";
import { env } from "@/lib/env";
import { artworkDocumentTitle } from "@/lib/artwork-metadata";
import { SITE_PRODUCT_NAME } from "@/lib/site";
import { getArtworkBySlug } from "@/lib/sheet";

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
    title: { absolute: artworkDocumentTitle(artwork) },
    robots: { index: false, follow: true },
    alternates: { canonical },
  };
}

export default async function EmbedArtPage({ params }: Props) {
  const { slug } = await params;
  const artwork = await getArtworkBySlug(slug);
  if (!artwork) notFound();

  return (
    <main className="p-3 md:p-4">
      <header className="mb-4 border-b border-border pb-3">
        <Link
          href="/?fs=1"
          className="text-sm font-semibold tracking-tight text-foreground underline-offset-4 hover:underline"
        >
          {SITE_PRODUCT_NAME}
        </Link>
      </header>
      <ArtworkDetail artwork={artwork} variant="embed" />
    </main>
  );
}

