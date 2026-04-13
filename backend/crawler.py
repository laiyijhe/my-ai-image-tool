"""
Grant crawler: GrantHarvester (async Playwright HTML → content_hash dedupe → LLM JSON → embeddings + Supabase).

Legacy helper `process_grant_item` (Jina-only) remains for reference; `run_crawler_once` uses Harvester.

Iterates top-level government URLs (TARGET_SITES / env); no fragile listing CSS selectors.

Environment (high level):
  CRAWLER_BASE_URL — single top-level URL only.
  CRAWLER_TARGET_SITES — comma-separated URLs (overrides default TARGET_SITES).
  CRAWLER_EXTRACTION_MODEL — OpenAI model for program JSON (default: gpt-4o-mini).
  CRAWLER_SEED_URLS — comma-separated extra top-level URLs per run.
  GOOGLE_CSE_API_KEY, GOOGLE_CSE_ID — optional; Programmable Search to discover .gov.tw links.
  GOOGLE_CSE_QUERY — optional override for radar search (default: site:gov.tw 補助 115年度).
  JINA_API_KEY, JINA_READER_BASE — Jina Reader; pages fetched via https://r.jina.ai/<URL>
  CLI: python crawler.py --detail | python crawler.py https://... [title]

Expected tables (adjust column names in GRANTS_COLUMNS / GRANT_VECTORS_COLUMNS if yours differ):
  grants: id (uuid), title (text, unique), link (text), summary (text),
          max_amount (text), eligibility_tags (jsonb), raw_text (text), content_hash (text, optional)
  grant_vectors: grant_id (uuid fk -> grants.id), embedding (vector(1536))
"""

from __future__ import annotations

import json
import logging
import os
import re
import ssl
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Any, Callable, List, TypeVar
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from httpx import ConnectError, ConnectTimeout
from openai import APIConnectionError, APITimeoutError, OpenAI, RateLimitError
from playwright.sync_api import sync_playwright
from tenacity import (
    retry,
    retry_if_exception,
    retry_if_exception_type,
    stop_after_attempt,
    wait_fixed,
)

import asyncio

# 僅使用此模組單例（db 內以 httpx.Client(verify=…) 包進 create_client）；勿在其他檔案再次 create_client，否則 verify=False 等設定不會套用。
from db import supabase
from db_adapter import SupabaseGrantDB
from grant_harvester import GrantHarvester, GrantProgram
from radar import run_google_radar

T = TypeVar("T")

HTTP_RETRY_ATTEMPTS = 4  # initial try + up to 3 retries
HTTP_RETRY_WAIT_S = 5
OPENAI_RETRY_ATTEMPTS = 4
OPENAI_RETRY_WAIT_S = 5
DB_RETRY_WAIT_S = 10
_DB_TRANSIENT = (ConnectError, ConnectTimeout)

_openai_retryable = (
    RateLimitError,
    APIConnectionError,
    APITimeoutError,
)

def _db_execute(fn: Callable[[], T]) -> T:
    """
    Run a Supabase/PostgREST call; on connection failure wait and retry forever.
    Caller keeps arguments in closure so in-memory rows/embeddings are not dropped.
    """
    attempt = 0
    while True:
        try:
            return fn()
        except _DB_TRANSIENT as e:
            attempt += 1
            log.warning(
                "Supabase connection failed (attempt %s): %s; waiting %ss before "
                "retry (processed data kept in memory).",
                attempt,
                e,
                DB_RETRY_WAIT_S,
            )
            time.sleep(DB_RETRY_WAIT_S)


def _jina_retryable(exc: BaseException) -> bool:
    if isinstance(exc, requests.exceptions.HTTPError):
        resp = getattr(exc, "response", None)
        return resp is not None and resp.status_code == 429
    return isinstance(
        exc,
        (requests.exceptions.Timeout, requests.exceptions.ConnectionError),
    )


@retry(
    stop=stop_after_attempt(OPENAI_RETRY_ATTEMPTS),
    wait=wait_fixed(OPENAI_RETRY_WAIT_S),
    retry=retry_if_exception_type(_openai_retryable),
    reraise=True,
)
def _openai_chat_completions_create(client: OpenAI, **kwargs: Any) -> Any:
    return client.chat.completions.create(**kwargs)


