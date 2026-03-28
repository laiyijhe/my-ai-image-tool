import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from "next/server";

// 🔐 你的 Cloudinary 配置
cloudinary.config({
  cloud_name: 'doch4m3yp', 
  api_key: '121748981283822',       
  api_secret: '4UhXHgwTi1LjFmIAr2aPFsBEG2g'  
});

export async function POST(req: Request) {
  try {
    const { imageDatas } = await req.json(); // 接收前台傳來的單張圖片資料 (Base64)

    // 因為現在是一張變三張，我們只要確認有第一張圖即可
    if (!imageDatas || imageDatas.length === 0) {
      return NextResponse.json({ error: "❌ 請確保選取了圖片喔！" }, { status: 400 });
    }

    const singleImage = imageDatas[0]; // 只取第一張

    console.log("正在處理單圖上傳與自動美工...");

    // 1. 先把原圖上傳，並獲取 Public ID
    const uploadResponse = await cloudinary.uploader.upload(singleImage, {
      folder: "toy_single_robot",
      resource_type: "auto"
    });

    const pid = uploadResponse.public_id; // 這是原圖的 ID

    // 🏆 🏆 🏆 🏆 🏆 核心：一張變三張的魔法 🏆 🏆 🏆 🏆 🏆
    // 我們將pid (原圖) 重複疊加三次，並套用不同的裁切參數

    const finalUrl = cloudinary.url(pid, {
      transformation: [
        // 1. 【底圖/主圖】：原圖縮小，固定 4:3 比例，作為背景
        { width: 800, height: 600, crop: "fill", gravity: "center" },

        // 2. 【細節 A (右上)】：疊加同一張原圖，裁切臉部或中心區域 (g:auto 系統自動選)，變成正方形小圖
        { overlay: pid, width: 250, height: 250, crop: "fill", gravity: "auto", x: 10, y: 10, border: "3px_solid_white" },

        // 3. 【細節 B (右中下)】：疊加同一張原圖，裁切下半部區域 (g:south)，變成正方形小圖
        { overlay: pid, width: 250, height: 250, crop: "fill", gravity: "south", x: 10, y: 270, border: "3px_solid_white" },

        // 4. 【你的 Logo】：疊加在右下角
        { overlay: "my_logo", width: 120, gravity: "south_east", x: 20, y: 20 }
      ]
    });

    return NextResponse.json({ url: finalUrl });

  } catch (error: any) {
    console.error("Cloudinary Detailed Error:", error);
    return NextResponse.json({ error: "拼圖失敗", details: error.message }, { status: 500 });
  }
}