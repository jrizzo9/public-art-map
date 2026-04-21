# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Tailwind CSS v4** with PostCSS (`postcss.config.mjs`), **shadcn/ui** (`components.json`, `cn` helper, sample `Button`), and **Tangerine**-aligned design tokens in `globals.css` (imported theme registry URL).
- **Theme-aware Mapbox UI**: marker and popup styles via CSS modules using the same semantic color variables as the rest of the app.
- **Map popup preview** for the selected artwork (title, image when present, links) anchored above the marker; selection clears when clicking the map background.
- Smooth **fly-to** animation when selecting an artwork from the list or a marker.
- Fullscreen Mapbox map with a floating left panel and marker highlighting.
- **Filters** (collapsible): **category** (pill toggles + map colors), **commission**, and **year** range; badge and **Clear** when refinements are active.
- **Marker and list dot colors** by category (`category-colors`); fixed hues for **Decommissioned art**, **Sculptures**, and **Fountains** so they stay distinct from green-heavy hash slots.
- Google Sheet **published CSV** ingestion with validation and flexible column mapping; optional **`image_id`** + **`NEXT_PUBLIC_ARTWORK_IMAGE_URL_TEMPLATE`** (`{id}`) when no direct image URL column.
- Sheet-backed fields on artworks: **year**, **artist**, **commission**, **collection**, **external URL** (`url` / `link` / `website` column variants).
- Artwork detail **Placement** section (commission + collection), **year · artist** under the title when present, and **More information** link when `externalUrl` is set.
- SEO routes for artwork detail pages (`/art/[slug]`) and Webflow-friendly embed routes (`/embed/art/[slug]`).
- `sitemap.xml` + `robots.txt` generation based on current sheet rows.

### Changed

- **Visual theme**: map panel, filters, list, artwork detail cards, embed layout, art detail route, and not-found page use shared **semantic tokens** (foreground, muted, primary, card, border, shadows, radius) instead of hardcoded grays and accent hex values.
- Root fonts: **Inter**, **JetBrains Mono**, and **Source Serif 4** via `next/font/google` (replacing Geist) to match the theme stack.
- Left panel: **single scrollbar** for title, filters, artwork list, and count (no separate scroll regions); **Showing X of Y** pinned to the bottom with smaller type.
- Panel typography and controls unified (pill toggles for filters vs checkbox lists).
- **`REVALIDATE_SECONDS`**: **`0`** disables fetch caching (`cache: "no-store"`) for always-fresh CSV; otherwise ISR revalidation in seconds (default **300**).

### Removed

- **Free-text search** on the map home panel (refining is via filters only).

### Fixed

- Mobile artwork popup uses a **bottom** anchor and upward offset so the tip sits **above** the marker and points **down** at it (not through the dot).
- Selection **flies straight** to the artwork (no intermediate refit-to-all-markers) and marker clicks stay selected (map background click no longer clears selection in the same gesture).
- Fix production build failure caused by duplicate route definitions (removed legacy `/(site)` route group).

### Security

- Restrict iframe embedding on `/embed/*` with `Content-Security-Policy: frame-ancestors` (defaults to Creative Waco domains, extensible via `EMBED_ALLOWED_ORIGINS`).
