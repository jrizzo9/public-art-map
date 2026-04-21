import type { Artwork } from "@/types/artwork";
import { parseCsv } from "@/lib/csv";
import { getRevalidateSeconds, getSheetCsvUrl } from "@/lib/env";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function rowToArtwork(row: Record<string, string>): Artwork | null {
  const slugRaw = pick(row, ["slug", "url_slug", "id"]);
  const title = pick(row, ["title", "name", "artwork_title"]);
  const latRaw = pick(row, ["lat", "latitude"]);
  const lngRaw = pick(row, ["lng", "lon", "long", "longitude"]);

  if (!slugRaw || !title || latRaw === undefined || lngRaw === undefined) {
    return null;
  }

  const slug = slugRaw.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return null;

  const lat = Number.parseFloat(latRaw);
  const lng = Number.parseFloat(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const description = pick(row, ["description", "desc", "details"]) ?? null;
  const image = pick(row, ["image", "image_url", "photo", "picture"]) ?? null;
  const address = pick(row, ["address", "location"]) ?? null;
  const category = pick(row, ["category", "type", "medium"]) ?? null;

  return {
    slug,
    title: title.trim(),
    lat,
    lng,
    description: description?.trim() ? description.trim() : null,
    image: image?.trim() ? image.trim() : null,
    address: address?.trim() ? address.trim() : null,
    category: category?.trim() ? category.trim() : null,
  };
}

function sheetTextToArtworks(text: string): Artwork[] {
  const rows = parseCsv(text.trim());
  if (rows.length < 2) return [];

  const headers = rows[0]!.map(normalizeHeader);
  const out: Artwork[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!;
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i]?.trim() ?? "";
    });
    const artwork = rowToArtwork(obj);
    if (artwork) out.push(artwork);
  }

  const seen = new Set<string>();
  const unique: Artwork[] = [];
  for (const a of out) {
    if (seen.has(a.slug)) continue;
    seen.add(a.slug);
    unique.push(a);
  }
  return unique.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getArtworks(): Promise<Artwork[]> {
  const url = getSheetCsvUrl();
  if (!url) {
    return [];
  }

  const res = await fetch(url, {
    next: { revalidate: getRevalidateSeconds(), tags: ["sheet"] },
  });

  if (!res.ok) {
    throw new Error(`Sheet CSV fetch failed (${res.status})`);
  }

  const text = await res.text();
  return sheetTextToArtworks(text);
}

export async function getArtworkBySlug(slug: string): Promise<Artwork | undefined> {
  const normalized = slug.trim().toLowerCase();
  if (!SLUG_RE.test(normalized)) return undefined;

  const all = await getArtworks();
  return all.find((a) => a.slug === normalized);
}

export async function getAllSlugs(): Promise<string[]> {
  const all = await getArtworks();
  return all.map((a) => a.slug);
}
