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

    console.log("正在處理單圖上傳與標準化排版...");

    // 1. 上傳：強行不使用任何資料夾 (folder)，直接丟根目錄，最安全！
    const uploadResponse = await cloudinary.uploader.upload(singleImage, {
      resource_type: "auto",
      use_filename: true,
      unique_filename: true,
      folder: "" // 確保在根目錄
    });

    const pid = uploadResponse.public_id; // 這時 pid 不會有斜線

    // 🏆🏆🏆 🏆🏆🏆 最保險的拼圖語法 🏆🏆🏆 🏆🏆🏆
    // 我們直接在 Cloudinary 的 URL 裡定義「大圖 + 兩個裁切」
    const finalUrl = cloudinary.url(pid, {
      transformation: [
        // A. 底圖：設為 800x600 的主背景
        { width: 800, height: 600, crop: "fill", gravity: "center" },
        
        // B. 疊加 1 (右上)：拿同一個 pid 裁切臉部或中心區域 (g_auto)
        { 
          overlay: pid, 
          width: 250, height: 250, crop: "fill", 
          gravity: "auto", x: 15, y: 15, position: "north_east", border: "4px_solid_white" 
        },
        
        // C. 疊加 2 (右下)：拿同一個 pid 裁切下半部 (g_south)
        { 
          overlay: pid, 
          width: 250, height: 250, crop: "fill", 
          gravity: "south", x: 15, y: 15, position: "south_east", border: "4px_solid_white" 
        },
        
        // D. 【最後一步】我暫時把 my_logo 移除了。
        // 💡 💡 💡 我們先確認「大圖 + 兩個裁切」能跑出來！如果連這個都破圖，那就是 Cloudinary 設定有問題。💡 💡 💡
      ]
    });

    return NextResponse.json({ url: finalUrl });

  } catch (error: any) {
    console.error("Cloudinary 錯誤:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}