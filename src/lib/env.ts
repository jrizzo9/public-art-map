function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value : undefined;
}

function normalizeOrigin(raw: string): string {
  // Keep only scheme + host (+ port). Also strips trailing slash.
  try {
    return new URL(raw).origin;
  } catch {
    // Allow passing bare domains like "map.creativewaco.org"
    const withScheme = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
    return new URL(withScheme).origin;
  }
}

export const env = {
  NEXT_PUBLIC_SITE_URL: () =>
    normalizeOrigin(
      optional("NEXT_PUBLIC_SITE_URL") ??
        (process.env.VERCEL_ENV === "production"
          ? // Prefer the custom domain for canonical URLs on production.
            // (VERCEL_URL is the deployment *.vercel.app URL.)
            optional("VERCEL_PROJECT_PRODUCTION_URL") ?? "https://map.creativewaco.org"
          : // Vercel provides VERCEL_URL as "<project>.vercel.app" (no scheme)
            optional("VERCEL_URL") ??
            (process.env.NODE_ENV === "production"
              ? "https://map.creativewaco.org"
              : "http://localhost:3000")),
    ),
  SHEET_CSV_URL: () => optional("SHEET_CSV_URL") ?? "",
  NEXT_PUBLIC_MAPBOX_TOKEN: () => optional("NEXT_PUBLIC_MAPBOX_TOKEN") ?? "",
  NEXT_PUBLIC_MAPBOX_STYLE_URL: () =>
    process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL ?? "",
  /** If true, attempt to geocode address when lat/lng missing. */
  GEOCODE_MISSING_COORDS: () => {
    const raw = optional("GEOCODE_MISSING_COORDS");
    if (!raw) return false;
    return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
  },
  /** 0 = fetch CSV on every request (no Next.js fetch cache). */
  REVALIDATE_SECONDS: () => {
    const raw = process.env.REVALIDATE_SECONDS;
    if (!raw) return 300;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 300;
    if (parsed === 0) return 0;
    return parsed > 0 ? parsed : 300;
  },
  EMBED_ALLOWED_ORIGINS: () =>
    (process.env.EMBED_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
};

