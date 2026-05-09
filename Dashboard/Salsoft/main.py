"""
FinFlow Finance Dashboard — FastAPI + SQLite backend
Run: python main.py
Open: http://localhost:5000
"""

import json
import os
import sqlite3
import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any
from urllib.request import urlopen

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()


def _should_enable_reload() -> bool:
    if getattr(sys, "frozen", False):
        return False
    return sys.gettrace() is None


def _uvicorn_app_target() -> str:
    return f"{os.path.splitext(os.path.basename(__file__))[0]}:app"

def _runtime_dir() -> str:
    # In PyInstaller onefile, bundled assets are extracted under _MEIPASS.
    if getattr(sys, "frozen", False):
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def _writable_dir() -> str:
    # Keep writable DB files next to the executable when frozen.
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


RUNTIME_DIR = _runtime_dir()
WRITABLE_DIR = _writable_dir()

app.mount("/css", StaticFiles(directory=os.path.join(RUNTIME_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(RUNTIME_DIR, "js")), name="js")
DB_PATH = os.path.join(WRITABLE_DIR, "salsoft.db")
ACCESS_DB_PATH = os.path.join(WRITABLE_DIR, "salsoft_access.db")
USD_RATES_URL_TEMPLATE = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/currencies/usd.json"
ACCESS_TRANSACTIONS_TABLE = "transactions_fact"

TRANSACTION_COLUMNS = [
    "Transaction ID",
    "File Name",
    "Upload Date",
    "People",
    "Parent Companies",
    "Company",
    "Regions",
    "Bank Types",
    "Bank",
    "Account No.",
    "Currency",
    "Currency Rate",
    "Date",
    "Date 2",
    "Status",
    "Name",
    "Category",
    "Reference ID",
    "Reference",
    "Txn Reference",
    "Description",
    "Inter Division",
    "Net Amount",
    "Fee",
    "VAT",
    "Amount",
    "Balance",
    "Net Amount USD",
    "Fee USD",
    "VAT USD",
    "Amount USD",
    "Balance USD",
    "Is Split",
    "CreatedDate",
    "UpdatedDate",
    "LastModification",
]

TRANSACTION_NUMERIC_COLUMNS = {
    "Net Amount",
    "Fee",
    "VAT",
    "Amount",
    "Currency Rate",
    "Balance",
    "Net Amount USD",
    "Fee USD",
    "VAT USD",
    "Amount USD",
    "Balance USD",
}

TRANSACTION_DB_COLUMN_MAP = {
    "Account No.": "Account No",
}


def _normalize_key(txt: str) -> str:
    return "".join(ch for ch in str(txt or "").lower() if ch.isalnum())


TRANSACTION_COLUMN_BY_NORM = {_normalize_key(c): c for c in TRANSACTION_COLUMNS}


def _txn_db_column(label: str) -> str:
    return TRANSACTION_DB_COLUMN_MAP.get(label, label)


def _ensure_access_column(conn, table_name: str, column_name: str, access_type: str) -> None:
    cur = conn.cursor()
    try:
        existing = {str(r[1]).strip().lower() for r in cur.execute(f"PRAGMA table_info([{table_name}])").fetchall()}
    except Exception:
        existing = set()
    if str(column_name).strip().lower() in existing:
        return
    try:
        cur.execute(f"ALTER TABLE [{table_name}] ADD COLUMN [{column_name}] {access_type}")
    except Exception:
        pass


def _transaction_id_from_record(record: dict[str, Any]) -> str:
    for key in ["Transaction ID", "transactionId", "transaction_id", "id"]:
        value = record.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _value_for_transaction_column(record: dict[str, Any], column: str) -> Any:
    if column in record:
        return record.get(column)

    target = _normalize_key(column)
    for k, v in record.items():
        if _normalize_key(str(k)) == target:
            return v

    if column == "Transaction ID":
        return _transaction_id_from_record(record)
    return None


def _to_float_or_none(value: Any) -> float | None:
    if value is None:
        return None
    txt = str(value).strip()
    if not txt:
        return None
    try:
        return float(txt)
    except Exception:
        return None


def _to_bool_or_none(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    txt = str(value).strip().lower()
    if txt in {"1", "true", "yes", "y"}:
        return True
    if txt in {"0", "false", "no", "n"}:
        return False
    return None


def _lookup_currency_rate(conn, txn_date: str, currency_code: str) -> float | None:
    """Return USD rate for the given currency on txn_date (or latest available)."""
    code = _to_api_currency(str(currency_code or "").strip().upper())
    if not code:
        return None
    cur = conn.cursor()
    # Exact date first
    date_key = str(txn_date or "").strip()[:10]
    if date_key:
        try:
            row = cur.execute(
                "SELECT i.usd_rate FROM currency_rates_daily_items AS i "
                "INNER JOIN currency_rates_daily AS d ON i.daily_rate_id = d.id "
                "WHERE d.rate_date = ? AND i.currency_code = ?",
                (date_key, code),
            ).fetchone()
            if row and row[0] is not None:
                return float(row[0])
        except Exception:
            pass
    # Fallback: latest available rate for that currency
    try:
        row = cur.execute(
            "SELECT i.usd_rate FROM currency_rates_daily_items AS i "
            "INNER JOIN currency_rates_daily AS d ON i.daily_rate_id = d.id "
            "WHERE i.currency_code = ? ORDER BY d.rate_date DESC, d.id DESC LIMIT 1",
            (code,),
        ).fetchone()
        if row and row[0] is not None:
            return float(row[0])
    except Exception:
        pass
    return None


def _upsert_access_transaction(conn, record: dict[str, Any]) -> str:
    tx_id = _transaction_id_from_record(record)
    if not tx_id:
        raise HTTPException(status_code=400, detail="missing primary key")

    now_iso = datetime.now(timezone.utc).isoformat()
    row_map: dict[str, Any] = {}
    for col in TRANSACTION_COLUMNS:
        value = _value_for_transaction_column(record, col)
        if col == "Transaction ID":
            value = tx_id
        elif col in {"UpdatedDate", "LastModification"}:
            value = now_iso
        elif col == "CreatedDate" and (value is None or str(value).strip() == ""):
            value = now_iso

        if col in TRANSACTION_NUMERIC_COLUMNS:
            value = _to_float_or_none(value)
        elif col == "Is Split":
            value = _to_bool_or_none(value)
        elif value is not None:
            value = str(value)

        row_map[col] = value

    # Auto-fill Currency Rate from rates table when not provided in the record.
    if row_map.get("Currency Rate") is None:
        rate = _lookup_currency_rate(
            conn,
            str(row_map.get("Date") or "").strip(),
            str(row_map.get("Currency") or "").strip(),
        )
        if rate is not None:
            row_map["Currency Rate"] = rate

    # Compute USD columns: Original_Amount / Currency_Rate
    usd_rate = row_map.get("Currency Rate")
    for _field in ("Net Amount", "Fee", "VAT", "Amount", "Balance"):
        original = row_map.get(_field)
        if original is not None and usd_rate:
            try:
                row_map[f"{_field} USD"] = round(float(original) / float(usd_rate), 10)
            except (TypeError, ValueError, ZeroDivisionError):
                row_map[f"{_field} USD"] = None
        else:
            row_map[f"{_field} USD"] = None

    cur = conn.cursor()
    cur.execute(f"DELETE FROM [{ACCESS_TRANSACTIONS_TABLE}] WHERE [Transaction ID] = ?", (tx_id,))

    col_sql = ", ".join([f"[{_txn_db_column(c)}]" for c in TRANSACTION_COLUMNS])
    placeholders = ", ".join(["?" for _ in TRANSACTION_COLUMNS])
    values = [row_map[c] for c in TRANSACTION_COLUMNS]
    cur.execute(
        f"INSERT INTO [{ACCESS_TRANSACTIONS_TABLE}] ({col_sql}) VALUES ({placeholders})",
        values,
    )
    return tx_id


def _get_all_access_transactions(conn) -> list[dict[str, Any]]:
    cur = conn.cursor()

    company_parent_region: dict[str, tuple[str, str]] = {}
    try:
        crows = cur.execute(
            "SELECT c.name, pc.name, rg.code "
            "FROM companies_dim AS c "
            "LEFT JOIN parent_companies AS pc ON c.parent_company_id = pc.id "
            "LEFT JOIN regions AS rg ON c.region_id = rg.id"
        ).fetchall()
        for row in crows:
            company = str(row[0] or "").strip()
            if not company:
                continue
            parent = str(row[1] or "").strip()
            region = str(row[2] or "").strip()
            company_parent_region[company] = (parent, region)
    except Exception:
        company_parent_region = {}

    exact_rate_map: dict[tuple[str, str], float] = {}
    latest_rate_map: dict[str, float] = {}
    try:
        rate_rows = cur.execute(
            "SELECT d.rate_date, i.currency_code, i.usd_rate "
            "FROM currency_rates_daily_items AS i "
            "INNER JOIN currency_rates_daily AS d ON i.daily_rate_id = d.id "
            "ORDER BY d.rate_date DESC, d.id DESC"
        ).fetchall()
        for row in rate_rows:
            date_key = str(row[0] or "").strip()[:10]
            code = str(row[1] or "").strip().upper()
            try:
                rate_val = float(row[2])
            except Exception:
                continue
            if not date_key or not code:
                continue
            exact_rate_map[(date_key, code)] = rate_val
            if code not in latest_rate_map:
                latest_rate_map[code] = rate_val
    except Exception:
        exact_rate_map = {}
        latest_rate_map = {}

    col_sql = ", ".join([f"[{_txn_db_column(c)}]" for c in TRANSACTION_COLUMNS])
    rows = cur.execute(f"SELECT {col_sql} FROM [{ACCESS_TRANSACTIONS_TABLE}] ORDER BY [id] DESC").fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        rec: dict[str, Any] = {}
        for i, col in enumerate(TRANSACTION_COLUMNS):
            rec[col] = r[i]

        company = str(rec.get("Company") or "").strip()
        if company and company in company_parent_region:
            parent, region = company_parent_region[company]
            if not str(rec.get("Parent Companies") or "").strip() and parent:
                rec["Parent Companies"] = parent
            if not str(rec.get("Regions") or "").strip() and region:
                rec["Regions"] = region

        # Capture the row's own stored Currency Rate (used for USD computation).
        stored_rate: float | None = None
        _raw_stored = rec.get("Currency Rate")
        if _raw_stored is not None:
            try:
                stored_rate = float(_raw_stored)
            except (TypeError, ValueError):
                pass

        # Optionally refresh Currency Rate display from rates table.
        txn_date = str(rec.get("Date") or "").strip()[:10]
        currency = _to_api_currency(str(rec.get("Currency") or "").strip())
        table_rate: float | None = None
        if txn_date and currency:
            table_rate = exact_rate_map.get((txn_date, currency))
            if table_rate is None:
                table_rate = latest_rate_map.get(currency)
        if table_rate is not None:
            rec["Currency Rate"] = table_rate

        # USD computation: stored row rate first, fall back to table rate.
        # Formula: USD = Original_Amount / Currency_Rate
        usd_rate = stored_rate if stored_rate is not None else table_rate
        if usd_rate:
            for _f in ("Net Amount", "Fee", "VAT", "Amount", "Balance"):
                orig = rec.get(_f)
                if orig is not None:
                    try:
                        rec[f"{_f} USD"] = round(float(orig) / usd_rate, 10)
                    except (TypeError, ValueError, ZeroDivisionError):
                        rec[f"{_f} USD"] = None
                else:
                    rec[f"{_f} USD"] = None

        rec["id"] = rec.get("Transaction ID")
        out.append(rec)
    return out


def _to_api_currency(code: str) -> str:
    c = str(code or "").strip().upper()
    if c == "EURO":
        return "EUR"
    return c


@app.on_event("startup")
def startup_init() -> None:
    # Ensure both SQLite + Access schemas exist for each app worker.
    init_db()

# ---------------------------------------------------------------------------
# Allowed store names (prevents SQL injection via route param)
# ---------------------------------------------------------------------------
VALID_STORES = {"transactions", "people", "audit_log", "settings"}
ACCESS_JSON_STORES = {
    "people": "people_store",
    "audit_log": "audit_log_store",
}


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


@contextmanager
def get_access_db():
    conn = sqlite3.connect(ACCESS_DB_PATH)
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

    with get_access_db() as conn:
        cur = conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")

        # Add `people` column to accounts_dim if not present (migration).
        _ensure_access_column(conn, "accounts_dim", "people", "TEXT")

        # Remaining Access schema init (tables, views, migration).
        for ddl in [
            "CREATE TABLE IF NOT EXISTS parent_companies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_parent_companies_name ON parent_companies(name)",
            "CREATE TABLE IF NOT EXISTS regions (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_regions_code ON regions(code)",
            "CREATE TABLE IF NOT EXISTS companies_dim (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, parent_company_id INTEGER, region_id INTEGER, primary_color TEXT, secondary_color TEXT)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_companies_dim_name ON companies_dim(name)",
            "CREATE TABLE IF NOT EXISTS bank_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_bank_types_name ON bank_types(name)",
            "CREATE TABLE IF NOT EXISTS banks_dim (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, primary_short_name TEXT, child_short_names TEXT)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_banks_dim_name ON banks_dim(name)",
            "CREATE TABLE IF NOT EXISTS currencies_dim (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, usd_rate REAL, rate_date TEXT)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_currencies_dim_code ON currencies_dim(code)",
            "CREATE TABLE IF NOT EXISTS beginning_balance_keywords_dim (id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT NOT NULL)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_bbk_dim_keyword ON beginning_balance_keywords_dim(keyword)",
            "CREATE TABLE IF NOT EXISTS accounts_dim (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, bank_id INTEGER NOT NULL, bank_type_id INTEGER NOT NULL, currency_id INTEGER NOT NULL, region_id INTEGER NOT NULL, account_number TEXT NOT NULL, people TEXT)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_unique ON accounts_dim(company_id, bank_id, bank_type_id, currency_id, region_id, account_number)",
            "CREATE TABLE IF NOT EXISTS currency_rates_daily (id INTEGER PRIMARY KEY AUTOINCREMENT, rate_date TEXT NOT NULL, aed REAL, gbp REAL, pkr REAL, euro REAL, usd REAL)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_currency_rates_daily_date ON currency_rates_daily(rate_date)",
            "CREATE TABLE IF NOT EXISTS currency_rates_daily_items (id INTEGER PRIMARY KEY AUTOINCREMENT, daily_rate_id INTEGER NOT NULL, currency_code TEXT NOT NULL, usd_rate REAL)",
            "CREATE INDEX IF NOT EXISTS ix_currency_rates_daily_items_daily_id ON currency_rates_daily_items(daily_rate_id)",
            "CREATE INDEX IF NOT EXISTS ix_currency_rates_daily_items_code ON currency_rates_daily_items(currency_code)",
            "CREATE TABLE IF NOT EXISTS [transactions_fact] (id INTEGER PRIMARY KEY AUTOINCREMENT, [Transaction ID] TEXT NOT NULL, [File Name] TEXT, [Upload Date] TEXT, [People] TEXT, [Parent Companies] TEXT, [Company] TEXT, [Regions] TEXT, [Bank Types] TEXT, [Bank] TEXT, [Account No] TEXT, [Currency] TEXT, [Currency Rate] REAL, [Date] TEXT, [Date 2] TEXT, [Status] TEXT, [Name] TEXT, [Category] TEXT, [Reference ID] TEXT, [Reference] TEXT, [Txn Reference] TEXT, [Description] TEXT, [Inter Division] TEXT, [Net Amount] REAL, [Fee] REAL, [VAT] REAL, [Amount] REAL, [Balance] REAL, [Is Split] INTEGER, [CreatedDate] TEXT, [UpdatedDate] TEXT, [LastModification] TEXT)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_transactions_fact_txid ON [transactions_fact]([Transaction ID])",
            "CREATE TABLE IF NOT EXISTS people_store (pk TEXT NOT NULL, data TEXT)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_people_store_pk ON people_store(pk)",
            "CREATE TABLE IF NOT EXISTS audit_log_store (pk TEXT NOT NULL, data TEXT)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_log_store_pk ON audit_log_store(pk)",
        ]:
            try:
                cur.execute(ddl)
            except Exception:
                pass

        # Migrate columns for existing databases.
        for _usd_col in ("Balance", "Net Amount USD", "Fee USD", "VAT USD", "Amount USD", "Balance USD"):
            _ensure_access_column(conn, ACCESS_TRANSACTIONS_TABLE, _usd_col, "REAL")

        # Drop and recreate views to ensure they reflect current schema (including `people` column).
        try:
            cur.execute("DROP VIEW IF EXISTS vw_companies_joined")
            cur.execute(
                "CREATE VIEW vw_companies_joined AS "
                "SELECT c.id, c.name AS company, pc.name AS parent_company, "
                "r.code AS region, c.primary_color, c.secondary_color "
                "FROM companies_dim c "
                "LEFT JOIN parent_companies pc ON pc.id = c.parent_company_id "
                "LEFT JOIN regions r ON r.id = c.region_id"
            )
        except Exception:
            pass
        try:
            cur.execute("DROP VIEW IF EXISTS vw_accounts_joined")
            cur.execute(
                "CREATE VIEW vw_accounts_joined AS "
                "SELECT a.id, c.name AS company, b.name AS bank, "
                "b.primary_short_name AS bank_short_name, bt.name AS bank_type, "
                "r.code AS region, cur.code AS currency, a.account_number, a.people "
                "FROM accounts_dim a "
                "INNER JOIN companies_dim c ON a.company_id = c.id "
                "INNER JOIN banks_dim b ON a.bank_id = b.id "
                "INNER JOIN bank_types bt ON a.bank_type_id = bt.id "
                "INNER JOIN regions r ON a.region_id = r.id "
                "INNER JOIN currencies_dim cur ON a.currency_id = cur.id"
            )
        except Exception:
            pass

        # One-time migration if relational settings tables are empty.
        has_data = _access_table_count(conn, "companies_dim") > 0 or _access_table_count(conn, "banks_dim") > 0
        if not has_data:
            with get_db() as sqlite_conn:
                settings_map = _fetch_settings_map(sqlite_conn)

            _write_access_settings(conn, settings_map)

        # One-time migration: SQLite people/audit -> Access stores (if Access store is empty).
        for store_name, table_name in ACCESS_JSON_STORES.items():
            if _access_table_count(conn, table_name) > 0:
                continue
            with get_db() as sqlite_conn:
                rows = sqlite_conn.execute(f"SELECT pk, data FROM {store_name}").fetchall()
            for row in rows:
                try:
                    pk = str(row["pk"])
                    data_txt = str(row["data"])
                    cur.execute(f"INSERT INTO [{table_name}] (pk, data) VALUES (?, ?)", (pk, data_txt))
                except Exception:
                    continue

        # Keep daily currency history up to date (once per UTC day).
        try:
            refresh_daily_currency_rates_access(conn)
        except Exception:
            # Do not block app startup if rate API is temporarily unavailable.
            pass


def _get_transaction_unique_dates_missing_rates(conn) -> list[str]:
    cur = conn.cursor()
    tx_dates: set[str] = set()
    try:
        rows = cur.execute(
            f"SELECT DISTINCT [Date] FROM [{ACCESS_TRANSACTIONS_TABLE}] WHERE [Date] IS NOT NULL AND [Date] <> ''"
        ).fetchall()
    except Exception:
        rows = []

    for r in rows:
        d = str(r[0] or "").strip()[:10]
        if d:
            tx_dates.add(d)

    existing_dates: set[str] = set()
    try:
        rows = cur.execute("SELECT rate_date FROM currency_rates_daily").fetchall()
    except Exception:
        rows = []
    for r in rows:
        d = str(r[0] or "").strip()[:10]
        if d:
            existing_dates.add(d)

    return sorted([d for d in tx_dates if d not in existing_dates])


def _insert_currency_rate_snapshot(conn, rate_date: str, usd_map: dict[str, Any]) -> bool:
    cur = conn.cursor()
    existing = cur.execute("SELECT id FROM currency_rates_daily WHERE rate_date = ? LIMIT 1", (rate_date,)).fetchone()
    if existing:
        return False

    aed = float(usd_map.get("aed")) if usd_map.get("aed") is not None else None
    gbp = float(usd_map.get("gbp")) if usd_map.get("gbp") is not None else None
    pkr = float(usd_map.get("pkr")) if usd_map.get("pkr") is not None else None
    euro = float(usd_map.get("eur")) if usd_map.get("eur") is not None else None
    usd = float(usd_map.get("usd")) if usd_map.get("usd") is not None else 1.0

    cur.execute(
        "INSERT INTO currency_rates_daily (rate_date, aed, gbp, pkr, euro, usd) VALUES (?, ?, ?, ?, ?, ?)",
        (rate_date, aed, gbp, pkr, euro, usd),
    )

    daily_row = cur.execute("SELECT id FROM currency_rates_daily WHERE rate_date = ? ORDER BY id DESC LIMIT 1", (rate_date,)).fetchone()
    if daily_row:
        daily_id = int(daily_row[0])
        item_rows = []
        for k, v in usd_map.items():
            code = str(k or "").strip().upper()
            if not code:
                continue
            try:
                rate = float(v)
            except Exception:
                continue
            item_rows.append((daily_id, code, rate))
        if item_rows:
            for daily_id_v, code_v, rate_v in item_rows:
                cur.execute(
                    "INSERT INTO currency_rates_daily_items (daily_rate_id, currency_code, usd_rate) VALUES (?, ?, ?)",
                    (daily_id_v, code_v, rate_v),
                )

    return True


def _fetch_usd_map_for_date(rate_date: str) -> dict[str, Any]:
    url = USD_RATES_URL_TEMPLATE.format(date=rate_date)
    with urlopen(url, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    usd_map = payload.get("usd") if isinstance(payload, dict) else {}
    return usd_map if isinstance(usd_map, dict) else {}


def _sync_missing_transaction_dates_currency_rates(conn) -> list[str]:
    missing_dates = _get_transaction_unique_dates_missing_rates(conn)
    if not missing_dates:
        return []

    added_dates: list[str] = []
    for d in missing_dates:
        try:
            usd_map = _fetch_usd_map_for_date(d)
        except Exception:
            continue
        try:
            if _insert_currency_rate_snapshot(conn, d, usd_map):
                added_dates.append(d)
        except Exception:
            continue
    return added_dates


def refresh_daily_currency_rates_access(conn, force: bool = False) -> bool:
    added_dates = _sync_missing_transaction_dates_currency_rates(conn)
    if not added_dates:
        _sync_currencies_dim_with_latest_rates(conn)
        return False

    _sync_currencies_dim_with_latest_rates(conn)
    return True


def _latest_rates_map_from_access(conn) -> tuple[str, dict[str, float]]:
    cur = conn.cursor()
    latest = cur.execute("SELECT id, rate_date FROM currency_rates_daily ORDER BY id DESC LIMIT 1").fetchone()
    if not latest:
        return "", {}
    daily_id = int(latest[0])
    rate_date = str(latest[1] or "")

    rate_map: dict[str, float] = {}
    try:
        rows = cur.execute(
            "SELECT currency_code, usd_rate FROM currency_rates_daily_items WHERE daily_rate_id = ?",
            (daily_id,),
        ).fetchall()
    except Exception:
        rows = []

    for r in rows:
        code = str(r[0] or "").strip().upper()
        try:
            rate = float(r[1])
        except Exception:
            continue
        if code:
            rate_map[code] = rate

    # Fallback for legacy wide-table rows.
    if not rate_map:
        wide = cur.execute("SELECT aed, gbp, pkr, euro, usd FROM currency_rates_daily ORDER BY id DESC LIMIT 1").fetchone()
        if wide:
            pairs = {
                "AED": wide[0],
                "GBP": wide[1],
                "PKR": wide[2],
                "EUR": wide[3],
                "USD": wide[4],
            }
            for code, raw in pairs.items():
                if raw is None:
                    continue
                try:
                    rate_map[code] = float(raw)
                except Exception:
                    continue

    return rate_date, rate_map


def _sync_currencies_dim_with_latest_rates(conn) -> None:
    rate_date, rate_map = _latest_rates_map_from_access(conn)
    if not rate_map:
        return

    cur = conn.cursor()
    rows = cur.execute("SELECT id, code FROM currencies_dim").fetchall()
    for r in rows:
        cid = int(r[0])
        code = str(r[1] or "").strip().upper()
        api_code = _to_api_currency(code)
        rate = rate_map.get(api_code)
        if rate is None:
            continue
        cur.execute(
            "UPDATE currencies_dim SET usd_rate = ?, rate_date = ? WHERE id = ?",
            (rate, rate_date, cid),
        )


@app.post("/api/settings/currency-rates/refresh")
def refresh_currency_rates_now():
    with get_access_db() as conn:
        missing_dates = _get_transaction_unique_dates_missing_rates(conn)
        added_dates = _sync_missing_transaction_dates_currency_rates(conn)
        _sync_currencies_dim_with_latest_rates(conn)
        row = conn.cursor().execute(
            "SELECT id, rate_date, aed, gbp, pkr, euro, usd FROM currency_rates_daily ORDER BY id DESC LIMIT 1"
        ).fetchone()
    if not row:
        return {"ok": False, "detail": "No currency rates available"}
    return {
        "ok": True,
        "refreshed": bool(added_dates),
        "missingDates": missing_dates,
        "addedDates": added_dates,
        "addedCount": len(added_dates),
        "row": {
            "id": row[0],
            "date": row[1],
            "aed": row[2],
            "gbp": row[3],
            "pkr": row[4],
            "euro": row[5],
            "usd": row[6],
        },
    }


def _access_table_count(conn, table: str) -> int:
    try:
        row = conn.cursor().execute(f"SELECT COUNT(*) FROM {table}").fetchone()
        return int(row[0]) if row else 0
    except Exception:
        return 0


def _read_access_json_store(conn, store: str) -> list[dict[str, Any]]:
    table = ACCESS_JSON_STORES[store]
    rows = conn.cursor().execute(f"SELECT data FROM [{table}]").fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        try:
            out.append(json.loads(str(r[0] or "{}")))
        except Exception:
            continue
    return out


def _upsert_access_json_store(conn, store: str, pk: str, record: dict[str, Any]) -> None:
    table = ACCESS_JSON_STORES[store]
    cur = conn.cursor()
    cur.execute(f"DELETE FROM [{table}] WHERE [pk] = ?", (str(pk),))
    cur.execute(f"INSERT INTO [{table}] (pk, data) VALUES (?, ?)", (str(pk), json.dumps(record)))


def _delete_access_json_store(conn, store: str, pk: str) -> None:
    table = ACCESS_JSON_STORES[store]
    conn.cursor().execute(f"DELETE FROM [{table}] WHERE [pk] = ?", (str(pk),))


def _clear_access_json_store(conn, store: str) -> None:
    table = ACCESS_JSON_STORES[store]
    conn.cursor().execute(f"DELETE FROM [{table}]")


def _read_access_settings(conn) -> dict[str, Any]:
    cur = conn.cursor()
    out: dict[str, Any] = {
        "companies": [],
        "companyRegions": {},
        "companyParents": {},
        "companyColors2": {},
        "parentCompanies": [],
        "regions": [],
        "bankTypes": [],
        "banks": [],
        "bankShortNameList": [],
        "bankChildShortNamesList": [],
        "accountCompanyList": [],
        "bankForAccountList": [],
        "bankTypeList": [],
        "bankAccountList": [],
        "accountRegionList": [],
        "bankCurrencyList": [],
        "accountPeopleList": [],
        "bankAccounts": {},
        "currencies": [],
        "beginningBalanceKeywords": [],
        "openingBalance": None,
        "closingBalance": None,
    }

    for r in cur.execute("SELECT name FROM parent_companies ORDER BY name").fetchall():
        out["parentCompanies"].append(str(r[0]))
    for r in cur.execute("SELECT code FROM regions ORDER BY code").fetchall():
        out["regions"].append(str(r[0]))
    for r in cur.execute("SELECT name FROM bank_types ORDER BY name").fetchall():
        out["bankTypes"].append(str(r[0]))
    for r in cur.execute("SELECT code FROM currencies_dim ORDER BY code").fetchall():
        out["currencies"].append(str(r[0]))
    for r in cur.execute("SELECT keyword FROM beginning_balance_keywords_dim ORDER BY keyword").fetchall():
        out["beginningBalanceKeywords"].append(str(r[0]))

    for r in cur.execute("SELECT name, primary_short_name, child_short_names FROM banks_dim ORDER BY name").fetchall():
        name = str(r[0])
        out["banks"].append(name)
        out["bankShortNameList"].append(str(r[1] or "").strip())
        child_raw = str(r[2] or "").strip()
        child_list = [x.strip() for x in child_raw.split(",") if x.strip()] if child_raw else []
        out["bankChildShortNamesList"].append(child_list)

    for r in cur.execute(
        "SELECT c.name, pc.name, rg.code, c.primary_color, c.secondary_color "
        "FROM companies_dim AS c "
        "LEFT JOIN parent_companies AS pc ON c.parent_company_id = pc.id "
        "LEFT JOIN regions AS rg ON c.region_id = rg.id ORDER BY c.name"
    ).fetchall():
        name = str(r[0])
        parent = str(r[1] or "").strip()
        region = str(r[2] or "").strip()
        primary = str(r[3] or "").strip()
        secondary = str(r[4] or "").strip()
        out["companies"].append(name)
        if parent:
            out["companyParents"][name] = parent
        if region:
            out["companyRegions"][name] = region
        out["companyColors2"][name] = {"primary": primary, "secondary": secondary}

    for r in cur.execute(
        "SELECT c.name, b.name, bt.name, a.account_number, rg.code, cur.code, a.people "
        "FROM accounts_dim AS a "
        "INNER JOIN companies_dim AS c ON a.company_id = c.id "
        "INNER JOIN banks_dim AS b ON a.bank_id = b.id "
        "INNER JOIN bank_types AS bt ON a.bank_type_id = bt.id "
        "INNER JOIN regions AS rg ON a.region_id = rg.id "
        "INNER JOIN currencies_dim AS cur ON a.currency_id = cur.id "
        "ORDER BY c.name, b.name, a.account_number"
    ).fetchall():
        company, bank, bank_type, account_no, region, currency = [str(x or "").strip() for x in r[:6]]
        people_str = str(r[6] or "").strip() if len(r) > 6 and r[6] is not None else ""
        out["accountCompanyList"].append(company)
        out["bankForAccountList"].append(bank)
        out["bankTypeList"].append(bank_type)
        out["bankAccountList"].append(account_no)
        out["accountRegionList"].append(region)
        out["bankCurrencyList"].append(currency)
        out["accountPeopleList"].append(people_str)
        if bank and account_no and bank not in out["bankAccounts"]:
            out["bankAccounts"][bank] = account_no

    return out


def _write_access_settings(conn, settings: dict[str, Any]) -> None:
    cur = conn.cursor()

    companies = [str(x).strip() for x in (settings.get("companies") or []) if str(x).strip()]
    company_regions = settings.get("companyRegions") or {}
    company_parents = settings.get("companyParents") or {}
    company_colors = settings.get("companyColors2") or {}

    parent_companies = [str(x).strip() for x in (settings.get("parentCompanies") or []) if str(x).strip()]
    regions = [str(x).strip() for x in (settings.get("regions") or []) if str(x).strip()]
    bank_types = [str(x).strip() for x in (settings.get("bankTypes") or []) if str(x).strip()]
    currencies = [str(x).strip() for x in (settings.get("currencies") or []) if str(x).strip()]
    bb_keywords = [str(x).strip() for x in (settings.get("beginningBalanceKeywords") or []) if str(x).strip()]

    banks = [str(x).strip() for x in (settings.get("banks") or []) if str(x).strip()]
    bank_shorts = settings.get("bankShortNameList") or []
    bank_childs = settings.get("bankChildShortNamesList") or []

    account_companies = settings.get("accountCompanyList") or []
    account_banks = settings.get("bankForAccountList") or []
    account_types = settings.get("bankTypeList") or []
    account_numbers = settings.get("bankAccountList") or []
    account_regions = settings.get("accountRegionList") or []
    account_currencies = settings.get("bankCurrencyList") or []
    account_people = settings.get("accountPeopleList") or []

    # Clear in FK-safe order.
    for table in [
        "accounts_dim",
        "companies_dim",
        "banks_dim",
        "beginning_balance_keywords_dim",
        "bank_types",
        "currencies_dim",
        "regions",
        "parent_companies",
    ]:
        try:
            cur.execute(f"DELETE FROM {table}")
        except Exception:
            pass

    for name in parent_companies:
        cur.execute("INSERT INTO parent_companies(name) VALUES (?)", (name,))
    for code in regions:
        cur.execute("INSERT INTO regions(code) VALUES (?)", (code,))
    for name in bank_types:
        cur.execute("INSERT INTO bank_types(name) VALUES (?)", (name,))
    for code in currencies:
        cur.execute("INSERT INTO currencies_dim(code) VALUES (?)", (code,))
    for kw in bb_keywords:
        cur.execute("INSERT INTO beginning_balance_keywords_dim(keyword) VALUES (?)", (kw,))

    for i, bank in enumerate(banks):
        short = str(bank_shorts[i]).strip() if i < len(bank_shorts) else ""
        child = bank_childs[i] if i < len(bank_childs) else []
        if isinstance(child, list):
            child_text = ", ".join([str(x).strip() for x in child if str(x).strip()])
        else:
            child_text = str(child or "").strip()
        cur.execute(
            "INSERT INTO banks_dim(name, primary_short_name, child_short_names) VALUES (?, ?, ?)",
            (bank, short, child_text),
        )

    for company in companies:
        parent = str(company_parents.get(company, "") or "").strip()
        region = str(company_regions.get(company, "") or "").strip()
        colors = company_colors.get(company, {}) if isinstance(company_colors, dict) else {}
        primary = str((colors or {}).get("primary", "") or "").strip()
        secondary = str((colors or {}).get("secondary", "") or "").strip()

        if parent:
            exists_parent = cur.execute("SELECT COUNT(*) FROM parent_companies WHERE name = ?", (parent,)).fetchone()
            if not exists_parent or int(exists_parent[0]) == 0:
                cur.execute("INSERT INTO parent_companies(name) VALUES (?)", (parent,))
        if region:
            exists_region = cur.execute("SELECT COUNT(*) FROM regions WHERE code = ?", (region,)).fetchone()
            if not exists_region or int(exists_region[0]) == 0:
                cur.execute("INSERT INTO regions(code) VALUES (?)", (region,))

        parent_id_row = cur.execute("SELECT id FROM parent_companies WHERE name = ?", (parent,)).fetchone() if parent else None
        region_id_row = cur.execute("SELECT id FROM regions WHERE code = ?", (region,)).fetchone() if region else None
        parent_id = int(parent_id_row[0]) if parent_id_row else None
        region_id = int(region_id_row[0]) if region_id_row else None

        cur.execute(
            "INSERT INTO companies_dim(name, parent_company_id, region_id, primary_color, secondary_color) VALUES (?, ?, ?, ?, ?)",
            (company, parent_id, region_id, primary, secondary),
        )

    row_count = max(
        len(account_companies),
        len(account_banks),
        len(account_types),
        len(account_numbers),
        len(account_regions),
        len(account_currencies),
        len(account_people),
    )
    for i in range(row_count):
        company = str(account_companies[i]).strip() if i < len(account_companies) else ""
        bank = str(account_banks[i]).strip() if i < len(account_banks) else ""
        bank_type = str(account_types[i]).strip() if i < len(account_types) else ""
        account_no = str(account_numbers[i]).strip() if i < len(account_numbers) else ""
        region = str(account_regions[i]).strip() if i < len(account_regions) else ""
        currency = str(account_currencies[i]).strip() if i < len(account_currencies) else ""
        people_val = str(account_people[i]).strip() if i < len(account_people) else ""
        if not (company and bank and bank_type and account_no and region and currency):
            continue

        company_id = cur.execute("SELECT id FROM companies_dim WHERE name = ?", (company,)).fetchone()
        bank_id = cur.execute("SELECT id FROM banks_dim WHERE name = ?", (bank,)).fetchone()
        bank_type_id = cur.execute("SELECT id FROM bank_types WHERE name = ?", (bank_type,)).fetchone()
        region_id = cur.execute("SELECT id FROM regions WHERE code = ?", (region,)).fetchone()
        currency_id = cur.execute("SELECT id FROM currencies_dim WHERE code = ?", (currency,)).fetchone()
        if not all([company_id, bank_id, bank_type_id, region_id, currency_id]):
            continue

        cur.execute(
            "INSERT INTO accounts_dim(company_id, bank_id, bank_type_id, currency_id, region_id, account_number, people) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (int(company_id[0]), int(bank_id[0]), int(bank_type_id[0]), int(currency_id[0]), int(region_id[0]), account_no, people_val),
        )

    _sync_currencies_dim_with_latest_rates(conn)


def _fetch_settings_map(conn: sqlite3.Connection) -> dict[str, Any]:
    rows = conn.execute("SELECT data FROM settings").fetchall()
    m: dict[str, Any] = {}
    for r in rows:
        try:
            obj = json.loads(r["data"])
        except Exception:
            continue
        key = obj.get("key")
        if key:
            m[str(key)] = obj.get("value")
    return m


def _upsert_lookup(conn: sqlite3.Connection, table: str, col: str, values: list[str]) -> None:
    for v in values:
        txt = str(v or "").strip()
        if not txt:
            continue
        conn.execute(f"INSERT OR IGNORE INTO {table} ({col}) VALUES (?)", (txt,))


def _lookup_id(conn: sqlite3.Connection, table: str, col: str, value: str) -> int | None:
    txt = str(value or "").strip()
    if not txt:
        return None
    row = conn.execute(f"SELECT id FROM {table} WHERE {col} = ?", (txt,)).fetchone()
    return int(row["id"]) if row else None


def sync_relational_settings(conn: sqlite3.Connection) -> None:
    settings = _fetch_settings_map(conn)

    companies = [str(x).strip() for x in (settings.get("companies") or []) if str(x).strip()]
    company_regions = settings.get("companyRegions") or {}
    company_parents = settings.get("companyParents") or {}
    company_colors = settings.get("companyColors2") or {}

    parent_companies = [str(x).strip() for x in (settings.get("parentCompanies") or []) if str(x).strip()]
    regions = [str(x).strip() for x in (settings.get("regions") or []) if str(x).strip()]

    banks = [str(x).strip() for x in (settings.get("banks") or []) if str(x).strip()]
    bank_shorts = settings.get("bankShortNameList") or []
    bank_childs = settings.get("bankChildShortNamesList") or []

    bank_types = [str(x).strip() for x in (settings.get("bankTypes") or []) if str(x).strip()]
    currencies = [str(x).strip() for x in (settings.get("currencies") or []) if str(x).strip()]
    bb_keywords = [str(x).strip() for x in (settings.get("beginningBalanceKeywords") or []) if str(x).strip()]

    account_companies = settings.get("accountCompanyList") or []
    account_banks = settings.get("bankForAccountList") or []
    account_types = settings.get("bankTypeList") or []
    account_numbers = settings.get("bankAccountList") or []
    account_regions = settings.get("accountRegionList") or []
    account_currencies = settings.get("bankCurrencyList") or []
    account_people = settings.get("accountPeopleList") or []

    # Rebuild dim tables from current settings snapshot.
    for t in [
        "accounts_dim",
        "beginning_balance_keywords_dim",
        "companies_dim",
        "banks_dim",
        "bank_types",
        "currencies_dim",
        "regions",
        "parent_companies",
    ]:
        conn.execute(f"DELETE FROM {t}")

    _upsert_lookup(conn, "parent_companies", "name", parent_companies)
    _upsert_lookup(conn, "regions", "code", regions)
    _upsert_lookup(conn, "bank_types", "name", bank_types)
    _upsert_lookup(conn, "currencies_dim", "code", currencies)
    _upsert_lookup(conn, "beginning_balance_keywords_dim", "keyword", bb_keywords)

    for i, bank in enumerate(banks):
        primary_short = str(bank_shorts[i]).strip() if i < len(bank_shorts) else ""
        child_raw = bank_childs[i] if i < len(bank_childs) else []
        if isinstance(child_raw, list):
            child_short = ", ".join([str(x).strip() for x in child_raw if str(x).strip()])
        else:
            child_short = str(child_raw or "").strip()
        conn.execute(
            """
            INSERT OR REPLACE INTO banks_dim (id, name, primary_short_name, child_short_names)
            VALUES (
                COALESCE((SELECT id FROM banks_dim WHERE name = ?), NULL),
                ?, ?, ?
            )
            """,
            (bank, bank, primary_short, child_short),
        )

    for company in companies:
        parent_name = str(company_parents.get(company, "") or "").strip()
        region_code = str(company_regions.get(company, "") or "").strip()
        colors = company_colors.get(company, {}) if isinstance(company_colors, dict) else {}
        primary_color = str((colors or {}).get("primary", "") or "").strip()
        secondary_color = str((colors or {}).get("secondary", "") or "").strip()

        if parent_name:
            conn.execute("INSERT OR IGNORE INTO parent_companies (name) VALUES (?)", (parent_name,))
        if region_code:
            conn.execute("INSERT OR IGNORE INTO regions (code) VALUES (?)", (region_code,))

        parent_id = _lookup_id(conn, "parent_companies", "name", parent_name)
        region_id = _lookup_id(conn, "regions", "code", region_code)

        conn.execute(
            """
            INSERT OR REPLACE INTO companies_dim (id, name, parent_company_id, region_id, primary_color, secondary_color)
            VALUES (
                COALESCE((SELECT id FROM companies_dim WHERE name = ?), NULL),
                ?, ?, ?, ?, ?
            )
            """,
            (company, company, parent_id, region_id, primary_color, secondary_color),
        )

    row_count = max(
        len(account_companies),
        len(account_banks),
        len(account_types),
        len(account_numbers),
        len(account_regions),
        len(account_currencies),
        len(account_people),
    )
    for i in range(row_count):
        company = str(account_companies[i]).strip() if i < len(account_companies) else ""
        bank = str(account_banks[i]).strip() if i < len(account_banks) else ""
        bank_type = str(account_types[i]).strip() if i < len(account_types) else ""
        account_number = str(account_numbers[i]).strip() if i < len(account_numbers) else ""
        region = str(account_regions[i]).strip() if i < len(account_regions) else ""
        currency = str(account_currencies[i]).strip() if i < len(account_currencies) else ""
        people_val = str(account_people[i]).strip() if i < len(account_people) else ""

        if not (company and bank and bank_type and account_number and region and currency):
            continue

        company_id = _lookup_id(conn, "companies_dim", "name", company)
        bank_id = _lookup_id(conn, "banks_dim", "name", bank)
        bank_type_id = _lookup_id(conn, "bank_types", "name", bank_type)
        region_id = _lookup_id(conn, "regions", "code", region)
        currency_id = _lookup_id(conn, "currencies_dim", "code", currency)

        if None in (company_id, bank_id, bank_type_id, region_id, currency_id):
            continue

        conn.execute(
            """
            INSERT OR IGNORE INTO accounts_dim (
                company_id, bank_id, bank_type_id, currency_id, region_id, account_number, people
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (company_id, bank_id, bank_type_id, currency_id, region_id, account_number, people_val),
        )


# ---------------------------------------------------------------------------
# Serve the frontend
# ---------------------------------------------------------------------------
@app.get("/")
def index():
    return FileResponse(os.path.join(RUNTIME_DIR, "index.html"))


# ---------------------------------------------------------------------------
# GET /api/data/{store}  — return all records
# ---------------------------------------------------------------------------
@app.get("/api/data/{store}")
def get_all(store: str):
    if store not in VALID_STORES:
        raise HTTPException(status_code=400, detail="invalid store")

    if store == "settings":
        with get_access_db() as conn:
            try:
                refresh_daily_currency_rates_access(conn)
            except Exception:
                # Settings should still load even if rate refresh fails.
                pass
            settings_map = _read_access_settings(conn)
        out = [{"key": k, "value": v} for k, v in settings_map.items()]
        return JSONResponse(out)

    if store == "transactions":
        with get_access_db() as conn:
            return JSONResponse(_get_all_access_transactions(conn))

    if store in ACCESS_JSON_STORES:
        with get_access_db() as conn:
            return JSONResponse(_read_access_json_store(conn, store))

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

    if store == "settings":
        key = str(pk)
        with get_access_db() as conn:
            settings_map = _read_access_settings(conn)
            settings_map[key] = record.get("value")
            _write_access_settings(conn, settings_map)
        return {"ok": True}

    if store == "transactions":
        with get_access_db() as conn:
            tx_id = _upsert_access_transaction(conn, record)
        return {"ok": True, "id": tx_id}

    if store in ACCESS_JSON_STORES:
        with get_access_db() as conn:
            _upsert_access_json_store(conn, store, str(pk), record)
        return {"ok": True}

    with get_db() as conn:
        conn.execute(
            f"INSERT OR REPLACE INTO {store} (pk, data) VALUES (?, ?)",
            (str(pk), json.dumps(record)),
        )
        if store == "settings":
            sync_relational_settings(conn)
    return {"ok": True}


# ---------------------------------------------------------------------------
# POST /api/data/{store}/batch  — upsert many records at once
# ---------------------------------------------------------------------------
@app.post("/api/data/{store}/batch")
async def put_batch(store: str, request: Request):
    if store not in VALID_STORES:
        raise HTTPException(status_code=400, detail="invalid store")
    records: list[dict[str, Any]] = await request.json()

    if store == "settings":
        with get_access_db() as conn:
            settings_map = _read_access_settings(conn)
            for record in records:
                key = str(record.get("key") or "").strip()
                if not key:
                    continue
                settings_map[key] = record.get("value")
            _write_access_settings(conn, settings_map)
        return {"ok": True, "count": len(records)}

    if store == "transactions":
        saved = 0
        with get_access_db() as conn:
            for record in records:
                tx_id = _transaction_id_from_record(record)
                if not tx_id:
                    continue
                _upsert_access_transaction(conn, record)
                saved += 1
        return {"ok": True, "count": saved}

    if store in ACCESS_JSON_STORES:
        saved = 0
        with get_access_db() as conn:
            for record in records:
                pk = record.get("id")
                if not pk:
                    continue
                _upsert_access_json_store(conn, store, str(pk), record)
                saved += 1
        return {"ok": True, "count": saved}

    with get_db() as conn:
        for record in records:
            pk = record.get("key") if store == "settings" else record.get("id")
            if pk:
                conn.execute(
                    f"INSERT OR REPLACE INTO {store} (pk, data) VALUES (?, ?)",
                    (str(pk), json.dumps(record)),
                )
        if store == "settings":
            sync_relational_settings(conn)
    return {"ok": True, "count": len(records)}


# ---------------------------------------------------------------------------
# DELETE /api/data/{store}/{pk}  — delete one record
# ---------------------------------------------------------------------------
@app.delete("/api/data/{store}/{pk:path}")
def delete_one(store: str, pk: str):
    if store not in VALID_STORES:
        raise HTTPException(status_code=400, detail="invalid store")

    if store == "settings":
        with get_access_db() as conn:
            settings_map = _read_access_settings(conn)
            settings_map.pop(str(pk), None)
            _write_access_settings(conn, settings_map)
        return {"ok": True}

    if store == "transactions":
        with get_access_db() as conn:
            conn.cursor().execute(f"DELETE FROM [{ACCESS_TRANSACTIONS_TABLE}] WHERE [Transaction ID] = ?", (str(pk),))
        return {"ok": True}

    if store in ACCESS_JSON_STORES:
        with get_access_db() as conn:
            _delete_access_json_store(conn, store, pk)
        return {"ok": True}

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

    if store == "settings":
        with get_access_db() as conn:
            _write_access_settings(conn, {})
        return {"ok": True}

    if store == "transactions":
        with get_access_db() as conn:
            conn.cursor().execute(f"DELETE FROM [{ACCESS_TRANSACTIONS_TABLE}]")
        return {"ok": True}

    if store in ACCESS_JSON_STORES:
        with get_access_db() as conn:
            _clear_access_json_store(conn, store)
        return {"ok": True}

    with get_db() as conn:
        conn.execute(f"DELETE FROM {store}")
        if store == "settings":
            for t in [
                "accounts_dim",
                "beginning_balance_keywords_dim",
                "companies_dim",
                "banks_dim",
                "bank_types",
                "currencies_dim",
                "regions",
                "parent_companies",
            ]:
                conn.execute(f"DELETE FROM {t}")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    print("Solsoft server running → http://localhost:5000")
    reload_enabled = _should_enable_reload()
    uvicorn.run(
        _uvicorn_app_target() if reload_enabled else app,
        host="0.0.0.0",
        port=5000,
        reload=reload_enabled,
        app_dir=RUNTIME_DIR if reload_enabled else None,
    )