@retry(
    stop=stop_after_attempt(OPENAI_RETRY_ATTEMPTS),
    wait=wait_fixed(OPENAI_RETRY_WAIT_S),
    retry=retry_if_exception_type(_openai_retryable),
    reraise=True,
)
def _openai_embeddings_create(client: OpenAI, **kwargs: Any) -> Any:
    return client.embeddings.create(**kwargs)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("crawler")

# 與 main.py /api/crawler-status 讀取路徑一致（Docker 下 cwd 通常為 /app）
CRAWLER_STATUS_PATH = os.getenv("CRAWLER_STATUS_PATH", "crawler_status.json")

_current_crawl_url: str | None = None
_between_rounds: bool = False  # True while sleeping between harvest iterations

OPENAI_MODEL = "gpt-4o-mini"
EXTRACTION_MODEL = os.environ.get("CRAWLER_EXTRACTION_MODEL", "gpt-4o-mini")
EMBED_MODEL = "text-embedding-3-small"
EMBED_DIM = 1536

# Structured Outputs: grant list extraction (requires model that supports json_schema, e.g. gpt-4o-mini).
GRANT_EXTRACTION_RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "grant_extraction",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "link": {"type": "string"},
                            "summary": {"type": "string"},
                            "max_amount": {"type": "string"},
                            "eligibility_tags": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "raw_text": {"type": "string"},
                        },
                        "required": [
                            "title",
                            "link",
                            "summary",
                            "max_amount",
                            "eligibility_tags",
                            "raw_text",
                        ],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["items"],
            "additionalProperties": False,
        },
    },
}

# Default listing sources (overridable via CRAWLER_BASE_URL or CRAWLER_TARGET_SITES)
TARGET_SITES: list[str] = [
    "https://www.yda.gov.tw/ch/News.aspx?n=297&sms=8861",
    "https://www.sme.gov.tw/article-tw-2275-9512",
    "https://grants.moc.gov.tw/Web/index.jsp",
]
LISTING_POST_LOAD_WAIT_MS = int(
    os.environ.get("CRAWLER_LISTING_WAIT_MS", "3000")
)


def get_target_site_urls() -> list[str]:
    """Single URL in CRAWLER_BASE_URL replaces the whole list; else CRAWLER_TARGET_SITES or TARGET_SITES."""
    one = os.environ.get("CRAWLER_BASE_URL", "").strip()
    if one:
        return [one]
    raw = os.environ.get("CRAWLER_TARGET_SITES", "").strip()
    if raw:
        return [u.strip() for u in raw.split(",") if u.strip()]
    return list(TARGET_SITES)


# Real detail page for forced single-URL runs: `python crawler.py --detail` or CLI URL
FORCED_DETAIL_TEST_URL = (
    "https://www.yda.gov.tw/ch/News_Content.aspx?n=297&sms=8861&s=124045"
)
LIST_ITEM_SELECTOR = os.environ.get("CRAWLER_LIST_ITEM_SELECTOR", ".list-item")
LIST_LINK_SELECTOR = os.environ.get("CRAWLER_LIST_LINK_SELECTOR", "a")
DETAIL_BODY_SELECTOR = os.environ.get("CRAWLER_DETAIL_BODY_SELECTOR", "body")
SLEEP_SECONDS = int(os.environ.get("CRAWLER_SLEEP_SECONDS", "3600"))
PAGE_TIMEOUT_MS = int(os.environ.get("CRAWLER_PAGE_TIMEOUT_MS", "90000"))
MAX_RAW_CHARS = int(os.environ.get("CRAWLER_MAX_RAW_CHARS", "120000"))
USE_PLAYWRIGHT_FOR_LIST = (
    os.environ.get("CRAWLER_USE_PLAYWRIGHT_LIST", "true").lower() == "true"
)
FALLBACK_REQUESTS = (
    os.environ.get("CRAWLER_FALLBACK_REQUESTS", "true").lower() == "true"
)

# Detail pages: Jina Reader (https://r.jina.ai/) returns clean markdown/text from messy gov HTML
USE_JINA_READER = (
    os.environ.get("CRAWLER_USE_JINA_READER", "true").lower() == "true"
)
JINA_READER_PREFIX = (
    os.environ.get("JINA_READER_BASE", "https://r.jina.ai").rstrip("/") + "/"
)

