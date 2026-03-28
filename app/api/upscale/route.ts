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
      use_filename: true,
      unique_filename: true
    });

    const pid = uploadResponse.public_id;

    // 🏆 🏆 🏆 安全強化版：確保拼圖優先，Logo 其次 🏆 🏆 🏆
    const finalUrl = cloudinary.url(pid, {
      transformation: [
        // A. 主底圖
        { width: 800, height: 600, crop: "fill", gravity: "center" },
        
        // B. 疊加細節圖 (右上) - 注意這裡 pid 的處理
        { 
          overlay: pid.replace(/\//g, ":"), 
          width: 250, height: 250, crop: "fill", 
          gravity: "auto", x: 15, y: 15, position: "north_east", border: "4px_solid_white" 
        },
        
        // C. 疊加細節圖 (右下)
        { 
          overlay: pid.replace(/\//g, ":"), 
          width: 250, height: 250, crop: "fill", 
          gravity: "south", x: 15, y: 15, position: "south_east", border: "4px_solid_white" 
        },
        
        // D. 疊加 Logo - 我把名字改成 "my_logo"，請務必確認 Cloudinary 裡有這張圖
        // 如果還是破圖，請暫時把下面這行整段註解掉測試
        { overlay: "my_logo", width: 120, gravity: "south_east", x: 20, y: 20, opacity: 90 }
      ]
    });

    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}