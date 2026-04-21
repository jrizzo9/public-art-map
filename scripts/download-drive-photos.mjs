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

function safeBaseName(input) {
  const raw = String(input || "").trim();
  const cleaned = raw
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "untitled";
}

function parseDriveFileId(url) {
  const s = String(url || "").trim();
  if (!s) return null;

  // https://drive.google.com/file/d/<id>/view?...  or open?id=<id>
  const m1 = s.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m1) return m1[1];

  const m2 = s.match(/[?&]id=([^&]+)/i);
  if (m2) return m2[1];

  // https://drive.google.com/uc?export=download&id=<id>
  const m3 = s.match(/drive\.google\.com\/uc\?.*?[?&]id=([^&]+)/i);
  if (m3) return m3[1];

  return null;
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

function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency) return;
    const item = queue.shift();
    if (!item) return;
    active++;
    Promise.resolve()
      .then(item.fn)
      .then(
        (v) => item.resolve(v),
        (e) => item.reject(e)
      )
      .finally(() => {
        active--;
        next();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

async function getAuthClient({ credentialsPath, tokenPath, scopes }) {
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
  const auth = await authenticate({
    keyfilePath: credentialsPath,
    scopes,
  });

  const creds = auth.credentials || {};
  if (!creds.refresh_token) {
    throw new Error(
      `OAuth completed but no refresh_token was returned. In Google Cloud Console, edit the OAuth Client and set it to "Desktop app", then re-run after deleting ${tokenPath}.`
    );
  }
  saveJson(tokenPath, creds);
  return auth;
}

async function readSheetRows({ sheets, spreadsheetId, rangeA1 }) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeA1,
    majorDimension: "ROWS",
  });
  const values = res.data.values || [];
  if (values.length === 0) return [];
  const headers = values[0].map((h) => String(h || "").trim());
  const rows = values.slice(1).map((row) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i] ?? "";
    return obj;
  });
  return rows;
}

async function downloadDriveFile({ drive, fileId, outPath }) {
  const meta = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,modifiedTime,size",
    supportsAllDrives: true,
  });

  ensureDir(path.dirname(outPath));
  const dest = fs.createWriteStream(outPath);

  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );

  await new Promise((resolve, reject) => {
    res.data
      .on("error", reject)
      .pipe(dest)
      .on("error", reject)
      .on("finish", resolve);
  });

  return meta.data;
}

async function main() {
  const spreadsheetId = requireEnv("SHEET_ID");
  const rangeA1 = env("SHEET_RANGE", "Sheet1!A:Z");
  const imageColumn = env("IMAGE_COLUMN", "Image URL");
  const titleColumn = env("TITLE_COLUMN", "Title");

  const outDir = path.resolve(env("OUT_DIR", "downloads/drive-photos"));
  const concurrency = Math.max(1, Math.min(10, Number(env("CONCURRENCY", "4")) || 4));

  const credentialsPath = path.resolve(
    env("GOOGLE_OAUTH_CREDENTIALS", "scripts/google/credentials.json")
  );
  const tokenPath = path.resolve(env("GOOGLE_OAUTH_TOKEN", "scripts/google/token.json"));
  const manifestPath = path.resolve(env("MANIFEST_PATH", "scripts/google/download-manifest.json"));

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Missing OAuth credentials at ${credentialsPath}\n\nCreate a Google Cloud "Desktop app" OAuth client and download the JSON as scripts/google/credentials.json.`
    );
  }

  const scopes = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ];
  const auth = await getAuthClient({ credentialsPath, tokenPath, scopes });

  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  const rows = await readSheetRows({ sheets, spreadsheetId, rangeA1 });
  const withDrive = rows
    .map((r, idx) => ({ r, idx }))
    .map(({ r, idx }) => {
      const imageUrl = String(r?.[imageColumn] || "").trim();
      const fileId = parseDriveFileId(imageUrl);
      return { idx, row: r, imageUrl, fileId };
    })
    .filter((x) => x.fileId);

  if (withDrive.length === 0) {
    console.log(
      `No Drive links found. Checked column "${imageColumn}" in range "${rangeA1}".`
    );
    return;
  }

  ensureDir(outDir);
  const manifest = loadJsonIfExists(manifestPath) || {};

  const limit = pLimit(concurrency);
  let done = 0;
  const results = await Promise.all(
    withDrive.map((item) =>
      limit(async () => {
        const title = String(item.row?.[titleColumn] || "").trim();
        const base = safeBaseName(title);
        const short = item.fileId.slice(0, 10);
        const name = `${base}--${short}`;

        const existing = manifest[item.fileId];
        if (existing?.outPath && fs.existsSync(existing.outPath)) {
          done++;
          if (done % 10 === 0 || done === withDrive.length) {
            console.log(`[${done}/${withDrive.length}] skip ${title || item.fileId}`);
          }
          return { status: "skipped", fileId: item.fileId, outPath: existing.outPath };
        }

        const tmpOut = path.join(outDir, `${name}.bin`);
        const meta = await downloadDriveFile({ drive, fileId: item.fileId, outPath: tmpOut });

        const mime = String(meta?.mimeType || "").toLowerCase();
        const ext =
          mime.includes("jpeg") ? "jpg"
          : mime.includes("png") ? "png"
          : mime.includes("webp") ? "webp"
          : mime.includes("heic") || mime.includes("heif") ? "heic"
          : mime.includes("gif") ? "gif"
          : "bin";

        const finalOut = path.join(outDir, `${name}.${ext}`);
        if (finalOut !== tmpOut) fs.renameSync(tmpOut, finalOut);

        manifest[item.fileId] = {
          fileId: item.fileId,
          title,
          source: item.imageUrl,
          outPath: finalOut,
          driveName: meta?.name || "",
          mimeType: meta?.mimeType || "",
          modifiedTime: meta?.modifiedTime || "",
          size: meta?.size || "",
          downloadedAt: new Date().toISOString(),
        };

        done++;
        console.log(`[${done}/${withDrive.length}] ok ${title || item.fileId}`);
        return { status: "ok", fileId: item.fileId, outPath: finalOut };
      })
    )
  );

  saveJson(manifestPath, manifest);

  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  console.log(`\nDone. Downloaded: ${ok}. Skipped: ${skipped}. Output: ${outDir}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Token: ${tokenPath}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});

