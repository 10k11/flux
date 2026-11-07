import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
const files = [
  "server.mjs",
  ...["public", "lib", "scripts", "test"].flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => /\.(m?js)$/.test(f))
      .map((f) => `${dir}/${f}`),
  ),
];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(1);
}
console.log(`Syntax checks passed: ${files.length} JavaScript modules.`);
