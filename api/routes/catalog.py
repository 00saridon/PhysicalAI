"""Catalog API — exposes datasets as sellable products (DaaS Phase 0).

Reads manifests (or derives them) via export.manifest and serves a storefront
listing, per-product detail, and a download. Access gating / metering come in a
later phase; for now every product is downloadable.
"""
import re
from pathlib import Path

from pydantic import BaseModel

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import FileResponse

from api import entitlements_store as store
from export.manifest import (
    scan_catalog, load_manifest, build_manifest, build_variant_manifest, save_manifest,
)
from export.randomization import RandomizationSpec, generate_variant, variant_tag

router = APIRouter()

# Customization premium added per enabled randomization knob (USD).
_KNOB_PREMIUM = 50

_ROOT = Path(__file__).parent.parent.parent  # PhysicalAI/
_DATASET_DIR = _ROOT / "outputs" / "dataset"


def _resolve(name: str) -> Path:
    name = re.sub(r"[^A-Za-z0-9_.-]", "", name or "") or ""
    if name.endswith(".hdf5"):
        name = name[:-5]
    return _DATASET_DIR / f"{name}.hdf5"


@router.get("/api/catalog")
async def list_catalog():
    """All datasets as catalog products (manifest-backed or derived)."""
    return scan_catalog(_DATASET_DIR)


@router.get("/api/catalog/{product_id}")
async def get_product(product_id: str):
    """One product's full metadata, plus a preview-frame URL when it has RGB."""
    path = _resolve(product_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{product_id}' not found.")
    manifest = load_manifest(path) or build_manifest(path)
    manifest["download_url"] = f"/api/catalog/{manifest['id']}/download"
    if manifest.get("has_preview"):
        manifest["preview_url"] = f"/api/dataset/frame?name={manifest['id']}&idx={manifest.get('preview_frame', 0)}"
    return manifest


class GenerateRequest(BaseModel):
    lighting: bool = False
    texture: bool = False
    physics: bool = False
    strength: float = 0.3
    episodes: int = 10


@router.post("/api/catalog/{product_id}/generate")
async def generate(product_id: str, req: GenerateRequest):
    """Order a randomized *variant* of a product (DaaS Phase 3).

    Produces a new derived dataset + manifest under the chosen randomization
    conditions, so it shows up in the catalog as its own (priced) product. The
    variant is deterministic per (base, knobs, strength, episodes) — re-ordering
    the same spec returns the existing product instead of regenerating.
    """
    base_path = _resolve(product_id)
    if not base_path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{product_id}' not found.")
    base = load_manifest(base_path) or build_manifest(base_path)

    spec = RandomizationSpec(lighting=req.lighting, texture=req.texture,
                             physics=req.physics, strength=req.strength)
    if not spec.enabled():
        raise HTTPException(status_code=400, detail="Enable at least one randomization knob.")
    episodes = max(1, min(req.episodes, 50))

    tag = variant_tag(base["id"], spec, episodes)
    variant_id = f"{base['id']}__v{tag}"
    variant_path = _DATASET_DIR / f"{variant_id}.hdf5"

    if variant_path.exists():  # idempotent: same order → same product
        manifest = load_manifest(variant_path)
        if manifest:
            return {**manifest, "reused": True}

    generate_variant(base_path, variant_path, spec, seed=int(tag, 16) % 100000)
    price = int(base.get("price_usd", 0)) + _KNOB_PREMIUM * len(spec.enabled())
    manifest = build_variant_manifest(base, variant_path, randomization=spec.to_dict(),
                                      episodes=episodes, price_usd=price)
    save_manifest(variant_path, manifest)
    return {**manifest, "reused": False}


@router.get("/api/catalog/{product_id}/download")
async def download_product(
    product_id: str,
    key: str | None = None,
    x_license_key: str | None = Header(default=None),
):
    """Stream the dataset HDF5.

    Free products are open. Paid products require a license key (query `?key=`
    so a plain <a> link works, or the `X-License-Key` header) that holds a live
    entitlement for this product — otherwise 402 Payment Required.
    """
    path = _resolve(product_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{product_id}' not found.")

    manifest = load_manifest(path) or build_manifest(path)
    if manifest.get("tier") == "paid":
        license_key = key or x_license_key or ""
        if not store.check(license_key, manifest["id"]):
            raise HTTPException(
                status_code=402,
                detail="This dataset is paid. Provide a valid license key to download.",
            )

    return FileResponse(path=str(path), filename=path.name, media_type="application/x-hdf5")
