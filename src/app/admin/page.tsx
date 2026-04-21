import type { Metadata } from "next";
import { SiteBrandBar } from "@/components/SiteBrandBar";
import styles from "./admin.module.css";
import { ImageUploader } from "./ImageUploader";
import { CloudinaryLibrary } from "./CloudinaryLibrary";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  return (
    <div className={styles.shell}>
      <div className={styles.wrap}>
        <SiteBrandBar />

        <section className={styles.grid} aria-label="Cloudinary admin">
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>Upload image → Cloudinary</p>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.sub} style={{ marginTop: 0 }}>
                Upload HEIC/PNG/JPG, we’ll auto-rotate, resize, convert to JPEG, and upload
                to Cloudinary using your server-side credentials.
              </p>
              <ImageUploader />
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>Cloudinary library</p>
            </div>
            <div className={styles.cardBody}>
              <CloudinaryLibrary />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

