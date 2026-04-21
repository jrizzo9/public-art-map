import fs from "node:fs";
import path from "node:path";
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

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  return await res.text();
}

async function main() {
  const publicCsvUrl = requireEnv("PUBLIC_SHEET_CSV_URL");
  const inCsvPath = path.resolve(env("IN_CSV", "gdrive-cloudinary-image-urls.csv"));
  const outCsvPath = path.resolve(env("OUT_CSV", "gdrive-cloudinary-image-urls.ordered.csv"));
  const publicImageColumn = env("PUBLIC_IMAGE_COLUMN", "Image URL");

  if (!fs.existsSync(inCsvPath)) throw new Error(`Missing IN_CSV: ${inCsvPath}`);

  const publicText = await fetchText(publicCsvUrl);
  const publicParsed = Papa.parse(publicText, { header: true, skipEmptyLines: true });
  const publicRows = Array.isArray(publicParsed.data) ? publicParsed.data : [];

  const order = [];
  for (const r of publicRows) {
    const url = String(r?.[publicImageColumn] || "").trim();
    const id = parseDriveFileId(url);
    if (id) order.push(id);
  }

  const inText = fs.readFileSync(inCsvPath, "utf8");
  const inParsed = Papa.parse(inText, { header: true, skipEmptyLines: true });
  const rows = Array.isArray(inParsed.data) ? inParsed.data : [];

  const byId = new Map();
  for (const row of rows) {
    const id = String(row?.drive_file_id || "").trim();
    if (id) byId.set(id, row);
  }

  const used = new Set();
  const ordered = [];

  for (const id of order) {
    const row = byId.get(id);
    if (!row) continue;
    if (used.has(id)) continue;
    used.add(id);
    ordered.push(row);
  }

  // Append any extra rows not present in public sheet order.
  for (const row of rows) {
    const id = String(row?.drive_file_id || "").trim();
    if (!id || used.has(id)) continue;
    ordered.push(row);
  }

  const csv = Papa.unparse(ordered, { quotes: true });
  fs.writeFileSync(outCsvPath, csv + "\n");

  console.log(
    `Wrote ${ordered.length} rows to ${outCsvPath} (public order ids: ${order.length})`
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});

