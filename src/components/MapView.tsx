"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import "@/components/mapbox-popup-theme.css";

import type {
  LngLatBoundsLike,
  Map as MapboxMap,
  Popup as MapboxPopup,
  MapMouseEvent,
} from "mapbox-gl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import popupStyles from "@/components/MapPopup.module.css";
import { markerColorForCategory } from "@/lib/category-colors";
import type { Artwork } from "@/lib/sheet";

/** Left column matches floating list panel (~340px) + edge breathing room; asymmetric vertical padding biases the focal point up/right. */
const PANEL_RESERVE_PX = 340;
const PANEL_GUTTER_PX = 28;

/** Bottom sheet ~30% height on narrow viewports — matches `.panel` mobile styles in `home.module.css`. */
const MOBILE_SHEET_HEIGHT_RATIO = 0.3;
/** Extra top inset so the pin lands mid-to-upper screen (not hugging the top); popup sits above with context below. */
const MOBILE_FLY_TOP_INSET_RATIO = 0.24;

/** Smooth camera when fitting to filtered markers (filter changes). */
const FIT_BOUNDS_DURATION_MS = 1150;
/** Coalesce rapid filter tweaks (e.g. year typing) into one camera move. */
const FIT_BOUNDS_DEBOUNCE_MS = 320;

/** Padding so markers / bounds stay in the visible map area (not under the floating panel or bottom sheet). */
function mapChromePadding(map: MapboxMap) {
  const { width: w, height: h } = map.getContainer().getBoundingClientRect();
  if (!w || !h) {
    return { top: 48, right: 32, bottom: 120, left: 360 };
  }

  const isNarrow = w < 640;

  if (isNarrow) {
    const bottom = Math.round(h * MOBILE_SHEET_HEIGHT_RATIO);
    const top = Math.max(8, Math.round(h * MOBILE_FLY_TOP_INSET_RATIO));
    const side = Math.max(12, Math.round(w * 0.04));
    return { top, right: side, bottom, left: side };
  }

  const minPanelReserve = PANEL_RESERVE_PX + PANEL_GUTTER_PX + 16;
  const left = Math.round(Math.min(Math.max(minPanelReserve, w * 0.34), w - 140));
  const top = Math.round(h * 0.06);
  const bottom = Math.round(h * 0.2);
  const right = Math.min(56, Math.round(w * 0.04));

  return { top, right, bottom, left };
}

function selectionFlyPadding(map: MapboxMap) {
  return mapChromePadding(map);
}

/** Mapbox draws a tip below `.mapboxgl-popup-content`; off-DOM probe omits it — add slack so offset matches real popup height. */
const MAPBOX_POPUP_TAIL_BELOW_CARD_ESTIMATE_PX = 18;

/**
 * Approximate full popup stack height before `Popup` mounts (wrap + themed content shell + tip slack).
 */
function measureArtworkPopupOuterHeightPx(
  wrap: HTMLElement,
  maxWidthCss: string,
): number {
  const outer = document.createElement("div");
  outer.style.cssText =
    "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;contain:layout;";
  outer.style.maxWidth = maxWidthCss;

  const content = document.createElement("div");
  content.className = "mapboxgl-popup-content";
  content.appendChild(wrap);

  outer.appendChild(content);
  document.body.appendChild(outer);

  const measured = outer.offsetHeight;

  content.removeChild(wrap);
  outer.remove();

  const h = measured + MAPBOX_POPUP_TAIL_BELOW_CARD_ESTIMATE_PX;
  return Number.isFinite(h) && h > 80 ? h : 280;
}

type Props = {
  artworks: Artwork[];
  selectedSlug?: string;
  highlightSlug?: string;
  onSelectSlug?: (slug: string) => void;
  onClearSelection?: () => void;
  styleUrl?: string;
  /** Query string from the home page (filters + fs) to preserve context. */
  homeQueryString?: string;
  /**
   * When true, the map is showing the full catalog (no narrowing). Used for debounce/duration on
   * filter-driven `fitBounds`. Selection still uses `flyTo`; we skip redundant `fitBounds` when only
   * `selectedSlug` changes so `flyTo` is not overwritten.
   */
  mapShowsFullCatalog?: boolean;
};

