"use client";
import { useState } from "react";

export default function UpscalePage() {
  const [images, setImages] = useState<File[]>([]); // 儲存選取的 3 張圖
  const [previews, setPreviews] = useState<string[]>([]); // 儲存預覽圖的 Base64
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).slice(0, 3); // 最多選 3 張
      if (selectedFiles.length < 3) {
        alert("❌ 請選取恰好 3 張圖片喔！");
        return;
      }
      setImages(selectedFiles);

      // 🏆 🏆 🏆 🏆 🏆 黃金：自動產生預覽圖 🏆 🏆 🏆 🏆 🏆
      const selectedPreviews: string[] = [];
      selectedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          selectedPreviews.push(reader.result as string);
          if (selectedPreviews.length === selectedFiles.length) {
            setPreviews(selectedPreviews);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleUpload = async () => {
    if (images.length < 3) return alert("❌ 請先選取 3 張圖片！");
    setStatus("starting");
    setResult(null);

    // 我們將 3 張 Base64 資料傳送給後台
    try {
      const res = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDatas: previews }), 
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
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", textAlign: "center", backgroundColor: "#f0f0f0", minHeight: "100vh" }}>
      <h1 style={{ color: "#333", marginBottom: "30px" }}>玩具公仔「一鍵多圖拼貼」robot </h1>
      
      <div style={{ backgroundColor: "#fff", padding: "30px", borderRadius: "15px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", textAlign: "left" }}>
        <p style={{ color: "#000", fontWeight: "bold", fontSize: "18px" }}>步驟 1: 一次選取 3 張公仔照片（主圖+細節A+細節B）</p>
        <input 
          type="file" multiple accept="image/*" onChange={handleFileChange} 
          style={{ marginBottom: "20px", display: "block" }}
        />

        {/* 🏆 🏆 🏆 🏆 🏆 預覽區域 🏆 🏆 🏆 🏆 🏆 */}
        {previews.length > 0 && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "25px" }}>
            {previews.map((preview, index) => (
              <div key={index} style={{ position: "relative" }}>
                <img src={preview} style={{ width: "150px", height: "150px", objectFit: "cover", borderRadius: "10px", border: "2px solid #ccc" }} />
                <div style={{ position: "absolute", top: "5px", right: "5px", backgroundColor: "rgba(0,0,0,0.5)", color: "#fff", padding: "3px 8px", borderRadius: "5px" }}>
                  圖 {index + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        <button 
          onClick={handleUpload} 
          disabled={status === "starting" || images.length < 3}
          style={{ 
            width: "100%", padding: "18px", 
            backgroundColor: images.length === 3 ? "#0070f3" : "#ccc", 
            color: "#fff", border: "none", borderRadius: "8px", 
            fontSize: "20px", fontWeight: "bold", cursor: "pointer" 
          }}
        >
          {status === "starting" ? "⏳ AI 正在拼命美工中..." : `🚀 開始拼圖上架 (${images.length}/3)`}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: "40px", textAlign: "center" }}>
          <p style={{ color: "green", fontSize: "18px", fontWeight: "bold" }}>✅ 拼圖成功！可以直接儲存上架了！</p>
          <img src={result} style={{ maxWidth: "100%", borderRadius: "10px", border: "2px solid #fff", boxShadow: "0 0 15px rgba(0,0,0,0.3)" }} />
        </div>
      )}
    </div>
  );
}