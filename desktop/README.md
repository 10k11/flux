# Flux desktop app

An Electron wrapper that runs the regular Flux server on `127.0.0.1` and shows it in a window. No Node, Docker or setup needed for users. The server code is unchanged; the app only sets environment variables (`FLUX_LOCAL_MODE=1`, data in the OS app-data folder).

- The **media engine** is downloaded (checksum-verified) on first launch into the app-data folder and self-updates on later launches.
- **FFmpeg / FFprobe** are bundled through `ffmpeg-static` and `ffprobe-static`.
- **Local mode** (`FLUX_LOCAL_MODE=1`) treats the person running the app as signed in, so full-length downloads work without Google sign-in. It is ignored unless the server listens on `127.0.0.1`.

## Develop

```bash
cd desktop
npm ci
npm start      # copies ../server.mjs, ../lib, ../public into app-server/ and opens the app
npm run dist   # builds an installer for the current OS into dist/
```

Releases are built for Windows (`.exe`), macOS (`.dmg`) and Linux (`.AppImage`) by `.github/workflows/desktop.yml` when a `v*` tag is pushed. Builds are unsigned, so Windows SmartScreen and macOS Gatekeeper will warn on first open.
