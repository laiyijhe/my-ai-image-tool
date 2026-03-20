import { NextResponse } from 'next/server';

// POST 負責發起修復請求
export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "660d551d50d41d9963da1807e32a6fa2c3f84f183e2009a0a256d05f3246a489",
        input: { image: imageUrl, upscale: 4 }
      }),
    });
    const prediction = await response.json();
    return NextResponse.json(prediction);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET 負責查詢進度 (Polling)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: {
      "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
    },
  });
  const prediction = await response.json();
  return NextResponse.json(prediction);
}