/** Base URL for canonical links, sitemap, and OG (no trailing slash). */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return raw.replace(/\/$/, "");
}

export function getSheetCsvUrl(): string | undefined {
  return process.env.SHEET_CSV_URL?.trim() || undefined;
}

export function getRevalidateSeconds(): number {
  const n = Number.parseInt(process.env.REVALIDATE_SECONDS ?? "300", 10);
  return Number.isFinite(n) && n > 0 ? n : 300;
}

export function getMapboxToken(): string {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";
}

export function getMapboxStyleUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL?.trim() ||
    "mapbox://styles/mapbox/streets-v12"
  );
}

/** Origins allowed to embed `/embed/*` routes in an iframe (no trailing paths). */
export function getEmbedFrameAncestors(): string[] {
  const fromEnv = process.env.EMBED_ALLOWED_ORIGINS;
  if (fromEnv?.trim()) {
    return fromEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ["https://creativewaco.org", "https://www.creativewaco.org"];
}
