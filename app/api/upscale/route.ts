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

    // 1. 上傳原圖
    const uploadResponse = await cloudinary.uploader.upload(imageDatas[0], {
      folder: "toy_single_robot",
    });

    // 取得這張圖在雲端的身份證 (Public ID)
    const pid = uploadResponse.public_id;

    // 2. 建立拼圖網址 (使用最基礎的參數，避免符號衝突)
    // 我們先不做 Logo 疊加，確認拼圖功能正常
    const finalUrl = cloudinary.url(pid, {
      transformation: [
        { width: 800, height: 600, crop: "fill", gravity: "center" },
        // 疊加第一塊細節 (右上)
        { overlay: pid.replace(/\//g, ":"), width: 250, height: 250, crop: "fill", gravity: "auto", x: 10, y: 10, border: "3px_solid_white" },
        // 疊加第二塊細節 (右下)
        { overlay: pid.replace(/\//g, ":"), width: 250, height: 250, crop: "fill", gravity: "south", x: 10, y: 10, border: "3px_solid_white" }
      ]
    });

    console.log("生成的拼圖網址:", finalUrl);
    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    console.error("錯誤詳情:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}