# Optional comma-separated absolute URLs merged into listing (for smoke tests / known subsidies)
SEED_URLS_RAW = os.environ.get("CRAWLER_SEED_URLS", "")

_CONTAINER_SELECTORS = (
    "main",
    "#main",
    "article",
    ".content",
    "#content",
    "#CP",
    ".main-content",
    ".News_List",
    ".list",
    "#List1",
    "table",
    ".container",
    "#center",
    "body",
)


def _link_matches_subsidy_keywords(title: str, href: str) -> bool:
    """Match 補助 / 計畫 / 公告 / Content (href or text) for aggressive extraction."""
    blob = f"{title} {href}"
    if any(k in blob for k in ("補助", "計畫", "公告")):
        return True
    if "content" in blob.lower():
        return True
    return False


def _looks_like_nav_or_noise(title: str, href: str) -> bool:
    t = title.strip().lower()
    if len(title.strip()) < 2:
        return True
    if t in ("首頁", "home", "english", "下一頁", "上一頁", "more", "回上一頁"):
        return True
    low = href.lower()
    if any(
        x in low
        for x in (".css", ".js", ".jpg", ".png", ".gif", ".pdf", "facebook.com", "line.me")
    ):
        return True
    return False


def _normalize_href(page_url: str, href: str) -> str:
    h = (href or "").strip()
    if not h or h.startswith("#"):
        return ""
    if h.lower().startswith(("javascript:", "mailto:", "tel:")):
        return ""
    if h.startswith(("http://", "https://")):
        return h.split("#")[0]
    return urljoin(page_url, h).split("#")[0]


def extract_link_items_from_soup(soup: BeautifulSoup, page_url: str) -> list[dict[str, str]]:
    """Primary: LIST_ITEM_SELECTOR; fallback: all plausible <a> in common layout containers."""
    items: list[dict[str, str]] = []
    seen: set[str] = set()

    for row in soup.select(LIST_ITEM_SELECTOR):
        a = row.select_one(LIST_LINK_SELECTOR)
        if not a or not a.get("href"):
            continue
        title = a.get_text(separator=" ", strip=True)
        full = _normalize_href(page_url, a["href"])
        if not full or _looks_like_nav_or_noise(title, full):
            continue
        if full not in seen:
            seen.add(full)
            items.append({"title": title, "link": full})

    if items:
        return items

    log.info(
        "No rows for selector %r — falling back to container <a> scan",
        LIST_ITEM_SELECTOR,
    )
    containers: list[Any] = []
    for sel in _CONTAINER_SELECTORS:
        containers.extend(soup.select(sel))
    if not containers:
        b = soup.body
        if b:
            containers = [b]
    seen.clear()
    for cont in containers:
        for a in cont.find_all("a", href=True):
            title = a.get_text(separator=" ", strip=True)
            full = _normalize_href(page_url, a["href"])
            if not full or full in seen:
                continue
            if _looks_like_nav_or_noise(title, full):
                continue
            seen.add(full)
            items.append({"title": title, "link": full})
            if len(items) >= 120:
                break
        if len(items) >= 120:
            break
    if items:
        return items

    log.info(
        "Container scan empty — aggressive keyword pass (補助|計畫|公告|Content)"
    )
    seen.clear()
    for a in soup.find_all("a", href=True):
        title = a.get_text(separator=" ", strip=True)
        full = _normalize_href(page_url, a["href"])
        if not full or full in seen:
            continue
        if _looks_like_nav_or_noise(title, full):
            continue
        if not _link_matches_subsidy_keywords(title, full):
            continue
        seen.add(full)
        display = title.strip() if title.strip() else full
        items.append({"title": display, "link": full})
        if len(items) >= 200:
            break
    return items


def fetch_title_quick(url: str) -> str:
    try:
        r = requests.get(
            url,
            timeout=20,
            headers={"User-Agent": "HereForGrant-Crawler/1.0"},
        )
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        if soup.title and soup.title.string:
            return re.sub(r"\s+", " ", soup.title.string).strip()[:240]
    except Exception as e:
        log.debug("fetch_title_quick failed: %s", e)
    path = urlparse(url).path.strip("/").split("/")[-1] or "subsidy"
    return path[:120]


def _item_for_detail_url(link: str, title_override: str | None = None) -> dict[str, str]:
    title = (title_override or "").strip() or fetch_title_quick(link)
    if not title:
        title = urlparse(link).netloc or "Subsidy"
    return {"title": title, "link": link}


