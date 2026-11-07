import { spawn } from "node:child_process";
import { statSync } from "node:fs";

export function previewDuration(duration, live = false, maxDuration = 7200) {
  if (live || !Number.isFinite(duration) || duration < 0.2)
    throw new Error(
      "A preview needs a finished media item with a known duration. Try another source.",
    );
  if (duration > maxDuration)
    throw new Error(
      "This media exceeds the server duration limit. Choose a shorter item.",
    );
  return duration / 2;
}
export function processTool(
  command,
  args,
  { onChild, timeout = 30 * 60000 } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    onChild?.(child);
    let out = "",
      err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Media processing timed out."));
    }, timeout);
    child.stdout.on("data", (d) => {
      out = (out + d).slice(-1048576);
    });
    child.stderr.on("data", (d) => {
      err = (err + d).slice(-4000);
    });
    child.on("error", () => {
      clearTimeout(timer);
      reject(new Error("The media processing tool is unavailable."));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else {
        console.error("Media processing failed:", err);
        reject(
          new Error("The server could not generate a playable media file."),
        );
      }
    });
  });
}
export async function probeMedia(ffprobe, file) {
  return JSON.parse(
    await processTool(
      ffprobe,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_type",
        "-of",
        "json",
        file,
      ],
      { timeout: 30000 },
    ),
  );
}
export async function makePreview({
  ffmpeg,
  ffprobe,
  source,
  output,
  duration,
  format,
  bitrate = "192",
  onChild,
}) {
  previewDuration(duration);
  const sourceInfo = await probeMedia(ffprobe, source);
  const measured = Number(sourceInfo.format?.duration);
  if (
    !Number.isFinite(measured) ||
    Math.abs(measured - duration) > Math.max(2, duration * 0.02)
  )
    throw new Error(
      "The source duration could not be verified. No preview was released.",
    );
  const seconds = previewDuration(measured);
  const encoding =
    format === "mp3"
      ? ["-vn", "-c:a", "libmp3lame", "-b:a", `${bitrate}k`]
      : [
          "-map",
          "0:v:0",
          "-map",
          "0:a:0?",
          "-map",
          "0:s?",
          "-c:s",
          "mov_text",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "21",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
        ];
  await processTool(
    ffmpeg,
    [
      "-nostdin",
      "-y",
      "-v",
      "error",
      "-protocol_whitelist",
      "file,crypto,data",
      "-i",
      source,
      "-t",
      String(seconds),
      ...encoding,
      "-map_metadata",
      "0",
      output,
    ],
    { onChild },
  );
  const info = await probeMedia(ffprobe, output);
  const actual = Number(info.format?.duration),
    tolerance = Math.max(0.12, Math.min(0.5, seconds * 0.01));
  if (
    !statSync(output).size ||
    !info.streams?.some(
      (s) => s.codec_type === (format === "mp3" ? "audio" : "video"),
    ) ||
    !Number.isFinite(actual) ||
    Math.abs(actual - seconds) > tolerance
  )
    throw new Error(
      "The server could not validate the preview duration. No file was released.",
    );
  // Decode the entire result: a container header alone does not prove playability.
  await processTool(
    ffmpeg,
    [
      "-nostdin",
      "-v",
      "error",
      "-xerror",
      "-protocol_whitelist",
      "file,crypto,data",
      "-i",
      output,
      "-f",
      "null",
      "-",
    ],
    { onChild },
  );
  return actual;
}
