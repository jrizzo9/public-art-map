import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteBrandBar } from "@/components/SiteBrandBar";
import shellStyles from "@/app/art/art-detail-shell.module.css";
import { env } from "@/lib/env";
import { AirtableSubmitEmbed } from "./AirtableSubmitEmbed";

export const metadata: Metadata = {
  title: "Submit public art",
  description:
    "Suggest artwork for Creative Waco’s Public Art Map. Include photos and contact email.",
  alternates: { canonical: "/submit" },
};

export default function SubmitPage() {
  if (!env.submitPublicArtEnabled()) {
    redirect("/");
  }

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
          <AirtableSubmitEmbed />
        </div>
      </main>
    </div>
  );
}
