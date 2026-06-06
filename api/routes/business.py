"""Business API — a single cross-model summary for the Overview dashboard.

Rolls the three ODIN revenue models into one snapshot:
  • #1 DaaS              — synthetic-dataset inventory + catalog value
  • #3 Policy Marketplace — trained-policy inventory + catalog value
  • #2 MLOps SaaS         — experiments, registry, GPU usage, plan MRR
  • Realized revenue      — paid entitlements (sales) joined to product prices

Endpoint:
  GET /api/business/summary   one snapshot for the Overview KPI panel
"""
from __future__ import annotations

import csv
import io
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api import entitlements_store as ent_store
from api import users_store
from export.manifest import scan_catalog
from export.policy_manifest import scan_policies
from mlops import experiments_store as mlops_store

router = APIRouter()

ent_store.init_db()
users_store.init_db()
mlops_store.init_db()

_ROOT = Path(__file__).parent.parent.parent
_DATASET_DIR = _ROOT / "outputs" / "dataset"
_POLICY_DIR = _ROOT / "outputs" / "policy"

# Revenue is confidential, so the summary is admin-gated. Set ADMIN_TOKEN in the
# backend env for production; the dev default keeps local demos frictionless.
_ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "odin-admin")


def _require_admin(token: str | None) -> None:
    if not token or token != _ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Admin authentication required.")


@router.post("/api/admin/login")
async def admin_login(x_admin_token: str | None = Header(default=None)):
    """Validate an admin passcode (used by the admin page's gate)."""
    _require_admin(x_admin_token)
    return {"ok": True}


def _inventory(products: list[dict]) -> dict:
    """Counts + total list price for a set of catalog products."""
    paid = [p for p in products if p.get("tier") == "paid"]
    return {
        "total": len(products),
        "paid": len(paid),
        "value_usd": sum(int(p.get("price_usd", 0)) for p in paid),
    }


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


