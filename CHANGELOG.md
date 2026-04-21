# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Fullscreen Mapbox map with a floating left panel, search, and marker highlighting.
- Google Sheet **published CSV** ingestion with validation and flexible column mapping.
- SEO routes for artwork detail pages (`/art/[slug]`) and Webflow-friendly embed routes (`/embed/art/[slug]`).
- `sitemap.xml` + `robots.txt` generation based on current sheet rows.

### Security

- Restrict iframe embedding on `/embed/*` with `Content-Security-Policy: frame-ancestors` (defaults to Creative Waco domains, extensible via `EMBED_ALLOWED_ORIGINS`).

