"use client";
import { useState } from "react";

export default function HomePage() {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).slice(0, 3);
      if (selectedFiles.length < 3) {
        alert("❌ 請選取恰好 3 張圖片喔！");
        return;
      }
      setImages(selectedFiles);
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
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", textAlign: "center", backgroundColor: "#f0f0f0", minHeight: "100vh", color: "#333" }}>
      <h1 style={{ marginBottom: "30px" }}>玩具公仔「一鍵多圖拼貼」robot </h1>
      
      <div style={{ backgroundColor: "#fff", padding: "30px", borderRadius: "15px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", textAlign: "left" }}>
        <p style={{ fontWeight: "bold", fontSize: "18px" }}>步驟 1: 一次選取 3 張公仔照片</p>
        <input type="file" multiple accept="image/*" onChange={handleFileChange} style={{ marginBottom: "20px" }} />

        {previews.length > 0 && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "25px" }}>
            {previews.map((p, i) => (
              <img key={i} src={p} style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "8px" }} />
            ))}
          </div>
        )}

        <button 
          onClick={handleUpload} 
          disabled={status === "starting" || images.length < 3}
          style={{ width: "100%", padding: "18px", backgroundColor: "#0070f3", color: "#fff", border: "none", borderRadius: "8px", fontSize: "20px", fontWeight: "bold", cursor: "pointer" }}
        >
          {status === "starting" ? "⏳ AI 正在拼命美工中..." : `🚀 開始拼圖上架 (${images.length}/3)`}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: "40px" }}>
          <p style={{ color: "green", fontWeight: "bold" }}>✅ 拼圖成功！</p>
          <img src={result} style={{ maxWidth: "100%", borderRadius: "10px", border: "5px solid #fff" }} />
          <br />
          <a href={result} target="_blank" style={{ display: "inline-block", marginTop: "10px", color: "#0070f3" }}>點此下載高清原圖</a>
        </div>
      )}
    </div>
  );
}