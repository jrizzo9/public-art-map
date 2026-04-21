"use client";

import type { Artwork } from "@/types/artwork";
import { getMapboxStyleUrl, getMapboxToken } from "@/lib/env";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

type ArtMapProps = {
  artworks: Artwork[];
  selectedSlug?: string | null;
  onSelectSlug?: (slug: string) => void;
  className?: string;
};

const WACO_DEFAULT: [number, number] = [-97.1467, 31.5494];

export function ArtMap({
  artworks,
  selectedSlug,
  onSelectSlug,
  className,
}: ArtMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    const token = getMapboxToken();
    const el = containerRef.current;
    if (!el || !token || mapRef.current) return;

    mapboxgl.accessToken = token;

    const center: [number, number] =
      artworks.length === 1 ? [artworks[0]!.lng, artworks[0]!.lat] : WACO_DEFAULT;

    const map = new mapboxgl.Map({
      container: el,
      style: getMapboxStyleUrl(),
      center,
      zoom: artworks.length === 1 ? 14 : 11,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map mounts once per mount
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    for (const a of artworks) {
      const isSelected = a.slug === selectedSlug;
      const markerEl = document.createElement("button");
      markerEl.type = "button";
      markerEl.setAttribute("aria-label", `View ${a.title} on map`);
      markerEl.className = [
        "h-3 w-3 rounded-full border-2 border-white shadow transition ring-2",
        isSelected ? "bg-amber-500 ring-amber-600" : "bg-emerald-500 ring-emerald-700",
      ].join(" ");

      markerEl.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectSlug?.(a.slug);
      });

      const marker = new mapboxgl.Marker({ element: markerEl }).setLngLat([a.lng, a.lat]).addTo(map);
      markersRef.current.push(marker);
    }

    if (artworks.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    for (const a of artworks) bounds.extend([a.lng, a.lat]);
    if (artworks.length === 1) {
      map.easeTo({ center: [artworks[0]!.lng, artworks[0]!.lat], zoom: 14, duration: 600 });
    } else {
      map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 600 });
    }

    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
    };
  }, [artworks, selectedSlug, onSelectSlug]);

  const token = getMapboxToken();
  if (!token) {
    return (
      <div
        className={
          className ??
          "flex min-h-[320px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900"
        }
      >
        Set <code className="rounded bg-white px-1 py-0.5">NEXT_PUBLIC_MAPBOX_TOKEN</code> to load
        the map.
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className ?? "min-h-[420px] w-full rounded-lg"} />
  );
}
