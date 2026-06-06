"""Domain randomization — generate a customized dataset *variant* (DaaS Phase 3).

A buyer orders a synthetic dataset under specific conditions (lighting, texture,
physics). Real generation re-runs the Isaac Sim pipeline with those knobs, which
needs a GPU. This module ships a **mock generator** that derives a variant from
an existing dataset by applying the same randomization transforms to its frames —
no GPU, runs in well under a second — so the full order→product loop is usable on
the mock backend. Swap `generate_variant` for a pipeline call to go real.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

import numpy as np


@dataclass
class RandomizationSpec:
    lighting: bool = False
    texture: bool = False
    physics: bool = False
    strength: float = 0.3  # 0..1, how aggressive the randomization is

    def enabled(self) -> list[str]:
        return [k for k in ("lighting", "texture", "physics") if getattr(self, k)]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def variant_tag(base_id: str, spec: RandomizationSpec, episodes: int) -> str:
    """Deterministic short tag so an identical order maps to the same product."""
    import hashlib

    knobs = "".join("1" if getattr(spec, k) else "0" for k in ("lighting", "texture", "physics"))
    raw = f"{base_id}|{knobs}|{spec.strength:.2f}|{episodes}"
    return hashlib.md5(raw.encode()).hexdigest()[:6]


def generate_variant(
    base_path: str | Path,
    out_path: str | Path,
    spec: RandomizationSpec,
    *,
    max_frames: int = 240,
    seed: int = 7,
) -> dict[str, Any]:
    """Write a randomized HDF5 derived from `base_path`. Returns small stats.

    Reads only a strided slice of the base so a large source file is never loaded
    in full. Applies: lighting → per-frame brightness shift; texture → additive
    RGB noise; physics → jitter on joint_state/action.
    """
    import h5py

    base_path, out_path = Path(base_path), Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)
    s = float(np.clip(spec.strength, 0.0, 1.0))

    with h5py.File(base_path, "r") as f:
        n = int(f["joint_state"].shape[0]) if "joint_state" in f else int(f["action"].shape[0])
        stride = max(1, n // max_frames)
        take = slice(None, None, stride)

        joints = np.asarray(f["joint_state"][take][:max_frames], dtype=np.float32) if "joint_state" in f else None
        actions = np.asarray(f["action"][take][:max_frames], dtype=np.float32) if "action" in f else None
        rewards = np.asarray(f["reward"][take][:max_frames], dtype=np.float32) if "reward" in f else None
        rgb = np.asarray(f["rgb"][take][:max_frames], dtype=np.uint8) if "rgb" in f else None

    # physics: jitter proprioception/actions
    if spec.physics:
        if joints is not None:
            joints = joints + rng.normal(0, 0.02 * s, joints.shape).astype(np.float32)
        if actions is not None:
            actions = np.clip(actions + rng.normal(0, 0.05 * s, actions.shape).astype(np.float32), -1.0, 1.0)

    # lighting + texture: photometric randomization on RGB
    if rgb is not None and (spec.lighting or spec.texture):
        img = rgb.astype(np.float32)
        if spec.lighting:
            factors = rng.uniform(1.0 - 0.5 * s, 1.0 + 0.5 * s, size=(img.shape[0], 1, 1, 1))
            img = img * factors
        if spec.texture:
            img = img + rng.normal(0, 40.0 * s, img.shape).astype(np.float32)
        rgb = np.clip(img, 0, 255).astype(np.uint8)

    with h5py.File(out_path, "w") as f:
        if rgb is not None:
            f.create_dataset("rgb", data=rgb)
        if joints is not None:
            f.create_dataset("joint_state", data=joints)
        if actions is not None:
            f.create_dataset("action", data=actions)
        if rewards is not None:
            f.create_dataset("reward", data=rewards)

    frames = int(joints.shape[0]) if joints is not None else (int(rgb.shape[0]) if rgb is not None else 0)
    print(f"[GENERATE] variant {out_path.name}: {frames} frames, knobs={spec.enabled()}", flush=True)
    return {"frames": frames, "has_rgb": rgb is not None, "knobs": spec.enabled()}