def _single_items_from_env_or_argv() -> list[dict[str, str]] | None:
    argv = [a.strip() for a in sys.argv[1:] if a.strip()]

    if argv:
        if argv[0] in ("--detail", "-d", "--test-detail"):
            link = FORCED_DETAIL_TEST_URL
            title_opt = argv[1] if len(argv) > 1 else None
            log.info("CLI forced detail page (--detail): %s", link)
            return [_item_for_detail_url(link, title_opt)]
        if argv[0].lower().startswith(("http://", "https://")):
            link = argv[0]
            title_opt = argv[1] if len(argv) > 1 else None
            log.info("CLI direct detail URL (listing skipped): %s", link)
            return [_item_for_detail_url(link, title_opt)]

    single = os.environ.get("CRAWLER_SINGLE_URL", "").strip()
    if single:
        title = os.environ.get("CRAWLER_SINGLE_TITLE", "").strip() or None
        log.info("CRAWLER_SINGLE_URL mode (listing skipped): %s", single)
        return [_item_for_detail_url(single, title)]
    return None


def _openai() -> OpenAI:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not set.")
    return OpenAI(api_key=key)


def update_crawler_status(
    status: str,
    current_url: str | None = None,
    error: BaseException | None = None,
) -> None:
    """將爬蟲狀態寫入 JSON 檔案（供 GET /api/crawler-status）。"""
    status_data = {
        "status": status,
        "current_url": current_url,
        "last_heartbeat": time.strftime("%Y-%m-%d %H:%M:%S"),
        "error_msg": str(error) if error else None,
    }
    try:
        with open(CRAWLER_STATUS_PATH, "w", encoding="utf-8") as f:
            json.dump(status_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"無法寫入狀態檔: {e}")


