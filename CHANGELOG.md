# Changelog

All notable changes are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

## [1.0.0] - 2026-11-07

### Added

- Single, batch and search lookup with real server-side metadata.
- MP4/MP3 output, resolution caps, MP3 bitrates, subtitle embedding.
- Genuine 50% previews for guests, validated with FFprobe and a full decode.
- Google sign-in (server-side OAuth, PKCE, nonce) with full-length downloads.
- Owner-scoped queue, history, cancel, retry, regenerate and clear.
- HTTP range support on file delivery.
- SSRF-safe egress proxy for extractor traffic.
- Source-aware workspace theming for 15 platform families.
- Docker Compose + Caddy deployment with automatic HTTPS.
- Unit, integration, Playwright and axe-core accessibility suites.
