"""Supabase client for the crawler (service role recommended; bypasses RLS)."""

from __future__ import annotations

import os
from typing import Any

import httpx
from dotenv import load_dotenv
from supabase import ClientOptions, create_client

load_dotenv()

# 確保 URL 和 KEY 有讀到（與舊變數名相容）
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
    "SUPABASE_KEY"
)

# None when env is missing so FastAPI can start without DB (match returns empty results).
supabase: Any | None
if supabase_url and supabase_key:
    # 蘋果式暴力法：強行禁用 TLS 驗證與環境干擾（僅限 dev/內網；正式環境請改回 verify=True）。
    client_config = httpx.Client(
        verify=False,
        trust_env=False,  # 核心：勿讀 HTTP(S)_PROXY 等，等於叫 httpx 忽視系統代理
        http2=True,
    )
    supabase = create_client(
        supabase_url,
        supabase_key,
        options=ClientOptions(httpx_client=client_config),
    )
else:
    supabase = None
