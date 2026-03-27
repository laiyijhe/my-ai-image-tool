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
    // 1. 取得資料並檢查
    const body = await req.json();
    const { imageDatas } = body;

    if (!imageDatas || !Array.isArray(imageDatas) || imageDatas.length < 3) {
      return NextResponse.json({ error: "❌ 請確保選取了 3 張圖片" }, { status: 400 });
    }

    console.log("正在處理圖片上傳...");

    // 2. 上傳到 Cloudinary (這裡加上了更穩定的參數)
    const uploadPromises = imageDatas.map((base64) => 
      cloudinary.uploader.upload(base64, {
        folder: "toy_robot_upload",
        resource_type: "auto" // 自動辨識圖片格式
      })
    );

    const uploadResponses = await Promise.all(uploadPromises);
    const pids = uploadResponses.map(res => res.public_id);

    // 3. 產生拼圖網址
    // 注意：這裡加上了串接處理，確保特殊的 Public ID 也能正常顯示
    const finalUrl = cloudinary.url(pids[0], {
      transformation: [
        { width: 800, height: 600, crop: "fill", gravity: "center" },
        { overlay: pids[1].replace(/\//g, ":"), width: 250, height: 250, crop: "fill", gravity: "north_east", x: 10, y: 10, border: "3px_solid_white" },
        { overlay: pids[2].replace(/\//g, ":"), width: 250, height: 250, crop: "fill", gravity: "north_east", x: 10, y: 270, border: "3px_solid_white" },
        { overlay: "my_logo", width: 120, gravity: "south_east", x: 20, y: 20 }
      ]
    });

    return NextResponse.json({ url: finalUrl });

  } catch (error: any) {
    console.error("Cloudinary 詳細錯誤:", error);
    return NextResponse.json({ 
      error: "拼圖失敗", 
      details: error.message 
    }, { status: 500 });
  }
}