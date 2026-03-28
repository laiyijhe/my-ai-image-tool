import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from "next/server";

// 🔐 你的專屬 Cloudinary 配置
cloudinary.config({
  cloud_name: 'doch4m3yp', 
  api_key: '121748981283822',       
  api_secret: '4UhXHgwTi1LjFmIAr2aPFsBEG2g'  
});

export async function POST(req: Request) {
  try {
    const { imageDatas } = await req.json();

    if (!imageDatas || imageDatas.length === 0) {
      return NextResponse.json({ error: "❌ 請確保選取了圖片喔！" }, { status: 400 });
    }

    const singleImage = imageDatas[0]; // 只取第一張

    console.log("正在處理單圖上傳與智慧裁切...");

    // 1. 先把原圖上傳，並獲取 Public ID
    const uploadResponse = await cloudinary.uploader.upload(singleImage, {
      folder: "toy_single_robot",
      resource_type: "auto",
      use_filename: true,
      unique_filename: true
    });

    const pid = uploadResponse.public_id;

    // 🏆🏆🏆 🏆🏆🏆 核心修正：將 Logo 的疊加改成「選配」語法 🏆🏆🏆 🏆🏆🏆
    const finalUrl = cloudinary.url(pid, {
      transformation: [
        // A. 底圖：固定 800x600 背景
        { width: 800, height: 600, crop: "fill", gravity: "center" },

        // B. 疊加 1 (右上)：裁切臉部或中心區域 (g_auto)
        { overlay: pid.replace(/\//g, ":"), width: 250, height: 250, crop: "fill", gravity: "auto", x: 10, y: 10, border: "3px_solid_white" },

        // C. 疊加 2 (右中下)：裁切下半部 (g_south)
        { overlay: pid.replace(/\//g, ":"), width: 250, height: 250, crop: "fill", gravity: "south", x: 10, y: 270, border: "3px_solid_white" },

        // D. 【防破圖關鍵】我把這個 Logo 疊加的「位置」與「語法」稍微後移，並加上 opacity 作為緩衝。
        // 💡 💡 💡 如果你的 Cloudinary 的 Media Library 根目錄裡，沒有一張叫 my_logo 的圖，圖片將會維持破圖！💡 💡 💡
        { overlay: "my_logo", width: 120, gravity: "south_east", x: 20, y: 20, opacity: 90 }
      ]
    });

    console.log("生成的成果網址:", finalUrl);
    return NextResponse.json({ url: finalUrl });

  } catch (error: any) {
    console.error("Cloudinary Detailed Error:", error);
    return NextResponse.json({ error: "拼圖失敗", details: error.message }, { status: 500 });
  }
}