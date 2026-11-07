# Security Policy

## Supported versions

Only the latest release on `main` receives security fixes.

## Reporting a vulnerability

Please **do not** open a public issue. Report privately through GitHub:
**Security tab → "Report a vulnerability"** on this repository.

Include what you found, steps to reproduce, and the impact you expect. Please allow reasonable time to fix before public disclosure. You'll be credited in the release notes unless you prefer otherwise.

## Scope

Of particular interest: authentication/session handling, authorization (cross-owner access to jobs or files), SSRF or egress-proxy bypass, argument or path injection into yt-dlp/FFmpeg, rate-limit bypass, and anything that lets a guest obtain a full-length file.

Out of scope: vulnerabilities in yt-dlp, FFmpeg or third-party platforms themselves (report those upstream), and limitations of the single-process architecture that the README already documents.
