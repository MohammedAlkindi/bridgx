import json
import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Optional

DEFAULT_TTL_S = int(os.getenv("QUOTE_TTL_S", "900"))
DB_PATH = Path(os.getenv("QUOTE_DB_PATH", Path(__file__).resolve().parents[1] / "db" / "quotes.db"))


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS odos_quotes (
            id TEXT PRIMARY KEY,
            quote_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
        """
    )
    return conn


def save_quote(quote_id: str, quote: dict, meta: Optional[dict] = None, ttl_s: int = DEFAULT_TTL_S) -> None:
    now = int(time.time())
    payload = {"quote": quote, "meta": meta or {}}
    with _get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO odos_quotes (id, quote_json, created_at) VALUES (?, ?, ?)",
            (quote_id, json.dumps(payload), now),
        )
        _purge_expired(conn, now, ttl_s)


def get_quote(quote_id: str, ttl_s: int = DEFAULT_TTL_S) -> Optional[dict]:
    now = int(time.time())
    with _get_conn() as conn:
        _purge_expired(conn, now, ttl_s)
        row = conn.execute(
            "SELECT quote_json FROM odos_quotes WHERE id = ?",
            (quote_id,),
        ).fetchone()
    if row is None:
        return None
    data = json.loads(row[0])
    if isinstance(data, dict) and "quote" in data:
        data.setdefault("meta", {})
        return data
    return {"quote": data, "meta": {}}


def _purge_expired(conn: sqlite3.Connection, now: int, ttl_s: int) -> None:
    cutoff = now - ttl_s
    conn.execute("DELETE FROM odos_quotes WHERE created_at < ?", (cutoff,))
