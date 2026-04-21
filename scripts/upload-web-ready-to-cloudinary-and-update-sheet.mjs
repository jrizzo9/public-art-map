import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { google } from "googleapis";
import { authenticate } from "@google-cloud/local-auth";

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

function colToA1(colIdx0) {
  // 0 -> A
  let n = colIdx0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function normalizeHeader(h) {
  return String(h || "").trim();
}

function driveFileIdToWebpPath({ manifest, fileId, webDir }) {
  const m = manifest?.[fileId];
  if (!m?.outPath) return null;
  const base = path.basename(m.outPath, path.extname(m.outPath)); // includes --short
  return path.join(webDir, `${base}.webp`);
}

async function getSheetsAuth({ credentialsPath, tokenPath, scopes }) {
  const rawCreds = loadJsonIfExists(credentialsPath);
  const installed = rawCreds?.installed || rawCreds?.web;
  if (!installed?.client_id || !installed?.client_secret) {
    throw new Error(
      `Invalid OAuth credentials JSON at ${credentialsPath}. Expected an OAuth client JSON with "installed" (Desktop app) or "web" keys.`
    );
  }
  const redirectUri =
    Array.isArray(installed.redirect_uris) && installed.redirect_uris.length > 0
      ? installed.redirect_uris[0]
      : "http://localhost";

  const existing = loadJsonIfExists(tokenPath);
  if (existing) {
    const auth = new google.auth.OAuth2(
      installed.client_id,
      installed.client_secret,
      redirectUri
    );
    auth.setCredentials(existing);
    return auth;
  }

  ensureDir(path.dirname(tokenPath));
  const auth = await authenticate({ keyfilePath: credentialsPath, scopes });
  const creds = auth.credentials || {};
  if (!creds.refresh_token) {
    throw new Error(
      `OAuth completed but no refresh_token was returned. Re-run after deleting ${tokenPath}.`
    );
  }
  saveJson(tokenPath, creds);
  return auth;
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
    resource_type: "image",
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
  form.set("resource_type", "image");
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

async function main() {
  // Load local env defaults (keeps CLI usage simple)
  loadDotEnvFile(path.resolve(".env.local"));

  const spreadsheetId = requireEnv("SHEET_ID");
  const rangeA1 = env("SHEET_RANGE", "'Live Sheet'!A:Z");
  const imageColumn = env("IMAGE_COLUMN", "Image URL");

  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");
  const folder = env("CLOUDINARY_FOLDER", "public-art-map");

  const credentialsPath = path.resolve(
    env("GOOGLE_OAUTH_CREDENTIALS", "scripts/google/credentials.json")
  );
  const tokenPath = path.resolve(
    env("GOOGLE_OAUTH_SHEETS_TOKEN", "scripts/google/token-sheets.json")
  );

  const downloadManifestPath = path.resolve(
    env("DOWNLOAD_MANIFEST", "scripts/google/download-manifest.json")
  );
  const uploadManifestPath = path.resolve(
    env("UPLOAD_MANIFEST", "scripts/google/cloudinary-upload-manifest.json")
  );
  const webDir = path.resolve(env("WEB_DIR", "downloads/drive-photos-web"));

  const downloadManifest = loadJsonIfExists(downloadManifestPath) || {};
  const uploadManifest = loadJsonIfExists(uploadManifestPath) || {};

  if (!fs.existsSync(webDir)) {
    throw new Error(`Missing WEB_DIR: ${webDir}. Run pnpm images:web-ready first.`);
  }

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Missing OAuth credentials at ${credentialsPath}`);
  }

  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
  const auth = await getSheetsAuth({ credentialsPath, tokenPath, scopes });
  const sheets = google.sheets({ version: "v4", auth });

  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeA1,
    majorDimension: "ROWS",
  });
  const values = valuesRes.data.values || [];
  if (values.length === 0) throw new Error(`No values returned for range ${rangeA1}`);

  const headers = (values[0] || []).map(normalizeHeader);
  const imageColIdx = headers.findIndex((h) => h === imageColumn);
  if (imageColIdx === -1) {
    throw new Error(
      `Could not find column "${imageColumn}" in header row. Found: ${headers
        .filter(Boolean)
        .join(", ")}`
    );
  }

  const updates = [];
  let inspected = 0;
  let uploaded = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let r = 1; r < values.length; r++) {
    inspected++;
    const row = values[r] || [];
    const currentUrl = String(row[imageColIdx] || "").trim();

    // If already Cloudinary (or any non-Drive URL), skip.
    if (!/drive\.google\.com\//i.test(currentUrl)) {
      skipped++;
      continue;
    }

    const fileId = parseDriveFileId(currentUrl);
    if (!fileId) {
      errors++;
      continue;
    }

    let cloudinaryUrl = uploadManifest?.[fileId]?.secure_url;
    if (!cloudinaryUrl) {
      const webpPath = driveFileIdToWebpPath({ manifest: downloadManifest, fileId, webDir });
      if (!webpPath || !fs.existsSync(webpPath)) {
        errors++;
        continue;
      }

      const publicId = `${folder}/${fileId}`;
      const uploadedRes = await cloudinaryUploadFile({
        cloudName,
        apiKey,
        apiSecret,
        folder,
        filePath: webpPath,
        publicId,
      });
      cloudinaryUrl = uploadedRes.secure_url || "";
      uploadManifest[fileId] = {
        fileId,
        public_id: uploadedRes.public_id || publicId,
        secure_url: cloudinaryUrl,
        bytes: uploadedRes.bytes || null,
        format: uploadedRes.format || null,
        version: uploadedRes.version || null,
        uploadedAt: new Date().toISOString(),
      };
      uploaded++;
    }

    if (!cloudinaryUrl) {
      errors++;
      continue;
    }

    // Build exact A1 cell for this row.
    const rowNumber = r + 1; // header is row 1; r=1 is row 2
    const a1Cell = `${colToA1(imageColIdx)}${rowNumber}`;
    const sheetName = String(rangeA1.split("!")[0] || "").trim();
    const targetRange = `${sheetName}!${a1Cell}`;

    updates.push({ range: targetRange, values: [[cloudinaryUrl]] });
    updated++;

    // Progress line every few updates
    if ((uploaded + updated) % 5 === 0) {
      console.log(
        `progress rows=${inspected} uploaded=${uploaded} queuedUpdates=${updates.length} skipped=${skipped} errors=${errors}`
      );
    }
  }

  saveJson(uploadManifestPath, uploadManifest);

  if (updates.length === 0) {
    console.log(
      `Nothing to update. inspected=${inspected} uploaded=${uploaded} skipped=${skipped} errors=${errors}`
    );
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: updates,
    },
  });

  console.log(
    `\nDone. inspected=${inspected} uploaded=${uploaded} updatedCells=${updates.length} skipped=${skipped} errors=${errors}`
  );
  console.log(`Upload manifest: ${uploadManifestPath}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});

