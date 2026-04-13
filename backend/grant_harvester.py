"""
Schema-first grant harvester shell: inject DB + AI clients for testability.

Wire implementations from crawler / FastAPI when you adopt async pipeline.
"""

from __future__ import annotations

import logging
import os
from typing import List, Optional, Protocol

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from pydantic import BaseModel, Field

from content_hash import generate_content_hash

logger = logging.getLogger(__name__)

_DEFAULT_USER_AGENT = "HereForGrant-Harvester/1.0 (Playwright)"


# --- 1. 嚴謹資料結構 (Schema-first) ---


class GrantProgram(BaseModel):
    title: str = Field(..., description="補助計畫名稱")
    max_amount: Optional[str] = None
    eligibility_tags: List[str] = Field(default_factory=list)
    summary: Optional[str] = None
    eligibility: Optional[str] = None
    link: Optional[str] = None
    raw_text: Optional[str] = None
    content_hash: Optional[str] = Field(
        default=None,
        description="SHA-256 of normalized page HTML; set after fetch for dedupe",
    )


# --- 2. 依賴介面：測試時可換成 Mock ---


class GrantDB(Protocol):
    async def check_hash_exists(self, content_hash: str) -> bool: ...

    async def save_many(self, programs: List[GrantProgram]) -> int: ...


class GrantAI(Protocol):
    async def extract(self, raw_content: str) -> List[GrantProgram]: ...


# --- 3. Harvester ---


class GrantHarvester:
    def __init__(self, db_client: GrantDB, ai_client: GrantAI):
        self.db = db_client
        self.ai = ai_client
        self.user_agent = os.environ.get("HARVESTER_USER_AGENT", _DEFAULT_USER_AGENT)
        self.timeout = int(os.environ.get("CRAWLER_PAGE_TIMEOUT_MS", "90000"))
        # 給 Ajax / 動態內容一點載入時間（毫秒）
        self.post_goto_wait_ms = int(os.environ.get("HARVESTER_POST_GOTO_WAIT_MS", "3000"))

    def strip_script_style_iframe(self, html: str) -> str:
        """Remove <script>, <style>, <iframe> before sending HTML to the LLM."""
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup.find_all(["script", "style", "iframe"]):
            tag.decompose()
        return str(soup)

    async def fetch(self, url: str) -> str:
        """Playwright async fetch; strips script/style/iframe before extract()."""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=self.user_agent,
                viewport={"width": 1280, "height": 800},
            )
            page = await context.new_page()
            try:
                await page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=self.timeout,
                )
                await page.wait_for_timeout(self.post_goto_wait_ms)
                raw_html = await page.content()
                return self.strip_script_style_iframe(raw_html)
            finally:
                await browser.close()

    async def harvest_one(self, url: str) -> int:
        """Returns number of new rows saved (embedding + grants flow).

        Observability-first: fetch and persist HTML before any DB/hash short-circuit.
        A broken DB connection must not skip AI extraction (duplicate check is best-effort).
        """
        logger.info("--- 啟動收割: %s ---", url)

        # 1. Fetch first — no Supabase; we need raw HTML even if later steps fail.
        try:
            cleaned_html = await self.fetch(url)
        except Exception as e:
            logger.error("DEBUG: Fetch failed for %s: %s", url, e)
            return 0

        # 2. Force debug snapshot to disk (inspect what the LLM will see).
        debug_path = os.environ.get(
            "HARVESTER_DEBUG_HTML_PATH",
            os.path.join(os.getcwd(), "last_debug_page.html"),
        )
        parent = os.path.dirname(debug_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        try:
            with open(debug_path, "w", encoding="utf-8") as f:
                f.write(cleaned_html)
            logger.info("DEBUG: Web content successfully saved to %s", debug_path)
        except OSError as e:
            logger.error(
                "DEBUG: Could not write debug HTML to %s (continuing): %s",
                debug_path,
                e,
            )

        # 3. Hash + duplicate check (non-blocking: SSL/DB errors → warn, continue to AI).
        new_hash: str | None = None
        try:
            new_hash = generate_content_hash(cleaned_html)
            is_duplicate = await self.db.check_hash_exists(new_hash)
            if is_duplicate:
                logger.info("Skipping %s: content unchanged", url)
                return 0
        except Exception as e:
            logger.warning(
                "Hash or database duplicate check failed (continuing to AI): %s", e
            )
            if new_hash is None:
                try:
                    new_hash = generate_content_hash(cleaned_html)
                except Exception as e2:
                    logger.error("generate_content_hash failed after DB error: %s", e2)
                    return 0

        # 4. AI extraction + persist (save failure is non-fatal for observability).
        try:
            programs = await self.ai.extract(cleaned_html)
        except Exception as e:
            logger.error(
                "harvest_failed",
                extra={"url": url, "error": str(e)},
            )
            return 0

        tagged = [
            p.model_copy(update={"content_hash": new_hash}) for p in programs
        ]
        try:
            return await self.db.save_many(tagged)
        except Exception as e:
            logger.warning("DEBUG: 資料提取成功但存入失敗 (SSL?): %s", e)
            logger.info(
                "DEBUG: 雖然存入失敗，但 AI 抓到的資料如下: %s",
                [p.model_dump(mode="json") for p in tagged],
            )
            return 0
