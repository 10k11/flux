// Copies the unmodified Flux server into desktop/app-server so it can be packaged.
import { cp, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const target = path.resolve(here, "..", "app-server");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const name of ["server.mjs", "lib", "public"])
  await cp(path.join(root, name), path.join(target, name), { recursive: true });
console.log("Synced server files into desktop/app-server");
