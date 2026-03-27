import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from "next/server";

// 🔐 你的專屬 Cloudinary 配置 (填入剛才的那三顆電池)
cloudinary.config({
  cloud_name: 'doch4m3yp', 
  api_key: '121748981283822',       
  api_secret: '4UhXHgwTi1LjFmIAr2aPFsBEG2g'  
});

export async function POST(req: Request) {
  try {
    const { imageDatas } = await req.json(); // 👈 接收從前台傳來的 Base64 資料流清單

    if (!imageDatas || imageDatas.length < 3) {
      return NextResponse.json({ error: "❌ 請確保選取了 3 張圖片喔！" }, { status: 400 });
    }

    // 將 3 張 Base64 資料上傳到雲端相簿
    const uploadResponses = await Promise.all([
      cloudinary.uploader.upload(imageDatas[0], { folder: "toy_robot_upload" }),
      cloudinary.uploader.upload(imageDatas[1], { folder: "toy_robot_upload" }),
      cloudinary.uploader.upload(imageDatas[2], { folder: "toy_robot_upload" })
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
        // 疊加你的賣場 Logo (右下，需確認 Cloudinary 的 Media Library 有一張名為 my_logo 的圖)
        { overlay: "my_logo", width: 120, gravity: "south_east", x: 20, y: 20 }
      ]
    });

    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    console.error("Cloudinary Error:", error.message);
    return NextResponse.json({ error: `拼圖失敗：${error.message}` }, { status: 500 });
  }
}