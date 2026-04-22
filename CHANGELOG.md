# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Map home **filter query parameters** (`cat`, `comm`, `coll`, `ymin`, `ymax`) so filter state is **shareable** and works with **browser history**; the home page reads `searchParams` on the server for a matching first paint.
- **Admin** password sign-in (`ADMIN_PASSWORD`) with an **HTTP-only session cookie** (JWT via **`jose`**), **`POST /api/admin/auth`**, **`/admin/login`**, **middleware** protecting **`/admin`** and **`/api/admin/*`** (except the auth route), **Sign out** on the admin page, and an admin **toolbar**.
- **Admin** layout **site navigation** (Map, Art, optional Submit, Admin) for quick moves between sections.
- **`NEXT_PUBLIC_SUBMIT_ENABLED`**: when set to `true`, enables the home **Submit** control, **`/submit`**, and includes **`/submit`** in **`sitemap.xml`**; when off, **`/submit`** redirects to **`/`**.
- pnpm script **`test:sheet`** running **`scripts/test-sheet-connection.mjs`** to smoke-test sheet / Apps Script configuration (read-only checks when possible).
- Google Sheet **Submissions** tab: append submission rows on finalize (`src/lib/google-sheets-submissions.ts`), optional `SHEET_SUBMISSIONS_RANGE`, and `scripts/submissions-sheet-header-row.csv` for the header row template.
- Admin **Public submissions** reads completed submissions from that sheet tab (Google Sheets API) instead of Cloudinary metadata files.
- Artwork directory page at `/art` with search, category filtering, and sorting.
- Add `/art` to `sitemap.xml`.
- Public **submit** flow at `/submit` with `POST /api/submissions/prepare` and `POST /api/submissions/finalize` (Cloudinary photo uploads + Google Sheet row for metadata when Sheets API env is configured).
- Admin `/admin`: **Public submissions** (sheet-backed when configured), **Edit map info** (collapsible artwork list, dense form, image preview + replace via `POST /api/admin/cloudinary`; location is **address** or **latitude/longitude**, not both), with **stacked** full-width sections at all breakpoints.
- `POST /api/admin/sheet-row` for optional Google Sheet row patches (Apps Script web app or Google Sheets API; no caller secret — see `.env.example`).
- pnpm scripts: `download:drive-photos`, `images:web-ready`, `cloudinary:upload-web-ready`, `cloudinary:upload-and-update-sheet`, `cloudinary:order-csv-like-public-sheet`.
- Cloudinary admin endpoints:
  - `POST /api/admin/cloudinary` (convert + upload)
  - `GET /api/admin/cloudinary/library` (list images, scoped to `CLOUDINARY_FOLDER` when set)
- Cloudinary helpers:
  - `src/lib/cloudinary.ts` (signed uploads)
  - `src/lib/cloudinary-admin.ts` (Admin API listing)
- `sharp` dependency for server-side image processing.
- JSON API endpoints: `/api/health`, `/api/artworks` (supports `q`, `category`, `limit`), and `/api/artworks/[slug]`.
- Cloudinary migration helpers:
  - `scripts/migrate-maphub-to-cloudinary.mjs` (uploads MapHub image URLs; writes `cloudinary-image-urls.csv`)
  - `scripts/migrate-drive-to-cloudinary.mjs` (downloads Google Drive images; macOS `sips` conversion for HEIC/huge; writes `gdrive-cloudinary-image-urls.csv`)
