function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value : undefined;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  NEXT_PUBLIC_SITE_URL: () =>
    optional("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
  SHEET_CSV_URL: () => optional("SHEET_CSV_URL") ?? "",
  NEXT_PUBLIC_MAPBOX_TOKEN: () => optional("NEXT_PUBLIC_MAPBOX_TOKEN") ?? "",
  NEXT_PUBLIC_MAPBOX_STYLE_URL: () =>
    process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL ?? "",
  REVALIDATE_SECONDS: () => {
    const raw = process.env.REVALIDATE_SECONDS;
    if (!raw) return 300;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
  },
  EMBED_ALLOWED_ORIGINS: () =>
    (process.env.EMBED_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
};

