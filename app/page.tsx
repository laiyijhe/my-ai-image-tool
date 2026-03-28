"use client";
import { useState } from "react";

export default function HomePage() {
  const [preview, setPreview] = useState<string | null>(null); // 只存一張預覽
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]; // 只抓第一張
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!preview) return alert("❌ 請先選取一張公仔照片！");
    setStatus("starting");
    setResult(null);
    try {
      const res = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDatas: [preview] }), // 只傳送這張圖
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setResult(data.url);
        setStatus("success");
      } else {
        alert("❌ 失敗原因：" + (data.error || "未知錯誤"));
        setStatus("error");
      }
    } catch (e) { setStatus("error"); }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", textAlign: "center", backgroundColor: "#f0f0f0", minHeight: "100vh", color: "#333" }}>
      <h1 style={{ marginBottom: "10px" }}>玩具公仔「自動美工機器人」 </h1>
      <p style={{ marginBottom: "30px", color: "#666" }}>上傳一張原圖，自動生成「大圖 + 兩張細節裁切圖」</p>
      
      <div style={{ backgroundColor: "#fff", padding: "30px", borderRadius: "15px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", textAlign: "left" }}>
        <p style={{ fontWeight: "bold", fontSize: "18px" }}>步驟 1: 選取一張公仔照片</p>
        <input type="file" accept="image/*" onChange={handleFileChange} style={{ marginBottom: "20px" }} />

        {preview && (
          <div style={{ marginBottom: "25px" }}>
            <p style={{ fontSize: "14px", color: "#888" }}>預覽原圖：</p>
            <img src={preview} style={{ width: "200px", height: "auto", borderRadius: "8px", border: "1px solid #ddd" }} />
          </div>
        )}

        <button 
          onClick={handleUpload} 
          disabled={status === "starting" || !preview}
          style={{ 
            width: "100%", padding: "18px", 
            backgroundColor: preview ? "#0070f3" : "#ccc", 
            color: "#fff", border: "none", borderRadius: "8px", 
            fontSize: "20px", fontWeight: "bold", cursor: "pointer" 
          }}
        >
          {status === "starting" ? "⏳ 機器人正在自動裁切與排版..." : "🚀 生成一鍵上架拼圖"}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: "40px" }}>
          <p style={{ color: "green", fontWeight: "bold", fontSize: "18px" }}>✅ 成果預覽 (包含主圖、細節與 Logo)：</p>
          <img src={result} style={{ maxWidth: "100%", borderRadius: "10px", border: "5px solid #fff", boxShadow: "0 5px 20px rgba(0,0,0,0.2)" }} />
          <br />
          <a href={result} target="_blank" download style={{ display: "inline-block", marginTop: "15px", padding: "10px 20px", backgroundColor: "#333", color: "#fff", textDecoration: "none", borderRadius: "5px" }}>下載成品圖</a>
        </div>
      )}
    </div>
  );
}