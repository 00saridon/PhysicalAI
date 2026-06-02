import io
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter()

_ROOT = Path(__file__).parent.parent.parent  # PhysicalAI/
_DATASET_DIR = _ROOT / "outputs" / "dataset"


def _resolve(name: str) -> Path:
    """Map a dataset name to outputs/dataset/<name>.hdf5 (sanitized).

    Lets each robot model load its own joint_state trajectory by name, e.g.
    `synthetic_v1` (the arm policy) or a future `anymal_v1`.
    """
    name = re.sub(r"[^A-Za-z0-9_.-]", "", name or "synthetic_v1") or "synthetic_v1"
    if name.endswith(".hdf5"):
        name = name[:-5]
    return _DATASET_DIR / f"{name}.hdf5"


@router.get("/api/dataset/trajectory")
async def dataset_trajectory(name: str = "synthetic_v1", frames: int = 240):
    """Return a downsampled joint/action/reward trajectory for the 3D playback.
    Reads only a strided slice so large HDF5 files are never loaded in full."""
    path = _resolve(name)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found — run EXPORT or add the file.")

    import h5py
    import numpy as np

    frames = max(1, min(frames, 1000))
    with h5py.File(path, "r") as f:
        n = int(f["joint_state"].shape[0])
        stride = max(1, n // frames)
        joints = np.asarray(f["joint_state"][::stride][:frames], dtype=float)
        actions = np.asarray(f["action"][::stride][:frames], dtype=float) if "action" in f else np.zeros((len(joints), 0))
        rewards = np.asarray(f["reward"][::stride][:frames], dtype=float).reshape(-1) if "reward" in f else np.zeros(len(joints))
        has_rgb = "rgb" in f

    return {
        "name": name,
        "n_total": n,
        "stride": stride,
        "count": int(len(joints)),
        "joint_dim": int(joints.shape[1]) if joints.ndim > 1 else 1,
        "action_dim": int(actions.shape[1]) if actions.ndim > 1 else 0,
        "has_rgb": has_rgb,
        "joints": joints.tolist(),
        "actions": actions.tolist(),
        "rewards": rewards.tolist(),
    }


@router.get("/api/dataset/frame")
async def dataset_frame(name: str = "synthetic_v1", idx: int = 0):
    """Return the RGB observation at frame `idx` from dataset `name` as a PNG."""
    path = _resolve(name)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found.")

    import h5py
    import numpy as np
    from PIL import Image

    with h5py.File(path, "r") as f:
        if "rgb" not in f:
            raise HTTPException(status_code=404, detail="Dataset has no rgb observations.")
        n = int(f["rgb"].shape[0])
        idx = max(0, min(idx, n - 1))
        arr = np.asarray(f["rgb"][idx], dtype=np.uint8)

    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png",
                    headers={"Cache-Control": "no-store"})
