"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Artwork } from "@/lib/sheet";
import { MapView } from "@/components/MapView";
import styles from "./home.module.css";

type Props = {
  artworks: Artwork[];
  mapboxStyleUrl?: string;
};

export function HomeClient({ artworks, mapboxStyleUrl }: Props) {
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | undefined>(undefined);
  const [hoveredSlug, setHoveredSlug] = useState<string | undefined>(undefined);

  const selectedArtwork = useMemo(() => {
    if (!selectedSlug) return undefined;
    return artworks.find((a) => a.slug === selectedSlug);
  }, [artworks, selectedSlug]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artworks;
    return artworks.filter((a) => {
      return (
        a.title.toLowerCase().includes(q) ||
        (a.category ?? "").toLowerCase().includes(q) ||
        (a.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [artworks, query]);

  return (
    <div className={styles.shell}>
      <section className={styles.map}>
        <MapView
          artworks={filtered}
          selectedSlug={selectedSlug}
          highlightSlug={hoveredSlug}
          onSelectSlug={(slug) => setSelectedSlug(slug)}
          styleUrl={mapboxStyleUrl}
        />
      </section>

      <aside className={styles.panel} aria-label="Artwork list">
        <header className={styles.header}>
          <div>
            <h1 className={styles.h1}>Waco Public Art Map</h1>
            <p className={styles.sub}>
              Data is pulled from a published sheet and refreshed automatically.
            </p>
          </div>

          <div className={styles.search}>
            <label className={styles.label} htmlFor="q">
              Search
            </label>
            <input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={styles.input}
              placeholder="Title, category, address…"
            />
          </div>
        </header>

        <p className={styles.count}>
          Showing <strong>{filtered.length}</strong> of <strong>{artworks.length}</strong>
        </p>

        {selectedArtwork ? (
          <section className={styles.preview} aria-label="Selected artwork">
            <div className={styles.previewTop}>
              <div>
                <p className={styles.previewKicker}>Selected</p>
                <p className={styles.previewTitle}>{selectedArtwork.title}</p>
                <p className={styles.previewMeta}>
                  {(selectedArtwork.category ?? "Artwork") +
                    (selectedArtwork.address ? ` · ${selectedArtwork.address}` : "")}
                </p>
              </div>
              <button
                type="button"
                className={styles.previewClose}
                onClick={() => setSelectedSlug(undefined)}
                aria-label="Clear selection"
                title="Clear selection"
              >
                ×
              </button>
            </div>

            {selectedArtwork.image ? (
              <div className={styles.previewImageWrap}>
                <Image
                  src={selectedArtwork.image}
                  alt={selectedArtwork.title}
                  fill
                  sizes="340px"
                  className={styles.previewImage}
                />
              </div>
            ) : (
              <div className={styles.previewNoImage}>No image yet</div>
            )}

            <div className={styles.previewActions}>
              <a className={styles.previewLink} href={`/art/${selectedArtwork.slug}`}>
                Open details page →
              </a>
              <a className={styles.previewLink} href={`/embed/art/${selectedArtwork.slug}`}>
                Embed →
              </a>
            </div>
          </section>
        ) : null}

        <ul className={styles.ul}>
          {filtered.map((a) => (
            <li key={a.slug} className={styles.li}>
              <button
                type="button"
                className={styles.item}
                onClick={() => setSelectedSlug(a.slug)}
                onMouseEnter={() => setHoveredSlug(a.slug)}
                onMouseLeave={() => setHoveredSlug(undefined)}
                onFocus={() => setHoveredSlug(a.slug)}
                onBlur={() => setHoveredSlug(undefined)}
              >
                <span className={styles.title}>{a.title}</span>
                <span className={styles.meta}>
                  {(a.category ?? "Artwork") + (a.address ? ` · ${a.address}` : "")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

