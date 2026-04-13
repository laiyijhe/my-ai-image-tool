import { NextResponse } from "next/server";

/** Docker Compose service `backend` listening on container port 8000 (internal network only). */
const MATCH_URL = "http://backend:8000/match";

const FETCH_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.BACKEND_FETCH_TIMEOUT_MS) || 25000, 3000),
  120000
);

async function fetchMatch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function errorPayload(e: unknown, url: string) {
  const aborted = e instanceof Error && e.name === "AbortError";
  const message = aborted
    ? `Request timed out after ${FETCH_TIMEOUT_MS}ms`
    : e instanceof Error
      ? e.message
      : String(e);
  const name = e instanceof Error ? e.name : "Error";
  const stack = e instanceof Error ? e.stack : undefined;
  return {
    error: message,
    errorName: name,
    matches: [] as unknown[],
    detail: aborted
      ? `Backend did not respond in time: ${url}`
      : `Backend unreachable: ${url}`,
    ...(stack ? { errorStack: stack } : {}),
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", matches: [] },
      { status: 400 }
    );
  }

  const url = MATCH_URL;
  console.log("[API Route] Connecting to:", url);

  let res: Response;
  try {
    res = await fetchMatch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("[API Route] Fetch failed:", e);
    const payload = errorPayload(e, url);
    return NextResponse.json(payload, { status: 502 });
  }

  console.log("[API Route] Response Status:", res.status);

  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}
