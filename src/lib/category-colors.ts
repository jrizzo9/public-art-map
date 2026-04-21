/**
 * Stable, distinct marker colors per category label (for map dots + legend).
 * Same category string always maps to the same color.
 */

const PALETTE = [
  "#ffd02e",
  "#2e8bfd",
  "#3ecf8e",
  "#e94b7d",
  "#ff7a00",
  "#9b59b6",
  "#00c2c7",
  "#c94c4c",
  "#7cb342",
  "#5c6bc0",
  "#fbc02d",
  "#00897b",
] as const;

/** Fixed hues for sheet categories that used to hash to similar greens. */
const CATEGORY_COLOR_OVERRIDES: Record<string, string> = {
  "decommissioned art": "#78716c",
  decommissioned: "#78716c",
  murals: "#ffd02e",
  mural: "#ffd02e",
  other: "#2e8bfd",
  sculptures: "#c2410c",
  sculpture: "#c2410c",
  fountains: "#0369a1",
  fountain: "#0369a1",
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Normalize for hashing so case/spacing variants share one color. */
export function categoryColorKey(category: string | undefined): string {
  const t = category?.trim();
  return t ? t.toLowerCase() : "__uncategorized__";
}

export function markerColorForCategory(category: string | undefined): string {
  const key = categoryColorKey(category);
  const override = CATEGORY_COLOR_OVERRIDES[key];
  if (override) return override;
  const idx = hashString(key) % PALETTE.length;
  return PALETTE[idx]!;
}
