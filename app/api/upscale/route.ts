import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: "電池（Token）沒裝好！" }, { status: 500 });
    }

    // 使用 Real-ESRGAN 模型進行高清修復
    const output = await replicate.run(
      "daanelson/real-esrgan-a100:42425f12c34bc928a30644040e3a68da5608d0979a4059049a44400c968f2f45",
      {
        input: {
          image: url,
          upscale: 4, // 放大 4 倍
        },
      }
    );

    // 這裡最關鍵：有的模型回傳字串，有的回傳陣列
    const finalUrl = Array.isArray(output) ? output[0] : output;

    if (!finalUrl) {
      return NextResponse.json({ error: "AI 沒給圖片網址" }, { status: 500 });
    }

    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    console.error("AI 修復失敗:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}