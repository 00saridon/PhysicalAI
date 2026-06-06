"""Entitlement store — who is allowed to download which paid product (DaaS Phase 1).

A tiny SQLite-backed ledger (stdlib `sqlite3`, no new deps). An *entitlement*
grants a license key the right to download one product. Free products need no
entitlement; paid products require a valid key (see api/routes/catalog.py).

In Phase 1 entitlements are issued by an admin/dev endpoint. In Phase 2 the
Stripe webhook calls the same `grant()` on `checkout.session.completed`, so the
download-gating logic here never changes.
"""
from __future__ import annotations

import secrets
import sqlite3
import time
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).parent.parent / "outputs" / "entitlements.db"

_KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous 0/O/1/I


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the tables if they don't exist (idempotent)."""
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS entitlements (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                license_key TEXT NOT NULL,
                product_id  TEXT NOT NULL,
                email       TEXT,
                source      TEXT NOT NULL DEFAULT 'manual',
                seats       INTEGER NOT NULL DEFAULT 1,
                granted_at  INTEGER NOT NULL,
                revoked_at  INTEGER,
                UNIQUE(license_key, product_id)
            )
            """
        )
        # Migration: older DBs predate the revocation `reason` column — add it.
        cols = {r[1] for r in conn.execute("PRAGMA table_info(entitlements)").fetchall()}
        if "reason" not in cols:
            conn.execute("ALTER TABLE entitlements ADD COLUMN reason TEXT")
        # Checkout sessions (DaaS Phase 2) — track a purchase from intent to
        # fulfillment so both the Stripe webhook and the mock-pay flow converge.
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS checkout_sessions (
                session_id   TEXT PRIMARY KEY,
                product_id   TEXT NOT NULL,
                email        TEXT,
                license_key  TEXT,           -- buyer's existing key to extend (optional)
                status       TEXT NOT NULL DEFAULT 'pending',  -- pending | paid
                provider     TEXT NOT NULL DEFAULT 'mock',     -- mock | stripe
                provider_id  TEXT,           -- Stripe session id, when applicable
                granted_key  TEXT,           -- key issued on fulfillment
                created_at   INTEGER NOT NULL,
                paid_at      INTEGER
            )
            """
        )


def _new_key() -> str:
    groups = ["".join(secrets.choice(_KEY_ALPHABET) for _ in range(4)) for _ in range(3)]
    return "ODIN-" + "-".join(groups)


def grant(product_id: str, *, email: str | None = None, source: str = "manual",
          seats: int = 1, license_key: str | None = None) -> dict[str, Any]:
    """Issue (or reuse) a license key entitling it to download `product_id`."""
    key = license_key or _new_key()
    now = int(time.time())
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO entitlements (license_key, product_id, email, source, seats, granted_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(license_key, product_id)
            DO UPDATE SET revoked_at = NULL, email = excluded.email, source = excluded.source
            """,
            (key, product_id, email, source, seats, now),
        )
    return {"license_key": key, "product_id": product_id, "email": email,
            "source": source, "seats": seats, "granted_at": now}


def check(license_key: str, product_id: str) -> bool:
    """True iff `license_key` holds a live (non-revoked) entitlement for the product."""
    if not license_key or not product_id:
        return False
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM entitlements WHERE license_key = ? AND product_id = ? AND revoked_at IS NULL",
            (license_key, product_id),
        ).fetchone()
    return row is not None


def list_for_key(license_key: str) -> list[dict[str, Any]]:
    """Every product a license key currently entitles (for the unlock UI)."""
    if not license_key:
        return []
    with _connect() as conn:
        rows = conn.execute(
            "SELECT product_id, email, source, seats, granted_at FROM entitlements "
            "WHERE license_key = ? AND revoked_at IS NULL ORDER BY granted_at DESC",
            (license_key,),
        ).fetchall()
    return [dict(r) for r in rows]


def list_for_email(email: str) -> list[dict[str, Any]]:
    """Every product a customer owns, keyed by their account email (the buyer's
    library). Aggregates across all license keys issued to that email."""
    if not email:
        return []
    with _connect() as conn:
        rows = conn.execute(
            "SELECT product_id, license_key, source, granted_at FROM entitlements "
            "WHERE lower(email) = lower(?) AND revoked_at IS NULL ORDER BY granted_at DESC",
            (email,),
        ).fetchall()
    return [dict(r) for r in rows]


def list_sales() -> list[dict[str, Any]]:
    """Every paid entitlement (a sale), i.e. issued via checkout (mock/stripe),
    not manual/dev grants. Used for cross-model revenue rollups."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT license_key, product_id, email, source, granted_at FROM entitlements "
            "WHERE revoked_at IS NULL AND source IN ('mock', 'stripe') ORDER BY granted_at DESC",
        ).fetchall()
    return [dict(r) for r in rows]


def revoke(license_key: str, product_id: str, reason: str | None = None) -> bool:
    """Soft-revoke an entitlement, optionally recording why. Returns True if a
    live row was revoked."""
    now = int(time.time())
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE entitlements SET revoked_at = ?, reason = ? "
            "WHERE license_key = ? AND product_id = ? AND revoked_at IS NULL",
            (now, reason, license_key, product_id),
        )
    return cur.rowcount > 0


def list_revoked(limit: int = 20) -> list[dict[str, Any]]:
    """Recently revoked entitlements (audit trail), newest first, with the reason
    captured at revoke time. Powers the admin revocation-history panel."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT license_key, product_id, email, source, reason, granted_at, revoked_at "
            "FROM entitlements WHERE revoked_at IS NOT NULL ORDER BY revoked_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


# ── Checkout sessions (Phase 2) ──────────────────────────────────────────────

def create_session(session_id: str, product_id: str, *, email: str | None = None,
                   license_key: str | None = None, provider: str = "mock") -> dict[str, Any]:
    now = int(time.time())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO checkout_sessions (session_id, product_id, email, license_key, provider, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, product_id, email, license_key, provider, now),
        )
    return get_session(session_id)  # type: ignore[return-value]


def get_session(session_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM checkout_sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
    return dict(row) if row else None


def set_session_provider_id(session_id: str, provider_id: str) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE checkout_sessions SET provider = 'stripe', provider_id = ? WHERE session_id = ?",
            (provider_id, session_id),
        )


def mark_session_paid(session_id: str, granted_key: str) -> None:
    now = int(time.time())
    with _connect() as conn:
        conn.execute(
            "UPDATE checkout_sessions SET status = 'paid', granted_key = ?, paid_at = ? WHERE session_id = ?",
            (granted_key, now, session_id),
        )
