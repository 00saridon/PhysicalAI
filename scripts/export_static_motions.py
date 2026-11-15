"""Export hand-authored motions as static JSON for the dashboard.

The Simulation page normally loads trajectories from /api/dataset/trajectory.
When no backend is reachable (e.g. the static Netlify deploy), it falls back to
these files, so the G1 dance still plays. The JSON has the same shape as the
trajectory API response.

    python scripts/export_static_motions.py

Re-run after changing scripts/g1_dance.py (tests/test_g1_dance.py checks the
committed file is in sync).
"""
import json
from pathlib import Path

from g1_dance import FPS, generate

OUT = Path(__file__).parent.parent / "dashboard" / "public" / "motions"


def g1_dance_payload(decimals=4):
    joints, root = generate()
    j = [[round(float(v), decimals) for v in row] for row in joints]
    return {
        "name": "g1_dance",
        "n_total": len(j),
        "stride": 1,
        "count": len(j),
        "joint_dim": len(j[0]),
        "action_dim": len(j[0]),
        "has_rgb": False,
        "joints": j,
        "actions": j,                       # the dance is target-tracked: action == joint target
        "rewards": [0.0] * len(j),
        "layout": "g1_29dof",
        "fps": float(FPS),
        "root": [[round(float(v), decimals) for v in row] for row in root],
    }


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "g1_dance.json"
    path.write_text(json.dumps(g1_dance_payload(), separators=(",", ":")), encoding="utf-8")
    print(f"[motions] wrote {path} ({path.stat().st_size // 1024} KB)")
