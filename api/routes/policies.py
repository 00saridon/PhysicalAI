"""Marketplace API — exposes trained policies as sellable skills (Model #3).

The policy analogue of routes/catalog.py. Lists checkpoints in outputs/policy as
marketplace products (manifest-backed or derived), serves per-product detail, and
streams a gated download. Entitlements + billing are reused unchanged: a policy is
just another `product_id` in the same ledger, so paid downloads require a license
key exactly like paid datasets.
"""
import re
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import FileResponse

from api import entitlements_store as store
from export.policy_manifest import (
    scan_policies, load_policy_manifest, build_policy_manifest,
)

router = APIRouter()

_ROOT = Path(__file__).parent.parent.parent  # PhysicalAI/
_POLICY_DIR = _ROOT / "outputs" / "policy"
_EXTS = (".onnx", ".pt", ".zip")


def _resolve(product_id: str) -> Path | None:
    """Map a product id to its checkpoint file, trying known extensions."""
    name = re.sub(r"[^A-Za-z0-9_.-]", "", product_id or "")
    for ext in _EXTS:
        if name.endswith(ext):
            name = name[: -len(ext)]
            break
    for ext in _EXTS:
        path = _POLICY_DIR / f"{name}{ext}"
        if path.exists():
            return path
    return None


@router.get("/api/policies")
async def list_policies():
    """All trained policies as marketplace products (manifest-backed or derived)."""
    return scan_policies(_POLICY_DIR)


@router.get("/api/policies/{product_id}")
async def get_policy(product_id: str):
    """One policy's full metadata (metrics, lineage, format) plus a download URL."""
    path = _resolve(product_id)
    if path is None:
        raise HTTPException(status_code=404, detail=f"Policy '{product_id}' not found.")
    manifest = load_policy_manifest(path) or build_policy_manifest(path)
    manifest["download_url"] = f"/api/policies/{manifest['id']}/download"
    return manifest


@router.get("/api/policies/{product_id}/download")
async def download_policy(
    product_id: str,
    key: str | None = None,
    x_license_key: str | None = Header(default=None),
):
    """Stream the policy checkpoint.

    Free policies are open. Paid policies require a license key (query `?key=` so a
    plain <a> link works, or the `X-License-Key` header) holding a live entitlement
    for this product — otherwise 402 Payment Required.
    """
    path = _resolve(product_id)
    if path is None:
        raise HTTPException(status_code=404, detail=f"Policy '{product_id}' not found.")

    manifest = load_policy_manifest(path) or build_policy_manifest(path)
    if manifest.get("tier") == "paid":
        license_key = key or x_license_key or ""
        if not store.check(license_key, manifest["id"]):
            raise HTTPException(
                status_code=402,
                detail="This policy is paid. Provide a valid license key to download.",
            )

    media = "application/octet-stream"
    return FileResponse(path=str(path), filename=path.name, media_type=media)