@router.get("/api/business/summary")
async def business_summary(x_admin_token: str | None = Header(default=None)):
    _require_admin(x_admin_token)
    datasets = scan_catalog(_DATASET_DIR)
    policies = scan_policies(_POLICY_DIR)

    ds_inv = _inventory(datasets)
    pol_inv = _inventory(policies)

    # Product metadata lookup across both storefronts (price · display name · kind).
    meta: dict[str, dict] = {}
    for p in datasets:
        meta[p["id"]] = {"name": p.get("robot_name") or p["id"], "kind": "dataset",
                         "price_usd": int(p.get("price_usd", 0))}
    for p in policies:
        meta[p["id"]] = {"name": p.get("robot_name") or p["id"], "kind": "policy",
                         "price_usd": int(p.get("price_usd", 0))}

    # A sale = a paid entitlement (source mock/stripe); manual/dev grants excluded.
    # Enrich each with price/kind and split realized revenue by model.
    sales = ent_store.list_sales()
    recent_sales: list[dict] = []
    ds_rev = pol_rev = 0
    for s in sales:
        m = meta.get(s["product_id"])
        price = m["price_usd"] if m else 0
        kind = m["kind"] if m else "unknown"
        if kind == "dataset":
            ds_rev += price
        elif kind == "policy":
            pol_rev += price
        recent_sales.append({
            "product_id": s["product_id"],
            "name": m["name"] if m else s["product_id"],
            "kind": kind,
            "price_usd": price,
            "source": s["source"],
            "email": s["email"],
            "granted_at": s["granted_at"],
        })
    realized = ds_rev + pol_rev

    # Per-product sales ranking — group sales by product, sum units + revenue,
    # sort by revenue desc so the storefront's best earners surface first.
    by_product: dict[str, dict] = {}
    for s in sales:
        m = meta.get(s["product_id"])
        agg = by_product.setdefault(s["product_id"], {
            "product_id": s["product_id"],
            "name": m["name"] if m else s["product_id"],
            "kind": m["kind"] if m else "unknown",
            "units": 0,
            "revenue_usd": 0,
        })
        agg["units"] += 1
        agg["revenue_usd"] += m["price_usd"] if m else 0
    top_products = sorted(by_product.values(), key=lambda p: p["revenue_usd"], reverse=True)

    # Daily revenue trend — bucket sales by UTC date, sum revenue + order count.
    # Sorted ascending so the chart reads left→right oldest→newest. Cumulative
    # total lets the frontend draw a running-revenue line alongside daily bars.
    by_day: dict[str, dict] = {}
    for s in sales:
        m = meta.get(s["product_id"])
        price = m["price_usd"] if m else 0
        day = datetime.fromtimestamp(s["granted_at"], tz=timezone.utc).strftime("%Y-%m-%d")
        bucket = by_day.setdefault(day, {"date": day, "revenue_usd": 0, "orders": 0})
        bucket["revenue_usd"] += price
        bucket["orders"] += 1
    revenue_trend = sorted(by_day.values(), key=lambda d: d["date"])
    running = 0
    for d in revenue_trend:
        running += d["revenue_usd"]
        d["cumulative_usd"] = running

    # Member analytics — registered customers + their spend. Sales are grouped by
    # (lowercased) buyer email and joined to the account's display name + signup
    # date. Anonymous sales (no email — e.g. key-only checkout) are not attributed
    # to a member but still count toward overall revenue above.
    accounts = users_store.list_users()
    by_email_acct = {a["email"]: a for a in accounts}  # emails are stored normalized
    by_member: dict[str, dict] = {}
    for s in sales:
        email = (s["email"] or "").strip().lower()
        if not email:
            continue
        m = meta.get(s["product_id"])
        acct = by_email_acct.get(email)
        agg = by_member.setdefault(email, {
            "email": email,
            "name": acct["name"] if acct else None,
            "registered": acct is not None,
            "units": 0,
            "revenue_usd": 0,
            "last_order_at": 0,
        })
        agg["units"] += 1
        agg["revenue_usd"] += m["price_usd"] if m else 0
        agg["last_order_at"] = max(agg["last_order_at"], s["granted_at"])
    top_members = sorted(by_member.values(), key=lambda x: x["revenue_usd"], reverse=True)
    paying_members = sum(1 for v in by_member.values() if v["registered"])

    # Daily signup trend — bucket accounts by UTC signup date with a running total,
    # so the admin page can chart growth (new bars + cumulative line), mirroring
    # the revenue trend.
    signup_by_day: dict[str, dict] = {}
    for a in accounts:
        day = datetime.fromtimestamp(a["created_at"], tz=timezone.utc).strftime("%Y-%m-%d")
        bucket = signup_by_day.setdefault(day, {"date": day, "signups": 0})
        bucket["signups"] += 1
    signup_trend = sorted(signup_by_day.values(), key=lambda d: d["date"])
    running = 0
    for d in signup_trend:
        running += d["signups"]
        d["cumulative"] = running

    members = {
        "total": len(accounts),
        "paying": paying_members,
        "top": top_members[:8],
        "recent_signups": accounts[:6],  # list_users is newest-first
        "signup_trend": signup_trend,
    }

    # Revocation audit trail — recently pulled entitlements with their reason,
    # enriched with product name/kind for display.
    revocations: list[dict] = []
    for r in ent_store.list_revoked(12):
        m = meta.get(r["product_id"])
        revocations.append({
            "product_id": r["product_id"],
            "name": m["name"] if m else r["product_id"],
            "kind": m["kind"] if m else "unknown",
            "email": r["email"],
            "source": r["source"],
            "reason": r["reason"],
            "license_key": r["license_key"],
            "revoked_at": r["revoked_at"],
        })

    usage = mlops_store.usage_summary()

    return {
        "revenue": {
            "realized_usd": realized,
            "orders": len(sales),
            "mrr_usd": int(usage.get("price_usd", 0)),
            "catalog_value_usd": ds_inv["value_usd"] + pol_inv["value_usd"],
            "by_model": {"datasets_usd": ds_rev, "policies_usd": pol_rev},
        },
        "recent_sales": recent_sales[:12],
        "top_products": top_products[:8],
        "revenue_trend": revenue_trend,
        "members": members,
        "recent_revocations": revocations,
        "datasets": ds_inv,
        "policies": pol_inv,
        "mlops": {
            "experiments": usage.get("experiments", 0),
            "registered_models": usage.get("registered_models", 0),
            "plan": usage.get("plan"),
            "plan_name": usage.get("plan_name"),
            "gpu_minutes_used": usage.get("gpu_minutes_used", 0),
            "gpu_minutes_quota": usage.get("gpu_minutes_quota", 0),
            "utilization": usage.get("utilization", 0),
        },
    }


