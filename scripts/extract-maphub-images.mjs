import fs from "node:fs";
import path from "node:path";

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function maphubImageUrlFromId(imageId) {
  // MapHub stores images under a shard path based on the id.
  // Verified working pattern:
  // https://maphub.net/media/images/o/du/odue5lnbq77ortfn/1024_768.jpg
  const a = imageId.slice(0, 1);
  const b = imageId.slice(1, 3);
  return `https://maphub.net/media/images/${a}/${b}/${imageId}/1024_768.jpg`;
}

const input = process.argv[2];
if (!input) {
  console.error(
    "Usage: node scripts/extract-maphub-images.mjs <path/to/map.geojson>",
  );
  process.exit(1);
}

const geojsonRaw = fs.readFileSync(input, "utf8");
const geojson = JSON.parse(geojsonRaw);
const features = Array.isArray(geojson?.features) ? geojson.features : [];

const rows = [];
for (const feature of features) {
  const props = feature?.properties ?? {};
  const title = props.title ?? "";
  const imageId = props?.image?.id ?? null;

  if (!imageId) continue;

  rows.push({
    title,
    image_id: imageId,
    image_url: maphubImageUrlFromId(imageId),
  });
}

rows.sort((a, b) => String(a.title).localeCompare(String(b.title)));

const outLines = [
  ["title", "image_id", "image_url"].map(csvEscape).join(","),
  ...rows.map((r) =>
    [r.title, r.image_id, r.image_url].map(csvEscape).join(","),
  ),
];

const outPath = path.resolve(process.cwd(), "maphub-image-urls.csv");
fs.writeFileSync(outPath, outLines.join("\n") + "\n");

console.log(`Wrote ${rows.length} rows to ${outPath}`);
