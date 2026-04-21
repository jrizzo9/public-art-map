import crypto from "node:crypto";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

function sha1Hex(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

export type CloudinaryUploadResult = {
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  resource_type?: string;
};

export async function uploadToCloudinary({
  file,
  filename,
  folder,
  publicId,
}: {
  file: Blob;
  filename?: string;
  folder?: string;
  publicId?: string;
}): Promise<CloudinaryUploadResult> {
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");

  const targetFolder = folder ?? process.env.CLOUDINARY_FOLDER ?? "public-art-map";
  const timestamp = Math.floor(Date.now() / 1000);

  const signParams: Record<string, string> = {
    folder: targetFolder,
    timestamp: String(timestamp),
    resource_type: "image",
    overwrite: "true",
  };
  if (publicId) signParams.public_id = publicId;

  const toSign = Object.entries(signParams)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const signature = sha1Hex(toSign + apiSecret);

  const form = new FormData();
  // Cloudinary ignores filename for the asset URL, but it's helpful in logs.
  form.set("file", file, filename ?? "upload.jpg");
  form.set("api_key", apiKey);
  form.set("timestamp", String(timestamp));
  form.set("signature", signature);
  form.set("folder", targetFolder);
  form.set("resource_type", "image");
  form.set("overwrite", "true");
  if (publicId) form.set("public_id", publicId);

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(
    cloudName,
  )}/image/upload`;

  const res = await fetch(endpoint, { method: "POST", body: form, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as CloudinaryUploadResult & {
    error?: { message?: string };
  };
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Cloudinary upload failed: ${msg}`);
  }
  return json;
}

