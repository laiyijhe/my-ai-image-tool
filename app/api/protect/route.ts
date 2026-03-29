import { existsSync } from "node:fs";
import { join } from "node:path";
import { Jimp } from "jimp";
import { type NextRequest, NextResponse } from "next/server";

const IMAGE_REL = join("public", "test.jpg");

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  console.log("[Creator Guard protect] userId:", userId ?? "(none)");

  const imagePath = join(process.cwd(), IMAGE_REL);

  if (!existsSync(imagePath)) {
    return NextResponse.json(
      {
        error: "Image not found",
        message:
          "The protected image (public/test.jpg) is missing. Add the file or contact support.",
      },
      { status: 404 }
    );
  }

  try {
    const image = await Jimp.read(imagePath);
    const buf = await image.getBuffer("image/jpeg");
    const body = new Uint8Array(buf);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[Creator Guard protect] failed to read or encode image:", err);
    return NextResponse.json(
      {
        error: "Image processing failed",
        message: "Could not read or serve the protected image.",
      },
      { status: 500 }
    );
  }
}
