"""Dataset manifests — turn a raw HDF5 file into a sellable catalog product.

A manifest is a JSON sidecar next to the dataset:
    outputs/dataset/<name>.hdf5  →  outputs/dataset/<name>.manifest.json

It is the single source of truth for the catalog, previews, licensing, and
(later) entitlement/billing. EXPORT writes one automatically; datasets that
predate this (the seeded demos) get sensible metadata *derived* on the fly so
they still appear in the catalog as free products.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

MANIFEST_SUFFIX = ".manifest.json"
SCHEMA_VERSION = 1

# Maps a dataset stem (outputs/dataset/<stem>.hdf5) to product metadata that
# mirrors the robot library in dashboard/src/sim/models.tsx. Datasets not listed
# here fall back to generic defaults derived from the file itself.
_ROBOT_MAP: dict[str, dict[str, Any]] = {
    "synthetic_v1": {"robot": "franka", "robot_name": "Franka 7-DOF Arm", "category": "Manipulator",
                     "task": "pick_place", "tier": "paid", "price_usd": 499, "license": "commercial-single-seat"},
    "anymal_v1":    {"robot": "anymal", "robot_name": "ANYmal-D", "category": "Quadruped",
                     "task": "locomotion", "tier": "paid", "price_usd": 199, "license": "commercial-single-seat"},
    "spot_v1":      {"robot": "spot", "robot_name": "Boston Dynamics Spot", "category": "Quadruped",
                     "task": "locomotion", "tier": "paid", "price_usd": 199, "license": "commercial-single-seat"},
    "h1_v1":        {"robot": "h1", "robot_name": "Unitree H1", "category": "Humanoid",
                     "task": "locomotion", "tier": "paid", "price_usd": 299, "license": "commercial-single-seat"},
    "g1_v1":        {"robot": "g1", "robot_name": "Unitree G1", "category": "Humanoid",
                     "task": "locomotion", "tier": "paid", "price_usd": 299, "license": "commercial-single-seat"},
    "crazyflie_v1": {"robot": "crazyflie", "robot_name": "Crazyflie Quadcopter", "category": "Aerial",
                     "task": "hover", "tier": "free", "price_usd": 0, "license": "research"},
}

_DEFAULTS = {"robot": "generic", "robot_name": "Robot", "category": "Other",
             "task": "demo", "tier": "free", "price_usd": 0, "license": "research"}


def _sha256(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def _inspect_hdf5(path: Path) -> dict[str, Any]:
    """Read shapes/keys cheaply — never loads full arrays into memory."""
    import h5py

    info: dict[str, Any] = {"sensors": [], "frames": 0, "joint_dim": 0, "action_dim": 0}
    with h5py.File(path, "r") as f:
        keys = set(f.keys())
        # demos nest observations under an "obs" group; flatten those names in
        if "obs" in f and isinstance(f["obs"], h5py.Group):
            keys.discard("obs")
            keys.update(f["obs"].keys())
        sensor_keys = ("rgb", "depth", "joint_state", "ee_pose")
        info["sensors"] = [k for k in sensor_keys if k in keys]

        def _get(name):
            if name in f:
                return f[name]
            if "obs" in f and name in f["obs"]:
                return f["obs"][name]
            return None

        js = _get("joint_state")
        if js is not None:
            info["frames"] = int(js.shape[0])
            info["joint_dim"] = int(js.shape[1]) if js.ndim > 1 else 1
        act = f["action"] if "action" in f else None
        if act is not None:
            info["action_dim"] = int(act.shape[1]) if act.ndim > 1 else 1
            if not info["frames"]:
                info["frames"] = int(act.shape[0])
    return info


def build_manifest(dataset_path: str | Path, *, episodes: int | None = None,
                   version: str = "1.0.0", randomization: dict | None = None,
                   extra: dict | None = None) -> dict[str, Any]:
    """Assemble manifest metadata for a dataset file (no disk write)."""
    path = Path(dataset_path)
    stem = path.stem
    meta = {**_DEFAULTS, **_ROBOT_MAP.get(stem, {})}
    info = _inspect_hdf5(path)
    stat = path.stat()
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "id": stem,
        "robot": meta["robot"],
        "robot_name": meta["robot_name"],
        "category": meta["category"],
        "task": meta["task"],
        "version": version,
        "episodes": episodes if episodes is not None else info["frames"],
        "frames": info["frames"],
        "sensors": info["sensors"],
        "joint_dim": info["joint_dim"],
        "action_dim": info["action_dim"],
        "randomization": randomization or {"lighting": False, "texture": False, "physics": False},
        "license": meta["license"],
        "tier": meta["tier"],
        "price_usd": meta["price_usd"],
        "size_bytes": stat.st_size,
        "checksum_sha256": _sha256(path),
        "preview_frame": 0,
        "created_at": int(stat.st_mtime),
        "has_preview": "rgb" in info["sensors"],
    }
    if extra:
        manifest.update(extra)
    return manifest


def write_manifest(dataset_path: str | Path, **kwargs) -> Path:
    """Build and persist a manifest sidecar next to the dataset. Returns its path."""
    path = Path(dataset_path)
    manifest = build_manifest(path, **kwargs)
    out = path.with_suffix("")  # strip .hdf5
    out = out.with_name(out.name + MANIFEST_SUFFIX)
    out.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[EXPORT] Wrote manifest → {out}", flush=True)
    return out


def build_variant_manifest(base: dict[str, Any], variant_path: str | Path, *,
                           randomization: dict[str, Any], episodes: int,
                           price_usd: int, version: str = "1.0.0-var") -> dict[str, Any]:
    """A variant inherits its parent's robot identity/license but carries its own
    randomization spec, price, checksum and stats."""
    path = Path(variant_path)
    info = _inspect_hdf5(path)
    stat = path.stat()
    return {
        "schema_version": SCHEMA_VERSION,
        "id": path.stem,
        "robot": base["robot"],
        "robot_name": f'{base["robot_name"]} (randomized)',
        "category": base["category"],
        "task": base["task"],
        "version": version,
        "episodes": episodes,
        "frames": info["frames"],
        "sensors": info["sensors"],
        "joint_dim": info["joint_dim"],
        "action_dim": info["action_dim"],
        "randomization": randomization,
        "license": base["license"],
        "tier": "paid" if price_usd > 0 else "free",
        "price_usd": price_usd,
        "size_bytes": stat.st_size,
        "checksum_sha256": _sha256(path),
        "preview_frame": 0,
        "created_at": int(stat.st_mtime),
        "has_preview": "rgb" in info["sensors"],
        "derived": True,
        "variant": True,
        "parent_id": base["id"],
    }


def save_manifest(dataset_path: str | Path, manifest: dict[str, Any]) -> Path:
    """Persist a prebuilt manifest dict as the dataset's sidecar."""
    path = Path(dataset_path)
    out = path.with_suffix("").with_name(path.stem + MANIFEST_SUFFIX)
    out.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return out