def is_grant_exists(title: str) -> bool:
    if supabase is None:
        return False
    t = (title or "").strip()
    if not t:
        return True
    res = _db_execute(
        lambda: supabase.table("grants")
        .select("id")
        .eq("title", t)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def dedupe_items_by_link(items: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for it in items:
        lk = (it.get("link") or "").strip()
        if not lk or lk in seen:
            continue
        seen.add(lk)
        out.append(it)
    return out


def fetch_listing_requests(url: str) -> list[dict[str, str]]:
    res = requests.get(
        url, timeout=60, headers={"User-Agent": "HereForGrant-Crawler/1.0"}
    )
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")
    return extract_link_items_from_soup(soup, url)


def fetch_listing_playwright(url: str) -> list[dict[str, str]]:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.set_default_timeout(PAGE_TIMEOUT_MS)
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(LISTING_POST_LOAD_WAIT_MS)
            soup = BeautifulSoup(page.content(), "html.parser")
            return extract_link_items_from_soup(soup, page.url)
        finally:
            browser.close()


def fetch_listing(url: str) -> list[dict[str, str]]:
    if USE_PLAYWRIGHT_FOR_LIST:
        try:
            return fetch_listing_playwright(url)
        except Exception as e:
            log.warning("Playwright listing failed: %s", e)
            if FALLBACK_REQUESTS:
                log.info("Falling back to requests + BeautifulSoup.")
                return fetch_listing_requests(url)
            raise
    return fetch_listing_requests(url)


def fetch_detail_text_playwright(detail_url: str) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.set_default_timeout(PAGE_TIMEOUT_MS)
            page.goto(detail_url, wait_until="domcontentloaded")
            page.wait_for_timeout(1500)
            el = page.query_selector(DETAIL_BODY_SELECTOR)
            if el:
                return el.inner_text()[:MAX_RAW_CHARS]
            return page.inner_text("body")[:MAX_RAW_CHARS]
        finally:
            browser.close()


@retry(
    stop=stop_after_attempt(HTTP_RETRY_ATTEMPTS),
    wait=wait_fixed(HTTP_RETRY_WAIT_S),
    retry=retry_if_exception(_jina_retryable),
    reraise=True,
)
def _fetch_detail_text_jina_request(detail_url: str) -> str:
    """Single Jina Reader HTTP GET (retries on 429 / transient network errors)."""
    jina_url = f"{JINA_READER_PREFIX}{detail_url}"
    headers: dict[str, str] = {
        "User-Agent": "HereForGrant-Crawler/1.0 (Jina Reader)",
        "Accept": "text/plain,text/markdown,*/*",
    }
    key = os.environ.get("JINA_API_KEY", "").strip()
    if key:
        headers["Authorization"] = f"Bearer {key}"
    r = requests.get(jina_url, timeout=90, headers=headers)
    r.raise_for_status()
    return r.text[:MAX_RAW_CHARS]


def fetch_detail_text_jina(detail_url: str) -> str:
    """Fetch page via Jina Reader (`https://r.jina.ai/<url>`) — markdown/plain text, no DOM selectors."""
    return _fetch_detail_text_jina_request(detail_url)


def fetch_detail_text(detail_url: str) -> str:
    """
    Prefer Jina Reader for government pages; fall back to Playwright if empty or on error.
    Set CRAWLER_USE_JINA_READER=false to use only Playwright.
    """
    if USE_JINA_READER:
        try:
            text = fetch_detail_text_jina(detail_url)
            if text.strip():
                log.info(
                    "Jina Reader: %s chars for %s",
                    len(text),
                    detail_url[:100],
                )
                return text
            log.warning("Jina Reader returned empty body; using Playwright for %s", detail_url[:80])
        except Exception as e:
            log.warning("Jina Reader failed (%s); using Playwright", e)
    return fetch_detail_text_playwright(detail_url)


def _eligibility_to_tags(eligibility: str) -> list[str]:
    if not (eligibility or "").strip():
        return []
    parts = re.split(r"[,;，、\n]", eligibility)
    tags = [p.strip().lower()[:120] for p in parts if p.strip()]
    return tags[:30] or [eligibility.strip().lower()[:120]]


def extract_grant_programs_from_markdown(markdown: str, page_url: str) -> list[dict[str, Any]]:
    """
    LLM extracts grants via OpenAI Structured Outputs (json_schema / strict).
    Root object has key "items"; see GRANT_EXTRACTION_RESPONSE_FORMAT.
    """
    client = _openai()
    system = (
        "You are a senior data engineer at Apple. Your goal is to extract grant information "
        "with 100% schema accuracy.\n"
        "STRICT OUTPUT RULE: Return only one JSON object (no markdown fences, no commentary). "
        'It must have exactly one key \"items\" whose value is a JSON array of objects.\n\n'
        "FIELD MAPPING RULES:\n"
        '1. \"title\": The formal name of the grant/subsidy program.\n'
        '2. \"link\": The specific URL to the application page or detail page.\n'
        '3. \"summary\": A concise 2-3 sentence overview of the grant.\n'
        '4. \"max_amount\": The maximum funding value (e.g., \"5000000\" or \"Negotiable\").\n'
        '5. \"eligibility_tags\": A JSON array of strings (e.g., [\"SME\", \"Startup\", \"Artist\"]).\n'
        '6. \"raw_text\": A brief excerpt of the most important criteria.\n\n'
        "Each object in \"items\" must include exactly these keys: "
        "title, link, summary, max_amount, eligibility_tags, raw_text.\n"
        "Use empty string \"\" for unknown scalar fields and [] for eligibility_tags when none.\n"
        'If no grants apply, return {\"items\": []}.'
    )
    user = markdown[: min(len(markdown), MAX_RAW_CHARS)]
    resp = _openai_chat_completions_create(
        client,
        model=EXTRACTION_MODEL,
        response_format=GRANT_EXTRACTION_RESPONSE_FORMAT,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.15,
    )
    raw = (resp.choices[0].message.content or "").strip()
    data = json.loads(raw)
    items = data.get("items")
    if not isinstance(items, list):
        legacy = data.get("programs")
        items = legacy if isinstance(legacy, list) else []
    out: list[dict[str, Any]] = []
    for p in items:
        if not isinstance(p, dict):
            continue
        title = str(p.get("title", "")).strip()
        if not title:
            continue
        summary = str(p.get("summary", "")).strip()
        link = str(p.get("link", "")).strip()
        if link and not link.startswith(("http://", "https://")):
            link = urljoin(page_url, link)
        if not link:
            link = page_url
        max_amount = str(p.get("max_amount", "")).strip()
        raw_text = str(p.get("raw_text", "")).strip()
        tags_raw = p.get("eligibility_tags")
        if isinstance(tags_raw, list):
            eligibility_tags = [str(x).strip() for x in tags_raw if str(x).strip()]
        else:
            eligibility_tags = []
        eligibility = ", ".join(eligibility_tags) if eligibility_tags else ""
        out.append(
            {
                "title": title,
                "link": link,
                "summary": summary,
                "max_amount": max_amount,
                "eligibility_tags": eligibility_tags,
                "raw_text": raw_text,
                "eligibility": eligibility,
            }
        )
    return out


def extract_structured_fields(raw_text: str) -> dict[str, Any]:
    client = _openai()
    system = (
        "You extract structured data from government grant or subsidy program text. "
        "Respond with a single JSON object only, no markdown. "
        'Keys: "summary" (string, 2–6 sentences), '
        '"max_amount" (string; use the subsidy cap or award ceiling if stated, else empty string), '
        '"eligibility_tags" (array of short lowercase tags, e.g. youth, sme, startup).'
    )
    user = raw_text[: min(len(raw_text), MAX_RAW_CHARS)]
    resp = _openai_chat_completions_create(
        client,
        model=OPENAI_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
    )
    text = (resp.choices[0].message.content or "").strip()
    data = json.loads(text)
    summary = str(data.get("summary", "")).strip()
    max_amount = str(data.get("max_amount", "")).strip()
    tags = data.get("eligibility_tags") or []
    if not isinstance(tags, list):
        tags = []
    tags = [str(x).strip() for x in tags if str(x).strip()]
    return {
        "summary": summary,
        "max_amount": max_amount,
        "eligibility_tags": tags,
    }


def embed_summary(text: str) -> list[float]:
    client = _openai()
    t = (text or "").strip()
    if not t:
        t = " "
    r = _openai_embeddings_create(client, model=EMBED_MODEL, input=t[:8000])
    vec = r.data[0].embedding
    if len(vec) != EMBED_DIM:
        log.warning("Embedding length %s (expected %s)", len(vec), EMBED_DIM)
    return vec


def save_grant_and_vector(
    title: str,
    link: str,
    raw_text: str,
    structured: dict[str, Any],
    embedding: list[float],
    content_hash: str | None = None,
) -> None:
    grant_row = {
        "title": title.strip(),
        "link": link,
        "summary": structured["summary"],
        "max_amount": structured["max_amount"],
        "eligibility_tags": structured["eligibility_tags"],
        "raw_text": raw_text[: min(len(raw_text), 50000)],
    }
    if content_hash:
        grant_row["content_hash"] = content_hash
    ins = _db_execute(lambda: supabase.table("grants").insert(grant_row).execute())
    if not ins.data:
        raise RuntimeError("Insert into grants returned no row.")
    grant_id = ins.data[0]["id"]
    _db_execute(
        lambda: supabase.table("grant_vectors")
        .insert(
            {
                "grant_id": grant_id,
                "embedding": embedding,
            }
        )
        .execute()
    )
    log.info("Saved grant id=%s title=%r", grant_id, title[:80])


def save_extracted_program(program: dict[str, Any]) -> bool:
    """Insert one LLM-extracted program using existing embedding + `grants` / `grant_vectors` flow."""
    title = str(program.get("title", "")).strip()
    link = str(program.get("link", "")).strip()
    if not title:
        return False
    if is_grant_exists(title):
        log.info("Skip duplicate title: %s", title[:120])
        return False
    et = program.get("eligibility_tags")
    if isinstance(et, list):
        tag_list = [str(x).strip().lower()[:120] for x in et if str(x).strip()]
    else:
        tag_list = _eligibility_to_tags(str(program.get("eligibility", "")))
    structured = {
        "summary": str(program.get("summary", "")).strip(),
        "max_amount": str(program.get("max_amount", "")).strip(),
        "eligibility_tags": tag_list,
    }
    raw_text = str(program.get("raw_text", "")).strip()
    if not raw_text:
        raw_text = (
            f"{structured['summary']}\n\nEligibility: {program.get('eligibility', '')}"
        )
    emb = embed_summary(structured["summary"])
    ch = program.get("content_hash")
    save_grant_and_vector(
        title,
        link,
        raw_text,
        structured,
        emb,
        content_hash=str(ch).strip() if ch else None,
    )
    return True


class CrawlerGrantAI:
    """LLM 擷取（沿用 extract_grant_programs_from_markdown）；輸入為 Playwright 清理後 HTML 字串。"""

    def __init__(self, page_url: str):
        self.page_url = page_url

    async def extract(self, raw_content: str) -> List[GrantProgram]:
        def _run() -> List[GrantProgram]:
            programs = extract_grant_programs_from_markdown(raw_content, self.page_url)
            out: List[GrantProgram] = []
            for p in programs:
                tags = p.get("eligibility_tags")
                if not isinstance(tags, list):
                    tags = _eligibility_to_tags(str(p.get("eligibility", "")))
                else:
                    tags = [str(x).strip() for x in tags if str(x).strip()]
                out.append(
                    GrantProgram(
                        title=p["title"],
                        max_amount=(str(p.get("max_amount", "")).strip() or None),
                        eligibility_tags=tags,
                        summary=str(p.get("summary", "")).strip(),
                        eligibility=str(p.get("eligibility", "")).strip(),
                        link=(str(p.get("link", "")).strip() or self.page_url),
                        raw_text=(str(p.get("raw_text", "")).strip() or None),
                    )
                )
            return out

        return await asyncio.to_thread(_run)


class CrawlerHarvesterDB:
    """組合 SupabaseGrantDB：指紋檢查 + save_many（含 db_adapter 內 DEBUG log）。
    內部一律使用 ``from db import supabase`` 的實例，不接受外部注入，避免誤用未設定 verify 的 client。"""

    def __init__(self) -> None:
        from db import supabase as _sb

        if _sb is None:
            raise RuntimeError(
                "Supabase not configured (SUPABASE_URL / SUPABASE_KEY); cannot build CrawlerHarvesterDB."
            )
        self.real_db = SupabaseGrantDB(_sb)

    async def check_hash_exists(self, content_hash: str) -> bool:
        return await self.real_db.check_hash_exists(content_hash)

    async def save_many(self, programs: List[GrantProgram]) -> int:
        return await self.real_db.save_many(programs)


async def _harvest_urls_async(urls: list[str]) -> int:
    """GrantHarvester：Playwright 抓取 → 指紋 → LLM → 既有儲存流程。"""
    global _current_crawl_url
    total = 0
    for u in urls:
        log.info("--- %s", u)
        _current_crawl_url = u
        update_crawler_status("running", u)
        try:
            harvester = GrantHarvester(
                CrawlerHarvesterDB(),
                CrawlerGrantAI(u),
            )
            total += await harvester.harvest_one(u)
        except Exception:
            log.exception("URL failed after retries; skipping: %s", u[:180])
    return total


def process_grant_item(url: str) -> int:
    """
    Text-first pipeline for one top-level page URL:
    Jina Reader → Markdown → LLM JSON program list → save each program.
    Returns number of new rows saved.
    """
    log.info("process_grant_item (text-first): %s", url[:180])
    try:
        markdown = fetch_detail_text_jina(url)
    except Exception as e:
        log.error("Jina Reader failed for %s: %s", url[:120], e)
        return 0
    if not markdown.strip():
        log.warning("Empty Markdown from Jina for %s", url[:120])
        return 0
    try:
        programs = extract_grant_programs_from_markdown(markdown, url)
    except Exception:
        log.exception("LLM extraction failed for %s", url[:120])
        return 0
    if not programs:
        log.warning("LLM returned no programs for %s", url[:120])
        return 0
    log.info("LLM extracted %s program(s) from page", len(programs))
    saved = 0
    for prog in programs:
        try:
            if save_extracted_program(prog):
                saved += 1
        except Exception:
            log.exception("Save failed for %r", prog.get("title"))
    return saved


def _seed_urls_from_env() -> list[str]:
    if not SEED_URLS_RAW.strip():
        return []
    return [u.strip() for u in SEED_URLS_RAW.split(",") if u.strip()]


async def run_discovery_radar() -> list[str]:
    """Google CSE discovery; no-op if GOOGLE_CSE_API_KEY / GOOGLE_CSE_ID unset."""
    api_key = os.getenv("GOOGLE_CSE_API_KEY")
    cx = os.getenv("GOOGLE_CSE_ID")
    if not api_key or not cx:
        return []
    log.info("Radar scanning for new targets...")
    query = os.getenv("GOOGLE_CSE_QUERY", "site:gov.tw 補助 115年度")
    return await asyncio.to_thread(run_google_radar, api_key, cx, query)


async def _async_seed_mode_run() -> int:
    """Merge TARGET_SITES + CRAWLER_SEED_URLS + Google CSE links, then harvest."""
    seed_extra = _seed_urls_from_env()
    if seed_extra:
        log.info("CRAWLER_SEED_URLS: merging %s extra URL(s)", len(seed_extra))
    discovered_urls = await run_discovery_radar()
    if discovered_urls:
        log.info("Google CSE radar: %s link(s)", len(discovered_urls))
    urls: list[str] = []
    urls.extend(get_target_site_urls())
    for u in seed_extra:
        if u not in urls:
            urls.append(u)
    for u in discovered_urls:
        if u not in urls:
            urls.append(u)
    log.info("Top-level URLs (seed mode): %s", len(urls))
    return await _harvest_urls_async(urls)


def run_crawler_once(
    single_items: list[dict[str, str]] | None = None,
) -> None:
    global _current_crawl_url
    if supabase is None:
        log.error(
            "Supabase not configured (SUPABASE_URL / SUPABASE_KEY). Skipping crawl."
        )
        update_crawler_status(
            "error",
            None,
            error=RuntimeError(
                "Supabase not configured (SUPABASE_URL / SUPABASE_KEY)"
            ),
        )
        return
    try:
        if single_items is not None:
            log.info("Single run: %s top-level URL(s)", len(single_items))
            urls = [it["link"] for it in single_items]
            total_saved = asyncio.run(_harvest_urls_async(urls))
        else:
            total_saved = asyncio.run(_async_seed_mode_run())
        log.info("Run finished. New grant rows saved: %s", total_saved)
    finally:
        _current_crawl_url = None


def main_loop() -> None:
    """Fixed-interval harvest loop: full rest on success; 10s pause on crash before next round."""
    global _between_rounds
    rest = max(1, SLEEP_SECONDS)
    while True:
        try:
            _between_rounds = False
            log.info("=== 開始新一輪收割任務 ===")
            run_crawler_once()
            if rest == 3600:
                log.info("=== 任務完成，休息 1 小時 ===")
            else:
                log.info("=== 任務完成，休息 %s 秒 ===", rest)
        except KeyboardInterrupt:
            log.info("Interrupted.")
            break
        except Exception as e:
            log.error("!!! 核心崩潰: %s，10 秒後重試 !!!", e, exc_info=True)
            update_crawler_status("error", _current_crawl_url, error=e)
            time.sleep(10)
            continue
        _between_rounds = True
        update_crawler_status("sleeping")
        time.sleep(rest)


def main() -> None:
    single = _single_items_from_env_or_argv()
    if single is not None:
        log.info(
            "Direct detail crawl (listing skipped). Examples: "
            "python crawler.py --detail | python crawler.py <https://...> [title]"
        )
        try:
            run_crawler_once(single_items=single)
        except KeyboardInterrupt:
            log.info("Interrupted.")
        except Exception:
            log.exception("Single crawl failed.")
        return

    log.info(
        "HereForGrant crawler — main_loop() every %ss (CRAWLER_SLEEP_SECONDS); "
        "crash → 10s retry. Ctrl+C to stop.",
        SLEEP_SECONDS,
    )
    heartbeat_stop = threading.Event()

    def _heartbeat_loop() -> None:
        while not heartbeat_stop.wait(300):
            log.info(
                "[HEARTBEAT] Crawler is active at %s",
                datetime.now(timezone.utc).isoformat(),
            )
            if _between_rounds:
                update_crawler_status("sleeping")
            else:
                update_crawler_status("running", _current_crawl_url)

    heartbeat_thread = threading.Thread(target=_heartbeat_loop, daemon=True)
    heartbeat_thread.start()
    try:
        main_loop()
    finally:
        heartbeat_stop.set()


if __name__ == "__main__":
    print(f"目前工作目錄: {os.getcwd()}")
    print(f"目前執行的檔案路徑: {__file__}")
    print(
        f"環境變數中的代理: {os.environ.get('HTTP_PROXY')} / {os.environ.get('HTTPS_PROXY')}"
    )
    print(f"Python SSL 版本: {ssl.OPENSSL_VERSION}")
    print(f"預設協議版本: {ssl.SSLContext().protocol}")
    main()
