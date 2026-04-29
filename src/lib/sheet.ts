import { z } from "zod";
import Papa from "papaparse";
import { env } from "./env";

export type Artwork = {
  slug: string;
  title: string;
  lat: number;
  lng: number;
  description?: string;
  /** Back-compat: first image URL (if any). Prefer `images` for UI. */
  image?: string;
  /** One or more image URLs (supports comma/newline separated values in the sheet). */
  images?: string[];
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

type Provider = "sheet" | "airtable";
type FetchOptions =
  | { cache: "no-store" }
  | { next: { revalidate: number } };
const AIRTABLE_COLLECTIONS_TABLE = "Public Art Map Collections";

const rawArtworkSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  description: z.string().optional(),
  // Accept either a single URL or multiple URLs separated by commas/newlines.
  // We validate/sanitize into `images` after parsing.
  image: z.string().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
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

/** URL-safe slug (artwork slugs, collection routes, etc.). */
export function slugify(input: string): string {
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
    if (typeof v === "string") {
      out[key] = v.trim();
      continue;
    }
    // Airtable attachments are arrays of objects with `url`; store as comma list.
    if (Array.isArray(v)) {
      const urls = v
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object" && "url" in item) {
            const maybe = (item as { url?: unknown }).url;
            return typeof maybe === "string" ? maybe.trim() : "";
          }
          return "";
        })
        .filter(Boolean);
      out[key] = urls.length ? urls.join(", ") : v;
      continue;
    }
    out[key] = v;
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
    return direct.trim();
  }

  const imageId = pickFirst(row, ["image_id", "imageid"]);
  const template = process.env.NEXT_PUBLIC_ARTWORK_IMAGE_URL_TEMPLATE?.trim();
  if (typeof imageId === "string" && imageId.trim() && template) {
    const id = encodeURIComponent(imageId.trim());
    return template.replace(/\{id\}/g, id);
  }
  return undefined;
}

function parseImageUrls(raw: string | undefined): string[] {
  if (!raw) return [];
  const parts = raw
    .split(/[\n,|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    if (!/^https?:\/\//i.test(p)) continue;
    try {
      const u = new URL(p);
      const href = u.toString();
      if (seen.has(href)) continue;
      seen.add(href);
      out.push(href);
    } catch {
      // ignore invalid segments
    }
  }
  return out;
}

function coerceRowToArtworkShape(row: Record<string, unknown>): Record<string, unknown> {
  const rawCollection = pickFirst(row, ["collection"]);
  const collection =
    typeof rawCollection === "string"
      ? rawCollection
      : Array.isArray(rawCollection)
        ? rawCollection
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean)
            .join(", ")
        : undefined;

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
    collection,
  };
}

async function fetchCsvText(): Promise<string> {
  const url = env.SHEET_CSV_URL();
  if (!url) return "";
  const requestOptions = getRequestOptions();
  const res = await fetch(
    url,
    requestOptions,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch SHEET_CSV_URL (${res.status})`);
  }
  return await res.text();
}

function getRequestOptions(): FetchOptions {
  const seconds = env.REVALIDATE_SECONDS();
  return seconds === 0 ? { cache: "no-store" } : { next: { revalidate: seconds } };
}

async function fetchAirtableRows(): Promise<Record<string, unknown>[]> {
  const token = env.AIRTABLE_API_TOKEN().trim();
  const baseId = env.AIRTABLE_BASE_ID().trim();
  const table = env.AIRTABLE_TABLE().trim();
  const view = env.AIRTABLE_VIEW().trim();
  if (!token || !baseId || !table) {
    throw new Error(
      "Airtable provider requires AIRTABLE_API_TOKEN, AIRTABLE_BASE_ID, and AIRTABLE_TABLE.",
    );
  }

  const records: Record<string, unknown>[] = [];
  let offset: string | undefined;
  const requestOptions = getRequestOptions();
  do {
    const url = new URL(
      `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`,
    );
    url.searchParams.set("pageSize", "100");
    if (view) url.searchParams.set("view", view);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      ...requestOptions,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { type?: string; message?: string } }
        | null;
      const apiType = body?.error?.type?.trim();
      const apiMessage = body?.error?.message?.trim();
      const details = [apiType, apiMessage].filter(Boolean).join(": ");
      throw new Error(
        details
          ? `Failed to fetch Airtable (${res.status}) - ${details}`
          : `Failed to fetch Airtable (${res.status})`,
      );
    }
    const json = (await res.json()) as {
      records?: Array<{ id?: string; fields?: Record<string, unknown> }>;
      offset?: string;
    };
    for (const r of json.records ?? []) {
      if (r.fields && typeof r.fields === "object") {
        records.push({
          __record_id: r.id,
          ...r.fields,
        });
      }
    }
    offset = json.offset;
  } while (offset);

  return records;
}

async function fetchAirtableCollectionNameByRecordId(): Promise<Map<string, string>> {
  const token = env.AIRTABLE_API_TOKEN().trim();
  const baseId = env.AIRTABLE_BASE_ID().trim();
  if (!token || !baseId) return new Map();

  const out = new Map<string, string>();
  let offset: string | undefined;
  const requestOptions = getRequestOptions();

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(AIRTABLE_COLLECTIONS_TABLE)}`,
    );
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      ...requestOptions,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return new Map();

    const json = (await res.json()) as {
      records?: Array<{ id?: string; fields?: Record<string, unknown> }>;
      offset?: string;
    };

    for (const record of json.records ?? []) {
      const id = record.id?.trim();
      if (!id) continue;
      const fields = record.fields ?? {};
      const normalized = normalizeRowKeys(fields);
      const name = pickFirst(normalized, ["name", "title", "collection", "collection_name"]);
      if (typeof name === "string" && name.trim()) {
        out.set(id, name.trim());
      }
    }

    offset = json.offset;
  } while (offset);

  return out;
}

function parseCsvRows(csvText: string): Record<string, unknown>[] {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  return parsed.data;
}

async function readSourceRows(provider: Provider): Promise<Record<string, unknown>[]> {
  if (provider === "airtable") {
    return await fetchAirtableRows();
  }
  const csvText = await fetchCsvText();
  if (!csvText) return [];
  return parseCsvRows(csvText);
}

export async function getArtworks(): Promise<Artwork[]> {
  const provider = env.DATA_PROVIDER();
  const rows = await readSourceRows(provider);
  const collectionNameByRecordId =
    provider === "airtable" ? await fetchAirtableCollectionNameByRecordId() : new Map<string, string>();

  const results: Artwork[] = [];
  const usedSlugs = new Set<string>();
  for (const row of rows) {
    const normalized = normalizeRowKeys(row);
    const coerced = coerceRowToArtworkShape(normalized);
    if (provider === "airtable" && typeof coerced.collection === "string") {
      const ids = coerced.collection
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (ids.length > 0 && ids.every((id) => /^rec[a-zA-Z0-9]{10,}$/.test(id))) {
        const names = ids
          .map((id) => collectionNameByRecordId.get(id))
          .filter((v): v is string => !!v);
        if (names.length) {
          coerced.collection = names.join(", ");
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
    const images = parseImageUrls(maybe.data.image);
    results.push({
      ...maybe.data,
      images: images.length ? images : undefined,
      image: images[0] ?? undefined,
    });
  }

  results.sort((a, b) => a.title.localeCompare(b.title));
  return results;
}

export async function getArtworkBySlug(slug: string): Promise<Artwork | null> {
  const artworks = await getArtworks();
  return artworks.find((a) => a.slug === slug) ?? null;
}

