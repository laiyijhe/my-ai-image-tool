/**
 * Only fetch remote images from trusted hosts (prevents SSRF on /api/protect?imageUrl=).
 * Vercel Blob public URLs use these host suffixes.
 */
const ALLOWED_HOST_SUFFIXES = [
  ".blob.vercel-storage.com",
  ".public.blob.vercel-storage.com",
];

export function isAllowedProtectSourceUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((s) => h.endsWith(s));
  } catch {
    return false;
  }
}
