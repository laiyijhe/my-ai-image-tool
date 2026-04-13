"use client";

import { useEffect, useState } from "react";

type CrawlerPayload = {
  status: string;
  current_url?: string | null;
  last_heartbeat?: string | null;
  error_msg?: string | null;
};

const initial: CrawlerPayload = {
  status: "loading",
  current_url: "",
  last_heartbeat: "",
};

export default function CrawlerMonitor() {
  const [data, setData] = useState<CrawlerPayload>(initial);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/crawler-status");
      const json = (await res.json()) as CrawlerPayload;
      setData(json);
    } catch {
      setData((prev) => ({ ...prev, status: "api_error" }));
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, []);

  const getStatusUI = () => {
    switch (data.status) {
      case "running":
        return {
          color: "bg-green-500",
          text: "收割中...",
          icon: "🚀",
          animate: "animate-pulse",
        };
      case "sleeping":
        return {
          color: "bg-yellow-500",
          text: "休息中",
          icon: "😴",
          animate: "",
        };
      case "error":
        return {
          color: "bg-red-500",
          text: "發生錯誤",
          icon: "⚠️",
          animate: "animate-bounce",
        };
      case "loading":
        return {
          color: "bg-slate-500",
          text: "載入中...",
          icon: "⏳",
          animate: "animate-pulse",
        };
      case "api_error":
        return {
          color: "bg-orange-600",
          text: "API 連線失敗",
          icon: "📡",
          animate: "animate-pulse",
        };
      default:
        return {
          color: "bg-gray-500",
          text: "狀態未知",
          icon: "❓",
          animate: "",
        };
    }
  };

  const ui = getStatusUI();

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-700 bg-slate-800 p-8 shadow-2xl">
        <h1 className="mb-8 flex items-center gap-2 text-2xl font-bold">
          <span>🤖</span> 補助收割機監控台
        </h1>

        <div className="flex flex-col items-center py-12">
          <div
            className={`mb-6 flex h-32 w-32 items-center justify-center rounded-full ${ui.color} ${ui.animate} text-5xl shadow-[0_0_50px_rgba(0,0,0,0.3)]`}
          >
            {ui.icon}
          </div>
          <div className="text-4xl font-black tracking-widest">{ui.text}</div>
        </div>

        <div className="space-y-4 border-t border-slate-700 pt-8">
          <div className="flex justify-between text-slate-400">
            <span>最後心跳：</span>
            <span className="text-slate-200">
              {data.last_heartbeat || "---"}
            </span>
          </div>
          <div className="text-slate-400">
            <div className="mb-2">當前目標：</div>
            <div className="break-all rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-green-400">
              {data.current_url || "等待任務中..."}
            </div>
          </div>
          {data.error_msg ? (
            <div className="text-slate-400">
              <div className="mb-2">錯誤訊息：</div>
              <div className="break-all rounded-lg border border-red-900/50 bg-red-950/40 p-3 font-mono text-xs text-red-200">
                {data.error_msg}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        只要球在閃，你的 5 美金就正在變成資料庫裡的財富。
      </p>
    </div>
  );
}
