import type { Metadata } from "next";
import Link from "next/link";
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

  return (
    <main className="mx-auto max-w-[860px] bg-background px-4 py-6 md:px-6 md:py-8">
      <p className="mb-4">
        <Link
          href="/"
          className="text-primary underline underline-offset-4 hover:opacity-90"
        >
          ← Back to map
        </Link>
      </p>
      <ArtworkDetail artwork={artwork} variant="full" />
    </main>
  );
}

