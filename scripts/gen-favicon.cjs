/* One-off: node scripts/gen-favicon.cjs → public/favicon.png */
const sharp = require("sharp");
const path = require("node:path");

const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="#0f172a"/>
  <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#g)" opacity="0.95"/>
  <text x="16" y="21" text-anchor="middle" fill="#020617" font-family="system-ui,sans-serif" font-size="11" font-weight="800">CG</text>
</svg>`
);

async function main() {
  const out = path.join(__dirname, "..", "public", "favicon.png");
  await sharp(svg).resize(32, 32).png().toFile(out);
  console.log("Wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
