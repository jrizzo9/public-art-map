import type { Metadata } from "next";
import { SiteBrandBar } from "@/components/SiteBrandBar";
import { getArtworks } from "@/lib/sheet";
import styles from "./admin.module.css";
import { MapInfoEditor } from "./map/MapInfoEditor";
import { SubmissionsSection } from "./SubmissionsSection";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const artworks = await getArtworks();

  return (
    <div className={styles.shell}>
      <div className={styles.wrap}>
        <SiteBrandBar />

        <section className={styles.adminSections} aria-label="Map admin">
          <SubmissionsSection />

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>Edit map info</p>
            </div>
            <div className={styles.cardBody}>
              <MapInfoEditor initialArtworks={artworks} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

