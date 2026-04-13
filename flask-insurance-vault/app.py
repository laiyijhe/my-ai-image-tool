"""
List and view PDFs from a local folder (default: ./insurance_pdf_vault).
Run: flask --app app run --debug
Or: python app.py
"""

from __future__ import annotations

import os
from pathlib import Path

import mimetypes

from flask import Flask, abort, jsonify, render_template_string, request, send_file, url_for

# Folder containing PDFs — override with env INSURANCE_VAULT_DIR
BASE_DIR = Path(__file__).resolve().parent
VAULT_DIR = Path(os.environ.get("INSURANCE_VAULT_DIR", BASE_DIR / "insurance_pdf_vault")).resolve()

# Names to hide from listings (dotfiles, OS junk, Office lock files).
_SYSTEM_FILE_NAMES_LOWER = frozenset(
    {
        "thumbs.db",
        "ehthumbs.db",
        "ehthumbs_vista.db",
        "desktop.ini",
    }
)


def _is_hidden_or_system_filename(name: str) -> bool:
    if not name or name.startswith("."):
        return True
    lower = name.lower()
    if lower in _SYSTEM_FILE_NAMES_LOWER:
        return True
    if lower.startswith("~$"):
        return True
    return False


app = Flask(__name__)


@app.after_request
def _cors(resp):
    """Allow Next.js (other origin) to fetch JSON and embed /view in an iframe."""
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Accept"
    return resp


@app.route("/api/files", methods=["GET", "OPTIONS"])
def api_files():
    if request.method == "OPTIONS":
        return ("", 204)
    VAULT_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for p in sorted(VAULT_DIR.iterdir(), key=lambda x: x.name.lower()):
        if not p.is_file():
            continue
        if _is_hidden_or_system_filename(p.name):
            continue
        try:
            size_kb = round(p.stat().st_size / 1024, 1)
        except OSError:
            size_kb = 0
        files.append(
            {
                "name": p.name,
                "size_kb": size_kb,
                "is_pdf": p.suffix.lower() == ".pdf",
            }
        )
    return jsonify({"vault_path": str(VAULT_DIR), "files": files})


def _safe_vault_path(name: str) -> Path | None:
    """Resolve a file inside VAULT_DIR only; reject path traversal."""
    if not name or name.strip() != name:
        return None
    if ".." in name or "/" in name or "\\" in name:
        return None
    base = VAULT_DIR.resolve()
    candidate = (base / name).resolve()
    try:
        candidate.relative_to(base)
    except ValueError:
        return None
    if not candidate.is_file():
        return None
    return candidate


LIST_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Insurance PDF vault</title>
  <style>
    :root { font-family: system-ui, sans-serif; }
    body { max-width: 56rem; margin: 2rem auto; padding: 0 1rem; color: #1e293b; }
    h1 { font-size: 1.5rem; }
    .path { font-size: 0.875rem; color: #64748b; word-break: break-all; margin-bottom: 1.5rem; }
    ul { list-style: none; padding: 0; }
    li { border: 1px solid #e2e8f0; border-radius: 0.5rem; margin-bottom: 0.5rem; padding: 0.75rem 1rem;
         display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
    .meta { font-size: 0.8125rem; color: #64748b; }
    .empty { color: #64748b; padding: 2rem; text-align: center; border: 1px dashed #cbd5e1; border-radius: 0.5rem; }
  </style>
</head>
<body>
  <h1>Insurance PDF vault</h1>
  <p class="path">Folder: <strong>{{ vault_path }}</strong></p>
    {% if not files %}
    <p class="empty">No files in this folder yet. Add PDFs to the vault directory and refresh.</p>
  {% else %}
    <ul>
      {% for f in files %}
      <li>
        <div>
          <span class="name">{{ f.name }}</span>
          <span class="meta">{{ f.size_kb }} KB</span>
        </div>
        {% if f.is_pdf %}
        <a href="{{ url_for('view_file', name=f.name) }}">View</a>
        {% else %}
        <a href="{{ url_for('serve_file', name=f.name) }}">Download</a>
        {% endif %}
      </li>
      {% endfor %}
    </ul>
  {% endif %}
</body>
</html>
"""


VIEW_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{ title }}</title>
  <style>
    :root { font-family: system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; }
    header {
      padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
      background: #f8fafc;
    }
    header a { color: #2563eb; text-decoration: none; font-weight: 500; }
    header a:hover { text-decoration: underline; }
    .name { font-weight: 600; color: #0f172a; }
    iframe { flex: 1; border: none; width: 100%; min-height: calc(100vh - 52px); }
  </style>
</head>
<body>
  <header>
    <a href="{{ url_for('index') }}">← Back to list</a>
    <span class="name">{{ title }}</span>
  </header>
  <iframe src="{{ pdf_url }}" title="{{ title }}"></iframe>
</body>
</html>
"""


def _list_files_payload():
    VAULT_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for p in sorted(VAULT_DIR.iterdir(), key=lambda x: x.name.lower()):
        if not p.is_file():
            continue
        if _is_hidden_or_system_filename(p.name):
            continue
        try:
            size_kb = round(p.stat().st_size / 1024, 1)
        except OSError:
            size_kb = 0
        files.append(
            {
                "name": p.name,
                "size_kb": size_kb,
                "is_pdf": p.suffix.lower() == ".pdf",
            }
        )
    return files


@app.route("/")
def index():
    accept = request.headers.get("Accept", "")
    if "application/json" in accept or request.args.get("format") == "json":
        files = _list_files_payload()
        return jsonify({"vault_path": str(VAULT_DIR), "files": files})
    files = _list_files_payload()
    return render_template_string(
        LIST_HTML,
        files=files,
        vault_path=str(VAULT_DIR),
    )


@app.route("/view/<path:name>")
def view_file(name: str):
    """Show PDF in page (iframe)."""
    path = _safe_vault_path(name)
    if path is None or path.suffix.lower() != ".pdf":
        abort(404)
    pdf_url = url_for("serve_file", name=name)
    return render_template_string(VIEW_HTML, title=name, pdf_url=pdf_url)


@app.route("/file/<path:name>")
def serve_file(name: str):
    """Serve file bytes (PDF inline for viewing; others as download)."""
    path = _safe_vault_path(name)
    if path is None:
        abort(404)
    mime, _ = mimetypes.guess_type(path.name)
    if mime is None:
        mime = "application/octet-stream"
    as_attachment = path.suffix.lower() != ".pdf"
    return send_file(
        path,
        mimetype=mime,
        as_attachment=as_attachment,
        download_name=name,
    )


if __name__ == "__main__":
    print(f"Vault directory: {VAULT_DIR}")
    app.run(host="127.0.0.1", port=5000, debug=True)
