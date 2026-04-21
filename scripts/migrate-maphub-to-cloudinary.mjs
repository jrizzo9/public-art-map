import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function sha1Hex(input) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function cloudinarySignature(params, apiSecret) {
  // Cloudinary signature: sort params alphabetically, join as key=value&, append api_secret, sha1.
  const keys = Object.keys(params)
    .filter((k) => params[k] != null && params[k] !== "")
    .sort();
  const toSign = keys.map((k) => `${k}=${params[k]}`).join("&") + apiSecret;
  return sha1Hex(toSign);
}

async function uploadToCloudinary({
  cloudName,
  apiKey,
  apiSecret,
  fileUrl,
  folder,
  publicId,
}) {
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const timestamp = Math.floor(Date.now() / 1000);

  const signedParams = {
    folder,
    public_id: publicId,
    overwrite: "true",
    timestamp: String(timestamp),
  };

  const signature = cloudinarySignature(signedParams, apiSecret);

  const form = new FormData();
  form.set("file", fileUrl); // Cloudinary can fetch remote URLs directly
  form.set("api_key", apiKey);
  form.set("timestamp", String(timestamp));
  form.set("signature", signature);
  form.set("overwrite", "true");
  if (folder) form.set("folder", folder);
  if (publicId) form.set("public_id", publicId);

  const res = await fetch(endpoint, { method: "POST", body: form });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      json?.error?.message ??
      `Upload failed (${res.status}) for ${publicId || fileUrl}`;
    throw new Error(msg);
  }
  return json; // contains secure_url, public_id, etc.
}

async function withConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(
    "Usage: CLOUDINARY_* env vars required\n" +
      "node scripts/migrate-maphub-to-cloudinary.mjs <path/to/maphub-image-urls.csv>",
  );
  process.exit(1);
}

const cloudName = requiredEnv("CLOUDINARY_CLOUD_NAME");
const apiKey = requiredEnv("CLOUDINARY_API_KEY");
const apiSecret = requiredEnv("CLOUDINARY_API_SECRET");
const folder = process.env.CLOUDINARY_FOLDER || "public-art-map";

const csvRaw = fs.readFileSync(inputPath, "utf8");
const parsed = Papa.parse(csvRaw, { header: true, skipEmptyLines: true });
if (parsed.errors?.length) {
  throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
}

const rows = parsed.data
  .map((r) => ({
    title: r.title ?? "",
    image_id: r.image_id ?? "",
    image_url: r.image_url ?? "",
  }))
  .filter((r) => r.image_id && r.image_url);

const tasks = rows.map((r) => ({
  ...r,
  public_id: r.image_id,
}));

const concurrency = Number(process.env.CLOUDINARY_CONCURRENCY || "3");

console.log(
  `Uploading ${tasks.length} images to Cloudinary (folder=${folder}, concurrency=${concurrency})...`,
);

const uploaded = await withConcurrency(tasks, concurrency, async (t, i) => {
  try {
    const result = await uploadToCloudinary({
      cloudName,
      apiKey,
      apiSecret,
      fileUrl: t.image_url,
      folder,
      publicId: t.public_id,
    });
    return {
      ...t,
      cloudinary_public_id: result.public_id ?? "",
      cloudinary_secure_url: result.secure_url ?? "",
      status: "ok",
      error: "",
    };
  } catch (err) {
    return {
      ...t,
      cloudinary_public_id: "",
      cloudinary_secure_url: "",
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if ((i + 1) % 10 === 0) console.log(`Progress: ${i + 1}/${tasks.length}`);
  }
});

const outLines = [
  [
    "title",
    "image_id",
    "source_url",
    "cloudinary_secure_url",
    "cloudinary_public_id",
    "status",
    "error",
  ]
    .map(csvEscape)
    .join(","),
  ...uploaded.map((r) =>
    [
      r.title,
      r.image_id,
      r.image_url,
      r.cloudinary_secure_url,
      r.cloudinary_public_id,
      r.status,
      r.error,
    ]
      .map(csvEscape)
      .join(","),
  ),
];

const outPath = path.resolve(process.cwd(), "cloudinary-image-urls.csv");
fs.writeFileSync(outPath, outLines.join("\n") + "\n");

const okCount = uploaded.filter((r) => r.status === "ok").length;
const errCount = uploaded.length - okCount;
console.log(`Wrote ${uploaded.length} rows to ${outPath}`);
console.log(`Uploaded ok: ${okCount}, errors: ${errCount}`);
