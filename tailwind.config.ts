import type { Config } from "tailwindcss";

/**
 * V7.3+ — content paths for tooling; design tokens live in `app/globals.css` (`@theme`).
 * Canva Light Theme: primary background `bg-canvas` (#fff); primary action color `of-500` (#00AFF0);
 * typography `text-ink` / `text-ink-muted`. No `dark:` variant (light-only product shell).
 */
const config = {
  /** No `dark:` variant — product is light-only (V7.3). */
  darkMode: false,
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
} satisfies Config;

export default config;
