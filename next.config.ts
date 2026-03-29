import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Jimp pulls many subpackages; keep resolution predictable on Vercel. */
  serverExternalPackages: ["jimp"],
};

export default nextConfig;