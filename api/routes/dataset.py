import io
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter()

_ROOT = Path(__file__).parent.parent.parent  # PhysicalAI/
_DATASET = _ROOT / "outputs" / "dataset" / "synthetic_v1.hdf5"


@router.get("/api/dataset/trajectory")
async def dataset_trajectory(frames: int = 240):
    """Return a downsampled joint/action/reward trajectory from the synthetic
    dataset for the 3D robot playback view. Reads only a strided slice so the
    1.5GB HDF5 is never loaded in full."""
    if not _DATASET.exists():
        raise HTTPException(status_code=404, detail="Synthetic dataset not found — run EXPORT first.")

    import h5py
    import numpy as np

    frames = max(1, min(frames, 1000))
    with h5py.File(_DATASET, "r") as f:
        n = int(f["joint_state"].shape[0])
        stride = max(1, n // frames)
        joints = np.asarray(f["joint_state"][::stride][:frames], dtype=float)
        actions = np.asarray(f["action"][::stride][:frames], dtype=float) if "action" in f else np.zeros((len(joints), 0))
        rewards = np.asarray(f["reward"][::stride][:frames], dtype=float).reshape(-1) if "reward" in f else np.zeros(len(joints))

    has_rgb = False
    with h5py.File(_DATASET, "r") as f:
        has_rgb = "rgb" in f

    return {
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
async def dataset_frame(idx: int = 0):
    """Return the synthetic RGB observation at frame `idx` as a PNG."""
    if not _DATASET.exists():
        raise HTTPException(status_code=404, detail="Synthetic dataset not found — run EXPORT first.")

    import h5py
    import numpy as np
    from PIL import Image

    with h5py.File(_DATASET, "r") as f:
        if "rgb" not in f:
            raise HTTPException(status_code=404, detail="Dataset has no rgb observations.")
        n = int(f["rgb"].shape[0])
        idx = max(0, min(idx, n - 1))
        arr = np.asarray(f["rgb"][idx], dtype=np.uint8)

    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png",
                    headers={"Cache-Control": "no-store"})
