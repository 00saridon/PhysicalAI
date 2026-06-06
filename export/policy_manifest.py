"""Policy manifests — turn a trained checkpoint into a sellable marketplace skill.

Model #3 (Skill/Policy Marketplace) is the policy analogue of the DaaS catalog:
a manifest is a JSON sidecar next to a policy file

    outputs/policy/<name>.onnx  →  outputs/policy/<name>.policy.json

and it is the single source of truth for the marketplace listing, licensing and
billing. The differentiators versus a dataset product are **lineage** (which
dataset trained the policy — a direct link back to a Model #1 product) and
**performance metrics** (success rate, mean reward) that justify the price.

Entitlements and billing are reused verbatim: a policy is just a `product_id`
in the same ledger, so the paid-download gate and checkout flow need no changes.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

POLICY_SUFFIX = ".policy.json"
SCHEMA_VERSION = 1

_FORMAT_MAP = {".onnx": "onnx", ".pt": "torchscript", ".zip": "sb3-zip"}

# Maps a policy stem (outputs/policy/<stem>.onnx) to product metadata. Mirrors the
# robot library and links each policy to the dataset it was trained on so the
# marketplace can show provenance. Unlisted files fall back to generic defaults.
_POLICY_MAP: dict[str, dict[str, Any]] = {
    "franka_pick_place": {
        "robot": "franka", "robot_name": "Franka 7-DOF Arm", "category": "Manipulator",
        "task": "pick_place", "algo": "BC", "trained_on": "synthetic_v1",
        "success_rate": 0.92, "mean_reward": 18.4, "episodes_trained": 500,
        "tier": "paid", "price_usd": 899, "license": "commercial-single-seat"},
    "anymal_locomotion": {
        "robot": "anymal", "robot_name": "ANYmal-D", "category": "Quadruped",
        "task": "locomotion", "algo": "PPO", "trained_on": "anymal_v1",
        "success_rate": 0.88, "mean_reward": 24.1, "episodes_trained": 2000,
        "tier": "paid", "price_usd": 499, "license": "commercial-single-seat"},
    "spot_locomotion": {
        "robot": "spot", "robot_name": "Boston Dynamics Spot", "category": "Quadruped",
        "task": "locomotion", "algo": "PPO", "trained_on": "spot_v1",
        "success_rate": 0.86, "mean_reward": 22.7, "episodes_trained": 2000,
        "tier": "paid", "price_usd": 499, "license": "commercial-single-seat"},
    "h1_locomotion": {
        "robot": "h1", "robot_name": "Unitree H1", "category": "Humanoid",
        "task": "locomotion", "algo": "SAC", "trained_on": "h1_v1",
        "success_rate": 0.79, "mean_reward": 19.3, "episodes_trained": 4000,
        "tier": "paid", "price_usd": 699, "license": "commercial-single-seat"},
    "g1_locomotion": {
        "robot": "g1", "robot_name": "Unitree G1", "category": "Humanoid",
        "task": "locomotion", "algo": "SAC", "trained_on": "g1_v1",
        "success_rate": 0.77, "mean_reward": 18.1, "episodes_trained": 4000,
        "tier": "paid", "price_usd": 699, "license": "commercial-single-seat"},
    "crazyflie_hover": {
        "robot": "crazyflie", "robot_name": "Crazyflie Quadcopter", "category": "Aerial",
        "task": "hover", "algo": "PPO", "trained_on": "crazyflie_v1",
        "success_rate": 0.95, "mean_reward": 27.5, "episodes_trained": 1000,
        "tier": "free", "price_usd": 0, "license": "research"},
    # The pipeline's own exported baseline — free research checkpoint.
    "policy": {
        "robot": "franka", "robot_name": "Franka 7-DOF Arm", "category": "Manipulator",
        "task": "pick_place", "algo": "BC", "trained_on": "synthetic_v1",
        "success_rate": 0.71, "mean_reward": 12.0, "episodes_trained": 100,
        "tier": "free", "price_usd": 0, "license": "research"},
}

_DEFAULTS = {"robot": "generic", "robot_name": "Robot", "category": "Other",
             "task": "control", "algo": "BC", "trained_on": None,
             "success_rate": None, "mean_reward": None, "episodes_trained": None,
             "tier": "free", "price_usd": 0, "license": "research"}


def _sha256(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def _inspect_onnx(path: Path) -> dict[str, Any]:
    """Read obs/action dims from an ONNX graph cheaply. Best-effort; never raises."""
    info: dict[str, Any] = {"obs_dim": None, "action_dim": None, "opset": None}
    if path.suffix != ".onnx":
        return info
    try:
        import onnx

        model = onnx.load(str(path), load_external_data=False)

        def _dim(value_infos):
            for vi in value_infos:
                shape = vi.type.tensor_type.shape.dim
                if shape:
                    return int(shape[-1].dim_value) or None
            return None

        info["obs_dim"] = _dim(model.graph.input)
        info["action_dim"] = _dim(model.graph.output)
        if model.opset_import:
            info["opset"] = int(model.opset_import[0].version)
    except Exception:
        pass
    return info


def build_policy_manifest(policy_path: str | Path, *, version: str = "1.0.0",
                          extra: dict | None = None) -> dict[str, Any]:
    """Assemble marketplace metadata for a policy checkpoint (no disk write)."""
    path = Path(policy_path)
    stem = path.stem
    meta = {**_DEFAULTS, **_POLICY_MAP.get(stem, {})}
    info = _inspect_onnx(path)
    stat = path.stat()
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "id": stem,
        "kind": "policy",
        "robot": meta["robot"],
        "robot_name": meta["robot_name"],
        "category": meta["category"],
        "task": meta["task"],
        "algo": meta["algo"],
        "trained_on": meta["trained_on"],
        "format": _FORMAT_MAP.get(path.suffix, path.suffix.lstrip(".")),
        "obs_dim": info["obs_dim"],
        "action_dim": info["action_dim"],
        "opset": info["opset"],
        "version": version,
        "metrics": {
            "success_rate": meta["success_rate"],
            "mean_reward": meta["mean_reward"],
            "episodes_trained": meta["episodes_trained"],
        },
        "license": meta["license"],
        "tier": meta["tier"],
        "price_usd": meta["price_usd"],
        "size_bytes": stat.st_size,
        "checksum_sha256": _sha256(path),
        "created_at": int(stat.st_mtime),
    }
    if extra:
        manifest.update(extra)
    return manifest


def save_policy_manifest(policy_path: str | Path, manifest: dict[str, Any]) -> Path:
    """Persist a prebuilt manifest dict as the policy's sidecar."""
    path = Path(policy_path)
    out = path.with_suffix("").with_name(path.stem + POLICY_SUFFIX)
    out.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return out


