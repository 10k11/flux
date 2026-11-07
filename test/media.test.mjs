import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { previewDuration, makePreview, processTool } from "../lib/media.mjs";
const bin = fileURLToPath(new URL("../bin/", import.meta.url));
const ffmpeg =
  process.env.FFMPEG_PATH ||
  (process.platform === "win32" ? path.join(bin, "ffmpeg.exe") : "ffmpeg");
const ffprobe =
  process.env.FFPROBE_PATH ||
  (process.platform === "win32" ? path.join(bin, "ffprobe.exe") : "ffprobe");
test("unknown, live, tiny and excessive durations fail closed", () => {
  for (const n of [undefined, null, NaN, 0, -1, 0.1, Infinity, 7201])
    assert.throws(() => previewDuration(n));
  assert.throws(() => previewDuration(600, true));
  assert.equal(previewDuration(600), 300);
  assert.equal(previewDuration(240), 120);
});
test("real FFmpeg: 10-minute video produces a playable 5-minute preview", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "flux-video-"));
  try {
    const source = path.join(dir, "source.mp4");
    await processTool(ffmpeg, [
      "-nostdin",
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=160x90:rate=5",
      "-t",
      "600",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      source,
    ]);
    const actual = await makePreview({
      ffmpeg,
      ffprobe,
      source,
      output: path.join(dir, "preview.mp4"),
      duration: 600,
      format: "mp4",
    });
    assert.ok(Math.abs(actual - 300) < 0.5, actual);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("real FFmpeg: 4-minute audio produces a playable 2-minute MP3 preview", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "flux-audio-"));
  try {
    const source = path.join(dir, "source.wav");
    await processTool(ffmpeg, [
      "-nostdin",
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=22050",
      "-t",
      "240",
      source,
    ]);
    const actual = await makePreview({
      ffmpeg,
      ffprobe,
      source,
      output: path.join(dir, "preview.mp3"),
      duration: 240,
      format: "mp3",
    });
    assert.ok(Math.abs(actual - 120) < 0.5, actual);
    await assert.rejects(
      makePreview({
        ffmpeg,
        ffprobe,
        source,
        output: path.join(dir, "wrong.mp3"),
        duration: 480,
        format: "mp3",
      }),
      /duration could not be verified/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