- Address-based fallback geocoding (Mapbox) for sheet rows missing `lat`/`lng` (`GEOCODE_MISSING_COORDS=true`).
- Title-derived slug generation when the sheet `slug` column is blank (with de-duping suffixes).
- Artwork detail page **Nearby art** section (sorted by distance) with thumbnail tiles; distance is shown inline with the title.
- Geo helpers (`haversineDistanceKm`, `kmToMiles`) for computing “nearby” distances.
- **`SiteBrandBar`** (`src/components/SiteBrandBar.tsx`) and **`src/lib/site.ts`** (`SITE_PRODUCT_NAME`, default metadata title template) so **Public Art Map** + Creative Waco logo stay consistent on **home**, **`/art/[slug]`**, **404**, and the **embed** artwork header link.
- **View Transitions** (Next `experimental.viewTransition`) for **map home ↔ `/art/[slug]`** navigations, with **nav-forward** / **nav-back** CSS, shared **logo** `view-transition-name` anchor, and **Details** (list + map popup) / **← Map** / 404 back using `transitionTypes` on `Link` or `router.push`.
- **Art detail shell** (`art-detail-shell.module.css`): same **Creative Waco** wordmark; **centered** frosted **panel**; **page-level scroll** for long copy; **Mapbox Static Images** snapshot of the artwork’s **lat/lng** (same `NEXT_PUBLIC_MAPBOX_TOKEN` + `NEXT_PUBLIC_MAPBOX_STYLE_URL` as the map) with a **dark** top-to-bottom **overlay**; **gradient fallback** when the API is not used.
- **`mapbox-static.ts`**: build **Static Images** preview URLs (zoomed block context) for the detail backdrop.
- **Home list:** per-row **Details** control to open the SEO page with a **forward** view transition; main row still **selects** the map + popup.
- **Artwork detail** content in **section + `dl` / `dt` / `dd` blocks** for **Artist**, **Description**, **Placement** (commission + collection), and **Year**; **image placeholder** when there is no photo URL.
- **Tailwind CSS v4** with PostCSS (`postcss.config.mjs`), **shadcn/ui** (`components.json`, `cn` helper, sample `Button`), and **Tangerine**-aligned design tokens in `globals.css` (imported theme registry URL).
- **Theme-aware Mapbox UI**: marker and popup styles via CSS modules using the same semantic color variables as the rest of the app.
- **Map popup preview** for the selected artwork (title, image when present, links) anchored above the marker; selection clears when clicking the map background.
- Smooth **fly-to** animation when selecting an artwork from the list or a marker.
- Fullscreen Mapbox map with a floating left panel and marker highlighting.
- **Filters** (collapsible): **category** (pill toggles + map colors), **commission**, **collection**, and **year** range; badge and **Clear** when refinements are active.
- **Marker and list dot colors** by category (`category-colors`); fixed hues for **Decommissioned art**, **Sculptures**, and **Fountains** so they stay distinct from green-heavy hash slots.
- Google Sheet **published CSV** ingestion with validation and flexible column mapping; optional **`image_id`** + **`NEXT_PUBLIC_ARTWORK_IMAGE_URL_TEMPLATE`** (`{id}`) when no direct image URL column.
- Sheet-backed fields on artworks: **year**, **artist**, **commission**, **collection**, **external URL** (`url` / `link` / `website` column variants) for the **map popup** and data (not a direct “More information” block on the detail card).
- SEO routes for artwork detail pages (`/art/[slug]`) and Webflow-friendly embed routes (`/embed/art/[slug]`).
- `sitemap.xml` + `robots.txt` generation based on current sheet rows.

### Changed

- **`POST /api/admin/sheet-row`** prefers **direct Google Sheets API** updates when **`SHEET_ID`** + **`GOOGLE_SERVICE_ACCOUNT_JSON`** are configured; **Apps Script** (`SHEET_EDIT_API_URL` + token) is used **only** when that service-account path is incomplete.
- **`.env.example`**: documents **admin password** auth, **`NEXT_PUBLIC_SUBMIT_ENABLED`**, and **Sheets API–first** sheet edits (Apps Script as fallback).
- Public submission **finalize** persists metadata to the **Submissions** Google Sheet (requires `SHEET_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON`); Cloudinary stores **photos only** (no `submission.json` raw asset).
- **Edit map info** admin UI: collapsible artwork picker (closed by default), tighter layout, and slug-based **Replace image** uploads.
- `POST /api/admin/sheet-row` no longer requires `ADMIN_SHEET_SECRET` (still protect publicly exposed deployments at the host).
- OpenGraph and Twitter images now render the hostname from `NEXT_PUBLIC_SITE_URL` (instead of a hardcoded domain).
- Admin `/admin` replaces the in-page Cloudinary **uploader** and **library grid** with **public submissions** + an **edit map info** scaffold (sheet writes still go through `POST /api/admin/sheet-row` when configured).
- Update one MapHub source URL to the smaller `544_400` variant.
- Stop treating the sheet `id` column as a slug source (only use `slug`, otherwise derive from `title`).
- Home list meta line now shows **Collection, Artist, Year** (no category/address).
- Category color overrides: **Murals** (yellow) and **Other** (blue) stay visually distinct.
- Show full artwork images (no crop) in the **detail panel**, **Nearby art** thumbnails, and the **map popup** preview.
- Increase the **map popup** preview size, with responsive sizing on mobile to avoid overflow.
- **Mobile home panel (bottom sheet):** reduce height from ~50% to ~30% of the viewport.
- **Map popup preview:** show **Artist, Year** (when available) in the meta line instead of category/address.
- **Branding copy:** visible product title is **Public Art Map** (replacing **Waco** in that label); browser titles use **`SITE_METADATA_DEFAULT_TITLE`** / **`SITE_METADATA_TITLE_TEMPLATE`** from `site.ts`.
- **Artwork detail (`/art/[slug]`):** same fixed **logo + title** chrome as the map home (via **`SiteBrandBar`**); removed the duplicate product label from the panel **← Map** row.
- **Home filters:** **Filters** `<details>` sits flush inside the panel (drop legacy negative horizontal margins); summary row is a compact bordered control with optional **active count** badge on the **right**; inner filter grid padding aligned with the panel.
- **Embed (`/embed/art/[slug]`):** header link to **`/`** labeled with **`SITE_PRODUCT_NAME`**.
- **Artwork detail page** layout and copy: removed **PUBLIC ART** kicker, visible **Placement** section title, **latitude/longitude** grid, and the **detail-page** external **More information** link (`externalUrl` still powers **Website →** on the **map popup** when set).
- **Facet selection pruning:** compute **effective** category/commission/collection sets with **`deriveFacetUi`** during render instead of **`useEffect`** + `setState` (avoids cascading-render lint while keeping impossible chip selections pruned).
- **Mapbox selection popup** (artwork preview on the map): **rounded corners**, **card** background, and **border / shadow** from the design system (overrides Mapbox’s default flat box).
- **Home filters:** add **collection** (sheet column) beside category and commission; facet toggles start **unselected** (no filtering on that dimension until you pick chips); selecting chips **includes** matching artworks (**OR** within each facet). **Any** clears one facet only (replaces prior **All / None** controls).
- **Responsive facet lists:** category, commission, and collection chips shown for each facet reflect the **other** facets plus the **year** range; selections that become invalid when options shrink are **pruned** automatically.
- **Visual theme**: map panel, filters, list, artwork detail cards, embed layout, art detail route, and not-found page use shared **semantic tokens** (foreground, muted, primary, card, border, shadows, radius) instead of hardcoded grays and accent hex values.
- Root fonts: **Inter**, **JetBrains Mono**, and **Source Serif 4** via `next/font/google` (replacing Geist) to match the theme stack.
- Left panel: **pinned header** (title + Filters) with a **scrollable list** below; **Showing X of Y** stays at the bottom of the scroll area with smaller type.
- **Map markers and sidebar list dots**: drop the dark **foreground border ring** (shadow only).
- **Filter fit**: when results change, the map **animates fitBounds** to filtered markers using **floating panel / bottom-sheet padding**, with **debouncing** so quick filter tweaks (e.g. year typing) trigger one camera move.
- Panel typography and controls unified (pill toggles for filters vs checkbox lists).
- **`REVALIDATE_SECONDS`**: **`0`** disables fetch caching (`cache: "no-store"`) for always-fresh CSV; otherwise ISR revalidation in seconds (default **300**).

