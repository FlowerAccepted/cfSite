import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const distRoot = resolve("dist");
const clientRoot = resolve("dist/client");

if (!existsSync(clientRoot)) {
  process.exit(0);
}

mkdirSync(distRoot, { recursive: true });

for (const entry of readdirSync(clientRoot)) {
  cpSync(resolve(clientRoot, entry), resolve(distRoot, entry), {
    recursive: true,
    force: true,
  });
}
