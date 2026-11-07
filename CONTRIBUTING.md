# Contributing to Flux

Thanks for helping! Flux is intentionally small: plain JavaScript, no frontend build step, two runtime dependencies. Contributions that keep it that way are the easiest to merge.

## Getting set up

```sh
git clone https://github.com/<you>/flux.git && cd flux
npm ci
npm run setup      # yt-dlp (+ FFmpeg on Windows)
npm run dev        # http://localhost:3000, restarts on change
```

Guest previews work without any Google credentials.

## Before you open a PR

```sh
npm run check
npm test
npm run format:check      # or: npx prettier --write public lib server.mjs test scripts/check.mjs
```

For UI changes, also run the server and `npm run test:browser` and `npm run test:a11y`, and attach before/after screenshots. Regenerate README images with `node scripts/screenshots.mjs` if the UI changed visibly.

## Guidelines

- **Open an issue first** for anything non-trivial so we can agree on direction.
- Keep PRs focused: one concern per PR, with tests for behaviour changes.
- **No new runtime dependencies** without a strong justification.
- **Security-sensitive areas** (`lib/auth.mjs`, `lib/egress.mjs`, URL validation, file delivery, owner checks) need tests that prove the denial path, not just the happy path.
- Never fabricate progress, results or availability in the UI. Show what is true.
- Keep it accessible: semantic HTML, keyboard operable, respects reduced motion.
- Don't add DRM circumvention, or extraction of audio from services that only license streaming (e.g. Spotify). Such PRs will be closed.
- Never commit secrets, `.env`, binaries or downloaded media.

## AI-assisted contributions

AI-assisted PRs are welcome, whether from a person using an assistant or from an autonomous agent. Agents should read [AGENTS.md](AGENTS.md). Rules: you are responsible for what you submit, disclose AI assistance in the PR, run the checks above, keep PRs small, and work through a fork and PR (nobody pushes to `main` directly). Low-effort, unverified or spammy PRs are closed.

## Adding a source platform

1. Add the host to the allowlist in `server.mjs` and a description in `lib/platforms.mjs`.
2. Add an icon through `scripts/platform-icons.mjs` (Simple Icons, CC0, preferred).
3. Add a URL-validation test, including a look-alike host (`youtube.com.evil.test`).

## Commit style

Short imperative subject ("Add range support to file delivery"). Conventional-commit prefixes (`feat:`, `fix:`, `docs:`) are welcome but not required.

## Reporting security issues

Do **not** open a public issue. See [SECURITY.md](SECURITY.md).

## Code of Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
