import type { Metadata } from "next";
import { HomeClient } from "./home/HomeClient";
import { env } from "@/lib/env";
import { getArtworks } from "@/lib/sheet";
import styles from "./home/home.module.css";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  const mapboxStyleUrl = env.NEXT_PUBLIC_MAPBOX_STYLE_URL();
  return <HomeServer mapboxStyleUrl={mapboxStyleUrl} />;
}

async function HomeServer({ mapboxStyleUrl }: { mapboxStyleUrl: string }) {
  const artworks = await getArtworks();
  return (
    <>
      <HomeClient artworks={artworks} mapboxStyleUrl={mapboxStyleUrl} />
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
