"""Google Programmable Search (Custom Search JSON API) — discover candidate grant URLs."""

from __future__ import annotations

import logging
from typing import Any

import requests

log = logging.getLogger(__name__)

GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"


def run_google_radar(api_key: str, cx_id: str, query: str) -> list[str]:
    """
    Run a Custom Search Engine query; return filtered links (e.g. News / Grant paths).

    Requires API key + Search Engine ID (cx) from Google Cloud / Programmable Search.
    """
    if not api_key or not cx_id or not (query or "").strip():
        log.warning("run_google_radar: missing api_key, cx_id, or query")
        return []

    params = {"key": api_key, "cx": cx_id, "q": query.strip()}
    try:
        res = requests.get(GOOGLE_CSE_URL, params=params, timeout=30)
        res.raise_for_status()
        data: dict[str, Any] = res.json()
    except requests.RequestException as e:
        log.error("Google CSE request failed: %s", e)
        return []
    except ValueError as e:
        log.error("Google CSE invalid JSON: %s", e)
        return []

    new_links: list[str] = []
    for item in data.get("items", []) or []:
        if not isinstance(item, dict):
            continue
        link = item.get("link")
        if not link or not isinstance(link, str):
            continue
        if "/News/" in link or "/Grant/" in link:
            new_links.append(link)
    return new_links
