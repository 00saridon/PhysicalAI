"""Experiment store — the ledger behind the Robotics MLOps SaaS (Model #2).

A tiny SQLite-backed store (stdlib `sqlite3`, no new deps) recording every
training run: its config, resulting metrics, the GPU time it consumed, and
whether its checkpoint was promoted to the marketplace. This is the MLflow/W&B
analogue scoped to this platform — it powers experiment tracking, the
leaderboard, the model registry, and usage-based billing.

Usage billing reuses the same metering: each run books `gpu_seconds`, and the
account's plan caps the monthly quota. Promotion (`registered_policy_id`) is the
hand-off into Model #3 — a run becomes a sellable policy.
"""
from __future__ import annotations

import json
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any

_DB_PATH = Path(__file__).parent.parent / "outputs" / "experiments.db"

# Subscription plans: monthly GPU-minute quota + price. The "account" is a single
# tenant for this demo; a real deployment would key these by org/user.
PLANS: dict[str, dict[str, Any]] = {
    "free":  {"name": "Free",       "gpu_minutes": 60,     "price_usd": 0,   "concurrent": 1},
    "team":  {"name": "Team",       "gpu_minutes": 3000,   "price_usd": 299, "concurrent": 4},
    "scale": {"name": "Scale",      "gpu_minutes": 20000,  "price_usd": 1499, "concurrent": 16},
}
DEFAULT_PLAN = "team"


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
            CREATE TABLE IF NOT EXISTS experiments (
                id                   TEXT PRIMARY KEY,
                name                 TEXT NOT NULL,
                algo                 TEXT NOT NULL,
                robot                TEXT NOT NULL,
                dataset              TEXT,
                hyperparams          TEXT NOT NULL DEFAULT '{}',
                status               TEXT NOT NULL DEFAULT 'completed',
                success_rate         REAL,
                mean_reward          REAL,
                final_loss           REAL,
                epochs               INTEGER,
                gpu_seconds          REAL NOT NULL DEFAULT 0,
                curve                TEXT NOT NULL DEFAULT '[]',
                registered_policy_id TEXT,
                created_at           INTEGER NOT NULL,
                completed_at         INTEGER
            )
            """
        )
        # Single-tenant account settings (active subscription plan).
        conn.execute(
            "CREATE TABLE IF NOT EXISTS account (k TEXT PRIMARY KEY, v TEXT NOT NULL)"
        )
        conn.execute(
            "INSERT OR IGNORE INTO account (k, v) VALUES ('plan', ?)", (DEFAULT_PLAN,)
        )


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    d["hyperparams"] = json.loads(d.get("hyperparams") or "{}")
    d["curve"] = json.loads(d.get("curve") or "[]")
    return d


def create_experiment(*, name: str, algo: str, robot: str, dataset: str | None,
                      hyperparams: dict[str, Any], success_rate: float,
                      mean_reward: float, final_loss: float, epochs: int,
                      gpu_seconds: float, curve: list[dict[str, Any]],
                      status: str = "completed") -> dict[str, Any]:
    """Record a finished training run and return the stored row."""
    exp_id = "exp_" + uuid.uuid4().hex[:12]
    now = int(time.time())
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO experiments
                (id, name, algo, robot, dataset, hyperparams, status,
                 success_rate, mean_reward, final_loss, epochs, gpu_seconds,
                 curve, created_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (exp_id, name, algo, robot, dataset, json.dumps(hyperparams), status,
             success_rate, mean_reward, final_loss, epochs, gpu_seconds,
             json.dumps(curve), now, now),
        )
    return get(exp_id)  # type: ignore[return-value]


def get(exp_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM experiments WHERE id = ?", (exp_id,)).fetchone()
    return _row_to_dict(row) if row else None


def list_experiments(*, limit: int = 200) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM experiments ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def leaderboard(*, robot: str | None = None, limit: int = 10) -> list[dict[str, Any]]:
    """Top completed runs by success rate (then mean reward), optionally per robot."""
    q = ("SELECT * FROM experiments WHERE status = 'completed' AND success_rate IS NOT NULL")
    args: list[Any] = []
    if robot:
        q += " AND robot = ?"
        args.append(robot)
    q += " ORDER BY success_rate DESC, mean_reward DESC LIMIT ?"
    args.append(limit)
    with _connect() as conn:
        rows = conn.execute(q, args).fetchall()
    return [_row_to_dict(r) for r in rows]


def delete(exp_id: str) -> bool:
    """Permanently remove a run. Returns True if a row was deleted.

    Note: a promoted run's marketplace policy is intentionally left intact —
    deleting the experiment record doesn't unpublish an already-sold policy.
    """
    with _connect() as conn:
        cur = conn.execute("DELETE FROM experiments WHERE id = ?", (exp_id,))
    return cur.rowcount > 0


def set_registered_policy(exp_id: str, policy_id: str) -> bool:
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE experiments SET registered_policy_id = ? WHERE id = ?",
            (policy_id, exp_id),
        )
    return cur.rowcount > 0


# ── Account / usage metering ─────────────────────────────────────────────────

def get_plan() -> str:
    with _connect() as conn:
        row = conn.execute("SELECT v FROM account WHERE k = 'plan'").fetchone()
    return row["v"] if row else DEFAULT_PLAN


def set_plan(plan: str) -> str:
    if plan not in PLANS:
        raise ValueError(f"Unknown plan '{plan}'")
    with _connect() as conn:
        conn.execute("INSERT OR REPLACE INTO account (k, v) VALUES ('plan', ?)", (plan,))
    return plan


def usage_summary() -> dict[str, Any]:
    """GPU-time consumed vs the active plan's quota, plus run counts."""
    plan_key = get_plan()
    plan = PLANS[plan_key]
    with _connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(gpu_seconds), 0) AS secs FROM experiments"
        ).fetchone()
        registered = conn.execute(
            "SELECT COUNT(*) AS n FROM experiments WHERE registered_policy_id IS NOT NULL"
        ).fetchone()
    used_minutes = round(row["secs"] / 60.0, 1)
    quota = plan["gpu_minutes"]
    return {
        "plan": plan_key,
        "plan_name": plan["name"],
        "price_usd": plan["price_usd"],
        "gpu_minutes_quota": quota,
        "gpu_minutes_used": used_minutes,
        "gpu_minutes_remaining": round(max(0, quota - used_minutes), 1),
        "utilization": round(min(1.0, used_minutes / quota) if quota else 0.0, 3),
        "experiments": row["n"],
        "registered_models": registered["n"],
        "plans": PLANS,
    }
