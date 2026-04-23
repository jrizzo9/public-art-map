import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeClient } from "./home/HomeClient";
import type { HomeFiltersFromUrl } from "./home/home-filter-url";
import { env } from "@/lib/env";
import { getArtworks } from "@/lib/sheet";
import styles from "./home/home.module.css";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export const dynamic = "force-static";

const EMPTY_FILTERS: HomeFiltersFromUrl = {
  categories: [],
  commissions: [],
  collections: [],
  yearMin: "",
  yearMax: "",
};

export default async function Home() {
  const mapboxStyleUrl = env.NEXT_PUBLIC_MAPBOX_STYLE_URL();
  return (
    <HomeServer
      mapboxStyleUrl={mapboxStyleUrl}
      initialFiltersFromUrl={EMPTY_FILTERS}
    />
  );
}

async function HomeServer({
  mapboxStyleUrl,
  initialFiltersFromUrl,
}: {
  mapboxStyleUrl: string;
  initialFiltersFromUrl: HomeFiltersFromUrl;
}) {
  const artworks = await getArtworks();
  const submitEnabled = env.submitPublicArtEnabled();
  return (
    <>
      <Suspense fallback={null}>
        <HomeClient
          artworks={artworks}
          mapboxStyleUrl={mapboxStyleUrl}
          submitEnabled={submitEnabled}
          initialFiltersFromUrl={initialFiltersFromUrl}
        />
      </Suspense>
      <section className={styles.srOnly} aria-label="Artwork index">
        <h2>Public art in Waco</h2>
        <p>
          Browse artwork detail pages for Creative Waco&apos;s Public Art Map.
        </p>
        <ul>
          {artworks.slice(0, 250).map((a) => (
            <li key={a.slug}>
              <a href={`/art/${a.slug}`}>{a.title}</a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
