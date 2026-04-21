import Image from "next/image";
import type { Artwork } from "@/lib/sheet";
import styles from "./ArtworkDetail.module.css";

type Props = {
  artwork: Artwork;
  variant?: "full" | "embed";
};

export function ArtworkDetail({ artwork, variant = "full" }: Props) {
  return (
    <article className={styles.card} data-variant={variant}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Public Art</p>
          <h1 className={styles.title}>{artwork.title}</h1>
          {artwork.category ? (
            <p className={styles.meta}>{artwork.category}</p>
          ) : null}
          {[artwork.year, artwork.artist].filter(Boolean).length ? (
            <p className={styles.meta}>
              {[artwork.year != null ? String(artwork.year) : null, artwork.artist]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      </header>

      {artwork.image ? (
        <div className={styles.imageWrap}>
          <Image
            src={artwork.image}
            alt={artwork.title}
            fill
            sizes="(max-width: 900px) 100vw, 720px"
            className={styles.image}
          />
        </div>
      ) : null}

      {artwork.address ? <p className={styles.address}>{artwork.address}</p> : null}

      {artwork.commission || artwork.collection ? (
        <section className={styles.placement} aria-label="Placement">
          <h2 className={styles.placementHeading}>Placement</h2>
          <dl className={styles.placementList}>
            {artwork.commission ? (
              <div>
                <dt>Commission</dt>
                <dd>{artwork.commission}</dd>
              </div>
            ) : null}
            {artwork.collection ? (
              <div>
                <dt>Collection</dt>
                <dd>{artwork.collection}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {artwork.description ? (
        <div className={styles.description}>
          <p>{artwork.description}</p>
        </div>
      ) : null}

      {artwork.externalUrl ? (
        <p className={styles.external}>
          <a href={artwork.externalUrl} rel="noopener noreferrer">
            More information
          </a>
        </p>
      ) : null}

      <dl className={styles.coords}>
        <div>
          <dt>Latitude</dt>
          <dd>{artwork.lat}</dd>
        </div>
        <div>
          <dt>Longitude</dt>
          <dd>{artwork.lng}</dd>
        </div>
      </dl>
    </article>
  );
}

