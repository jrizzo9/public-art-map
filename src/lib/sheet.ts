import { z } from "zod";
import Papa from "papaparse";
import { env } from "./env";

export type Artwork = {
  slug: string;
  title: string;
  lat: number;
  lng: number;
  description?: string;
  image?: string;
  address?: string;
  category?: string;
  /** Link from the sheet `URL` column (external page). */
  externalUrl?: string;
  year?: number;
  artist?: string;
  /** From sheet column `Commissioned By`. */
  commission?: string;
  /** From sheet column `Collection`. */
  collection?: string;
};

type LatLng = { lat: number; lng: number };

const rawArtworkSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  description: z.string().optional(),
  image: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  address: z.string().optional(),
  category: z.string().optional(),
  externalUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  year: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().int().optional(),
  ),
  artist: z.string().optional(),
  commission: z.string().optional(),
  collection: z.string().optional(),
});

const geocodeCache = new Map<string, LatLng | null>();

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.trim().toLowerCase().replace(/\s+/g, "_");
    out[key] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

function pickFirst(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const v = row[key];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    return v;
  }
  return undefined;
}

/** Prefer a direct image URL column; otherwise build from `image_id` + optional public template. */
function resolveImageField(row: Record<string, unknown>): unknown {
  const direct = pickFirst(row, ["image", "image_url", "photo", "photo_url"]);
  if (typeof direct === "string" && direct.trim()) {
    const t = direct.trim();
    if (t.startsWith("http://") || t.startsWith("https://")) return t;
  }

  const imageId = pickFirst(row, ["image_id", "imageid"]);
  const template = process.env.NEXT_PUBLIC_ARTWORK_IMAGE_URL_TEMPLATE?.trim();
  if (typeof imageId === "string" && imageId.trim() && template) {
    const id = encodeURIComponent(imageId.trim());
    return template.replace(/\{id\}/g, id);
  }
  return undefined;
}

function coerceRowToArtworkShape(row: Record<string, unknown>): Record<string, unknown> {
  return {
    // IMPORTANT: do not use `id` as slug. Prefer explicit `slug` column; otherwise derive from title.
    slug: pickFirst(row, ["slug"]),
    title: pickFirst(row, ["title", "name"]),
    lat: pickFirst(row, ["lat", "latitude"]),
    lng: pickFirst(row, ["lng", "lon", "longitude", "long"]),
    description: pickFirst(row, ["description", "details", "about"]),
    image: resolveImageField(row),
    address: pickFirst(row, ["address", "location", "street_address"]),
    category: pickFirst(row, ["category", "type"]),
    externalUrl: pickFirst(row, ["external_url", "url", "link", "website"]),
    year: pickFirst(row, ["year"]),
    artist: pickFirst(row, ["artist"]),
    commission: pickFirst(row, [
      "commission",
      "commissioned_by",
      "commission_by",
      "commissionedby",
    ]),
    collection: pickFirst(row, ["collection"]),
  };
}

function normalizeGeocodeQuery(address: string): string {
  // Keep it simple & stable for caching. Add locality to improve match quality.
  const cleaned = address.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned.toLowerCase().includes("waco") ? cleaned : `${cleaned}, Waco, TX`;
}

async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!env.GEOCODE_MISSING_COORDS()) return null;
  const token = env.NEXT_PUBLIC_MAPBOX_TOKEN();
  if (!token) return null;

  const query = normalizeGeocodeQuery(address);
  if (!query) return null;

  const cached = geocodeCache.get(query);
  if (cached !== undefined) return cached;

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "address,poi,place,locality");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      geocodeCache.set(query, null);
      return null;
    }
    const json = (await res.json()) as {
      features?: Array<{ center?: [number, number] }>;
    };
    const center = json.features?.[0]?.center;
    if (!center || center.length !== 2) {
      geocodeCache.set(query, null);
      return null;
    }
    const [lng, lat] = center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      geocodeCache.set(query, null);
      return null;
    }
    const ll = { lat, lng };
    geocodeCache.set(query, ll);
    return ll;
  } catch {
    geocodeCache.set(query, null);
    return null;
  }
}

async function fetchCsvText(): Promise<string> {
  const url = env.SHEET_CSV_URL();
  if (!url) return "";
  const seconds = env.REVALIDATE_SECONDS();
  const res = await fetch(
    url,
    seconds === 0
      ? { cache: "no-store" }
      : { next: { revalidate: seconds } },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch SHEET_CSV_URL (${res.status})`);
  }
  return await res.text();
}

export async function getArtworks(): Promise<Artwork[]> {
  const csvText = await fetchCsvText();
  if (!csvText) return [];
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const results: Artwork[] = [];
  const usedSlugs = new Set<string>();
  for (const row of parsed.data) {
    const normalized = normalizeRowKeys(row);
    const coerced = coerceRowToArtworkShape(normalized);

     // If lat/lng are missing but we have an address, optionally geocode.
     const maybeLat = coerced.lat;
     const maybeLng = coerced.lng;
     const missingCoords =
       maybeLat === undefined ||
       maybeLat === null ||
       (typeof maybeLat === "string" && !maybeLat.trim()) ||
       maybeLng === undefined ||
       maybeLng === null ||
       (typeof maybeLng === "string" && !maybeLng.trim());

     if (missingCoords) {
       const address = coerced.address;
       if (typeof address === "string" && address.trim()) {
         const ll = await geocodeAddress(address);
         if (ll) {
           coerced.lat = ll.lat;
           coerced.lng = ll.lng;
         }
       }
     }

     // If id/slug is missing, derive from title (best effort).
     const rawSlug = coerced.slug;
     const hasSlug =
       typeof rawSlug === "string" ? Boolean(rawSlug.trim()) : rawSlug !== undefined;
     if (!hasSlug) {
       const title = coerced.title;
       if (typeof title === "string" && title.trim()) {
         const base = slugify(title) || "artwork";
         let candidate = base;
         let i = 2;
         while (usedSlugs.has(candidate)) {
           candidate = `${base}-${i++}`;
         }
         coerced.slug = candidate;
       }
     }

    const maybe = rawArtworkSchema.safeParse(coerced);
    if (!maybe.success) continue;
     usedSlugs.add(maybe.data.slug);
    results.push(maybe.data);
  }

  results.sort((a, b) => a.title.localeCompare(b.title));
  return results;
}

export async function getArtworkBySlug(slug: string): Promise<Artwork | null> {
  const artworks = await getArtworks();
  return artworks.find((a) => a.slug === slug) ?? null;
}

