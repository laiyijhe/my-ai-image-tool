import { NextResponse } from "next/server";

const CRAWLER_STATUS_URL = "http://backend:8000/api/crawler-status";

export async function GET() {
  try {
    const res = await fetch(CRAWLER_STATUS_URL, { cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (e) {
    console.error("[API Route] crawler-status fetch failed:", e);
    return NextResponse.json(
      {
        status: "unknown",
        current_url: null,
        last_heartbeat: null,
        error_msg:
          e instanceof Error ? e.message : "Backend unreachable (crawler-status)",
      },
      { status: 502 }
    );
  }
}
