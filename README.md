## Waco Public Art Map

Next.js app that renders:
- **Full map experience** at `/`
- **SEO detail pages** at `/art/[slug]`
- **Webflow-safe embeds** at `/embed/art/[slug]` (noindex + canonical to `/art/[slug]`)

Data comes from a **published Google Sheet CSV** (no Google credentials required).

## UI notes

- **Theming:** the app uses **Tailwind CSS v4**, **shadcn/ui** primitives, and a shared **semantic palette** (CSS variables in `src/app/globals.css`) so the floating panel, detail pages, embed shell, and Mapbox-built popup/marker chrome stay visually consistent.
- **Desktop:** the map is **fullscreen**, with the list panel **floating over** the map (vertically centered, compact).
- **Mobile (narrow viewports):** **fullscreen map** with a **floating bottom sheet** (~half the viewport) for the panel (collapsible **Filters** + artwork list); selecting an artwork flies the marker to about the **middle of the clear map** (slightly below center) so the popup can sit **above** the dot with map context underneath.
- **Filters:** category (colors match map markers), commission, and optional **year** range—expand **Filters** to change what appears on the map and in the list. The **title and Filters stay fixed**; only the **artwork list** (and **Showing X of Y** under it) scrolls. Changing filters **refits the map** to the visible markers with a short debounce when values change quickly.
- Choosing an artwork from the list or from a map marker **flies the map** to that point (smooth camera) and opens a **popup above the marker** (tip points at the marker) with title, optional image, and links to details/embed.
- Click empty map area to clear the popup selection.

## Sheet contract (columns)

Your Google Sheet must have a header row and (at minimum) these columns:

| Column | Required | Notes |
|---|---:|---|
| `slug` | yes | URL-safe, unique |
| `title` | yes | |
| `lat` | yes | decimal degrees |
| `lng` | yes | decimal degrees |
| `description` | no | plain text |
| `image` | no | https URL |
| `address` | no | |
| `category` | no | Map/list marker color; filterable on home |
| `artist` | no | Detail page header line |
| `year` | no | Detail page + filterable range on home |
| `Commissioned By` | no | Shown under **Placement** → Commission |
| `Collection` | no | Shown under **Placement** → Collection |
| `URL` / `link` / `website` | no | External “More information” link on detail when valid https URL |
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
# NEXT_PUBLIC_ARTWORK_IMAGE_URL_TEMPLATE="https://cdn.example.com/img/{id}.webp"
EMBED_ALLOWED_ORIGINS="https://creativewaco.org,https://www.creativewaco.org"
```

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

## Deploy (Vercel)

- Add a domain like `map.creativewaco.org` in Vercel.
- Set the env vars above in Vercel (Production + Preview if desired).
