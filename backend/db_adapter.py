"""Supabase adapter for GrantHarvester (content_hash dedupe + bulk insert)."""

from __future__ import annotations

import asyncio
import logging
from typing import List

from supabase import Client

from grant_harvester import GrantProgram

logger = logging.getLogger(__name__)


class SupabaseGrantDB:
    """傳入的 client 須為 ``db`` 模組內 ``create_client(..., options=ClientOptions(httpx_client=...))`` 的實例；勿在此類別內新建 client。"""

    def __init__(self, supabase_client: Client):
        self.client = supabase_client
        self.table_name = "grants"  # 與 Supabase 表名一致

    async def check_hash_exists(self, content_hash: str) -> bool:
        """檢查指紋是否已存在，實現省錢邏輯。"""

        def _run():
            result = (
                self.client.table(self.table_name)
                .select("id")
                .eq("content_hash", content_hash)
                .limit(1)
                .execute()
            )
            data = getattr(result, "data", None) or []
            return len(data) > 0

        try:
            return await asyncio.to_thread(_run)
        except Exception as e:
            logger.warning("Hash 檢查失敗: %s", e)
            return False

    async def save_many(self, programs: List[GrantProgram]) -> int:
        """Bulk insert into `grants`（除錯階段用 insert，方便看 PostgREST 錯誤）。"""
        if not programs:
            logger.info("DEBUG: AI 沒有產出任何補助計畫，所以跳過寫入。")
            return 0

        data_to_insert = [p.model_dump(mode="json") for p in programs]

        logger.info("DEBUG: 準備寫入 %s 筆資料到 Supabase...", len(data_to_insert))
        logger.info("DEBUG: 第一筆範例資料: %s", data_to_insert[0])

        # 暫時：檢查 httpx 客戶端是否真的關閉了驗證（supabase-py 無 .http_client，注入的在 options.httpx_client）
        http_client = getattr(self.client, "http_client", None) or getattr(
            self.client.options, "httpx_client", None
        )
        logger.info("DEBUG: Supabase SSL Verify Status: %s", getattr(http_client, "verify", http_client))

        try:

            def _run():
                return self.client.table(self.table_name).insert(data_to_insert).execute()

            res = await asyncio.to_thread(_run)
            if hasattr(res, "data"):
                count = len(res.data or [])
                logger.info("DEBUG: 成功存入 %s 筆資料！", count)
                return count
            logger.error("DEBUG: 寫入失敗，回傳內容: %s", res)
            return 0
        except Exception as e:
            logger.error("DEBUG: 發生例外狀況！錯誤訊息: %s", str(e))
            return 0
