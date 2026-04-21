import Link from "next/link";
import { SiteBrandBar } from "@/components/SiteBrandBar";
import { env } from "@/lib/env";
import { getArtworks } from "@/lib/sheet";
import styles from "./admin.module.css";

export const metadata = {
  title: "Admin",
};

function pill(ok: boolean): { className: string; label: string } {
  return ok
    ? { className: `${styles.pill} ${styles.pillOk}`, label: "OK" }
    : { className: `${styles.pill} ${styles.pillWarn}`, label: "Needs setup" };
}

export default async function AdminPage() {
  const sheetUrl = env.SHEET_CSV_URL();
  const hasSheet = Boolean(sheetUrl);
  const artworks = await getArtworks();

  const sheetStatus = pill(hasSheet);
  const dataStatus = pill(hasSheet && artworks.length > 0);

  return (
    <div className={styles.shell}>
      <div className={styles.wrap}>
        <SiteBrandBar />

        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Admin</h1>
            <p className={styles.sub}>
              Quick status + useful links for verifying the map backend.
            </p>
          </div>
        </header>

        <section className={styles.grid} aria-label="Admin status">
          <div className={`${styles.card} ${styles.cardHalf}`}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>Data source</p>
              <span className={sheetStatus.className}>{sheetStatus.label}</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.kv}>
                <div className={styles.k}>SHEET_CSV_URL</div>
                <div className={styles.v}>
                  {sheetUrl ? sheetUrl : <span className={styles.muted}>(empty)</span>}
                </div>
              </div>
              <p className={styles.sub}>
                Set this in <code>.env.local</code> (server-side) to pull the
                published Google Sheet CSV.
              </p>
            </div>
          </div>

          <div className={`${styles.card} ${styles.cardHalf}`}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>Backend</p>
              <span className={dataStatus.className}>{dataStatus.label}</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.kv}>
                <div className={styles.k}>Artworks parsed</div>
                <div className={styles.v}>{artworks.length}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>REVALIDATE_SECONDS</div>
                <div className={styles.v}>{env.REVALIDATE_SECONDS()}</div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>API links</p>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.links}>
                <Link href="/api/health">/api/health</Link>
                <Link href="/api/artworks">/api/artworks</Link>
                <Link href="/api/artworks?limit=5">/api/artworks?limit=5</Link>
                <Link href="/api/artworks?q=waco">/api/artworks?q=waco</Link>
              </div>
              <p className={styles.sub}>
                Tip: the API responses are JSON, so your browser will show them
                directly.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

