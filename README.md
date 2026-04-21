# Creative Waco — Public Art Map

Next.js app (App Router) deployed on **Vercel**, with:

- **`/`** — Full-screen Mapbox map + filterable list (Google Sheet data).
- **`/art/[slug]`** — SEO-focused detail pages (indexed, canonical URL, JSON-LD).
- **`/embed/art/[slug]`** — Minimal layout for iframe embeds on Webflow (`noindex`, canonical → full detail URL). Only listed origins may frame embeds (see `EMBED_ALLOWED_ORIGINS` / defaults in [`next.config.ts`](next.config.ts)).

Data is loaded from a **published Google Sheet CSV** (`SHEET_CSV_URL`) with time-based revalidation (`REVALIDATE_SECONDS`, default 300). Route segments use `export const revalidate = 300` — keep that aligned with sheet cache if you change cadence.

## Google Sheet columns

Use a header row; names are normalized (case/spacing → underscores). Accepted aliases are in [`src/lib/sheet.ts`](src/lib/sheet.ts).

| Column      | Required | Notes                                                |
| ----------- | -------- | ---------------------------------------------------- |
| `slug`      | Yes      | Lowercase letters, numbers, hyphens (`kebab-case`).  |
| `title`     | Yes      | Display name (`name`, `artwork_title` also work).    |
| `lat`/`lng` | Yes      | Decimal degrees (`latitude`, `longitude`, etc.).     |
| `description` | No   | Plain text (paragraph breaks supported).             |
| `image`     | No       | HTTPS URL (`image_url`, `photo`).                    |
| `address`   | No       |                                                      |
| `category`  | No       | Used for filters (`type`, `medium` also work).       |

Publish the sheet: **File → Share → Publish to web → CSV**. Copy the URL into `SHEET_CSV_URL`.

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` for local development.

| Variable                       | Required | Purpose |
| ------------------------------ | -------- | ------- |
| `NEXT_PUBLIC_SITE_URL`         | Yes*     | Canonical URL, no trailing slash (e.g. `https://map.creativewaco.org`). Defaults to `VERCEL_URL` / localhost if unset at build time. |
| `SHEET_CSV_URL`                | Yes      | Published CSV URL.                                   |
| `NEXT_PUBLIC_MAPBOX_TOKEN`     | Yes      | Mapbox public token (GL JS).                         |
| `NEXT_PUBLIC_MAPBOX_STYLE_URL` | No       | Custom Mapbox Studio style; defaults to Streets.     |
| `REVALIDATE_SECONDS`           | No       | Sheet fetch revalidation (default `300`).            |
| `EMBED_ALLOWED_ORIGINS`        | No       | Comma-separated origins for `frame-ancestors` on `/embed/*` (defaults to `creativewaco.org` + `www`). |

\*Strongly recommended in production so sitemaps, canonicals, and OG URLs are correct.

## Your manual checklist (deploy)

1. **Vercel** — Create/import the project; add env vars above.
2. **DNS** — Point your subdomain (e.g. `map`) to Vercel (`CNAME` to `cname.vercel-dns.com` per Vercel’s domain UI).
3. **Mapbox** — [Account dashboard](https://account.mapbox.com/) → copy default **public token** → `NEXT_PUBLIC_MAPBOX_TOKEN`.
4. **Google Sheet** — Publish CSV; paste URL into `SHEET_CSV_URL`.
5. **Webflow** — Embed an iframe pointing at your embed route, for example:

```html
<iframe
  title="Public art"
  src="https://map.creativewaco.org/embed/art/your-piece-slug"
  loading="lazy"
  style="width:100%;min-height:520px;border:0;border-radius:12px;"
></iframe>
```

Replace the domain and slug with your production host and sheet `slug`.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run lint
npm run build
```

## SEO notes

- [`src/app/sitemap.ts`](src/app/sitemap.ts) lists `/` and `/art/[slug]` URLs.
- [`src/app/robots.ts`](src/app/robots.ts) allows crawling `/` and disallows `/embed/` (embed pages still set `noindex`).
- Embed routes send `Content-Security-Policy: frame-ancestors …` so only your sites can iframe them.
