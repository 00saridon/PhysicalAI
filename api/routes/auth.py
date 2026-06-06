"""Auth API — storefront customer accounts (login / sign-up).

A lightweight, header-token auth for buyers, separate from the admin gate. The
client stores the returned token and sends it as `Authorization: Bearer <token>`
(or `X-Auth-Token`). The buyer's email is the join key into the entitlements
ledger, so a logged-in customer's purchases follow their account.

Endpoints:
  POST /api/auth/register   create an account, returns a session token + user
  POST /api/auth/login      exchange credentials for a session token + user
  POST /api/auth/logout     revoke the current session token
  GET  /api/auth/me         resolve the current token to a user (or 401)
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api import entitlements_store as ent_store
from api import users_store
from export.manifest import scan_catalog
from export.policy_manifest import scan_policies

router = APIRouter()

users_store.init_db()
ent_store.init_db()

_ROOT = Path(__file__).parent.parent.parent
_DATASET_DIR = _ROOT / "outputs" / "dataset"
_POLICY_DIR = _ROOT / "outputs" / "policy"


def _product_meta() -> dict[str, dict]:
    """Lookup id → {name, kind, price_usd} across both storefronts."""
    meta: dict[str, dict] = {}
    for p in scan_catalog(_DATASET_DIR):
        meta[p["id"]] = {"name": p.get("robot_name") or p["id"], "kind": "dataset",
                         "price_usd": int(p.get("price_usd", 0))}
    for p in scan_policies(_POLICY_DIR):
        meta[p["id"]] = {"name": p.get("robot_name") or p["id"], "kind": "policy",
                         "price_usd": int(p.get("price_usd", 0))}
    return meta

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UpdateNameRequest(BaseModel):
    name: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    password: str


def _bearer(authorization: str | None, x_auth_token: str | None) -> str | None:
    """Pull the token from either Authorization: Bearer or X-Auth-Token."""
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return x_auth_token


@router.post("/api/auth/register")
async def register(req: RegisterRequest):
    email = req.email.strip()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="올바른 이메일 형식이 아닙니다.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="비밀번호는 6자 이상이어야 합니다.")
    try:
        user = users_store.create_user(email, req.password, req.name)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    token = users_store.create_session(user["email"])
    return {"token": token, "user": user}


@router.post("/api/auth/login")
async def login(req: LoginRequest):
    user = users_store.verify_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    token = users_store.create_session(user["email"])
    return {"token": token, "user": user}


@router.post("/api/auth/logout")
async def logout(authorization: str | None = Header(default=None),
                 x_auth_token: str | None = Header(default=None)):
    token = _bearer(authorization, x_auth_token)
    if token:
        users_store.delete_session(token)
    return {"ok": True}


@router.get("/api/auth/me")
async def me(authorization: str | None = Header(default=None),
             x_auth_token: str | None = Header(default=None)):
    token = _bearer(authorization, x_auth_token)
    user = users_store.user_for_token(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    return {"user": user}


def _require_user(authorization: str | None, x_auth_token: str | None) -> dict:
    """Resolve the bearer token to a user or raise 401."""
    token = _bearer(authorization, x_auth_token)
    user = users_store.user_for_token(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    return user


@router.patch("/api/auth/profile")
async def update_profile(req: UpdateNameRequest,
                         authorization: str | None = Header(default=None),
                         x_auth_token: str | None = Header(default=None)):
    """Update the logged-in user's display name."""
    user = _require_user(authorization, x_auth_token)
    name = req.name.strip() if req.name else None
    updated = users_store.update_name(user["email"], name or None)
    if not updated:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return {"user": updated}


@router.post("/api/auth/password")
async def change_password(req: ChangePasswordRequest,
                          authorization: str | None = Header(default=None),
                          x_auth_token: str | None = Header(default=None)):
    """Change the password after verifying the current one. Invalidates all
    sessions (including this one), so the client must log in again."""
    user = _require_user(authorization, x_auth_token)
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="새 비밀번호는 6자 이상이어야 합니다.")
    if not users_store.change_password(user["email"], req.current_password, req.new_password):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다.")
    return {"ok": True}


@router.post("/api/auth/delete")
async def delete_account(req: DeleteAccountRequest,
                         authorization: str | None = Header(default=None),
                         x_auth_token: str | None = Header(default=None)):
    """Permanently close the account after verifying the password. Purchased
    licenses survive (entitlements are keyed by email, not account row)."""
    user = _require_user(authorization, x_auth_token)
    if not users_store.delete_user(user["email"], req.password):
        raise HTTPException(status_code=400, detail="비밀번호가 올바르지 않습니다.")
    return {"ok": True}


@router.get("/api/auth/library")
async def library(authorization: str | None = Header(default=None),
                  x_auth_token: str | None = Header(default=None)):
    """The logged-in customer's owned products (datasets/policies + license keys),
    aggregated across every entitlement tagged with their account email. Powers
    the '내 보관함' re-download UI."""
    token = _bearer(authorization, x_auth_token)
    user = users_store.user_for_token(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    meta = _product_meta()
    items: list[dict] = []
    for e in ent_store.list_for_email(user["email"]):
        m = meta.get(e["product_id"])
        items.append({
            "product_id": e["product_id"],
            "name": m["name"] if m else e["product_id"],
            "kind": m["kind"] if m else "unknown",
            "price_usd": m["price_usd"] if m else 0,
            "license_key": e["license_key"],
            "source": e["source"],
            "granted_at": e["granted_at"],
        })
    return {"email": user["email"], "items": items}


def _paid_orders(email: str) -> list[dict]:
    """The customer's purchases (paid entitlements only — mock/stripe, not manual
    dev grants), enriched with product name/kind/price. Newest first."""
    meta = _product_meta()
    orders: list[dict] = []
    for e in ent_store.list_for_email(email):
        if e["source"] not in ("mock", "stripe"):
            continue
        m = meta.get(e["product_id"])
        orders.append({
            "product_id": e["product_id"],
            "name": m["name"] if m else e["product_id"],
            "kind": m["kind"] if m else "unknown",
            "price_usd": m["price_usd"] if m else 0,
            "license_key": e["license_key"],
            "source": e["source"],
            "granted_at": e["granted_at"],
        })
    return orders


@router.get("/api/auth/orders")
async def orders(authorization: str | None = Header(default=None),
                 x_auth_token: str | None = Header(default=None)):
    """The logged-in customer's order history (paid purchases) with a spend total.
    Powers the member-only '주문 내역' page."""
    user = _require_user(authorization, x_auth_token)
    rows = _paid_orders(user["email"])
    return {
        "email": user["email"],
        "orders": rows,
        "count": len(rows),
        "total_usd": sum(o["price_usd"] for o in rows),
    }


@router.get("/api/auth/orders.csv")
async def orders_csv(authorization: str | None = Header(default=None),
                     x_auth_token: str | None = Header(default=None)):
    """Personal receipt — the customer's own purchases as a CSV (self-service, so
    token-gated to the requester's account, unlike the admin-wide sales ledger)."""
    user = _require_user(authorization, x_auth_token)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date_utc", "product_id", "name", "kind", "price_usd", "source", "license_key"])
    for o in _paid_orders(user["email"]):
        when = datetime.fromtimestamp(o["granted_at"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        writer.writerow([when, o["product_id"], o["name"], o["kind"], o["price_usd"], o["source"], o["license_key"]])
    buf.seek(0)
    stamp = datetime.now(tz=timezone.utc).strftime("%Y%m%d")
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="odin-receipt-{stamp}.csv"'})
