"""
FastAPI app for HereForGrant: health check and semantic match against `grant_vectors`.

Run with Uvicorn bound to all interfaces so Docker/other containers can reach it:
  uvicorn main:app --host 0.0.0.0 --port 8000
(Listening only on 127.0.0.1 would block traffic from the frontend container.)
"""

from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="HereForGrant API", version="0.1.0")

def _cors_origins() -> list[str]:
    raw = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3005,http://127.0.0.1:3005,*",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EMBED_MODEL = "text-embedding-3-small"
# Supabase SQL RPC (pgvector); override if your function name differs
MATCH_RPC_NAME = os.environ.get("SUPABASE_MATCH_RPC", "match_grants_vector")


def _openai() -> OpenAI:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured.",
        )
    return OpenAI(api_key=key)


class MatchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User question or search text")
    match_count: int = Field(5, ge=1, le=50)


class MatchResponse(BaseModel):
    matches: list[dict[str, Any]]
    detail: str | None = None


def _embed_query(text: str) -> list[float]:
    client = _openai()
    t = text.strip()[:8000] or " "
    r = client.embeddings.create(model=EMBED_MODEL, input=t)
    return r.data[0].embedding


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/crawler-status")
async def get_crawler_status() -> dict[str, Any]:
    status_path = os.getenv("CRAWLER_STATUS_PATH", "crawler_status.json")
    if os.path.exists(status_path):
        try:
            with open(status_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"status": "error", "message": "Read status failed"}

    return {
        "status": "unknown",
        "current_url": None,
        "last_heartbeat": None,
        "error_msg": "Status file not found",
    }


@app.post("/match", response_model=MatchResponse)
def match_grants(req: MatchRequest) -> MatchResponse:
    """
    Embed `query` and call Supabase RPC (default `match_grants_vector`).
    On any failure (embedding, RPC, wrong vector shape, no rows), returns 200 with
    `matches: []` so the Next.js proxy does not surface 502 to the browser.
    """
    from db import supabase as db_client

    q = req.query.strip()
    if not q:
        raise HTTPException(status_code=400, detail="query must not be empty")

    if db_client is None:
        return MatchResponse(
            matches=[],
            detail="Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
        )

    try:
        embedding = _embed_query(q)
        res = db_client.rpc(
            MATCH_RPC_NAME,
            {
                "query_embedding": embedding,
                "match_count": req.match_count,
            },
        ).execute()
        rows = res.data if isinstance(res.data, list) else []
        return MatchResponse(matches=rows)
    except Exception as e:
        print(f"Search failed: {e}")
        return MatchResponse(matches=[], detail=str(e))
