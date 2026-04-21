import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Papa from "papaparse";

function env(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === null || v === "") return fallback;
  return v;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function saveJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n");
}

function loadDotEnvFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith("\"") && val.endsWith("\"")) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // ignore
  }
}

function sha1Hex(input) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function parseDriveFileId(url) {
  const s = String(url || "").trim();
  if (!s) return null;
  const m1 = s.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m1) return m1[1];
  const m2 = s.match(/[?&]id=([^&]+)/i);
  if (m2) return m2[1];
  const m3 = s.match(/drive\.google\.com\/uc\?.*?[?&]id=([^&]+)/i);
  if (m3) return m3[1];
  return null;
}

async function cloudinaryUploadFile({
  cloudName,
  apiKey,
  apiSecret,
  folder,
  filePath,
  publicId,
}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signParams = {
    folder,
    public_id: publicId,
    timestamp,
    overwrite: "true",
  };
  const toSign = Object.entries(signParams)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const signature = sha1Hex(toSign + apiSecret);

  const form = new FormData();
  form.set("file", new Blob([fs.readFileSync(filePath)]));
  form.set("api_key", apiKey);
  form.set("timestamp", String(timestamp));
  form.set("signature", signature);
  form.set("folder", folder);
  form.set("public_id", publicId);
  form.set("overwrite", "true");

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(
    cloudName
  )}/image/upload`;
  const res = await fetch(endpoint, { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Cloudinary upload failed: ${msg}`);
  }
  return json;
}

function driveFileIdToWebpPath({ manifest, fileId, webDir }) {
  const m = manifest?.[fileId];
  if (!m?.outPath) return null;
  const base = path.basename(m.outPath, path.extname(m.outPath)); // includes --short
  return path.join(webDir, `${base}.webp`);
}

async function main() {
  loadDotEnvFile(path.resolve(".env.local"));

  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");
  const folder = env("CLOUDINARY_FOLDER", "public-art-map");

  const downloadManifestPath = path.resolve(
    env("DOWNLOAD_MANIFEST", "scripts/google/download-manifest.json")
  );
  const uploadManifestPath = path.resolve(
    env("UPLOAD_MANIFEST", "scripts/google/cloudinary-upload-manifest.json")
  );
  const webDir = path.resolve(env("WEB_DIR", "downloads/drive-photos-web"));
  const outCsvPath = path.resolve(env("OUT_CSV", "gdrive-cloudinary-image-urls.csv"));

  const downloadManifest = loadJsonIfExists(downloadManifestPath);
  if (!downloadManifest || Object.keys(downloadManifest).length === 0) {
    throw new Error(`Missing/empty download manifest at ${downloadManifestPath}`);
  }
  if (!fs.existsSync(webDir)) {
    throw new Error(`Missing WEB_DIR: ${webDir}. Run pnpm images:web-ready first.`);
  }

  const uploadManifest = loadJsonIfExists(uploadManifestPath) || {};
  const results = [];
  const fileIds = Object.keys(downloadManifest);

  let done = 0;
  for (const fileId of fileIds) {
    const entry = downloadManifest[fileId];
    const title = String(entry?.title || "").trim();
    const sourceUrl = String(entry?.source || "").trim();
    const parsed = parseDriveFileId(sourceUrl);

    const rowOut = {
      title,
      drive_file_id: fileId,
      source_url: sourceUrl,
      local_webp_path: "",
      cloudinary_secure_url: "",
      cloudinary_public_id: "",
      status: "pending",
      error: "",
    };

    try {
      if (!parsed || parsed !== fileId) {
        // still continue; fileId is authoritative
      }

      const webpPath = driveFileIdToWebpPath({ manifest: downloadManifest, fileId, webDir });
      if (!webpPath || !fs.existsSync(webpPath)) {
        throw new Error(`Missing webp for fileId ${fileId}: ${webpPath || "(null)"}`);
      }
      rowOut.local_webp_path = webpPath;

      const existing = uploadManifest[fileId];
      if (existing?.secure_url) {
        rowOut.cloudinary_secure_url = existing.secure_url;
        rowOut.cloudinary_public_id = existing.public_id || `${folder}/${fileId}`;
        rowOut.status = "skipped";
      } else {
        const publicId = `${folder}/${fileId}`;
        const uploaded = await cloudinaryUploadFile({
          cloudName,
          apiKey,
          apiSecret,
          folder,
          filePath: webpPath,
          publicId,
        });
        const secureUrl = uploaded.secure_url || "";
        uploadManifest[fileId] = {
          fileId,
          public_id: uploaded.public_id || publicId,
          secure_url: secureUrl,
          bytes: uploaded.bytes || null,
          format: uploaded.format || null,
          version: uploaded.version || null,
          uploadedAt: new Date().toISOString(),
        };
        rowOut.cloudinary_secure_url = secureUrl;
        rowOut.cloudinary_public_id = uploadManifest[fileId].public_id;
        rowOut.status = "ok";
      }
    } catch (e) {
      rowOut.status = "error";
      rowOut.error = e?.message ? String(e.message) : String(e);
    }

    results.push(rowOut);
    done++;
    console.log(`[${done}/${fileIds.length}] ${rowOut.status} ${title || fileId}`);
  }

  saveJson(uploadManifestPath, uploadManifest);

  const csv = Papa.unparse(results, { quotes: true });
  fs.writeFileSync(outCsvPath, csv + "\n");
  console.log(`\nWrote ${results.length} rows to ${outCsvPath}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});

