import test from "node:test";
import assert from "node:assert/strict";
import { validateUrl, optionsFor, formatArgs } from "../server.mjs";
test("rejects local and deceptive URLs", () => {
  for (const u of [
    "http://127.0.0.1/x",
    "file:///etc/passwd",
    "https://youtube.com.evil.test/x",
    "https://u:p@youtube.com/x",
    "https://youtube.com:9999/x",
  ])
    assert.throws(() => validateUrl(u));
  assert.equal(validateUrl("https://youtu.be/abc#x"), "https://youtu.be/abc");
});
test("best video merges source streams without a resolution cap", () => {
  const args = formatArgs(optionsFor());
  assert.match(args[1], /^bestvideo/);
  assert.ok(!args[1].includes("height"));
  assert.match(args[1], /http_dash_segments/);
  assert.ok(args.includes("--remux-video"));
});
test("resolution cap also applies to the combined-stream fallback", () => {
  const selector = formatArgs(optionsFor({ quality: "1080" }))[1];
  assert.equal(selector.split("[height<=1080]").length - 1, 2);
  assert.match(selector, /protocol/);
});
test("MP3 converts the best audio at the selected bitrate", () => {
  const args = formatArgs(optionsFor({ format: "mp3", bitrate: "192" }));
  assert.match(args[1], /^bestaudio/);
  assert.deepEqual(args.slice(2), [
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "192K",
  ]);
});
test("rejects unsupported formats and arbitrary extractor arguments", () => {
  for (const o of [
    { format: "exe" },
    { quality: "garbage" },
    { bitrate: "999" },
    { language: "--exec" },
  ])
    assert.throws(() => optionsFor(o));
  assert.equal(optionsFor({ language: "en-US" }).language, "en-US");
});

test("validateUrl rejects look-alike hosts and userinfo", () => {
  for (const u of [
    "https://youtube.com.evil.test/",
    "https://evilyoutube.com/",
    "https://notyoutube.com/",
    "https://youtube.com@evil.test/",
    "https://user:pass@youtube.com/",
    "https://user@youtube.com/",
  ]) {
    assert.throws(() => validateUrl(u));
  }
  assert.equal(
    validateUrl("https://m.youtube.com/watch?v=abc"),
    "https://m.youtube.com/watch?v=abc",
  );
  assert.equal(validateUrl("https://youtu.be/abc"), "https://youtu.be/abc");
});

test("validateUrl rejects non-http(s) schemes", () => {
  for (const u of [
    "file:///etc/passwd",
    "ftp://youtube.com/file",
    "javascript:alert(1)",
    "data:text/html,<script>",
    "mailto:test@example.com",
    "ws://youtube.com/",
  ]) {
    assert.throws(() => validateUrl(u));
  }
});

test("validateUrl rejects IP-literal hosts", () => {
  for (const u of [
    "http://127.0.0.1/",
    "http://93.184.216.34/",
    "http://[::1]/",
    "http://[::1]:443/",
    "https://127.0.0.1/x",
  ]) {
    assert.throws(() => validateUrl(u));
  }
});

test("validateUrl accepts uppercase hosts after URL normalisation", () => {
  assert.equal(
    validateUrl("HTTPS://YOUTUBE.COM/watch?v=abc"),
    "https://youtube.com/watch?v=abc",
  );
  assert.equal(
    validateUrl("HTTP://M.YOUTUBE.COM/watch"),
    "http://m.youtube.com/watch",
  );
});

test("validateUrl rejects hosts with a trailing dot", () => {
  for (const u of [
    "https://youtube.com./",
    "https://youtube.com./watch?v=abc",
    "https://m.youtube.com./",
  ]) {
    assert.throws(() => validateUrl(u));
  }
});

test("validateUrl accepts valid subdomains and rejects domain look-alikes", () => {
  assert.equal(validateUrl("https://m.youtube.com/"), "https://m.youtube.com/");
  assert.equal(
    validateUrl("https://m.youtube-nocookie.com/embed/abc"),
    "https://m.youtube-nocookie.com/embed/abc",
  );
  assert.throws(() => validateUrl("https://youtube.com.evil.test/"));
});

test("FLUX_EXTRA_SOURCE_HOSTS adds allowed hosts", async () => {
  const original = process.env.FLUX_EXTRA_SOURCE_HOSTS;
  process.env.FLUX_EXTRA_SOURCE_HOSTS = "extra.example.test";
  try {
    // Fresh module instance so FLUX_EXTRA_SOURCE_HOSTS is read at module load.
    const mod = await import("../server.mjs?extra-hosts=1");
    const { validateUrl: validateExtra } = mod;
    assert.equal(
      validateExtra("https://extra.example.test/"),
      "https://extra.example.test/",
    );
    assert.throws(() =>
      validateExtra("https://extra.example.test.evil.test/"),
    );
  } finally {
    if (original === undefined) {
      delete process.env.FLUX_EXTRA_SOURCE_HOSTS;
    } else {
      process.env.FLUX_EXTRA_SOURCE_HOSTS = original;
    }
  }
});
