"""Content fingerprinting for deduplication before parsing."""

from __future__ import annotations

import hashlib


def generate_content_hash(html_content: str) -> str:
    """產生內容指紋，避免重複解析。"""
    # 只針對文字內容做 hash，忽略隨機生成的 ID 或時間戳記
    text_content = " ".join(html_content.split())
    return hashlib.sha256(text_content.encode("utf-8")).hexdigest()
