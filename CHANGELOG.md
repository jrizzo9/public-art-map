# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Admin status page (`/admin`) with basic env/data checks and links to API endpoints.
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

- **Map popup preview:** remove the **Embed →** link (embed routes still exist for Webflow iframes).
- **Free-text search** on the map home panel (refining is via filters only).

### Fixed

- Document required `NEXT_PUBLIC_MAPBOX_TOKEN` env var on Vercel to avoid client-side Mapbox GL initialization errors (“This page couldn’t load”).
- **Mobile map popup:** move the popup card further upward so the marker dot stays visible beneath it.
- **Map selection `flyTo`:** measure themed popup height off-DOM (plus tail slack) and use a **single smooth `flyTo`** with a vertical **`offset`** so the **popup card** (not just the marker) lands centered within the padded map chrome after selection.
- Clear home **selection when filters change** so the popup does not stay open for an artwork hidden by the new filter set.
- Mobile artwork popup uses a **bottom** anchor and upward offset so the tip sits **above** the marker and points **down** at it (not through the dot).
- Selection **flies straight** to the artwork (no intermediate refit-to-all-markers) and marker clicks stay selected (map background click no longer clears selection in the same gesture).
- Fix production build failure caused by duplicate route definitions (removed legacy `/(site)` route group).

### Security

- Restrict iframe embedding on `/embed/*` with `Content-Security-Policy: frame-ancestors` (defaults to Creative Waco domains, extensible via `EMBED_ALLOWED_ORIGINS`).
