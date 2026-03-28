"use client";
import { useState } from "react";

export default function HomePage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!preview) return alert("❌ 請先選取一張照片！");
    setStatus("starting");
    setResult(null);
    try {
      const res = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDatas: [preview] }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setResult(data.url); // 👈 這裡會觸發下方圖片顯示
        setStatus("success");
      } else {
        alert("❌ 失敗原因：" + (data.error || "未知錯誤"));
        setStatus("error");
      }
    } catch (e) { 
      setStatus("error"); 
      alert("連線發生錯誤");
    }
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
            <p style={{ fontSize: "14px", color: "#888" }}>已選取：</p>
            <img src={preview} style={{ width: "100px", borderRadius: "8px" }} />
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
          {status === "starting" ? "⏳ 正在拼圖中..." : "🚀 生成一鍵上架拼圖"}
        </button>
      </div>

      {/* 🏆🏆🏆 關鍵！顯示結果的區塊 🏆🏆🏆 */}
      {result && (
        <div style={{ marginTop: "40px", padding: "20px", backgroundColor: "#fff", borderRadius: "15px" }}>
          <p style={{ color: "green", fontWeight: "bold", fontSize: "18px", marginBottom: "15px" }}>✅ 生成成功！</p>
          <img 
            src={result} 
            alt="Result"
            style={{ maxWidth: "100%", borderRadius: "10px", boxShadow: "0 5px 15px rgba(0,0,0,0.2)" }} 
          />
          <div style={{ marginTop: "20px" }}>
            <a 
              href={result} 
              target="_blank" 
              rel="noreferrer"
              style={{ padding: "10px 20px", backgroundColor: "#333", color: "#fff", textDecoration: "none", borderRadius: "5px" }}
            >
              📥 下載成品圖 (新視窗開啟)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}