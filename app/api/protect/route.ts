import { existsSync } from "node:fs";
import { join } from "node:path";
import { Jimp } from "jimp";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_REL = join("public", "test.jpg");

/**
 * Load JPEG bytes: prefer local `public/test.jpg` (dev / full Node FS).
 * On Vercel serverless, `public` is often not on disk for route handlers — fetch the deployed static asset.
 */
async function loadTestJpegBytes(request: NextRequest): Promise<Buffer | null> {
  const localPath = join(process.cwd(), PUBLIC_REL);
  if (existsSync(localPath)) {
    try {
      const image = await Jimp.read(localPath);
      return Buffer.from(await image.getBuffer("image/jpeg"));
    } catch {
      return null;
    }
  }

  const url = new URL("/test.jpg", request.nextUrl.origin);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const image = await Jimp.read(Buffer.from(ab));
    return Buffer.from(await image.getBuffer("image/jpeg"));
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  console.log("[Creator Guard protect] userId:", userId ?? "(none)");

  const jpeg = await loadTestJpegBytes(request);

  if (!jpeg) {
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
    const body = new Uint8Array(jpeg);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[Creator Guard protect] failed to encode image:", err);
    return NextResponse.json(
      {
        error: "Image processing failed",
        message: "Could not read or serve the protected image.",
      },
      { status: 500 }
    );
  }
}
