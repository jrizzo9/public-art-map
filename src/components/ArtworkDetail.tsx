import Image from "next/image";
import Link from "next/link";
import type { Artwork } from "@/lib/sheet";
import styles from "./ArtworkDetail.module.css";

type Props = {
  artwork: Artwork;
  /** panel: sits inside floating glass chrome (matches map list panel treatment) */
  variant?: "full" | "embed" | "panel";
  prevHref?: string;
  nextHref?: string;
};

export function ArtworkDetail({ artwork, variant = "full", prevHref, nextHref }: Props) {
  const primaryImage = artwork.image ?? artwork.images?.[0];

  return (
    <article className={styles.card} data-variant={variant}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{artwork.title}</h1>
          {artwork.category ? (
            <p className={styles.meta}>{artwork.category}</p>
          ) : null}
        </div>
      </header>

      <div className={styles.imageWrap}>
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={artwork.title}
            fill
            sizes="(max-width: 900px) 100vw, 720px"
            className={styles.image}
          />
        ) : (
          <div
            className={styles.imagePlaceholder}
            role="img"
            aria-label="Photo not yet available"
          >
            <span className={styles.placeholderInner} aria-hidden="true">
              Photo coming soon
            </span>
          </div>
        )}

        {variant !== "embed" && prevHref && nextHref ? (
          <>
            <Link
              className={`${styles.artNavBtn} ${styles.artNavLeft}`}
              href={prevHref}
              aria-label="Previous artwork"
              transitionTypes={["nav-forward"]}
            >
              <span aria-hidden>‹</span>
            </Link>
            <Link
              className={`${styles.artNavBtn} ${styles.artNavRight}`}
              href={nextHref}
              aria-label="Next artwork"
              transitionTypes={["nav-forward"]}
            >
              <span aria-hidden>›</span>
            </Link>
          </>
        ) : null}
      </div>

      {artwork.address ? <p className={styles.address}>{artwork.address}</p> : null}

      {artwork.artist ? (
        <section className={styles.placement} aria-label="Artist">
          <dl className={styles.placementList}>
            <div>
              <dt>Artist</dt>
              <dd>{artwork.artist}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {artwork.description ? (
        <section className={styles.placement} aria-label="Description">
          <dl className={styles.placementList}>
            <div>
              <dt>Description</dt>
              <dd className={styles.descriptionDd}>{artwork.description}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {artwork.commission || artwork.collection ? (
        <section className={styles.placement} aria-label="Placement">
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

      {artwork.year != null ? (
        <section className={styles.placement} aria-label="Year">
          <dl className={styles.placementList}>
            <div>
              <dt>Year</dt>
              <dd>{artwork.year}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </article>
  );
}

