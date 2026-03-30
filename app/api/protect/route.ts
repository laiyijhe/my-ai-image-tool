import { existsSync } from "node:fs";
import { join } from "node:path";
import { Jimp } from "jimp";
import { isAllowedProtectSourceUrl } from "@/lib/protect-source-url";
import { embedMemberIdDct } from "@/lib/watermark-dct";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024;

const PUBLIC_REL = join("public", "test.jpg");

async function loadBaseJimp(
  request: NextRequest
): Promise<Awaited<ReturnType<typeof Jimp.read>> | null> {
  const localPath = join(process.cwd(), PUBLIC_REL);
  if (existsSync(localPath)) {
    try {
      return await Jimp.read(localPath);
    } catch {
      return null;
    }
  }

  const url = new URL("/test.jpg", request.nextUrl.origin);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return await Jimp.read(Buffer.from(ab));
  } catch {
    return null;
  }
}

/** When no query id is present — proves new protect route is live vs legacy `unknown` default. */
const FALLBACK_NO_ID = "TEST_ERROR_ID";

/**
 * Read search params from both `nextUrl` and full `request.url` (some proxies / rewrites
 * have been seen to affect one path; values should match when both are present).
 */
function pickSearchParam(request: NextRequest, key: string): string {
  const fromNext = request.nextUrl.searchParams.get(key);
  const fromFull = new URL(request.url).searchParams.get(key);
  const raw = (fromNext ?? fromFull ?? "").trim();
  return raw;
}

export async function GET(request: NextRequest) {
  const memberTrimmed = pickSearchParam(request, "memberId");
  const userTrimmed = pickSearchParam(request, "userId");

  let embeddedId: string;
  let idSource: "memberId" | "userId" | "test_error_fallback";
  if (memberTrimmed) {
    embeddedId = memberTrimmed;
    idSource = "memberId";
  } else if (userTrimmed) {
    embeddedId = userTrimmed;
    idSource = "userId";
  } else {
    embeddedId = FALLBACK_NO_ID;
    idSource = "test_error_fallback";
  }

  console.log(
    "[Creator Guard protect] DCT embedding id:",
    embeddedId,
    "| source:",
    idSource,
    "| memberId:",
    memberTrimmed || "(empty)",
    "| userId:",
    userTrimmed || "(empty)",
    "| rawQuery:",
    request.nextUrl.search || "(none)"
  );

  const imageUrlParam = pickSearchParam(request, "imageUrl");
  let base: Awaited<ReturnType<typeof Jimp.read>> | null = null;

  if (imageUrlParam) {
    const imageUrl = imageUrlParam;
    if (!isAllowedProtectSourceUrl(imageUrl)) {
      return NextResponse.json(
        { error: "Invalid imageUrl", message: "Source host is not allowed." },
        { status: 400 }
      );
    }
    try {
      const res = await fetch(imageUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: "Source fetch failed", message: `HTTP ${res.status}` },
          { status: 502 }
        );
      }
      const len = res.headers.get("content-length");
      if (len && Number(len) > MAX_REMOTE_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "Image too large" },
          { status: 413 }
        );
      }
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_REMOTE_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "Image too large" },
          { status: 413 }
        );
      }
      base = await Jimp.read(Buffer.from(ab));
    } catch (err) {
      console.error("[Creator Guard protect] remote image failed:", err);
      return NextResponse.json(
        {
          error: "Image fetch failed",
          message: "Could not load image from imageUrl.",
        },
        { status: 502 }
      );
    }
  } else {
    base = await loadBaseJimp(request);
  }

  if (!base) {
    return NextResponse.json(
      {
        error: "Image not found",
        message:
          "The protected image (public/test.jpg) is missing or unreachable. Add the file or contact support.",
      },
      { status: 404 }
    );
  }

  try {
    const image = base.clone();
    embedMemberIdDct(image, embeddedId);
    /** Truecolor PNG (color type 2) — no alpha chunk; RGBA bitmap is read correctly via default inputColorType. */
    const buf = await image.getBuffer("image/png", { colorType: 2 });
    const body = new Uint8Array(buf);

    return new NextResponse(body, {
      status: 200,
      headers: {
        /** Strict binary PNG — no charset; prevents MIME sniffing issues. */
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        /** Debug which id path ran (check Network → Response headers on /api/protect). */
        "X-Creator-Guard-Embed-Source": idSource,
      },
    });
  } catch (err) {
    console.error("[Creator Guard protect] watermark failed:", err);
    return NextResponse.json(
      {
        error: "Image processing failed",
        message: "Could not embed invisible watermark or encode image.",
      },
      { status: 500 }
    );
  }
}
