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
    if (!imageDatas || imageDatas.length === 0) return NextResponse.json({ error: "❌ 無圖片資料" }, { status: 400 });

    const uploadResponse = await cloudinary.uploader.upload(imageDatas[0], {
      folder: "toy_single_robot",
    });

    const pid = uploadResponse.public_id;

    // 🏆 更強壯的轉化指令：確保即便 Logo 有問題，主圖也能出來
    const finalUrl = cloudinary.url(pid, {
      transformation: [
        { width: 800, height: 600, crop: "fill", gravity: "center" },
        // 疊加 1：右上角裁切
        { overlay: pid.replace(/\//g, ":"), width: 250, height: 250, crop: "fill", gravity: "auto", x: 10, y: 10, border: "3px_solid_white" },
        // 疊加 2：右下角裁切
        { overlay: pid.replace(/\//g, ":"), width: 250, height: 250, crop: "fill", gravity: "south", x: 10, y: 270, border: "3px_solid_white" },
        // 疊加 Logo (如果這行失敗，請確認 Media Library 裡真的有一張叫 my_logo 的圖)
        { overlay: "my_logo", width: 120, gravity: "south_east", x: 20, y: 20, opacity: 80 }
      ]
    });

    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}