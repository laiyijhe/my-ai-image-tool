"use client";

import { useState } from "react";

export default function UpscalePage() {
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleUpscale = async () => {
    if (!imageUrl) return alert("請貼上圖片網址！");
    
    setStatus("starting");
    setResult(null);
    setErrorMsg("");

    try {
      const response = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        setResult(data.url);
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.error || "修復失敗，請檢查 Token 或網址");
      }
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMsg("網路連線錯誤");
    }
  };

  return (
    <div style={{ 
      padding: "40px 20px", 
      maxWidth: "600px", 
      margin: "0 auto", 
      fontFamily: "sans-serif",
      backgroundColor: "#f4f4f4", // 給背景一點灰色，讓白色輸入框更明顯
      minHeight: "100vh",
      color: "#333"
    }}>
      <h1 style={{ textAlign: "center", color: "#0070f3", marginBottom: "30px" }}>
        ✨ AI 高清修復中心 ✨
      </h1>
      
      <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
        <p style={{ fontWeight: "bold", marginBottom: "10px", color: "#000" }}>
          1. 請貼上圖片網址：
        </p>
        
        <input 
          type="text" 
          placeholder="在此按右鍵貼上 https://..."
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          style={{ 
            width: "100%", 
            padding: "15px", 
            borderRadius: "8px", 
            border: "2px solid #0070f3", 
            color: "#000000",           // 強制黑字
            backgroundColor: "#ffffff",  // 強制白底
            fontSize: "16px",
            marginBottom: "20px",
            boxSizing: "border-box",
            display: "block"
          }}
        />

        <button 
          onClick={handleUpscale}
          disabled={status === "starting"}
          style={{ 
            width: "100%", 
            padding: "15px", 
            backgroundColor: status === "starting" ? "#ccc" : "#0070f3", 
            color: "white", 
            border: "none", 
            borderRadius: "8px", 
            cursor: "pointer", 
            fontSize: "18px",
            fontWeight: "bold",
            transition: "0.3s"
          }}
        >
          {status === "starting" ? "⏳ AI 正在拼命修復中..." : "🚀 開始高清修復"}
        </button>
      </div>

      <hr style={{ margin: "40px 0", border: "0.5px solid #ccc" }} />

      {status === "success" && result && (
        <div style={{ textAlign: "center", backgroundColor: "white", padding: "20px", borderRadius: "12px" }}>
          <h3 style={{ color: "green" }}>🎉 修復完成！</h3>
          <img 
            src={result} 
            alt="Result" 
            style={{ width: "100%", borderRadius: "8px", marginTop: "10px", border: "1px solid #ddd" }} 
          />
          <p style={{ marginTop: "15px", fontSize: "14px", color: "#666" }}>
            👆 長按圖片或點擊右鍵即可儲存
          </p>
        </div>
      )}

      {status === "error" && (
        <div style={{ 
          marginTop: "20px", 
          padding: "15px", 
          backgroundColor: "#ffebee", 
          color: "#c62828", 
          borderRadius: "8px",
          textAlign: "center",
          border: "1px solid #ef9a9a"
        }}>
          ❌ {errorMsg}
        </div>
      )}
    </div>
  );
}