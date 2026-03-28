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

    // 1. 上傳原圖 (不放資料夾，減少路徑問題)
    const uploadResponse = await cloudinary.uploader.upload(imageDatas[0], {
      use_filename: true,
      unique_filename: true
    });

    const pid = uploadResponse.public_id;

    // 🏆 🏆 🏆 最保險的拼圖語法 🏆 🏆 🏆
    // 我們直接在 Cloudinary 的 URL 裡定義「大圖 + 兩個裁切」
    const finalUrl = cloudinary.url(pid, {
      transformation: [
        // A. 底圖：設為 800x600 的主背景
        { width: 800, height: 600, crop: "fill", gravity: "center" },
        
        // B. 疊加 1 (右上)：拿同一個 pid 裁切臉部
        { 
          overlay: pid.replace(/\//g, ":"), 
          width: 250, height: 250, crop: "fill", 
          gravity: "auto", x: 15, y: 15, position: "north_east", border: "4px_solid_white" 
        },
        
        // C. 疊加 2 (右下)：拿同一個 pid 裁切底部
        { 
          overlay: pid.replace(/\//g, ":"), 
          width: 250, height: 250, crop: "fill", 
          gravity: "south", x: 15, y: 15, position: "south_east", border: "4px_solid_white" 
        }
        
        // 💡 暫時先不加 Logo，我們先確認這 3 張拼圖能跑出來！
      ]
    });

    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}