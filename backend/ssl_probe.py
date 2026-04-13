"""底層 SSL / httpx 連線探測（對 SUPABASE_URL 發 GET，不帶 key）。

執行前請設定 ``SUPABASE_URL``（可搭配專案根目錄 ``.env``，本檔會 ``load_dotenv()``）。

Windows 若要強制使用 Python 3.12 跑測試（在 ``backend`` 目錄下）::

    py -3.12 ssl_probe.py

其他環境若已將 ``python3.12`` 放進 PATH，可改為 ``python3.12 ssl_probe.py``。
"""

from __future__ import annotations

import os
import ssl

import httpx
from dotenv import load_dotenv

load_dotenv()


def main() -> None:
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    if not url:
        print("請設定環境變數 SUPABASE_URL")
        return

    ref_ctx = ssl.create_default_context()
    print("--- 開始底層 SSL 測試 ---")
    print(f"Python SSL: {ssl.OPENSSL_VERSION}")
    print(f"預設 SSLContext.minimum_version: {getattr(ref_ctx, 'minimum_version', 'n/a')}")

    try:
        with httpx.Client(verify=False, trust_env=False) as client:
            resp = client.get(url, timeout=10.0)
            print(f"連線成功！狀態碼: {resp.status_code}")
    except Exception as e:
        print(f"連線失敗！具體錯誤類型: {type(e)}")
        print(f"具體訊息: {e}")

    # 強制指定較寬鬆的 cipher / SECLEVEL（須把此 context 傳給 verify= 才會生效）
    print("--- SECLEVEL=1 cipher 探測 ---")
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    try:
        context.set_ciphers("DEFAULT@SECLEVEL=1")
    except ssl.SSLError as e:
        print(f"set_ciphers 不支援此環境: {e}")
        return

    try:
        with httpx.Client(verify=context, trust_env=False) as client:
            resp = client.get(url, timeout=10.0)
            print("成功連線！")
            print(f"狀態碼: {resp.status_code}")
    except Exception as e:
        print(f"再次失敗: {e}")


if __name__ == "__main__":
    main()
