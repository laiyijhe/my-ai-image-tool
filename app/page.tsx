"use client";

import { useState } from "react";

export default function UpscalePage() {
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState<string | null>(null);

  const handleUpscale = async () => {
    if (!imageUrl) return alert("請貼上圖片網址！");
    setStatus("starting");
    setResult(null);

    try {
      const response = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl }),
      });

      const data = await response.json();
      if (data.url) {
        setResult(data.url);
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>✨ AI 圖片高清修復中心 ✨</h1>
      
      <div style={{ marginBottom: "20px" }}>
        <p>1. 請在下方貼上圖片網址：</p>
        <input 
  type="text" 
  placeholder="請在此按右鍵貼上網址"
  value={imageUrl}
  onChange={(e) => setImageUrl(e.target.value)}
  style={{ 
    width: "100%", 
    padding: "15px", 
    borderRadius: "8px", 
    border: "3px solid #0070f3", // 藍色粗邊框
    color: "#000000",            // 強制純黑色文字
    backgroundColor: "#ffffff",   // 強制純白色背景
    fontSize: "16px",
    display: "block",
    outline: "none"
  }}
/>
      </div>

      <button 
        onClick={handleUpscale}
        disabled={status === "starting"}
        style={{ 
          width: "100%", padding: "15px", backgroundColor: "#0070f3", color: "white", 
          border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "16px" 
        }}
      >
        {status === "starting" ? "⏳ AI 正在拼命修復中..." : "🚀 開始高清修復"}
      </button>

      <hr style={{ margin: "30px 0" }} />

      {status === "success" && result && (
        <div style={{ textAlign: "center" }}>
          <h3>🎉 修復完成！</h3>
          <img src={result} alt="Result" style={{ width: "100%", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
          <p style={{ marginTop: "10px" }}>👆 長按圖片或點擊右鍵即可儲存</p>
        </div>
      )}

      {status === "error" && <p style={{ color: "red", textAlign: "center" }}>❌ 哎呀，修復失敗了，請檢查網址或稍後再試。</p>}
    </div>
  );
}