import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) return NextResponse.json({ error: "請提供網址" }, { status: 400 });

    // 這是目前 Replicate 上最穩定的 Real-ESRGAN 版本 ID
    const output = await replicate.run(
      "nightmareai/real-esrgan:f12134f35a09849204043f11003f56555127027878a63f707f4575971a8bc14d",
      {
        input: {
          image: url,
          upscale: 2,
          face_enhance: true,
        },
      }
    );

    // 確保拿到的網址是正確的
    const finalUrl = Array.isArray(output) ? output[0] : output;
    
    if (!finalUrl) throw new Error("AI 沒有回傳結果");

    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    console.error("Debug:", error.message);
    return NextResponse.json({ error: `AI 引擎拒絕要求：${error.message}` }, { status: 500 });
  }
}