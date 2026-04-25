"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
const VIEWPORT_MARGIN_PX = 12;
const CENTER_PANEL_HPAD = 16;

function computeCenteredAnchorPx(): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const panel = document.querySelector<HTMLElement>(PANEL);
  if (!panel) return { left: vw / 2, top: vh / 2 };

  const p = panel.getBoundingClientRect();
  // If the panel is a bottom sheet (nearly full width), center normally.
  if (p.width > vw * 0.86) return { left: vw / 2, top: vh / 2 };

  const leftEdge = Math.min(vw, Math.max(0, p.right + CENTER_PANEL_HPAD));
  const rightEdge = vw - CENTER_PANEL_HPAD;
  const availW = Math.max(0, rightEdge - leftEdge);
  return { left: leftEdge + availW / 2, top: vh / 2 };
}

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
  const rootRef = useRef<HTMLDivElement | null>(null);

  const sizeRef = useRef({ w: 0, h: 0 });
  const [pos, setPos] = useState({ left: 0, top: 0, maxW: PREVIEW_MAX_CAP });
  const [nudge, setNudge] = useState({ x: 0, y: 0 });
  const [shown, setShown] = useState(false);

  // Reset viewport nudge when switching artworks so corrections don’t carry over.
  useEffect(() => {
    setNudge({ x: 0, y: 0 });
    setShown(false);
  }, [art.slug]);

  // Track the rendered card size without forcing layout thrash on every map tick.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      sizeRef.current = { w: box.width, h: box.height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try {
          const { left, top } = computeCenteredAnchorPx();
          const maxW = computePreviewMaxWidthPx(map);

          // Deterministic viewport clamp (no oscillation while the map is animating).
          const { w, h } = sizeRef.current;
          if (w > 0 && h > 0) {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let dx = 0;
            let dy = 0;

            const rectLeft = left - w / 2;
            const rectRight = rectLeft + w;
            const rectTop = top - h / 2;
            const rectBottom = rectTop + h;

            if (rectLeft < VIEWPORT_MARGIN_PX) dx += VIEWPORT_MARGIN_PX - rectLeft;
            if (rectRight > vw - VIEWPORT_MARGIN_PX) dx -= rectRight - (vw - VIEWPORT_MARGIN_PX);
            if (rectTop < VIEWPORT_MARGIN_PX) dy += VIEWPORT_MARGIN_PX - rectTop;
            if (rectBottom > vh - VIEWPORT_MARGIN_PX) dy -= rectBottom - (vh - VIEWPORT_MARGIN_PX);

            // Avoid tiny jitter around the threshold.
            if (Math.abs(dx) < 0.5) dx = 0;
            if (Math.abs(dy) < 0.5) dy = 0;
            setNudge({ x: dx, y: dy });
            // Avoid showing an initial "wrong" frame (e.g. cut off at top) before clamp runs.
            setShown(true);
          }

          setPos({ left, top, maxW });
        } catch {
          /* map mid-teardown */
        }
      });
    };

    tick();
    // `render` can fire continuously; use movement events to avoid choppy reflows.
    map.on("move", tick);
    map.on("moveend", tick);
    map.on("zoom", tick);
    map.on("zoomend", tick);
    map.on("rotate", tick);
    map.on("pitch", tick);
    map.on("resize", tick);
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      map.off("move", tick);
      map.off("moveend", tick);
      map.off("zoom", tick);
      map.off("zoomend", tick);
      map.off("rotate", tick);
      map.off("pitch", tick);
      map.off("resize", tick);
      window.removeEventListener("scroll", tick, true);
      window.removeEventListener("resize", tick);
    };
  }, [map, popupOffsetY]);

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
      ref={rootRef}
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
        transform: `translate(calc(-50% + ${nudge.x}px), calc(-50% + ${nudge.y}px))`,
        willChange: "transform",
        opacity: shown ? 1 : 0,
        transition: "opacity 160ms ease",
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
