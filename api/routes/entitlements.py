"""Entitlements API — issue and verify download licenses (DaaS Phase 1).

Paid catalog products are gated: a download needs a license key that holds an
entitlement for that product (see api/routes/catalog.py). These endpoints issue
keys and let the storefront check what a key unlocks. In Phase 2 the Stripe
webhook will call the same store.grant(), so the gating stays identical.
"""
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException

from api import entitlements_store as store

router = APIRouter()

store.init_db()


class GrantRequest(BaseModel):
    product_id: str
    email: str | None = None
    source: str = "manual"
    # Reuse an existing key so a buyer's purchases accumulate under one license.
    license_key: str | None = None


@router.post("/api/entitlements/grant")
async def grant_entitlement(req: GrantRequest):
    """Issue (or extend) a license key entitling the buyer to download a product.

    Phase 1: an admin/dev action standing in for a real purchase. Phase 2's
    payment webhook posts here with source='stripe'.
    """
    if not req.product_id.strip():
        raise HTTPException(status_code=400, detail="product_id is required")
    return store.grant(req.product_id.strip(), email=req.email,
                       source=req.source, license_key=req.license_key)


@router.get("/api/entitlements")
async def list_entitlements(key: str):
    """Products a license key currently unlocks (drives the storefront's lock state)."""
    return {"license_key": key, "products": store.list_for_key(key)}


@router.get("/api/entitlements/check/{product_id}")
async def check_entitlement(product_id: str, key: str):
    """Whether `key` may download `product_id`."""
    return {"product_id": product_id, "owned": store.check(key, product_id)}
