"""User store — storefront customer accounts (login / sign-up).

A tiny SQLite-backed ledger (stdlib only, no new deps), separate from the admin
gate. A customer registers with an email + password; we store a salted PBKDF2
hash (never the plaintext) and hand back an opaque session token. The buyer's
email is the join key into the entitlements ledger, so a logged-in customer's
purchases and licenses follow their account.

Tables:
  • users    — email (unique), password hash + salt, display name
  • sessions — opaque token → email (so a token can be revoked on logout)
"""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
import time
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).parent.parent / "outputs" / "users.db"

_PBKDF2_ROUNDS = 100_000


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
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                email         TEXT NOT NULL UNIQUE,
                name          TEXT,
                pw_salt       TEXT NOT NULL,
                pw_hash       TEXT NOT NULL,
                created_at    INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token       TEXT PRIMARY KEY,
                email       TEXT NOT NULL,
                created_at  INTEGER NOT NULL
            )
            """
        )


def _hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """Return (salt, hex digest). PBKDF2-HMAC-SHA256, stdlib only."""
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ROUNDS)
    return salt, dk.hex()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _public(row: sqlite3.Row | dict) -> dict[str, Any]:
    """User fields safe to expose to the client (never the hash/salt)."""
    return {"email": row["email"], "name": row["name"], "created_at": row["created_at"]}


def get_user(email: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (_normalize_email(email),)
        ).fetchone()
    return dict(row) if row else None


def list_users() -> list[dict[str, Any]]:
    """All registered customers (public fields only), newest signup first.
    Used by the admin dashboard's member analytics."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT email, name, created_at FROM users ORDER BY created_at DESC"
        ).fetchall()
    return [_public(r) for r in rows]


def create_user(email: str, password: str, name: str | None = None) -> dict[str, Any]:
    """Register a new account. Raises ValueError if the email is already taken."""
    email = _normalize_email(email)
    if get_user(email):
        raise ValueError("이미 가입된 이메일입니다.")
    salt, pw_hash = _hash_password(password)
    now = int(time.time())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO users (email, name, pw_salt, pw_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (email, name, salt, pw_hash, now),
        )
    return {"email": email, "name": name, "created_at": now}


def verify_user(email: str, password: str) -> dict[str, Any] | None:
    """Return the public user dict on correct credentials, else None."""
    user = get_user(email)
    if not user:
        return None
    _, candidate = _hash_password(password, user["pw_salt"])
    # constant-time compare to avoid leaking match progress via timing
    if not secrets.compare_digest(candidate, user["pw_hash"]):
        return None
    return _public(user)


def create_session(email: str) -> str:
    """Issue an opaque session token bound to the (normalized) email."""
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    with _connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token, email, created_at) VALUES (?, ?, ?)",
            (token, _normalize_email(email), now),
        )
    return token


def user_for_token(token: str) -> dict[str, Any] | None:
    """Resolve a session token to its public user dict, or None if invalid."""
    if not token:
        return None
    with _connect() as conn:
        row = conn.execute("SELECT email FROM sessions WHERE token = ?", (token,)).fetchone()
        if not row:
            return None
        user = conn.execute("SELECT * FROM users WHERE email = ?", (row["email"],)).fetchone()
    return _public(user) if user else None


def delete_session(token: str) -> None:
    """Revoke a session (logout)."""
    if not token:
        return
    with _connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def _delete_sessions_for(conn: sqlite3.Connection, email: str) -> None:
    conn.execute("DELETE FROM sessions WHERE email = ?", (_normalize_email(email),))


def update_name(email: str, name: str | None) -> dict[str, Any] | None:
    """Update a user's display name. Returns the updated public user, or None."""
    email = _normalize_email(email)
    if not get_user(email):
        return None
    with _connect() as conn:
        conn.execute("UPDATE users SET name = ? WHERE email = ?", (name, email))
    return _public(get_user(email))  # type: ignore[arg-type]


def change_password(email: str, current_password: str, new_password: str) -> bool:
    """Re-hash with a fresh salt after verifying the current password. Returns
    False if the current password is wrong (or the user doesn't exist)."""
    if not verify_user(email, current_password):
        return False
    salt, pw_hash = _hash_password(new_password)
    email = _normalize_email(email)
    with _connect() as conn:
        conn.execute("UPDATE users SET pw_salt = ?, pw_hash = ? WHERE email = ?", (salt, pw_hash, email))
        # Force re-login everywhere — a password change should invalidate old sessions.
        _delete_sessions_for(conn, email)
    return True


def delete_user(email: str, password: str) -> bool:
    """Permanently delete an account (and its sessions) after verifying the
    password. Entitlements are intentionally left intact — a paid license stays
    valid even if the account is closed. Returns False on wrong password."""
    if not verify_user(email, password):
        return False
    email = _normalize_email(email)
    with _connect() as conn:
        _delete_sessions_for(conn, email)
        conn.execute("DELETE FROM users WHERE email = ?", (email,))
    return True
