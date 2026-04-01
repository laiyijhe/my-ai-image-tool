import type { NextConfig } from "next";

/**
 * App Router only — do not add a `pages/` directory or Next will merge routers
 * and `/` may not resolve to `app/page.tsx`.
 * Root dashboard: `app/page.tsx` (Creator Guard).
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["jimp", "sharp"],
};

export default nextConfig;