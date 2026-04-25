"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import "@/components/mapbox-popup-theme.css";

import type { LngLatBoundsLike, Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArtworkMapPreview } from "@/components/ArtworkMapPreview";
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

/** Vertical `flyTo` offset (px) — preview card is portaled, not a Mapbox popup. */
const PREVIEW_FLYTO_OFFSET_Y = 150;

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
   * Increments when the home page clears map preview selection (`selectedSlug` → `undefined`).
   * Drives a guaranteed `fitBounds` refit so camera logic does not depend only on internal refs.
   */
  previewClosedSignal?: number;
  /**
   * When true, `artworks` is the full catalog (URL facets/year + list search are not narrowing).
   * Skips debounce on `fitBounds`; uses an animated overview when nothing is selected. Selection
   * still uses `flyTo`; we skip redundant `fitBounds` when only `selectedSlug` changes.
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
  previewClosedSignal = 0,
  mapShowsFullCatalog = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  type MapboxModule = typeof import("mapbox-gl");
  type MapboxGL = MapboxModule["default"];
  const mapboxglRef = useRef<MapboxGL | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const ignoreNextMapClickRef = useRef(false);
  const hasFittedBoundsOnceRef = useRef(false);
  /** When bounds change (filters), allow `fitBounds` again even if a row is selected. */
  const lastFittedBoundsKeyRef = useRef<string>("");
  /**
   * Last `selectedSlug` committed at the end of the fitBounds effect (sync). Used to detect
   * preview→no-preview even when we never hit `skipFitForSelectionOnly` (previously the slug was
   * only written from skip-fit or from async `runFit`, so it often stayed `undefined`).
   */
  const committedSelectedSlugForFitRef = useRef<string | undefined>(undefined);
  /** Last `previewClosedSignal` we applied in `fitBounds` (overview after closing preview). */
  const lastConsumedPreviewCloseSignalRef = useRef(0);
  const onSelectSlugRef = useRef(onSelectSlug);
  const onClearSelectionRef = useRef(onClearSelection);
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

  const previewArt = useMemo(() => {
    if (!selectedSlug) return null;
    const a = artworks.find((x) => x.slug === selectedSlug);
    if (!a || !Number.isFinite(a.lat) || !Number.isFinite(a.lng)) return null;
    return a;
  }, [artworks, selectedSlug]);

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
      lastConsumedPreviewCloseSignalRef.current = 0;
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
    const priorCommitted = committedSelectedSlugForFitRef.current;
    const closedSignalPending =
      selectedSlug === undefined &&
      previewClosedSignal > lastConsumedPreviewCloseSignalRef.current;
    const selectionJustCleared =
      closedSignalPending ||
      (typeof priorCommitted === "string" &&
        priorCommitted.length > 0 &&
        selectedSlug === undefined);

    if (!map || !bounds) {
      committedSelectedSlugForFitRef.current = selectedSlug;
      return;
    }

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
    const skipFitSameBoundsSelection =
      hasFittedBoundsOnceRef.current &&
      slugInList &&
      lastFittedBoundsKeyRef.current === boundsKey;
    /**
     * Narrowed list + a selected pin (URL `art`, auto-first on filter, or row click): do not
     * `fitBounds` every marker — that uses overview padding and pulls the active pin out of frame.
     * Let the popup `flyTo` own the camera; overview runs when preview clears (`!selectedSlug`).
     */
    const skipFitNarrowedCatalogWithPin = !mapShowsFullCatalog && slugInList;

    if (skipFitSameBoundsSelection || skipFitNarrowedCatalogWithPin) {
      committedSelectedSlugForFitRef.current = selectedSlug;
      if (skipFitNarrowedCatalogWithPin) {
        hasFittedBoundsOnceRef.current = true;
        lastFittedBoundsKeyRef.current = boundsKey;
      }
      return;
    }

    const delay = selectionJustCleared
      ? 0
      : !mapShowsFullCatalog && hasFittedBoundsOnceRef.current
        ? FIT_BOUNDS_DEBOUNCE_MS
        : 0;
    /**
     * Full catalog (no narrowing vs `artworks`): animate the overview so all pins land in frame
     * (respecting `mapChromePadding` / floating panel). When a row or `?art=` is focused, keep
     * duration 0 so this `fitBounds` does not race the selection `flyTo` + popup.
     */
    /** No map preview: always ease to data bounds (full or filtered). With preview, first paint uses 0 so `flyTo` wins. */
    const overviewNoSelection = !selectedSlug;
    const fitDuration = selectionJustCleared
      ? FIT_BOUNDS_DURATION_MS
      : mapShowsFullCatalog
        ? selectedSlug
          ? 0
          : FIT_BOUNDS_DURATION_MS
        : !hasFittedBoundsOnceRef.current
          ? overviewNoSelection
            ? FIT_BOUNDS_DURATION_MS
            : 0
          : FIT_BOUNDS_DURATION_MS;
    const runFit = () => {
      if (mapRef.current !== map) return;
      if (!map.isStyleLoaded()) return;
      try {
        map.resize();
      } catch {
        /* ignore */
      }
      // End any in-flight `flyTo` from the selection popup; otherwise `fitBounds` can no-op and the
      // view stays zoomed on the closed preview.
      if (selectionJustCleared) map.stop();
      map.fitBounds(bounds, {
        padding: mapChromePadding(map),
        duration: fitDuration,
        maxZoom: 15,
        essential: true,
      });
      hasFittedBoundsOnceRef.current = true;
      lastFittedBoundsKeyRef.current = boundsKey;
      if (closedSignalPending) {
        lastConsumedPreviewCloseSignalRef.current = previewClosedSignal;
      }
    };

    let ranReadyFit = false;
    const runFitWhenStyleReady = () => {
      if (ranReadyFit || mapRef.current !== map) return;
      if (!map.isStyleLoaded()) return;
      ranReadyFit = true;
      map.off("load", runFitWhenStyleReady);
      map.off("idle", runFitWhenStyleReady);
      runFit();
    };

    const id = window.setTimeout(() => {
      if (mapRef.current !== map) return;
      if (map.isStyleLoaded()) {
        runFit();
        return;
      }
      // `load` may have fired before this listener is attached; `idle` still fires once the map
      // can render — without this, first paint often never runs `fitBounds` (stuck on default center).
      map.on("load", runFitWhenStyleReady);
      map.on("idle", runFitWhenStyleReady);
    }, delay);

    committedSelectedSlugForFitRef.current = selectedSlug;

    return () => {
      window.clearTimeout(id);
      map.off("load", runFitWhenStyleReady);
      map.off("idle", runFitWhenStyleReady);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `bounds`/`artworks` via boundsKey/artworksSlugsKey
  }, [
    artworksSlugsKey,
    boundsKey,
    mapReadyTick,
    mapShowsFullCatalog,
    previewClosedSignal,
    selectedSlug,
  ]);

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
      if (target?.closest("[data-artwork-map-preview]")) return;

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

  /** Camera only — preview UI is portaled to `document.body` so the map area can be dimmed underneath. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedSlug) return;
    const art = artworks.find((a) => a.slug === selectedSlug);
    if (!art || !Number.isFinite(art.lat) || !Number.isFinite(art.lng)) return;

    const lngLat: [number, number] = [art.lng, art.lat];

    const applyCamera = () => {
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
        offset: [0, PREVIEW_FLYTO_OFFSET_Y],
      });
    };

    let applied = false;
    const tryApplyCamera = () => {
      if (applied || mapRef.current !== map) return;
      if (!map.isStyleLoaded()) return;
      applied = true;
      map.off("load", tryApplyCamera);
      map.off("idle", tryApplyCamera);
      applyCamera();
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
      try {
        map.stop();
      } catch {
        /* map may be mid-teardown */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `artworks`/`bounds` via slugsKey/boundsKey
  }, [artworksSlugsKey, boundsKey, mapReadyTick, mapShowsFullCatalog, selectedSlug]);

  const mapForPortal = mapRef.current;

  return (
    <>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {mapReadyTick > 0 &&
        previewArt &&
        mapForPortal &&
        createPortal(
          <ArtworkMapPreview
            map={mapForPortal}
            art={previewArt}
            artworks={artworks}
            homeQueryString={homeQueryString ?? ""}
            onClose={() => onClearSelectionRef.current?.()}
            onSelectSlug={(slug) => onSelectSlugRef.current?.(slug)}
            popupOffsetY={
              mapForPortal.getContainer().getBoundingClientRect().width < 640 ? -68 : -18
            }
          />,
          document.body,
        )}
    </>
  );
}

