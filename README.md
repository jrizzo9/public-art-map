## Public Art Map

Next.js app that renders:
- **Full map experience** at `/`
- **Artwork directory** at `/art` (search + category filter + sort)
- **SEO detail pages** at `/art/[slug]`
- **Public submission** intake at `/submit`
- **Webflow-safe embeds** at `/embed/art/[slug]` (noindex + canonical to `/art/[slug]`)

Data comes from a **published Google Sheet CSV** (no Google credentials required).

## UI notes

- **Theming:** the app uses **Tailwind CSS v4**, **shadcn/ui** primitives, and a shared **semantic palette** (CSS variables in `src/app/globals.css`) so the floating panel, detail pages, embed shell, and Mapbox-built popup/marker chrome stay visually consistent.
- **Branding:** fixed **top-left** chrome ([Creative Waco](https://creativewaco.org/) logo + **Public Art Map**) via shared **`SiteBrandBar`** on the **home map**, **`/art/[slug]`**, and **404**; copy and root metadata titles read from **`src/lib/site.ts`**. On the map, the bar sits clear of the **left** list panel. **Embed** artwork pages show a header link to the full map using the same product name.
- **Artwork detail (`/art/[slug]`):** a **frosted, centered** card; the page **scrolls** when content is long. When `NEXT_PUBLIC_MAPBOX_TOKEN` and valid coordinates are set, a **Mapbox Static** map image of the **artwork’s location** is used as the full-page background, with a **dark** scrim; otherwise a **gradient** fallback. **View Transitions** animate between the map and the detail page (see `next.config.ts` and `src/app/globals.css`).
- **Desktop:** the map is **fullscreen**, with the list panel **floating over** the map on the **left** (vertically centered, compact).
- **Mobile (narrow viewports):** **fullscreen map** with a **floating bottom sheet** (~30% of the viewport) for the panel (collapsible **Filters** + artwork list); selecting an artwork uses a smooth **fly-to** that accounts for the popup’s height (via `flyTo` `offset`) so the **popup card** lands vertically centered in the clear map area (with the marker below it for context).
- **Filters:** **category** (pill colors match map markers), **commission**, **collection**, and optional **year** range—expand **Filters** to refine the map and list. Nothing selected on a facet means **no filtering** on that facet; selecting one or more chips narrows to artworks matching **any** of those selections (within that facet). Chips available in each facet reflect the current **other** facets and **year** range so impossible combinations stay hidden; changing filters may drop selections that no longer apply. Each facet has **Any** to clear only that facet. **Clear** resets category, commission, collection, and year. The **title and Filters stay fixed**; only the **artwork list** (and **Showing X of Y** under it) scrolls. Changing filters **refits the map** to the visible markers with a short debounce when values change quickly.
- Choosing an artwork from the list row (main hit target) or from a map marker **flies the map** to that point (smooth camera) and opens a **popup above the marker** (tip points at the marker) with title, **artist/year** (when available), an image preview that shows the **full photo** (no crop), and a link to **Details →**; each row also has a **Details** control that opens **`/art/[slug]`** with the same motion as choosing **Details →** in the popup. Artwork detail pages also include a **Nearby art** section (sorted by distance) to jump to nearby works; thumbnails show the **full photo** (no crop).
- Click empty map area to clear the popup selection.

## Sheet contract (columns)

Your Google Sheet must have a header row and (at minimum) these columns:

| Column | Required | Notes |
|---|---:|---|
| `slug` | no | URL-safe, unique. If omitted/blank, the app derives one from `title` (may change if the title changes). |
| `title` | yes | |
| `lat` | yes | decimal degrees |
| `lng` | yes | decimal degrees |
| `description` | no | plain text |
| `image` | no | https URL |
| `address` | no | |
| `category` | no | Map/list marker color; filterable on home |
| `artist` | no | Artwork detail **Artist** row (structured block) |
| `year` | no | Artwork detail **Year** row + filterable range on home |
| `Commissioned By` | no | Shown under **Placement** → Commission |
| `Collection` | no | Shown under **Placement** → Collection |
| `URL` / `link` / `website` | no | **Website →** link in the **map popup** when valid https URL (not rendered on the detail card) |
| `image_id` | no | Use with **`NEXT_PUBLIC_ARTWORK_IMAGE_URL_TEMPLATE`** if no direct image URL column |

Invalid rows (missing required fields / invalid coords) are skipped.

The CSV parser also accepts common variants like `latitude`/`longitude` and `name` (as `title`). Column headers are matched case-insensitively after normalizing spaces.

## Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SITE_URL="https://map.creativewaco.org"
SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
NEXT_PUBLIC_MAPBOX_TOKEN="pk.XXXX"

# Optional
NEXT_PUBLIC_MAPBOX_STYLE_URL="mapbox://styles/..."
# Seconds between CSV refetches (ISR). Use 0 for no cache—always fetch latest sheet.
REVALIDATE_SECONDS="300"
# If true, attempt to geocode from `address` when `lat`/`lng` are missing (best-effort).
GEOCODE_MISSING_COORDS="false"
# NEXT_PUBLIC_ARTWORK_IMAGE_URL_TEMPLATE="https://cdn.example.com/img/{id}.webp"
EMBED_ALLOWED_ORIGINS="https://creativewaco.org,https://www.creativewaco.org"

# Optional (scripts only): Cloudinary migration
# CLOUDINARY_CLOUD_NAME="..."
# CLOUDINARY_API_KEY="..."
# CLOUDINARY_API_SECRET="..."
# CLOUDINARY_FOLDER="public-art-map"

# Public submissions (/submit): SUBMISSIONS_PREPARE_SECRET; Cloudinary vars for direct photo uploads;
# SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON + Submissions tab (see scripts/submissions-sheet-header-row.csv).
# Optional: SHEET_SUBMISSIONS_RANGE='Submissions'!A:Z

# Optional: sheet row patches (POST /api/admin/sheet-row) — see .env.example (no request secret; protect the deployment if the URL is public).
```

Notes:

- `NEXT_PUBLIC_SITE_URL` is used to build absolute URLs (OpenGraph/Twitter images, canonical URLs, `robots.txt`, `sitemap.xml`). In production it falls back to `https://map.creativewaco.org` when unset (and on Vercel will also use `VERCEL_URL`).

## Admin + API

- Admin page: `http://localhost:3000/admin` — **Public submissions** (rows loaded from the Google Sheet **Submissions** tab when Sheets API credentials are configured) and **Edit map info** (collapsible artwork picker, field editor, optional **Replace image** upload via `POST /api/admin/cloudinary`; saves through `POST /api/admin/sheet-row` when sheet updates are configured).
- Submit flow: `http://localhost:3000/submit` — `POST /api/submissions/prepare` returns signed Cloudinary upload slots; `POST /api/submissions/finalize` verifies uploads and **appends a row** to the **Submissions** sheet (requires `SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, and a header row—see `scripts/submissions-sheet-header-row.csv`). Photos live in Cloudinary only; submission text and image URLs are stored in the sheet.
- Health check: `http://localhost:3000/api/health`
- Artworks JSON: `http://localhost:3000/api/artworks`
- Single artwork JSON: `http://localhost:3000/api/artworks/<slug>`
- Optional sheet updates: `POST /api/admin/sheet-row` (no request auth; configure Apps Script URL + token **or** Google Sheets API per `.env.example` — protect the route at the host if the app is public).

### Cloudinary server routes (scripts + integrations)

These are **not** linked from `/admin` by default but remain available for uploads and tooling (scoped to `CLOUDINARY_FOLDER` when set). Requires Cloudinary credentials server-side.

- Upload (convert + upload): `POST /api/admin/cloudinary`
- List library: `GET /api/admin/cloudinary/library`

The artworks endpoint supports:

- `?q=<text>`: case-insensitive substring search across common fields
- `?category=<Category>`: exact category match (case-insensitive)
- `?limit=<n>`: cap results (max 10,000)

## Webflow embed

Use an Embed element:

```html
<iframe
  src="https://map.creativewaco.org/embed/art/<slug>"
  style="width:100%;height:700px;border:0;"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>
```

## Dev

```bash
pnpm dev
```

Visit `http://localhost:3000`.

## Troubleshooting

- **Build error about two pages resolving to the same path**: ensure there is only one route for each path (for example, don’t keep a parallel route group like `/(site)` defining `art/[slug]` alongside `src/app/art/[slug]`).
- **Build error about `@tailwindcss/postcss` missing**: run `pnpm install` so `tailwindcss`, `@tailwindcss/postcss`, and `postcss` are present; keep `postcss.config.mjs` at the repo root (Tailwind v4 uses the PostCSS plugin).
- **Vercel shows “This page couldn’t load”**: make sure `NEXT_PUBLIC_MAPBOX_TOKEN` is set in Vercel Environment Variables (Preview + Production as needed). A missing token causes Mapbox GL JS to throw on load and the app won’t render.

## Deploy (Vercel)

- Add a domain like `map.creativewaco.org` in Vercel.
- Set the env vars above in Vercel (Production + Preview if desired).

## Scripts (image migration)

These scripts help migrate externally-hosted images to Cloudinary. They require the Cloudinary env vars in `.env.local` (or your shell) and write CSV output files at the repo root.

### Download Google Drive photos (requires login)

Downloads private (non-public) Google Drive image links from your sheet by using OAuth (you’ll log in once; the token is cached locally).

- Create a Google Cloud OAuth Client (**Desktop app**) and download the JSON to `scripts/google/credentials.json` (this repo ignores it).
- Then run:

```bash
SHEET_ID="your-sheet-id" \
SHEET_RANGE="Sheet1!A:Z" \
IMAGE_COLUMN="Image URL" \
TITLE_COLUMN="Title" \
pnpm download:drive-photos
```

Output goes to `downloads/drive-photos/` and reruns skip already-downloaded files (tracked in `scripts/google/download-manifest.json`).

### MapHub → Cloudinary

Uploads `image_url` values from `maphub-image-urls.csv` directly (Cloudinary fetches the remote URL).

```bash
node scripts/migrate-maphub-to-cloudinary.mjs maphub-image-urls.csv
```

Output: `cloudinary-image-urls.csv`

### Google Drive → Cloudinary (macOS)

Downloads Google Drive `drive.google.com/file/d/...` URLs from your published sheet, then uploads to Cloudinary. Large/HEIC images may be converted via `sips` (macOS).

```bash
node scripts/migrate-drive-to-cloudinary.mjs
```

Output: `gdrive-cloudinary-image-urls.csv`

### Web-ready pipeline (pnpm)

See `package.json` for full script names. Typical flow: download Drive assets → generate web-ready images → upload to Cloudinary (optionally refresh sheet references).

```bash
pnpm download:drive-photos
pnpm images:web-ready
pnpm cloudinary:upload-web-ready
```
