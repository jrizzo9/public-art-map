const DEFAULT_STYLE_PATH = "mapbox/streets-v12";

/** Mapbox “mapbox://” style URL → `user/id` path for Static Images API. */
export function mapboxStylePathFromEnv(styleUrl: string): string {
  const s = styleUrl.trim();
  if (!s.startsWith("mapbox://styles/")) return DEFAULT_STYLE_PATH;
  const rest = s.slice("mapbox://styles/".length).replace(/^\/+|\/+$/g, "");
  return rest || DEFAULT_STYLE_PATH;
}

/**
 * Full-bleed preview image centered on lng/lat (same style/token as interactive map).
 * https://docs.mapbox.com/api/maps/static-images/
 */
export function mapboxStaticSnapshotUrl(params: {
  lng: number;
  lat: number;
  /** Street-block context for detail pages */
  zoom?: number;
  width?: number;
  height?: number;
  styleUrl: string;
  accessToken: string;
}): string {
  const zoom = params.zoom ?? 16;
  const width = clampSize(params.width ?? 1280);
  const height = clampSize(params.height ?? 960);
  const style = mapboxStylePathFromEnv(params.styleUrl);
  const token = params.accessToken.trim();

  const path = `${params.lng},${params.lat},${zoom},0,0`;
  const qs = new URLSearchParams({ access_token: token });
  return `https://api.mapbox.com/styles/v1/${style}/static/${path}/${width}x${height}@2x?${qs}`;
}

function clampSize(n: number): number {
  if (!Number.isFinite(n)) return 1280;
  return Math.min(1280, Math.max(1, Math.round(n)));
}
