"""Seed the Skill/Policy Marketplace (Model #3) with exported ONNX policies.

For every robot in the policy map we export a structurally-valid `MLPPolicy`
(obs -> action) to ONNX via the project's own `PolicyExporter`, then write the
marketplace manifest sidecar. These are real, downloadable ONNX graphs with the
correct I/O signature for each robot; the training metrics in the manifest are
illustrative seed values (the same spirit as the mock synthetic datasets), and
get overwritten the moment a genuinely trained checkpoint is exported here.

Run:  python -m scripts.seed_policies
"""
from __future__ import annotations

from pathlib import Path

from export.policy_exporter import PolicyExporter
from export.policy_manifest import _POLICY_MAP, build_policy_manifest, save_policy_manifest
from trainer.il.policy import MLPPolicy

_ROOT = Path(__file__).parent.parent
_POLICY_DIR = _ROOT / "outputs" / "policy"

# obs_dim / action_dim per robot (obs = joint_state + a small extra context vector).
_DIMS = {
    "franka_pick_place": (14, 7),
    "anymal_locomotion": (24, 12),
    "spot_locomotion": (24, 12),
    "h1_locomotion": (38, 19),
    "g1_locomotion": (46, 23),
    "crazyflie_hover": (8, 4),
}


def main() -> None:
    _POLICY_DIR.mkdir(parents=True, exist_ok=True)
    made = 0
    for stem, (obs_dim, action_dim) in _DIMS.items():
        if stem not in _POLICY_MAP:
            continue
        out = _POLICY_DIR / f"{stem}.onnx"
        policy = MLPPolicy(obs_dim=obs_dim, action_dim=action_dim)
        PolicyExporter(policy, obs_dim=obs_dim).to_onnx(str(out))
        manifest = build_policy_manifest(out)
        save_policy_manifest(out, manifest)
        m = manifest["metrics"]
        print(f"[SEED] {out.name}: {obs_dim}->{action_dim} | {manifest['algo']} | "
              f"success={m['success_rate']} | ${manifest['price_usd']} | "
              f"trained_on={manifest['trained_on']}", flush=True)
        made += 1
    print(f"[SEED] wrote {made} policies → {_POLICY_DIR}", flush=True)


if __name__ == "__main__":
    main()
