"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function UpscaleContent() {
  const searchParams = useSearchParams();
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const url = searchParams.get('imgUrl');
    if (url) setImgUrl(url);
  }, [searchParams]);

  const handleUpscale = async () => {
    if (!imgUrl) return;
    setLoading(true);
    try {
      const response = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imgUrl }),
      });
      const data = await response.json();
      if (data.image?.url) {
        setResultImage(data.image.url);
      } else {
        alert("修復失敗");
      }
    } catch (error) {
      alert("連線錯誤");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>✨ AI 修復中心 ✨</h1>
      {imgUrl && <img src={imgUrl} style={{ maxWidth: '300px' }} />}
      <br />
      <button onClick={handleUpscale} disabled={loading}>
        {loading ? "處理中..." : "🚀 開始修復"}
      </button>
      <br />
      {resultImage && <img src={resultImage} style={{ maxWidth: '500px', marginTop: '20px' }} />}
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