export function MapView({
  artworks,
  selectedSlug,
  highlightSlug,
  onSelectSlug,
  onClearSelection,
  styleUrl,
  homeQueryString,
  mapShowsFullCatalog = false,
}: Props) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const containerRef = useRef<HTMLDivElement | null>(null);
  type MapboxModule = typeof import("mapbox-gl");
  type MapboxGL = MapboxModule["default"];
  const mapboxglRef = useRef<MapboxGL | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const popupRef = useRef<MapboxPopup | null>(null);
  const ignoreNextMapClickRef = useRef(false);
  const hasFittedBoundsOnceRef = useRef(false);
  /** When bounds change (filters), allow `fitBounds` again even if a row is selected. */
  const lastFittedBoundsKeyRef = useRef<string>("");
  /** Tracks last `selectedSlug` so we can run a bouncy overview `fitBounds` when preview clears. */
  const prevSelectedSlugForFitRef = useRef<string | undefined>(undefined);
  const onSelectSlugRef = useRef(onSelectSlug);
  const onClearSelectionRef = useRef(onClearSelection);
  /** Latest filters+`art` for detail links — not a popup effect dep so URL sync doesn’t remount the popup. */
  const homeQueryStringRef = useRef(homeQueryString);
  homeQueryStringRef.current = homeQueryString;

  useEffect(() => {
    onSelectSlugRef.current = onSelectSlug;
    onClearSelectionRef.current = onClearSelection;
  }, [onSelectSlug, onClearSelection]);

  const bounds = useMemo(() => {
    const coords = artworks
      .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lng))
      .map((a) => [a.lng, a.lat] as const);
    if (coords.length === 0) return null;
    const lons = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    return [
      [minLon, minLat],
      [maxLon, maxLat],
    ] satisfies LngLatBoundsLike;
  }, [artworks]);

  const boundsKey = useMemo(() => (bounds ? JSON.stringify(bounds) : ""), [bounds]);
  const artworksSlugsKey = useMemo(
    () => artworks.map((a) => a.slug).join("\0"),
    [artworks],
  );

  const geojson = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>
  >(() => {
    return {
      type: "FeatureCollection",
      features: artworks
        .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lng))
        .map((a) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [a.lng, a.lat] },
          properties: {
            slug: a.slug,
            title: a.title,
            category: a.category ?? null,
            color: markerColorForCategory(a.category),
          },
        })),
    };
  }, [artworks]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      const mod = await import("mapbox-gl");
      if (cancelled) return;
      const mapboxgl = mod.default;
      mapboxglRef.current = mapboxgl;

      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: styleUrl || "mapbox://styles/mapbox/streets-v12",
        center: [-97.1467, 31.5493],
        zoom: 12,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;
      setMapReadyTick((x) => x + 1);

      const container = containerRef.current;
      if (typeof ResizeObserver !== "undefined" && container) {
        ro = new ResizeObserver(() => map.resize());
        ro.observe(container);
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxglRef.current = null;
      /** New map instance must be allowed to `fitBounds` again (React Strict remount / dynamic remount). */
      hasFittedBoundsOnceRef.current = false;
      lastFittedBoundsKeyRef.current = "";
    };
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const SOURCE_ID = "artworks";
    const LAYER_ID = "artworks-circles";

    const ensure = () => {
      // Source
      const src = map.getSource(SOURCE_ID) as { setData?: (d: unknown) => void } | undefined;
      if (!src) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: geojson,
        });
      } else {
        src.setData?.(geojson);
      }

      // Layer
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": 5,
            "circle-stroke-width": 1,
            "circle-stroke-color": "rgba(0,0,0,0.25)",
          },
        });
      }
    };

    if (map.isStyleLoaded()) {
      ensure();
      return;
    }
    map.once("load", ensure);
  }, [geojson, mapReadyTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bounds) return;

    const prevSlug = prevSelectedSlugForFitRef.current;
    const clearedMapPreview =
      typeof prevSlug === "string" &&
      prevSlug.length > 0 &&
      selectedSlug === undefined;

    const slugInList =
      !!selectedSlug &&
      artworks.some(
        (a) =>
          a.slug === selectedSlug &&
          Number.isFinite(a.lat) &&
          Number.isFinite(a.lng),
      );

    /**
     * After the first `fitBounds` for these bounds, changing only `selectedSlug` should not refit —
     * the popup effect uses `flyTo`. Without this skip, full-catalog mode re-ran `fitBounds` on
     * every click and cancelled pin zoom.
     */
    const skipFitForSelectionOnly =
      hasFittedBoundsOnceRef.current &&
      slugInList &&
      lastFittedBoundsKeyRef.current === boundsKey;
    if (skipFitForSelectionOnly) {
      prevSelectedSlugForFitRef.current = selectedSlug;
      return;
    }

    const delay = clearedMapPreview
      ? 0
      : !mapShowsFullCatalog && hasFittedBoundsOnceRef.current
        ? FIT_BOUNDS_DEBOUNCE_MS
        : 0;
    const fitDuration = clearedMapPreview
      ? FIT_BOUNDS_DURATION_MS
      : mapShowsFullCatalog || !hasFittedBoundsOnceRef.current
        ? 0
        : FIT_BOUNDS_DURATION_MS;
    const runFit = () => {
      if (mapRef.current !== map) return;
      if (!map.isStyleLoaded()) return;
      try {
        map.resize();
      } catch {
        /* ignore */
      }
      map.fitBounds(bounds, {
        padding: mapChromePadding(map),
        duration: fitDuration,
        maxZoom: 15,
        essential: true,
      });
      hasFittedBoundsOnceRef.current = true;
      lastFittedBoundsKeyRef.current = boundsKey;
      // Only commit after fit runs — if we cleared this ref at effect end, a quick re-run
      // (e.g. `artworks` identity / URL sync) could cancel the timeout and lose `clearedMapPreview`.
      prevSelectedSlugForFitRef.current = selectedSlug;
    };

    const id = window.setTimeout(() => {
      if (mapRef.current !== map) return;
      if (map.isStyleLoaded()) runFit();
      else map.once("load", runFit);
    }, delay);

    return () => {
      window.clearTimeout(id);
      map.off("load", runFit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `bounds`/`artworks` via boundsKey/artworksSlugsKey
  }, [artworksSlugsKey, boundsKey, mapReadyTick, mapShowsFullCatalog, selectedSlug]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const LAYER_ID = "artworks-circles";
    if (!map.getLayer(LAYER_ID)) return;

    const focus = highlightSlug || selectedSlug || "";
    map.setPaintProperty(LAYER_ID, "circle-radius", [
      "case",
      ["==", ["get", "slug"], focus],
      7,
      5,
    ]);
    map.setPaintProperty(LAYER_ID, "circle-stroke-width", [
      "case",
      ["==", ["get", "slug"], focus],
      2,
      1,
    ]);
    map.setPaintProperty(LAYER_ID, "circle-stroke-color", [
      "case",
      ["==", ["get", "slug"], focus],
      "rgba(0,0,0,0.45)",
      "rgba(0,0,0,0.25)",
    ]);
  }, [highlightSlug, selectedSlug, mapReadyTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMapClick = (e: MapMouseEvent) => {
      if (ignoreNextMapClickRef.current) {
        ignoreNextMapClickRef.current = false;
        return;
      }

      const target = e.originalEvent?.target as HTMLElement | null;
      if (target?.closest(".mapboxgl-popup")) return;

      onClearSelectionRef.current?.();
    };
    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const LAYER_ID = "artworks-circles";

    const onClick = (e: unknown) => {
      const evt = e as {
        originalEvent?: MouseEvent;
        features?: Array<{ properties?: Record<string, unknown> }>;
      };
      const slug =
        (evt.features?.[0]?.properties?.slug as string | undefined) ?? undefined;
      if (!slug) return;
      evt.originalEvent?.preventDefault();
      evt.originalEvent?.stopPropagation();
      ignoreNextMapClickRef.current = true;
      onSelectSlugRef.current?.(slug);
    };

    const setCursor = (cursor: string) => {
      const canvas = map.getCanvas?.();
      if (canvas) canvas.style.cursor = cursor;
    };

    const onEnter = () => setCursor("pointer");
    const onLeave = () => setCursor("");

    let attached = false;
    const attachIfReady = () => {
      if (attached) return;
      if (!map.getLayer(LAYER_ID)) return;
      map.on("click", LAYER_ID, onClick as never);
      map.on("mouseenter", LAYER_ID, onEnter as never);
      map.on("mouseleave", LAYER_ID, onLeave as never);
      attached = true;
    };

    attachIfReady();
    if (!attached) {
      // Layer is added on `load` and can be recreated when the style changes.
      map.on("load", attachIfReady);
      map.on("styledata", attachIfReady);
    }

    return () => {
      map.off("load", attachIfReady);
      map.off("styledata", attachIfReady);
      if (attached) {
        map.off("click", LAYER_ID, onClick as never);
        map.off("mouseenter", LAYER_ID, onEnter as never);
        map.off("mouseleave", LAYER_ID, onLeave as never);
        setCursor("");
      }
    };
  }, [mapReadyTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const mapboxgl = mapboxglRef.current;
    if (!mapboxgl) return;

    popupRef.current?.remove();
    popupRef.current = null;

    if (!selectedSlug) return;
    const art = artworks.find((a) => a.slug === selectedSlug);
    if (!art) return;

    const lngLat: [number, number] = [art.lng, art.lat];

    const wrap = document.createElement("div");
    wrap.className = popupStyles.popupRoot;

    const top = document.createElement("div");
    top.className = popupStyles.topRow;

    const title = document.createElement("div");
    title.className = popupStyles.title;
    title.textContent = art.title;

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close preview");
    close.className = popupStyles.closeBtn;
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      onClearSelectionRef.current?.();
    });

    top.appendChild(title);
    top.appendChild(close);
    wrap.appendChild(top);

    const meta = document.createElement("div");
    meta.className = popupStyles.meta;
    meta.textContent =
      [art.artist?.trim(), art.year ? String(art.year) : undefined]
        .filter(Boolean)
        .join(", ") || art.category || "Artwork";
    wrap.appendChild(meta);

    const primaryImage = art.image ?? art.images?.[0];
    if (primaryImage) {
      const frame = document.createElement("div");
      frame.className = popupStyles.imageFrame;

      const img = document.createElement("img");
      img.src = primaryImage;
      img.alt = art.title;
      img.loading = "lazy";
      img.className = popupStyles.image;

      frame.appendChild(img);
      wrap.appendChild(frame);
    } else {
      const ph = document.createElement("div");
      ph.className = popupStyles.imagePlaceholder;
      ph.setAttribute("role", "img");
      ph.setAttribute("aria-label", "Photo not yet available");
      const label = document.createElement("span");
      label.className = popupStyles.placeholderInner;
      label.textContent = "Photo coming soon";
      label.setAttribute("aria-hidden", "true");
      ph.appendChild(label);
      wrap.appendChild(ph);
    }

    const links = document.createElement("div");
    links.className = popupStyles.links;

    const details = document.createElement("a");
    const detailHrefForSlug = (slug: string) => {
      const qs = homeQueryStringRef.current
        ? homeQueryStringRef.current.replace(/^\?/, "")
        : "";
      return qs ? `/art/${slug}?${qs}` : `/art/${slug}`;
    };
    details.href = detailHrefForSlug(art.slug);
    details.textContent = "Details →";
    details.className = popupStyles.link;
    details.addEventListener("click", (e) => {
      e.stopPropagation();
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
      routerRef.current.push(detailHrefForSlug(art.slug), {
        transitionTypes: ["nav-forward"],
      });
    });

    links.appendChild(details);

    if (art.externalUrl) {
      const ext = document.createElement("a");
      ext.href = art.externalUrl;
      ext.rel = "noopener noreferrer";
      ext.target = "_blank";
      ext.textContent = "Website →";
      ext.className = popupStyles.link;
      ext.addEventListener("click", (e) => e.stopPropagation());
      links.appendChild(ext);
    }

    wrap.appendChild(links);

    // Artwork cycling: prev/next within the currently-filtered artworks list.
    if (artworks.length > 1) {
      const idx = Math.max(
        0,
        artworks.findIndex((a) => a.slug === art.slug),
      );
      const prevSlug = artworks[(idx - 1 + artworks.length) % artworks.length]?.slug;
      const nextSlug = artworks[(idx + 1) % artworks.length]?.slug;

      if (prevSlug && nextSlug) {
        const prevArt = document.createElement("button");
        prevArt.type = "button";
        prevArt.className = `${popupStyles.artworkNavBtn} ${popupStyles.artworkNavBtnLeft}`;
        prevArt.setAttribute("aria-label", "Previous artwork");
        prevArt.textContent = "‹";
        prevArt.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectSlugRef.current?.(prevSlug);
        });

        const nextArt = document.createElement("button");
        nextArt.type = "button";
        nextArt.className = `${popupStyles.artworkNavBtn} ${popupStyles.artworkNavBtnRight}`;
        nextArt.setAttribute("aria-label", "Next artwork");
        nextArt.textContent = "›";
        nextArt.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectSlugRef.current?.(nextSlug);
        });

        // Attach to the popup root so it works whether we show a photo or placeholder.
        wrap.appendChild(prevArt);
        wrap.appendChild(nextArt);
      }
    }

    const narrow = map.getContainer().getBoundingClientRect().width < 640;
    const popupMaxWidth = narrow ? "min(680px, calc(100vw - 32px))" : "680px";
    const popupOuterH = measureArtworkPopupOuterHeightPx(wrap, popupMaxWidth);
    const popupOffsetY = narrow ? -68 : -18;

    const applyCameraAndPopup = () => {
      if (mapRef.current !== map) return;
      if (!map.isStyleLoaded()) return;

      map.flyTo({
        center: lngLat,
        zoom: Math.max(map.getZoom(), 14),
        padding: selectionFlyPadding(map),
        retainPadding: false,
        essential: true,
        duration: 900,
        curve: 1.5,
        offset: [0, popupOuterH / 2],
      });

      const popup = new mapboxgl.Popup({
        anchor: "bottom",
        closeButton: false,
        closeOnClick: false,
        maxWidth: popupMaxWidth,
        offset: [0, popupOffsetY] as [number, number],
      })
        .setLngLat(lngLat)
        .setDOMContent(wrap)
        .addTo(map);

      popupRef.current = popup;
    };

    /**
     * Defer so `fitBounds` (same tick / `load`) can run first. `load` may already have fired before
     * this listener is attached — use `idle` as a fallback so `flyTo` + popup still run.
     */
    let applied = false;
    const tryApplyCamera = () => {
      if (applied || mapRef.current !== map) return;
      if (!map.isStyleLoaded()) return;
      applied = true;
      map.off("load", tryApplyCamera);
      map.off("idle", tryApplyCamera);
      applyCameraAndPopup();
    };

    const id = window.setTimeout(() => {
      if (mapRef.current !== map) return;
      if (map.isStyleLoaded()) tryApplyCamera();
      else {
        map.once("load", tryApplyCamera);
        map.once("idle", tryApplyCamera);
      }
    }, 0);

    return () => {
      window.clearTimeout(id);
      map.off("load", tryApplyCamera);
      map.off("idle", tryApplyCamera);
      popupRef.current?.remove();
      popupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `artworks`/`bounds` via slugsKey/boundsKey; router ref
  }, [artworksSlugsKey, boundsKey, mapReadyTick, mapShowsFullCatalog, selectedSlug]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

