import { env } from "@/lib/env";
import { slugify } from "@/lib/sheet";

export type CollectionSeoFields = {
  name: string;
  description?: string;
};

const COLLECTIONS_TABLE_NAME = "Public Art Map Collections";

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.trim().toLowerCase().replace(/\s+/g, "_");
    out[key] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

function pickFirstString(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function fetchCollectionRows(): Promise<Record<string, unknown>[]> {
  const token = env.AIRTABLE_API_TOKEN().trim();
  const baseId = env.AIRTABLE_BASE_ID().trim();
  if (!token || !baseId) return [];

  const rows: Record<string, unknown>[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(
      `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(COLLECTIONS_TABLE_NAME)}`,
    );
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      next: { revalidate: env.REVALIDATE_SECONDS() || 300 },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      records?: Array<{ fields?: Record<string, unknown> }>;
      offset?: string;
    };
    for (const record of json.records ?? []) {
      if (record.fields && typeof record.fields === "object") {
        rows.push(record.fields);
      }
    }
    offset = json.offset;
  } while (offset);

  return rows;
}

export async function getCollectionSeoByName(
  collectionName: string,
): Promise<CollectionSeoFields | null> {
  const target = normalizeForCompare(collectionName);
  const targetSlug = slugify(collectionName);
  if (!target) return null;

  const rows = await fetchCollectionRows();
  for (const row of rows) {
    const normalized = normalizeRowKeys(row);
    const name = pickFirstString(normalized, [
      "name",
      "title",
      "collection",
      "collection_name",
      "collection_title",
    ]);
    if (!name) continue;
    const nameMatches = normalizeForCompare(name) === target;
    const derivedSlugMatches = !!targetSlug && slugify(name) === targetSlug;
    if (!nameMatches && !derivedSlugMatches) continue;

    const description = pickFirstString(normalized, [
      "description",
      "seo_description",
      "meta_description",
      "summary",
    ]);
    return {
      name,
      description,
    };
  }

  return null;
}

export async function getCollectionSeoMapByName(
  collectionNames: string[],
): Promise<Map<string, CollectionSeoFields>> {
  const rows = await fetchCollectionRows();
  if (!rows.length || !collectionNames.length) return new Map();

  const byNormalizedName = new Map<string, CollectionSeoFields>();
  for (const row of rows) {
    const normalized = normalizeRowKeys(row);
    const name = pickFirstString(normalized, [
      "name",
      "title",
      "collection",
      "collection_name",
      "collection_title",
    ]);
    if (!name) continue;
    const description = pickFirstString(normalized, [
      "description",
      "seo_description",
      "meta_description",
      "summary",
    ]);
    byNormalizedName.set(normalizeForCompare(name), { name, description });
  }

  const out = new Map<string, CollectionSeoFields>();
  for (const sourceName of collectionNames) {
    const key = normalizeForCompare(sourceName);
    const direct = byNormalizedName.get(key);
    if (direct) {
      out.set(sourceName, direct);
      continue;
    }
    const sourceSlug = slugify(sourceName);
    const fuzzy = [...byNormalizedName.values()].find((entry) => slugify(entry.name) === sourceSlug);
    if (fuzzy) out.set(sourceName, fuzzy);
  }
  return out;
}
