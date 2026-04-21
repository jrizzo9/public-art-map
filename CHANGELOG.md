# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Map popup preview** for the selected artwork (title, image when present, links) anchored above the marker; selection clears when clicking the map background.
- Smooth **fly-to** animation when selecting an artwork from the list or a marker.
- Fullscreen Mapbox map with a floating left panel, search, and marker highlighting.
- Google Sheet **published CSV** ingestion with validation and flexible column mapping.
- SEO routes for artwork detail pages (`/art/[slug]`) and Webflow-friendly embed routes (`/embed/art/[slug]`).
- `sitemap.xml` + `robots.txt` generation based on current sheet rows.

### Changed

- Left panel layout: vertically centered, tighter typography/spacing; subtitle and collapse control removed from the header.
- Search input spacing under the field adjusted for clearer separation from the count row.

### Fixed

- Selection **flies straight** to the artwork (no intermediate refit-to-all-markers) and marker clicks stay selected (map background click no longer clears selection in the same gesture).
- Fix production build failure caused by duplicate route definitions (removed legacy `/(site)` route group).
- Fix production build failure from stray Tailwind PostCSS config (`postcss.config.mjs`) requiring `@tailwindcss/postcss`.

### Security

- Restrict iframe embedding on `/embed/*` with `Content-Security-Policy: frame-ancestors` (defaults to Creative Waco domains, extensible via `EMBED_ALLOWED_ORIGINS`).

