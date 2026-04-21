import type { Metadata } from "next";
import Link from "next/link";
import { getArtworks } from "@/lib/sheet";
import { Badge } from "@/components/ui/badge";
import { SiteBrandBar } from "@/components/SiteBrandBar";
import shellStyles from "./art-detail-shell.module.css";
import { ArtDirectoryClient } from "./ArtDirectoryClient";

export const metadata: Metadata = {
  title: "Artworks",
  description:
    "Browse Creative Waco’s Public Art Map directory of artworks with individual detail pages.",
  alternates: { canonical: "/art" },
};

export default async function ArtIndexPage() {
  const artworks = await getArtworks();

  return (
    <div className={shellStyles.shell}>
      <div
        className={`${shellStyles.bg} ${shellStyles.bgFallback}`}
        aria-hidden
      />

      <SiteBrandBar titleAs="p" />

      <main className={shellStyles.panel}>
        <header className={shellStyles.backRow}>
          <Link href="/" className={shellStyles.backLink} transitionTypes={["nav-back"]}>
            ← Map
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="muted">{artworks.length.toLocaleString()} artworks</Badge>
          </div>
        </header>

        <div className={`${shellStyles.panelInner} ${shellStyles.panelInnerIndex}`}>
          <header className="mb-4 space-y-1">
            <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Artworks
            </h1>
            <p className="max-w-2xl text-pretty text-sm text-muted-foreground">
              Browse public art in Waco. Each artwork links to a dedicated detail page with
              location context.
            </p>
          </header>

          <ArtDirectoryClient artworks={artworks} />
        </div>
      </main>
    </div>
  );
}

