import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import Papa from "papaparse";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function sha1Hex(input) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

function parseDriveFileId(url) {
  // https://drive.google.com/file/d/<id>/view?...  or open?id=<id>
  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([^&]+)/i);
  if (m2) return m2[1];
  return null;
}

function safeSlug(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function fetchWithCookies(url, cookie) {
  const res = await fetch(url, {
    headers: cookie ? { cookie } : undefined,
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const nextCookie = [cookie, setCookie]
    .filter(Boolean)
    .join("; ")
    .split(/,\s*(?=[^;]+=[^;]+)/g) // split multiple Set-Cookie headers coalesced
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  return { res, cookie: nextCookie || cookie };
}

async function downloadGoogleDriveFile({ fileId, outPath }) {
  // Uses the "uc" endpoint; handles the large-file confirmation page.
  let cookie = "";
  let url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
    fileId
  )}`;

  for (let attempt = 0; attempt < 4; attempt++) {
    const { res, cookie: nextCookie } = await fetchWithCookies(url, cookie);
    cookie = nextCookie;

    // Follow redirects manually so we can preserve cookies.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`Drive redirect without location (status ${res.status})`);
      if (/accounts\.google\.com\//i.test(loc)) {
        throw new Error(
          `Drive file ${fileId} is not publicly downloadable (redirected to Google login). Set sharing to "Anyone with the link" or use Drive API OAuth.`
        );
      }
      url = loc.startsWith("http") ? loc : new URL(loc, url).toString();
      continue;
    }

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (res.ok && !ct.includes("text/html")) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(outPath, buf);
      return { contentType: ct, bytes: buf.byteLength };
    }

    // Confirmation page HTML: extract confirm token link.
    const html = await res.text();
    const confirmHrefMatch =
      html.match(/href="(\/uc\?export=download[^"]+)"/i) ||
      html.match(/"downloadUrl":"([^"]+)"/i);
    if (!confirmHrefMatch) {
      throw new Error(
        `Unable to download Drive file ${fileId}: got HTML (status ${res.status}). Make sure link is shared publicly.`
      );
    }
    const href = confirmHrefMatch[1].replace(/\\u0026/g, "&");
    url = href.startsWith("http") ? href : new URL(href, "https://drive.google.com").toString();
  }
  throw new Error(`Failed to download Drive file ${fileId} after retries`);
}

function detectExt({ filePath, contentType }) {
  const byPath = path.extname(filePath).toLowerCase().replace(".", "");
  if (byPath) return byPath;
  if (!contentType) return "bin";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("heic") || contentType.includes("heif")) return "heic";
  return "bin";
}

function sipsConvertToJpeg({ inPath, outPath, maxDim }) {
  // macOS-only; converts HEIC or resizes huge images.
  // -Z preserves aspect ratio, setting max pixel dimension.
  const args = [];
  if (maxDim && Number.isFinite(maxDim) && maxDim > 0) {
    args.push("-Z", String(Math.floor(maxDim)));
  }
  args.push("-s", "format", "jpeg", inPath, "--out", outPath);
  const r = spawnSync("sips", args, { stdio: "pipe", encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`sips failed: ${r.stderr || r.stdout || `exit ${r.status}`}`);
  }
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

  // Params that get signed (exclude file + api_key + signature).
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
  const sheetCsvUrl = requireEnv("SHEET_CSV_URL");
  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requireEnv("CLOUDINARY_API_KEY");
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET");
  const folder = process.env.CLOUDINARY_FOLDER || "public-art-map";

  const imageColumn = process.env.IMAGE_COLUMN || "Image URL";
  const titleColumn = process.env.TITLE_COLUMN || "Title";
  const maxDim = Number(process.env.MAX_DIM || "3000");
  const hugeBytes = Number(process.env.HUGE_BYTES || String(10 * 1024 * 1024)); // 10MB

  const outCsvPath =
    process.env.OUT_CSV || path.resolve("gdrive-cloudinary-image-urls.csv");

  const sheetRes = await fetch(sheetCsvUrl);
  if (!sheetRes.ok) throw new Error(`Failed to fetch sheet CSV: HTTP ${sheetRes.status}`);
  const sheetText = await sheetRes.text();
  const parsed = Papa.parse(sheetText, { header: true, skipEmptyLines: true });
  const rows = parsed.data;

  const driveRows = rows
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => /drive\.google\.com\//i.test((r?.[imageColumn] || "").trim()));

  if (driveRows.length === 0) {
    console.log(`No Drive URLs found in column "${imageColumn}". Nothing to do.`);
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "drive-to-cloudinary-"));
  const results = [];

  for (const { r } of driveRows) {
    const title = String(r?.[titleColumn] || "").trim();
    const sourceUrl = String(r?.[imageColumn] || "").trim();
    const fileId = parseDriveFileId(sourceUrl);
    const basePublicId = fileId || safeSlug(title) || crypto.randomUUID();
    const publicId = `${folder}/${basePublicId}`;

    const rowOut = {
      title,
      drive_file_id: fileId || "",
      source_url: sourceUrl,
      cloudinary_secure_url: "",
      cloudinary_public_id: "",
      status: "pending",
      error: "",
    };

    try {
      if (!fileId) throw new Error("Could not parse Drive file id from URL");

      const downloadedPath = path.join(tmpDir, `${basePublicId}`);
      const { contentType, bytes } = await downloadGoogleDriveFile({
        fileId,
        outPath: downloadedPath,
      });

      const ext = detectExt({ filePath: sourceUrl, contentType });
      let uploadPath = downloadedPath;

      const isHeic = ext === "heic" || contentType.includes("heic") || contentType.includes("heif");
      const isHuge = bytes >= hugeBytes;

      if (isHeic || isHuge) {
        const converted = path.join(tmpDir, `${basePublicId}.jpg`);
        sipsConvertToJpeg({ inPath: downloadedPath, outPath: converted, maxDim });
        uploadPath = converted;
      }

      const uploaded = await cloudinaryUploadFile({
        cloudName,
        apiKey,
        apiSecret,
        folder,
        filePath: uploadPath,
        publicId,
      });

      rowOut.cloudinary_secure_url = uploaded.secure_url || "";
      rowOut.cloudinary_public_id = uploaded.public_id || publicId;
      rowOut.status = "ok";
    } catch (e) {
      rowOut.status = "error";
      rowOut.error = e?.message ? String(e.message) : String(e);
    }

    results.push(rowOut);
    // concise progress line
    console.log(
      `[${results.length}/${driveRows.length}] ${rowOut.status} ${rowOut.title || rowOut.drive_file_id}`
    );
  }

  const csv = Papa.unparse(results, { quotes: true });
  fs.writeFileSync(outCsvPath, csv + "\n");
  console.log(`\nWrote ${results.length} rows to ${outCsvPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

