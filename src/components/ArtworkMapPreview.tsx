"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import popupStyles from "@/components/MapPopup.module.css";
import type { Artwork } from "@/lib/sheet";

type Props = {
  map: MapboxMap;
  art: Artwork;
  artworks: Artwork[];
  homeQueryString: string;
  onClose: () => void;
  onSelectSlug: (slug: string) => void;
  /** Matches Mapbox popup offset tuning (narrow vs wide). */
  popupOffsetY: number;
};

const PANEL = "[data-home-artwork-panel]";
const PREVIEW_MAX_CAP = 680;
const MIN_PREVIEW_PX = 200;

/**
 * Map container spans the full map card, but the list is a left overlay. Cap preview width
 * to the space from the list’s right edge to the right edge of the map / screen (and images).
 */
function computePreviewMaxWidthPx(map: MapboxMap): number {
  const mapR = map.getContainer().getBoundingClientRect();
  const hPad = 20;
  const edgePad = 16;

  const panel = document.querySelector<HTMLElement>(PANEL);
  if (!panel) {
    return Math.min(
      PREVIEW_MAX_CAP,
      Math.max(MIN_PREVIEW_PX, Math.min(mapR.width, window.innerWidth) - 2 * hPad),
    );
  }

  const p = panel.getBoundingClientRect();
  // Mobile bottom (or top) bar that spans the map—map column is still full width of the card.
  if (p.width > Math.min(mapR.width, window.innerWidth) * 0.86 && p.height < mapR.height * 0.48) {
    return Math.min(
      PREVIEW_MAX_CAP,
      Math.max(MIN_PREVIEW_PX, Math.min(mapR.width, window.innerWidth) - 2 * hPad),
    );
  }

  const toScreen = window.innerWidth - p.right - 2 * edgePad;
  const toMap = mapR.right - p.right - edgePad;
  // Bottom sheet: panel’s right is nearly flush with the viewport; use map width.
  if (toScreen < 72) {
    return Math.min(
      PREVIEW_MAX_CAP,
      Math.max(MIN_PREVIEW_PX, Math.min(mapR.width, window.innerWidth) - 2 * hPad),
    );
  }

  const cap = Math.max(MIN_PREVIEW_PX, Math.min(toScreen, toMap));
  return Math.min(PREVIEW_MAX_CAP, cap);
}

function detailHrefForSlug(slug: string, homeQueryString: string) {
  const qs = homeQueryString ? homeQueryString.replace(/^\?/, "") : "";
  return qs ? `/art/${slug}?${qs}` : `/art/${slug}`;
}

export function ArtworkMapPreview({
  map,
  art,
  artworks,
  homeQueryString,
  onClose,
  onSelectSlug,
  popupOffsetY,
}: Props) {
  const router = useRouter();
  const lngLat = useMemo((): [number, number] => [art.lng, art.lat], [art.lng, art.lat]);

  const [pos, setPos] = useState({ left: 0, top: 0, maxW: PREVIEW_MAX_CAP });

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try {
          const p = map.project(lngLat);
          const r = map.getContainer().getBoundingClientRect();
          setPos({
            left: r.left + p.x,
            top: r.top + p.y,
            maxW: computePreviewMaxWidthPx(map),
          });
        } catch {
          /* map mid-teardown */
        }
      });
    };

    tick();
    map.on("render", tick);
    map.on("resize", tick);
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      map.off("render", tick);
      map.off("resize", tick);
      window.removeEventListener("scroll", tick, true);
      window.removeEventListener("resize", tick);
    };
  }, [map, lngLat]);

  const primaryImage = art.image ?? art.images?.[0];

  const { prevSlug, nextSlug } = useMemo(() => {
    if (artworks.length <= 1) return { prevSlug: null as string | null, nextSlug: null as string | null };
    const idx = Math.max(0, artworks.findIndex((a) => a.slug === art.slug));
    const prev = artworks[(idx - 1 + artworks.length) % artworks.length]?.slug ?? null;
    const next = artworks[(idx + 1) % artworks.length]?.slug ?? null;
    return { prevSlug: prev, nextSlug: next };
  }, [art.slug, artworks]);

  const detailHref = detailHrefForSlug(art.slug, homeQueryString);

  return (
    <div
      data-artwork-map-preview
      className={`artwork-map-preview-root ${popupStyles.popupRoot}`}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        maxWidth: pos.maxW,
        width: "fit-content",
        minWidth: 0,
        boxSizing: "border-box",
        zIndex: 60,
        pointerEvents: "auto",
        transform: `translate(-50%, calc(-100% + ${popupOffsetY}px))`,
        willChange: "transform",
      }}
    >
      <div className={popupStyles.topRow}>
        <div className={popupStyles.title}>{art.title}</div>
        <button
          type="button"
          className={popupStyles.closeBtn}
          aria-label="Close preview"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
      </div>

      <div className={popupStyles.meta}>
        {[art.artist?.trim(), art.year ? String(art.year) : undefined]
          .filter(Boolean)
          .join(", ") || art.category || "Artwork"}
      </div>

      <div className={popupStyles.imageBlock}>
        {primaryImage ? (
          <div className={popupStyles.imageFrame}>
            <img
              src={primaryImage}
              alt={art.title}
              loading="lazy"
              className={popupStyles.image}
            />
          </div>
        ) : (
          <div
            className={popupStyles.imagePlaceholder}
            role="img"
            aria-label="Photo not yet available"
          >
            <span className={popupStyles.placeholderInner} aria-hidden>
              Photo coming soon
            </span>
          </div>
        )}

        {prevSlug && nextSlug ? (
          <>
            <button
              type="button"
              className={`${popupStyles.artworkNavBtn} ${popupStyles.artworkNavBtnLeft}`}
              aria-label="Previous artwork"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSlug(prevSlug);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              className={`${popupStyles.artworkNavBtn} ${popupStyles.artworkNavBtnRight}`}
              aria-label="Next artwork"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSlug(nextSlug);
              }}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      <div className={popupStyles.links}>
        <Link
          href={detailHref}
          className={popupStyles.link}
          prefetch={false}
          transitionTypes={["nav-forward"]}
          onClick={(e) => {
            if (
              e.metaKey ||
              e.ctrlKey ||
              e.shiftKey ||
              e.altKey ||
              e.button !== 0
            ) {
              return;
            }
            e.preventDefault();
            router.push(detailHref, { transitionTypes: ["nav-forward"] });
          }}
        >
          Details →
        </Link>
        {art.externalUrl ? (
          <a
            href={art.externalUrl}
            rel="noopener noreferrer"
            target="_blank"
            className={popupStyles.link}
            onClick={(e) => e.stopPropagation()}
          >
            Website →
          </a>
        ) : null}
      </div>
    </div>
  );
}
