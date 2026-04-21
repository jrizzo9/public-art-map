/** Same normalization as sheet row keys: trim, lower, spaces → underscores */
export function normalizeSheetHeader(h: string): string {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** Canonical PATCH keys → acceptable header aliases (after normalization). Mirrors `coerceRowToArtworkShape` pick lists. */
export const PATCH_FIELD_ALIASES: Record<string, string[]> = {
  slug: ["slug"],
  title: ["title", "name"],
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "longitude", "long"],
  description: ["description", "details", "about"],
  image: ["image", "image_url", "photo", "photo_url"],
  image_id: ["image_id", "imageid"],
  address: ["address", "location", "street_address"],
  category: ["category", "type"],
  externalUrl: ["external_url", "url", "link", "website"],
  year: ["year"],
  artist: ["artist"],
  commission: ["commission", "commissioned_by", "commission_by", "commissionedby"],
  collection: ["collection"],
};

export type PatchFieldKey = keyof typeof PATCH_FIELD_ALIASES;

export function resolveColumnIndex(
  headers: string[],
  patchKey: string,
): number | null {
  const aliases = PATCH_FIELD_ALIASES[patchKey];
  if (!aliases) return null;
  const want = new Set(aliases.map((a) => normalizeSheetHeader(a)));
  for (let i = 0; i < headers.length; i++) {
    const nh = normalizeSheetHeader(headers[i] ?? "");
    if (want.has(nh)) return i;
  }
  return null;
}

/** Column index (0-based) → A1 column letters */
export function colIndexToA1(colIdx0: number): string {
  let n = colIdx0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function parseSheetNameFromRange(rangeA1: string): string {
  const bang = rangeA1.indexOf("!");
  if (bang === -1) return "";
  let name = rangeA1.slice(0, bang).trim();
  if (name.startsWith("'") && name.endsWith("'")) name = name.slice(1, -1);
  return name;
}
