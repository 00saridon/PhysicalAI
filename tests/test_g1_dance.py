"""G1 dance choreography (scripts/g1_dance.py) and its contract with the
dashboard rig (dashboard/src/sim/models.tsx)."""
import importlib.util
import re
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).parent.parent


def _load():
    spec = importlib.util.spec_from_file_location("g1_dance", ROOT / "scripts" / "g1_dance.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def dance():
    mod = _load()
    joints, root = mod.generate()
    return mod, joints, root


def test_shapes_and_duration(dance):
    mod, joints, root = dance
    n = int(round(mod.BEATS * 60 / mod.BPM * mod.FPS))
    assert joints.shape == (n, 29)
    assert root.shape == (n, 4)
    assert np.isfinite(joints).all() and np.isfinite(root).all()


def test_joint_order_matches_dashboard_rig(dance):
    mod, _, _ = dance
    src = (ROOT / "dashboard" / "src" / "sim" / "models.tsx").read_text(encoding="utf-8")
    block = re.search(r"const G1_JOINTS = \[(.*?)\]", src, re.S).group(1)
    assert re.findall(r"'([a-z_]+)'", block) == mod.G1_JOINTS


def test_feet_stay_flat_and_on_the_floor(dance):
    mod, joints, root = dance
    j = {n: joints[:, i] for i, n in enumerate(mod.G1_JOINTS)}
    soles = []
    for s in "lr":
        np.testing.assert_allclose(j[f"{s}_ankle_pitch"], -(j[f"{s}_hip_pitch"] + j[f"{s}_knee"]), atol=1e-5)
        np.testing.assert_allclose(j[f"{s}_ankle_roll"], -j[f"{s}_hip_roll"], atol=1e-5)
        drop = mod.HIP_DROP + np.cos(j[f"{s}_hip_roll"]) * (
            mod.THIGH * np.cos(j[f"{s}_hip_pitch"]) + mod.SHANK * np.cos(j[f"{s}_hip_pitch"] + j[f"{s}_knee"])) + mod.SOLE
        soles.append(mod.STAND + root[:, 1] - drop)     # sole height above the standing sole level
    soles = np.stack(soles)
    assert soles.min() > -1e-4                           # never sinks into the floor
    np.testing.assert_allclose(soles.min(axis=0), 0, atol=1e-4)   # one foot always planted


def test_static_motion_file_in_sync(monkeypatch):
    """dashboard/public/motions/g1_dance.json (offline fallback) must match the
    generator — re-run scripts/export_static_motions.py after changing it."""
    import json
    monkeypatch.syspath_prepend(str(ROOT / "scripts"))
    spec = importlib.util.spec_from_file_location("export_static_motions", ROOT / "scripts" / "export_static_motions.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    committed = json.loads((ROOT / "dashboard" / "public" / "motions" / "g1_dance.json").read_text(encoding="utf-8"))
    assert committed == mod.g1_dance_payload()


def test_loops_smoothly(dance):
    _, joints, root = dance
    step = np.abs(np.diff(joints, axis=0)).max()
    wrap = np.abs(joints[0] - joints[-1]).max()
    assert wrap <= step + 1e-6                           # last -> first is no bigger than any frame step
    assert step < 0.4                                    # < 12 rad/s at 30 fps
    assert abs(np.cos(root[-1, 3]) - np.cos(root[0, 3])) < 1e-3   # full turn ends facing forward
