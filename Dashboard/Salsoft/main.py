"""
FinFlow Finance Dashboard — FastAPI + SQLite backend
Run: python main.py
Open: http://localhost:5000
"""

import json
import os
import sqlite3
from contextlib import contextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse

app = FastAPI()
DB_PATH = os.path.join(os.path.dirname(__file__), "salsoft.db")

# ---------------------------------------------------------------------------
# Allowed store names (prevents SQL injection via route param)
# ---------------------------------------------------------------------------
VALID_STORES = {"transactions", "people", "audit_log", "settings"}


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        for store in VALID_STORES:
            conn.execute(
                f"CREATE TABLE IF NOT EXISTS {store} "
                f"(pk TEXT PRIMARY KEY, data TEXT NOT NULL)"
            )


# ---------------------------------------------------------------------------
# Serve the frontend
# ---------------------------------------------------------------------------
@app.get("/")
def index():
    return FileResponse(os.path.join(os.path.dirname(__file__), "finance-dashboard.html"))


# ---------------------------------------------------------------------------
# GET /api/data/{store}  — return all records
# ---------------------------------------------------------------------------
@app.get("/api/data/{store}")
def get_all(store: str):
    if store not in VALID_STORES:
        raise HTTPException(status_code=400, detail="invalid store")
    with get_db() as conn:
        rows = conn.execute(f"SELECT data FROM {store}").fetchall()
    return JSONResponse([json.loads(r["data"]) for r in rows])


# ---------------------------------------------------------------------------
# POST /api/data/{store}  — upsert one record
# ---------------------------------------------------------------------------
@app.post("/api/data/{store}")
async def put_one(store: str, request: Request):
    if store not in VALID_STORES:
        raise HTTPException(status_code=400, detail="invalid store")
    record: dict[str, Any] = await request.json()
    pk = record.get("key") if store == "settings" else record.get("id")
    if not pk:
        raise HTTPException(status_code=400, detail="missing primary key")
    with get_db() as conn:
        conn.execute(
            f"INSERT OR REPLACE INTO {store} (pk, data) VALUES (?, ?)",
            (str(pk), json.dumps(record)),
        )
    return {"ok": True}


# ---------------------------------------------------------------------------
# POST /api/data/{store}/batch  — upsert many records at once
# ---------------------------------------------------------------------------
@app.post("/api/data/{store}/batch")
async def put_batch(store: str, request: Request):
    if store not in VALID_STORES:
        raise HTTPException(status_code=400, detail="invalid store")
    records: list[dict[str, Any]] = await request.json()
    with get_db() as conn:
        for record in records:
            pk = record.get("key") if store == "settings" else record.get("id")
            if pk:
                conn.execute(
                    f"INSERT OR REPLACE INTO {store} (pk, data) VALUES (?, ?)",
                    (str(pk), json.dumps(record)),
                )
    return {"ok": True, "count": len(records)}


# ---------------------------------------------------------------------------
# DELETE /api/data/{store}/{pk}  — delete one record
# ---------------------------------------------------------------------------
@app.delete("/api/data/{store}/{pk:path}")
def delete_one(store: str, pk: str):
    if store not in VALID_STORES:
        raise HTTPException(status_code=400, detail="invalid store")
    with get_db() as conn:
        conn.execute(f"DELETE FROM {store} WHERE pk = ?", (pk,))
    return {"ok": True}


# ---------------------------------------------------------------------------
# DELETE /api/data/{store}  — clear entire store
# ---------------------------------------------------------------------------
@app.delete("/api/data/{store}")
def clear_store(store: str):
    if store not in VALID_STORES:
        raise HTTPException(status_code=400, detail="invalid store")
    with get_db() as conn:
        conn.execute(f"DELETE FROM {store}")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    print("Solsoft server running → http://localhost:5000")
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)


