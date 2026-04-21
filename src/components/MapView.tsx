"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import mapboxgl, { type LngLatBoundsLike } from "mapbox-gl";
import { useEffect, useMemo, useRef } from "react";
import { HIGHLIGHT_MARKER, markerColorForCategory } from "@/lib/category-colors";
import type { Artwork } from "@/lib/sheet";

/** Left column matches floating list panel (~340px) + edge breathing room; asymmetric vertical padding biases the focal point up/right. */
const PANEL_RESERVE_PX = 340;
const PANEL_GUTTER_PX = 28;

/** Bottom sheet ~50% height on narrow viewports — matches `.panel` mobile styles in `home.module.css`. */
const MOBILE_SHEET_HEIGHT_RATIO = 0.5;
/** Extra top inset so the pin lands mid-to-upper screen (not hugging the top); popup sits above with context below. */
const MOBILE_FLY_TOP_INSET_RATIO = 0.24;

function selectionFlyPadding(map: mapboxgl.Map) {
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

type Props = {
  artworks: Artwork[];
  selectedSlug?: string;
  highlightSlug?: string;
  onSelectSlug?: (slug: string) => void;
  onClearSelection?: () => void;
  styleUrl?: string;
};

export function MapView({
  artworks,
  selectedSlug,
  highlightSlug,
  onSelectSlug,
  onClearSelection,
  styleUrl,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const markerBySlugRef = useRef(new Map<string, mapboxgl.Marker>());
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const didFitBoundsRef = useRef(false);
  const ignoreNextMapClickRef = useRef(false);
  const onSelectSlugRef = useRef(onSelectSlug);
  const onClearSelectionRef = useRef(onClearSelection);
  onSelectSlugRef.current = onSelectSlug;
  onClearSelectionRef.current = onClearSelection;

  const bounds = useMemo(() => {
    const coords = artworks.map((a) => [a.lng, a.lat] as const);
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

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl || "mapbox://styles/mapbox/streets-v12",
      center: [-97.1467, 31.5493],
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    mapRef.current = map;

    const container = containerRef.current;
    const ro =
      typeof ResizeObserver !== "undefined" && container
        ? new ResizeObserver(() => {
            map.resize();
          })
        : null;
    ro?.observe(container);

    return () => {
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    markerBySlugRef.current.clear();
    didFitBoundsRef.current = false;

    for (const art of artworks) {
      const el = document.createElement("button");
      el.type = "button";
      el.title = art.title;
      el.setAttribute("aria-label", art.title);
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "999px";
      el.style.border = "2px solid #0b0d12";
      el.style.background = markerColorForCategory(art.category);
      el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.2)";
      el.style.cursor = "pointer";
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Mapbox will still emit a map click in some cases; ignore the next one.
        ignoreNextMapClickRef.current = true;
        onSelectSlugRef.current?.(art.slug);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([art.lng, art.lat])
        .addTo(map);
      markersRef.current.push(marker);
      markerBySlugRef.current.set(art.slug, marker);
    }

    if (bounds) {
      map.fitBounds(bounds, { padding: 60, duration: 0, maxZoom: 15 });
      didFitBoundsRef.current = true;
    }
    // Intentionally omit onSelectSlug: parent re-renders must not rebuild markers + fitBounds.
  }, [artworks, bounds]);

  useEffect(() => {
    for (const art of artworks) {
      const marker = markerBySlugRef.current.get(art.slug);
      const el = marker?.getElement() as HTMLElement | undefined;
      if (!el) continue;
      const isHighlighted = art.slug === (highlightSlug || selectedSlug);
      el.style.background = isHighlighted
        ? HIGHLIGHT_MARKER
        : markerColorForCategory(art.category);
    }
  }, [artworks, highlightSlug, selectedSlug]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMapClick = (e: mapboxgl.MapMouseEvent) => {
      if (ignoreNextMapClickRef.current) {
        ignoreNextMapClickRef.current = false;
        return;
      }

      const target = e.originalEvent?.target as HTMLElement | null;
      if (target?.closest(".mapboxgl-marker, .mapboxgl-popup")) return;

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

    popupRef.current?.remove();
    popupRef.current = null;

    if (!selectedSlug) return;
    const art = artworks.find((a) => a.slug === selectedSlug);
    if (!art) return;

    // Place the artwork in the clear map area (right of the floating panel), biased toward the upper-right.
    map.flyTo({
      center: [art.lng, art.lat],
      zoom: Math.max(map.getZoom(), 14),
      padding: selectionFlyPadding(map),
      retainPadding: false,
      essential: true,
      duration: 900,
      curve: 1.5,
    });

    const wrap = document.createElement("div");
    wrap.style.width = "260px";
    wrap.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    wrap.style.color = "#0b0d12";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.alignItems = "flex-start";
    top.style.justifyContent = "space-between";
    top.style.gap = "10px";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.fontSize = "13px";
    title.style.lineHeight = "1.2";
    title.textContent = art.title;

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close preview");
    close.style.border = "1px solid rgba(20,20,20,0.14)";
    close.style.background = "rgba(255,255,255,0.9)";
    close.style.borderRadius = "10px";
    close.style.width = "28px";
    close.style.height = "28px";
    close.style.cursor = "pointer";
    close.style.lineHeight = "1";
    close.style.fontSize = "18px";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      onClearSelectionRef.current?.();
    });

    title.style.paddingTop = "2px";
    top.appendChild(title);
    top.appendChild(close);
    wrap.appendChild(top);

    const meta = document.createElement("div");
    meta.style.marginTop = "6px";
    meta.style.fontSize = "12px";
    meta.style.color = "rgba(17,23,38,0.7)";
    meta.textContent =
      (art.category ?? "Artwork") + (art.address ? ` · ${art.address}` : "");
    wrap.appendChild(meta);

    if (art.image) {
      const img = document.createElement("img");
      img.src = art.image;
      img.alt = art.title;
      img.loading = "lazy";
      img.style.display = "block";
      img.style.width = "100%";
      img.style.height = "140px";
      img.style.objectFit = "cover";
      img.style.marginTop = "10px";
      img.style.borderRadius = "12px";
      img.style.border = "1px solid rgba(20,20,20,0.12)";
      wrap.appendChild(img);
    }

    const links = document.createElement("div");
    links.style.display = "flex";
    links.style.gap = "10px";
    links.style.flexWrap = "wrap";
    links.style.marginTop = "10px";

    const details = document.createElement("a");
    details.href = `/art/${art.slug}`;
    details.textContent = "Details →";
    details.style.fontSize = "12px";
    details.style.textDecoration = "underline";
    details.style.color = "rgba(17,23,38,0.92)";
    details.addEventListener("click", (e) => e.stopPropagation());

    const embed = document.createElement("a");
    embed.href = `/embed/art/${art.slug}`;
    embed.textContent = "Embed →";
    embed.style.fontSize = "12px";
    embed.style.textDecoration = "underline";
    embed.style.color = "rgba(17,23,38,0.92)";
    embed.addEventListener("click", (e) => e.stopPropagation());

    links.appendChild(details);
    links.appendChild(embed);

    if (art.externalUrl) {
      const ext = document.createElement("a");
      ext.href = art.externalUrl;
      ext.rel = "noopener noreferrer";
      ext.target = "_blank";
      ext.textContent = "Website →";
      ext.style.fontSize = "12px";
      ext.style.textDecoration = "underline";
      ext.style.color = "rgba(17,23,38,0.92)";
      ext.addEventListener("click", (e) => e.stopPropagation());
      links.appendChild(ext);
    }

    wrap.appendChild(links);

    const narrow = map.getContainer().getBoundingClientRect().width < 640;

    // Anchor bottom = bottom edge (and tip) sits at lnglat so the card is above the dot.
    // Negative Y offset moves the popup up (Mapbox: negative is up); positive was pushing the tip through the marker on mobile.
    const popupOffsetY = narrow ? -22 : -18;

    const popup = new mapboxgl.Popup({
      anchor: "bottom",
      closeButton: false,
      closeOnClick: false,
      maxWidth: narrow ? "min(280px, calc(100vw - 48px))" : "280px",
      offset: [0, popupOffsetY] as [number, number],
    })
      .setLngLat([art.lng, art.lat])
      .setDOMContent(wrap)
      .addTo(map);

    popupRef.current = popup;
  }, [artworks, selectedSlug]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

