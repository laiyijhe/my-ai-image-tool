"use client";
import { useState } from "react";

export default function UpscalePage() {
  const [url1, setUrl1] = useState("");
  const [url2, setUrl2] = useState("");
  const [url3, setUrl3] = useState("");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!url1 || !url2 || !url3) return alert("❌ 請貼上 3 張圖片網址！");
    setStatus("starting");
    setResult(null);
    try {
      const res = await fetch("/api/upscale", { // 我們繼續沿用 api/upscale
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url1, url2, url3 }), // 👈 發送 3 個網址
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
    <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto", textAlign: "center", backgroundColor: "#f0f0f0", minHeight: "100vh" }}>
      <h1 style={{ color: "#333", marginBottom: "30px" }}>玩具公仔一鍵上架拼圖 robot </h1>
      
      <div style={{ backgroundColor: "#fff", padding: "30px", borderRadius: "15px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", textAlign: "left" }}>
        <p style={{ color: "#000", fontWeight: "bold" }}>1. 主圖照片網址</p>
        <input 
          type="text" value={url1} onChange={(e) => setUrl1(e.target.value)}
          placeholder="貼上主圖 https://..."
          style={{ width: "100%", padding: "12px", marginBottom: "15px", borderRadius: "5px", border: "2px solid #ccc", backgroundColor: "#fff", color: "#000" }}
        />
        <p style={{ color: "#000", fontWeight: "bold" }}>2. 細節照片 A 網址</p>
        <input 
          type="text" value={url2} onChange={(e) => setUrl2(e.target.value)}
          placeholder="貼上細節 A https://..."
          style={{ width: "100%", padding: "12px", marginBottom: "15px", borderRadius: "5px", border: "2px solid #ccc", backgroundColor: "#fff", color: "#000" }}
        />
        <p style={{ color: "#000", fontWeight: "bold" }}>3. 細節照片 B 網址</p>
        <input 
          type="text" value={url3} onChange={(e) => setUrl3(e.target.value)}
          placeholder="貼上細節 B https://..."
          style={{ width: "100%", padding: "12px", marginBottom: "25px", borderRadius: "5px", border: "2px solid #ccc", backgroundColor: "#fff", color: "#000" }}
        />
        <button 
          onClick={handleProcess} 
          disabled={status === "starting"}
          style={{ width: "100%", padding: "15px", backgroundColor: "#0070f3", color: "#fff", border: "none", borderRadius: "8px", fontSize: "18px", fontWeight: "bold", cursor: "pointer" }}
        >
          {status === "starting" ? "⏳ AI 正在拼命美工中..." : "🚀 開始一鍵拼圖上架"}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: "30px" }}>
          <p style={{ color: "green" }}>✅ 拼圖成功！可以直接儲存上架了！</p>
          <img src={result} style={{ width: "100%", borderRadius: "10px", border: "2px solid #fff" }} />
        </div>
      )}
    </div>
  );
}