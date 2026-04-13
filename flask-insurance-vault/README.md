# Insurance PDF vault (Flask)

Lists files in `insurance_pdf_vault/` and opens PDFs in the browser.

## Setup

```bash
cd flask-insurance-vault
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

Put your PDFs (e.g. `418.pdf`) in `insurance_pdf_vault/`, or point elsewhere:

```bash
set INSURANCE_VAULT_DIR=C:\path\to\insurance_pdf_vault
```

## Run

```bash
python app.py
```

Open http://127.0.0.1:5000 — click **View** next to a PDF.