def load_manifest(dataset_path: str | Path) -> dict[str, Any] | None:
    """Read a dataset's sidecar manifest if it exists, else None."""
    path = Path(dataset_path)
    side = path.with_suffix("").with_name(path.stem + MANIFEST_SUFFIX)
    if side.exists():
        try:
            return json.loads(side.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
    return None


def scan_catalog(dataset_dir: str | Path) -> list[dict[str, Any]]:
    """List every dataset in a directory as a catalog product.

    Uses the sidecar manifest when present; otherwise derives lightweight
    metadata so pre-manifest (seeded) datasets still appear. The expensive
    SHA-256 is only computed for authored manifests, so scanning stays fast.
    """
    base = Path(dataset_dir)
    if not base.exists():
        return []
    products: list[dict[str, Any]] = []
    for path in sorted(base.glob("*.hdf5")):
        manifest = load_manifest(path)
        if manifest is None:
            try:
                stem = path.stem
                meta = {**_DEFAULTS, **_ROBOT_MAP.get(stem, {})}
                info = _inspect_hdf5(path)
                stat = path.stat()
                manifest = {
                    "schema_version": SCHEMA_VERSION,
                    "id": stem,
                    "robot": meta["robot"],
                    "robot_name": meta["robot_name"],
                    "category": meta["category"],
                    "task": meta["task"],
                    "version": "1.0.0",
                    "episodes": info["frames"],
                    "frames": info["frames"],
                    "sensors": info["sensors"],
                    "joint_dim": info["joint_dim"],
                    "action_dim": info["action_dim"],
                    "randomization": {"lighting": False, "texture": False, "physics": False},
                    "license": meta["license"],
                    "tier": meta["tier"],
                    "price_usd": meta["price_usd"],
                    "size_bytes": stat.st_size,
                    "checksum_sha256": None,  # derived on the fly; not hashed
                    "preview_frame": 0,
                    "created_at": int(stat.st_mtime),
                    "has_preview": "rgb" in info["sensors"],
                    "derived": True,
                }
            except Exception as e:  # a corrupt/locked file shouldn't break the catalog
                print(f"[CATALOG] skip {path.name}: {e}", flush=True)
                continue
        products.append(manifest)
    products.sort(key=lambda m: m.get("created_at", 0), reverse=True)
    return products
