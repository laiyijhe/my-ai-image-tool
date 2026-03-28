import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from "next/server";

cloudinary.config({
  cloud_name: 'doch4m3yp', 
  api_key: '121748981283822',       
  api_secret: '4UhXHgwTi1LjFmIAr2aPFsBEG2g'  
});

export async function POST(req: Request) {
  try {
    const { imageDatas } = await req.json();
    if (!imageDatas || imageDatas.length === 0) return NextResponse.json({ error: "❌ 無資料" }, { status: 400 });

    // 1. 上傳：不指定資料夾 (folder)，直接丟根目錄，最安全！
    const uploadResponse = await cloudinary.uploader.upload(imageDatas[0], {
      resource_type: "auto",
    });

    const pid = uploadResponse.public_id; // 這時 pid 不會有斜線

    // 2. 生成拼圖網址：使用最基礎的疊加語法
    // l_ (layer) 是 Cloudinary 最穩定的縮寫語法
    const finalUrl = cloudinary.url(pid, {
      transformation: [
        // 主圖
        { width: 800, height: 600, crop: "fill", gravity: "center" },
        // 疊加 1 (右上)
        { overlay: pid, width: 250, height: 250, crop: "fill", gravity: "north_east", x: 15, y: 15, border: "4px_solid_white" },
        // 疊加 2 (右下)
        { overlay: pid, width: 250, height: 250, crop: "fill", gravity: "south_east", x: 15, y: 15, border: "4px_solid_white" }
      ]
    });

    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}