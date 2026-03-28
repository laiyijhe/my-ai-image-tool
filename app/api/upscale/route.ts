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

    // 1. 上傳原圖 (強行不使用任何資料夾，確保 ID 最簡潔)
    const uploadResponse = await cloudinary.uploader.upload(imageDatas[0], {
      use_filename: true,
      unique_filename: true,
      folder: "" // 確保在根目錄
    });

    // 取得 Public ID 並將斜線替換為冒號 (這是 Cloudinary 疊加層的硬性規定)
    const rawPid = uploadResponse.public_id;
    const cleanPid = rawPid.replace(/\//g, ":");

    console.log("上傳成功，原始 ID:", rawPid);

    // 2. 產出拼圖網址
    const finalUrl = cloudinary.url(rawPid, {
      transformation: [
        // A. 主底圖 (800x600)
        { width: 800, height: 600, crop: "fill", gravity: "center" },
        
        // B. 疊加細節圖 (右上) - 使用 cleanPid 確保路徑正確
        { 
          overlay: cleanPid, 
          width: 250, height: 250, crop: "fill", 
          gravity: "auto", x: 15, y: 15, position: "north_east", border: "4px_solid_white" 
        },
        
        // C. 疊加細節圖 (右下)
        { 
          overlay: cleanPid, 
          width: 250, height: 250, crop: "fill", 
          gravity: "south", x: 15, y: 15, position: "south_east", border: "4px_solid_white" 
        },
        
        // D. 疊加 Logo (如果這行導致破圖，代表 my_logo 檔案可能有損毀或權限問題)
        { 
          overlay: "my_logo", 
          width: 120, 
          gravity: "south_east", 
          x: 20, 
          y: 20, 
          opacity: 90 
        }
      ]
    });

    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    console.error("Cloudinary 錯誤:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}