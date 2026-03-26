"use client";
import { useState } from "react";

export default function UpscalePage() {
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState<string | null>(null);

  const handleUpscale = async () => {
    if (!imageUrl) return alert("請貼上網址");
    setStatus("starting");
    try {
      const res = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl }),
      });
      const data = await res.json();
      if (data.url) { setResult(data.url); setStatus("success"); }
      else { setStatus("error"); alert("錯誤: " + (data.error || "未知")); }
    } catch (e) { setStatus("error"); }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "500px", margin: "0 auto", textAlign: "center", color: "#000" }}>
      <h2 style={{ color: "#0070f3" }}>🚀 AI 高清修復</h2>
      <input 
  type="text" 
  value={imageUrl} 
  onChange={(e) => setImageUrl(e.target.value)}
  placeholder="在此按右鍵貼上網址"
  style={{ 
    width: "100%", 
    padding: "20px", 
    border: "5px solid red",    // 暫時改成紅色粗邊框，用來測試！
    backgroundColor: "white",   // 強制白底
    color: "black",             // 強制黑字
    fontSize: "20px",           // 字體加大
    display: "block"
  }}
/>
    </div>
  );
}