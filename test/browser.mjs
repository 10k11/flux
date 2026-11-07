import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const sample = {
  type: "media",
  url: "https://www.youtube.com/watch?v=fixture",
  title: "An afternoon outside",
  duration: 600,
  creator: "Test creator",
  platform: "YouTube",
  heights: [1080, 720],
};
let jobs = [],
  posted;
await page.route("**/api/jobs", (route) => {
  if (route.request().method() === "POST") {
    posted = route.request().postDataJSON();
    jobs = [
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        title: sample.title,
        platform: "YouTube",
        duration: 600,
        mode: posted.mode,
        options: posted.options,
        status: "downloading",
        stage: "Downloading",
        progress: 42,
        createdAt: Date.now(),
        files: [],
      },
    ];
    return route.fulfill({ status: 201, json: jobs });
  }
  return route.fulfill({ json: jobs });
});
await page.goto(process.env.FLUX_TEST_URL || "http://localhost:3000");
await page
  .locator("#sidebar-name")
  .filter({ hasText: "Guest workspace" })
  .waitFor();
assert.equal(await page.locator("#preferences").isVisible(), false);
await page.locator(".platform-brand").nth(14).waitFor();
assert.equal(
  await page.locator(".brand-symbol").getAttribute("src"),
  "/favicon.svg",
);
assert.equal(await page.locator("[data-view=platforms]").count(), 0);
assert.equal(
  await page.locator("#engine-button, #engine-dialog, .engine-status").count(),
  0,
);
assert.equal(await page.locator(".brand").innerText(), "flux.");
await page.locator("#media-url").fill("https://youtu.be/abc123");
assert.equal(await page.locator("body").getAttribute("data-source"), "youtube");
assert.equal(
  await page.locator("body").getAttribute("data-theme-mode"),
  "light",
);
assert.equal(await page.locator("#source-identity").count(), 0);
assert.equal(await page.locator("#theme-flash").isHidden(), false);
assert.equal(await page.locator("#theme-flash").innerText(), "");
assert.equal(
  await page.locator("#view-studio .page-heading .eyebrow").innerText(),
  "FLUX WORKSPACE",
);
assert.equal(
  await page
    .locator("body")
    .evaluate((el) => getComputedStyle(el).getPropertyValue("--accent").trim()),
  "#bd242c",
);
await page.locator("#media-url").fill("https://www.instagram.com/reel/abc123/");
assert.equal(
  await page.locator("body").getAttribute("data-source"),
  "instagram",
);
assert.equal(
  await page
    .locator("body")
    .evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--display-font").trim(),
    ),
  "Georgia, 'Times New Roman', serif",
);
await page
  .locator("#media-url")
  .fill("https://www.tiktok.com/@creator/video/123");
assert.equal(
  await page.locator("body").getAttribute("data-theme-mode"),
  "dark",
);
assert.equal(
  await page
    .locator("body")
    .evaluate((el) => getComputedStyle(el).getPropertyValue("--canvas").trim()),
  "#111217",
);
await page
  .locator("#media-url")
  .fill("https://youtube.com.evil.test/watch?v=123");
assert.equal(await page.locator("body").getAttribute("data-source"), "default");
await page.locator("#tab-batch").click();
await page
  .locator("#media-url")
  .fill("https://youtu.be/abc\nhttps://tiktok.com/@creator/video/123");
assert.equal(await page.locator("body").getAttribute("data-source"), "default");
await page.locator("#tab-single").click();
await page.locator("#media-url").fill("not a URL");
await page.locator("#media-url").press("Enter");
await page.locator("#source-message.error").waitFor();
assert.match(await page.locator("#source-message").innerText(), /full URL/);
await page.locator("#media-url").fill("http://127.0.0.1/private");
await page.locator("#inspect-button").click();
await page.locator("#source-message.error").waitFor();
assert.match(
  await page.locator("#source-message").innerText(),
  /not supported/,
);
await page.route("**/api/inspect", (route) => route.fulfill({ json: sample }));
await page.locator("#media-url").fill(sample.url);
await page.locator("#media-url").press("Enter");
await page.locator(".result-item").waitFor();
assert.equal(await page.locator("#quality option").count(), 3);
await page.locator('[data-format="mp3"]').click();
assert.equal(await page.locator("#quality").inputValue(), "192");
assert.equal(await page.locator("#subtitles").isDisabled(), true);
await page.locator('[data-format="mp4"]').click();
assert.equal(await page.locator("#quality").inputValue(), "best");
await page.locator("#full-download").click();
await page.locator("#auth-dialog").waitFor();
const authConfigured = await page.evaluate(async () => {
  const r = await fetch("/api/session");
  const s = await r.json();
  return Boolean(s.googleConfigured);
});
assert.equal(
  await page
    .locator(authConfigured ? "#google-continue" : "#auth-config-note")
    .isVisible(),
  true,
);
await page.keyboard.press("Escape");
assert.equal(
  await page
    .locator("#full-download")
    .evaluate((el) => el === document.activeElement),
  true,
);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({
  path: "flux/test-results/media-found.png",
  fullPage: true,
});
await page.locator("#permission").check();
await page.locator("#quality").selectOption("720");
await page.locator("#download-button").click();
await page.locator("#all-jobs .job-row").waitFor();
assert.equal(posted.mode, "preview");
assert.equal(posted.options.quality, "720");
assert.equal(posted.authorized, true);
jobs[0] = {
  ...jobs[0],
  status: "completed",
  progress: 100,
  outputDuration: 300,
  files: [
    {
      name: "preview.mp4",
      size: 20000,
      url: "/api/jobs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/files/0",
    },
  ],
};
await page.locator("#all-jobs .save-button").waitFor();
assert.match(await page.locator("#all-jobs").innerText(), /Preview ready/);
await page.screenshot({
  path: "flux/test-results/library.png",
  fullPage: true,
});
for (const width of [1440, 1280, 1024, 768, 390, 320]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(250);
  for (const view of ["studio", "queue", "history"]) {
    await page.evaluate((view) => {
      location.hash = view;
    }, view);
    await page.waitForTimeout(100);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${width}px ${view}`,
    );
  }
  await page.locator("#account-button").click();
  await page.locator("#auth-dialog").waitFor();
  assert.equal(
    await page
      .locator("#auth-dialog")
      .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
    true,
  );
  await page.keyboard.press("Escape");
}
await page.setViewportSize({ width: 390, height: 844 });
await page.locator("#menu-toggle").click();
await page.locator(".sidebar.open").waitFor();
await page.locator('.sidebar [data-view="studio"]').click();
assert.equal(await page.locator(".sidebar.open").count(), 0);
await page.waitForTimeout(250);
await page.screenshot({
  path: "flux/test-results/mobile-found.png",
  fullPage: true,
});
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "PASS: real guest session + URL rejection; fixture metadata, quality, preview queue, library; dialog keyboard/focus; 18 responsive page checks; zero JS errors.",
);
