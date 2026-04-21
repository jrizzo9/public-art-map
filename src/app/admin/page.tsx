import type { Metadata } from "next";
import { SiteBrandBar } from "@/components/SiteBrandBar";
import styles from "./admin.module.css";
import { MapInfoEditor } from "./map/MapInfoEditor";
import { SubmissionsSection } from "./SubmissionsSection";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
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
              <p className={styles.sub} style={{ marginTop: 0 }}>
                UI only for now. This will let you search/select an artwork and edit the fields
                shown on the map.
              </p>
              <MapInfoEditor />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

