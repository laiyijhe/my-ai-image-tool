import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "無效的圖片網址" }, { status: 400 });
    }

    // 換成這個更穩定的模型版本
    const output = await replicate.run(
      "nightmareai/real-esrgan:42425f12c34bc928a30644040e3a68da5608d0979a4059049a44400c968f2f45",
      {
        input: {
          image: url,
          upscale: 2,
          face_enhance: true, // 順便幫你加上人臉修復，對賣家拍模特兒很有用
        },
      }
    );

    const finalUrl = Array.isArray(output) ? output[0] : output;
    return NextResponse.json({ url: finalUrl });

  } catch (error: any) {
    console.error("Replicate Error:", error.message);
    // 這裡會把 422 的具體原因抓出來
    return NextResponse.json({ error: `AI 引擎拒絕要求：${error.message}` }, { status: 500 });
  }
}