"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import mapboxgl, { type LngLatBoundsLike } from "mapbox-gl";
import { useEffect, useMemo, useRef } from "react";
import type { Artwork } from "@/lib/sheet";

type Props = {
  artworks: Artwork[];
  selectedSlug?: string;
  highlightSlug?: string;
  onSelectSlug?: (slug: string) => void;
  styleUrl?: string;
};

export function MapView({
  artworks,
  selectedSlug,
  highlightSlug,
  onSelectSlug,
  styleUrl,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

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

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    for (const art of artworks) {
      const el = document.createElement("button");
      el.type = "button";
      el.title = art.title;
      el.setAttribute("aria-label", art.title);
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "999px";
      el.style.border = "2px solid #0b0d12";
      const isHighlighted = art.slug === (highlightSlug || selectedSlug);
      el.style.background = isHighlighted ? "#ff4d2e" : "#ffd02e";
      el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.2)";
      el.style.cursor = "pointer";
      el.addEventListener("click", () => onSelectSlug?.(art.slug));

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([art.lng, art.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }

    if (bounds) {
      map.fitBounds(bounds, { padding: 60, duration: 0, maxZoom: 15 });
    }
  }, [artworks, bounds, highlightSlug, onSelectSlug, selectedSlug]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedSlug) return;
    const art = artworks.find((a) => a.slug === selectedSlug);
    if (!art) return;
    map.flyTo({ center: [art.lng, art.lat], zoom: Math.max(map.getZoom(), 14) });
  }, [artworks, selectedSlug]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

