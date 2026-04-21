function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

export type CloudinaryResource = {
  asset_id?: string;
  public_id: string;
  format?: string;
  version?: number;
  resource_type?: string;
  type?: string;
  created_at?: string;
  bytes?: number;
  width?: number;
  height?: number;
  secure_url?: string;
};

export type CloudinaryListResult = {
  resources: CloudinaryResource[];
  next_cursor?: string;
};

export async function listCloudinaryImages({
  maxResults,
  nextCursor,
  prefix,
}: {
  maxResults?: number;
  nextCursor?: string;
  prefix?: string;
}): Promise<CloudinaryListResult> {
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");

  return listCloudinaryResources({
    cloudName,
    apiKey,
    apiSecret,
    resourceType: "image",
    maxResults,
    nextCursor,
    prefix,
  });
}

export async function listCloudinaryRaw({
  maxResults,
  nextCursor,
  prefix,
}: {
  maxResults?: number;
  nextCursor?: string;
  prefix?: string;
}): Promise<CloudinaryListResult> {
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");

  return listCloudinaryResources({
    cloudName,
    apiKey,
    apiSecret,
    resourceType: "raw",
    maxResults,
    nextCursor,
    prefix,
  });
}

export async function listCloudinaryResources({
  cloudName,
  apiKey,
  apiSecret,
  resourceType,
  maxResults,
  nextCursor,
  prefix,
}: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  resourceType: "image" | "raw";
  maxResults?: number;
  nextCursor?: string;
  prefix?: string;
}): Promise<CloudinaryListResult> {
  const url = new URL(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/${resourceType}`,
  );
  // Cloudinary Admin API requires `type` (usually "upload").
  url.searchParams.set("type", "upload");
  url.searchParams.set("max_results", String(Math.max(1, Math.min(100, maxResults ?? 30))));
  if (nextCursor) url.searchParams.set("next_cursor", nextCursor);
  if (prefix) url.searchParams.set("prefix", prefix);

  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const res = await fetch(url.toString(), {
    headers: { authorization: `Basic ${basic}` },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const msg =
      typeof json === "object" &&
      json !== null &&
      "error" in json &&
      typeof (json as { error?: unknown }).error === "object" &&
      (json as { error?: { message?: unknown } }).error !== null &&
      typeof (json as { error?: { message?: unknown } }).error?.message === "string"
        ? (json as { error: { message: string } }).error.message
        : `HTTP ${res.status}`;
    throw new Error(`Cloudinary list failed: ${msg}`);
  }

  return {
    resources:
      typeof json === "object" &&
      json !== null &&
      "resources" in json &&
      Array.isArray((json as { resources?: unknown }).resources)
        ? ((json as { resources: CloudinaryResource[] }).resources ?? [])
        : [],
    next_cursor:
      typeof json === "object" &&
      json !== null &&
      "next_cursor" in json &&
      typeof (json as { next_cursor?: unknown }).next_cursor === "string"
        ? (json as { next_cursor: string }).next_cursor
        : undefined,
  };
}
