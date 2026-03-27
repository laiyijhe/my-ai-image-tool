import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from "next/server";

// 設定你的 Cloudinary 凭证 (請替換成你的實際資料)
cloudinary.config({
  cloud_name: '你的CLOUD_NAME', //doch4m3yp 👈 貼上你的 Cloud Name
  api_key: '你的API_KEY',       //121748981283822 👈 貼上你的 API Key
  api_secret: '你的API_SECRET'  //4UhXHgwTi1LjFmIAr2aPFsBEG2g 👈 貼上你的 API Secret
});

export async function POST(req: Request) {
  try {
    const { url1, url2, url3 } = await req.json(); // 👈 我們改收 3 個網址

    if (!url1 || !url2 || !url3) {
      return NextResponse.json({ error: "❌ 請確保上傳了 3 張圖片" }, { status: 400 });
    }

    // 將 3 張圖片上傳到 Cloudinary，並獲取它們的 Public ID
    const uploadResponses = await Promise.all([
      cloudinary.uploader.upload(url1, { folder: "公仔拼圖测试" }),
      cloudinary.uploader.upload(url2, { folder: "公仔拼圖测试" }),
      cloudinary.uploader.upload(url3, { folder: "公仔拼圖测试" })
    ]);

    const pids = uploadResponses.map(res => res.public_id);

    // 🏆 🏆 🏆 🏆 🏆 🏆 核心：Cloudinary 的一鍵拼貼功能 🏆 🏆 🏆 🏆 🏆 🏆
    // 我們將 3 張圖組合在一起，並在右下角疊加上你的 Logo
    const finalUrl = cloudinary.url(pids[0], {
      transformation: [
        // 1. 設定主圖 (大圖) 寬度 800px，並縮放
        { width: 800, crop: "scale" },
        
        // 2. 疊加上第二張細節圖 (小圖)，放在右上角
        { overlay: pids[1], width: 150, height: 150, crop: "fill", gravity: "north_east", x: 10, y: 10 },
        
        // 3. 疊加上第三張細節圖 (小圖)，放在右上角，但移到第二張下方
        { overlay: pids[2], width: 150, height: 150, crop: "fill", gravity: "north_east", x: 10, y: 170 },
        
        // 4. (可選) 疊加上你的 Logo (命名為 'my_logo'，放在 Cloudinary 的根目錄下)
        { overlay: "my_logo", width: 100, gravity: "south_east", x: 10, y: 10 }
      ]
    });

    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    return NextResponse.json({ error: `❌ 拼圖失敗：${error.message}` }, { status: 500 });
  }
}