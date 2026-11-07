// Regenerates the README screenshots in docs/screenshots using fixture data.
// Usage: start Flux (npm start), then: node scripts/screenshots.mjs
import { mkdirSync } from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.FLUX_TEST_URL || "http://localhost:3000";
const out = "docs/screenshots";
mkdirSync(out, { recursive: true });

const sample = {
  type: "media",
  url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  title: "Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film",
  duration: 635,
  creator: "Blender",
  platform: "YouTube",
  heights: [2160, 1080, 720, 480, 360],
};
const id = (n) => `aaaaaaaa-aaaa-aaaa-aaaa-${String(n).padStart(12, "0")}`;
const file = (n, name, size) => ({ name, size, url: `/api/jobs/${id(n)}/files/0` });
const now = Date.now();
const jobs = [
  { id: id(1), title: sample.title, platform: "YouTube", duration: 635, mode: "preview",
    options: { format: "mp4", quality: "1080" }, status: "downloading", stage: "Downloading",
    progress: 63, createdAt: now - 20000, files: [] },
  { id: id(2), title: "Sintel - Third Open Movie by Blender Foundation", platform: "YouTube",
    duration: 888, mode: "preview", options: { format: "mp4", quality: "720" },
    status: "completed", progress: 100, outputDuration: 444, createdAt: now - 600000,
    files: [file(2, "Sintel.mp4", 48234112)] },
  { id: id(3), title: "Tears of Steel - Blender VFX Open Movie", platform: "YouTube",
    duration: 734, mode: "preview", options: { format: "mp3", bitrate: "192" },
    status: "completed", progress: 100, outputDuration: 367, createdAt: now - 3600000,
    files: [file(3, "Tears of Steel.mp3", 8812544)] },
  { id: id(4), title: "Elephants Dream - First Open Movie", platform: "Vimeo", duration: 654,
    mode: "preview", options: { format: "mp4", quality: "best" }, status: "queued",
    stage: "Queued", progress: null, createdAt: now - 5000, files: [] },
];

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
async function open(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1.5, ...opts });
  const page = await ctx.newPage();
  await page.route("**/api/inspect", (r) => r.fulfill({ json: sample }));
  let list = [];
  await page.route("**/api/jobs", (r) =>
    r.request().method() === "POST" ? r.fulfill({ status: 201, json: list }) : r.fulfill({ json: list }));
  page.setList = (l) => (list = l);
  await page.goto(base);
  await page.locator("#sidebar-name").filter({ hasText: "Guest workspace" }).waitFor();
  await page.locator(".platform-brand").nth(14).waitFor();
  return page;
}

// 1. Home / workspace (default theme)
let page = await open({ width: 1440, height: 900 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/home.png` });

// 2. Media found
await page.locator("#media-url").fill(sample.url);
await page.locator("#media-url").press("Enter");
await page.locator(".result-item").waitFor();
await page.waitForTimeout(1200);
await page.setViewportSize({ width: 1440, height: 1380 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/media-found.png` });
await page.setViewportSize({ width: 1440, height: 900 });

// 3. Source-aware theme (TikTok dark)
await page.locator("#media-url").fill("https://www.tiktok.com/@creator/video/123");
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${out}/theme-tiktok.png` });

// 4. Downloads queue + history
await page.setList(jobs);
await page.evaluate(() => (location.hash = "queue"));
await page.reload();
await page.locator("#all-jobs .job-row").first().waitFor();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/downloads.png` });
await page.evaluate(() => (location.hash = "history"));
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/history.png` });

// 5. Sign-in dialog
await page.evaluate(() => (location.hash = "studio"));
await page.locator("#account-button").click();
await page.locator("#auth-dialog").waitFor();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/sign-in.png` });
await page.context().close();

// 6. Mobile
page = await open({ width: 390, height: 844 }, { isMobile: true });
await page.locator("#media-url").fill(sample.url);
await page.locator("#media-url").press("Enter");
await page.locator(".result-item").waitFor();
await page.waitForTimeout(1200);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${out}/mobile.png` });

await browser.close();
console.log("Screenshots written to", out);
