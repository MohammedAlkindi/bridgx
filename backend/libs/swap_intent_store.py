import json
import os
import sqlite3
import time
from pathlib import Path
from typing import Optional

DEFAULT_TTL_S = int(os.getenv("SWAP_INTENT_TTL_S", "3600"))
DB_PATH = Path(os.getenv("SWAP_INTENT_DB_PATH", Path(__file__).resolve().parents[1] / "db" / "swap_intents.db"))


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS swap_intents (
            id TEXT PRIMARY KEY,
            intent_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
        """
    )
    return conn


def save_intent(source_tx_hash: str, payload: dict, ttl_s: int = DEFAULT_TTL_S) -> None:
    now = int(time.time())
    with _get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO swap_intents (id, intent_json, created_at) VALUES (?, ?, ?)",
            (source_tx_hash, json.dumps(payload), now),
        )
        _purge_expired(conn, now, ttl_s)


def get_intent(source_tx_hash: str, ttl_s: int = DEFAULT_TTL_S) -> Optional[dict]:
    now = int(time.time())
    with _get_conn() as conn:
        _purge_expired(conn, now, ttl_s)
        row = conn.execute(
            "SELECT intent_json FROM swap_intents WHERE id = ?",
            (source_tx_hash,),
        ).fetchone()
    if row is None:
        return None
    return json.loads(row[0])


def _purge_expired(conn: sqlite3.Connection, now: int, ttl_s: int) -> None:
    cutoff = now - ttl_s
    conn.execute("DELETE FROM swap_intents WHERE created_at < ?", (cutoff,))
