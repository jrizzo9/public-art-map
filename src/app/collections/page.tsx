import type { Metadata } from "next";
import Link from "next/link";
import { getArtworks } from "@/lib/sheet";
import { getCollectionIndexEntries } from "@/lib/collection-routes";
import { SiteBrandBar } from "@/components/SiteBrandBar";
import shellStyles from "../art/art-detail-shell.module.css";
import { CollectionsClient } from "./CollectionsClient";
import dirStyles from "../art/art-directory.module.css";

export const metadata: Metadata = {
  title: "Collections",
  description:
    "Browse public art in Waco by collection — full-screen collection pages plus map view.",
  alternates: { canonical: "/collections" },
};

export default async function CollectionsPage() {
  const artworks = await getArtworks();
  const entries = getCollectionIndexEntries(artworks);

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
        </header>

        <div className={`${shellStyles.panelInner} ${shellStyles.panelInnerIndex}`}>
          <header className="mb-4 space-y-1">
            <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Collections
            </h1>
            <p className="max-w-2xl text-pretty text-sm text-muted-foreground">
              Groupings from the public art data — open a collection for photos, artwork list,
              and map.{" "}
              <Link
                href="/art"
                className="font-medium text-foreground/90 underline-offset-4 hover:underline"
                transitionTypes={["nav-forward"]}
              >
                Art directory
              </Link>{" "}
              lists every piece with the same filters.
            </p>
          </header>

          {entries.length ? (
            <CollectionsClient entries={entries} />
          ) : (
            <section className={dirStyles.empty} aria-label="No collections">
              <p className={dirStyles.emptyTitle}>No collections are set yet.</p>
              <p className={dirStyles.emptySub}>
                When the sheet includes a value in the <strong>Collection</strong> column,
                groupings appear here. You can still browse all artworks in the directory.
              </p>
              <Link
                href="/art"
                className={`${dirStyles.emptyBtn} inline-block no-underline`}
                transitionTypes={["nav-forward"]}
              >
                Browse artworks
              </Link>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