def write_policy_manifest(policy_path: str | Path, **kwargs) -> Path:
    """Build and persist a manifest sidecar next to a policy. Returns its path."""
    path = Path(policy_path)
    manifest = build_policy_manifest(path, **kwargs)
    return save_policy_manifest(path, manifest)


def load_policy_manifest(policy_path: str | Path) -> dict[str, Any] | None:
    """Read a policy's sidecar manifest if it exists, else None."""
    path = Path(policy_path)
    side = path.with_suffix("").with_name(path.stem + POLICY_SUFFIX)
    if side.exists():
        try:
            return json.loads(side.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
    return None


def scan_policies(policy_dir: str | Path) -> list[dict[str, Any]]:
    """List every checkpoint in a directory as a marketplace product.

    Uses the sidecar manifest when present; otherwise derives lightweight
    metadata so checkpoints without an authored manifest still appear. The
    expensive SHA-256 is only computed for authored manifests, keeping scans fast.
    """
    base = Path(policy_dir)
    if not base.exists():
        return []
    products: list[dict[str, Any]] = []
    for path in sorted(base.glob("*")):
        if path.suffix not in _FORMAT_MAP:
            continue
        manifest = load_policy_manifest(path)
        if manifest is None:
            try:
                stem = path.stem
                meta = {**_DEFAULTS, **_POLICY_MAP.get(stem, {})}
                info = _inspect_onnx(path)
                stat = path.stat()
                manifest = {
                    "schema_version": SCHEMA_VERSION,
                    "id": stem,
                    "kind": "policy",
                    "robot": meta["robot"],
                    "robot_name": meta["robot_name"],
                    "category": meta["category"],
                    "task": meta["task"],
                    "algo": meta["algo"],
                    "trained_on": meta["trained_on"],
                    "format": _FORMAT_MAP.get(path.suffix, path.suffix.lstrip(".")),
                    "obs_dim": info["obs_dim"],
                    "action_dim": info["action_dim"],
                    "opset": info["opset"],
                    "version": "1.0.0",
                    "metrics": {
                        "success_rate": meta["success_rate"],
                        "mean_reward": meta["mean_reward"],
                        "episodes_trained": meta["episodes_trained"],
                    },
                    "license": meta["license"],
                    "tier": meta["tier"],
                    "price_usd": meta["price_usd"],
                    "size_bytes": stat.st_size,
                    "checksum_sha256": None,  # derived on the fly; not hashed
                    "created_at": int(stat.st_mtime),
                    "derived": True,
                }
            except Exception as e:  # a corrupt/locked file shouldn't break the listing
                print(f"[MARKET] skip {path.name}: {e}", flush=True)
                continue
        products.append(manifest)
    products.sort(key=lambda m: m.get("price_usd", 0), reverse=True)
    return products
