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
