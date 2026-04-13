import type { NextConfig } from "next";

/**
 * App Router only — do not add a `pages/` directory or Next will merge routers
 * and `/` may not resolve to `app/page.tsx`.
 * Root dashboard: `app/page.tsx` (Creator Guard).
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  /** Expose Facebook App ID to the client (public OAuth value) from AUTH_FACEBOOK_ID for UI / QA hooks. */
  env: {
    NEXT_PUBLIC_AUTH_FACEBOOK_APP_ID: process.env.AUTH_FACEBOOK_ID ?? "",
  },
};

export default nextConfig;