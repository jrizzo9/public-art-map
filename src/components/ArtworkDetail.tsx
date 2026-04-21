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

      {artwork.description ? (
        <div className={styles.description}>
          <p>{artwork.description}</p>
        </div>
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

