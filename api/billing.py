"""Billing provider — Stripe Checkout with a keyless mock fallback (DaaS Phase 2).

A purchase is a `checkout_session` that starts `pending` and becomes `paid` on
*fulfillment*. Fulfillment issues/extends a license entitlement via the Phase 1
store, so the download-gating in api/routes/catalog.py is untouched.

Two providers, one fulfillment path:
  • stripe — real Checkout; the webhook calls fulfill() on checkout.session.completed.
  • mock   — no keys needed; the storefront's mock-pay endpoint calls fulfill().

Set STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET) to switch to the real provider.
"""
from __future__ import annotations

import os
import secrets
from typing import Any

from api import entitlements_store as store


def stripe_enabled() -> bool:
    return bool(os.getenv("STRIPE_SECRET_KEY"))


def _new_session_id() -> str:
    return "cs_" + secrets.token_urlsafe(18)


def create_checkout(
    *,
    product_id: str,
    price_usd: int,
    product_name: str,
    email: str | None,
    license_key: str | None,
    success_url: str,
    cancel_url: str,
) -> dict[str, Any]:
    """Open a checkout session. Returns the mode + a URL to send the buyer to.

    In mock mode there is no hosted page, so `checkout_url` is None and the
    storefront drives a local confirm dialog that hits the mock-pay endpoint.
    """
    session_id = _new_session_id()
    provider = "stripe" if stripe_enabled() else "mock"
    store.create_session(session_id, product_id, email=email,
                         license_key=license_key, provider=provider)

    if provider == "stripe":
        import stripe

        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        sess = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "unit_amount": int(price_usd) * 100,
                    "product_data": {"name": product_name},
                },
                "quantity": 1,
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=email,
            client_reference_id=session_id,
            metadata={"session_id": session_id, "product_id": product_id,
                      "license_key": license_key or ""},
        )
        store.set_session_provider_id(session_id, sess.id)
        return {"mode": "stripe", "session_id": session_id, "checkout_url": sess.url}

    return {"mode": "mock", "session_id": session_id, "checkout_url": None}


def fulfill(session_id: str) -> dict[str, Any] | None:
    """Grant the entitlement for a paid session (idempotent). Returns the key info."""
    sess = store.get_session(session_id)
    if sess is None:
        return None
    if sess["status"] == "paid" and sess["granted_key"]:
        return {"license_key": sess["granted_key"], "product_id": sess["product_id"],
                "already": True}
    ent = store.grant(
        sess["product_id"],
        email=sess["email"],
        source=sess["provider"],
        license_key=sess["license_key"] or None,
    )
    store.mark_session_paid(session_id, ent["license_key"])
    return {"license_key": ent["license_key"], "product_id": sess["product_id"],
            "already": False}
