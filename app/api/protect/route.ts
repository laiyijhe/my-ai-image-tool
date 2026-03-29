import { existsSync } from "node:fs";
import { join } from "node:path";
import { Jimp } from "jimp";
import { embedMemberIdInBitmap } from "@/lib/watermark-lsb";
import { type NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId") ?? "unknown";
  console.log("[Creator Guard protect] userId:", userId);

  const base = await loadBaseJimp(request);
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
    embedMemberIdInBitmap(image, userId);
    const buf = await image.getBuffer("image/png");
    const body = new Uint8Array(buf);

    return new NextResponse(body, {
      status: 200,
      headers: {
        /** Strict binary PNG — no charset; prevents MIME sniffing issues. */
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
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
