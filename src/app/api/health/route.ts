import { env } from "@/lib/env";

const AIRTABLE_REQUIRED_FIELDS = ["slug", "title", "lat", "lng"] as const;
const AIRTABLE_RECOMMENDED_FIELDS = [
  "description",
  "image",
  "address",
  "category",
  "artist",
  "year",
  "commission",
  "collection",
] as const;
const AIRTABLE_OPTIONAL_FIELDS = ["externalUrl", "image_id"] as const;

const AIRTABLE_READ_ALIASES: Record<string, string[]> = {
  slug: ["slug"],
  title: ["title", "name"],
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "longitude", "long"],
  description: ["description", "details", "about"],
  image: ["image", "image_url", "photo", "photo_url"],
  address: ["address", "location", "street_address"],
  category: ["category", "type"],
  artist: ["artist"],
  year: ["year"],
  commission: ["commission", "commissioned_by", "commission_by", "commissionedby"],
  collection: ["collection"],
  externalUrl: ["externalurl", "external_url", "url", "link", "website"],
  image_id: ["image_id", "imageid"],
};

type AirtableHealth = {
  enabled: boolean;
  configured: boolean;
  baseId?: string;
  table?: string;
  view?: string;
  checked?: boolean;
  sampledRecords?: number;
  presentFields?: string[];
  missingRequiredFields?: string[];
  missingRecommendedFields?: string[];
  missingOptionalFields?: string[];
  extraFields?: string[];
  missingRequiredReadAliases?: string[];
  missingRecommendedReadAliases?: string[];
  readyForProduction?: boolean;
  error?: string;
};

function normalizeFieldName(field: string): string {
  return field.trim().toLowerCase().replace(/\s+/g, "_");
}

async function getAirtableHealth(): Promise<AirtableHealth> {
  const provider = env.DATA_PROVIDER();
  const token = env.AIRTABLE_API_TOKEN().trim();
  const baseId = env.AIRTABLE_BASE_ID().trim();
  const table = env.AIRTABLE_TABLE().trim();
  const view = env.AIRTABLE_VIEW().trim();
  const configured = Boolean(token && baseId && table);

  const base: AirtableHealth = {
    enabled: provider === "airtable",
    configured,
    ...(baseId ? { baseId } : {}),
    ...(table ? { table } : {}),
    ...(view ? { view } : {}),
  };

  if (provider !== "airtable" || !configured) return base;

  try {
    const url = new URL(
      `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`,
    );
    url.searchParams.set("pageSize", "100");
    if (view) url.searchParams.set("view", view);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { type?: string; message?: string } }
        | null;
      const type = body?.error?.type?.trim();
      const message = body?.error?.message?.trim();
      const details = [type, message].filter(Boolean).join(": ");
      return {
        ...base,
        checked: true,
        error: details
          ? `Airtable API ${res.status} - ${details}`
          : `Airtable API ${res.status}`,
      };
    }

    const json = (await res.json()) as { records?: Array<{ fields?: Record<string, unknown> }> };
    const fieldSet = new Set<string>();
    for (const record of json.records ?? []) {
      for (const field of Object.keys(record.fields ?? {})) {
        fieldSet.add(field);
      }
    }
    const fields = Array.from(fieldSet).sort((a, b) => a.localeCompare(b));
    const normalizedPresent = new Set(fields.map(normalizeFieldName));
    const allKnown = [
      ...AIRTABLE_REQUIRED_FIELDS,
      ...AIRTABLE_RECOMMENDED_FIELDS,
      ...AIRTABLE_OPTIONAL_FIELDS,
    ];
    const knownSet = new Set(allKnown);
    const missingRequiredFields = AIRTABLE_REQUIRED_FIELDS.filter((f) => !fields.includes(f));
    const missingRecommendedFields = AIRTABLE_RECOMMENDED_FIELDS.filter((f) => !fields.includes(f));
    const missingOptionalFields = AIRTABLE_OPTIONAL_FIELDS.filter((f) => !fields.includes(f));
    const extraFields = fields.filter((f) => !knownSet.has(f as (typeof allKnown)[number]));
    const missingRequiredReadAliases = AIRTABLE_REQUIRED_FIELDS.filter((canonical) => {
      const aliases = AIRTABLE_READ_ALIASES[canonical] ?? [canonical];
      return !aliases.some((a) => normalizedPresent.has(a));
    });
    const missingRecommendedReadAliases = AIRTABLE_RECOMMENDED_FIELDS.filter((canonical) => {
      const aliases = AIRTABLE_READ_ALIASES[canonical] ?? [canonical];
      return !aliases.some((a) => normalizedPresent.has(a));
    });

    return {
      ...base,
      checked: true,
      sampledRecords: json.records?.length ?? 0,
      presentFields: fields,
      missingRequiredFields,
      missingRecommendedFields,
      missingOptionalFields,
      extraFields,
      missingRequiredReadAliases,
      missingRecommendedReadAliases,
      readyForProduction: missingRequiredReadAliases.length === 0,
    };
  } catch (e) {
    return {
      ...base,
      checked: true,
      error: e instanceof Error ? e.message : "Unknown Airtable health error",
    };
  }
}

export async function GET() {
  const provider = env.DATA_PROVIDER();
  const airtable = await getAirtableHealth();
  return Response.json({
    ok: true,
    service: "public-art-map",
    timestamp: new Date().toISOString(),
    dataProvider: provider,
    revalidateSeconds: env.REVALIDATE_SECONDS(),
    airtable,
  });
}