@router.get("/api/admin/member")
async def member_detail(email: str, x_admin_token: str | None = Header(default=None)):
    """Admin lookup of a single customer: account info + every owned product
    (license keys, paid/grant source, dates) with spend totals. Works for both
    registered accounts and key-only buyers (registered=false when no account)."""
    _require_admin(x_admin_token)
    email_norm = email.strip().lower()
    if not email_norm:
        raise HTTPException(status_code=400, detail="이메일을 입력하세요.")

    acct = users_store.get_user(email_norm)  # None for key-only (non-registered) buyers
    meta = _product_meta()
    items: list[dict] = []
    spent = 0
    paid_orders = 0
    for e in ent_store.list_for_email(email_norm):
        m = meta.get(e["product_id"])
        price = m["price_usd"] if m else 0
        is_paid = e["source"] in ("mock", "stripe")
        if is_paid:
            spent += price
            paid_orders += 1
        items.append({
            "product_id": e["product_id"],
            "name": m["name"] if m else e["product_id"],
            "kind": m["kind"] if m else "unknown",
            "price_usd": price,
            "source": e["source"],
            "paid": is_paid,
            "license_key": e["license_key"],
            "granted_at": e["granted_at"],
        })

    return {
        "email": email_norm,
        "registered": acct is not None,
        "name": acct["name"] if acct else None,
        "created_at": acct["created_at"] if acct else None,
        "items": items,
        "owned": len(items),
        "orders": paid_orders,
        "spent_usd": spent,
    }


class RevokeRequest(BaseModel):
    license_key: str
    product_id: str
    reason: str | None = None


@router.post("/api/admin/entitlement/revoke")
async def revoke_entitlement(req: RevokeRequest, x_admin_token: str | None = Header(default=None)):
    """Admin soft-revoke of a single entitlement (license key × product). Used to
    pull access after a refund/chargeback. The license row is kept (revoked_at +
    reason set) for audit; the buyer can no longer download and it drops out of
    their library."""
    _require_admin(x_admin_token)
    reason = (req.reason or "").strip() or None
    if not ent_store.revoke(req.license_key, req.product_id, reason):
        raise HTTPException(status_code=404, detail="해당 라이선스 권한을 찾을 수 없습니다.")
    return {"ok": True}


@router.get("/api/business/members.csv")
async def members_csv(x_admin_token: str | None = Header(default=None)):
    """Export the customer roster as CSV (admin-gated): one row per registered
    account with signup date and lifetime spend (owned products, paid orders,
    revenue, last order). Spend is derived from each account's live entitlements."""
    _require_admin(x_admin_token)
    meta = _product_meta()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "signup_utc", "email", "name", "owned_products", "paid_orders", "spent_usd", "last_order_utc",
    ])
    for acct in users_store.list_users():
        owned = paid_orders = spent = 0
        last_order = 0
        for e in ent_store.list_for_email(acct["email"]):
            owned += 1
            if e["source"] in ("mock", "stripe"):
                m = meta.get(e["product_id"])
                paid_orders += 1
                spent += m["price_usd"] if m else 0
                last_order = max(last_order, e["granted_at"])
        signup = datetime.fromtimestamp(acct["created_at"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        last = datetime.fromtimestamp(last_order, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S") if last_order else ""
        writer.writerow([signup, acct["email"], acct["name"] or "", owned, paid_orders, spent, last])
    buf.seek(0)
    stamp = datetime.now(tz=timezone.utc).strftime("%Y%m%d")
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="odin-members-{stamp}.csv"'},
    )


@router.get("/api/business/sales.csv")
async def sales_csv(x_admin_token: str | None = Header(default=None)):
    """Export the full realized-sales ledger as CSV (admin-gated, for accounting)."""
    _require_admin(x_admin_token)
    meta = _product_meta()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date_utc", "product_id", "name", "kind", "price_usd", "source", "email"])
    for s in ent_store.list_sales():
        m = meta.get(s["product_id"])
        when = datetime.fromtimestamp(s["granted_at"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        writer.writerow([
            when,
            s["product_id"],
            m["name"] if m else s["product_id"],
            m["kind"] if m else "unknown",
            m["price_usd"] if m else 0,
            s["source"],
            s["email"] or "",
        ])
    buf.seek(0)
    stamp = datetime.now(tz=timezone.utc).strftime("%Y%m%d")
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="odin-sales-{stamp}.csv"'},
    )
