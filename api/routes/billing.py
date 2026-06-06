"""Billing API — checkout, fulfillment, and the Stripe webhook (DaaS Phase 2).

Endpoints:
  POST /api/billing/checkout            open a checkout session (stripe or mock)
  POST /api/billing/mock/{sid}/pay      simulate a successful payment (mock only)
  GET  /api/billing/session/{sid}       poll a session's status + issued key
  POST /api/billing/webhook             Stripe fulfillment (checkout.session.completed)
"""
import os
import re
from pathlib import Path

from pydantic import BaseModel

from fastapi import APIRouter, HTTPException, Request

from api import billing
from api import entitlements_store as store
from export.manifest import build_manifest, load_manifest
from export.policy_manifest import (
    build_policy_manifest, load_policy_manifest,
)

router = APIRouter()

store.init_db()

_ROOT = Path(__file__).parent.parent.parent
_DATASET_DIR = _ROOT / "outputs" / "dataset"
_POLICY_DIR = _ROOT / "outputs" / "policy"
_POLICY_EXTS = (".onnx", ".pt", ".zip")


def _resolve(name: str) -> Path:
    name = re.sub(r"[^A-Za-z0-9_.-]", "", name or "")
    if name.endswith(".hdf5"):
        name = name[:-5]
    return _DATASET_DIR / f"{name}.hdf5"


def _resolve_policy(name: str) -> Path | None:
    name = re.sub(r"[^A-Za-z0-9_.-]", "", name or "")
    for ext in _POLICY_EXTS:
        if name.endswith(ext):
            name = name[: -len(ext)]
            break
    for ext in _POLICY_EXTS:
        path = _POLICY_DIR / f"{name}{ext}"
        if path.exists():
            return path
    return None


def _product(product_id: str) -> dict:
    """Resolve a checkout product — a dataset (Model #1) or a policy (Model #3)."""
    path = _resolve(product_id)
    if path.exists():
        manifest = load_manifest(path) or build_manifest(path)
        manifest.setdefault("_kind", "dataset")
        return manifest
    ppath = _resolve_policy(product_id)
    if ppath is not None:
        manifest = load_policy_manifest(ppath) or build_policy_manifest(ppath)
        manifest["_kind"] = "policy"
        return manifest
    raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")


class CheckoutRequest(BaseModel):
    product_id: str
    email: str | None = None
    license_key: str | None = None
    success_url: str | None = None
    cancel_url: str | None = None


@router.post("/api/billing/checkout")
async def checkout(req: CheckoutRequest):
    product = _product(req.product_id)
    if product.get("tier") != "paid":
        raise HTTPException(status_code=400, detail="This product is free — no checkout needed.")
    kind_label = "policy" if product.get("_kind") == "policy" else "synthetic dataset"
    return billing.create_checkout(
        product_id=product["id"],
        price_usd=int(product.get("price_usd", 0)),
        product_name=f'{product.get("robot_name", product["id"])} — {kind_label}',
        email=req.email,
        license_key=req.license_key,
        success_url=req.success_url or "",
        cancel_url=req.cancel_url or "",
    )


@router.post("/api/billing/mock/{session_id}/pay")
async def mock_pay(session_id: str):
    """Simulate a completed payment (no Stripe keys). Mirrors the webhook path."""
    sess = store.get_session(session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Unknown checkout session.")
    if sess["provider"] != "mock":
        raise HTTPException(status_code=400, detail="This session is not a mock checkout.")
    result = billing.fulfill(session_id)
    return result


@router.get("/api/billing/session/{session_id}")
async def get_session(session_id: str):
    sess = store.get_session(session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Unknown checkout session.")
    return {"session_id": session_id, "status": sess["status"],
            "license_key": sess["granted_key"], "product_id": sess["product_id"]}


@router.post("/api/billing/webhook")
async def stripe_webhook(request: Request):
    """Stripe fulfillment. Verifies the signature, then grants on completion."""
    import stripe

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, secret)
    except Exception as e:  # invalid signature / payload
        raise HTTPException(status_code=400, detail=f"Webhook verification failed: {e}")

    if event["type"] == "checkout.session.completed":
        meta = event["data"]["object"].get("metadata") or {}
        session_id = meta.get("session_id")
        if session_id:
            billing.fulfill(session_id)
    return {"received": True}
