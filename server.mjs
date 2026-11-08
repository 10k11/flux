import { platforms } from "./lib/platforms.mjs";
import { createAuth, ownerOf, authorizeMode, equal } from "./lib/auth.mjs";
import { makePreview, previewDuration, probeMedia } from "./lib/media.mjs";
import { createEgressProxy } from "./lib/egress.mjs";
import http from "node:http";
import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  readdirSync,
  statSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.FLUX_DATA_DIR || path.join(ROOT, "data");
const BIN = path.join(ROOT, "bin");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const ACCESS_USERNAME = process.env.FLUX_ACCESS_USERNAME || "flux";
const ACCESS_PASSWORD = process.env.FLUX_ACCESS_PASSWORD || "";
// Public mode: set FLUX_PUBLIC_OPEN=1 to let anyone on the internet use the site
// without the shared password. Per-visitor rate limits and queue isolation apply.
const PUBLIC_OPEN = process.env.FLUX_PUBLIC_OPEN === "1";
// Local mode is used by the desktop app: the only visitor is the person running Flux
// on their own machine, so no sign-in is needed for full downloads. It is honoured
// only when the server listens on the loopback interface.
const LOCAL_MODE =
  process.env.FLUX_LOCAL_MODE === "1" &&
  (process.env.HOST || "127.0.0.1") === "127.0.0.1";
const MAX_CONCURRENT = Math.max(
  1,
  Number(process.env.FLUX_MAX_CONCURRENT || 2),
);
const MAX_FILESIZE = process.env.FLUX_MAX_FILESIZE || "8G";
const MAX_JOB_BYTES = Math.max(
  1048576,
  Number(process.env.FLUX_MAX_JOB_BYTES || 4 * 1024 ** 3),
);
const RETENTION_HOURS = Math.max(
  1,
  Number(process.env.FLUX_RETENTION_HOURS || 24),
);
const INSPECT_PER_10MIN = Math.max(
  1,
  Number(process.env.FLUX_INSPECT_PER_10MIN || 40),
);
const JOBS_PER_HOUR = Math.max(1, Number(process.env.FLUX_JOBS_PER_HOUR || 15));
const ACTIVE_PER_VISITOR = Math.max(
  1,
  Number(process.env.FLUX_ACTIVE_PER_VISITOR || 6),
);
const rl = new Map();
function clientIp(req) {
  const fwd =
    process.env.FLUX_TRUST_PROXY === "1"
      ? String(req.headers["x-forwarded-for"] || "")
          .split(",")
          .at(-1)
          .trim()
      : "";
  if (fwd) return fwd.slice(0, 64);
  return req.socket?.remoteAddress || "unknown";
}
function rateLimit(ip, key, max, windowMs) {
  const now = Date.now();
  const k = ip + ":" + key;
  let e = rl.get(k);
  if (!e || now > e.reset) e = { count: 0, reset: now + windowMs };
  e.count++;
  rl.set(k, e);
  if (rl.size > 5000)
    for (const [key2, v] of rl) if (now > v.reset) rl.delete(key2);
  return e.count <= max ? 0 : Math.ceil((e.reset - now) / 1000);
}
const ORIGIN = process.env.FLUX_ORIGIN || `http://localhost:${PORT}`;
const MAX_DURATION = Number(process.env.FLUX_MAX_DURATION || 7200);
let egress;
const auth = createAuth({ dataDir: DATA, origin: ORIGIN });
const executable = (name, env) =>
  process.env[env] ||
  (existsSync(
    path.join(BIN, name + (process.platform === "win32" ? ".exe" : "")),
  )
    ? path.join(BIN, name + (process.platform === "win32" ? ".exe" : ""))
    : name);
const YTDLP = executable("yt-dlp", "YTDLP_PATH");
const FFMPEG = executable("ffmpeg", "FFMPEG_PATH");
const FFPROBE = executable("ffprobe", "FFPROBE_PATH");
const domains = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "tiktok.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "pinterest.com",
  "pin.it",
  "soundcloud.com",
  "radiojavan.com",
  "rj.app",
  "vimeo.com",
  "dailymotion.com",
  "dai.ly",
  "twitch.tv",
  "reddit.com",
  "redd.it",
  "facebook.com",
  "fb.watch",
  "archive.org",
  "wikimedia.org",
  "bilibili.com",
  "b23.tv",
  ...(process.env.FLUX_EXTRA_SOURCE_HOSTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9.-]+$/.test(s)),
];
const terminal = (j) =>
  ["completed", "failed", "cancelled", "expired"].includes(j.status);
