"use client";

import { useCallback, useEffect, useRef, useState, type TransitionEvent } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Artwork } from "@/lib/sheet";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteBrandBar } from "@/components/SiteBrandBar";
import styles from "./collection-map.module.css";

const MapView = dynamic(
  () => import("@/components/MapView").then((m) => m.MapView),
  { ssr: false },
);

type Props = {
  collectionName: string;
  artworks: Artwork[];
  mapboxStyleUrl: string;
  /** Query string without `?` — `coll=…` for artwork detail links */
  collectionQueryString: string;
  initialArtSlug?: string;
  prevCollectionHref?: string;
  nextCollectionHref?: string;
};

function resolveInitialArtSlug(
  raw: string | undefined,
  artworks: Artwork[],
): string | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  return artworks.some((a) => a.slug === s) ? s : undefined;
}

export function CollectionMapClient({
  collectionName,
  artworks,
  mapboxStyleUrl,
  collectionQueryString,
  initialArtSlug,
  prevCollectionHref,
  nextCollectionHref,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [selectedSlug, setSelectedSlug] = useState<string | undefined>(() =>
    resolveInitialArtSlug(initialArtSlug, artworks),
  );
  const [previewClosedSignal, setPreviewClosedSignal] = useState(0);
  const prevSelectedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevSelectedRef.current;
    if (typeof prev === "string" && prev.length > 0 && selectedSlug === undefined) {
      setPreviewClosedSignal((n) => n + 1);
    }
    prevSelectedRef.current = selectedSlug;
  }, [selectedSlug]);

  const previewDimWanted = !!selectedSlug;
  const [backdropMount, setBackdropMount] = useState(false);
  const [backdropVisible, setBackdropVisible] = useState(false);

  useEffect(() => {
    if (!previewDimWanted) {
      setBackdropVisible(false);
      return;
    }
    setBackdropMount(true);
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setBackdropVisible(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [previewDimWanted]);

  const onBackdropTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "opacity") return;
      if (!previewDimWanted) setBackdropMount(false);
    },
    [previewDimWanted],
  );

  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!selectedSlug) return;
    const el = itemRefs.current.get(selectedSlug);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedSlug]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (selectedSlug) p.set("art", selectedSlug);
    const qs = p.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    router.replace(href, { scroll: false });
  }, [pathname, router, selectedSlug]);

  const onSelectArtwork = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  const onClearSelection = useCallback(() => {
    setSelectedSlug(undefined);
  }, []);

  const selectByDelta = useCallback(
    (delta: number) => {
      if (artworks.length === 0) return;
      const idx = Math.max(
        0,
        selectedSlug ? artworks.findIndex((a) => a.slug === selectedSlug) : -1,
      );
      const base = idx < 0 ? 0 : idx;
      const next = (base + delta + artworks.length) % artworks.length;
      setSelectedSlug(artworks[next]!.slug);
    },
    [artworks, selectedSlug],
  );

  const count = artworks.length;

  if (count === 0) {
    return (
      <div className={styles.root}>
        <SiteBrandBar titleAs="p" />
        <div className={styles.floatingBar} style={{ pointerEvents: "auto" }}>
          <Link href="/collections" className={styles.backLink} transitionTypes={["nav-back"]}>
            ← Collections
          </Link>
        </div>
        <p className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
          No artworks are linked to this collection yet.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <SiteBrandBar titleAs="p" />

      <div className={styles.mapStage}>
        <div className={styles.floatingBar} data-collection-floating-bar="true">
          <Link href="/collections" className={styles.backLink} transitionTypes={["nav-back"]}>
            ← Collections
          </Link>
        </div>

        <div className={styles.mapFill} data-collection-map-viewport="true">
          {backdropMount ? (
            <div
              className={`${styles.mapPreviewBackdrop}${
                backdropVisible ? ` ${styles.mapPreviewBackdropVisible}` : ""
              }`}
              aria-hidden
              onTransitionEnd={onBackdropTransitionEnd}
            />
          ) : null}
          <MapView
            artworks={artworks}
            selectedSlug={selectedSlug}
            onSelectSlug={onSelectArtwork}
            onClearSelection={onClearSelection}
            styleUrl={mapboxStyleUrl}
            homeQueryString={collectionQueryString}
            previewClosedSignal={previewClosedSignal}
            mapShowsFullCatalog
            chromeVariant="collection"
          />
        </div>
      </div>

      <footer
        className={styles.bottomChrome}
        data-collection-bottom-chrome="true"
      >
        <div
          className={styles.carouselRow}
          role="region"
          aria-label="Works in this collection"
        >
          <button
            type="button"
            className={styles.carouselArrow}
            aria-label="Previous artwork in carousel"
            onClick={() => selectByDelta(-1)}
          >
            ‹
          </button>
          <div
            className={styles.carouselScroller}
            data-collection-carousel="true"
            role="listbox"
            aria-label="Choose an artwork to focus on the map"
          >
            {artworks.map((a) => {
              const selected = selectedSlug === a.slug;
              const img = a.image ?? a.images?.[0];
              return (
                <button
                  key={a.slug}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`${styles.carouselCard} ${selected ? styles.carouselCardSelected : ""}`}
                  onClick={() => onSelectArtwork(a.slug)}
                  ref={(el) => {
                    const m = itemRefs.current;
                    if (el) m.set(a.slug, el);
                    else m.delete(a.slug);
                  }}
                >
                  <div className={styles.thumb}>
                    {img ? (
                      <Image
                        src={img}
                        alt=""
                        fill
                        sizes="132px"
                        className={styles.thumbImg}
                      />
                    ) : (
                      <div className={styles.thumbFallback}>Soon</div>
                    )}
                  </div>
                  <p className={styles.cardLabel}>{a.title}</p>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={styles.carouselArrow}
            aria-label="Next artwork in carousel"
            onClick={() => selectByDelta(1)}
          >
            ›
          </button>
        </div>

        <div className={styles.collectionSummary}>
          <div className={styles.summaryLead}>
            <h1 className={styles.title}>{collectionName}</h1>
            <p className={styles.count}>
              {count === 1 ? "1 artwork" : `${count.toLocaleString()} artworks`}
            </p>
            {(prevCollectionHref || nextCollectionHref) && (
              <div className={styles.collectionNav}>
                {prevCollectionHref ? (
                  <Link href={prevCollectionHref} transitionTypes={["nav-forward"]}>
                    Prev collection
                  </Link>
                ) : null}
                {prevCollectionHref && nextCollectionHref ? (
                  <span className="text-muted-foreground" aria-hidden>
                    ·
                  </span>
                ) : null}
                {nextCollectionHref ? (
                  <Link href={nextCollectionHref} transitionTypes={["nav-forward"]}>
                    Next collection
                  </Link>
                ) : null}
              </div>
            )}
          </div>

          <div className={styles.curatorRow}>
            <p className={styles.curatorLabel}>Collection curated by</p>
            <BrandLogo className="inline-flex" imgClassName={styles.curatorLogo} />
          </div>
        </div>
      </footer>
    </div>
  );
}
