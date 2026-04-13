"""Quick Supabase connectivity check (run from repo: python backend/test_connection.py or cd backend && python test_connection.py)."""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

from db import supabase


def test_connection() -> None:
    if supabase is None:
        print("連線略過：未設定 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（或 SUPABASE_KEY）。")
        return
    try:
        print("正在嘗試連線 Supabase...")
        res = supabase.table("sources").select("id").limit(1).execute()
        print(f"連線成功！拿到資料：{res.data}")
    except Exception as e:
        print(f"連線失敗，錯誤訊息：{e}")


if __name__ == "__main__":
    test_connection()