const expired = (j) =>
  j?.finishedAt && Date.now() - j.finishedAt > RETENTION_HOURS * 3600000;
export function validateUrl(value) {
  if (typeof value !== "string" || value.length > 2048)
    throw new Error("Enter a valid media link.");
  let u;
  try {
    u = new URL(value.trim());
  } catch {
    throw new Error("Paste a full https:// media link.");
  }
  if (
    !["https:", "http:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !["80", "443"].includes(u.port))
  )
    throw new Error(
      "Use a public HTTP or HTTPS link without a login or custom port.",
    );
  if (
    ![...domains, "open.spotify.com"].some(
      (d) => u.hostname === d || u.hostname.endsWith("." + d),
    )
  )
    throw new Error(
      "This website is not supported. See the supported source logos below the download form.",
    );
  u.hash = "";
  return u.href;
}
export function optionsFor(input = {}) {
  const format = input.format || "mp4";
  const quality = String(input.quality || "best");
  const bitrate = String(input.bitrate || "320");
  if (!["mp4", "mp3"].includes(format)) throw new Error("Choose MP4 or MP3.");
  if (quality !== "best" && !/^[1-9][0-9]{1,3}$/.test(quality))
    throw new Error("Choose a listed resolution.");
  if (!["320", "256", "192", "128"].includes(bitrate))
    throw new Error("Choose a listed audio quality.");
  const language = String(input.language || "en");
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(language))
    throw new Error("Use a subtitle language code such as en, hi, or en-US.");
  return {
    format,
    quality,
    bitrate,
    subtitles: Boolean(input.subtitles),
    language,
  };
}
export function formatArgs(opts) {
  const transport = '[protocol~="^(https?|m3u8_native|http_dash_segments)$"]';
  if (opts.format === "mp3")
    return [
      "-f",
      `bestaudio${transport}/best${transport}`,
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      opts.bitrate + "K",
    ];
  const filter = opts.quality === "best" ? "" : `[height<=${opts.quality}]`;
  return [
    "-f",
    `bestvideo${filter}${transport}+bestaudio${transport}/best${filter}${transport}`,
    "--merge-output-format",
    "mp4",
    "--remux-video",
    "mp4",
  ];
}
const common = () => [
  "--proxy",
  egress.url,
  "--hls-prefer-native",
  "--ignore-config",
  "--no-colors",
  "--no-warnings",
  "--socket-timeout",
  "25",
  "--retries",
  "3",
  "--no-check-formats",
  "--js-runtimes",
  `node:${process.execPath}`,
  ...(process.env.FLUX_COOKIES_FILE
    ? ["--cookies", process.env.FLUX_COOKIES_FILE]
    : []),
  ...(process.env.FLUX_PO_TOKEN_URL
    ? [
        "--extractor-args",
        `youtube:player-client=mweb,web_safari;youtubepot-bgutilhttp:base_url=${process.env.FLUX_PO_TOKEN_URL}`,
      ]
    : []),
];
function run(
  args,
  { timeout = 90000, onLine, childRef, limit = 24 * 1024 * 1024 } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, {
      windowsHide: true,
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (childRef) childRef(child);
    let stdout = "",
      stderr = "",
      lineBuffer = "",
      done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      err ? reject(err) : resolve(stdout);
    };
    const timer = setTimeout(() => {
      stopProcess(child);
      finish(new Error("The source took too long to respond. Try again."));
    }, timeout);
    child.stdout.on("data", (data) => {
      stdout += data;
      lineBuffer += data;
      if (stdout.length > limit) {
        stopProcess(child);
        finish(new Error("The response is too large. Try a smaller playlist."));
        return;
      }
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop();
      for (const line of lines) onLine?.(line);
    });
    child.stderr.on("data", (data) => {
      stderr = (stderr + data).slice(-8000);
    });
    child.on("error", (e) =>
      finish(
        new Error(
          e.code === "ENOENT"
            ? "Download engine is not installed. Run npm run setup in the Flux folder."
            : e.message,
        ),
      ),
    );
    child.on("close", (code) => {
      if (lineBuffer) onLine?.(lineBuffer);
      finish(code === 0 ? null : new Error(cleanError(stderr)));
    });
  });
}
function stopProcess(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    killer.on("error", () => child.kill());
  } else {
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 2000).unref();
  }
}
function cleanError(s) {
  s = s.replace(/\u001b\[[0-9;]*m/g, "").trim();
  if (
    /sign in|login|cookies|private|age.restricted|confirm you.re not a bot/i.test(
      s,
    )
  )
    return "This source requires a signed-in session or is restricting automated downloads. Try a public link, or configure your own cookies file in the server settings.";
  if (/unsupported url/i.test(s))
    return "This link is not supported by the download engine. Try a direct video or track link.";
  if (/(?:HTTP Error|status code) 403|403 Forbidden/i.test(s))
    return "The source denied this download (HTTP 403). YouTube may need its current Proof of Origin token, or may be blocking the download server’s IP. Docker deployments can enable the token provider; this does not guarantee every video will be available.";
  if (/ffmpeg|ffprobe/i.test(s))
    return "FFmpeg could not process this download. Run npm run setup and retry.";
  console.error("Extractor failed:", s);
  if (/format.*not available/i.test(s))
    return "The requested format is unavailable. Choose a different quality.";
  return "The source is unavailable or did not provide an accessible media stream. Try another link.";
}
const summarize = (data) => ({
  id: data.id,
  title: data.title || "Untitled media",
  url: data.webpage_url || data.original_url || data.url,
  thumbnail: data.thumbnail || data.thumbnails?.at(-1)?.url,
  duration: data.duration,
  creator: data.uploader || data.channel || data.artist,
  platform: data.extractor_key || data.extractor || data.ie_key,
  heights: [
    ...new Set(
      (data.formats || [])
        .filter((f) => f.vcodec && f.vcodec !== "none")
        .map((f) => f.height)
        .filter(Boolean),
    ),
  ].sort((a, b) => b - a),
  audioOnly: Boolean(
    data.formats?.length && data.formats.every((f) => f.vcodec === "none"),
  ),
  live: data.is_live,
});
const jobs = new Map();
const children = new Map();
let running = 0;
let inspectCount = 0;
let engineStatus;
function persist() {
  mkdirSync(DATA, { recursive: true });
  const p = path.join(DATA, "jobs.json");
  writeFileSync(
    p + ".tmp",
    JSON.stringify([...jobs.values()].map(({ ip, ...rest }) => rest)),
  );
  renameSync(p + ".tmp", p);
}
function publicJob(job) {
  const { filePaths, ip, owner, ...safe } = job;
  return {
    ...safe,
    expiresAt:
      job.status === "completed" && job.finishedAt
        ? job.finishedAt + RETENTION_HOURS * 3600000
        : null,
    files: (job.status === "completed" ? filePaths || [] : []).map((f, i) => ({
      name: path.basename(f),
      size: existsSync(f) ? statSync(f).size : 0,
      url: `/api/jobs/${job.id}/files/${i}`,
    })),
  };
}
async function download(job) {
  job.status = "processing";
  job.stage = "Connecting to source";
  job.progress = null;
  job.speed = null;
  job.eta = null;
  job.error = null;
  persist();
  const dir = path.join(DATA, job.id);
  mkdirSync(dir, { recursive: true });
  let exceeded = false;
  const quotaTimer = setInterval(() => {
    try {
      let bytes = 0;
      const walk = (folder) => {
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
          const target = path.join(folder, entry.name);
          if (entry.isDirectory()) walk(target);
          else bytes += statSync(target).size;
        }
      };
      walk(dir);
      if (bytes > MAX_JOB_BYTES) {
        exceeded = true;
        stopProcess(children.get(job.id));
      }
    } catch {
      /* Files may move while the engine merges streams. */
    }
  }, 1000);
  quotaTimer.unref();
  const args = [
    ...common(),
    "--no-playlist",
    "--newline",
    "--progress",
    "--progress-delta",
    "0.5",
    "--progress-template",
    "download:FLUX_PROGRESS:%(progress)j",
    "--print",
    "before_dl:FLUX_META:%(title)j",
    "--print",
    "after_move:FLUX_FILE:%(filepath)j",
    "--no-simulate",
    "--windows-filenames",
    "--trim-filenames",
    "170",
    "--max-filesize",
    MAX_FILESIZE,
    "--concurrent-fragments",
    "5",
    ...(FFMPEG === "ffmpeg" ? [] : ["--ffmpeg-location", FFMPEG]),
    "-o",
    path.join(dir, "%(title).140B [%(id)s].%(ext)s"),
    ...formatArgs(job.options),
    "--embed-metadata",
  ];
  if (job.options.subtitles && job.options.format === "mp4")
    args.push(
      "--write-subs",
      "--write-auto-subs",
      "--sub-langs",
      job.options.language,
      "--embed-subs",
    );
  args.push("--", job.url);
  try {
    const metadata = await inspect({ url: job.url });
    if (metadata.type !== "media")
      throw new Error("Choose an individual media item before downloading.");
    previewDuration(metadata.duration, metadata.live, MAX_DURATION);
    Object.assign(job, {
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      platform: metadata.platform,
      creator: metadata.creator,
    });
    if (job.status === "cancelled") return;
    job.status = "downloading";
    await run(args, {
      timeout: 2 * 60 * 60 * 1000,
      limit: 64 * 1024 * 1024,
      childRef: (child) => children.set(job.id, child),
      onLine: (line) => {
        if (job.status === "cancelled") return;
        try {
          if (line.startsWith("FLUX_PROGRESS:")) {
            const p = JSON.parse(line.slice(14));
            job.progress =
              p.total_bytes || p.total_bytes_estimate
                ? Math.min(
                    99,
                    Math.max(
                      0,
                      Math.round(
                        ((p.downloaded_bytes || 0) /
                          (p.total_bytes || p.total_bytes_estimate)) *
                          100,
                      ),
                    ),
                  )
                : null;
            job.speed = p.speed;
            job.eta = p.eta;
            job.stage =
              p.status === "finished"
                ? "Merging and converting"
                : "Downloading";
          } else if (line.startsWith("FLUX_META:")) {
            job.title = JSON.parse(line.slice(10));
          } else if (line.startsWith("FLUX_FILE:")) {
            const file = path.resolve(JSON.parse(line.slice(10)));
            if (
              file.startsWith(path.resolve(dir) + path.sep) &&
              existsSync(file)
            )
              job.filePaths = [file];
          }
        } catch {
          /* Other downloader output is not a progress record. */
        }
      },
    });
    if (job.status !== "cancelled") {
      if (!job.filePaths?.length)
        throw new Error("The source returned no downloadable media file.");
      const source = job.filePaths[0];
      if (statSync(source).size > MAX_JOB_BYTES)
        throw new Error(
          "This download exceeded the server storage limit. Try a lower quality.",
        );
      if (job.mode === "preview") {
        job.status = "processing";
        job.stage = "Creating your 50% preview";
        job.progress = null;
        persist();
        const output = path.join(dir, `preview.${job.options.format}`);
        job.outputDuration = await makePreview({
          ffmpeg: FFMPEG,
          ffprobe: FFPROBE,
          source,
          output,
          duration: job.duration,
          format: job.options.format,
          bitrate: job.options.bitrate,
          onChild: (child) => children.set(job.id, child),
        });
        if (job.status === "cancelled") return;
        job.filePaths = [output];
        for (const name of readdirSync(dir))
          if (path.join(dir, name) !== output)
            rmSync(path.join(dir, name), { recursive: true, force: true });
      } else {
        const info = await probeMedia(FFPROBE, source);
        if (!info.streams?.length || !Number(info.format?.duration))
          throw new Error("The source did not produce a playable media file.");
        job.outputDuration = Number(info.format.duration);
      }
      job.speed = null;
      job.eta = null;
      job.status = "completed";
      job.progress = 100;
      job.stage = job.mode === "preview" ? "Preview ready" : "Ready to save";
    }
  } catch (e) {
    if (job.status !== "cancelled") {
      job.status = "failed";
      job.failedStep = job.stage || "Connecting to source";
      job.error = exceeded
        ? "This download exceeded the server storage limit. Try a lower quality."
        : e.code
          ? "The server could not process this file. Please try again."
          : e.message;
      job.stage = "Download failed";
    }
  } finally {
    clearInterval(quotaTimer);
    if (job.status !== "completed") {
      job.filePaths = [];
      rmSync(dir, { recursive: true, force: true });
    }
    children.delete(job.id);
    job.finishedAt = Date.now();
    persist();
    running--;
    pump();
  }
}
function pump() {
  for (const job of jobs.values())
    if (running < MAX_CONCURRENT && job.status === "queued") {
      running++;
      void download(job);
    }
}
async function probe(command, args) {
  return new Promise((resolve) => {
    const p = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let output = "";
    const t = setTimeout(() => {
      p.kill();
      resolve(null);
    }, 8000);
    p.stdout.on("data", (d) => (output += d));
    p.on("error", () => {
      clearTimeout(t);
      resolve(null);
    });
    p.on("close", (code) => {
      clearTimeout(t);
      resolve(code === 0 ? output.split("\n")[0].trim() : null);
    });
  });
}
async function health() {
  if (!engineStatus || Date.now() - engineStatus.checkedAt > 15000) {
    const [ytdlp, ffmpeg, ffprobe] = await Promise.all([
      probe(YTDLP, ["--version"]),
      probe(FFMPEG, ["-version"]),
      probe(FFPROBE, ["-version"]),
    ]);
    engineStatus = {
      ready: Boolean(ytdlp && ffmpeg && ffprobe),
      ytdlp,
      ffmpeg,
      ffprobe,
      checkedAt: Date.now(),
      cookiesConfigured: Boolean(process.env.FLUX_COOKIES_FILE),
    };
  }
  return engineStatus;
}
async function inspect(input) {
  if (inspectCount >= 3)
    throw Object.assign(
      new Error("Please wait for the current link checks to finish."),
      { status: 429 },
    );
  inspectCount++;
  try {
    if (input.search) {
      const query = String(input.search).trim().slice(0, 200);
      if (query.length < 2) throw new Error("Enter a video or song title.");
      const data = JSON.parse(
        await run([
          ...common(),
          "--dump-single-json",
          "--flat-playlist",
          "--playlist-end",
          "6",
          "--",
          `ytsearch6:${query}`,
        ]),
      );
      return {
        type: "search",
        title: `Results for “${query}”`,
        entries: (data.entries || []).filter(Boolean).map(summarize),
      };
    }
    const url = validateUrl(input.url);
    if (new URL(url).hostname === "open.spotify.com") {
      const response = await fetch(
        "https://open.spotify.com/oembed?url=" + encodeURIComponent(url),
        { signal: AbortSignal.timeout(20000) },
      );
      if (!response.ok)
        throw new Error(
          "Spotify could not share this link’s metadata. Search by song and artist instead.",
        );
      const data = await response.json();
      return {
        type: "spotify",
        title: data.title,
        thumbnail: data.thumbnail_url,
        search: data.title,
      };
    }
    const isPlaylist =
      Boolean(input.playlist) ||
      (() => {
        try {
          const u = new URL(url);
          const host = u.hostname.toLowerCase();
          if (host.includes("youtube.com") || host.includes("youtu.be")) {
            if (u.pathname.includes("/playlist")) return true;
            if (u.searchParams.has("list") && !u.searchParams.has("v"))
              return true;
          }
          if (host.includes("soundcloud.com") && u.pathname.includes("/sets/"))
            return true;
        } catch {}
        return false;
      })();
    const data = JSON.parse(
      await run([
        ...common(),
        "--dump-single-json",
        ...(isPlaylist
          ? ["--flat-playlist", "--playlist-end", "100"]
          : ["--no-playlist"]),
        "--",
        url,
      ]),
    );
    if (data.entries)
      return {
        type: "playlist",
        title: data.title,
        entries: data.entries.filter(Boolean).map(summarize),
        limit: 100,
      };
    if (data.is_live)
      throw new Error(
        "Live streams are not supported. Use a finished video or replay.",
      );
    return { type: "media", ...summarize(data), url };
  } finally {
    inspectCount--;
  }
}
function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let s = "";
  for await (const chunk of req) {
    s += chunk;
    if (s.length > 65536)
      throw Object.assign(new Error("Request too large."), { status: 413 });
  }
  try {
    return JSON.parse(s);
  } catch {
    throw new Error("Invalid request.");
  }
}
function secureEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
const types = {
  ".png": "image/png",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};
