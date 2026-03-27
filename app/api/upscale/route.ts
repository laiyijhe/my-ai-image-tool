import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from "next/server";

// 🔐 你的專屬 Cloudinary 配置 (已填入你的憑證)
cloudinary.config({
  cloud_name: 'doch4m3yp', 
  api_key: '121748981283822',       
  api_secret: '4UhXHgwTi1LjFmIAr2aPFsBEG2g'  
});

export async function POST(req: Request) {
  try {
    const { url1, url2, url3 } = await req.json();

    if (!url1 || !url2 || !url3) {
      return NextResponse.json({ error: "❌ 請確保輸入了 3 張圖片網址" }, { status: 400 });
    }

    // 上傳 3 張圖到雲端相簿
    const uploadResponses = await Promise.all([
      cloudinary.uploader.upload(url1, { folder: "toy_robot" }),
      cloudinary.uploader.upload(url2, { folder: "toy_robot" }),
      cloudinary.uploader.upload(url3, { folder: "toy_robot" })
    ]);

    const pids = uploadResponses.map(res => res.public_id);

    // 🏆 黃金拼圖比例：左邊大圖(主圖)，右邊兩張直排小圖(細節)
    // 並自動在右下角加上你上傳的 my_logo
    const finalUrl = cloudinary.url(pids[0], {
      transformation: [
        { width: 800, height: 600, crop: "fill", gravity: "center" }, // 主圖固定 4:3
        // 疊加細節圖 A (右上)
        { overlay: pids[1].replace(/\//g, ":"), width: 250, height: 250, crop: "fill", gravity: "north_east", x: 10, y: 10, border: "3px_solid_white" },
        // 疊加細節圖 B (右中下)
        { overlay: pids[2].replace(/\//g, ":"), width: 250, height: 250, crop: "fill", gravity: "north_east", x: 10, y: 270, border: "3px_solid_white" },
        // 疊加你的賣場 Logo (右下)
        { overlay: "my_logo", width: 120, gravity: "south_east", x: 20, y: 20 }
      ]
    });

    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    console.error("Cloudinary Error:", error.message);
    return NextResponse.json({ error: `拼圖失敗：${error.message}` }, { status: 500 });
  }
}