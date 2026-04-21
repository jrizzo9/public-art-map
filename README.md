## Waco Public Art Map

Next.js app that renders:
- **Full map experience** at `/`
- **SEO detail pages** at `/art/[slug]`
- **Webflow-safe embeds** at `/embed/art/[slug]` (noindex + canonical to `/art/[slug]`)

Data comes from a **published Google Sheet CSV** (no Google credentials required).

## UI notes

- **Desktop:** the map is **fullscreen**, with the list panel **floating over** the map (vertically centered, compact).
- **Mobile (narrow viewports):** **split layout** — map occupies the **top half** of the screen and the list panel occupies the **bottom half** (no overlay).
- Choosing an artwork from the list or from a map marker **flies the map** to that point (smooth camera) and opens a **popup above the marker** with title, optional image, and links to details/embed.
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
| `category` | no | |
| `Commissioned By` | no | Shown under **Placement** → Commission |
| `Collection` | no | Shown under **Placement** → Collection |

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
REVALIDATE_SECONDS="300"
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
- **Build error about `@tailwindcss/postcss` missing**: remove `postcss.config.*` if you’re not using Tailwind, or add the missing dependency if you are.

## Deploy (Vercel)

- Add a domain like `map.creativewaco.org` in Vercel.
- Set the env vars above in Vercel (Production + Preview if desired).
