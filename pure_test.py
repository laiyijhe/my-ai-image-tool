"""Minimal urllib + ssl test (no httpx). Set SUPABASE_URL or edit the default."""
import os
import ssl
import urllib.request

TARGET = os.environ.get("SUPABASE_URL", "https://your-project.supabase.co").rstrip("/")

print("--- 原始 urllib 測試 ---")
print(f"URL: {TARGET}")
context = ssl._create_unverified_context()
try:
    response = urllib.request.urlopen(TARGET, context=context, timeout=30)
    print(f"連線成功！狀態碼: {response.getcode()}")
except Exception as e:
    print(f"連線失敗: {e}")