### Removed

- Server-side Cloudinary upload of submission bundle **`submission.json`** (`uploadSubmissionMetadataJson`); submission records live in Google Sheets instead.
- **In-admin** Cloudinary **ImageUploader** and **CloudinaryLibrary** UI (upload + browse grid on `/admin`); server routes `POST /api/admin/cloudinary` and `GET /api/admin/cloudinary/library` remain for scripts and integrations.
- Apps Script–based live Google Sheet editing from `/admin`.
- **Map popup preview:** remove the **Embed →** link (embed routes still exist for Webflow iframes).
- **Free-text search** on the map home panel (refining is via filters only).

### Fixed

- Cloudinary **signed upload** parameters for browser-direct `image/upload` and server `raw`/`image` uploads align with Cloudinary’s signature verification (omit `resource_type` from the signed parameter set for those endpoints).
- `sitemap.xml` and `robots.txt` now default to `https://map.creativewaco.org` in production (avoids `localhost` URLs when `NEXT_PUBLIC_SITE_URL` is unset).
- Add descriptive `alt` text to **Nearby art** thumbnails for better accessibility/SEO.
- Document required `NEXT_PUBLIC_MAPBOX_TOKEN` env var on Vercel to avoid client-side Mapbox GL initialization errors (“This page couldn’t load”).
- **Mobile map popup:** move the popup card further upward so the marker dot stays visible beneath it.
- **Map selection `flyTo`:** measure themed popup height off-DOM (plus tail slack) and use a **single smooth `flyTo`** with a vertical **`offset`** so the **popup card** (not just the marker) lands centered within the padded map chrome after selection.
- Clear home **selection when filters change** so the popup does not stay open for an artwork hidden by the new filter set.
- Mobile artwork popup uses a **bottom** anchor and upward offset so the tip sits **above** the marker and points **down** at it (not through the dot).
- Selection **flies straight** to the artwork (no intermediate refit-to-all-markers) and marker clicks stay selected (map background click no longer clears selection in the same gesture).
- Fix production build failure caused by duplicate route definitions (removed legacy `/(site)` route group).

### Security

- Restrict iframe embedding on `/embed/*` with `Content-Security-Policy: frame-ancestors` (defaults to Creative Waco domains, extensible via `EMBED_ALLOWED_ORIGINS`).
