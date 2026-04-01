import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Jimp, JimpMime } from "jimp";
import { PNGColorType, PNGFilterType } from "@jimp/js-png";
import { isAllowedProtectSourceUrl } from "@/lib/protect-source-url";
import {
  embedMemberIdDct,
  WatermarkEmbedCapacityError,
} from "@/lib/watermark-dct";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024;

/** Wide images blow interior 8×8 block count and risk serverless timeouts; shrink before DCT embed. */
const PROTECT_MAX_WIDTH_BEFORE_DOWNSCALE = 800;
const PROTECT_DOWNSCALE_TARGET_WIDTH = 800;

const PUBLIC_REL = join("public", "test.jpg");

type EmbedIdSource = "memberId" | "userId" | "test_error_fallback" | "form_upload";

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

function resolveEmbeddedId(
  memberTrimmed: string,
  userTrimmed: string
): { embeddedId: string; idSource: EmbedIdSource } {
  if (memberTrimmed) {
    return { embeddedId: memberTrimmed, idSource: "memberId" };
  }
  if (userTrimmed) {
    return { embeddedId: userTrimmed, idSource: "userId" };
  }
  return { embeddedId: FALLBACK_NO_ID, idSource: "test_error_fallback" };
}

function safeDownloadBaseName(id: string): string {
  const s = id.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (s.length > 0 ? s : "watermark").slice(0, 120);
}

/**
 * Clone, optional downscale, DCT embed, encode PNG — returns binary response or JSON error.
 * `forceDownload` adds `Content-Disposition: attachment` (POST quick test); GET stays inline-friendly.
 */
async function respondProtectedPng(
  base: Awaited<ReturnType<typeof Jimp.read>>,
  embeddedId: string,
  idSource: EmbedIdSource,
  opts?: { forceDownload?: boolean }
): Promise<NextResponse> {
  try {
    const image = base.clone();
    const w0 = image.width;
    if (w0 > PROTECT_MAX_WIDTH_BEFORE_DOWNSCALE) {
      const h0 = image.height;
      const tw = PROTECT_DOWNSCALE_TARGET_WIDTH;
      const th = Math.max(1, Math.round((h0 * tw) / w0));
      image.resize({ w: tw, h: th });
    }

    embedMemberIdDct(image, embeddedId);

    {
      const { data } = image.bitmap;
      data[0] = 255;
      data[1] = 0;
      data[2] = 0;
      data[3] = 255;
    }

    /** JPEG-oriented hook; no-op for PNG pipeline but kept for future / mixed formats. */
    (image as unknown as { quality?: (n: number) => void }).quality?.(70);

    const buf = await image.getBuffer(JimpMime.png, {
      colorType: PNGColorType.COLOR,
      filterType: PNGFilterType.NONE,
      /** Lower zlib level = faster encode, slightly larger files (still lossless). */
      deflateLevel: 3,
    });
    const body: Buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);

    const headers: Record<string, string> = {
      "Content-Type": "image/png",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
      "X-Creator-Guard-Embed-Source": idSource,
    };
    if (opts?.forceDownload) {
      const baseName = safeDownloadBaseName(embeddedId);
      headers["Content-Disposition"] =
        `attachment; filename="creator-guard-${baseName}.png"`;
    }

    return new NextResponse(body as unknown as BodyInit, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("[Creator Guard protect] watermark failed:", err);
    if (err instanceof WatermarkEmbedCapacityError) {
      return NextResponse.json(
        {
          code: err.code,
          error: "capacity",
          message: "Not enough image area to embed this Member ID.",
          blocksNeeded: err.blocksNeeded,
          blocksHave: err.blocksHave,
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      {
        error: "Image processing failed",
        message: "Could not embed invisible watermark or encode image.",
      },
      { status: 500 }
    );
  }
}

function formUploadLooksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i.test(file.name);
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid body", message: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file", message: "Form field `file` must be an image." },
      { status: 400 }
    );
  }

  if (!formUploadLooksLikeImage(file)) {
    return NextResponse.json(
      { error: "Invalid file", message: "Upload an image (JPEG, PNG, WebP, …)." },
      { status: 400 }
    );
  }

  if (file.size > MAX_REMOTE_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  let base: Awaited<ReturnType<typeof Jimp.read>>;
  try {
    const ab = await file.arrayBuffer();
    base = await Jimp.read(Buffer.from(ab));
  } catch (err) {
    console.error("[Creator Guard protect] POST decode failed:", err);
    return NextResponse.json(
      {
        error: "Decode failed",
        message: "Could not read that file as an image.",
      },
      { status: 400 }
    );
  }

  const memberTrimmed = String(formData.get("memberId") ?? "").trim();
  const userTrimmed = String(formData.get("userId") ?? "").trim();
  if (!memberTrimmed && !userTrimmed) {
    return NextResponse.json(
      {
        error: "Missing memberId",
        message: "Form field `memberId` (or `userId`) is required.",
      },
      { status: 400 }
    );
  }
  const { embeddedId, idSource: baseSource } = resolveEmbeddedId(
    memberTrimmed,
    userTrimmed
  );
  const idSource: EmbedIdSource =
    baseSource === "test_error_fallback" ? "form_upload" : baseSource;

  console.log("[Creator Guard protect] POST form upload", {
    embeddedId,
    idSource,
    memberId: memberTrimmed || "(empty)",
    userId: userTrimmed || "(empty)",
  });

  return respondProtectedPng(base, embeddedId, idSource, {
    forceDownload: true,
  });
}

export async function GET(request: NextRequest) {
  const memberTrimmed = pickSearchParam(request, "memberId");
  const userTrimmed = pickSearchParam(request, "userId");
  const { embeddedId, idSource } = resolveEmbeddedId(
    memberTrimmed,
    userTrimmed
  );

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

  return respondProtectedPng(base, embeddedId, idSource);
}
