"use client";

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function UpscaleContent() {
  const searchParams = useSearchParams();
  const imgUrl = searchParams.get('imgUrl');
  const [upscaledUrl, setUpscaledUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleUpscale = async () => {
    if (!imgUrl) return;
    setLoading(true);
    setStatus("正在啟動 AI 引擎...");

    try {
      // 1. 領取號碼牌 (呼叫我們自己的 API)
      const res = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imgUrl }),
      });
      const prediction = await res.json();
      if (prediction.error) throw new Error(prediction.error);

      // 2. 開始排隊問進度
      let isFinished = false;
      while (!isFinished) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const checkRes = await fetch(`/api/upscale?id=${prediction.id}`);
        const result = await checkRes.json();

        if (result.status === "succeeded") {
          setUpscaledUrl(result.output);
          isFinished = true;
          setStatus("✨ 高清修復完成！");
        } else if (result.status === "failed") {
          throw new Error("AI 運算失敗");
        } else {
          setStatus(`目前進度: ${result.status}...`);
        }
      }
    } catch (error: any) {
      alert("錯誤: " + error.message);
      setStatus("修復失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-10 font-sans min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-8 text-blue-800">AI 圖片高清修復 (正式版)</h1>
      {imgUrl && (
        <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            <div className="text-center bg-white p-4 rounded-xl shadow">
              <p className="mb-3 font-semibold text-gray-600">原始圖片</p>
              <img src={imgUrl} alt="Original" className="w-full h-auto rounded-lg mx-auto" />
            </div>
            <div className="text-center bg-white p-4 rounded-xl shadow flex flex-col justify-center items-center min-h-[300px]">
              <p className="mb-3 font-semibold text-gray-600">修復結果</p>
              {upscaledUrl ? (
                <img src={upscaledUrl} alt="Upscaled" className="w-full h-auto rounded-lg border-4 border-green-400" />
              ) : (
                <div className="text-gray-400">{loading ? "AI 正在努力中..." : "等待中"}</div>
              )}
            </div>
          </div>
          <button onClick={handleUpscale} disabled={loading} className={`px-10 py-3 rounded-full font-bold text-white text-lg ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {loading ? "⚙️ 處理中..." : "🚀 開始高清修復"}
          </button>
          <p className="text-blue-500 font-bold">{status}</p>
        </div>
      )}
    </div>
  );
}

export default function UpscalePage() {
  return (
    <Suspense fallback={<div>載入中...</div>}>
      <UpscaleContent />
    </Suspense>
  );
}