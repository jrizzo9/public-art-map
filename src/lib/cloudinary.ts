import crypto from "node:crypto";

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

function sha1Hex(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

/** Base folder for map assets (same default as migration scripts). */
export function cloudinaryBaseFolder(): string {
  return process.env.CLOUDINARY_FOLDER?.trim() || "public-art-map";
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

function signUploadParams(
  apiSecret: string,
  params: Record<string, string>,
): string {
  const toSign = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return sha1Hex(toSign + apiSecret);
}

export type ImageDirectUploadSlot = {
  uploadUrl: string;
  fields: Record<string, string>;
  /** Expected Cloudinary `public_id` after upload (folder + asset name). */
  expectedPublicId: string;
};

/**
 * Signed fields for browser-direct POST to Cloudinary `image/upload` (avoids large payloads on Vercel).
 */
export function createImageDirectUploadSlot({
  submissionFolder,
  photoBasename,
}: {
  submissionFolder: string;
  photoBasename: string;
}): ImageDirectUploadSlot {
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");

  const timestamp = Math.floor(Date.now() / 1000);
  // Do not include `resource_type` here: for `/image/upload` Cloudinary verifies
  // signatures without it (implicit type), and sending it breaks the signature match.
  const signParams: Record<string, string> = {
    folder: submissionFolder,
    timestamp: String(timestamp),
    overwrite: "true",
    public_id: photoBasename,
  };

  const signature = signUploadParams(apiSecret, signParams);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(
    cloudName,
  )}/image/upload`;

  const fields: Record<string, string> = {
    api_key: apiKey,
    timestamp: String(timestamp),
    signature,
    folder: submissionFolder,
    public_id: photoBasename,
    overwrite: "true",
  };

  const expectedPublicId = `${submissionFolder}/${photoBasename}`;

  return { uploadUrl, fields, expectedPublicId };
}

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

  const targetFolder = folder ?? cloudinaryBaseFolder();
  const timestamp = Math.floor(Date.now() / 1000);

  const signParams: Record<string, string> = {
    folder: targetFolder,
    timestamp: String(timestamp),
    overwrite: "true",
  };
  if (publicId) signParams.public_id = publicId;

  const signature = signUploadParams(apiSecret, signParams);

  const form = new FormData();
  form.set("file", file, filename ?? "upload.jpg");
  form.set("api_key", apiKey);
  form.set("timestamp", String(timestamp));
  form.set("signature", signature);
  form.set("folder", targetFolder);
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

