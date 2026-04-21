import type { Metadata } from "next";
import Link from "next/link";
import { SiteBrandBar } from "@/components/SiteBrandBar";
import shellStyles from "@/app/art/art-detail-shell.module.css";
import { SubmitArtPanel } from "./SubmitArtPanel";

export const metadata: Metadata = {
  title: "Submit public art",
  description:
    "Suggest artwork for Creative Waco’s Public Art Map. Include photos and contact email.",
  alternates: { canonical: "/submit" },
};

export default function SubmitPage() {
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
              Submit public art
            </h1>
            <p className="max-w-2xl text-pretty text-sm text-muted-foreground">
              Share artwork we should consider for the map. Photos upload to our media library;
              include your email so we can follow up.
            </p>
          </header>

          <SubmitArtPanel />
        </div>
      </main>
    </div>
  );
}
