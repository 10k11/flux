import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const build = path.join(root, "desktop", "build");

test("desktop icons exist and are well-formed", () => {
  const png = readFileSync(path.join(build, "icon.png"));
  assert.ok(
    png
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "png signature",
  );
  assert.equal(png.readUInt32BE(16), 512, "png width 512");
  assert.equal(png.readUInt32BE(20), 512, "png height 512");

  const ico = readFileSync(path.join(build, "icon.ico"));
  assert.deepEqual(
    [...ico.subarray(0, 4)],
    [0x00, 0x00, 0x01, 0x00],
    "ico signature",
  );

  const icns = readFileSync(path.join(build, "icon.icns"));
  assert.equal(
    icns.subarray(0, 4).toString("latin1"),
    "icns",
    "icns signature",
  );
});

test("desktop window icon is set on Linux", () => {
  const main = readFileSync(path.join(root, "desktop", "main.mjs"), "utf8");
  assert.match(main, /process\.platform === "linux"/);
  assert.match(main, /"build", "icon\.png"/);
});
