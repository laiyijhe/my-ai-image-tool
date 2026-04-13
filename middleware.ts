import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Must match a key in `lib/i18n/dictionary` `locales`. */
const DEFAULT_LOCALE = "en";

/**
 * Paths without a locale segment rewrite to `/[lang]/…` so the App Router
 * serves `app/[lang]/…` while keeping the visible URL unchanged where noted.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/claim" || pathname === "/claim/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}/claim`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/verify/pdf" || pathname === "/verify/pdf/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}/verify/pdf`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/protect/image" || pathname === "/protect/image/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}/protect/image`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/protect/pdf" || pathname === "/protect/pdf/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}/protect/pdf`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/protect/video" || pathname === "/protect/video/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}/protect/video`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/verify" || pathname === "/verify/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}/verify`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/portal" || pathname === "/portal/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}/portal`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/success" || pathname === "/success/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}/success`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/claim",
    "/claim/",
    "/verify/pdf",
    "/verify/pdf/",
    "/protect/image",
    "/protect/image/",
    "/protect/pdf",
    "/protect/pdf/",
    "/protect/video",
    "/protect/video/",
    "/verify",
    "/verify/",
    "/portal",
    "/portal/",
    "/success",
    "/success/",
  ],
};
