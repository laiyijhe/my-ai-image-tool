/**
 * Generates public/favicon.ico, public/icon.png, public/apple-icon.png from public/favicon.svg
 * Run: node scripts/gen-favicons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pub = path.join(root, "public");
const svgPath = path.join(pub, "favicon.svg");

async function main() {
  const svg = fs.readFileSync(svgPath);
  const png32 = await sharp(svg).resize(32, 32).png().toBuffer();
  const png180 = await sharp(svg).resize(180, 180).png().toBuffer();
  const png512 = await sharp(svg).resize(512, 512).png().toBuffer();

  fs.writeFileSync(path.join(pub, "icon.png"), png512);
  fs.writeFileSync(path.join(pub, "apple-icon.png"), png180);
  const ico = await pngToIco([png32]);
  fs.writeFileSync(path.join(pub, "favicon.ico"), ico);
  console.log("Wrote public/favicon.ico, icon.png, apple-icon.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