export function createServer() {
  mkdirSync(DATA, { recursive: true });
  if (existsSync(path.join(DATA, "jobs.json"))) {
    try {
      for (const job of JSON.parse(
        readFileSync(path.join(DATA, "jobs.json"), "utf8"),
      )) {
        if (!terminal(job)) {
          job.status = "failed";
          job.error =
            "The server restarted before this download finished. Retry to continue.";
          job.finishedAt = Date.now();
        }
        jobs.set(job.id, job);
      }
    } catch {
      console.error("Could not restore download history.");
    }
  }
  const proxyReady = createEgressProxy().then((proxy) => {
    egress = proxy;
  });
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' https: data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    try {
      // Loopback by default. Host and Origin checks also block DNS rebinding and cross-site requests.
      const allowedHosts = new Set(
        [
          `localhost:${PORT}`,
          `127.0.0.1:${PORT}`,
          process.env.FLUX_PUBLIC_HOST,
        ].filter(Boolean),
      );
      if (!allowedHosts.has(req.headers.host))
        return json(res, 403, { error: "This host is not allowed." });
      if (
        req.headers.origin &&
        new URL(req.headers.origin).host !== req.headers.host
      )
        return json(res, 403, {
          error: "Cross-site requests are not allowed.",
        });
      const url = new URL(req.url, "http://localhost");
      const route = url.pathname;
      if (rateLimit(clientIp(req), "requests", 600, 60000))
        return json(res, 429, {
          error: "Too many requests. Please wait a minute.",
        });
      if (ACCESS_PASSWORD && !PUBLIC_OPEN) {
        const match = String(req.headers.authorization || "").match(
          /^Basic\s+([A-Za-z0-9+/=]+)$/,
        );
        let credentials = "";
        try {
          if (match)
            credentials = Buffer.from(match[1], "base64").toString("utf8");
        } catch {}
        const split = credentials.indexOf(":");
        if (
          split < 0 ||
          !secureEqual(credentials.slice(0, split), ACCESS_USERNAME) ||
          !secureEqual(credentials.slice(split + 1), ACCESS_PASSWORD)
        ) {
          res.setHeader(
            "WWW-Authenticate",
            'Basic realm="Flux", charset="UTF-8"',
          );
          return json(res, 401, {
            error: "Enter the Flux access password to continue.",
          });
        }
      }
      await proxyReady;
      const context = auth.get(req, res),
        session = context.session;
      if (LOCAL_MODE && !session.user)
        session.user = { id: "local", name: "You", email: "", picture: null };
      const owner = ownerOf(session);
      if (route === "/auth/google" && req.method === "GET")
        return await auth.start(context, res);
      if (route === "/auth/google/callback" && req.method === "GET")
        return await auth.callback(context, url, res, (from, to) => {
          for (const job of jobs.values())
            if (job.owner === from) job.owner = to;
          persist();
        });
      if (route === "/api/session" && req.method === "GET")
        return json(res, 200, {
          token: session.csrf,
          user: session.user,
          googleConfigured: auth.configured,
          public: PUBLIC_OPEN,
          retentionHours: RETENTION_HOURS,
          serverTime: Date.now(),
        });
      if (route.startsWith("/api/") && req.method !== "GET") {
        if (!equal(req.headers["x-flux-token"], session.csrf))
          return json(res, 403, {
            error: "Your session changed. Refresh the page and try again.",
          });
      }
      if (route === "/api/logout" && req.method === "POST") {
        auth.logout(context, res);
        return json(res, 200, { ok: true });
      }
      if (route === "/api/platforms" && req.method === "GET")
        return json(res, 200, platforms);
      if (route === "/api/health" && req.method === "GET")
        return json(res, 200, await health());
      if (route === "/api/inspect" && req.method === "POST") {
        if (true) {
          const wait = rateLimit(
            clientIp(req),
            "inspect",
            INSPECT_PER_10MIN,
            600000,
          );
          if (wait) {
            res.setHeader("Retry-After", wait);
            throw Object.assign(
              new Error("Too many link checks. Wait a minute and try again."),
              { status: 429 },
            );
          }
        }
        return json(res, 200, await inspect(await body(req)));
      }
      if (route === "/api/jobs" && req.method === "GET") {
        const ip = clientIp(req);
        return json(
          res,
          200,
          [...jobs.values()]
            .reverse()
            .filter((j) => j.owner === owner)
            .map(publicJob),
        );
      }
      if (route === "/api/jobs" && req.method === "POST") {
        const data = await body(req);
        const opts = optionsFor(data.options);
        const mode = authorizeMode(session, data.mode);
        if (data.authorized !== true)
          throw new Error(
            "Confirm that you are authorized to save this media.",
          );
        const ip = clientIp(req);
        if (ip) {
          const wait = rateLimit(ip, "jobs", JOBS_PER_HOUR, 3600000);
          if (wait) {
            res.setHeader("Retry-After", wait);
            throw Object.assign(
              new Error(
                "Too many downloads from your address. Try again later.",
              ),
              { status: 429 },
            );
          }
        }
        if (
          !Array.isArray(data.items) ||
          !data.items.length ||
          data.items.length > 100
        )
          throw new Error("Choose between 1 and 100 items.");
        if (
          [...jobs.values()].filter((j) => !terminal(j)).length +
            data.items.length >
          100
        )
          throw new Error(
            "The queue is full. Wait for some downloads to finish.",
          );
        if (
          ip &&
          [...jobs.values()].filter((j) => !terminal(j) && j.owner === owner)
            .length +
            data.items.length >
            ACTIVE_PER_VISITOR
        )
          throw Object.assign(
            new Error(
              "You have too many active downloads. Wait for them to finish.",
            ),
            { status: 429 },
          );
        const items = data.items.map((item) => ({
          url: validateUrl(item.url),
          title: "Preparing your media",
          thumbnail: null,
        }));
        if (items.some((i) => new URL(i.url).hostname === "open.spotify.com"))
          throw new Error(
            "Choose a YouTube match for your Spotify track first.",
          );
        if (!(await health()).ready)
          throw Object.assign(
            new Error(
              "The download tools are missing. Open Engine setup for the one-time installation.",
            ),
            { status: 503 },
          );
        // Recheck after the asynchronous health probe; concurrent requests may
        // have reserved the remaining slots while it was running.
        if (
          [...jobs.values()].filter((j) => !terminal(j)).length + items.length >
            100 ||
          [...jobs.values()].filter((j) => !terminal(j) && j.owner === owner)
            .length +
            items.length >
            ACTIVE_PER_VISITOR
        )
          throw Object.assign(
            new Error(
              "The queue is full. Wait for your active downloads to finish.",
            ),
            { status: 429 },
          );
        const added = items.map((item) => ({
          id: randomUUID(),
          ...item,
          options: opts,
          ip,
          owner,
          mode,
          status: "queued",
          stage: "Waiting in queue",
          progress: 0,
          createdAt: Date.now(),
        }));
        added.forEach((job) => jobs.set(job.id, job));
        persist();
        pump();
        return json(res, 201, added.map(publicJob));
      }
      const fileMatch = route.match(
        /^\/api\/jobs\/([a-f0-9-]+)\/files\/(\d+)$/,
      );
      if (fileMatch && req.method === "GET") {
        const job = jobs.get(fileMatch[1]);
        const f = job?.filePaths?.[Number(fileMatch[2])];
        if (
          job &&
          (job.owner !== owner || (job.mode === "full" && !session.user))
        )
          return json(res, 404, { error: "This file is no longer available." });
        if (
          job?.status !== "completed" ||
          expired(job) ||
          !f ||
          !f.startsWith(path.resolve(DATA, job.id) + path.sep) ||
          !existsSync(f)
        )
          return json(res, 404, { error: "This file is no longer available." });
        const size = statSync(f).size;
        const contentType = f.endsWith(".mp3") ? "audio/mpeg" : "video/mp4";
        const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(f)).replace(/'/g, "%27")}`;
        const range = req.headers.range;
        if (range) {
          const match = range.match(/^bytes=(\d*)-(\d*)$/);
          if (match) {
            let start = match[1] ? parseInt(match[1], 10) : 0;
            let end = match[2] ? parseInt(match[2], 10) : size - 1;
            if (start > end || start >= size) {
              res.writeHead(416, { "Content-Range": `bytes */${size}` });
              return res.end();
            }
            res.writeHead(206, {
              "Content-Type": contentType,
              "Content-Range": `bytes ${start}-${end}/${size}`,
              "Content-Length": end - start + 1,
              "Content-Disposition": disposition,
              "Accept-Ranges": "bytes",
              "Cache-Control": "no-store",
            });
            const stream = createReadStream(f, { start, end });
            stream.on("error", () => res.destroy());
            res.on("close", () => stream.destroy());
            return stream.pipe(res);
          }
        }
        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": size,
          "Content-Disposition": disposition,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
        });
        const stream = createReadStream(f);
        stream.on("error", () => res.destroy());
        res.on("close", () => stream.destroy());
        return stream.pipe(res);
      }
      const actionMatch = route.match(
        /^\/api\/jobs\/([a-f0-9-]+)\/(cancel|retry)$/,
      );
      if (actionMatch && req.method === "POST") {
        const job = jobs.get(actionMatch[1]);
        if (!job) return json(res, 404, { error: "Download not found." });
        if (job.owner !== owner || (job.mode === "full" && !session.user))
          return json(res, 404, { error: "Download not found." });
        if (actionMatch[2] === "cancel" && !terminal(job)) {
          job.status = "cancelled";
          job.stage = "Cancelled";
          job.finishedAt = Date.now();
          stopProcess(children.get(job.id));
        }
        if (
          actionMatch[2] === "retry" &&
          ["failed", "cancelled", "expired"].includes(job.status)
        ) {
          if (rateLimit(clientIp(req), "jobs", JOBS_PER_HOUR, 3600000))
            throw Object.assign(
              new Error("Too many requests. Try again later."),
              { status: 429 },
            );
          if (
            [...jobs.values()].filter((j) => !terminal(j) && j.owner === owner)
              .length >= ACTIVE_PER_VISITOR ||
            [...jobs.values()].filter((j) => !terminal(j)).length >= 100
          )
            throw Object.assign(new Error("The queue is full. Please wait."), {
              status: 429,
            });
          if (children.has(job.id))
            throw new Error("Please wait a moment for cancellation to finish.");
          job.status = "queued";
          job.error = null;
          job.progress = 0;
          delete job.finishedAt;
          delete job.failedStep;
        }
        persist();
        pump();
        return json(res, 200, publicJob(job));
      }
      if (route === "/api/jobs/clear" && req.method === "POST") {
        const ip = clientIp(req);
        for (const [id, job] of jobs)
          if (terminal(job) && !children.has(id) && job.owner === owner) {
            rmSync(path.join(DATA, id), { recursive: true, force: true });
            jobs.delete(id);
          }
        persist();
        return json(res, 200, { ok: true });
      }
      if (req.method !== "GET" || route.startsWith("/api/"))
        return json(res, 404, { error: "Not found." });
      const filename = route === "/" ? "index.html" : route.slice(1);
      if (
        ![
          "index.html",
          "styles.css",
          "app.js",
          "api.js",
          "icons.js",
          "components.js",
          "platform-icons.js",
          "radiojavan.png",
          "favicon.svg",
        ].includes(filename)
      )
        return json(res, 404, { error: "Not found." });
      const f = path.join(ROOT, "public", filename);
      res.writeHead(200, {
        "Content-Type": types[path.extname(f)],
        "Cache-Control": "no-cache",
      });
      createReadStream(f).pipe(res);
    } catch (e) {
      if (!res.headersSent)
        json(res, e.status || (e.code ? 500 : 400), {
          error: e.code
            ? "The server could not complete this request. Please try again."
            : e.message,
        });
      else res.destroy();
    }
  });
  const cleanup = setInterval(() => {
    let changed = false;
    for (const [id, job] of jobs)
      if (
        terminal(job) &&
        job.status !== "expired" &&
        job.finishedAt &&
        Date.now() - job.finishedAt > RETENTION_HOURS * 3600000 &&
        !children.has(id)
      ) {
        rmSync(path.join(DATA, id), { recursive: true, force: true });
        job.filePaths = [];
        job.status = "expired";
        job.stage = "Expired";
        changed = true;
      }
    if (changed) persist();
  }, 60000);
  cleanup.unref();
  server.on("close", () => {
    clearInterval(cleanup);
    egress?.close();
  });
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (HOST !== "127.0.0.1" && !process.env.FLUX_PUBLIC_HOST)
    throw new Error(
      "Set FLUX_PUBLIC_HOST before exposing Flux on the internet.",
    );
  if (HOST !== "127.0.0.1" && !ACCESS_PASSWORD && !PUBLIC_OPEN)
    throw new Error(
      "Set FLUX_ACCESS_PASSWORD, or set FLUX_PUBLIC_OPEN=1 to run an open public site (rate-limited, per-visitor queues).",
    );
  const server = createServer();
  server.listen(PORT, HOST, () =>
    console.log(`Flux is running at http://localhost:${PORT}`),
  );
  const shutdown = () => {
    for (const child of children.values()) stopProcess(child);
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
