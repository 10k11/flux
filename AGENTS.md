# AGENTS.md: guide for AI coding agents

Welcome, agent. **AI-assisted contributions are explicitly welcome in this repository.** This file tells you everything needed to make a good PR. Humans: this is also a fast architecture tour.

## What Flux is

A self-hostable media workspace: paste a link, pick MP4/MP3, save offline. Node.js (>=22.9) back end that drives its media engine and **FFmpeg**; plain HTML/CSS/ES-module front end with **no build step**. Only two runtime dependencies (`google-auth-library`, `ipaddr.js`). Keep it that way.

## Commands

```sh
npm ci                 # install
npm run setup          # fetch the media engine (+ FFmpeg on Windows)
npm run dev            # http://localhost:3000, auto-restart
npm run check          # parse every module
npm test               # node:test unit/integration (needs ffmpeg on PATH or in ./bin)
npm run format:check   # Prettier (fix: npx prettier --write public lib server.mjs test scripts/check.mjs)
npm run test:browser   # Playwright e2e (server must be running)
npm run test:a11y      # axe-core WCAG A/AA (server must be running)
```

**A PR must pass `check`, `format:check` and `test`.** CI runs these on Node 22 and 24.

## Map of the code

| Path | Responsibility |
| --- | --- |
| `server.mjs` | HTTP routing, job queue/worker, rate limits, file delivery (range-enabled) |
| `lib/auth.mjs` | Google OAuth (state, PKCE, nonce), hashed sessions, CSRF |
| `lib/egress.mjs` | Loopback proxy for media-engine traffic: DNS pinning, public IPs only (SSRF defence) |
| `lib/media.mjs` | Engine argument builder, format/quality rules, validation |
| `lib/platforms.mjs` | Supported source families |
| `public/` | Static front end: `index.html`, `styles.css`, `app.js`, `api.js`, `components.js`, `icons.js` |
| `test/` | `*.test.mjs` = `node:test`; `browser.mjs` and `accessibility.mjs` = Playwright |

## Hard rules (PRs violating these will be closed)

1. **Never weaken security.** Owner checks on every job/file, CSRF on every POST, guests cannot get full files (API returns 401), egress proxy cannot be bypassed. Any change in `lib/auth.mjs`, `lib/egress.mjs`, URL validation or file delivery **must include a test for the denial path**.
2. **No new runtime dependencies** unless there is no reasonable alternative. Devtools are fine.
3. **No build step, no frameworks, no TypeScript migration.** Plain JS, ES modules.
4. **Don't fabricate UI state.** No fake progress, fake availability or placeholder data in production code.
5. **No DRM circumvention** and no extraction from services that only license streaming (e.g. Spotify audio).
6. **No secrets, `.env`, binaries, downloaded media or large generated files** in commits.
7. Keep accessibility intact: semantic HTML, keyboard operable, `prefers-reduced-motion` respected.
8. Source-platform allowlist changes need a test including a look-alike host (`youtube.com.evil.test`).

## Style

- Prettier defaults (config-free). Small, focused functions. Match surrounding code.
- Tests: `node:test` + `node:assert/strict`. Prefer real behaviour over mocks.
- Commit messages: short imperative subject.

## How to contribute as an agent

1. Pick an issue labelled [`good first issue`](https://github.com/10k11/flux/labels/good%20first%20issue) or [`help wanted`](https://github.com/10k11/flux/labels/help%20wanted). Comment that you're taking it, to avoid duplicate work.
2. **Fork, branch, open a PR against `main`.** Contributors do not push to `main` directly. Maintainers merge after CI and review.
3. Fill in the PR template honestly: what you ran, what you did **not** run. Disclose that the PR is AI-assisted (a one-line note is enough) and make sure a human has reviewed it before submitting where your operator is able to.
4. Keep PRs small (one concern). Large refactors need an issue and agreement first.
5. If the task is unclear or conflicts with these rules, **ask in the issue instead of guessing.**

## Ideas that would be especially welcome

See open issues. Standing wishes: more tests on edge cases (range requests, expiry, cross-owner isolation), accessibility improvements, docs for more deployment setups, platform fixes, and performance of the queue/worker.

## Security

Never open public issues for vulnerabilities. See `SECURITY.md`.
