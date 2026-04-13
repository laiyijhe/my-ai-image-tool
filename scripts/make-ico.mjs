import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pngPath = join(root, "public", "favicon.png");
const icoPath = join(root, "public", "favicon.ico");

const buf = await pngToIco([pngPath]);
writeFileSync(icoPath, buf);
console.log("Wrote", icoPath);
