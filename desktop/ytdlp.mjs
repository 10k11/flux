// Keeps a standalone yt-dlp in the app's data folder: downloaded and verified on
// first launch, then self-updated in the background (sites change often).
import { mkdir, writeFile, chmod, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";

const asset = () =>
  process.platform === "win32"
    ? process.arch === "arm64"
      ? "yt-dlp_arm64.exe"
      : "yt-dlp.exe"
    : process.platform === "darwin"
      ? "yt-dlp_macos"
      : process.arch === "arm64"
        ? "yt-dlp_linux_aarch64"
        : "yt-dlp_linux";

async function fetchOk(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Flux-Desktop",
      Accept: "application/vnd.github+json",
    },
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) throw new Error(`Download failed (${r.status}): ${url}`);
  return r;
}

async function download(target) {
  const name = asset();
  const release = await (
    await fetchOk("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
  ).json();
  const found = release.assets.find((a) => a.name === name);
  if (!found)
    throw new Error(`Could not find ${name} in the latest yt-dlp release.`);
  const bytes = Buffer.from(
    await (await fetchOk(found.browser_download_url)).arrayBuffer(),
  );
  let expected = found.digest?.replace(/^sha256:/, "");
  if (!expected || !/^[a-f0-9]{64}$/i.test(expected)) {
    const sums = release.assets.find((a) =>
      /^(SHA2-256SUMS|sha256sums\.txt)$/i.test(a.name),
    );
    if (!sums)
      throw new Error("No SHA-256 checksum was supplied; installation stopped.");
    const lines = (await (await fetchOk(sums.browser_download_url)).text()).split(
      /\r?\n/,
    );
    expected = lines
      .find((l) => l.trim().endsWith(name))
      ?.trim()
      .split(/\s+/)[0];
  }
  if (
    !expected ||
    createHash("sha256").update(bytes).digest("hex") !== expected.toLowerCase()
  )
    throw new Error("Checksum verification failed for yt-dlp.");
  await writeFile(target, bytes);
  if (process.platform !== "win32") await chmod(target, 0o755);
}

/** Returns the path to yt-dlp, downloading it on first run. Updates run in the background. */
export async function ensureYtDlp(binDir) {
  await mkdir(binDir, { recursive: true });
  const target = path.join(
    binDir,
    process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
  );
  const exists = await access(target).then(
    () => true,
    () => false,
  );
  if (!exists) {
    await download(target);
    return target;
  }
  // Best effort: the standalone binary can update itself in place.
  try {
    const child = spawn(target, ["-U"], { stdio: "ignore", windowsHide: true });
    child.on("error", () => {});
    setTimeout(() => child.kill(), 120000).unref();
  } catch {
    /* offline or read-only: keep the current version */
  }
  return target;
}
